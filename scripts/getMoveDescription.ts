import { Chess, Move, PieceSymbol, Square } from 'chess.js';

export type EngineType = 'brilliant' | 'blunder' | 'mistake' | 'inaccuracy' | null;

export interface MoveDescription {
    line1: string;
    line2: string;
}

const pieceNames: Record<PieceSymbol, string> = {
    p: "폰", n: "나이트", b: "비숍", r: "룩", q: "퀸", k: "킹"
};

// --- 조사 처리 유틸리티 ---
const getUl = (t: string): string =>
    ((t.charCodeAt(t.length - 1) - 0xac00) % 28 !== 0 ? "을" : "를");

const getRo = (t: string): string => {
    const code = (t.charCodeAt(t.length - 1) - 0xac00);
    const jong = code % 28;
    return (jong !== 0 && jong !== 8) ? "으로" : "로"; // 'ㄹ' 받침 예외 처리
};

/**
 * 전체 기보(history)를 받아 마지막 수를 분석하여 2줄 설명을 반환합니다.
 * @param history - "e4 e5 Nf3" 또는 "1. e4 e5 2. Nf3" 형태의 문자열
 * @param engineType - 해당 수에 대한 엔진 판정 결과
 */
export function getMoveDescription(
    history: string,
    engineType: EngineType = null
): MoveDescription {
    const chess = new Chess();

    // 1. 기보 정제 및 수 목록 추출
    const moves = history
        .replace(/\d+\./g, '') // "1." 등 수 번호 제거
        .split(/\s+/)
        .filter(m => m.trim().length > 0);

    if (moves.length === 0) return { line1: "경기가 시작되지 않았습니다.", line2: "" };

    // 2. 마지막 수 분리 및 이전 상태 재현
    const lastMoveSan = moves.pop()!;
    for (const m of moves) {
        if (!chess.move(m)) return { line1: "기보 분석 오류가 발생했습니다.", line2: "" };
    }

    // 3. 분석을 위한 데이터 준비
    const fenBefore = chess.fen();
    const color = chess.turn();
    const subject = color === 'w' ? "백이" : "흑이";
    const oppName = color === 'w' ? "흑" : "백";
    const oppColor = color === 'w' ? 'b' : 'w';

    const move: Move | null = chess.move(lastMoveSan);
    if (!move) return { line1: "유효하지 않은 수입니다.", line2: "" };

    const prevChess = new Chess(fenBefore);
    const postChess = new Chess(chess.fen());
    const pName = pieceNames[move.piece];

    // --- Line 1: 핵심 액션 (우선순위 계층) ---
    let line1 = "";

    if (postChess.isCheckmate()) {
        line1 = `${subject} ${pName}${getRo(pName)} 체크메이트하며 승리합니다.`;
    } else if (move.flags.includes('k') || move.flags.includes('q')) {
        line1 = `${subject} ${move.flags.includes('k') ? '킹' : '퀸'}사이드 캐슬링했습니다.`;
    } else if (engineType === 'brilliant') {
        line1 = `${subject} ${pName}${getUl(pName)} 희생하며 전술적인 묘수를 둡니다.`;
    } else if (prevChess.inCheck()) {
        line1 = handleCheckResponse(prevChess, move, pName);
    } else if (isDesperado(prevChess, move)) {
        line1 = `어차피 잡힐 ${pName}${getRo(pName)} 기물을 잡으며 데스페라도를 시도합니다.`;
    } else if (move.captured) {
        line1 = handleCapture(prevChess, move, pName, oppName, postChess.inCheck());
    } else if (postChess.inCheck()) {
        line1 = `${subject} ${pName}${getRo(pName)} ${oppName}의 킹을 체크합니다.`;
    } else if (isPin(postChess, move)) {
        line1 = `${subject} ${pName}${getRo(pName)} 상대 기물을 핀에 겁니다.`;
    } else if (engineType === 'blunder') {
        line1 = `${subject} ${pName}${getUl(pName)} 내주는 결정적인 블런더를 범했습니다.`;
    } else {
        line1 = handleGeneralMove(prevChess, move, pName);
    }

    // --- Line 2: 전략적 결과 (우선순위 계층) ---
    let line2 = "";

    if (postChess.inCheck() && isProtected(postChess, move.to)) {
        line2 = `배터리가 형성되어 킹이 기물을 되잡을 수 없습니다.`;
    } else if (isMateThreat(postChess, oppColor)) {
        line2 = `다음 수에 메이트를 하겠다는 강력한 위협입니다.`;
    } else if (isTrapped(postChess, move)) {
        line2 = `${oppName}의 기물이 피할 곳이 없는 트래핑 상황입니다.`;
    } else if (isDiscovered(prevChess, move)) {
        const d = getDiscoveredTarget(postChess, move);
        line2 = `${d.piece}의 길이 열리며 ${oppName}의 ${d.target}을 공격합니다.`;
    } else if (isOverloaded(prevChess, move)) {
        line2 = `상대 기물은 방어 임무가 겹친 과부하 상태라 취약합니다.`;
    } else if (isSkewer(postChess, move)) {
        line2 = `앞의 기물이 피하면 뒤가 잡히는 스큐어 전술입니다.`;
    } else if (isPawnBreak(prevChess, move)) {
        line2 = `상대 진형을 무너뜨리는 강력한 폰 브레이크입니다.`;
    } else if (isPassedPawn(postChess, move)) {
        line2 = `${move.to[0]} 파일의 폰이 승급을 노리는 패스폰이 됩니다.`;
    } else if (isFork(postChess, move) && isAttacked(postChess, move.to)) {
        line2 = `${oppName}의 기물이 포크를 건 기물을 잡을 수 있습니다.`;
    } else {
        line2 = getOpenedLines(prevChess, move);
    }

    return {
        line1: line1.slice(0, 50),
        line2: (line2 || "").slice(0, 50)
    };
}

