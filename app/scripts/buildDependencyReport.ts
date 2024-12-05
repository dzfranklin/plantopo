#!/bin/sh
':' //; exec npm --prefix "$(dirname "$0")" exec tsx "$0" "$@"

import type { ModuleInfos } from 'license-checker-rseidelsohn';
import * as checker from 'license-checker-rseidelsohn';
import path from 'node:path';
import fs from 'node:fs';

const start = performance.now();

const projectPath = path.resolve(import.meta.dirname, '..');
const outPath = path.join(projectPath, 'dependencyReport.json');

console.log(`Building dependency report [projectPath=${projectPath}]`);

interface ReportEntry {
  name: string;
  publisher?: string;
  licenses: string[];
  repository?: string;
}

function buildReport(moduleInfos: ModuleInfos): ReportEntry[] {
  return Object.entries(moduleInfos)
    .sort(([n1], [n2]) => (n1 < n2 ? -1 : n1 > n2 ? 1 : 0))
    .map(([name, v]) => ({
      name,
      publisher: v.publisher,
      licenses:
        typeof v.licenses === 'string' ? [v.licenses] : (v.licenses ?? []),
      repository: v.repository,
    }));
}

checker.init(
  {
    start: projectPath,
  },
  (err: Error, moduleInfos) => {
    if (err) throw err;

    const report = buildReport(moduleInfos);
    const serialized = JSON.stringify(report, null, 2);
    fs.writeFileSync(outPath, serialized);

    const elapsed = performance.now() - start;

    console.log(
      `Wrote report to ${outPath} in ${(elapsed / 1000).toFixed(3)}s (${report.length} entries)`,
    );
  },
);
