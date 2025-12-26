// components/Icons.ts
import { SvgProps } from "react-native-svg";

// ✅ 평가 타입 정의 (기존 Recommendations.tsx에서 가져옴)
export type EvalType =
    | "brilliant" | "best" | "excellent" | "book" | "okay"
    | "inaccuracy" | "mistake" | "blunder" | "critical" | "forced";

// ✅ SVG 컴포넌트 매핑 (require.default 사용)
export const MOVE_ICONS: Record<string, React.FC<SvgProps>> = {
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