import { INITIAL_PIECES, PIECE_IMAGES, PiecesMap, Square } from "@/scripts/Piece";
import { Image } from "expo-image";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Polygon } from "react-native-svg";
import { EvalType, MOVE_ICONS } from "./Icons";

const ARROW_PRIORITY: Record<EvalType, number> = {
    brilliant: 6,
    critical: 5,
    best: 4,
    excellent: 4,
    book: 4,
    forced: 4,
    okay: 2,
    inaccuracy: -1,
    mistake: -2,
    blunder: -3,
};

type Props = {
    size: number;
    pieces?: PiecesMap;
    orientation?: "white" | "black";
    selectedSquare?: Square | null;
    legalMoves?: Square[];
    onSquarePress?: (square: Square) => void;
    checkState?: { inCheck?: boolean; checkmated?: boolean; kingSquare?: Square | null };
    lastMoveEval?: { type: EvalType, toSq: Square } | null;
    recommendationArrows?: { from: Square; to: Square; color: string; type: EvalType }[];
};

export default function ChessBoard({
    size, pieces = INITIAL_PIECES, orientation = "white",
    selectedSquare, legalMoves, onSquarePress, checkState, lastMoveEval, recommendationArrows = []
}: Props) {
    // 1. 한 칸의 크기를 구하고, 전체 보드 크기를 8칸에 딱 맞게 재계산합니다.
    const squareSize = Math.floor(size / 8);
    const boardSize = squareSize * 8;

    const rows = useMemo(() => Array.from({ length: 8 }, (_, i) => i), []);
    const cols = useMemo(() => Array.from({ length: 8 }, (_, i) => i), []);

    const getSquareCenter = (sq: Square) => {
        const fileIndex = sq.charCodeAt(0) - 97;
        const rank = parseInt(sq[1], 10) - 1;
        const col = orientation === "white" ? fileIndex : 7 - fileIndex;
        const row = orientation === "white" ? 7 - rank : rank;
        return {
            x: col * squareSize + squareSize / 2,
            y: row * squareSize + squareSize / 2,
        };
    };

    const getSquareTopLeft = (sq: Square) => {
        const fileIndex = sq.charCodeAt(0) - 97;
        const rank = parseInt(sq[1], 10) - 1;
        const col = orientation === "white" ? fileIndex : 7 - fileIndex;
        const row = orientation === "white" ? 7 - rank : rank;
        return {
            x: col * squareSize,
            y: row * squareSize,
        };
    };

    return (
        // outer는 요청받은 원본 size를 유지하여 레이아웃을 잡고,
        // board는 계산된 정확한 boardSize를 사용하여 정사각형을 유지합니다.
        <View style={[styles.outer, { width: size, height: size }]}>
            <View style={[styles.board, { width: boardSize, height: boardSize }]}>
                {recommendationArrows.length > 0 && (
                    <Svg
                        pointerEvents="none"
                        style={[StyleSheet.absoluteFill, { width: boardSize, height: boardSize, zIndex: 2 }]}
                    >
                        {[...recommendationArrows]
                            .sort((a, b) => ARROW_PRIORITY[a.type] - ARROW_PRIORITY[b.type])
                            .map((arrow, idx) => {
                            const from = getSquareCenter(arrow.from);
                            const to = getSquareCenter(arrow.to);
                            const dx = to.x - from.x;
                            const dy = to.y - from.y;
                            const len = Math.hypot(dx, dy) || 1;

                            const startTrim = Math.min(squareSize * 0.2, len * 0.35);
                            const headLength = Math.min(squareSize * 0.4, len * 0.45);
                            const perp = headLength * 0.45;

                            const bias = (ARROW_PRIORITY[arrow.type] / 6) * (squareSize * 0.15);
                            const shiftX = 0;
                            const shiftY = -bias;

                            const startX = from.x + (dx / len) * startTrim + shiftX;
                            const startY = from.y + (dy / len) * startTrim + shiftY;
                            const tipX = to.x + shiftX;
                            const tipY = to.y + shiftY;
                            const baseX = tipX - (dx / len) * headLength;
                            const baseY = tipY - (dy / len) * headLength;

                            const leftX = baseX + (dy / len) * perp;
                            const leftY = baseY - (dx / len) * perp;
                            const rightX = baseX - (dy / len) * perp;
                            const rightY = baseY + (dx / len) * perp;

                            const strokeWidth = Math.max(2.5, squareSize * 0.22);
                            const outlineWidth = strokeWidth + Math.max(1.5, squareSize * 0.06);
                            const outlineColor = "rgba(0,0,0,0.4)";

                            return (
                                <React.Fragment key={`${arrow.from}-${arrow.to}-${idx}`}>
                                    <Line
                                        x1={startX}
                                        y1={startY}
                                        x2={baseX}
                                        y2={baseY}
                                        stroke={outlineColor}
                                        strokeOpacity={1}
                                        strokeWidth={outlineWidth}
                                        strokeLinecap="round"
                                    />
                                    <Line
                                        x1={startX}
                                        y1={startY}
                                        x2={baseX}
                                        y2={baseY}
                                        stroke={arrow.color}
                                        strokeOpacity={0.85}
                                        strokeWidth={strokeWidth}
                                        strokeLinecap="round"
                                    />
                                    <Polygon
                                        points={`${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`}
                                        fill={arrow.color}
                                        fillOpacity={0.9}
                                        stroke={outlineColor}
                                        strokeWidth={Math.max(1.4, squareSize * 0.06)}
                                    />
                                </React.Fragment>
                            );
                        })}
                    </Svg>
                )}

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
                                    </Pressable>
                                );
                            })}
                        </View>
                    );
                })}

                {/* pieces on top */}
                <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width: boardSize, height: boardSize, zIndex: 3 }]}>
                    {Object.entries(pieces).map(([squareName, piece]) => {
                        const pos = getSquareTopLeft(squareName as Square);
                        const evalSource = lastMoveEval?.toSq === squareName ? MOVE_ICONS[lastMoveEval.type] : null;
                        const isCheckmated = checkState?.checkmated && checkState.kingSquare === squareName;
                        return (
                            <View
                                key={squareName}
                                style={{
                                    position: "absolute",
                                    left: pos.x,
                                    top: pos.y,
                                    width: squareSize,
                                    height: squareSize,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Image
                                    source={PIECE_IMAGES[piece.color][piece.piece]}
                                    style={{ width: squareSize * 0.85, height: squareSize * 0.85 }}
                                    contentFit="contain"
                                    transition={0}
                                />
                                {evalSource && (
                                    <Image source={evalSource} style={styles.evalIcon} contentFit="contain" />
                                )}
                                {isCheckmated && (
                                    <Image
                                        source={piece.color === "white"
                                            ? require("../assets/images/moves/checkmate_white.svg")
                                            : require("../assets/images/moves/checkmate_black.svg")}
                                        style={styles.checkmateIcon}
                                        contentFit="contain"
                                    />
                                )}
                            </View>
                        );
                    })}
                </View>

            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    outer: { alignItems: "center", justifyContent: "center" },
    board: {
        position: "relative",
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
