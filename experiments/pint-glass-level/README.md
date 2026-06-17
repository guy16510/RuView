# Pint Glass CSI Liquid-Level Experiment

This package tests whether RuView CSI can distinguish liquid levels in one standardized pint glass.

## Scope

The first milestone is deliberately narrow:

- one physical pint glass
- water only
- one room and fixed ESP32 geometry
- empty versus full
- three poses
- two independent sessions
- 120 independently captured recordings

Do not treat adjacent windows from one recording as independent samples. Train and test splits are grouped by `sessionGroupId`.

## Quick start

```bash
cd experiments/pint-glass-level
npm install
python -m pip install -r requirements.txt
cp configs/experiment.default.json configs/experiment.local.json

# Listen for RuView CSI UDP packets and record labeled sessions
npm run collector -- --config configs/experiment.local.json

# Inspect captured data and metadata
python python/inspect_dataset.py --data data/raw --manifest data/manifests/sessions.jsonl

# Train leakage-safe baselines
python python/train_baseline.py --data data/raw --manifest data/manifests/sessions.jsonl
```

## First experiment

For each recording:

1. Remove the glass and subject from the sensing path.
2. Set the measured fill class, empty or full.
3. Randomize class order.
4. Stand on the configured floor marker.
5. Hold the glass in the instructed pose.
6. Remain still for 3 seconds.
7. Capture for 12 seconds.
8. Leave the sensing path before the next repetition.

Collect 10 repetitions per class, per pose, in two sessions:

```text
2 classes x 3 poses x 10 repetitions x 2 sessions = 120 recordings
```

Proceed to 25%, 50%, and 75% only when held-out-session balanced accuracy is at least 80% for empty versus full and beats an RSSI-only baseline by at least 20 percentage points.

## Data policy

Raw captures and generated models are ignored by Git. Keep raw CSI so preprocessing can be reproduced. Synthetic data is allowed for automated tests, but it is not evidence that liquid-level sensing works.

See `docs/pint-glass-csi/` for architecture, hardware placement, and the collection protocol.
