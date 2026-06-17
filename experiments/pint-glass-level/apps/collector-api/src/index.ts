import dgram from 'node:dgram';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';

const configSchema = z.object({
  udpHost: z.string(),
  udpPort: z.number().int().positive(),
  captureSeconds: z.number().positive(),
  settleSeconds: z.number().nonnegative(),
  cooldownSeconds: z.number().nonnegative(),
  outputDirectory: z.string(),
  manifestPath: z.string(),
  roomId: z.string(),
  glassId: z.string(),
  glassCapacityMl: z.number().positive(),
  transmitterPositionId: z.string(),
  receiverPositionId: z.string(),
  distanceMeters: z.number().positive(),
  minimumPacketsPerSecond: z.number().positive(),
  poses: z.array(z.object({
    id: z.string(),
    height: z.enum(['waist', 'chest', 'mouth']),
    hand: z.enum(['left', 'right']),
    orientationDegrees: z.number()
  }))
});

type Config = z.infer<typeof configSchema>;

type CaptureArgs = {
  subjectId: string;
  sessionGroupId: string;
  dayId: string;
  poseId: string;
  fillPercent: 0 | 25 | 50 | 75 | 100;
  repetition: number;
};

function readArg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function required(name: string): string {
  const value = readArg(name);
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

const configPath = readArg('config') ?? 'configs/experiment.default.json';
const config = configSchema.parse(JSON.parse(fs.readFileSync(configPath, 'utf8'))) as Config;
const args: CaptureArgs = {
  subjectId: required('subject'),
  sessionGroupId: required('session'),
  dayId: required('day'),
  poseId: required('pose'),
  fillPercent: Number(required('fill')) as CaptureArgs['fillPercent'],
  repetition: Number(required('repetition'))
};

if (![0, 25, 50, 75, 100].includes(args.fillPercent)) throw new Error('Invalid fill level');
const pose = config.poses.find((candidate) => candidate.id === args.poseId);
if (!pose) throw new Error(`Unknown pose: ${args.poseId}`);

fs.mkdirSync(config.outputDirectory, { recursive: true });
fs.mkdirSync(path.dirname(config.manifestPath), { recursive: true });

const sessionId = crypto.randomUUID();
const outputPath = path.join(config.outputDirectory, `${sessionId}.jsonl`);
const output = fs.createWriteStream(outputPath, { flags: 'wx' });
const socket = dgram.createSocket('udp4');
let packetCount = 0;
let firstPacketAt = 0;
let lastPacketAt = 0;
let stopped = false;

const startedAt = new Date();
const captureStart = startedAt.getTime() + config.settleSeconds * 1000;
const captureEnd = captureStart + config.captureSeconds * 1000;

console.log(`Session ${sessionId}`);
console.log(`Pose ${pose.id}, fill ${args.fillPercent}%, settle ${config.settleSeconds}s, capture ${config.captureSeconds}s`);

socket.on('message', (buffer, remote) => {
  const now = Date.now();
  if (now < captureStart || now > captureEnd) return;
  if (!firstPacketAt) firstPacketAt = now;
  lastPacketAt = now;
  packetCount += 1;

  let payload: unknown;
  try {
    payload = JSON.parse(buffer.toString('utf8'));
  } catch {
    payload = { encoding: 'base64', data: buffer.toString('base64') };
  }

  output.write(`${JSON.stringify({
    receivedAt: new Date(now).toISOString(),
    remoteAddress: remote.address,
    remotePort: remote.port,
    payload
  })}\n`);
});

function stop(reason: string): void {
  if (stopped) return;
  stopped = true;
  socket.close();
  output.end();

  const endedAt = new Date();
  const measuredSeconds = firstPacketAt && lastPacketAt ? Math.max((lastPacketAt - firstPacketAt) / 1000, 0.001) : config.captureSeconds;
  const packetRateHz = packetCount / measuredSeconds;
  const manifest = {
    sessionId,
    experimentVersion: '0.1.0',
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    subjectId: args.subjectId,
    glassId: config.glassId,
    glassType: 'standard-pint',
    liquidType: 'water',
    fillPercent: args.fillPercent,
    measuredLiquidMl: Math.round(config.glassCapacityMl * args.fillPercent / 100),
    poseId: pose.id,
    repetition: args.repetition,
    sessionGroupId: args.sessionGroupId,
    dayId: args.dayId,
    distanceMeters: config.distanceMeters,
    bodyOrientationDegrees: pose.orientationDegrees,
    glassHand: pose.hand,
    glassHeight: pose.height,
    gripStyle: 'fingers-below-midpoint',
    roomId: config.roomId,
    transmitterPositionId: config.transmitterPositionId,
    receiverPositionId: config.receiverPositionId,
    packetCount,
    sampleRateHz: packetRateHz,
    qualityStatus: packetRateHz >= config.minimumPacketsPerSecond ? 'accepted' : 'repeat',
    stopReason: reason,
    rawFile: outputPath
  };
  fs.appendFileSync(config.manifestPath, `${JSON.stringify(manifest)}\n`);
  console.log(JSON.stringify(manifest, null, 2));
  if (manifest.qualityStatus === 'repeat') process.exitCode = 2;
}

socket.on('error', (error) => {
  console.error(error);
  stop('socket-error');
});

socket.bind(config.udpPort, config.udpHost, () => {
  console.log(`Listening for RuView CSI on udp://${config.udpHost}:${config.udpPort}`);
});

setTimeout(() => stop('completed'), (config.settleSeconds + config.captureSeconds + config.cooldownSeconds) * 1000);
process.on('SIGINT', () => stop('interrupted'));
process.on('SIGTERM', () => stop('terminated'));
