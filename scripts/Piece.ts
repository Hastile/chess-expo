import { Color, Piece, PiecesMap, Square } from "@/components/ChessBoard";

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

    const inBoard = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;

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
                // pawn attacks diagonally forward
                if (dr === dir && Math.abs(df) === 1) return true;
                break;
            }
            case "knight": {
                const ok =
                    (Math.abs(df) === 2 && Math.abs(dr) === 1) ||
                    (Math.abs(df) === 1 && Math.abs(dr) === 2);
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
const FEN_PIECE: Record<Piece, string> = {
    king: "k",
    queen: "q",
    rook: "r",
    bishop: "b",
    knight: "n",
    pawn: "p",
};

function piecesToPlacement(pieces: PiecesMap) {
    const ranks: string[] = [];
    for (let r = 7; r >= 0; r--) {
        let empty = 0;
        let row = "";
        for (let f = 0; f < 8; f++) {
            const sq = makeSquare(f, r);
            const p = pieces[sq];
            if (!p) {
                empty++;
                continue;
            }
            if (empty) {
                row += String(empty);
                empty = 0;
            }
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
export function createInitialState(initialPieces: PiecesMap): MoveState {
    const base: MoveState = {
        pieces: clonePieces(initialPieces),
        turn: "white",
        castling: "KQkq",
        ep: "-",
        halfmove: 0,
        fullmove: 1,
        moveHistory: [],
        fenHistory: [],
        fen: "",

        selected: null,
        legalMoves: [],

        past: [],
        future: [],
    };

    const fen0 = toFEN(base);
    base.fen = fen0;
    base.fenHistory = [fen0];
    return base;
}

export function resetGame(initialPieces: PiecesMap): MoveState {
    return createInitialState(initialPieces);
}

function snapCore(s: MoveState) {
    return {
        pieces: s.pieces,
        turn: s.turn,
        castling: s.castling,
        ep: s.ep,
        halfmove: s.halfmove,
        fullmove: s.fullmove,
        moveHistory: s.moveHistory,
        fenHistory: s.fenHistory,
        fen: s.fen,
    };
}

export function undo(state: MoveState): MoveState {
    if (state.past.length === 0) return state;
    const prev = state.past[state.past.length - 1];
    const past = state.past.slice(0, -1);

    return {
        ...state,
        ...prev,
        selected: null,
        legalMoves: [],
        past,
        future: [snapCore(state), ...state.future],
    };
}

export function redo(state: MoveState): MoveState {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    const future = state.future.slice(1);

    return {
        ...state,
        ...next,
        selected: null,
        legalMoves: [],
        past: [...state.past, snapCore(state)],
        future,
    };
}

/* ===== Castling helpers ===== */
function hasRight(castling: string, ch: string) {
    return castling !== "-" && castling.includes(ch);
}
function stripRights(castling: string, remove: string[]) {
    let s = castling === "-" ? "" : castling;
    for (const ch of remove) s = s.replaceAll(ch, "");
    return s.length ? s : "-";
}

function updateRightsOnMove(
    castling: string,
    from: Square,
    to: Square,
    mover: { color: Color; piece: Piece },
    captured?: { color: Color; piece: Piece }
) {
    let next = castling;

    if (mover.piece === "king") {
        next = stripRights(next, mover.color === "white" ? ["K", "Q"] : ["k", "q"]);
    }
    if (mover.piece === "rook") {
        if (from === "h1") next = stripRights(next, ["K"]);
        if (from === "a1") next = stripRights(next, ["Q"]);
        if (from === "h8") next = stripRights(next, ["k"]);
        if (from === "a8") next = stripRights(next, ["q"]);
    }
    if (captured?.piece === "rook") {
        if (to === "h1" && captured.color === "white") next = stripRights(next, ["K"]);
        if (to === "a1" && captured.color === "white") next = stripRights(next, ["Q"]);
        if (to === "h8" && captured.color === "black") next = stripRights(next, ["k"]);
        if (to === "a8" && captured.color === "black") next = stripRights(next, ["q"]);
    }
    return next;
}

/* ===== SAN (simplified) ===== */
const PIECE_LETTER: Record<Piece, string> = {
    king: "K",
    queen: "Q",
    rook: "R",
    bishop: "B",
    knight: "N",
    pawn: "",
};

function buildSan(opts: {
    mover: { piece: Piece; color: Color };
    from: Square;
    to: Square;
    capture: boolean;
    isCastle?: "O-O" | "O-O-O";
}) {
    const prefix = opts.mover.color === "black" ? "... " : "";
    if (opts.isCastle) return `${prefix}${opts.isCastle}`;

    if (opts.mover.piece === "pawn") {
        if (opts.capture) return `${prefix}${opts.from[0]}x${opts.to}`;
        return `${prefix}${opts.to}`;
    }
    return `${prefix}${PIECE_LETTER[opts.mover.piece]}${opts.capture ? "x" : ""}${opts.to}`;
}

/* ===== EP ===== */
function calcEnPassant(from: Square, to: Square, mover: { color: Color; piece: Piece }): Square | "-" {
    if (mover.piece !== "pawn") return "-";
    const a = toCoord(from);
    const b = toCoord(to);
    if (a.file === b.file && Math.abs(b.rank - a.rank) === 2) {
        const epRank = mover.color === "white" ? a.rank + 1 : a.rank - 1;
        return makeSquare(a.file, epRank);
    }
    return "-";
}

/* ===== Move simulation (for king safety + special moves) ===== */
type SimResult = {
    pieces: PiecesMap;
    capture: boolean;
    isCastle?: "O-O" | "O-O-O";
    didEnPassant?: boolean;
};

function simulateMove(state: MoveState, from: Square, to: Square): SimResult | null {
    const pieces = state.pieces;
    const mover = pieces[from];
    if (!mover) return null;

    const a = toCoord(from);
    const b = toCoord(to);
    const dx = b.file - a.file;
    const dy = b.rank - a.rank;

    const next = clonePieces(pieces);
    const target = next[to];

    // castling
    if (mover.piece === "king" && dy === 0 && Math.abs(dx) === 2) {
        const isWhite = mover.color === "white";
        const rank = isWhite ? 0 : 7;
        const fromSq = makeSquare(4, rank); // e1/e8

        if (from !== fromSq) return null;

        const kingSide = dx === 2;
        const rookFrom = kingSide ? makeSquare(7, rank) : makeSquare(0, rank);
        const rookTo = kingSide ? makeSquare(5, rank) : makeSquare(3, rank);

        const rook = next[rookFrom];
        if (!rook || rook.color !== mover.color || rook.piece !== "rook") return null;

        // apply
        delete next[from];
        delete next[rookFrom];
        next[to] = mover;
        next[rookTo] = rook;

        return { pieces: next, capture: false, isCastle: kingSide ? "O-O" : "O-O-O" };
    }

    // en passant capture
    if (mover.piece === "pawn" && !target && state.ep !== "-" && to === state.ep) {
        // pawn moves diagonally to ep square
        if (Math.abs(dx) === 1) {
            const capRank = mover.color === "white" ? b.rank - 1 : b.rank + 1;
            const capSq = makeSquare(b.file, capRank);
            const cap = next[capSq];
            if (cap && cap.piece === "pawn" && cap.color !== mover.color) {
                delete next[capSq];
                delete next[from];
                next[to] = mover;
                return { pieces: next, capture: true, didEnPassant: true };
            }
        }
        return null;
    }

    // normal move / capture
    delete next[from];
    next[to] = mover;

    // (optional) promotion: UI 붙이면 선택하게. 일단 자동 승격은 안 함.
    return { pieces: next, capture: !!target };
}

function kingSafeAfter(state: MoveState, moverColor: Color, nextPieces: PiecesMap): boolean {
    const kingSq = findKingSquare(nextPieces, moverColor);
    if (!kingSq) return false;
    const enemy = moverColor === "white" ? "black" : "white";
    return !isSquareAttacked(nextPieces, kingSq, enemy);
}

/* ===== Legality (incl special) ===== */
function canCastle(state: MoveState, side: "K" | "Q", color: Color): boolean {
    const rank = color === "white" ? 0 : 7;
    const kingFrom = makeSquare(4, rank);
    const king = state.pieces[kingFrom];
    if (!king || king.piece !== "king" || king.color !== color) return false;

    const enemy = color === "white" ? "black" : "white";

    // cannot be in check
    if (isSquareAttacked(state.pieces, kingFrom, enemy)) return false;

    const kingSide = side === "K";
    const rookFrom = kingSide ? makeSquare(7, rank) : makeSquare(0, rank);
    const rook = state.pieces[rookFrom];
    if (!rook || rook.piece !== "rook" || rook.color !== color) return false;

    // squares between empty
    const between = kingSide
        ? [makeSquare(5, rank), makeSquare(6, rank)]
        : [makeSquare(3, rank), makeSquare(2, rank), makeSquare(1, rank)];

    for (const sq of between) {
        if (state.pieces[sq]) return false;
    }

    // squares king crosses must not be attacked
    const cross = kingSide ? [makeSquare(5, rank), makeSquare(6, rank)] : [makeSquare(3, rank), makeSquare(2, rank)];
    for (const sq of cross) {
        if (isSquareAttacked(state.pieces, sq, enemy)) return false;
    }

    // right exists
    if (color === "white") return hasRight(state.castling, kingSide ? "K" : "Q");
    return hasRight(state.castling, kingSide ? "k" : "q");
}

function isBasicMoveLegal(state: MoveState, from: Square, to: Square): boolean {
    const pieces = state.pieces;
    const mover = pieces[from];
    if (!mover || mover.color !== state.turn) return false;

    const target = pieces[to];
    if (target && target.color === mover.color) return false;

    const a = toCoord(from);
    const b = toCoord(to);
    const dx = b.file - a.file;
    const dy = b.rank - a.rank;

    switch (mover.piece) {
        case "pawn": {
            const dir = mover.color === "white" ? 1 : -1;
            const startRank = mover.color === "white" ? 1 : 6;

            // forward 1
            if (dx === 0 && dy === dir && !target) return true;

            // forward 2
            if (dx === 0 && dy === dir * 2 && a.rank === startRank && !target) {
                const mid = makeSquare(a.file, a.rank + dir);
                if (!pieces[mid]) return true;
            }

            // diagonal capture
            if (Math.abs(dx) === 1 && dy === dir && target) return true;

            // en passant capture to ep square (target empty)
            if (Math.abs(dx) === 1 && dy === dir && !target && state.ep !== "-" && to === state.ep) return true;

            return false;
        }

        case "rook":
            if (dx !== 0 && dy !== 0) return false;
            return isPathClear(pieces, from, to);

        case "bishop":
            if (Math.abs(dx) !== Math.abs(dy)) return false;
            return isPathClear(pieces, from, to);

        case "queen":
            if (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) return isPathClear(pieces, from, to);
            return false;

        case "knight":
            return (
                (Math.abs(dx) === 2 && Math.abs(dy) === 1) ||
                (Math.abs(dx) === 1 && Math.abs(dy) === 2)
            );

        case "king": {
            // normal king step
            if (Math.max(Math.abs(dx), Math.abs(dy)) === 1) return true;

            // castling
            if (dy === 0 && Math.abs(dx) === 2) {
                const color = mover.color;
                if (dx === 2) return canCastle(state, "K", color);
                if (dx === -2) return canCastle(state, "Q", color);
            }
            return false;
        }
    }
}

/* ===== Public: legal moves for dots ===== */
export function getLegalMoves(state: MoveState, from: Square): Square[] {
    const mover = state.pieces[from];
    if (!mover || mover.color !== state.turn) return [];

    const res: Square[] = [];
    for (let f = 0; f < 8; f++) {
        for (let r = 0; r < 8; r++) {
            const to = makeSquare(f, r);
            if (!isBasicMoveLegal(state, from, to)) continue;

            const sim = simulateMove(state, from, to);
            if (!sim) continue;

            if (!kingSafeAfter(state, mover.color, sim.pieces)) continue;

            res.push(to);
        }
    }
    return res;
}



/* ===== Public: press handler ===== */
export function handleSquarePress(state: MoveState, square: Square): MoveState {
    const pieces = state.pieces;
    const clicked = pieces[square];

    // 1) select
    if (!state.selected) {
        if (clicked && clicked.color === state.turn) {
            return {
                ...state,
                selected: square,
                legalMoves: getLegalMoves(state, square),
            };
        }
        return state;
    }

    const selected = state.selected;
    const selectedPiece = pieces[selected];

    // 2) switch selection to own piece
    if (clicked && selectedPiece && clicked.color === selectedPiece.color) {
        return {
            ...state,
            selected: square,
            legalMoves: getLegalMoves(state, square),
        };
    }

    // 3) try move (must be legal)
    if (!state.legalMoves.includes(square)) {
        return { ...state, selected: null, legalMoves: [] };
    }

    const mover = selectedPiece!;
    const sim = simulateMove(state, selected, square);
    if (!sim) return { ...state, selected: null, legalMoves: [] };
    if (!kingSafeAfter(state, mover.color, sim.pieces)) {
        return { ...state, selected: null, legalMoves: [] };
    }

    const captureTarget = pieces[square];
    const nextCastling = updateRightsOnMove(state.castling, selected, square, mover, captureTarget);

    // castling move clears rights for that side automatically by updateRightsOnMove (king moved)
    const nextEp = calcEnPassant(selected, square, mover);

    const isCapture = sim.capture;
    const nextHalfmove = mover.piece === "pawn" || isCapture ? 0 : state.halfmove + 1;

    const ply = state.fullmove;
    const nextTurn = opposite(state.turn);
    const nextFullmove = state.turn === "black" ? state.fullmove + 1 : state.fullmove;

    const san = buildSan({
        mover,
        from: selected,
        to: square,
        capture: isCapture,
        isCastle: sim.isCastle,
    });

    const nextMoveHistory = [...state.moveHistory, { ply, san }];

    const nextCore = {
        pieces: sim.pieces,
        turn: nextTurn,
        castling: nextCastling,
        ep: nextEp,
        halfmove: nextHalfmove,
        fullmove: nextFullmove,
        moveHistory: nextMoveHistory,
    };

    const nextFen = toFEN({ ...state, ...nextCore });
    const nextFenHistory = [...state.fenHistory, nextFen];

    return {
        ...state,
        ...nextCore,
        fen: nextFen,
        fenHistory: nextFenHistory,

        selected: null,
        legalMoves: [],

        past: [...state.past, snapCore(state)],
        future: [],
    };
}
