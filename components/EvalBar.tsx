import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

type Props = {
    /** -1 ~ 1 (흑 우세 ~ 백 우세). DB 값 그대로 */
    value?: number;
    height?: number;
};

export default function EvalBar({ value = 0, height = 6 }: Props) {
    const { scaleX, fillColor } = useMemo(() => {
        const v = Math.max(-1, Math.min(1, value));
        return {
            scaleX: (50 + v * 50) / 100, // 0 ~ 1
            fillColor: v >= 0 ? "#E7EDF5" : "#333333",
        };
    }, [value]);

    return (
        <View style={styles.wrap}>
            <View style={[styles.track, { height }]}>
                <View
                    style={[
                        styles.fill,
                        {
                            backgroundColor: fillColor,
                            transform: [{ scaleX }],
                        },
                    ]}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        width: "100%",
        maxWidth: 360,
    },
    track: {
        width: "100%",
        backgroundColor: "rgba(255,255,255,0.15)",
        borderRadius: 999,
        overflow: "hidden",
    },
    fill: {
        height: "100%",
        width: "100%",          // 🔑 항상 100%
        borderRadius: 999,
        transformOrigin: "left", // iOS/Android 모두 안전
    },
});
