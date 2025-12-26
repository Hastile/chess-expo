import ChessBoard, { INITIAL_PIECES, Square } from "@/components/ChessBoard";
import EvalBar from "@/components/EvalBar";
import Recommendations, { RecommendationItem } from "@/components/Recommendations";
import { findKingSquare, getLegalMoves, isSquareAttacked, opposite } from "@/scripts/Piece";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// ✅ expo-av 대신 expo-audio 임포트
import { useAudioPlayer } from "expo-audio";

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

  // DB 연결 대비 (지금은 비워둠)
  const [evalValue] = useState<number>(0);
  const [recommendations] = useState<RecommendationItem[]>([]);

  const boardSize = useMemo(() => {
    const w = Dimensions.get("window").width;
    return Math.min(w - 32, 360);
  }, []);

  const canUndo = moveState.past.length > 0;
  const canRedo = moveState.future.length > 0;

  // ✅ 실시간 게임 상태 계산
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

    const isCheckmate = inCheck && !hasMoves;
    const isStalemate = !inCheck && !hasMoves;

    return { inCheck, checkmated: isCheckmate, isStalemate, kingSquare: kingSq };
  }, [moveState]);

  // ✅ [수정] expo-audio 방식의 소리 재생 로직
  // useAudioPlayer는 리소스를 로드하고 자동으로 플레이어 인스턴스를 관리합니다.
  const movePlayer = useAudioPlayer(require('../assets/sfx/move.wav'));
  const capturePlayer = useAudioPlayer(require('../assets/sfx/capture.wav'));
  const castlingPlayer = useAudioPlayer(require('../assets/sfx/castling.wav'));
  const checkPlayer = useAudioPlayer(require('../assets/sfx/check.wav'));
  const gameoverPlayer = useAudioPlayer(require('../assets/sfx/gameover.wav'));

  const players = {
    move: movePlayer,
    capture: capturePlayer,
    castling: castlingPlayer,
    check: checkPlayer,
    gameover: gameoverPlayer,
  };

  // 소리 재생 함수 (기존보다 훨씬 가볍고 빠릅니다)
  const playSound = (type: keyof typeof players) => {
    const player = players[type];
    if (player) {
      // expo-audio는 재생 후 끝에 멈춰 있으므로 처음으로 되돌린 후 재생합니다.
      player.seekTo(0);
      player.play();
    }
  };

  const prevMoveCount = useRef(moveState.moveHistory.length);

  useEffect(() => {
    const currentCount = moveState.moveHistory.length;
    if (currentCount > prevMoveCount.current) {
      const lastMove = moveState.moveHistory[currentCount - 1];

      if (checkInfo.checkmated || checkInfo.isStalemate) {
        playSound('gameover');
      } else if (checkInfo.inCheck) {
        playSound('check');
      } else if (lastMove.san.includes('O-O')) {
        playSound('castling');
      } else if (lastMove.san.includes('x')) {
        playSound('capture');
      } else {
        playSound('move');
      }

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
    prevMoveCount.current = currentCount;
  }, [moveState.moveHistory.length, checkInfo]);

  // 기보 그룹화 로직 (이하 동일)
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
          onSquarePress={(sq) =>
            setMoveState((prev) => handleSquarePress(prev, sq))
          }
          checkState={{
            inCheck: checkInfo.inCheck,
            checkmated: checkInfo.checkmated,
            kingSquare: checkInfo.kingSquare
          }}
        />

        <EvalBar value={evalValue} />

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
          <Recommendations items={recommendations} height={220} onSelectMove={(move) => console.log("select:", move)} onSelectBranch={(b) => console.log("select:", b)} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0F14" },
  container: { flex: 1, alignItems: "center", paddingHorizontal: 16, paddingTop: 16, gap: 16 },
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