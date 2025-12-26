import ChessBoard, { INITIAL_PIECES, Square } from "@/components/ChessBoard";
import EvalBar from "@/components/EvalBar";
import Recommendations, { RecommendationItem } from "@/components/Recommendations";
import { findKingSquare, getLegalMoves, isSquareAttacked, opposite } from "@/scripts/Piece";

import { Audio } from "expo-av";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

  // DB 연결 대비 (지금은 비워둠)
  const [evalValue] = useState<number>(0);
  const [recommendations] = useState<RecommendationItem[]>([]);

  const boardSize = useMemo(() => {
    const w = Dimensions.get("window").width;
    return Math.min(w - 32, 360);
  }, []);

  const canUndo = moveState.past.length > 0;
  const canRedo = moveState.future.length > 0;

  // ✅ 실시간 게임 상태 계산 (체크, 메이트, 스테일메이트)
  const checkInfo = useMemo(() => {
    const { pieces, turn } = moveState;
    const kingSq = findKingSquare(pieces, turn);
    const enemy = opposite(turn);

    // 1. 체크 여부
    const inCheck = kingSq ? isSquareAttacked(pieces, kingSq, enemy) : false;

    // 2. 가능한 수가 있는지 확인
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

    return {
      inCheck,
      checkmated: isCheckmate,
      isStalemate,
      kingSquare: kingSq
    };
  }, [moveState]);

  // ✅ 소리 재생 로직
  const prevMoveCount = useRef(moveState.moveHistory.length);
  const sounds = {
    move: require('../assets/sfx/move.wav'),
    capture: require('../assets/sfx/capture.wav'),
    castling: require('../assets/sfx/castling.wav'),
    check: require('../assets/sfx/check.wav'),
    gameover: require('../assets/sfx/gameover.wav'),
  };

  const playSound = async (type: keyof typeof sounds) => {
    try {
      const { sound } = await Audio.Sound.createAsync(sounds[type]);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (e) {
      console.log("Sound play error:", e);
    }
  };

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
    }
    prevMoveCount.current = currentCount;
  }, [moveState.moveHistory.length, checkInfo]);

  // 기보 그룹화
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

        <View style={styles.actionsRow}>
          <Pressable
            disabled={!canUndo}
            onPress={() => setMoveState((s) => undo(s))}
            style={[styles.actionButton, !canUndo && styles.actionDisabled]}
          >
            <Text style={styles.actionIcon}>↩️</Text>
            <Text style={styles.actionLabel}>Undo</Text>
          </Pressable>

          <Pressable
            disabled={!canRedo}
            onPress={() => setMoveState((s) => redo(s))}
            style={[styles.actionButton, !canRedo && styles.actionDisabled]}
          >
            <Text style={styles.actionIcon}>↪️</Text>
            <Text style={styles.actionLabel}>Redo</Text>
          </Pressable>

          <Pressable
            onPress={() => setMoveState(resetGame(INITIAL_PIECES))}
            style={styles.actionButton}
          >
            <Text style={styles.actionIcon}>🔄</Text>
            <Text style={styles.actionLabel}>Reset</Text>
          </Pressable>

          <Pressable
            onPress={() =>
              setOrientation((o) => (o === "white" ? "black" : "white"))
            }
            style={styles.actionButton}
          >
            <Text style={styles.actionIcon}>🔁</Text>
            <Text style={styles.actionLabel}>Flip</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>추천 수</Text>
          <Recommendations
            items={recommendations}
            height={220}
            onSelectMove={(move) => console.log("select move:", move)}
            onSelectBranch={(b) => console.log("select branch:", b)}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>기보</Text>
          {grouped.map(([ply, moves]) => (
            <View key={ply} style={styles.plyGroup}>
              <Text style={styles.plyLabel}>{ply}.</Text>
              <View style={styles.plyMovesWrap}>
                {moves.map((san, i) => (
                  <Text key={i} style={styles.plyMoveText}>
                    {san}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0F14" },
  container: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 360,
  },
  actionButton: { alignItems: "center", width: 72, paddingVertical: 6, borderRadius: 10 },
  actionDisabled: { opacity: 0.35 },
  actionIcon: { fontSize: 22, lineHeight: 26 },
  actionLabel: { fontSize: 12, color: "rgba(231,237,245,0.8)" },
  section: { width: "100%", maxWidth: 360, gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#E7EDF5" },
  plyGroup: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  plyLabel: { width: 24, fontSize: 13, fontWeight: "700", color: "rgba(231,237,245,0.6)" },
  plyMovesWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, flex: 1 },
  plyMoveText: { fontSize: 13, color: "rgba(231,237,245,0.85)" },
});