import { CheckState } from "@/scripts/Piece";
import { Image } from "expo-image"; // SVG 지원을 위해 expo-image 권장
import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

/* ===== Types ===== */
export type Color = "white" | "black";
export type Piece =
    | "king"
    | "queen"
    | "rook"
    | "bishop"
    | "knight"
    | "pawn";

export type Square =
    `${"a" | "b" | "c" | "d" | "e" | "f" | "g" | "h"}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;

export type PiecesMap = Partial<
    Record<Square, { color: Color; piece: Piece }>
>;

/* ===== Piece Images ===== */
const PIECE_IMAGES: Record<Color, Record<Piece, any>> = {
    white: {
        king: require("../assets/images/Units/WhiteKing.webp"),
        queen: require("../assets/images/Units/WhiteQueen.webp"),
        rook: require("../assets/images/Units/WhiteRook.webp"),
        bishop: require("../assets/images/Units/WhiteBishop.webp"),
        knight: require("../assets/images/Units/WhiteKnight.webp"),
        pawn: require("../assets/images/Units/WhitePawn.webp"),
    },
    black: {
        king: require("../assets/images/Units/BlackKing.webp"),
        queen: require("../assets/images/Units/BlackQueen.webp"),
        rook: require("../assets/images/Units/BlackRook.webp"),
        bishop: require("../assets/images/Units/BlackBishop.webp"),
        knight: require("../assets/images/Units/BlackKnight.webp"),
        pawn: require("../assets/images/Units/BlackPawn.webp"),
    },
};

/* ===== Initial Position ===== */
export const INITIAL_PIECES: PiecesMap = {
    // White pieces
    a1: { color: "white", piece: "rook" },
    b1: { color: "white", piece: "knight" },
    c1: { color: "white", piece: "bishop" },
    d1: { color: "white", piece: "queen" },
    e1: { color: "white", piece: "king" },
    f1: { color: "white", piece: "bishop" },
    g1: { color: "white", piece: "knight" },
    h1: { color: "white", piece: "rook" },

    a2: { color: "white", piece: "pawn" },
    b2: { color: "white", piece: "pawn" },
    c2: { color: "white", piece: "pawn" },
    d2: { color: "white", piece: "pawn" },
    e2: { color: "white", piece: "pawn" },
    f2: { color: "white", piece: "pawn" },
    g2: { color: "white", piece: "pawn" },
    h2: { color: "white", piece: "pawn" },

    // Black pieces
    a8: { color: "black", piece: "rook" },
    b8: { color: "black", piece: "knight" },
    c8: { color: "black", piece: "bishop" },
    d8: { color: "black", piece: "queen" },
    e8: { color: "black", piece: "king" },
    f8: { color: "black", piece: "bishop" },
    g8: { color: "black", piece: "knight" },
    h8: { color: "black", piece: "rook" },

    a7: { color: "black", piece: "pawn" },
    b7: { color: "black", piece: "pawn" },
    c7: { color: "black", piece: "pawn" },
    d7: { color: "black", piece: "pawn" },
    e7: { color: "black", piece: "pawn" },
    f7: { color: "black", piece: "pawn" },
    g7: { color: "black", piece: "pawn" },
    h7: { color: "black", piece: "pawn" },
};

/* ===== Props ===== */
type Props = {
    size: number;
    pieces?: PiecesMap;
    orientation?: "white" | "black";
    selectedSquare?: Square | null;
    legalMoves?: Square[];
    onSquarePress?: (square: Square) => void;
    checkState?: CheckState; // 추가
};

/* ===== Component ===== */
export default function ChessBoard({
    size,
    pieces = INITIAL_PIECES,
    orientation = "white",
    selectedSquare,
    legalMoves,
    onSquarePress,
    checkState
}: Props) {
    const square = Math.floor(size / 8);
    const boardSize = square * 8;

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
                                const fileIndex =
                                    orientation === "white" ? cUI : 7 - cUI;

                                const file = String.fromCharCode(97 + fileIndex) as
                                    | "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";

                                const squareName = `${file}${rank + 1}` as Square;
                                const piece = pieces[squareName];

                                const isSelected = selectedSquare === squareName;
                                const isLegal = legalMoves?.includes(squareName);

                                const isLight = (fileIndex + rank) % 2 === 1;

                                const isKingInCheck = checkState?.inCheck && squareName === checkState.kingSquare;
                                const isCheckmate = checkState?.checkmated && squareName === checkState.kingSquare;

                                return (
                                    <Pressable
                                        key={squareName}
                                        style={[
                                            styles.square,
                                            {
                                                width: square,
                                                height: square,
                                                backgroundColor: isLight ? "#EADDCB" : "#B58863",
                                                ...(isSelected && { backgroundColor: "#E6C36A" }),
                                                ...(isKingInCheck && { backgroundColor: "#EF4444" }), // 체크 시 붉은색 강조
                                            },
                                        ]}
                                    >
                                        {/* 기물 이미지 */}
                                        {piece && (
                                            <Image
                                                source={PIECE_IMAGES[piece.color][piece.piece]}
                                                style={{ width: square * 0.9, height: square * 0.9 }}
                                                contentFit="contain"
                                            />
                                        )}

                                        {/* 체크메이트 아이콘 표시 */}
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

/* ===== Styles ===== */
const styles = StyleSheet.create({
    outer: {
        alignItems: "center",
        justifyContent: "center",
    },
    board: {
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.15)",
    },
    row: {
        flexDirection: "row",
    },
    square: {
        alignItems: "center",
        justifyContent: "center",
        position: "relative", // ✅ 링/점 겹치기 안정화
    },
    legalDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "rgba(0,0,0,0.35)",
    },
    legalRing: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: "rgba(0,0,0,0.35)",
        backgroundColor: "transparent",
        position: "absolute",
    },
    checkmateIcon: {
        position: "absolute",
        top: 2,
        right: 2,
        width: 16,
        height: 16,
    },
});
