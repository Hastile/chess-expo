import { getMoveDescription } from "./scripts/getMoveDescription";

const san = "e4 e5 Nf3 Nc6 Bb5"

const result = getMoveDescription(san);

const { line1, line2 } = result;

const output = line2
    ? `${line1}\n${line2}`
    : line1;

console.log(san);
console.log(output);