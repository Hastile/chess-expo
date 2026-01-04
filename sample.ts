// Chess opening DB collector (Korean prompts). Stores full SAN history in positions.san.
process.env.NODE_NO_WARNINGS = process.env.NODE_NO_WARNINGS ?? '1';
// eslint-disable-next-line @typescript-eslint/no-empty-function
process.emitWarning = () => { };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DatabaseSync } = require('node:sqlite');

import { Chess } from 'chess.js';
import path from 'node:path';
import { stdin, stdout } from 'node:process';
import readline from 'node:readline/promises';

type PositionRow = {
    fen: string;
    san: string | null;
    name_ko: string | null;
    name_en: string | null;
    eval: number;
};

type MoveRow = {
    id: number;
    parent_fen: string;
    move_san: string;
    name: string | null;
    type: string | null;
    priority: number | null;
    branches: string | null;
};

const DB_PATH = path.join(__dirname, 'assets', 'chessDB.sqlite');

const rl = readline.createInterface({ input: stdin, output: stdout });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

const selectPosition = db.prepare('SELECT fen, san, name_ko, name_en, eval FROM positions WHERE fen = ?');
const insertPosition = db.prepare('INSERT INTO positions (fen, san, name_ko, name_en, eval) VALUES (?, ?, ?, ?, ?)');
const updatePosition = db.prepare('UPDATE positions SET san = ?, name_ko = ?, name_en = ?, eval = ? WHERE fen = ?');
const selectMoves = db.prepare(
    'SELECT id, parent_fen, move_san, name, type, priority, branches FROM moves WHERE parent_fen = ? ORDER BY priority, id',
);
const selectMove = db.prepare(
    'SELECT id, name, type, priority, branches FROM moves WHERE parent_fen = ? AND move_san = ? LIMIT 1',
);
const insertMove = db.prepare(
    'INSERT INTO moves (parent_fen, move_san, name, type, priority, branches) VALUES (?, ?, ?, ?, ?, ?)',
);
const updateMove = db.prepare('UPDATE moves SET name = ?, type = ?, priority = ?, branches = ? WHERE id = ?');

const normalizeFen = (fen: string) => fen.split(' ').slice(0, 3).join(' ');

const prompt = async (message: string, defaultValue = '') => {
    const answer = (await rl.question(`${message}${defaultValue ? ` [${defaultValue}]` : ''}: `)).trim();
    return answer.length ? answer : defaultValue;
};

const promptCancelable = async (message: string, defaultValue = ''): Promise<string | null> => {
    const answer = await prompt(`${message} (취소: cancel)`, defaultValue);
    const lower = answer.toLowerCase();
    if (lower === 'cancel' || lower === '취소') return null;
    return answer;
};

const getPosition = (fen: string) => selectPosition.get(fen) as PositionRow | undefined;

const ensurePositionExists = (fen: string): PositionRow => {
    const existing = getPosition(fen);
    if (existing) return existing;
    insertPosition.run(fen, null, null, null, 0);
    return getPosition(fen)!;
};

const upsertMove = (parentFen: string, moveSan: string, name: string, type: string, priority: number) => {
    const existing = selectMove.get(parentFen, moveSan) as MoveRow | undefined;
    if (existing) {
        updateMove.run(name, type, priority, existing.branches ?? '[]', existing.id);
    } else {
        insertMove.run(parentFen, moveSan, name, type, priority, '[]');
    }
};

const nextPriority = (parentFen: string) => {
    const row = db.prepare('SELECT MAX(priority) as maxP FROM moves WHERE parent_fen = ?').get(parentFen) as {
        maxP: number | null;
    };
    return row?.maxP ? Number(row.maxP) + 1 : 1;
};

const formatMoves = (history: string[]) => {
    const lines: string[] = [];
    for (let i = 0; i < history.length; i += 2) {
        const moveNumber = Math.floor(i / 2) + 1;
        const white = history[i];
        const black = history[i + 1];
        lines.push(`${moveNumber}. ${white}${black ? ` ${black}` : ''}`);
    }
    return lines.join(' ');
};

