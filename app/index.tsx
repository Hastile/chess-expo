import ChessBoard, { INITIAL_PIECES, Square } from "@/components/ChessBoard";
import EvalBar from "@/components/EvalBar";
import Recommendations from "@/components/Recommendations";
import { findKingSquare, getLegalMoves, isSquareAttacked, opposite } from "@/scripts/Piece";

import { useAudioPlayer } from "expo-audio";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EvalType } from "@/components/Icons";
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

  // ✅ 마지막 수의 평가 아이콘 정보 상태
  const [lastMoveEval, setLastMoveEval] = useState<{ type: EvalType, toSq: Square } | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const boardSize = useMemo(() => {
    const w = Dimensions.get("window").width;
    return Math.min(w - 32, 360);
  }, []);

  const canUndo = moveState.past.length > 0;
  const canRedo = moveState.future.length > 0;

  // ✅ FEN 매칭 헬퍼 함수 (앞 3마디 기준)
  const getEntryByFen = (fen: string) => {
    const base = fen.split(' ').slice(0, 3).join(' ');
    const foundKey = Object.keys(openingData).find(key =>
      key.split(' ').slice(0, 3).join(' ') === base
    );
    return foundKey ? (openingData as any)[foundKey] : null;
  };

  const openingInfo = useMemo(() => {
    const data = getEntryByFen(moveState.fen);

    if (!data) {
      return { name: "알 수 없는 오프닝", enName: "Unknown", recommendations: [], eval: 0 };
    }

    return {
      name: data.name?.ko || "이름 없음",
      enName: data.name?.en || "Unnamed",
      recommendations: Object.entries(data.moves || {}).map(([move, detail]: [string, any]) => ({
        move,
        type: detail.type,
        intent: detail.intent,
        branches: detail.branches,
      })),
      eval: data.eval ?? 0
    };
  }, [moveState.fen]);

  // ✅ 보드 터치 핸들러: 이동 후 결과 국면의 type을 확인하여 아이콘 표시
  const onSquarePress = (sq: Square) => {
    setMoveState((prev) => {
      const next = handleSquarePress(prev, sq);

      // 수가 실제로 두어졌는지 확인 (기보 기록 증가)
      if (next.moveHistory.length > prev.moveHistory.length) {
        // 1. 이동 후 도달한 국면(FEN)의 데이터를 가져옴
        const nextData = getEntryByFen(next.fen);

        // 2. 해당 국면에 'type'이 정의되어 있다면 아이콘 상태 업데이트
        if (nextData && nextData.type) {
          setLastMoveEval({ type: nextData.type as EvalType, toSq: sq });
        } else {
          setLastMoveEval(null);
        }
      }
      return next;
    });
  };

  // ✅ 기보가 바뀌면 (Undo 등) 아이콘 초기화
  useEffect(() => {
    if (moveState.moveHistory.length === 0) setLastMoveEval(null);
  }, [moveState.fen]);

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

  const checkInfo = useMemo(() => {
    const { pieces, turn } = moveState;
    const kingSq = findKingSquare(pieces, turn);
    const enemy = opposite(turn);
    const inCheck = kingSq ? isSquareAttacked(pieces, kingSq, enemy) : false;

    let hasMoves = false;
    for (const sq in pieces) {
      if (pieces[sq as Square]?.color === turn) {
        if (getLegalMoves(moveState, sq as Square).length > 0) {
          hasMoves = true;
          break;
        }
      }
    }
    return { inCheck, checkmated: inCheck && !hasMoves, isStalemate: !inCheck && !hasMoves, kingSquare: kingSq };
  }, [moveState]);

  // 사운드 재생 로직 (기존 유지)
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
    const count = moveState.moveHistory.length;
    if (count > prevMoveCount.current) {
      const lastMove = moveState.moveHistory[count - 1];
      if (checkInfo.checkmated || checkInfo.isStalemate) playSound('gameover');
      else if (checkInfo.inCheck) playSound('check');
      else if (lastMove.san.includes('O-O')) playSound('castling');
      else if (lastMove.san.includes('x')) playSound('capture');
      else playSound('move');
      setTimeout(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, 100);
    }
    prevMoveCount.current = count;
  }, [moveState.moveHistory.length, checkInfo]);

  const grouped = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const m of moveState.moveHistory) {
      if (!map.has(m.ply)) map.set(m.ply, []);
      map.get(m.ply)!.push(m.san);
    }
    return Array.from(map.entries());
  }, [moveState.moveHistory]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ChessBoard
          size={boardSize}
          orientation={orientation}
          pieces={moveState.pieces}
          selectedSquare={moveState.selected}
          legalMoves={moveState.legalMoves}
          onSquarePress={onSquarePress} // ✅ 수정된 핸들러 연결
          checkState={{
            inCheck: checkInfo.inCheck,
            checkmated: checkInfo.checkmated,
            kingSquare: checkInfo.kingSquare
          }}
          lastMoveEval={lastMoveEval} // ✅ 아이콘 정보 전달
        />

        <EvalBar value={openingInfo.eval} />

        <View style={styles.openingHeader}>
          <Text style={styles.openingKoText}>{openingInfo.name}</Text>
          <Text style={styles.openingEnText}>{openingInfo.enName}</Text>
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
          <Pressable disabled={!canUndo} onPress={() => setMoveState((s) => undo(s))} style={[styles.actionButton, !canUndo && styles.actionDisabled]}>
            <Text style={styles.actionIcon}>↩️</Text>
            <Text style={styles.actionLabel}>Undo</Text>
          </Pressable>
          <Pressable disabled={!canRedo} onPress={() => setMoveState((s) => redo(s))} style={[styles.actionButton, !canRedo && styles.actionDisabled]}>
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
          <Recommendations
            items={openingInfo.recommendations}
            height={200}
            onSelectMove={(move) => console.log(`선택됨: ${move}`)}
            onSelectBranch={(branch, parent) => console.log(`[${parent.move}] 분기: ${branch}`)}
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
});