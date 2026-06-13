export type SplitDiffRowKind = 'unchanged' | 'added' | 'removed';

export type SplitDiffRow = {
  id: string;
  kind: SplitDiffRowKind;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  oldContent: string;
  newContent: string;
};

export type FileDiff = {
  path: string;
  language: string;
  changed: boolean;
  additions: number;
  deletions: number;
  originalContent: string;
  currentContent: string;
  rows: SplitDiffRow[];
};

export type BuildFileDiffInput = {
  path: string;
  language: string;
  originalContent: string;
  currentContent: string;
};

function splitComparableLines(content: string) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function buildLcsTable(oldLines: string[], newLines: string[]) {
  const table = Array.from(
    { length: oldLines.length + 1 },
    () => Array.from({ length: newLines.length + 1 }, () => 0),
  );

  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      table[oldIndex][newIndex] = oldLines[oldIndex] === newLines[newIndex]
        ? table[oldIndex + 1][newIndex + 1] + 1
        : Math.max(table[oldIndex + 1][newIndex], table[oldIndex][newIndex + 1]);
    }
  }

  return table;
}

export function buildFileDiff(input: BuildFileDiffInput): FileDiff {
  const oldLines = splitComparableLines(input.originalContent);
  const newLines = splitComparableLines(input.currentContent);
  const table = buildLcsTable(oldLines, newLines);
  const rows: SplitDiffRow[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  let additions = 0;
  let deletions = 0;

  function pushRemoved(line: string) {
    deletions += 1;
    rows.push({
      id: `r-${rows.length}`,
      kind: 'removed',
      oldLineNumber: oldIndex + 1,
      newLineNumber: null,
      oldContent: line,
      newContent: '',
    });
    oldIndex += 1;
  }

  function pushAdded(line: string) {
    additions += 1;
    rows.push({
      id: `r-${rows.length}`,
      kind: 'added',
      oldLineNumber: null,
      newLineNumber: newIndex + 1,
      oldContent: '',
      newContent: line,
    });
    newIndex += 1;
  }

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (oldIndex < oldLines.length && newIndex < newLines.length && oldLines[oldIndex] === newLines[newIndex]) {
      rows.push({
        id: `r-${rows.length}`,
        kind: 'unchanged',
        oldLineNumber: oldIndex + 1,
        newLineNumber: newIndex + 1,
        oldContent: oldLines[oldIndex],
        newContent: newLines[newIndex],
      });
      oldIndex += 1;
      newIndex += 1;
      continue;
    }

    if (newIndex >= newLines.length) {
      pushRemoved(oldLines[oldIndex]);
      continue;
    }

    if (oldIndex >= oldLines.length) {
      pushAdded(newLines[newIndex]);
      continue;
    }

    if (table[oldIndex + 1][newIndex] >= table[oldIndex][newIndex + 1]) {
      pushRemoved(oldLines[oldIndex]);
    } else {
      pushAdded(newLines[newIndex]);
    }
  }

  return {
    path: input.path,
    language: input.language,
    changed: input.originalContent !== input.currentContent,
    additions,
    deletions,
    originalContent: input.originalContent,
    currentContent: input.currentContent,
    rows,
  };
}
