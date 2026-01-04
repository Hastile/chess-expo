// app/index.tsx
import ChessBoard from "@/components/ChessBoard";

import EvalBar from "@/components/EvalBar";
import Recommendations, { EVAL_META, RecommendationItem } from "@/components/Recommendations";
import { findKingSquare, getLegalMoves, INITIAL_PIECES, isSquareAttacked, opposite, Piece, Square } from "@/scripts/Piece";
import { Chess } from "chess.js";

import * as SQLite from "expo-sqlite";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EvalType } from "@/components/Icons";
import PromotionModal from "@/components/PromotionModal";

import { GameContext } from "./_layout";

import {
  handleSquarePress,
  isPawnPromotion,
  redo,
  resetGame,
  undo
} from "@/scripts/Piece";

export default function Index() {
  const gameContext = useContext(GameContext);
  if (!gameContext) return null;

  const { moveState, setMoveState, orientation, setOrientation } = gameContext;

  // ✅ [수정] 타입을 명시하여 'never' 에러 해결. eval에 문자열(M1 등)이 올 수 있음을 알려줍니다.
  const [openingInfo, setOpeningInfo] = useState<{
    name: string;
    enName: string;
    recommendations: RecommendationItem[];
    eval: string | number;
  }>({
    name: "알 수 없는 오프닝",
    enName: "Unknown",
    recommendations: [] as RecommendationItem[],
    eval: 0,
  });

  const db = SQLite.useSQLiteContext();

  const [lastMoveEval, setLastMoveEval] = useState<{ type: EvalType, toSq: Square } | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square, to: Square } | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const boardSize = useMemo(() => {
    const w = Dimensions.get("window").width;
    return Math.min(w - 32, 360);
  }, []);

  const canUndo = moveState.past.length > 0;
  const canRedo = moveState.future.length > 0;

  async function fetchOpeningData() {
    const baseFen = moveState.fen.split(' ').slice(0, 3).join(' ');

    try {
      const position = await db.getFirstAsync<{
        name_ko: string;
        name_en: string;
        eval: string | number;
      }>('SELECT name_ko, name_en, eval FROM positions WHERE fen = ?', [baseFen]);

      const moves = await db.getAllAsync<{
        move_san: string;
        name: string;
        type: string;
        branches: string;
      }>('SELECT move_san, name, type, branches FROM moves WHERE parent_fen = ? ORDER BY priority ASC', [baseFen]);

      if (position) {
        setOpeningInfo({
          name: position.name_ko || "이름 없음",
          enName: position.name_en || "Unnamed",
          eval: position.eval ?? 0,
          recommendations: moves.map(m => ({
            move: m.move_san,
            name: m.name,
            type: m.type as EvalType,
            branches: JSON.parse(m.branches || "[]")
          }))
        });
      } else {
        setOpeningInfo({ name: "알 수 없는 오프닝", enName: "Unknown", recommendations: [], eval: 0 });
      }
    } catch (e) {
      console.error("DB 조회 오류:", e);
    }
  }
  // ✅ FEN 변경 시 DB 데이터 조회 로직
  useEffect(() => {

    fetchOpeningData();
  }, [moveState.fen, db]);

  const onSquarePress = (sq: Square) => {
    const currentRecs = openingInfo.recommendations;

    if (moveState.selected && isPawnPromotion(moveState, moveState.selected, sq)) {
      setPendingPromotion({ from: moveState.selected, to: sq });
      return;
    }

    const next = handleSquarePress(moveState, sq);

    if (next.moveHistory.length > moveState.moveHistory.length) {
      const lastMove = next.moveHistory[next.moveHistory.length - 1];
      const cleanSan = lastMove.san.replace("... ", "");
      const matched = currentRecs.find(r => r.move === cleanSan);

      if (matched) {
        setLastMoveEval({ type: matched.type as EvalType, toSq: sq });
      } else {
        setLastMoveEval(null);
      }
    }

    setMoveState(next);
  };

  const handlePromotionSelect = (piece: Piece) => {
    if (!pendingPromotion) return;
    setMoveState(prev => handleSquarePress(prev, pendingPromotion.to, piece));
    setPendingPromotion(null);
  };

  const handleUndo = () => { setMoveState(s => undo(s)); setLastMoveEval(null); };
  const handleRedo = () => { setMoveState(s => redo(s)); setLastMoveEval(null); };
  const handleReset = () => { setMoveState(resetGame(INITIAL_PIECES)); setLastMoveEval(null); };

  // ✅ [수정] 평가 수치 표시 로직 강화
  const evalDisplay = useMemo(() => {
    const val = openingInfo.eval;
    if (typeof val === 'string') {
      if (val.startsWith('M')) return `#${val.slice(1)}`;
      if (val.startsWith('-M')) return `-#${val.slice(2)}`;
      return val;
    }
    const num = Number(val);
    if (num >= 20) return "#";
    if (num <= -20) return "-#";
    return num > 0 ? `+${num.toFixed(1)}` : num.toFixed(1);
  }, [openingInfo.eval]);

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

  const grouped = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const m of moveState.moveHistory) {
      if (!map.has(m.ply)) map.set(m.ply, []);
      map.get(m.ply)!.push(m.san);
    }
    return Array.from(map.entries());
  }, [moveState.moveHistory]);

  // ✅ 저장 성공 시 즉시 갱신
  const handleSaveSuccess = () => {
    fetchOpeningData();
  };

  const currentPgn = useMemo(() => {
    const pgnParts: string[] = [];
    for (let i = 0; i < moveState.moveHistory.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const whiteMove = moveState.moveHistory[i].san;
      const blackMove = moveState.moveHistory[i + 1]?.san.replace("... ", "") || "";
      pgnParts.push(`${moveNum}. ${whiteMove}${blackMove ? " " + blackMove : ""}`);
    }
    return pgnParts.join(" ");
  }, [moveState.moveHistory]);

  const recommendationArrows = useMemo(() => {
    const normalizeSan = (san: string) =>
      san.replace(/\s+/g, "").replace(/[+#?!]/g, "").replace(/\.\.\./g, "");

    let chess: Chess | null = null;
    try {
      chess = new Chess(moveState.fen);
    } catch {
      chess = null;
    }
    if (!chess) return [];

    const verboseMoves = chess.moves({ verbose: true });

    return openingInfo.recommendations.flatMap((rec) => {
      const normalizedRec = normalizeSan(rec.move);
      const match = verboseMoves.find((m) => normalizeSan(m.san) === normalizedRec);
      if (!match) return [];
      const type = rec.type as EvalType;
      const color = EVAL_META[type]?.color || "rgba(145,176,69,0.75)";
      return [{ from: match.from as Square, to: match.to as Square, color, type }];
    });
  }, [moveState.fen, openingInfo.recommendations]);

  return (
    <SafeAreaView style={styles.safe}>

      <View style={styles.container}>
        <ChessBoard
          size={boardSize}
          orientation={orientation}
          pieces={moveState.pieces}
          selectedSquare={moveState.selected}
          legalMoves={moveState.legalMoves}
          onSquarePress={onSquarePress}
          checkState={checkInfo}
          lastMoveEval={lastMoveEval}
          recommendationArrows={recommendationArrows}
        />

        {pendingPromotion && (
          <PromotionModal
            color={moveState.turn}
            onSelect={handlePromotionSelect}
          />
        )}

        <EvalBar value={openingInfo.eval} />

        <View style={styles.openingHeader}>
          <Text style={styles.openingKoText}>{openingInfo.name}</Text>
          <Text style={styles.openingEnText}>{openingInfo.enName}</Text>
          {/* ✅ 고정 높이 컨테이너로 감싸서 UI 밀림 방지 */}
          {/* <View style={styles.descContainer}>
            {openingInfo.desc ? (
              <Text style={styles.descText} numberOfLines={2}>
                {openingInfo.desc}
              </Text>
            ) : null}
          </View> */}
        </View>

        <View style={styles.timelineSection}>
          <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timelineContent}>
            {grouped.map(([ply, moves]) => (
              <View key={ply} style={styles.plyChip}>
                <Text style={styles.plyLabel}>{ply}.</Text>
                {moves.map((san, i) => <Text key={i} style={styles.plyMoveText}>{san}</Text>)}
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.actionsRow}>
          <Pressable disabled={!canUndo} onPress={handleUndo} style={[styles.actionButton, !canUndo && styles.actionDisabled]}>
            <Text style={styles.actionIcon}>↩️</Text><Text style={styles.actionLabel}>Undo</Text>
          </Pressable>
          <Pressable disabled={!canRedo} onPress={handleRedo} style={[styles.actionButton, !canRedo && styles.actionDisabled]}>
            <Text style={styles.actionIcon}>↪️</Text><Text style={styles.actionLabel}>Redo</Text>
          </Pressable>
          <Pressable onPress={handleReset} style={styles.actionButton}>
            <Text style={styles.actionIcon}>🔄</Text><Text style={styles.actionLabel}>Reset</Text>
          </Pressable>
          <Pressable onPress={() => setOrientation((o) => (o === "white" ? "black" : "white"))} style={styles.actionButton}>
            <Text style={styles.actionIcon}>🔁</Text><Text style={styles.actionLabel}>Flip</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>추천 수</Text>
          <Recommendations
            items={openingInfo.recommendations}
            height={210}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0F14" },
  container: { flex: 1, alignItems: "center", paddingHorizontal: 16, paddingTop: 16, gap: 16 },
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
  descText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#E7EDF5",
    fontWeight: "500",
  },
  descContainer: {
    height: 32,
    marginTop: 10,
    justifyContent: 'center', // ???? ? ?? ?? ?? ??
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#91b045',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    boxShadow: '0px 4px 12px rgba(0,0,0,0.3)',
    zIndex: 999,
  },
  fabText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 16,
  },
});

