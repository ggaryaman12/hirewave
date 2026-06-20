# Bulk problem import — DeepMind `code_contests` (CC BY 4.0)

Imports real competitive-programming problems (Codeforces / AtCoder / CodeChef /
…) with their real public + private tests into the DSA bank.

> **License:** the dataset is **CC BY 4.0**, which *requires attribution*. Every
> imported problem stores an `attribution` string and lands as
> `status:'review'` — it is **not shown to candidates** until a human reviews the
> statement and tests and flips it to `published`.

> **Why two steps:** the build/CI sandbox cannot reach `huggingface.co`, so the
> download runs on your machine. The transform + load are plain Node/TS and run
> anywhere.

## 1. Download (local, needs internet)

```bash
pip install datasets
# ALL difficulties (default, no rating cap):
python scripts/import-dataset/download.py --out /tmp/cc.jsonl --limit 500
# or cap difficulty by Codeforces rating:
python scripts/import-dataset/download.py --out /tmp/cc.jsonl --limit 500 --max-rating 1600
```

Writes a slim JSONL (only the fields the transform uses, including `cf_tags`).

## 2. Load into the DB

```bash
npx tsx scripts/import-dataset/load.ts /tmp/cc.jsonl --limit 200
```

Idempotent (upsert by slug). Problems go into the **Imported (CC BY)** track,
bucketed by difficulty, all `status:'review'`.

## 2b. (Optional) Generate hints

Imported problems have no hints. Backfill ORIGINAL model-written hints:

```bash
AI_HINTS_BASE_URL=https://api.openai.com/v1 AI_HINTS_API_KEY=sk-... AI_HINTS_MODEL=gpt-4o-mini \
  npx tsx scripts/dsa/gen-hints.ts --status review --limit 200
```

Algorithmic category tags (`dp`, `graphs`, …) come straight from the dataset's
`cf_tags` and are loaded automatically — no extra step.

## 3. Review + publish

Imported problems are stdin/stdout (no function signature) — the candidate reads
stdin and writes stdout, and the editor shows the plain stdin starter template.
Review each statement (the dataset keeps LaTeX `$…$` inline; the workspace
renderer shows it as text — clean up if needed), confirm a couple of tests, then
set `status='published'`.

## Pieces

- `download.py` — HuggingFace streaming download → JSONL. Run locally.
- `transform.ts` — **pure**, unit-tested (`tests/api/dsa-import-transform.spec.ts`).
  Raw row → normalized problem (slug, statement, difficulty, comparison policy,
  attribution, capped public/private tests).
- `load.ts` — reads JSONL, applies `transform`, upserts via Prisma.
