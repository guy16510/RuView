#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import balanced_accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


def numbers(value: Any) -> list[float]:
    if isinstance(value, bool):
        return []
    if isinstance(value, (int, float)):
        return [float(value)]
    if isinstance(value, list):
        result: list[float] = []
        for item in value:
            result.extend(numbers(item))
        return result
    if isinstance(value, dict):
        result: list[float] = []
        for key, item in value.items():
            if key not in {'timestamp', 'receivedAt', 'sequence', 'seq'}:
                result.extend(numbers(item))
        return result
    return []


def extract_features(raw_file: str) -> np.ndarray:
    per_packet: list[list[float]] = []
    for line in Path(raw_file).read_text().splitlines():
        if not line.strip():
            continue
        record = json.loads(line)
        values = numbers(record.get('payload'))
        if values:
            per_packet.append(values)
    if not per_packet:
        return np.zeros(12, dtype=float)
    flattened = np.asarray([value for packet in per_packet for value in packet], dtype=float)
    packet_lengths = np.asarray([len(packet) for packet in per_packet], dtype=float)
    return np.asarray([
        len(per_packet),
        flattened.mean(),
        flattened.std(),
        np.median(flattened),
        np.percentile(flattened, 5),
        np.percentile(flattened, 25),
        np.percentile(flattened, 75),
        np.percentile(flattened, 95),
        np.mean(np.abs(np.diff(flattened))) if len(flattened) > 1 else 0,
        packet_lengths.mean(),
        packet_lengths.std(),
        np.mean(np.square(flattened)),
    ], dtype=float)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', required=True)
    parser.add_argument('--manifest', required=True)
    args = parser.parse_args()

    rows = [json.loads(line) for line in Path(args.manifest).read_text().splitlines() if line.strip()]
    df = pd.DataFrame(rows)
    if df.sessionGroupId.nunique() < 2:
        raise SystemExit('At least two independent sessionGroupId values are required')

    x = np.vstack([extract_features(path) for path in df.rawFile])
    y = df.fillPercent.to_numpy()
    groups = df.sessionGroupId.to_numpy()

    splitter = GroupShuffleSplit(n_splits=1, test_size=0.3, random_state=42)
    train_idx, test_idx = next(splitter.split(x, y, groups))
    if set(groups[train_idx]).intersection(groups[test_idx]):
        raise RuntimeError('Session leakage detected')

    models = {
        'logistic-regression': make_pipeline(StandardScaler(), LogisticRegression(max_iter=3000, class_weight='balanced')),
        'random-forest': RandomForestClassifier(n_estimators=300, random_state=42, class_weight='balanced')
    }

    report_dir = Path('reports/baseline')
    report_dir.mkdir(parents=True, exist_ok=True)
    results = {}
    for name, model in models.items():
        model.fit(x[train_idx], y[train_idx])
        predicted = model.predict(x[test_idx])
        results[name] = {
            'balancedAccuracy': balanced_accuracy_score(y[test_idx], predicted),
            'macroF1': f1_score(y[test_idx], predicted, average='macro'),
            'classificationReport': classification_report(y[test_idx], predicted, output_dict=True, zero_division=0),
            'confusionMatrix': confusion_matrix(y[test_idx], predicted).tolist(),
            'trainGroups': sorted(set(groups[train_idx])),
            'testGroups': sorted(set(groups[test_idx]))
        }

    output = report_dir / 'metrics.json'
    output.write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))


if __name__ == '__main__':
    main()
