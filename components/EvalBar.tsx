import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
// ✅ Reanimated 관련 임포트
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from "react-native-reanimated";

interface EvalBarProps {
    value?: number | string;
    height?: number;
}

export default function EvalBar({ value = 0, height = 8 }: EvalBarProps) {
    // ✅ 애니메이션을 위한 공유값 (0.5는 중립 상태)
    const progress = useSharedValue(0.5);

    useEffect(() => {
        let target = 0.5;

        // 1. 목표 수치 계산 (기존 로직 동일)
        if (typeof value === "string") {
            target = value.startsWith("-") ? 0 : 1;
        } else {
            const clamped = Math.max(-20, Math.min(20, value));
            target = (clamped + 20) / 40;
        }

        // 2. ✅ 부드러운 애니메이션 실행 (600ms 동안 Ease-Out 효과)
        progress.value = withTiming(target, {
            duration: 600,
            easing: Easing.out(Easing.exp), // 끝으로 갈수록 부드럽게 멈춤
        });
    }, [value]);

    // 3. ✅ 애니메이션 스타일 적용
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scaleX: progress.value }],
    }));

    return (
        <View style={styles.wrap}>
            <View style={[styles.track, { height, backgroundColor: "#262421" }]}>
                {/* ✅ 일반 View 대신 Animated.View 사용 */}
                <Animated.View
                    style={[
                        styles.fill,
                        { backgroundColor: "#E7EDF5" },
                        animatedStyle,
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