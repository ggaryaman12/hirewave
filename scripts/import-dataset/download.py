#!/usr/bin/env python3
"""Download a curated subset of DeepMind code_contests to JSONL.

Run this LOCALLY (it needs network access to huggingface.co, which the build
sandbox does not have). Output feeds scripts/import-dataset/load.ts.

    pip install datasets
    python scripts/import-dataset/download.py --out /tmp/cc.jsonl --limit 200

The dataset is large; streaming avoids a full download. Each emitted row keeps
only the fields transform.ts consumes. CC BY 4.0 requires attribution, which the
loader records on every problem.
"""
import argparse
import json


KEEP = ("name", "description", "source", "difficulty", "cf_rating", "cf_tags",
        "public_tests", "private_tests", "generated_tests")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True, help="output JSONL path")
    parser.add_argument("--limit", type=int, default=200, help="max problems to write")
    parser.add_argument("--skip", type=int, default=0,
                        help="skip the first N qualifying problems (use to continue past a previous run)")
    parser.add_argument("--split", default="train", choices=["train", "valid", "test"])
    parser.add_argument("--max-rating", type=int, default=0,
                        help="skip problems harder than this Codeforces rating (0 = no filter, import ALL difficulties)")
    args = parser.parse_args()

    from datasets import load_dataset  # imported lazily so --help works without the dep

    ds = load_dataset("deepmind/code_contests", split=args.split, streaming=True)

    # The stream order is stable, so --skip lets the NEXT run continue past what
    # you already imported. e.g. run 1: --limit 500; run 2: --skip 500 --limit 500.
    # (load.ts also upserts by slug, so accidental overlap never duplicates.)
    written = 0
    skipped = 0
    with open(args.out, "w", encoding="utf-8") as fh:
        for row in ds:
            if written >= args.limit:
                break
            # Need at least public + private tests to be useful.
            if not row.get("public_tests", {}).get("input"):
                continue
            if not row.get("private_tests", {}).get("input"):
                continue
            if args.max_rating and (row.get("cf_rating") or 0) > args.max_rating:
                continue
            # Skip the first --skip qualifying problems (already imported earlier).
            if skipped < args.skip:
                skipped += 1
                continue
            slim = {k: row.get(k) for k in KEEP}
            fh.write(json.dumps(slim, ensure_ascii=False) + "\n")
            written += 1

    print(f"Wrote {written} problems to {args.out} (skipped first {skipped})")
    print("Next: npx tsx scripts/import-dataset/load.ts", args.out)


if __name__ == "__main__":
    main()
