import fs from 'node:fs';

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const planPath = readArg('plan');
if (!planPath) throw new Error('Missing --plan');
const manifestPath = readArg('manifest') ?? 'data/manifests/sessions.jsonl';
const configPath = readArg('config') ?? 'configs/experiment.local.json';

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8')) as {
  expectedCaptures: number;
  captures: Array<{
    captureId: string;
    subjectId: string;
    sessionGroupId: string;
    dayId: string;
    poseId: string;
    fillPercent: number;
    repetition: number;
  }>;
};

const completed = new Set<string>();
if (fs.existsSync(manifestPath)) {
  for (const line of fs.readFileSync(manifestPath, 'utf8').splitlines?.() ?? fs.readFileSync(manifestPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    if (row.qualityStatus === 'accepted') {
      completed.add(`${row.sessionGroupId}-${row.poseId}-${row.fillPercent}-${row.repetition}`);
    }
  }
}

const next = plan.captures.find((capture) => !completed.has(capture.captureId));
const completeCount = plan.captures.filter((capture) => completed.has(capture.captureId)).length;

console.log(`Progress: ${completeCount}/${plan.expectedCaptures}`);
if (!next) {
  console.log('This session plan is complete.');
  console.log(`Next: python python/inspect_dataset.py --data data/raw --manifest ${manifestPath}`);
  process.exit(0);
}

console.log('');
console.log('NEXT CAPTURE');
console.log(`Fill: ${next.fillPercent}%`);
console.log(`Pose: ${next.poseId}`);
console.log(`Repetition: ${next.repetition}`);
console.log('');
console.log('Before starting:');
console.log('1. Remove yourself and the glass from the sensing path.');
console.log(`2. Measure the glass to exactly ${next.fillPercent}% using the configured capacity.`);
console.log('3. Confirm nobody else is in the sensing area.');
console.log('4. Stand on the marked floor position only when ready to capture.');
console.log('');
console.log('Run:');
console.log(`npm run collector -- --config ${configPath} --subject ${next.subjectId} --session ${next.sessionGroupId} --day ${next.dayId} --pose ${next.poseId} --fill ${next.fillPercent} --repetition ${next.repetition}`);
console.log('');
console.log(`After it finishes, run: npm run experiment:next -- --plan ${planPath}`);
