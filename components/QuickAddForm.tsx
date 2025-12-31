// components/QuickAddForm.tsx
import { syncBridge } from "@/app/_layout"; // ✅ 브릿지 임포트
import { Piece, PiecesMap, Square, isSquareAttacked } from "@/scripts/Piece";
import { Chess } from "chess.js";
import { Asset } from "expo-asset";
import * as FileSystem from 'expo-file-system/legacy';
import { useSQLiteContext } from "expo-sqlite";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { EvalType } from "./Icons";

type Props = {
    visible: boolean;
    onClose: () => void;
    currentFen: string;
    parentFen: string;
    currentSan: string;
    lastMoveSan: string;
    currentPgn: string;
    openingNameKo: string;
    openingNameEn: string;
    openingEval: string | number;
    onSaveSuccess: () => void;
};

const PIECES_ENUM: (Piece | "")[] = ["", "knight", "bishop", "rook", "queen", "king"];
const PIECE_LABELS: Record<string, string> = { "": "P", knight: "N", bishop: "B", rook: "R", queen: "Q", king: "K" };
const EVAL_TYPES: EvalType[] = [
    "brilliant",
    "critical",
    "best",
    "excellent",
    "book",
    "okay",
    "forced",
    "inaccuracy",
    "mistake",
    "blunder"
];
const PLACEHOLDER_COLOR = "#999"; // ✅ 시인성 확보

