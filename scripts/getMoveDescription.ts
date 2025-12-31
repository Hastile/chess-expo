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
const vowelOverride = new Set(["나이트"]); // 외래어 발음상 받침 없는 것으로 처리
const hasJong = (t: string): boolean => {
    if (vowelOverride.has(t)) return false;
    const ch = t[t.length - 1];
    if (ch < "가" || ch > "힣") return false;
    return ((ch.charCodeAt(0) - 0xac00) % 28) !== 0;
};

const getUl = (t: string): string => (hasJong(t) ? "을" : "를");

const getRo = (t: string): string => {
    const ch = t[t.length - 1];
    if (ch < "가" || ch > "힣") return "로";
    const code = (ch.charCodeAt(0) - 0xac00);
    const jong = code % 28;
    if (!hasJong(t)) return "로";
    return jong !== 8 ? "으로" : "로"; // 'ㄹ' 받침 예외 처리
};

const getWa = (t: string): string => (hasJong(t) ? "과" : "와");

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
    const defenseLine1 = getNewlyDefended(prevChess, postChess, move, subject);
    const attackLine1 = getNewlyAttacked(prevChess, postChess, move, oppName, subject, pName, 'line1');
    const hasDefAndAtt = !!defenseLine1 && !!attackLine1;

    if (postChess.isCheckmate()) {
        line1 = `${subject} ${pName}${getRo(pName)} 체크메이트하며 승리합니다.`;
    } else if (move.flags.includes('k') || move.flags.includes('q')) {
        line1 = `${subject} ${move.flags.includes('k') ? '킹' : '퀸'}사이드 캐슬링했습니다.`;
    } else if (engineType === 'brilliant') {
        line1 = `${subject} ${pName}${getUl(pName)} 희생하며 전술적인 묘수를 둡니다.`;
    } else if (prevChess.inCheck()) {
        line1 = handleCheckResponse(prevChess, move, pName, subject);
    } else if (isDesperado(prevChess, move)) {
        line1 = `어차피 잡힐 ${pName}${getRo(pName)} 기물을 잡으며 데스페라도를 시도합니다.`;
    } else if (move.captured) {
        line1 = handleCapture(prevChess, move, pName, oppName, subject, postChess.inCheck());
    } else if (postChess.inCheck()) {
        line1 = `${subject} ${pName}${getRo(pName)} ${oppName}의 킹을 체크합니다.`;
    } else if (isPin(postChess, move)) {
        line1 = `${subject} ${pName}${getRo(pName)} 상대 기물을 핀에 겁니다.`;
    } else if (engineType === 'blunder') {
        line1 = `${subject} ${pName}${getUl(pName)} 내주는 결정적인 블런더를 범했습니다.`;
    } else if (hasDefAndAtt) {
        line1 = combineDefenseAttack(defenseLine1!, attackLine1!, subject);
    } else if (defenseLine1) {
        line1 = defenseLine1;
    } else if (attackLine1) {
        line1 = attackLine1;
    } else {
        line1 = handleGeneralMove(prevChess, move, pName, subject);
    }

    // --- Line 2: 전략적 결과 (우선순위 계층) ---
    let line2 = "";
    const forkScenario = getForkScenario(postChess, move);
    const forkDetail = forkScenario.targets.length >= 2
        ? formatForkThreat(forkScenario.targets, oppName, forkScenario.via, pName, move)
        : "";

    if (defenseLine1 || attackLine1) {
        // 방어/공격 설명이 이미 line1에 있더라도 포크 위협은 추가로 알려준다.
        if (forkDetail && isAttacked(postChess, move.to as Square, move.color)) {
            line2 = `${oppName}의 기물이 포크를 건 기물을 잡을 수 있습니다.`;
        } else if (forkDetail) {
            line2 = forkDetail;
        } else {
            line2 = "";
        }
    } else if (postChess.inCheck() && isProtected(postChess, move.to)) {
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
    } else if (forkDetail && isAttacked(postChess, move.to as Square, move.color)) {
        line2 = `${oppName}의 기물이 포크를 건 기물을 잡을 수 있습니다.`;
    } else if (forkDetail) {
        line2 = forkDetail;
    } else {
        line2 = getOpenedLines(prevChess, postChess, move);
    }

    return {
        line1: line1.slice(0, 50),
        line2: (line2 || "").slice(0, 50)
    };
}

// --- 보조 분석 함수들 ---

