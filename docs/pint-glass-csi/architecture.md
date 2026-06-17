# Pint Glass CSI Experiment Architecture

## Goal

Determine whether measured CSI can distinguish the liquid level of one standardized pint glass without allowing session, pose, person, packet rate, or recording order to become shortcuts.

## Existing RuView components reused

- ESP32-S3 or ESP32-C6 CSI firmware
- UDP CSI transport on port 5006
- Existing CSI packet payloads and node metadata
- Existing room calibration and RuView visualization tools
- Existing Python and pretrained-embedding paths for later experiments

The first implementation does not modify the Rust live sensing server. It records the existing UDP stream as an append-only raw dataset and trains offline baselines. This avoids coupling an unvalidated research classifier to production inference.

## Data path

```text
Wi-Fi transmitter
  -> person and glass disturb RF path
  -> ESP32 CSI receiver
  -> RuView UDP stream, default port 5006
  -> TypeScript collector
  -> raw JSONL capture plus session manifest
  -> dataset inspection
  -> grouped feature extraction
  -> baseline classifier
  -> held-out-session report
```

## Recording boundaries

Each repetition creates one raw file and one manifest row. Windowing may be added later, but windows from one recording must remain in the same train, validation, or test split.

## Validation order

1. Empty room
2. Subject without glass
3. Empty glass
4. Full glass
5. Empty versus full classifier
6. Intermediate levels only after the first gate passes
7. Additional subjects, days, and glasses only after the signal is repeatable

## Known gaps

- The generic baseline feature extractor does not yet understand every RuView packet variant semantically.
- RuView embedding extraction is not connected in this first slice.
- There is no guided browser UI yet. The collector is command-line driven.
- No claim of liquid-level detection is valid until real captures pass held-out-session testing.

## Acceptance gate

Proceed beyond empty versus full only when balanced accuracy and macro F1 are both at least 0.80 on independently collected held-out sessions, with no group leakage, and performance is materially better than RSSI-only features.
