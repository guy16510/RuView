# Pint Glass CSI Liquid-Level Experiment

This package tests whether RuView CSI can distinguish liquid levels in one standardized pint glass.

## Read this first

You are not training a production model yet. Your first job is to prove that the signal exists.

The experiment is split into four stages:

1. Verify real CSI packets are reaching the collector.
2. Capture one randomized empty-versus-full session.
3. Capture a second independent session.
4. Inspect the dataset and train leakage-safe baselines.

Do not add 25%, 50%, or 75% until empty versus full passes the validation gate.

## What you need

- one CSI-capable ESP32-S3 or ESP32-C6 running the RuView CSI firmware
- one stable Wi-Fi transmitter or access point
- one computer running the RuView receiver and this collector
- one physical pint glass
- water
- a measuring cup or scale
- tape for floor markers
- a room where other people can stay out during capture

Use the same glass, room, ESP32 positions, Wi-Fi channel, and floor marks throughout the first experiment.

## Step 1: Install

From the repository root:

```bash
cd experiments/pint-glass-level
npm install
python -m pip install -r requirements.txt
cp configs/experiment.default.json configs/experiment.local.json
```

Open `configs/experiment.local.json` and confirm:

- `udpPort` matches the RuView CSI stream, normally `5006`
- `glassCapacityMl` matches your actual measured glass capacity
- `distanceMeters` matches your floor markers
- transmitter and receiver position IDs describe the positions you are using

## Step 2: Set up the room

1. Put the transmitter in a fixed location.
2. Put the CSI ESP32 receiver in a fixed location.
3. Place them about 1.5 meters apart for the first test.
4. Mark both device locations with tape.
5. Mark where your feet will go.
6. Mark chest, waist, and mouth glass positions as consistently as practical.
7. Keep furniture and doors in the same state.
8. Keep everyone else out of the sensing area.

Start with your body and glass near the direct transmitter-to-receiver path. Do not move the hardware during the first 120 recordings.

## Step 3: Verify that real CSI is arriving

Start RuView using its normal live ESP32 workflow. The ESP32 should send UDP CSI packets to the computer running this experiment.

Run one throwaway test capture:

```bash
npm run collector -- \
  --config configs/experiment.local.json \
  --subject test-subject \
  --session hardware-test \
  --day 2026-06-17 \
  --pose chest-right \
  --fill 0 \
  --repetition 1
```

Expected result:

- the collector says it is listening on UDP port 5006
- packet count is greater than zero
- `sampleRateHz` is above the configured minimum
- `qualityStatus` is `accepted`
- a raw file appears under `data/raw`
- a manifest row appears in `data/manifests/sessions.jsonl`

Stop here if packet count is zero or quality is `repeat`. Fix the RuView stream, target IP, firewall, Wi-Fi channel, or packet rate before collecting training data.

Delete or ignore the `hardware-test` recording. Do not use it for training.

## Step 4: Measure the glass

Do not assume the glass is exactly 473 ml.

1. Fill the glass to its practical full line.
2. Measure that amount using a kitchen scale or measuring cup.
3. Put the measured capacity in `glassCapacityMl`.
4. For the first experiment, use only:
   - empty, 0%
   - full, 100%

Use water first. Beer adds foam, temperature, bubbles, and condensation, which would make the first result harder to interpret.

## Step 5: Create the first randomized session plan

Create a plan for session one:

```bash
npm run experiment:create-plan -- \
  --subject subject-001 \
  --session session-day1-a \
  --day 2026-06-17 \
  --output data/plans/session-day1-a.json
```

This creates 60 randomized captures:

```text
2 fill levels x 3 poses x 10 repetitions = 60 recordings
```

The random order prevents the model from learning recording order, room drift, or condensation instead of fill level.

## Step 6: Let the CLI tell you what to do next

Run:

```bash
npm run experiment:next -- --plan data/plans/session-day1-a.json
```

It prints:

- the next fill level
- the next pose
- the repetition number
- the exact collector command to run
- the preparation checklist

Copy and run the command it prints.

After the capture finishes, run the same status command again:

```bash
npm run experiment:next -- --plan data/plans/session-day1-a.json
```

Repeat until it says the session is complete.

If a capture returns `qualityStatus: repeat`, do not count it as complete. Fix the problem and run that capture again.

## How to perform every capture

For every recording:

