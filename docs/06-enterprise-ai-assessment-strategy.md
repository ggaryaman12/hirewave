# Enterprise AI Assessment Strategy

Date: 2026-05-12
Product name: Hirewave
Strategy: Enterprise-first AI collaboration assessment platform

## Executive decision

Hirewave should be built from day one for enterprise hiring teams that need auditability, compliance, controlled scoring, and defensible candidate comparisons.

The product should not compete with HackerRank, Codility, or CodeSignal as another puzzle-testing platform. The wedge is evaluating how engineers use AI in realistic software work: how they decompose problems, prompt, verify, debug, revise, and make architecture decisions with an AI assistant available.

The v1 product should use one fixed, versioned 8-dimension AI collaboration rubric. Custom rubrics are intentionally out of v1 scope. The fixed rubric keeps reports comparable, keeps scoring validation tractable, and gives enterprise buyers a stable audit trail.

## Product promise

Hirewave should make the assessment workflow feel like three steps:

1. Create a challenge.
2. Share one candidate link.
3. Get an AI-scored collaboration report.

Under that simple surface, the platform must capture and preserve the full candidate process:

- prompts and AI responses
- terminal commands
- file opens, edits, and saves
- test runs and failures
- timing and retries
- final files
- evaluation evidence
- reviewer-visible report metadata

The key output is not pass/fail. The output is a structured, evidence-backed report that helps a hiring team decide what to do next.

## Enterprise-first principles

### Evidence before score

Every score must cite specific evidence from telemetry, commands, tests, AI messages, file snapshots, or final code. A report claim without evidence should be treated as invalid.

### Fixed rubric, versioned forever

The v1 rubric is fixed, but it must still be stored as a versioned internal object. Reports should record the rubric version used at generation time.

Recommended initial value:

```text
ai-collaboration-v1
```

If wording, weighting, or scoring guidance changes later, that must create a new rubric version. Old reports must remain explainable under the rubric that generated them.

### Separate candidate AI and evaluator AI

The candidate assistant helps the candidate work through the challenge. It must not provide hiring scores, hidden evaluator logic, or final recommendations.

The evaluator AI runs after submission. It can see the full session record and generate report evidence, risk flags, and follow-up questions.

These must be separate policies, prompts, logs, and provider calls.

### Provider abstraction over model loyalty

Hirewave should not lock product logic to Ollama, OpenAI, Anthropic, Gemini, or any one model. The app should build a Hirewave-native AI request first, then let adapters translate it to provider-specific payloads.

The current Ollama connection can be used as one provider, but the product contract should be:

- session context
- challenge context
- current workspace files
- recent commands/tests
- recent AI transcript
- fixed rubric metadata
- policy constraints

Only the adapter should know the exact provider transport shape.

### Auditability is a product feature

Enterprise reviewers should be able to answer:

- Which model generated this report?
- Which rubric version was used?
- What evidence supports each score?
- What did the candidate ask AI?
- What did AI answer?
- Did the candidate verify AI output?
- What commands/tests were run?
- What changed between starter and final files?
- Who reviewed or overrode the AI report?

## V1 fixed rubric

The v1 rubric has 8 dimensions.

| Dimension | What it measures | Example evidence |
| --- | --- | --- |
| Problem Decomposition | Can the candidate break complex work into AI-solvable chunks? | Initial prompts, notes, command sequence, ordered fixes |
| First-Principles Thinking | Do they reason from the underlying system instead of pattern-matching? | Prompts that explain domain constraints, code inspections before edits |
| Creative Problem Solving | Do they find useful approaches to prompt construction and debugging? | Alternative strategies, targeted context, non-obvious checks |
| Iteration Quality | Can they refine AI output through useful follow-ups? | Follow-up prompts, corrections, narrowed asks, rejected bad suggestions |
| Debugging with AI | Do they identify and resolve AI-generated or existing issues effectively? | Failed tests, diagnostic commands, AI-assisted debugging loops |
| Architecture Decisions | Do they preserve boundaries and structure code well during AI-assisted work? | Final diff, file boundaries, API/data-flow choices |
| Communication Clarity | Are their prompts precise, contextual, and easy to evaluate? | Prompt specificity, constraints, naming, summaries |
| Token Efficiency | Do they minimize unnecessary context while getting useful output? | Prompt length, repeated prompts, context quality, signal-to-noise |