function handleCheckResponse(chess: Chess, move: Move, pName: string, subject: string): string {
    if (move.captured) return `${subject} ${pName}${getRo(pName)} 공격말을 입혀 체크를 차단합니다.`;
    if (move.piece === 'k') {
        const moves = chess.moves({ square: move.from });
        return moves.length === 1
            ? `${subject} ${pName}${getRo(pName)}만 체크를 피해야 하는 강제수입니다.`
            : `${subject} ${pName}${getRo(pName)} 체크를 피합니다.`;
    }
    return `${subject} ${pName}${getRo(pName)} 체크를 차단합니다.`;
}

function handleCapture(chess: Chess, move: Move, pName: string, opp: string, subject: string, isCheck: boolean): string {
    const capName = pieceNames[move.captured as PieceSymbol];
    const history = chess.history({ verbose: true });
    const last = history[history.length - 1];
    const isRecapture = last && last.to === move.to && last.captured;
    const toSq = move.to;

    let res = `${opp}의 ${toSq} ${capName}${getUl(capName)}`;
    if (isRecapture) {
        res = `${res} 회수합니다.`;
    } else {
        res = `${res} 잡았습니다.`;
    }

    res = `${subject} ${pName}${getRo(pName)} ${res}`;

    if (isCheck) res = res.replace("잡았습니다.", "잡고 체크합니다.");
    return res;
}

function handleGeneralMove(chess: Chess, move: Move, pName: string, subject: string): string {
    const isInitial = !chess.history({ verbose: true }).some(m => m.piece === move.piece && m.from === move.from);
    return isInitial
        ? `${subject} ${pName}${getUl(pName)} ${move.to}로 전개했습니다.`
        : `${subject} ${pName}${getUl(pName)} ${move.to}로 이동했습니다.`;
}

function combineDefenseAttack(defLine: string, attLine: string, subject: string): string {
    const stripSubject = (s: string) => s.replace(new RegExp(`^${subject}\\s*`), '').trim();
    const clean = (s: string) => stripSubject(s).replace(/\.$/, '').trim();

    const defBody = clean(defLine);
    const attBody = clean(attLine);

    const pieceMatch = defBody.match(/^([^\s]+로)\s+(.*)$/);
    const pieceWord = pieceMatch ? pieceMatch[1] : "";
    const defRest = pieceMatch ? pieceMatch[2] : defBody;

    let attRest = attBody;
    if (pieceWord && attRest.startsWith(`${pieceWord} `)) {
        attRest = attRest.slice(pieceWord.length + 1);
    }

    const left = defRest.replace(/보호합니다?$/, '보호하며').replace(/합니다?$/, '하며');
    const right = attRest.replace(/합니다?$/, '합니다');

    return `${subject} ${pieceWord ? pieceWord + ' ' : ''}${left} ${right}.`;
}

function getNewlyDefended(prev: Chess, post: Chess, move: Move, subject: string): string | null {
    const before = getControlledSquares(prev, move.from as Square, move.piece, move.color);
    const after = getControlledSquares(post, move.to as Square, move.piece, move.color);
    const oppColor = move.color === 'w' ? 'b' : 'w';

    for (const sq of after) {
        if (before.has(sq)) continue; // 새롭게 닿는 집만
        const piece = post.get(sq as Square);
        if (!piece || piece.color !== move.color) continue; // 우리 말만 보호 대상으로
        if (!isSquareAttackedByColor(post, sq as Square, oppColor)) continue; // 실제로 공격받는 경우만
        const targetName = pieceNames[piece.type];
        return `${subject} ${pieceNames[move.piece]}${getRo(pieceNames[move.piece])} ${sq} ${targetName}${getUl(targetName)} 보호합니다.`;
    }

    return null;
}

function getNewlyAttacked(prev: Chess, post: Chess, move: Move, oppName: string, subject: string, pName: string, mode: 'line1' | 'line2' = 'line2'): string | null {
    const beforeTargets = getAttackedOpponentSquares(prev, move.from as Square, move.piece, move.color);
    const afterTargets = getAttackedOpponentSquares(post, move.to as Square, move.piece, move.color);

    for (const sq of afterTargets) {
        if (beforeTargets.has(sq)) continue;
        const piece = post.get(sq as Square);
        if (!piece || piece.color === move.color) continue;
        const targetName = pieceNames[piece.type];
        if (mode === 'line1') {
            return `${subject} ${pName}${getRo(pName)} ${oppName}의 ${sq} ${targetName}${getUl(targetName)} 공격합니다.`;
        }
        return `${subject} ${pName}${getUl(pName)} ${oppName}의 ${sq} ${targetName}${getUl(targetName)} 공격합니다.`;
    }

    return null;
}

