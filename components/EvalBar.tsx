import ChessBoard, { INITIAL_PIECES, Square } from "@/components/ChessBoard";
import EvalBar from "@/components/EvalBar";
import Recommendations, { RecommendationItem } from "@/components/Recommendations";
import { findKingSquare, getLegalMoves, isSquareAttacked, opposite } from "@/scripts/Piece";

import { useAudioPlayer } from "expo-audio";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import openingData from "@/scripts/opening.json";

import {
    createInitialState,
    handleSquarePress,
    MoveState,
    redo,
    resetGame,
    undo,
} from "@/scripts/Piece";

export default function Index() {
    const [orientation, setOrientation] = useState<"white" | "black">("white");
    const [moveState, setMoveState] = useState<MoveState>(() =>
        createInitialState(INITIAL_PIECES)
    );

    const scrollRef = useRef<ScrollView>(null);

    // ✅ FEN 기반 오프닝 및 '상단 평가치' 추출
    const openingInfo = useMemo(() => {
        const currentFen = moveState.fen;
        let data = (openingData as any)[currentFen];

        if (!data) {
            const baseFen = currentFen.split(' ').slice(0, 4).join(' ');
            const foundKey = Object.keys(openingData).find(key => key.startsWith(baseFen));
            if (foundKey) data = (openingData as any)[foundKey];
        }

        if (!data) return { name: "알 수 없는 오프닝", enName: "Unknown", recommendations: [], eval: 0 };

        const recs: RecommendationItem[] = Object.entries(data.moves).map(([move, detail]: [string, any]) => ({
            move,
            type: detail.type,
            intent: detail.intent,
            branches: detail.branches,
            // moves 안에는 eval을 넣지 않기로 했으므로 여기서는 생략
        }));

        return {
            name: data.name.ko,
            enName: data.name.en,
            recommendations: recs,
            eval: data.eval // ✅ FEN 최상위의 eval을 가져옴
        };
    }, [moveState.fen]);

    // ✅ 평가치 텍스트 변환 (M1, -M1 대응)
    const evalDisplay = useMemo(() => {
        const val = openingInfo.eval;

        if (typeof val === 'string') {
            if (val.startsWith('M')) return `#${val.slice(1)}`;
            if (val.startsWith('-M')) return `-#${val.slice(2)}`;
            return val;
        }

        if (val >= 20) return "#";
        if (val <= -20) return "-#";
        return val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1);
    }, [openingInfo.eval]);

    // 실시간 게임 상태 (기존 유지)
    const checkInfo = useMemo(() => {
        const { pieces, turn } = moveState;
        const kingSq = findKingSquare(pieces, turn);
        const inCheck = kingSq ? isSquareAttacked(pieces, kingSq, opposite(turn)) : false;
        let hasMoves = false;
        for (const sq in pieces) {
            if (pieces[sq as Square]?.color === turn) {
                if (getLegalMoves(moveState, sq as Square).length > 0) { hasMoves = true; break; }
            }
        }
        return { inCheck, checkmated: inCheck && !hasMoves, isStalemate: !inCheck && !hasMoves, kingSquare: kingSq };
    }, [moveState]);

    // 소리 재생 로직 (기존 유지)
    const movePlayer = useAudioPlayer(require('../assets/sfx/move.wav'));
    const capturePlayer = useAudioPlayer(require('../assets/sfx/capture.wav'));
    const castlingPlayer = useAudioPlayer(require('../assets/sfx/castling.wav'));
    const checkPlayer = useAudioPlayer(require('../assets/sfx/check.wav'));
    const gameoverPlayer = useAudioPlayer(require('../assets/sfx/gameover.wav'));

    const playSound = (type: string) => {
        const p = { move: movePlayer, capture: capturePlayer, castling: castlingPlayer, check: checkPlayer, gameover: gameoverPlayer }[type];
        if (p) { p.seekTo(0); p.play(); }
    };

    const prevMoveCount = useRef(moveState.moveHistory.length);
    useEffect(() => {
        const currentCount = moveState.moveHistory.length;
        if (currentCount > prevMoveCount.current) {
            const lastMove = moveState.moveHistory[currentCount - 1];
            if (checkInfo.checkmated || checkInfo.isStalemate) playSound('gameover');
            else if (checkInfo.inCheck) playSound('check');
            else if (lastMove.san.includes('O-O')) playSound('castling');
            else if (lastMove.san.includes('x')) playSound('capture');
            else playSound('move');
            setTimeout(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, 100);
        }
        prevMoveCount.current = currentCount;
    }, [moveState.moveHistory.length, checkInfo]);

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.container}>
                <ChessBoard
                    size={Math.min(Dimensions.get("window").width - 32, 360)}
                    orientation={orientation}
                    pieces={moveState.pieces}
                    selectedSquare={moveState.selected}
                    legalMoves={moveState.legalMoves}
                    onSquarePress={(sq) => setMoveState((prev) => handleSquarePress(prev, sq))}
                    checkState={checkInfo}
                />

                {/* ✅ 상단 평가치 바와 수치 표시 */}
                <View style={styles.evalContainer}>
                    <EvalBar value={openingInfo.eval} />
                    <Text style={styles.evalText}>{evalDisplay}</Text>
                </View>

                <View style={styles.openingHeader}>
                    <Text style={styles.openingKoText}>{openingInfo.name}</Text>
                    <Text style={styles.openingEnText}>{openingInfo.enName}</Text>
                </View>

                <View style={styles.timelineSection}>
                    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timelineContent}>
                        {Array.from(useMemo(() => {
                            const map = new Map();
                            for (const m of moveState.moveHistory) {
                                if (!map.has(m.ply)) map.set(m.ply, []);
                                map.get(m.ply).push(m.san);
                            }
                            return map.entries();
                        }, [moveState.moveHistory])).map(([ply, moves]) => (
                            <View key={ply} style={styles.plyChip}>
                                <Text style={styles.plyLabel}>{ply}.</Text>
                                {moves.map((san: any, i: number) => <Text key={i} style={styles.plyMoveText}>{san}</Text>)}
                            </View>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.actionsRow}>
                    <Pressable disabled={moveState.past.length === 0} onPress={() => setMoveState((s) => undo(s))} style={[styles.actionButton, moveState.past.length === 0 && styles.actionDisabled]}>
                        <Text style={styles.actionIcon}>↩️</Text>
                        <Text style={styles.actionLabel}>Undo</Text>
                    </Pressable>
                    <Pressable disabled={moveState.future.length === 0} onPress={() => setMoveState((s) => redo(s))} style={[styles.actionButton, moveState.future.length === 0 && styles.actionDisabled]}>
                        <Text style={styles.actionIcon}>↪️</Text>
                        <Text style={styles.actionLabel}>Redo</Text>
                    </Pressable>
                    <Pressable onPress={() => setMoveState(resetGame(INITIAL_PIECES))} style={styles.actionButton}>
                        <Text style={styles.actionIcon}>🔄</Text>
                        <Text style={styles.actionLabel}>Reset</Text>
                    </Pressable>
                    <Pressable onPress={() => setOrientation((o) => (o === "white" ? "black" : "white"))} style={styles.actionButton}>
                        <Text style={styles.actionIcon}>🔁</Text>
                        <Text style={styles.actionLabel}>Flip</Text>
                    </Pressable>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>추천 수</Text>
                    <Recommendations items={openingInfo.recommendations} height={200} />
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#0B0F14" },
    container: { flex: 1, alignItems: "center", paddingHorizontal: 16, paddingTop: 16, gap: 16 },
    evalContainer: { width: "100%", maxWidth: 360, flexDirection: 'row', alignItems: 'center', gap: 12 },
    evalText: { fontSize: 13, fontWeight: "800", color: "rgba(231,237,245,0.7)", minWidth: 40, textAlign: 'right' },
    openingHeader: { width: "100%", maxWidth: 360, marginBottom: -8 },
    openingKoText: { fontSize: 18, fontWeight: "800", color: "#E7EDF5" },
    openingEnText: { fontSize: 13, fontWeight: "500", color: "rgba(231,237,245,0.4)", marginTop: 2 },
    timelineSection: { width: "100%", height: 44, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 8, overflow: "hidden" },
    timelineContent: { paddingHorizontal: 12, alignItems: "center", gap: 12 },
    plyChip: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 6 },
    plyLabel: { fontSize: 13, fontWeight: "700", color: "rgba(231,237,245,0.4)" },
    plyMoveText: { fontSize: 14, fontWeight: "600", color: "#E7EDF5" },
    actionsRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", maxWidth: 360 },
    actionButton: { alignItems: "center", width: 72, paddingVertical: 6, borderRadius: 10 },
    actionDisabled: { opacity: 0.35 },
    actionIcon: { fontSize: 22, lineHeight: 26 },
    actionLabel: { fontSize: 12, color: "rgba(231,237,245,0.8)" },
    section: { width: "100%", maxWidth: 360, gap: 8 },
    sectionTitle: { fontSize: 14, fontWeight: "600", color: "#E7EDF5" },
});