1. Leave the sensing path with the glass.
2. Prepare the exact fill level shown by the CLI.
3. Make sure nobody else is in the area.
4. Start the printed collector command.
5. Wait during the three-second settle countdown.
6. Step onto the same floor marks.
7. Hold the glass in the instructed position.
8. Keep your fingers below the midpoint of the glass.
9. Stay as still as possible during the 12-second capture.
10. Leave the sensing path before the next recording.
11. Empty, refill, or dry the glass as needed.
12. Run `experiment:next` again.

Do not record one long clip and split it later. Each repetition must be physically reset and independently captured.

## Pose definitions

### `chest-right`

- face the same direction every time
- hold the glass in your right hand
- center it near chest height
- keep the arm and grip consistent

### `waist-right`

- use the same foot position and orientation
- hold the glass near waist height
- keep fingers below the midpoint

### `mouth-right`

- raise the glass near your mouth
- do not drink during the recording
- hold still

## Step 7: Create the second independent session

Do not immediately continue the same session ID.

Create a second plan, preferably after a real break or on another day:

```bash
npm run experiment:create-plan -- \
  --subject subject-001 \
  --session session-day2-a \
  --day 2026-06-18 \
  --output data/plans/session-day2-a.json
```

Then use:

```bash
npm run experiment:next -- --plan data/plans/session-day2-a.json
```

Complete all 60 captures again.

You now have:

```text
60 recordings in session one
+ 60 recordings in session two
= 120 recordings total
```

The second session is essential. Without it, the model can memorize the first recording session and give you a fake success result.

## Step 8: Inspect the dataset before training

Run:

```bash
python python/inspect_dataset.py \
  --data data/raw \
  --manifest data/manifests/sessions.jsonl
```

Review `reports/dataset-report/report.md`.

Do not train until the report shows:

- 120 accepted experiment recordings, excluding hardware tests
- two independent session groups
- balanced empty and full counts
- balanced pose counts
- no missing raw files
- no duplicate protocol rows
- stable packet rates

Fix or repeat bad captures before training.

## Step 9: Train the first baselines

Run:

```bash
python python/train_baseline.py \
  --data data/raw \
  --manifest data/manifests/sessions.jsonl
```

The script keeps complete session groups separated. It does not randomly mix windows or recordings from the same session across training and testing.

Results are written to:

```text
reports/baseline/metrics.json
```

Review these fields:

- `balancedAccuracy`
- `macroF1`
- `confusionMatrix`
- `trainGroups`
- `testGroups`

Confirm `trainGroups` and `testGroups` do not overlap.

## Step 10: Decide whether to continue

### Continue to intermediate levels only when

- held-out-session balanced accuracy is at least 0.80
- macro F1 is at least 0.80
- results repeat across independent sessions
- the result is materially better than an RSSI-only baseline
- there is no obvious shortcut or metadata leakage

### Stop and adjust geometry when

- accuracy is near chance
- one pose works but the others fail badly
- performance collapses on the second session
- the model predicts based on packet count or RSSI
- small changes in stance destroy the result

A failed result does not automatically mean liquid sensing is impossible. It may mean the transmitter, receiver, person, and glass geometry is wrong.

## Step 11: Only after empty versus full passes

Create a new plan with all five levels:

```bash
npm run experiment:create-plan -- \
  --subject subject-001 \
  --session five-level-day1 \
  --day 2026-06-20 \
  --fills 0,25,50,75,100 \
  --output data/plans/five-level-day1.json
```

Measure every volume. Do not visually estimate 25%, 50%, or 75%.

Then repeat the same process across at least two independent sessions.

## What is implemented now

- raw UDP CSI capture
- structured metadata
- packet-rate quality gating
- randomized capture-plan generation
- a next-step command that prints the exact next capture
- dataset inspection
- grouped baseline training
- architecture and collection documentation

## What is still missing

- browser-based guided capture UI
- live packet heatmaps and signal diagnostics
- exact semantic parsing for every RuView packet variant
- an RSSI-only comparison report
- motion-only comparison
- RuView pretrained embedding extraction
- model persistence and live inference
- explicit empty-room and no-glass calibration commands
- automated outlier and condensation tracking
- multi-receiver geometry support
- automated tests for the new package

These are follow-up implementation items. They are not prerequisites for the first empty-versus-full feasibility capture, except that the packet schema may need adjustment after inspecting your actual live packets.

## Data policy

Raw captures and generated models must not be committed to Git. Keep raw CSI locally so preprocessing can be reproduced. Synthetic data can test code, but it cannot prove liquid-level sensing works.

See `docs/pint-glass-csi/collection-protocol.md` and `docs/pint-glass-csi/architecture.md` for deeper details.
