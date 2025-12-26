// components/Icons.ts
export type EvalType =
    | "brilliant" | "best" | "excellent" | "book" | "okay"
    | "inaccuracy" | "mistake" | "blunder" | "critical" | "forced";

// ✅ expo-image와 호환되도록 raw 에셋 매핑
export const MOVE_ICONS: Record<string, any> = {
    brilliant: require("../assets/images/moves/brilliant.svg"),
    best: require("../assets/images/moves/best.svg"),
    excellent: require("../assets/images/moves/excellent.svg"),
    book: require("../assets/images/moves/book.svg"),
    okay: require("../assets/images/moves/okay.svg"),
    inaccuracy: require("../assets/images/moves/inaccuracy.svg"),
    mistake: require("../assets/images/moves/mistake.svg"),
    blunder: require("../assets/images/moves/blunder.svg"),
    critical: require("../assets/images/moves/critical.svg"),
    forced: require("../assets/images/moves/forced.svg"),
};