Each dimension should include:

- score from 1 to 5
- evidence list
- strengths
- concerns
- interviewer follow-up questions

## Report contract

The report should produce this structure:

```json
{
  "rubricVersion": "ai-collaboration-v1",
  "overallRecommendation": "strong_yes | yes | maybe | no | strong_no",
  "overallScore": 0,
  "summary": "",
  "dimensionScores": [
    {
      "dimension": "Problem Decomposition",
      "score": 1,
      "evidence": [],
      "strengths": [],
      "concerns": [],
      "followUpQuestions": []
    }
  ],
  "timelineSummary": "",
  "codeQualitySummary": "",
  "aiUsageSummary": "",
  "sandboxSummary": "",
  "riskFlags": [],
  "nextInterviewFocus": [],
  "modelMetadata": {
    "evaluator": {
      "provider": "deterministic",
      "model": "deterministic-evidence-ai-collaboration-v1",
      "generatedAt": "2026-05-12T00:00:00.000Z"
    },
    "sandbox": {
      "providerIds": ["simulated"],
      "providerKinds": ["simulated"],
      "executionModes": ["simulated"],
      "sandboxRunIds": ["simulated:2f71a4f2-6dd9-4e2d-a6cb-fca24dcde68d"],
      "readinessStatuses": ["demo_only"],
      "capabilityStatuses": {
        "realCodeExecution": ["not_supported"],
        "productionIsolation": ["not_supported"],
        "commandPolicy": ["supported"],
        "networkPolicy": ["not_applicable"],
        "environmentPolicy": ["not_applicable"],
        "resourceLimits": ["not_applicable"],
        "workspaceSnapshots": ["supported"],
        "cleanupEvidence": ["not_applicable"]
      },
      "capabilityGaps": ["productionIsolation", "realCodeExecution"],
      "productionReadyCommandCount": 0,
      "nonProductionReadyCommandCount": 1,
      "isolationLevels": ["none"],
      "networkAccessModes": ["none"],
      "networkPolicyModes": ["none"],
      "networkOutboundAccessModes": ["none"],
      "networkAllowedHosts": [],
      "networkNotBlockedByDefaultCommandCount": 0,
      "networkUnrestrictedCommandCount": 0,
      "filesystemPersistenceModes": ["virtual"],
      "cleanupPolicies": ["not_applicable"],
      "cleanupStatuses": ["not_applicable"],
      "environmentPolicyModes": ["none"],
      "exposedEnvKeys": [],
      "secretsExposedCommandCount": 0,
      "executionTimeoutMsMax": 10000,
      "outputLimitCharsMax": 20000,
      "snapshotFileLimitMax": 200,
      "snapshotContentLimitMax": 100000,
      "memoryLimitMbMax": null,
      "cpuLimitMsMax": null,
      "commandPolicyModes": ["simulated_allowlist"],
      "commandPolicyBlockedCommandCount": 0,
      "commandRunsWithMetadata": 1,
      "snapshotCount": 3,
      "persistedSnapshotCount": 0,
      "skippedSnapshotCount": 0,
      "cleanupFailedCommandCount": 0,
      "cleanupRetainedCommandCount": 0,
      "timedOutCommandCount": 0,
      "outputTruncatedCommandCount": 0,
      "outputChunkCount": 2,
      "outputStreamKinds": ["stdout", "system"],
      "workspaceFileCountMax": 3,
      "workspaceTotalBytesMax": 12000,
      "workspaceFilePaths": ["src/cart.ts", "src/checkout.ts", "src/payment.ts"],
      "workspaceDigests": ["7b9ad8f8c3a3d90c7b9b92d4c1e6db74c9e2d3a40221f0c1f26925a8a2d77210"],
      "workspaceManifestMismatchCommandCount": 0,
      "providerErrorCommandCount": 0,
      "invalidWorkspaceFileCommandCount": 0,
      "externalProviderUnconfiguredCommandCount": 0,
      "totalOutputChars": 420,
      "totalDurationMs": 12
    }
  }
}
```

