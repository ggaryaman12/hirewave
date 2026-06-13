# Security Posture Slide

Purpose: honest enterprise-buyer slide for the current MVP and target posture  
Use this as a single sales-deck slide or appendix page.

## Slide Headline

Security posture: honest MVP boundaries, enterprise-ready direction.

## Current MVP Posture

| Area | Current state | Buyer-safe wording |
| --- | --- | --- |
| Authentication | Demo-cookie hiring-team auth | "MVP demo authentication, not production SSO." |
| Candidate access | Invite link starts a no-account candidate session | "Low-friction candidate access with session links." |
| Database | SQLite local/dev database | "MVP persistence for demo and development workflows." |
| Runner | Simulated deterministic command/test runner | "Captures command/test behavior; not a real untrusted-code sandbox yet." |
| AI provider | Deterministic provider by default; optional Ollama-compatible provider | "Provider abstraction direction, with deterministic default for stable demos." |
| Telemetry | Session events, AI messages, commands/tests, file snapshots | "Process evidence is captured for reviewer-visible reports." |
| Reports | Evidence-backed report UI | "Reports cite captured session artifacts and support human review." |
| RBAC/SSO | Not implemented | "Target enterprise control, not in the MVP." |
| Compliance controls | Not implemented | "Retention, audit exports, and formal compliance workflows are roadmap items." |

## Target Enterprise Controls

Planned direction before production enterprise claims:

- Production authentication.
- Workspace RBAC and reviewer permissions.
- SSO/SAML or OIDC.
- Real sandbox isolation for untrusted code execution.
- Network and secret isolation for candidate sessions.
- Immutable audit history for report generation, review, and overrides.
- Retention and deletion policies.
- Provider and model metadata on every AI-assisted report.
- Exportable evidence packet for audit and hiring-decision review.
- Dependency and infrastructure hardening.

## Buyer Talk Track

"The MVP is intentionally honest: demo auth, SQLite, a simulated runner, and deterministic or Ollama-backed AI. We are not claiming production enterprise security today. What we are validating is the product workflow and the evidence model: candidate prompts, AI responses, commands, tests, file changes, and reports. The enterprise roadmap is to wrap that evidence model in production auth, RBAC, SSO, sandbox isolation, retention controls, audit history, and exportable evidence packets."

## Do Not Claim

- SOC 2, ISO 27001, HIPAA, GDPR readiness, or procurement approval.
- Production sandbox isolation.
- Production RBAC or SSO.
- Malware-safe execution.
- Secret-safe candidate runtime.
- ATS integration.
- Automated final hiring decisions.

## Safe Differentiation

Hirewave's current differentiator is not mature enterprise security. The current differentiator is the product model: realistic AI-assisted engineering work, full process telemetry, and evidence-backed reports. Enterprise security and compliance controls are required next steps before production deployment for large customers.
