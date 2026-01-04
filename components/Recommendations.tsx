import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SvgProps } from "react-native-svg";
import { EvalType } from "./Icons";

export type RecommendationItem = {
    id?: string;
    move: string;
    type: EvalType;
    name?: string;
    branches?: string[];
    eval?: number | string;
};

// Local SVG components (babel-transform)
const MOVE_ICONS: Record<string, React.FC<SvgProps>> = {
    brilliant: require("@/assets/images/moves/brilliant.svg").default,
    best: require("@/assets/images/moves/best.svg").default,
    excellent: require("@/assets/images/moves/excellent.svg").default,
    book: require("@/assets/images/moves/book.svg").default,
    okay: require("@/assets/images/moves/okay.svg").default,
    inaccuracy: require("@/assets/images/moves/inaccuracy.svg").default,
    mistake: require("@/assets/images/moves/mistake.svg").default,
    blunder: require("@/assets/images/moves/blunder.svg").default,
    critical: require("@/assets/images/moves/critical.svg").default,
    forced: require("@/assets/images/moves/forced.svg").default,
};

export const EVAL_META: Record<EvalType, { color: string; label: string }> = {
    brilliant: { color: "#1aada7", label: "Brilliant" },
    best: { color: "#91b045", label: "Best" },
    excellent: { color: "#91b045", label: "Excellent" },
    book: { color: "#a98865", label: "Book" },
    okay: { color: "#9aa3af", label: "Okay" },
    inaccuracy: { color: "#f7c044", label: "Inaccuracy" },
    mistake: { color: "#e58f2a", label: "Mistake" },
    blunder: { color: "#ca3430", label: "Blunder" },
    critical: { color: "#1aada7", label: "Critical" },
    forced: { color: "#4a4a4a", label: "Forced" },
};

export interface RecommendationsProps {
    items?: RecommendationItem[];
    height?: number;
    onSelectMove?: (move: string, item: RecommendationItem) => void;
    onSelectBranch?: (branch: string, parent: RecommendationItem) => void;
}

export default function Recommendations({
    items = [],
    height = 200,
    onSelectMove,
    onSelectBranch,
}: RecommendationsProps) {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <View style={styles.wrap}>
            <View style={[styles.viewport, { height }]}>
                <ScrollView contentContainerStyle={styles.list}>
                    {items.map((it, idx) => {
                        const meta = EVAL_META[it.type];
                        const opened = openIndex === idx;
                        const canExpand = !!it.branches?.length;
                        const IconComponent = MOVE_ICONS[it.type];

                        const handlePressRow = () => {
                            onSelectMove?.(it.move, it);
                            if (canExpand) {
                                setOpenIndex(opened ? null : idx);
                            }
                        };

                        return (
                            <View key={`${it.move}-${idx}`} style={styles.rowWrapper}>
                                <View style={styles.rowContainer}>
                                    <Pressable
                                        onPress={handlePressRow}
                                        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                                    >
                                        <View style={[styles.indicator, { backgroundColor: meta.color }]} />
                                        <View style={styles.textContainer}>
                                            <Text style={styles.moveText}>{it.move}</Text>
                                            {it.name && (
                                                <Text style={styles.intentText} numberOfLines={1}>{it.name}</Text>
                                            )}
                                        </View>
                                        <Text style={[styles.evalLabel, { color: meta.color }]}>{meta.label}</Text>

                                        {canExpand && (
                                            <Pressable onPress={() => setOpenIndex(opened ? null : idx)} style={styles.expandBtn}>
                                                <Text style={styles.expandIcon}>{opened ? "▲" : "▼"}</Text>
                                            </Pressable>
                                        )}
                                    </Pressable>

                                    {IconComponent && (
                                        <View style={styles.iconBadge}>
                                            <IconComponent width={14} height={14} />
                                        </View>
                                    )}
                                </View>

                                {opened && it.branches?.map((b, i) => (
                                    <Pressable
                                        key={`${b}-${i}`}
                                        onPress={() => onSelectBranch?.(b, it)}
                                        style={({ pressed }) => [styles.branchRow, pressed && styles.branchPressed]}
                                    >
                                        <Text style={styles.branchDot}>•</Text>
                                        <Text style={styles.branchText}>{b}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        );
                    })}
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { width: "100%", maxWidth: 360 },
    viewport: { borderRadius: 8, overflow: "hidden" },
    list: { paddingVertical: 8, gap: 4 },
    rowWrapper: { marginBottom: 4 },
    rowContainer: { position: "relative" },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 12,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderRadius: 8,
        marginHorizontal: 8,
    },
    rowPressed: { backgroundColor: "rgba(255,255,255,0.08)" },
    indicator: { width: 4, height: 20, borderRadius: 2, marginRight: 10 },
    textContainer: { flex: 1, flexDirection: "row", alignItems: "baseline" },
    moveText: { fontSize: 16, fontWeight: "700", color: "#E7EDF5" },
    intentText: { marginLeft: 8, fontSize: 12, color: "rgba(231,237,245,0.4)", flex: 1 },
    evalLabel: { fontSize: 11, fontWeight: "800", opacity: 0.8 },
    iconBadge: {
        position: "absolute",
        top: -4,
        right: 4,
        backgroundColor: "#0B0F14",
        borderRadius: 10,
        padding: 2,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    expandBtn: { paddingLeft: 10 },
    expandIcon: { fontSize: 16, color: "rgba(231,237,245,0.6)" },
    branchRow: { flexDirection: "row", alignItems: "center", paddingLeft: 32, paddingVertical: 8 },
    branchPressed: { backgroundColor: "rgba(255,255,255,0.04)" },
    branchDot: { marginRight: 8, color: "rgba(231,237,245,0.3)" },
    branchText: { fontSize: 13, color: "rgba(231,237,245,0.6)" },
});