function getAttackedOpponentSquares(chess: Chess, from: Square, piece: PieceSymbol, color: 'w' | 'b'): Set<string> {
    const controlled = getControlledSquares(chess, from, piece, color);
    const targets = new Set<string>();
    controlled.forEach(sq => {
        const pieceAt = chess.get(sq as Square);
        if (pieceAt && pieceAt.color !== color) targets.add(sq);
    });
    return targets;
}

function getControlledSquares(chess: Chess, from: Square, piece: PieceSymbol, color: 'w' | 'b'): Set<string> {
    const targets = new Set<string>();
    if (!chess.get(from)) return targets;

    const dirs = {
        knight: [
            [1, 2], [2, 1], [2, -1], [1, -2],
            [-1, -2], [-2, -1], [-2, 1], [-1, 2],
        ],
        bishop: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
        rook: [[1, 0], [-1, 0], [0, 1], [0, -1]],
        king: [
            [1, 1], [1, 0], [1, -1],
            [0, 1], [0, -1],
            [-1, 1], [-1, 0], [-1, -1],
        ]
    };

    const step = (sq: Square, df: number, dr: number): Square | null => {
        const file = sq.charCodeAt(0) + df;
        const rank = parseInt(sq[1]) + dr;
        if (file < 97 || file > 104 || rank < 1 || rank > 8) return null;
        return `${String.fromCharCode(file)}${rank}` as Square;
    };

    const addSquare = (sq: Square | null) => {
        if (!sq) return;
        targets.add(sq);
    };

    switch (piece) {
        case 'n':
            dirs.knight.forEach(([df, dr]) => addSquare(step(from, df, dr)));
            break;
        case 'b':
            dirs.bishop.forEach(([df, dr]) => {
                let sq = step(from, df, dr);
                while (sq) {
                    targets.add(sq);
                    if (chess.get(sq)) break;
                    sq = step(sq, df, dr);
                }
            });
            break;
        case 'r':
            dirs.rook.forEach(([df, dr]) => {
                let sq = step(from, df, dr);
                while (sq) {
                    targets.add(sq);
                    if (chess.get(sq)) break;
                    sq = step(sq, df, dr);
                }
            });
            break;
        case 'q':
            dirs.bishop.forEach(([df, dr]) => {
                let sq = step(from, df, dr);
                while (sq) {
                    targets.add(sq);
                    if (chess.get(sq)) break;
                    sq = step(sq, df, dr);
                }
            });
            dirs.rook.forEach(([df, dr]) => {
                let sq = step(from, df, dr);
                while (sq) {
                    targets.add(sq);
                    if (chess.get(sq)) break;
                    sq = step(sq, df, dr);
                }
            });
            break;
        case 'k':
            dirs.king.forEach(([df, dr]) => addSquare(step(from, df, dr)));
            break;
        case 'p':
            const dir = color === 'w' ? 1 : -1;
            addSquare(step(from, 1, dir));
            addSquare(step(from, -1, dir));
            break;
    }

    return targets;
}

function isSquareAttackedByColor(chess: Chess, square: Square, attackerColor: 'w' | 'b'): boolean {
    for (const sq of allSquares()) {
        const piece = chess.get(sq as Square);
        if (!piece || piece.color !== attackerColor) continue;
        const controlled = getControlledSquares(chess, sq as Square, piece.type as PieceSymbol, attackerColor);
        if (controlled.has(square)) return true;
    }
    return false;
}

function allSquares(): Square[] {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
    const res: Square[] = [];
    for (const f of files) for (const r of ranks) res.push(`${f}${r}` as Square);
    return res;
}

