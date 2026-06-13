# Future DSA Challenge Support

Date: 2026-05-19
Status: Deferred

## Decision

Hirewave can support DSA-style algorithm questions later, but this should not become the next immediate implementation focus.

Current priority remains:

1. Refine realistic debugging challenges.
2. Improve real-project style assessment flows.
3. Strengthen the terminal/sandbox foundation.
4. Keep reports evidence-backed and honest about current MVP boundaries.

DSA should be added only after the core repo-debugging and real-project workflow feels strong.

## Product Positioning

DSA should be one supported assessment format inside Hirewave, not the identity of the platform.

The stronger positioning is:

> Hirewave supports realistic repo tasks and DSA algorithm tasks, both evaluated through an evidence-first, AI-aware workflow.

This keeps the product differentiated from ordinary LeetCode-style platforms.

## Why DSA Still Fits

The current Hirewave loop already maps well to DSA:

```text
Candidate reads problem
-> edits solution file
-> runs tests
-> asks AI for hints if allowed
-> handles edge cases
-> submits
-> hiring team reviews evidence-backed report
```

This is similar to the current debugging flow:

```text
Candidate reads repo task
-> inspects files
-> edits code
-> runs tests
-> asks AI
-> submits
-> hiring team reviews evidence-backed report
```

So DSA can reuse much of the existing platform instead of needing a separate product.

## Recommended Scope When We Pick This Up

Start with a very small DSA MVP:

- TypeScript/JavaScript only.
- One or two original DSA problems.
- Existing candidate room.
- Existing controlled terminal.
- Existing `npm test` command path.
- Evidence-backed report.
- No leaderboard.
- No massive DSA library.
- No copied LeetCode problem text.
- No multi-language judge in the first pass.

## Example First DSA Challenge

Title:

```text
Merge Meeting Windows
```

Scenario:

```text
Given a list of meeting time ranges, merge overlapping or touching intervals and return the normalized schedule.
```

Starter files:

```text
README.md
src/solution.ts
tests/solution.test.ts
```

Candidate command:

```bash
npm test
```

Expected assessment signals:

- Did the candidate understand intervals and edge cases?
- Did they sort before merging?
- Did they handle empty input?
- Did they handle touching intervals?
- Did they reason about time complexity?
- Did they use AI for hints or direct answers?
- Did they verify with tests?

## Data Model Direction

Longer term, introduce challenge kind metadata:

```ts
type ChallengeKind = 'repo_debugging' | 'dsa';
```

This can drive:

- candidate-facing copy
- starter file shape
- runner/test expectations
- report wording
- future rubric selection

For the first DSA experiment, we may be able to use the existing `Challenge`, `ChallengeFile`, `Assessment`, and `FileSnapshot` model without schema changes. Add `kind` only when we need the UI/report/runner to branch cleanly.

## Rubric Direction

There are two options.

### Option 1 - Fast MVP

Reuse the current `ai-collaboration-v1` rubric.

Pros:

- Fastest path.
- Less report-generation change.
- Keeps all challenge types comparable in the short term.

Cons:

- `Architecture Decisions` is less natural for DSA.
- Algorithm reasoning is not explicit enough.

### Option 2 - Better DSA Product

Introduce a new rubric version:

```text
dsa-ai-collaboration-v1
```

Suggested dimensions:

- Problem Understanding
- Edge-Case Coverage
- Algorithm Choice
- Complexity Reasoning
- Implementation Correctness
- Debugging Loop
- AI Supervision
- Communication Clarity

Pros:

- Better fit for DSA.
- More credible for evaluator review.
- Avoids silently changing the meaning of existing reports.

Cons:

- More implementation work.
- Requires report and UI branching.

Recommendation:

Use `dsa-ai-collaboration-v1` when DSA becomes a serious feature. If we only want a quick internal demo, reuse `ai-collaboration-v1` temporarily and label it as temporary.

## What Not To Build First

Avoid starting with:

- multi-language execution
- competitive-programming leaderboard
- large problem bank
- plagiarism engine
- proctoring
- custom judge infrastructure
- company-wide DSA analytics

Those are later platform features. The first DSA pass should prove that Hirewave can evaluate algorithm work with the same evidence-first approach used for real-project tasks.

## Resume Criteria

Pick this back up after:

- the debugging challenge flow is polished
- real-project style challenge support is clearer
- the terminal/sandbox layer is more credible
- report evidence remains stable across challenge formats
- we are ready to add either a new challenge kind or a new rubric version

