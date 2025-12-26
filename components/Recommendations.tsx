import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
// ✅ react-native-svg에서 SvgProps 임포트
import { SvgProps } from "react-native-svg";

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
    id?: string;
    move: string;
    type: EvalType;
    intent?: string;
    branches?: string[];
    eval?: number | string;
};

const EVAL_META: Record<EvalType, { color: string; label: string }> = {
    brilliant: { color: "#1aada7", label: "기발함" }, // 아이콘이 있으므로 텍스트 간소화
    best: { color: "#91b045", label: "최선" },
    excellent: { color: "#91b045", label: "훌륭함" },
    book: { color: "#a98865", label: "정석" },
    okay: { color: "#a98865", label: "무난함" },
    inaccuracy: { color: "#f7c044", label: "부정확" },
    mistake: { color: "#e58f2a", label: "실수" },
    blunder: { color: "#ca3430", label: "블런더" },
    critical: { color: "#1aada7", label: "승부처" },
    forced: { color: "#333333", label: "강제수" },
};

// ✅ [추가] 타입별 SVG 아이콘 매핑
// Expo/Metro 환경에서는 require().default 형태로 SVG 컴포넌트를 가져오는 경우가 많습니다.
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

type Props = {
    items?: RecommendationItem[];
    height?: number;
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

                            // ✅ 현재 타입에 해당하는 아이콘 컴포넌트 가져오기
                            const IconComponent = MOVE_ICONS[it.type];

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

                                        <View style={styles.textContainer}>
                                            <Text style={styles.moveText} numberOfLines={1}>
                                                {it.move}
                                            </Text>
                                            {it.intent && (
                                                <Text style={styles.intentText} numberOfLines={1}>
                                                    {it.intent.replace(/\n/g, " ")}
                                                </Text>
                                            )}
                                        </View>

                                        {/* ✅ [추가] 아이콘 렌더링 (평가 텍스트 왼쪽에 배치) */}
                                        {IconComponent && (
                                            <IconComponent
                                                width={20} // 아이콘 크기 조절
                                                height={20}
                                                style={styles.moveIcon}
                                            />
                                        )}

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
    viewport: { borderRadius: 8, overflow: "hidden" },
    list: { paddingVertical: 4, gap: 4 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 8 },
    emptyText: { fontSize: 12, color: "rgba(231,237,245,0.55)", fontWeight: "700" },

    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8, // 상하 패딩 약간 줄임
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    rowPressed: { backgroundColor: "rgba(255,255,255,0.06)" },

    indicator: { width: 4, height: 28, borderRadius: 2, marginRight: 8 },

    textContainer: { flex: 1, flexDirection: "row", alignItems: "baseline", marginRight: 8 },
    moveText: { fontSize: 15, fontWeight: "700", color: "#E7EDF5" },
    intentText: { flex: 1, marginLeft: 8, fontSize: 12, color: "rgba(231,237,245,0.45)", fontWeight: "500" },

    // ✅ [추가] 아이콘 스타일
    moveIcon: {
        marginRight: 6, // 텍스트와의 간격
    },

    evalText: { fontSize: 12, fontWeight: "700" },

    expandBtn: { paddingHorizontal: 6, paddingVertical: 4, marginLeft: 4 },
    expandIcon: { fontSize: 16, color: "rgba(231,237,245,0.6)" },

    branchRow: { flexDirection: "row", alignItems: "center", paddingLeft: 28, paddingVertical: 6, paddingRight: 8 },
    branchPressed: { backgroundColor: "rgba(255,255,255,0.04)" },
    branchDot: { marginRight: 6, color: "rgba(231,237,245,0.4)" },
    branchText: { fontSize: 13, color: "rgba(231,237,245,0.75)", flex: 1 },
});