// --- 전술 판별 헬퍼 스터브 (프로젝트 사양에 따라 확장) ---
function getForkTargets(c: Chess, m: Move): Array<{ square: Square; piece: PieceSymbol }> {
    const targets = getAttackedOpponentSquares(c, m.to as Square, m.piece, m.color);
    const res: Array<{ square: Square; piece: PieceSymbol }> = [];
    targets.forEach(sq => {
        const piece = c.get(sq as Square);
        if (piece) res.push({ square: sq as Square, piece: piece.type as PieceSymbol });
    });
    return res;
}
function getForkScenario(c: Chess, m: Move): { targets: Array<{ square: Square; piece: PieceSymbol }>; via?: Square | null } {
    const value: Record<PieceSymbol, number> = { k: 1000, q: 9, r: 5, b: 3, n: 3, p: 1 };
    const score = (ts: Array<{ square: Square; piece: PieceSymbol }>) => ts.reduce((s, t) => s + (value[t.piece] || 0), 0);

    let bestTargets = getForkTargets(c, m);
    let bestVia: Square | null = null;
    let bestScore = score(bestTargets);

    const potentialCaps = Array.from(getAttackedOpponentSquares(c, m.to as Square, m.piece, m.color));
    for (const capSq of potentialCaps) {
        const pieceAt = c.get(capSq as Square);
        if (!pieceAt || pieceAt.color === m.color) continue;
        const sim = new Chess(c.fen());
        const moveInput: any = { from: m.to, to: capSq };
        if (m.piece === 'p' && (capSq.endsWith('1') || capSq.endsWith('8'))) moveInput.promotion = 'q';
        let moved: Move | null = null;
        try {
            moved = sim.move(moveInput);
        } catch {
            moved = null; // pinned 등으로 불법 수면 무시
        }
        if (!moved) continue;
        const simMove = moved as Move;
        const targets = getForkTargets(sim, simMove);
        if (targets.length < 2) continue;
        const sc = score(targets);

        if (sc > bestScore) {
            bestScore = sc;
            bestTargets = targets;
            bestVia = capSq as Square;
        }
    }

    return { targets: bestTargets, via: bestVia };
}
function formatForkThreat(targets: Array<{ square: Square; piece: PieceSymbol }>, oppName: string, via: Square | null | undefined, pName: string, move: Move): string {
    if (targets.length < 2) return "";
    const value: Record<PieceSymbol, number> = { k: 1000, q: 9, r: 5, b: 3, n: 3, p: 1 };
    const sorted = [...targets].sort((a, b) => value[b.piece] - value[a.piece]);
    const [t1, t2] = sorted;
    const name1 = pieceNames[t1.piece];
    const name2 = pieceNames[t2.piece];
    const label1 = `${name1}(${t1.square})`;
    const label2 = `${name2}(${t2.square})`;
    const joiner = getWa(name1);
    if (via) {
        const pieceSan = move.piece === 'p' ? '' : move.piece.toUpperCase();
        const san = `${pieceSan}x${via}`;
        return `${san}로 ${oppName}의 ${label1}${joiner} ${label2}를 동시에 노리는 포크 위협이 있습니다.`;
    }
    // 즉시 포크한 경우 line2에는 별도 메시지를 넣지 않음.
    return "";
}
function isFork(c: Chess, m: Move): boolean { return getForkTargets(c, m).length >= 2; }
function isProtected(c: Chess, sq: Square): boolean { return true; }
function isAttacked(c: Chess, sq: Square, color: 'w' | 'b'): boolean { return isSquareAttackedByColor(c, sq, color === 'w' ? 'b' : 'w'); }
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
function getOpenedLines(prev: Chess, post: Chess, m: Move): string {
    const color = m.color;
    const from = m.from as Square;
    const diagonals: Array<[number, number]> = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    const orthogonals: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const opened = new Set<PieceSymbol>();

    const step = (sq: Square, df: number, dr: number): Square | null => {
        const file = sq.charCodeAt(0) + df;
        const rank = parseInt(sq[1]) + dr;
        if (file < 97 || file > 104 || rank < 1 || rank > 8) return null;
        return `${String.fromCharCode(file)}${rank}` as Square;
    };

    const findFirstPiece = (board: Chess, start: Square, df: number, dr: number) => {
        let sq = step(start, df, dr);
        while (sq) {
            const piece = board.get(sq);
            if (piece) return { square: sq as Square, piece };
            sq = step(sq as Square, df, dr);
        }
        return null;
    };

    const scan = (vectors: Array<[number, number]>, allowed: PieceSymbol[]) => {
        for (const [df, dr] of vectors) {
            const sliderInfo = findFirstPiece(prev, from, df, dr);
            if (!sliderInfo) continue;
            const { square: sliderSq, piece: sliderPiece } = sliderInfo;
            if (sliderPiece.color !== color || !allowed.includes(sliderPiece.type as PieceSymbol)) continue;

            const firstFromSliderPrev = findFirstPiece(prev, sliderSq, -df, -dr);
            if (!firstFromSliderPrev || firstFromSliderPrev.square !== from) continue;

            const firstFromSliderPost = findFirstPiece(post, sliderSq, -df, -dr);
            if (firstFromSliderPost && firstFromSliderPost.square === (m.to as Square)) continue;

            opened.add(sliderPiece.type as PieceSymbol);
        }
    };

    scan(diagonals, ['b', 'q']);
    scan(orthogonals, ['r', 'q']);

    if (!opened.size) return "";

    const openedNames = Array.from(opened)
        .map(p => pieceNames[p])
        .filter(Boolean);

    if (!openedNames.length) return "";

    const label = openedNames.length === 1
        ? openedNames[0]
        : openedNames
            .map((name, idx) => idx === openedNames.length - 1 ? name : `${name}${getWa(name)}`)
            .join(' ');

    return `${label}의 길이 열렸습니다.`;
}
