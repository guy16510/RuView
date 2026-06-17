#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

import pandas as pd


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', required=True)
    parser.add_argument('--manifest', required=True)
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    rows = [json.loads(line) for line in manifest_path.read_text().splitlines() if line.strip()]
    df = pd.DataFrame(rows)
    if df.empty:
        raise SystemExit('No capture sessions found')

    required = ['sessionId', 'sessionGroupId', 'subjectId', 'poseId', 'fillPercent', 'packetCount', 'sampleRateHz', 'rawFile']
    missing_columns = [column for column in required if column not in df.columns]
    if missing_columns:
        raise SystemExit(f'Missing manifest columns: {missing_columns}')

    missing_files = [value for value in df['rawFile'] if not Path(value).exists()]
    duplicates = df[df.duplicated(['sessionGroupId', 'poseId', 'fillPercent', 'repetition'], keep=False)]

    report_dir = Path('reports/dataset-report')
    report_dir.mkdir(parents=True, exist_ok=True)
    lines = [
        '# Pint Glass CSI Dataset Report',
        '',
        f'- Recordings: {len(df)}',
        f'- Session groups: {df.sessionGroupId.nunique()}',
        f'- Subjects: {df.subjectId.nunique()}',
        f'- Poses: {df.poseId.nunique()}',
        f'- Missing raw files: {len(missing_files)}',
        f'- Duplicate protocol rows: {len(duplicates)}',
        '',
        '## Fill-class counts',
        '',
        df.fillPercent.value_counts().sort_index().to_markdown(),
        '',
        '## Pose counts',
        '',
        df.poseId.value_counts().to_markdown(),
        '',
        '## Quality summary',
        '',
        df[['packetCount', 'sampleRateHz']].describe().to_markdown(),
    ]
    (report_dir / 'report.md').write_text('\n'.join(lines))
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