export default function QuickAddForm({ visible, onClose, currentFen, parentFen, currentSan, lastMoveSan, currentPgn, openingNameKo, openingNameEn, openingEval, onSaveSuccess }: Props) {
    const db = useSQLiteContext();
    const [formKo, setFormKo] = useState("");
    const [formEn, setFormEn] = useState("");
    const [formEval, setFormEval] = useState("0.0");
    const [formDesc, setFormDesc] = useState("");
    const [formRecs, setFormRecs] = useState<{
        piece: Piece | "";
        sq: string;
        isCastle: "O-O" | "O-O-O" | null;
        name: string;
        type: EvalType;
        branchesText: string
    }[]>([]);

    // FEN 문자열을 기물 맵으로 변환하는 유틸
    const parseFenToPieces = (fen: string): PiecesMap => {
        const boardPart = fen.split(' ')[0];
        const rows = boardPart.split('/');
        const pieces: PiecesMap = {};
        rows.forEach((row, rIdx) => {
            let fIdx = 0;
            for (const char of row) {
                if (/\d/.test(char)) fIdx += parseInt(char);
                else {
                    const sq = `${String.fromCharCode(97 + fIdx)}${8 - rIdx}` as Square;
                    const pieceMap: Record<string, Piece> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
                    pieces[sq] = { color: char === char.toUpperCase() ? 'white' : 'black', piece: pieceMap[char.toLowerCase()] };
                    fIdx++;
                }
            }
        });
        return pieces;
    };

    const castlingInfo = useMemo(() => {
        const parts = currentFen.split(' ');
        const turnChar = parts[1];
        const rights = parts[2];
        const pieces = parseFenToPieces(currentFen);
        const rank = turnChar === 'w' ? 1 : 8;
        const isPathClear = (files: string[]) => files.every(f => !pieces[`${f}${rank}` as Square]);
        const opp = turnChar === 'w' ? 'black' : 'white';
        const kingSq = `e${rank}` as Square;
        const isAttacked = (sq: Square) => isSquareAttacked(pieces, sq, opp);
        const safeSquares = (files: string[]) => files.every(f => !isAttacked(`${f}${rank}` as Square));
        const notInCheck = !isAttacked(kingSq);

        const canK = (turnChar === 'w' ? rights.includes('K') : rights.includes('k'))
            && notInCheck
            && isPathClear(['f', 'g'])
            && safeSquares(['f', 'g']);

        const canQ = (turnChar === 'w' ? rights.includes('Q') : rights.includes('q'))
            && notInCheck
            && isPathClear(['b', 'c', 'd'])
            && safeSquares(['d', 'c']);

        return { canK, canQ };
    }, [currentFen]);

    // ✅ 체크, 메이트, 잡기를 자동으로 계산하는 SAN 생성기
    const calculateFinalSan = (rec: typeof formRecs[0]): string => {
        if (rec.isCastle) return rec.isCastle;
        if (!rec.sq) return "";

        try {
            // chess.js? ?? ?? ??? ??? ???? ???? SAN? ????
            const chess = new Chess(currentFen);
            const target = rec.sq as Square;
            const pieceLetterMap: Record<Piece | "", string> = { "": "p", pawn: "p", knight: "n", bishop: "b", rook: "r", queen: "q", king: "k" };
            const want = pieceLetterMap[rec.piece || ""] || "p";

            const match = (chess.moves({ verbose: true }) as any[]).find(m => m.to === target && m.piece === want);
            if (match) return (match.san as string).replace("... ", "");

            return `${PIECE_LABELS[rec.piece]}${rec.sq}`;
        } catch (e) {
            return `${PIECE_LABELS[rec.piece]}${rec.sq}`;
        }
    };

    // ✅ FEN 비교용 유틸 (수 번호 제외)
    const getBaseFen = (f: string) => f.split(' ').slice(0, 3).join(' ');

    // ✅ ECO TSV에서 영어 이름 검색 함수
    // ✅ eco.tsv에서 PGN 일치 여부로 영어 이름 찾기
    const lookupEnNameFromEco = async (pgn: string) => {
        try {
            const asset = Asset.fromModule(require('@/assets/eco.tsv'));
            if (!asset.localUri) await asset.downloadAsync();
            const content = await FileSystem.readAsStringAsync(asset.localUri || asset.uri);
            const lines = content.split('\n');
            const targetPgn = pgn.trim();

            let bestMatch: string | null = null;

            for (const line of lines) {
                const parts = line.split('\t');
                if (parts.length < 3) continue;
                const ecoPgn = parts[2].trim();
                const name = parts[1].trim();

                if (ecoPgn === targetPgn) {
                    return name; // exact match 우선
                }

                // target이 더 긴 경우, 그 앞부분이 일치하면 이전 브랜치 이름을 그대로 사용
                if (targetPgn.startsWith(ecoPgn)) {
                    bestMatch = name;
                }
            }

            if (bestMatch) return bestMatch;
        } catch (e) { console.log("ECO lookup error:", e); }
        return null;
    };

    // function describe(san: string) {
    //     const result = getMoveDescription(san);

    //     const { line1, line2 } = result;

    //     const output = line2
    //         ? `${line1}\n${line2}`
    //         : line1;

    //     return output
    // }


    useEffect(() => {
        async function loadExistingData() {
            if (!visible) return;
            const currentBase = getBaseFen(currentFen);
            const parentBase = getBaseFen(parentFen);
            const cleanLastMove = lastMoveSan.replace("... ", "");
            try {
                const pos = await db.getFirstAsync<any>('SELECT * FROM positions WHERE fen = ?', [currentBase]);
                if (pos) {
                    setFormKo(pos.name_ko || ""); setFormEn(pos.name_en || "");
                    setFormEval(String(pos.eval || "0.0"));
                } else {
                    // 1. 한글 이름: 이전 포지션의 '추천 수' 목록에서 내가 둔 수의 이름을 찾음
                    const prevMove = await db.getFirstAsync<any>(
                        'SELECT name FROM moves WHERE parent_fen = ? AND move_san = ?',
                        [parentBase, cleanLastMove]
                    );
                    // 추천 수에 적어둔 이름이 있다면 가져오고, 없으면 기존 오프닝 정보 유지
                    setFormKo(prevMove?.name || (openingNameKo !== "알 수 없는 오프닝" ? openingNameKo : ""));

                    // 2. 영어 이름: eco.tsv 파일에서 현재 FEN 매칭
                    // 이전 수에서 이미 설정된 영어 이름이 있다면 그대로 사용하고, 없을 때만 ECO를 조회
                    const parentPos = await db.getFirstAsync<any>('SELECT name_en FROM positions WHERE fen = ?', [parentBase]);
                    const inheritedEn = (parentPos?.name_en?.trim() || (openingNameEn !== "Unknown" ? openingNameEn : "")).trim();

                    if (inheritedEn) {
                        setFormEn(inheritedEn);
                    } else {
                        const ecoName = await lookupEnNameFromEco(currentPgn);
                        setFormEn(ecoName || "");
                    }

                    setFormEval(String(openingEval));
                }

                const moves = await db.getAllAsync<any>('SELECT * FROM moves WHERE parent_fen = ? ORDER BY priority ASC', [currentBase]);
                setFormRecs(moves.map(m => {
                    const isCastle = m.move_san.includes("O-O") ? (m.move_san.includes("O-O-O") ? "O-O-O" : "O-O") : null;
                    const branches = JSON.parse(m.branches || "[]");
                    const pieceChar = m.move_san.match(/^[NBRQK]/)?.[0] || "";
                    const pieceMap: any = { N: "knight", B: "bishop", R: "rook", Q: "queen", K: "king", "": "" };
                    const targetSq = isCastle ? "" : (m.move_san.match(/([a-h][1-8])/g)?.pop() || "");
                    return {
                        piece: isCastle ? "" : pieceMap[pieceChar],
                        sq: isCastle ? "" : targetSq,
                        isCastle, name: m.name || "", type: m.type as EvalType, branchesText: branches.join(", ")
                    };
                }));
            } catch (e) { console.error(e); }
        }
        loadExistingData();
    }, [visible, currentFen, currentSan]);

    const moveItem = (index: number, direction: 'up' | 'down') => {
        const nextIdx = direction === 'up' ? index - 1 : index + 1;
        if (nextIdx < 0 || nextIdx >= formRecs.length) return;
        const next = [...formRecs];
        [next[index], next[nextIdx]] = [next[nextIdx], next[index]];
        setFormRecs(next);
    };

    const saveToDB = async () => {
        const baseFen = currentFen.split(' ').slice(0, 3).join(' ');
        const fullSan = currentSan.trim();

        // 1. 서버에 보낼 JSON 데이터 구성
        const syncData = {
            position: { fen: baseFen, san: fullSan, name_ko: formKo, name_en: formEn, eval: formEval, desc: formDesc },
            moves: formRecs.map((rec, i) => ({
                move_san: calculateFinalSan(rec),
                name: rec.name || formKo,
                type: rec.type,
                priority: i + 1,
                branches: JSON.stringify(rec.branchesText.split(',').map((s: any) => s.trim()).filter((s: any) => s !== ""))
            }))
        };

        try {
            // A. 로컬 DB 먼저 저장
            await db.withTransactionAsync(async () => {
                await db.runAsync(`INSERT OR REPLACE INTO positions (fen, san, name_ko, name_en, eval) VALUES (?, ?, ?, ?, ?)`, [baseFen, fullSan, formKo, formEn, formEval]);
                await db.runAsync('DELETE FROM moves WHERE parent_fen = ?', [baseFen]);
                for (const m of syncData.moves) {
                    await db.runAsync(`INSERT INTO moves (parent_fen, move_san, name, type, priority, branches) VALUES (?, ?, ?, ?, ?, ?)`, [baseFen, m.move_san, m.name, m.type, m.priority, m.branches]);
                }
            });

            // B. Flask 서버로 전송 및 시간 동기화
            const response = await fetch(`http://221.162.44.120:8000/save_data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(syncData),
            });

            if (response.ok) {
                const resJson = await response.json();
                // ✅ 핵심: 서버가 응답으로 준 시간을 RootLayout에 즉시 반영
                // 이렇게 하면 RootLayout의 syncDatabase가 "어? 시간이 서버랑 똑같네?" 하고 다운로드를 안 함.
                syncBridge.updateLastModified(resJson.last_modified);
                console.log("🚀 PC 커밋 및 시간 동기화 완료");
            }

            onSaveSuccess();
            onClose();
        } catch (e) {
            Alert.alert("❌ 저장 실패");
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.overlay}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
                    <View style={styles.header}>
                        <Text style={styles.title}>🛠 데이터 수정</Text>
                        <Pressable onPress={onClose}><Text style={styles.closeBtnText}>✕</Text></Pressable>
                    </View>

                    <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
                        <Text style={styles.label}>기본 정보</Text>
                        <View style={styles.row}>
                            <TextInput style={styles.input} placeholder="한글명" value={formKo} onChangeText={setFormKo} placeholderTextColor={PLACEHOLDER_COLOR} />
                            <TextInput style={styles.input} placeholder="English" value={formEn} onChangeText={setFormEn} placeholderTextColor={PLACEHOLDER_COLOR} />
                            <TextInput style={[styles.input, { width: 65 }]} placeholder="Eval" value={formEval} onChangeText={setFormEval} placeholderTextColor={PLACEHOLDER_COLOR} />
                        </View>
                        {/* <TextInput style={[styles.input, styles.descInput]} placeholder="상세 설명" value={formDesc} onChangeText={setFormDesc} multiline placeholderTextColor={PLACEHOLDER_COLOR} /> */}

                        <View style={styles.recHeader}>
                            <Text style={styles.label}>추천 수 - {formRecs.length}개</Text>
                            <Pressable onPress={() => setFormRecs([...formRecs, { piece: "", sq: "", isCastle: null, name: "", type: "best", branchesText: "" }])} style={styles.miniAddBtn}>
                                <Text style={styles.miniAddBtnText}>+ 추가</Text>
                            </Pressable>
                        </View>

                        {formRecs.map((rec, idx) => (
                            <View key={idx} style={styles.recCard}>
                                <View style={styles.recRow}>
                                    <View style={styles.pieceGroup}>
                                        <Pressable onPress={() => {
                                            const next = [...formRecs];
                                            next[idx].isCastle = next[idx].isCastle === "O-O" ? null : "O-O";
                                            if (next[idx].isCastle) { next[idx].piece = ""; next[idx].sq = ""; }
                                            setFormRecs(next);
                                        }} disabled={!castlingInfo.canK} style={[styles.miniBtn, rec.isCastle === "O-O" && styles.activeBtn, !castlingInfo.canK && styles.disabledBtn]}>
                                            <Text style={styles.btnTxt}>O-O</Text>
                                        </Pressable>
                                        <Pressable onPress={() => {
                                            const next = [...formRecs];
                                            next[idx].isCastle = next[idx].isCastle === "O-O-O" ? null : "O-O-O";
                                            if (next[idx].isCastle) { next[idx].piece = ""; next[idx].sq = ""; }
                                            setFormRecs(next);
                                        }} disabled={!castlingInfo.canQ} style={[styles.miniBtn, rec.isCastle === "O-O-O" && styles.activeBtn, !castlingInfo.canQ && styles.disabledBtn]}>
                                            <Text style={styles.btnTxt}>O-O-O</Text>
                                        </Pressable>
                                        {PIECES_ENUM.map(p => (
                                            <Pressable key={p} disabled={!!rec.isCastle} onPress={() => {
                                                const next = [...formRecs];
                                                next[idx].piece = p;
                                                setFormRecs(next);
                                            }} style={[styles.miniBtn, rec.piece === p && !rec.isCastle && styles.activeBtn, !!rec.isCastle && styles.disabledBtn]}>
                                                <Text style={styles.btnTxt}>{PIECE_LABELS[p]}</Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                    <TextInput style={[styles.sqInput, !!rec.isCastle && styles.disabledInput]} placeholder="좌표" value={rec.sq} editable={!rec.isCastle} onChangeText={(t) => {
                                        const next = [...formRecs];
                                        next[idx].sq = t.toLowerCase();
                                        setFormRecs(next);
                                    }} placeholderTextColor={PLACEHOLDER_COLOR} />
                                    <View style={styles.orderActions}>
                                        <Pressable onPress={() => moveItem(idx, 'up')} disabled={idx === 0} style={idx === 0 && { opacity: 0.2 }}><Text style={styles.orderIcon}>▲</Text></Pressable>
                                        <Pressable onPress={() => moveItem(idx, 'down')} disabled={idx === formRecs.length - 1} style={idx === formRecs.length - 1 && { opacity: 0.2 }}><Text style={styles.orderIcon}>▼</Text></Pressable>
                                        <Pressable onPress={() => setFormRecs(formRecs.filter((_, i) => i !== idx))}><Text style={{ color: '#EF4444', fontSize: 18 }}>✕</Text></Pressable>
                                    </View>
                                </View>
                                <TextInput style={styles.nameInput} placeholder="추천수 이름" value={rec.name} onChangeText={(t) => { const next = [...formRecs]; next[idx].name = t; setFormRecs(next); }} placeholderTextColor={PLACEHOLDER_COLOR} />
                                <TextInput style={styles.nameInput} placeholder="브랜치 (쉼표 구분)" value={rec.branchesText} onChangeText={(t) => { const next = [...formRecs]; next[idx].branchesText = t; setFormRecs(next); }} placeholderTextColor={PLACEHOLDER_COLOR} />
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {EVAL_TYPES.map(t => (
                                        <Pressable key={t} onPress={() => { const next = [...formRecs]; next[idx].type = t; setFormRecs(next); }} style={[styles.typeBtn, rec.type === t && styles.activeTypeBtn]}><Text style={[styles.typeBtnTxt, rec.type === t && { color: '#000' }]}>{t}</Text></Pressable>
                                    ))}
                                </ScrollView>
                            </View>
                        ))}
                        <View style={{ height: 100 }} />
                    </ScrollView>
                    <Pressable style={styles.saveBtn} onPress={saveToDB}><Text style={styles.saveBtnText}>저장</Text></Pressable>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalContainer: { backgroundColor: '#161B22', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, height: '90%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { color: '#91b045', fontWeight: '900', fontSize: 20 },
    closeBtnText: { color: '#8B949E', fontSize: 24 },
    formScroll: { flex: 1 },
    label: { color: '#8B949E', fontSize: 13, fontWeight: '700', marginBottom: 10 },
    row: { flexDirection: 'row', gap: 8, marginBottom: 15 },
    input: { flex: 1, backgroundColor: '#0D1117', color: '#E7EDF5', padding: 12, borderRadius: 8, fontSize: 14, borderWidth: 1, borderColor: '#30363D' },
    descInput: { minHeight: 60, textAlignVertical: 'top', marginBottom: 15 },
    recHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    miniAddBtn: { backgroundColor: '#238636', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    miniAddBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    recCard: { backgroundColor: '#1F242C', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#30363D' },
    recRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    pieceGroup: { flexDirection: 'row', gap: 4, flex: 1, flexWrap: 'wrap' },
    miniBtn: { paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#0D1117', borderRadius: 4, borderWidth: 1, borderColor: '#30363D' },
    activeBtn: { backgroundColor: '#91b045', borderColor: '#91b045' },
    disabledBtn: { opacity: 0.1 },
    btnTxt: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
    sqInput: { width: 50, backgroundColor: '#0D1117', color: '#fff', fontSize: 14, borderRadius: 6, padding: 8, textAlign: 'center', borderWidth: 1, borderColor: '#30363D' },
    disabledInput: { opacity: 0.1 },
    orderActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 5 },
    orderIcon: { color: '#8B949E', fontSize: 16 },
    nameInput: { backgroundColor: '#0D1117', color: '#E7EDF5', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 8, borderWidth: 1, borderColor: '#30363D' },
    typeBtn: { paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, borderRadius: 15, backgroundColor: '#21262D', borderWidth: 1, borderColor: '#30363D' },
    activeTypeBtn: { backgroundColor: '#E7EDF5' },
    typeBtnTxt: { color: '#8B949E', fontSize: 10, fontWeight: 'bold' },
    saveBtn: { backgroundColor: '#91b045', padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 10, marginBottom: 20 },
    saveBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
});
