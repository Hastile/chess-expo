import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

// ✅ 타입을 명확하게 interface로 정의
interface EvalBarProps {
    value?: number | string;
    height?: number;
}

export default function EvalBar({ value = 0, height = 8 }: EvalBarProps) {
    const scaleX = useMemo(() => {
        // 1. 문자열 메이트 처리 ("M1", "-M1" 등)
        if (typeof value === "string") {
            return value.startsWith("-") ? 0 : 1;
        }

        // 2. 숫자형 처리 (±20 임계값)
        const clamped = Math.max(-20, Math.min(20, value));
        return (clamped + 20) / 40;
    }, [value]);

    return (
        <View style={styles.wrap}>
            <View style={[styles.track, { height, backgroundColor: "#262421" }]}>
                <View
                    style={[
                        styles.fill,
                        {
                            backgroundColor: "#E7EDF5",
                            transform: [{ scaleX }],
                        },
                    ]}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { width: "100%", maxWidth: 360, marginVertical: 4 },
    track: {
        width: "100%",
        borderRadius: 4,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)"
    },
    fill: {
        height: "100%",
        width: "100%",
        transformOrigin: "left"
    },
});