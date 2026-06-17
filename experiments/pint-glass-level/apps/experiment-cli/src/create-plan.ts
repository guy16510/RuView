import fs from 'node:fs';
import path from 'node:path';

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function required(name: string): string {
  const value = readArg(name);
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

function shuffle<T>(items: T[], seed: number): T[] {
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

const subjectId = required('subject');
const sessionGroupId = required('session');
const dayId = required('day');
const output = readArg('output') ?? `data/plans/${sessionGroupId}.json`;
const seed = Number(readArg('seed') ?? Date.now());
const repetitions = Number(readArg('repetitions') ?? 10);
const poses = (readArg('poses') ?? 'chest-right,waist-right,mouth-right').split(',').filter(Boolean);
const fills = (readArg('fills') ?? '0,100').split(',').map(Number);

if (!Number.isInteger(repetitions) || repetitions < 1) throw new Error('Repetitions must be a positive integer');
if (fills.some((fill) => ![0, 25, 50, 75, 100].includes(fill))) throw new Error('Invalid fill level');

const captures = [];
for (const poseId of poses) {
  for (const fillPercent of fills) {
    for (let repetition = 1; repetition <= repetitions; repetition += 1) {
      captures.push({
        captureId: `${sessionGroupId}-${poseId}-${fillPercent}-${repetition}`,
        subjectId,
        sessionGroupId,
        dayId,
        poseId,
        fillPercent,
        repetition,
        status: 'pending'
      });
    }
  }
}

const plan = {
  version: 1,
  createdAt: new Date().toISOString(),
  seed,
  subjectId,
  sessionGroupId,
  dayId,
  expectedCaptures: captures.length,
  captures: shuffle(captures, seed)
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(plan, null, 2)}\n`, { flag: 'wx' });
console.log(`Created ${output}`);
console.log(`Captures: ${captures.length}`);
console.log('Next: npm run experiment:next -- --plan ' + output);
