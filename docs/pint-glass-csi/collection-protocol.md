# Pint Glass CSI Collection Protocol

## Hardware placement

Place the transmitter and CSI receiver in fixed positions approximately 1.5 meters apart. Mark both positions and the subject position on the floor. Start with the glass and subject near the direct transmitter-receiver path, then compare a side-reflection placement only after the baseline is complete.

Do not move the access point, ESP32, antennas, furniture, or floor markers between training and test captures.

## Operator checklist

- [ ] Correct glass ID selected
- [ ] Water volume measured, not visually estimated
- [ ] Correct subject and session IDs
- [ ] Correct pose and floor marker
- [ ] Correct hand and grip
- [ ] No other people in the sensing area
- [ ] CSI stream is healthy
- [ ] Packet rate is stable
- [ ] Class order was randomized
- [ ] Subject left the sensing path between repetitions
- [ ] Recording was accepted or repeated based on quality

## Stage A, empty versus full

Use poses `chest-right`, `waist-right`, and `mouth-right`.

For each of two independently started sessions, capture 10 repetitions of empty and 10 repetitions of full for each pose. Randomize the order. This produces 120 recordings.

Example command:

```bash
npm run collector -- \
  --config configs/experiment.local.json \
  --subject subject-001 \
  --session session-day1-a \
  --day 2026-06-17 \
  --pose chest-right \
  --fill 100 \
  --repetition 1
```

The collector waits for the settle period, records for the configured duration, writes raw packets, appends the manifest, and marks captures with inadequate packet rate as `repeat`.

## Anti-leakage rules

- Never collect every empty sample first and every full sample second.
- Never use one long capture and split it into independent repetitions.
- Never put recordings from one `sessionGroupId` in both training and test data.
- Do not use condensation, a different glass, or a different grip only for one class.
- Measure and report an RSSI-only baseline before claiming CSI-specific detection.
