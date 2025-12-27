import { INITIAL_PIECES, PIECE_IMAGES, PiecesMap, Square } from "@/scripts/Piece";
import { Image } from "expo-image";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
    // 1. 한 칸의 크기를 구하고, 전체 보드 크기를 8칸에 딱 맞게 재계산합니다.
    const squareSize = Math.floor(size / 8);
    const boardSize = squareSize * 8;

    const rows = useMemo(() => Array.from({ length: 8 }, (_, i) => i), []);
    const cols = useMemo(() => Array.from({ length: 8 }, (_, i) => i), []);

    return (
        // outer는 요청받은 원본 size를 유지하여 레이아웃을 잡고,
        // board는 계산된 정확한 boardSize를 사용하여 정사각형을 유지합니다.
        <View style={[styles.outer, { width: size, height: size }]}>
            <View style={[styles.board, { width: boardSize, height: boardSize }]}>
                {rows.map((rUI) => {
                    const rank = orientation === "white" ? 7 - rUI : rUI;
                    return (
                        <View key={rUI} style={styles.row}>
                            {cols.map((cUI) => {
                                const fileIndex = orientation === "white" ? cUI : 7 - cUI;
                                const file = String.fromCharCode(97 + fileIndex);
                                const squareName = `${file}${rank + 1}` as Square;
                                const piece = pieces[squareName];

                                const isSelected = selectedSquare === squareName;
                                const isLegal = legalMoves?.includes(squareName);
                                const isLight = (fileIndex + rank) % 2 === 1;

                                const isKingInCheck = checkState?.inCheck && squareName === checkState.kingSquare;
                                const evalSource = lastMoveEval?.toSq === squareName ? MOVE_ICONS[lastMoveEval.type] : null;

                                const isFirstColumn = cUI === 0;
                                const isLastRow = rUI === 7;

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
                                        {/* 랭크 표시: 모서리 곡률(borderRadius)에 걸리지 않도록 left 값을 충분히 줍니다. */}
                                        {isFirstColumn && (
                                            <Text style={[
                                                styles.coordRank,
                                                { color: isLight ? "#B58863" : "#EADDCB" }
                                            ]}>
                                                {rank + 1}
                                            </Text>
                                        )}

                                        {/* 파일 표시: bottom 값을 충분히 주어 잘림을 방지합니다. */}
                                        {isLastRow && (
                                            <Text style={[
                                                styles.coordFile,
                                                { color: isLight ? "#B58863" : "#EADDCB" }
                                            ]}>
                                                {file}
                                            </Text>
                                        )}

                                        {isLegal && (
                                            <View pointerEvents="none" style={piece ? styles.legalRing : styles.legalDot} />
                                        )}

                                        {piece && (
                                            <Image
                                                source={PIECE_IMAGES[piece.color][piece.piece]}
                                                style={{ width: squareSize * 0.85, height: squareSize * 0.85 }}
                                                contentFit="contain"
                                                transition={0}
                                            />
                                        )}

                                        {evalSource && (
                                            <Image source={evalSource} style={styles.evalIcon} contentFit="contain" />
                                        )}

                                        {checkState?.checkmated && squareName === checkState.kingSquare && (
                                            <Image
                                                source={piece?.color === "white"
                                                    ? require("../assets/images/moves/checkmate_white.svg")
                                                    : require("../assets/images/moves/checkmate_black.svg")}
                                                style={styles.checkmateIcon}
                                                contentFit="contain"
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
    board: {
        overflow: "hidden",
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.15)",
        // 박스 사이징 이슈 방지를 위해 배경색 설정
        backgroundColor: "#B58863"
    },
    row: { flexDirection: "row" },
    square: { alignItems: "center", justifyContent: "center", position: "relative" },
    legalDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.2)" },
    legalRing: { width: "100%", height: "100%", borderWidth: 4, borderColor: "rgba(0,0,0,0.15)", position: "absolute" },
    checkmateIcon: { position: "absolute", top: 2, right: 2, width: 18, height: 18, zIndex: 10 },
    evalIcon: { position: "absolute", top: 2, right: 2, width: 18, height: 18, zIndex: 11 },

    // 좌표 위치 수정: 패딩 역할을 하도록 숫자를 모서리에서 더 안쪽으로 이동
    coordRank: {
        position: "absolute",
        top: 2,
        left: 4, // 2 -> 4로 수정하여 테두리 곡선 안쪽으로 배치
        fontSize: 10,
        fontWeight: "900",
        zIndex: 5,
    },
    coordFile: {
        position: "absolute",
        bottom: 2,
        right: 4, // 2 -> 4로 수정하여 테두리 곡선 안쪽으로 배치
        fontSize: 10,
        fontWeight: "900",
        zIndex: 5,
        textAlign: "right",
    },
});