const cleanSanList = (input: string) =>
    input
        .trim()
        .split(/\s+/)
        .map((m) => m.replace(/\d+\.+/g, '').trim())
        .filter(Boolean);

const tryUndoTo = (chess: Chess, targetRaw: string) => {
    const target = cleanSanList(targetRaw);
    if (!target.length) return false;

    // 뒤에서부터 target과 일치하는 구간이 보일 때까지 undo
    while (chess.history().length > 0) {
        const history = chess.history();
        const suffix = history.slice(-target.length);
        const matches = suffix.length === target.length && suffix.every((m, idx) => m === target[idx]);
        if (matches) return true;
        chess.undo();
    }
    return false;
};

const printPosition = (fen: string, history: string[]) => {
    const pos = getPosition(fen);
    const moves = selectMoves.all(fen) as MoveRow[];
    console.log('\n--- 현재 포지션 ---');
    console.log(`FEN: ${fen}`);
    if (pos) {
        console.log(`이름 (ko/en): ${pos.name_ko ?? '-'} / ${pos.name_en ?? '-'}`);
        console.log(`저장된 SAN: ${pos.san ?? '-'}`);
        console.log(`Eval: ${pos.eval ?? 0}`);
    } else {
        console.log('메타데이터 없음.');
    }
    if (moves.length) {
        console.log('기록된 다음 수:');
        for (const m of moves) {
            console.log(
                `  - ${m.move_san} (${m.name ?? '이름 없음'}, type=${m.type ?? 'book'}, priority=${m.priority ?? 1})`,
            );
        }
    } else {
        console.log('기록된 수 없음.');
    }
    console.log('-------------------\n');
};

const parseEval = (value: string, fallback: number) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const promptAndSave = async (
    parentFen: string,
    childFen: string,
    moveSan: string,
    parentRow: PositionRow,
    history: string[],
): Promise<boolean> => {
    const childRow = getPosition(childFen);
    const existingMove = selectMove.get(parentFen, moveSan) as MoveRow | undefined;
    const historyText = formatMoves(history);

    // Already has metadata: just ensure san/move link updated
    if (
        childRow &&
        childRow.name_ko &&
        childRow.name_en &&
        existingMove &&
        existingMove.type &&
        existingMove.priority
    ) {
        updatePosition.run(historyText, childRow.name_ko, childRow.name_en, childRow.eval, childFen);
        upsertMove(parentFen, moveSan, childRow.name_ko || childRow.name_en || moveSan, existingMove.type, existingMove.priority);
        return true;
    }

    const needPrompt =
        !childRow ||
        !childRow.name_ko ||
        !childRow.name_en ||
        !existingMove ||
        !existingMove.type ||
        !existingMove.priority;

    const defaultKo = childRow?.name_ko ?? parentRow.name_ko ?? '';
    const defaultEn = childRow?.name_en ?? parentRow.name_en ?? '';
    const defaultEval = childRow?.eval ?? parentRow.eval ?? 0;
    const defaultType = existingMove?.type ?? 'book';
    const defaultPriority = existingMove?.priority ?? nextPriority(parentFen);

    let nameKo = defaultKo;
    let nameEn = defaultEn;
    const sanValue = historyText; // always full history
    let evalValue = defaultEval;
    let type = defaultType;
    let priority = defaultPriority;

    if (needPrompt) {
        const ko = await promptCancelable('다음 수 이름 (ko, 없으면 Enter)', defaultKo);
        if (ko === null) return false;
        nameKo = ko;

        const en = await promptCancelable('다음 수 이름 (en, 없으면 Enter)', defaultEn);
        if (en === null) return false;
        nameEn = en;

        const ev = await promptCancelable('다음 수 eval (숫자)', `${defaultEval}`);
        if (ev === null) return false;
        evalValue = parseEval(ev, defaultEval);

        const t = await promptCancelable('type', defaultType);
        if (t === null) return false;
        type = t;
    }

    if (!childRow) {
        insertPosition.run(childFen, sanValue || null, nameKo || null, nameEn || null, evalValue);
    } else {
        updatePosition.run(sanValue || null, nameKo || null, nameEn || null, evalValue, childFen);
    }

    upsertMove(parentFen, moveSan, nameKo || nameEn || moveSan, type, priority);
    return true;
};

