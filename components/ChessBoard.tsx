// components/ChessBoard.tsx
import { INITIAL_PIECES, PIECE_IMAGES, PiecesMap, Square } from "@/scripts/Piece"; // ✅ 여기서 가져옴
import { Image } from "expo-image";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { EvalType, MOVE_ICONS } from "./Icons";

type Props = {
    size: number;
    pieces?: PiecesMap;
    orientation?: "white" | "black";
    selectedSquare?: Square | null;
    legalMoves?: Square[];
    onSquarePress?: (square: Square) => void;
    checkState?: { inCheck?: boolean; checkmated?: boolean; kingSquare?: Square | null };
    lastMoveEval?: { type: EvalType, toSq: Square } | null;
};

export default function ChessBoard({
    size, pieces = INITIAL_PIECES, orientation = "white",
    selectedSquare, legalMoves, onSquarePress, checkState, lastMoveEval
}: Props) {
    const squareSize = Math.floor(size / 8);
    const boardSize = squareSize * 8;
    const rows = useMemo(() => Array.from({ length: 8 }, (_, i) => i), []);
    const cols = useMemo(() => Array.from({ length: 8 }, (_, i) => i), []);

    return (
        <View style={[styles.outer, { width: size, height: size }]}>
            <View style={[styles.board, { width: boardSize, height: boardSize }]}>
                {rows.map((rUI) => {
                    const rank = orientation === "white" ? 7 - rUI : rUI;
                    return (
                        <View key={rUI} style={styles.row}>
                            {cols.map((cUI) => {
                                const fileIndex = orientation === "white" ? cUI : 7 - cUI;
                                const file = String.fromCharCode(97 + fileIndex) as any;
                                const squareName = `${file}${rank + 1}` as Square;
                                const piece = pieces[squareName];

                                const isSelected = selectedSquare === squareName;
                                const isLegal = legalMoves?.includes(squareName);
                                const isLight = (fileIndex + rank) % 2 === 1;

                                const isKingInCheck = checkState?.inCheck && squareName === checkState.kingSquare;
                                const isCheckmate = checkState?.checkmated && squareName === checkState.kingSquare;

                                // ✅ 아이콘 표시 여부 확인
                                const evalSource = lastMoveEval?.toSq === squareName ? MOVE_ICONS[lastMoveEval.type] : null;

                                return (
                                    <Pressable
                                        key={squareName}
                                        onPress={() => onSquarePress?.(squareName)}
                                        style={[
                                            styles.square,
                                            {
                                                width: squareSize, height: squareSize,
                                                backgroundColor: isLight ? "#EADDCB" : "#B58863",
                                                ...(isSelected && { backgroundColor: "#E6C36A" }),
                                                ...(isKingInCheck && { backgroundColor: "#EF4444" }),
                                            },
                                        ]}
                                    >
                                        {isLegal && (
                                            <View pointerEvents="none" style={piece ? styles.legalRing : styles.legalDot} />
                                        )}

                                        {piece && (
                                            <Image
                                                source={PIECE_IMAGES[piece.color][piece.piece]}
                                                style={{ width: squareSize * 0.9, height: squareSize * 0.9 }}
                                                contentFit="contain"
                                                transition={0}
                                            />
                                        )}

                                        {/* ✅ 평가 아이콘 (체크메이트 로직과 동일하게 Image로 렌더링) */}
                                        {evalSource && (
                                            <Image
                                                source={evalSource}
                                                style={styles.evalIcon}
                                            />
                                        )}

                                        {isCheckmate && (
                                            <Image
                                                source={piece?.color === "white"
                                                    ? require("../assets/images/moves/checkmate_white.svg")
                                                    : require("../assets/images/moves/checkmate_black.svg")}
                                                style={styles.checkmateIcon}
                                            />
                                        )}
                                    </Pressable>
                                );
                            })}
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    outer: { alignItems: "center", justifyContent: "center" },
    board: { borderRadius: 16, overflow: "hidden", borderWidth: 2, borderColor: "rgba(255,255,255,0.15)" },
    row: { flexDirection: "row" },
    square: { alignItems: "center", justifyContent: "center", position: "relative" },
    legalDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "rgba(0,0,0,0.35)" },
    legalRing: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "rgba(0,0,0,0.35)", position: "absolute" },
    checkmateIcon: { position: "absolute", top: 2, right: 2, width: 16, height: 16, zIndex: 10 },
    evalIconWrapper: { position: "absolute", top: 2, right: 2, zIndex: 11 },
    evalIcon: { position: "absolute", top: 2, right: 2, width: 16, height: 16, zIndex: 11 },
});