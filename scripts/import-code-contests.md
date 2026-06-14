# Importing DeepMind `code_contests` into the DSA problem bank

This document describes how to later import a **curated subset** of the
DeepMind `code_contests` dataset into the `DsaTrack` / `DsaTopic` /
`DsaProblem` / `DsaTestCase` tables.

> Status: **documentation only.** Nothing here downloads data or writes to the
> database automatically. Treat every imported problem as `status: 'review'`
> until a human has read the statement and confirmed the tests.

## 1. Source and license

- Repository: <https://github.com/google-deepmind/code_contests>
- HuggingFace dataset: `deepmind/code_contests`
  (<https://huggingface.co/datasets/deepmind/code_contests>)
- License: the problem **statements and tests** are released under
  **CC BY 4.0**. CC BY *requires attribution*. Every imported `DsaProblem`
  MUST store an `attribution` string and, where available, a `sourceUrl`.
- The dataset aggregates problems from competitive-programming sites
  (Codeforces, AtCoder, CodeChef, etc.). Respect each origin site's terms; the
  CC BY license covers the dataset packaging, not necessarily downstream reuse
  of every original site's branding.

## 2. Download (manual, run by a human)

The dataset is large (tens of GB). Pull only what you need with the HuggingFace
`datasets` library. Example (Python, not committed to the repo):

```python
# pip install datasets
from datasets import load_dataset

# Streaming avoids downloading the full dataset at once.
ds = load_dataset("deepmind/code_contests", split="train", streaming=True)

curated = []
for row in ds:
    # Pick a manageable, high-quality subset. Suggested filters:
    #   - difficulty in a target band
    #   - has both public and private tests
    #   - statement language == English
    if row.get("difficulty", 0) and row["public_tests"]["input"]:
        curated.append(row)
    if len(curated) >= 50:   # keep the first import small and reviewable
        break

import json
with open("code_contests_subset.json", "w") as f:
    json.dump(curated, f)
```

Save the curated subset to a local JSON file (e.g. `code_contests_subset.json`).
Do **not** commit the dataset dump into the repo.

## 3. Field mapping

Each `code_contests` row maps to our schema as follows:

| `code_contests` field        | Target column                              | Notes |
| ---------------------------- | ------------------------------------------ | ----- |
| `name`                       | `DsaProblem.title`                         | Trim/normalize. |
| (derived from `name`)        | `DsaProblem.slug`                          | Slugify + dedupe; slug is `@unique`. |
| `description`                | `DsaProblem.statementMd`                   | Markdown body of the statement. |
| (parsed from `description`)  | `DsaProblem.constraintsMd`                 | Optional; extract the constraints section if present. |
| `difficulty`                 | `DsaProblem.difficulty`                    | Map numeric band -> `'easy'`/`'medium'`/`'hard'`. |
| `source` / `cf_*` metadata   | `DsaProblem.sourceUrl`                     | Link back to the origin problem when known. |
| (constant)                   | `DsaProblem.attribution`                   | e.g. `"DeepMind code_contests (CC BY 4.0); original: <site>"`. |
| (parsed from `description`)  | `DsaProblem.inputFormat`                   | Optional; extract the input section. |
| (parsed from `description`)  | `DsaProblem.outputFormat`                  | Optional; extract the output section. |
| n/a                          | `DsaProblem.comparison`                    | Default `'whitespace'`; use `'float'` + `floatEpsilon` only for known floating-point problems. |
| `time_limit`                 | `DsaProblem.timeLimitMs`                   | Convert seconds -> ms; clamp to a sane range (e.g. 1000-5000). |
| `memory_limit_bytes`         | `DsaProblem.memoryLimitMb`                 | Convert bytes -> MB; default 256. |
| `solutions` (a correct one)  | `DsaProblem.referenceSolutionJson`         | Optional; store as `{"language":"...","source":"..."}`. Only keep if verified to pass. |
| (constant)                   | `DsaProblem.status`                        | **Always `'review'` on import.** |

### Tests -> `DsaTestCase`

`code_contests` provides three test groups: `public_tests`, `private_tests`,
and `generated_tests`. Each group is a struct of parallel `input[]` and
`output[]` arrays.

| Source group        | `DsaTestCase.isSample` | Notes |
| ------------------- | ---------------------- | ----- |
| `public_tests`      | `true`  (samples)      | These are the examples shown to candidates. |
| `private_tests`     | `false` (hidden)       | Judge-only correctness tests. |
| `generated_tests`   | `false` (hidden)       | Optional; large/stress cases. Import sparingly. |

For each test:

- `input`  <- the group's `input[i]`
- `expected` <- the group's `output[i]`
- `isSample` per the table above
- `sortOrder` <- a running counter (samples first, then hidden)

> Note our comparison is `'whitespace'` by default (see
> `lib/judge/compare.ts`): it trims trailing whitespace and trailing blank
> lines, so a trailing newline difference is tolerated. For float problems you
> must set `comparison: 'float'` and a suitable `floatEpsilon`.

## 4. Tracks and topics

Imported problems can either:

- attach to a new dedicated track (e.g. `slug: 'code-contests'`,
  `title: 'Code Contests (review)'`), or
- be left with `topicId = null` until a curator files them into an existing
  topic.

Create/find the track and topics the same way `prisma/seed-dsa.js` does
(find-or-create the track by unique `slug`; find-or-create the topic by
`(trackId, title)`).

## 5. Suggested importer skeleton (to be built later)

A future `scripts/import-code-contests.js` (CommonJS, matching the seed style)
would:

1. Read the curated `code_contests_subset.json` from disk (no network).
2. Find-or-create the destination track + topics.
3. For each row: slugify, map fields per the tables above, and
   `prisma.dsaProblem.upsert({ where: { slug }, ... })` with
   `status: 'review'`.
4. Replace `DsaTestCase` rows for the problem (delete-then-create), importing
   `public_tests` as samples and `private_tests` (+ optional
   `generated_tests`) as hidden cases.
5. Print a summary of imported slugs for the human review queue.

## 6. Review checklist before publishing

Before flipping any imported problem from `'review'` to `'published'`:

- [ ] Statement renders correctly as Markdown and reads unambiguously.
- [ ] `attribution` is present and accurate (CC BY 4.0 + original source).
- [ ] At least one reference solution passes all imported tests under the
      configured `comparison` / `floatEpsilon`.
- [ ] Sample vs hidden split is correct (`public_tests` are the only samples).
- [ ] `timeLimitMs` / `memoryLimitMb` are sane for our runner.
