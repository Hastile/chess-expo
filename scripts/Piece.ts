// scripts/Piece.ts
/* ===== Types ===== */
export type Color = "white" | "black";
export type Piece = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
export type Square = `${"a" | "b" | "c" | "d" | "e" | "f" | "g" | "h"}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
export type PiecesMap = Partial<Record<Square, { color: Color; piece: Piece }>>;
export type Turn = "white" | "black";

export type MoveItem = {
    ply: number;
    san: string;
};

export type CheckState = {
    inCheck: boolean;
    checkmated: boolean;
    kingSquare: Square | null;
};

export type Snapshot = {
    pieces: PiecesMap;
    turn: Turn;
    castling: string; // "KQkq" subset or "-"
    ep: Square | "-";
    halfmove: number;
    fullmove: number;
    moveHistory: MoveItem[];
    fenHistory: string[];
    fen: string;

    // UI
    selected: Square | null;
    legalMoves: Square[];

    // history
    past: Omit<Snapshot, "selected" | "legalMoves" | "past" | "future">[];
    future: Omit<Snapshot, "selected" | "legalMoves" | "past" | "future">[];
};

export type MoveState = Snapshot;

/* ===== Utils ===== */
function toCoord(sq: Square) {
    return {
        file: sq.charCodeAt(0) - 97,
        rank: Number(sq[1]) - 1,
    };
}
function makeSquare(file: number, rank: number) {
    const f = String.fromCharCode(97 + file);
    return `${f}${rank + 1}` as Square;
}
export function opposite(turn: Turn): Turn {
    return turn === "white" ? "black" : "white";
}

function clonePieces(p: PiecesMap): PiecesMap {
    return { ...p };
}

/* ===== Path clear ===== */
function isPathClear(pieces: PiecesMap, from: Square, to: Square) {
    const a = toCoord(from);
    const b = toCoord(to);

    const dx = Math.sign(b.file - a.file);
    const dy = Math.sign(b.rank - a.rank);

    let f = a.file + dx;
    let r = a.rank + dy;
    while (f !== b.file || r !== b.rank) {
        const sq = makeSquare(f, r);
        if (pieces[sq]) return false;
        f += dx;
        r += dy;
    }
    return true;
}

/* ===== Attack detection ===== */
export function findKingSquare(pieces: PiecesMap, color: Color): Square | null {
    for (const k in pieces) {
        const sq = k as Square;
        const p = pieces[sq];
        if (p?.color === color && p.piece === "king") return sq;
    }
    return null;
}

export function isSquareAttacked(pieces: PiecesMap, target: Square, byColor: Color): boolean {
    const t = toCoord(target);

    for (const k in pieces) {
        const from = k as Square;
        const p = pieces[from];
        if (!p || p.color !== byColor) continue;

        const a = toCoord(from);
        const df = t.file - a.file;
        const dr = t.rank - a.rank;

        switch (p.piece) {
            case "pawn": {
                const dir = byColor === "white" ? 1 : -1;
                if (dr === dir && Math.abs(df) === 1) return true;
                break;
            }
            case "knight": {
                const ok = (Math.abs(df) === 2 && Math.abs(dr) === 1) || (Math.abs(df) === 1 && Math.abs(dr) === 2);
                if (ok) return true;
                break;
            }
            case "bishop": {
                if (Math.abs(df) === Math.abs(dr) && isPathClear(pieces, from, target)) return true;
                break;
            }
            case "rook": {
                if ((df === 0 || dr === 0) && isPathClear(pieces, from, target)) return true;
                break;
            }
            case "queen": {
                const line = df === 0 || dr === 0 || Math.abs(df) === Math.abs(dr);
                if (line && isPathClear(pieces, from, target)) return true;
                break;
            }
            case "king": {
                if (Math.max(Math.abs(df), Math.abs(dr)) === 1) return true;
                break;
            }
        }
    }
    return false;
}

/* ===== FEN ===== */
const FEN_PIECE: Record<Piece, string> = { king: "k", queen: "q", rook: "r", bishop: "b", knight: "n", pawn: "p" };

function piecesToPlacement(pieces: PiecesMap) {
    const ranks: string[] = [];
    for (let r = 7; r >= 0; r--) {
        let empty = 0; let row = "";
        for (let f = 0; f < 8; f++) {
            const sq = makeSquare(f, r);
            const p = pieces[sq];
            if (!p) { empty++; continue; }
            if (empty) { row += String(empty); empty = 0; }
            const ch = FEN_PIECE[p.piece];
            row += p.color === "white" ? ch.toUpperCase() : ch;
        }
        if (empty) row += String(empty);
        ranks.push(row);
    }
    return ranks.join("/");
}

export function toFEN(state: Pick<MoveState, "pieces" | "turn" | "castling" | "ep" | "halfmove" | "fullmove">) {
    const placement = piecesToPlacement(state.pieces);
    const active = state.turn === "white" ? "w" : "b";
    const castling = state.castling && state.castling !== "" ? state.castling : "-";
    const ep = state.ep ?? "-";
    return `${placement} ${active} ${castling} ${ep} ${state.halfmove} ${state.fullmove}`;
}

/* ===== Init / Reset ===== */
/* ===== Piece Images (기존 유지) ===== */
export const PIECE_IMAGES: Record<Color, Record<Piece, any>> = {
    white: {
        king: require("../assets/images/Units/WhiteKing.webp"),
        queen: require("../assets/images/Units/WhiteQueen.webp"),
        rook: require("../assets/images/Units/WhiteRook.webp"),
        bishop: require("../assets/images/Units/WhiteBishop.webp"),
        knight: require("../assets/images/Units/WhiteKnight.webp"),
        pawn: require("../assets/images/Units/WhitePawn.webp"),
    },
    black: {
        king: require("../assets/images/Units/BlackKing.webp"),
        queen: require("../assets/images/Units/BlackQueen.webp"),
        rook: require("../assets/images/Units/BlackRook.webp"),
        bishop: require("../assets/images/Units/BlackBishop.webp"),
        knight: require("../assets/images/Units/BlackKnight.webp"),
        pawn: require("../assets/images/Units/BlackPawn.webp"),
    },
};

export const INITIAL_PIECES: PiecesMap = {
    a1: { color: "white", piece: "rook" }, b1: { color: "white", piece: "knight" }, c1: { color: "white", piece: "bishop" }, d1: { color: "white", piece: "queen" }, e1: { color: "white", piece: "king" }, f1: { color: "white", piece: "bishop" }, g1: { color: "white", piece: "knight" }, h1: { color: "white", piece: "rook" },
    a2: { color: "white", piece: "pawn" }, b2: { color: "white", piece: "pawn" }, c2: { color: "white", piece: "pawn" }, d2: { color: "white", piece: "pawn" }, e2: { color: "white", piece: "pawn" }, f2: { color: "white", piece: "pawn" }, g2: { color: "white", piece: "pawn" }, h2: { color: "white", piece: "pawn" },
    a8: { color: "black", piece: "rook" }, b8: { color: "black", piece: "knight" }, c8: { color: "black", piece: "bishop" }, d8: { color: "black", piece: "queen" }, e8: { color: "black", piece: "king" }, f8: { color: "black", piece: "bishop" }, g8: { color: "black", piece: "knight" }, h8: { color: "black", piece: "rook" },
    a7: { color: "black", piece: "pawn" }, b7: { color: "black", piece: "pawn" }, c7: { color: "black", piece: "pawn" }, d7: { color: "black", piece: "pawn" }, e7: { color: "black", piece: "pawn" }, f7: { color: "black", piece: "pawn" }, g7: { color: "black", piece: "pawn" }, h7: { color: "black", piece: "pawn" },
};

export function createInitialState(initialPieces: PiecesMap): MoveState {
    const base: MoveState = {
        pieces: clonePieces(initialPieces), turn: "white", castling: "KQkq", ep: "-", halfmove: 0, fullmove: 1, moveHistory: [], fenHistory: [], fen: "", selected: null, legalMoves: [], past: [], future: [],
    };
    const fen0 = toFEN(base);
    base.fen = fen0;
    base.fenHistory = [fen0];
    return base;
}

export function resetGame(initialPieces: PiecesMap): MoveState { return createInitialState(initialPieces); }

function snapCore(s: MoveState) {
    return { pieces: s.pieces, turn: s.turn, castling: s.castling, ep: s.ep, halfmove: s.halfmove, fullmove: s.fullmove, moveHistory: s.moveHistory, fenHistory: s.fenHistory, fen: s.fen };
}

export function undo(state: MoveState): MoveState {
    if (state.past.length === 0) return state;
    const prev = state.past[state.past.length - 1];
    const past = state.past.slice(0, -1);
    return { ...state, ...prev, selected: null, legalMoves: [], past, future: [snapCore(state), ...state.future] };
}

export function redo(state: MoveState): MoveState {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    const future = state.future.slice(1);
    return { ...state, ...next, selected: null, legalMoves: [], past: [...state.past, snapCore(state)], future };
}

export function isPawnPromotion(state: MoveState, from: Square, to: Square): boolean {
    const piece = state.pieces[from];
    if (!piece || piece.piece !== "pawn") return false;
    const { rank } = toCoord(to);
    return (piece.color === "white" && rank === 7) || (piece.color === "black" && rank === 0);
}

/* ===== Castling helpers ===== */
function hasRight(castling: string, ch: string) { return castling !== "-" && castling.includes(ch); }
function stripRights(castling: string, remove: string[]) {
    let s = castling === "-" ? "" : castling;
    for (const ch of remove) s = s.replaceAll(ch, "");
    return s.length ? s : "-";
}

function updateRightsOnMove(castling: string, from: Square, to: Square, mover: { color: Color; piece: Piece }, captured?: { color: Color; piece: Piece }) {
    let next = castling;
    if (mover.piece === "king") next = stripRights(next, mover.color === "white" ? ["K", "Q"] : ["k", "q"]);
    if (mover.piece === "rook") {
        if (from === "h1") next = stripRights(next, ["K"]); if (from === "a1") next = stripRights(next, ["Q"]);
        if (from === "h8") next = stripRights(next, ["k"]); if (from === "a8") next = stripRights(next, ["q"]);
    }
    if (captured?.piece === "rook") {
        if (to === "h1" && captured.color === "white") next = stripRights(next, ["K"]); if (to === "a1" && captured.color === "white") next = stripRights(next, ["Q"]);
        if (to === "h8" && captured.color === "black") next = stripRights(next, ["k"]); if (to === "a8" && captured.color === "black") next = stripRights(next, ["q"]);
    }
    return next;
}

/* ===== SAN (simplified) ===== */
const PIECE_LETTER: Record<Piece, string> = { king: "K", queen: "Q", rook: "R", bishop: "B", knight: "N", pawn: "" };


function buildSan(opts: {
    mover: { piece: Piece; color: Color };
    from: Square; to: Square; capture: boolean;
    isCastle?: "O-O" | "O-O-O";
    check?: boolean; mate?: boolean; // ✅ 체크/메이트 여부 추가
    promotion?: Piece;
}) {
    const prefix = opts.mover.color === "black" ? "... " : "";
    let base = "";
    if (opts.isCastle) { base = opts.isCastle; }
    else if (opts.mover.piece === "pawn") {
        if (opts.capture) base = `${opts.from[0]}x${opts.to}`; else base = opts.to;
    } else {
        base = `${PIECE_LETTER[opts.mover.piece]}${opts.capture ? "x" : ""}${opts.to}`;
    }

    if (opts.promotion) {
        base += "=" + PIECE_LETTER[opts.promotion];
    }

    // ✅ 기호 추가: 메이트가 우선
    if (opts.mate) base += "#";
    else if (opts.check) base += "+";

    return `${prefix}${base}`;
}

/* ===== EP ===== */
function calcEnPassant(from: Square, to: Square, mover: { color: Color; piece: Piece }): Square | "-" {
    if (mover.piece !== "pawn") return "-";
    const a = toCoord(from); const b = toCoord(to);
    if (a.file === b.file && Math.abs(b.rank - a.rank) === 2) {
        return makeSquare(a.file, mover.color === "white" ? a.rank + 1 : a.rank - 1);
    }
    return "-";
}

/* ===== Move simulation ===== */
type SimResult = { pieces: PiecesMap; capture: boolean; isCastle?: "O-O" | "O-O-O"; didEnPassant?: boolean; };

function simulateMove(state: MoveState, from: Square, to: Square, promotion?: Piece): SimResult | null {
    const pieces = state.pieces; const mover = pieces[from]; if (!mover) return null;
    const a = toCoord(from); const b = toCoord(to); const dx = b.file - a.file; const dy = b.rank - a.rank;
    const next = clonePieces(pieces); const target = next[to];

    if (mover.piece === "king" && dy === 0 && Math.abs(dx) === 2) {
        const isWhite = mover.color === "white"; const rank = isWhite ? 0 : 7;
        const fromSq = makeSquare(4, rank); if (from !== fromSq) return null;
        const kingSide = dx === 2;
        const rookFrom = kingSide ? makeSquare(7, rank) : makeSquare(0, rank);
        const rookTo = kingSide ? makeSquare(5, rank) : makeSquare(3, rank);
        const rook = next[rookFrom]; if (!rook || rook.color !== mover.color || rook.piece !== "rook") return null;
        delete next[from]; delete next[rookFrom]; next[to] = mover; next[rookTo] = rook;
        return { pieces: next, capture: false, isCastle: kingSide ? "O-O" : "O-O-O" };
    }
    if (mover.piece === "pawn" && !target && state.ep !== "-" && to === state.ep) {
        if (Math.abs(dx) === 1) {
            const capRank = mover.color === "white" ? b.rank - 1 : b.rank + 1;
            const capSq = makeSquare(b.file, capRank);
            if (next[capSq]?.piece === "pawn") {
                delete next[capSq]; delete next[from]; next[to] = mover;
                return { pieces: next, capture: true, didEnPassant: true };
            }
        }
        return null;
    }
    delete next[from];
    if (mover.piece === "pawn" && (b.rank === 0 || b.rank === 7)) {
        next[to] = { color: mover.color, piece: (promotion || "queen") as Piece };
    } else {
        next[to] = mover;
    }
    return { pieces: next, capture: !!target };
}

function kingSafeAfter(state: MoveState, moverColor: Color, nextPieces: PiecesMap): boolean {
    const kingSq = findKingSquare(nextPieces, moverColor);
    if (!kingSq) return false;
    return !isSquareAttacked(nextPieces, kingSq, opposite(moverColor));
}

/* ===== Legality ===== */
function canCastle(state: MoveState, side: "K" | "Q", color: Color): boolean {
    const rank = color === "white" ? 0 : 7; const kingFrom = makeSquare(4, rank); const king = state.pieces[kingFrom];
    if (!king || king.piece !== "king" || king.color !== color) return false;
    const enemy = opposite(color);
    if (isSquareAttacked(state.pieces, kingFrom, enemy)) return false;
    const kingSide = side === "K";
    const between = kingSide ? [makeSquare(5, rank), makeSquare(6, rank)] : [makeSquare(3, rank), makeSquare(2, rank), makeSquare(1, rank)];
    for (const sq of between) if (state.pieces[sq]) return false;
    const cross = kingSide ? [makeSquare(5, rank), makeSquare(6, rank)] : [makeSquare(3, rank), makeSquare(2, rank)];
    for (const sq of cross) if (isSquareAttacked(state.pieces, sq, enemy)) return false;
    return color === "white" ? hasRight(state.castling, kingSide ? "K" : "Q") : hasRight(state.castling, kingSide ? "k" : "q");
}

function isBasicMoveLegal(state: MoveState, from: Square, to: Square): boolean {
    const pieces = state.pieces; const mover = pieces[from]; if (!mover || mover.color !== state.turn) return false;
    const target = pieces[to]; if (target && target.color === mover.color) return false;
    const a = toCoord(from); const b = toCoord(to); const dx = b.file - a.file; const dy = b.rank - a.rank;
    switch (mover.piece) {
        case "pawn": {
            const dir = mover.color === "white" ? 1 : -1;
            if (dx === 0 && dy === dir && !target) return true;
            if (dx === 0 && dy === dir * 2 && a.rank === (mover.color === "white" ? 1 : 6) && !target && !pieces[makeSquare(a.file, a.rank + dir)]) return true;
            if (Math.abs(dx) === 1 && dy === dir && (target || (state.ep !== "-" && to === state.ep))) return true;
            return false;
        }
        case "rook": return (dx === 0 || dy === 0) && isPathClear(pieces, from, to);
        case "bishop": return Math.abs(dx) === Math.abs(dy) && isPathClear(pieces, from, to);
        case "queen": return (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) && isPathClear(pieces, from, to);
        case "knight": return (Math.abs(dx) === 2 && Math.abs(dy) === 1) || (Math.abs(dx) === 1 && Math.abs(dy) === 2);
        case "king": return (Math.max(Math.abs(dx), Math.abs(dy)) === 1) || (dy === 0 && Math.abs(dx) === 2 && (dx === 2 ? canCastle(state, "K", mover.color) : canCastle(state, "Q", mover.color)));
    }
}

export function getLegalMoves(state: MoveState, from: Square): Square[] {
    const mover = state.pieces[from]; if (!mover || mover.color !== state.turn) return [];
    const res: Square[] = [];
    for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
        const to = makeSquare(f, r); if (isBasicMoveLegal(state, from, to)) {
            const sim = simulateMove(state, from, to);
            if (sim && kingSafeAfter(state, mover.color, sim.pieces)) res.push(to);
        }
    }
    return res;
}

/* ===== Public: press handler ===== */
export function handleSquarePress(state: MoveState, square: Square, promotion?: Piece): MoveState {
    const pieces = state.pieces; const clicked = pieces[square];
    if (!state.selected) {
        if (clicked && clicked.color === state.turn) return { ...state, selected: square, legalMoves: getLegalMoves(state, square) };
        return state;
    }
    const selected = state.selected; const selectedPiece = pieces[selected]!;
    if (clicked && clicked.color === selectedPiece.color) return { ...state, selected: square, legalMoves: getLegalMoves(state, square) };
    if (!state.legalMoves.includes(square)) return { ...state, selected: null, legalMoves: [] };

    const sim = simulateMove(state, selected, square, promotion)!;
    const captureTarget = pieces[square];
    const nextCastling = updateRightsOnMove(state.castling, selected, square, selectedPiece, captureTarget);
    const nextEp = calcEnPassant(selected, square, selectedPiece);
    const nextTurn = opposite(state.turn);
    const nextFullmove = state.turn === "black" ? state.fullmove + 1 : state.fullmove;

    // ✅ 체크/메이트 판별을 위한 임시 상태
    const nextBase = { pieces: sim.pieces, turn: nextTurn, castling: nextCastling, ep: nextEp, halfmove: (selectedPiece.piece === "pawn" || sim.capture ? 0 : state.halfmove + 1), fullmove: nextFullmove };
    const kingSq = findKingSquare(sim.pieces, nextTurn);
    const inCheck = kingSq ? isSquareAttacked(sim.pieces, kingSq, state.turn) : false;

    // 메이트 여부 확인
    let hasMoves = false;
    if (inCheck) {
        for (const s in sim.pieces) {
            if (sim.pieces[s as Square]?.color === nextTurn) {
                // 임시 snapshot 생성하여 getLegalMoves 호출
                const tempState = { ...state, ...nextBase, selected: null, legalMoves: [] };
                if (getLegalMoves(tempState, s as Square).length > 0) { hasMoves = true; break; }
            }
        }
    } else { hasMoves = true; }

    const san = buildSan({ mover: selectedPiece, from: selected, to: square, capture: sim.capture, isCastle: sim.isCastle, check: inCheck, mate: (inCheck && !hasMoves), promotion: promotion });

    const nextCore = { ...nextBase, moveHistory: [...state.moveHistory, { ply: state.fullmove, san }] };
    const nextFen = toFEN(nextCore);
    return { ...state, ...nextCore, fen: nextFen, fenHistory: [...state.fenHistory, nextFen], selected: null, legalMoves: [], past: [...state.past, snapCore(state)], future: [] };
}