The schema should remain strict. If the evaluator cannot cite evidence for a score, it should lower confidence or mark the dimension as insufficient evidence instead of inventing a generic assessment.

Sandbox metadata is audit context, not a score by itself. `executionModes`, `sandboxRunIds`, `readinessStatuses`, `capabilityStatuses`, `capabilityGaps`, `isolationLevels`, `networkAccessModes`, `networkPolicyModes`, `networkOutboundAccessModes`, `networkAllowedHosts`, `filesystemPersistenceModes`, `cleanupPolicies`, `cleanupStatuses`, `environmentPolicyModes`, `exposedEnvKeys`, resource-limit max fields, and `commandPolicyModes` describe the evidence boundary used by the command runner; local-dev host-inherited execution should be treated as development evidence, not production isolation. `sandboxRunIds` are provider-attempt handles for mapping report evidence back to raw sandbox execution records. `readinessStatuses`, `productionReadyCommandCount`, and `nonProductionReadyCommandCount` show whether command evidence came from a production-ready provider or from demo-only, local-only, adapter-unconfigured, or otherwise non-production provider paths; `sandbox_not_production_ready` flags any provider evidence that is not explicitly `production_ready`. `capabilityGaps` names unsupported, partial, or unknown provider capabilities across real code execution, production isolation, command policy, network policy, environment policy, resource limits, workspace snapshots, and cleanup evidence. `networkNotBlockedByDefaultCommandCount` and `networkUnrestrictedCommandCount` show whether command evidence came from a provider with outbound network controls missing or unrestricted. `sandbox_not_production_isolated` is a risk flag for `none` or `host_temp_directory` isolation. `cleanupStatuses`, `cleanupFailedCommandCount`, and `cleanupRetainedCommandCount` show whether a provider deleted, retained, failed cleanup, provider-managed cleanup, or had no cleanup obligation for its workspace. `environmentPolicyModes`, `exposedEnvKeys`, and `secretsExposedCommandCount` show which environment keys were exposed to the runner and whether a provider reported leaking server secrets. `executionTimeoutMsMax`, `outputLimitCharsMax`, `snapshotFileLimitMax`, `snapshotContentLimitMax`, `memoryLimitMbMax`, and `cpuLimitMsMax` summarize the configured resource boundary for sandbox-backed command evidence. `commandPolicyBlockedCommandCount` counts commands rejected by provider policy. `outputChunkCount` and `outputStreamKinds` summarize stream-labeled command output evidence (`system`, `stdout`, `stderr`) without relying only on one merged log string. `workspaceFileCountMax`, `workspaceTotalBytesMax`, `workspaceFilePaths`, and `workspaceDigests` summarize the mounted workspace manifest passed to sandbox-backed commands, so reviewers can see which files formed the runner input boundary and verify whether command evidence came from the same workspace input set. `workspaceManifestMismatchCommandCount` counts command runs rejected before execution because the required manifest no longer matched the mounted file payload. `outputTruncatedCommandCount` counts command runs whose output was capped before persistence. `providerErrorCommandCount` counts command runs where the sandbox provider failed before completion, while `invalidWorkspaceFileCommandCount` counts command runs blocked before provider execution because persisted workspace paths failed validation. `externalProviderUnconfiguredCommandCount` counts selected external sandbox runs that failed closed before execution and must not be presented as production isolation. `skippedSnapshotCount` includes provider snapshots rejected for unsafe paths, content size limits, or per-command file count limits.

## AI architecture direction

### Candidate assistant request

The app should construct an internal request like:

```ts
type AiAssistantRequest = {
  sessionId: string;
  candidateMessage: string;
  challenge: {
    title: string;
    role: string;
    instructions: string;
    rubricDimensions: string[];
  };
  workspace: {
    selectedFilePath?: string;
    files: AiFileContext[];
  };
  activity: {
    recentCommands: AiCommandContext[];
    recentAiMessages: AiMessageContext[];
    latestTestSummary?: string;
  };
  policy: {
    allowedHelp: 'guide_debugging_and_code_review';
    forbiddenHelp: string[];
  };
};
```

This request is product-owned. Providers adapt from this shape.

