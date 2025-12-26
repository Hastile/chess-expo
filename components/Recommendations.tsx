import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export type EvalType =
    | "brilliant"
    | "best"
    | "excellent"
    | "book"
    | "okay"
    | "inaccuracy"
    | "mistake"
    | "blunder"
    | "critical"
    | "forced";

export type RecommendationItem = {
    id?: string;         // optional (DB id)
    move: string;        // e.g. "d6", "O-O"
    type: EvalType;
    branches?: string[]; // e.g. ["Najdorf", "Dragon", ...]
};

const EVAL_META: Record<EvalType, { color: string; label: string }> = {
    brilliant: { color: "#1aada7", label: "!! 기발함" },
    best: { color: "#91b045", label: "★ 최선" },
    excellent: { color: "#91b045", label: "훌륭함" },
    book: { color: "#a98865", label: "정석" },
    okay: { color: "#a98865", label: "무난함" },
    inaccuracy: { color: "#f7c044", label: "?! 부정확" },
    mistake: { color: "#e58f2a", label: "? 실수" },
    blunder: { color: "#ca3430", label: "?? 블런더" },
    critical: { color: "#1aada7", label: "! 승부처" },
    forced: { color: "#333333", label: "강제수" },
};

type Props = {
    items?: RecommendationItem[];
    height?: number; // default 220 (약 4개)
    onSelectMove?: (move: string, item: RecommendationItem) => void;
    onSelectBranch?: (branch: string, parent: RecommendationItem) => void;
};

export default function Recommendations({
    items = [],
    height = 220,
    onSelectMove,
    onSelectBranch,
}: Props) {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const hasItems = items.length > 0;

    const keyOf = useMemo(() => {
        return (item: RecommendationItem, idx: number) => item.id ?? `${item.move}-${idx}`;
    }, []);

    return (
        <View style={styles.wrap}>
            <View style={[styles.viewport, { height }]}>
                {!hasItems ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>추천 수 없음</Text>
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={styles.list}>
                        {items.map((it, idx) => {
                            const meta = EVAL_META[it.type];
                            const opened = openIndex === idx;
                            const canExpand = !!it.branches?.length;

                            return (
                                <View key={keyOf(it, idx)}>
                                    {/* main row */}
                                    <Pressable
                                        onPress={() => onSelectMove?.(it.move, it)}
                                        style={({ pressed }) => [
                                            styles.row,
                                            pressed && styles.rowPressed,
                                        ]}
                                    >
                                        <View style={[styles.indicator, { backgroundColor: meta.color }]} />

                                        <Text style={styles.moveText} numberOfLines={1}>
                                            {it.move}
                                        </Text>

                                        <Text style={[styles.evalText, { color: meta.color }]} numberOfLines={1}>
                                            {meta.label}
                                        </Text>

                                        {canExpand && (
                                            <Pressable
                                                onPress={() => setOpenIndex(opened ? null : idx)}
                                                style={styles.expandBtn}
                                                hitSlop={10}
                                            >
                                                <Text style={styles.expandIcon}>{opened ? "▾" : "▸"}</Text>
                                            </Pressable>
                                        )}
                                    </Pressable>

                                    {/* branches */}
                                    {opened &&
                                        it.branches?.map((b, i) => (
                                            <Pressable
                                                key={`${b}-${i}`}
                                                onPress={() => onSelectBranch?.(b, it)}
                                                style={({ pressed }) => [
                                                    styles.branchRow,
                                                    pressed && styles.branchPressed,
                                                ]}
                                            >
                                                <Text style={styles.branchDot}>•</Text>
                                                <Text style={styles.branchText} numberOfLines={1}>
                                                    {b}
                                                </Text>
                                            </Pressable>
                                        ))}
                                </View>
                            );
                        })}
                    </ScrollView>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { width: "100%", maxWidth: 360, gap: 8 },

    viewport: {
        borderRadius: 8,
        overflow: "hidden",
    },

    list: { paddingVertical: 4, gap: 4 },

    empty: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.04)",
        borderRadius: 8,
    },
    emptyText: {
        fontSize: 12,
        color: "rgba(231,237,245,0.55)",
        fontWeight: "700",
    },

    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    rowPressed: { backgroundColor: "rgba(255,255,255,0.06)" },

    indicator: {
        width: 4,
        height: 28, // ✅ 통일
        borderRadius: 2,
        marginRight: 8,
    },

    moveText: {
        flex: 1,
        fontSize: 15,
        fontWeight: "700",
        color: "#E7EDF5",
    },

    evalText: {
        marginLeft: 8,
        fontSize: 12,
        fontWeight: "700",
    },

    expandBtn: { paddingHorizontal: 6, paddingVertical: 4 },
    expandIcon: { fontSize: 16, color: "rgba(231,237,245,0.6)" },

    branchRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 28,
        paddingVertical: 6,
        paddingRight: 8,
    },
    branchPressed: { backgroundColor: "rgba(255,255,255,0.04)" },
    branchDot: { marginRight: 6, color: "rgba(231,237,245,0.4)" },
    branchText: { fontSize: 13, color: "rgba(231,237,245,0.75)", flex: 1 },
});