// --- 보조 분석 함수들 ---

function handleCheckResponse(chess: Chess, move: Move, pName: string): string {
    if (move.captured) return `상대 기물을 잡으며 체크를 해제합니다.`;
    if (move.piece === 'k') {
        const moves = chess.moves({ square: move.from });
        return moves.length === 1 ? `킹을 이동시켜야 하는 유일한 강제수입니다.` : `킹을 이동시켜 체크를 피합니다.`;
    }
    return `${pName}${getUl(pName)} 이동시켜 체크를 차단합니다.`;
}

function handleCapture(chess: Chess, move: Move, pName: string, opp: string, isCheck: boolean): string {
    const capName = pieceNames[move.captured as PieceSymbol];
    const history = chess.history({ verbose: true });
    const last = history[history.length - 1];
    const isRecapture = last && last.to === move.to && last.captured;
    let res = `${pName}${getRo(pName)} ${opp}의 ${capName}${getUl(capName)} 잡으며 ${isRecapture ? '회수' : '교환'}합니다.`;
    return isCheck ? res.replace("합니다.", "하고 체크합니다.") : res;
}

function handleGeneralMove(chess: Chess, move: Move, pName: string): string {
    const isInitial = !chess.history({ verbose: true }).some(m => m.piece === move.piece && m.from === move.from);
    return isInitial ? `${pName}${getUl(pName)} ${move.to}로 전개했습니다.` : `${pName}${getUl(pName)} ${move.to}로 이동했습니다.`;
}

// --- 전술 판별 헬퍼 스터브 (프로젝트 사양에 따라 확장) ---
function isFork(c: Chess, m: Move): boolean { return c.moves({ square: m.to, verbose: true }).filter(x => !!x.captured).length >= 2; }
function isProtected(c: Chess, sq: Square): boolean { return true; }
function isAttacked(c: Chess, sq: Square): boolean { return false; }
function isMateThreat(c: Chess, color: string): boolean { return false; }
function isTrapped(c: Chess, m: Move): boolean { return false; }
function isDiscovered(c: Chess, m: Move): boolean { return false; }
function getDiscoveredTarget(c: Chess, m: Move) { return { piece: "비숍", target: "퀸" }; }
function isOverloaded(c: Chess, m: Move): boolean { return false; }
function isSkewer(c: Chess, m: Move): boolean { return false; }
function isPassedPawn(c: Chess, m: Move): boolean { return false; }
function isPawnBreak(c: Chess, m: Move): boolean { return false; }
function isPin(c: Chess, m: Move): boolean { return false; }
function isDesperado(c: Chess, m: Move): boolean { return false; }
function getOpenedLines(c: Chess, m: Move): string { return "비숍과 퀸의 길이 열립니다."; }