### Candidate assistant response

Provider responses should normalize to:

```ts
type AiProviderResult = {
  provider: 'deterministic' | 'ollama';
  model: string;
  content: string;
  latencyMs: number;
  usage?: {
    promptChars: number;
    responseChars: number;
    includedFiles: string[];
  };
  safetyFlags: string[];
  metadata: Record<string, unknown>;
};
```

The API route stores response content plus provider metadata, then logs telemetry.

### Evaluator AI

The evaluator should not reuse the candidate assistant prompt. It should receive:

- final files
- starter files
- event timeline
- AI transcript
- command/test history
- file snapshot summary
- rubric version
- scoring instructions

The evaluator should output strict JSON matching the report schema. A validation step should reject malformed or evidence-free reports.

## Long-term model strategy

Hirewave should not train its own foundation model now.

The professional path is:

1. Use existing models behind a provider abstraction.
2. Capture high-quality telemetry and report outcomes.
3. Add human evaluator review, edits, and overrides.
4. Build an internal labeled dataset of session traces and scoring decisions.
5. Create offline evaluation benchmarks for scoring consistency and bias checks.
6. Fine-tune or distill specialist models for evidence extraction, rubric scoring, risk detection, and report summarization.
7. Consider custom enterprise models only after there is enough labeled data, security maturity, and customer demand.

For large enterprise customers, the strongest moat is not owning a base model. The stronger moat is a validated, auditable evaluation system with proprietary work-sample traces and human-reviewed scoring data.

## Compliance and security direction

V1 should be designed so enterprise controls can be added without rewriting the product:

- immutable telemetry events
- signed invite links
- session expiry
- candidate consent/privacy notice
- no candidate account requirement
- no secret exposure in sandbox
- separate assistant/evaluator policies
- model/provider metadata on reports
- reviewer audit history later
- workspace RBAC later
- retention policies later
- exportable evidence packet later

The MVP can still use SQLite, demo auth, deterministic AI, and simulated runner, but the data model and route boundaries should not pretend these are production controls.

## Test-first execution standard

For every feature or behavior change:

1. Write or update the relevant test first.
2. Implement the smallest production change.
3. Run targeted tests only when explicitly authorized.
4. Report unrun tests as `not run by request` with exact commands.

Coverage expectations:

- API tests for route handlers, DB side effects, telemetry, report generation, closed-session behavior, and provider adapters.
- Playwright E2E tests for invite to session to AI/tests/edit/submit/report workflows.
- Skipped future tests for enterprise hardening such as RBAC, invite expiry, audit logs, real sandbox isolation, real AI provider behavior, and retention rules.

## Multi-agent execution direction

When implementation begins, work can be split across independent agents:

- API/test agent: writes API coverage and validates route contracts.
- E2E agent: owns Playwright candidate and hiring-team flows.
- Product implementation agent: owns UI and route implementation.
- AI architecture agent: owns assistant/evaluator provider abstractions and schemas.
- Docs/demo agent: owns route docs, README, demo video script, presentation outline, and launch walkthrough.

Agents must avoid overlapping write ownership. Each agent should report changed files and unrun test commands.

## Demo and sales artifacts after MVP

After the MVP works end to end, create:

- short product walkthrough script
- demo video storyboard
- founder sales deck
- enterprise security posture slide
- sample candidate report PDF/export plan
- implementation-readiness checklist

These artifacts should be generated from the working product, not before the workflow exists.

## V1 acceptance criteria

V1 is credible when:

- Hiring team can create a challenge.
- Hiring team can share one invite link.
- Candidate can start without account creation.
- Candidate can edit files, run tests, use AI, and submit.
- System logs meaningful telemetry.
- Report uses exactly the `ai-collaboration-v1` 8-dimension rubric.
- Every score cites evidence.
- Hiring team can inspect AI transcript, commands/tests, final files, and report.
- The product clearly communicates why this differs from traditional coding tests.

## Explicit non-goals for v1

- Custom rubric builder.
- Real enterprise SSO.
- ATS integrations.
- Proctoring/video recording.
- Full cloud IDE parity.
- Owning or training a foundation model.
- Production claims around sandbox isolation before a real sandbox provider exists.