const collectBranch = async (chess: Chess): Promise<boolean> => {
    while (true) {
        const parentFen = normalizeFen(chess.fen());
        const parentRow = ensurePositionExists(parentFen);
        console.clear();
        printPosition(parentFen, chess.history());

        const next = (await rl.question('다음 수 입력 (SAN) | 명령어: back/뒤로, undo <수열>, done/완료, quit/종료: ')).trim();
        if (!next) continue;
        const lower = next.toLowerCase();
        if (lower === 'quit' || lower === '종료') return true;
        if (lower === 'done' || lower === '완료') return false;
        if (lower === 'back' || lower === '뒤로') {
            const undone = chess.undo();
            if (!undone) console.log('되돌릴 수가 없습니다.');
            continue;
        }
        if (lower.startsWith('undo ')) {
            const target = next.slice(5);
            const ok = tryUndoTo(chess, target);
            if (!ok) {
                console.log('해당 수열을 찾을 수 없습니다.');
            } else {
                console.log(`요청한 수열이 나타날 때까지 되돌렸습니다: ${target}`);
            }
            continue;
        }

        const parentBeforeMove = normalizeFen(chess.fen());
        let move;
        try {
            move = chess.move(next);
        } catch (err) {
            move = null;
        }
        if (!move) {
            console.log('잘못된 수입니다. 예: e4, Nf3, Bb5+');
            continue;
        }

        const childFen = normalizeFen(chess.fen());
        const saved = await promptAndSave(parentBeforeMove, childFen, move.san, parentRow, chess.history());
        if (!saved) {
            chess.undo();
            console.log('입력을 취소했습니다. 이전 상태로 돌아갑니다.');
            continue;
        }
        console.log(`수 ${move.san} 및 포지션 정보를 저장했습니다.`);
    }
};

const main = async () => {
    console.log('체스 오프닝 DB 수집기');
    console.log(`DB 경로: ${DB_PATH}`);
    console.log(
        '입력 규칙: SAN을 한 수씩 입력. 명령어: back(되돌리기), undo <수열>(해당 수열이 보일 때까지 되돌리기), done(현재 라인 완료), quit(종료).',
    );

    while (true) {
        console.clear();
        const chess = new Chess();
        const preset = (await prompt('초기 수열 입력 (SAN, 공백 구분, 빈 값은 시작 위치)', '')).trim();
        if (preset.toLowerCase() === 'quit') break;
        if (preset) {
            const presetLower = preset.toLowerCase();
            if (presetLower.startsWith('undo ')) {
                const target = preset.slice(5);
                const ok = tryUndoTo(chess, target);
                if (!ok) {
                    console.log('해당 수열을 찾을 수 없습니다.');
                } else {
                    console.log(`요청한 수열이 나타날 때까지 되돌렸습니다: ${target}`);
                }
            } else {
                const moves = preset.split(/\s+/);
                for (const m of moves) {
                    let applied = null;
                    try {
                        applied = chess.move(m);
                    } catch (err) {
                        applied = null;
                    }
                    if (!applied) {
                        console.log(`"${m}" 수를 적용할 수 없습니다. 시작 위치로 초기화합니다.`);
                        chess.reset();
                        break;
                    }
                }
                // 프리셋 마지막 수 메타데이터 보완
                const last = chess.undo();
                if (last) {
                    const parentFen = normalizeFen(chess.fen());
                    const reapplied = chess.move(last.san);
                    const childFen = normalizeFen(chess.fen());
                    if (reapplied) {
                        const parentRow = ensurePositionExists(parentFen);
                        const saved = await promptAndSave(parentFen, childFen, last.san, parentRow, chess.history());
                        if (!saved) {
                            chess.undo();
                            console.log('입력을 취소했습니다. 이전 상태로 돌아갑니다.');
                        }
                    }
                }
            }
        }
        const quit = await collectBranch(chess);
        if (quit) break;
    }
};

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(() => {
        rl.close();
        db.close();
    });
