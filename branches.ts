import { DatabaseSync } from 'node:sqlite';
import { Chess } from 'chess.js';

type PositionRow = {
  fen: string;
  name_ko: string | null;
  name_en: string | null;
};

type MoveRow = {
  id: number;
  parent_fen: string;
  move_san: string;
  name: string | null;
};

const DB_PATH = './assets/chessDB.sqlite';

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

const positions = db
  .prepare('SELECT fen, name_ko, name_en FROM positions')
  .all() as PositionRow[];
const positionsMap = new Map<string, PositionRow>();
for (const p of positions) {
  positionsMap.set(normalizeFen(p.fen), p);
}

const moves = db
  .prepare('SELECT id, parent_fen, move_san, name FROM moves')
  .all() as MoveRow[];

const movesByParent = new Map<string, MoveRow[]>();
for (const m of moves) {
  const key = normalizeFen(m.parent_fen);
  if (!movesByParent.has(key)) movesByParent.set(key, []);
  movesByParent.get(key)!.push(m);
}

const updateBranches = db.prepare('UPDATE moves SET branches = ? WHERE id = ?');

const chess = new Chess();
let updated = 0;

for (const move of moves) {
  const parentFen = normalizeFen(move.parent_fen);
  const childFen = deriveChildFen(parentFen, move.move_san, chess);
  if (!childFen) {
    console.warn(`스킵: 자식 FEN 계산 실패 (parent=${parentFen}, san=${move.move_san})`);
    continue;
  }

  const childMoves = movesByParent.get(childFen) ?? [];
  if (!childMoves.length) {
    updateBranches.run('[]', move.id);
    updated += 1;
    continue;
  }

  const parentPos = positionsMap.get(childFen);
  const parentName = parentPos?.name_ko ?? parentPos?.name_en ?? '';

  const seen = new Set<string>();
  const branches: string[] = [];
  for (const childMove of childMoves) {
    const grandChildFen = deriveChildFen(childFen, childMove.move_san, chess);
    const grandChildPos = grandChildFen ? positionsMap.get(grandChildFen) : undefined;
    const childNameKo = grandChildPos?.name_ko ?? '';
    const childNameEn = grandChildPos?.name_en ?? '';
    const childName = childNameKo || childNameEn || childMove.name || childMove.move_san;
    if (parentName && childName === parentName) continue; // 이름이 안 바뀌었으면 생략
    if (seen.has(childName)) continue; // 동일한 이름은 한 번만
    seen.add(childName);
    branches.push(childName);
  }

  updateBranches.run(JSON.stringify(branches), move.id);
  updated += 1;
}

console.log(`branches 갱신 완료: ${updated} rows`);
db.close();

function normalizeFen(fen: string) {
  return fen.split(' ').slice(0, 3).join(' ');
}

function ensureCompleteFen(fen: string) {
  const parts = fen.trim().split(/\s+/);
  if (parts.length >= 6) return fen;
  if (parts.length === 3) {
    return `${parts[0]} ${parts[1]} ${parts[2]} - 0 1`;
  }
  return fen;
}

function deriveChildFen(parentFen: string, san: string, chessInstance: Chess) {
  try {
    chessInstance.load(ensureCompleteFen(parentFen));
  } catch {
    return null;
  }
  try {
    const move = chessInstance.move(san);
    if (!move) return null;
    const fen = chessInstance.fen();
    chessInstance.reset();
    return normalizeFen(fen);
  } catch {
    chessInstance.reset();
    return null;
  }
}
