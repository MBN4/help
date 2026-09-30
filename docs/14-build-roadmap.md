# Build Roadmap

This doc didn't exist before Phase 10 despite being referenced in the phase kickoff prompts — like
[`13-devops-deployment.md`](13-devops-deployment.md) before Phase 9, it was assumed to exist and never written.
Drafted at Phase 10 kickoff per the standing "draft missing numbered docs for review" convention. It's the
one-page phase-by-phase timeline; [`16-ai-prompts.md`](16-ai-prompts.md) holds the actual per-phase build
prompts and [`PROGRESS.md`](PROGRESS.md) holds the detailed, authoritative status/deviation log. This doc is a
map of the two, not a third source of truth — if it and `PROGRESS.md` ever disagree, `PROGRESS.md` wins.

## Phase timeline

| Phase | Scope                                                 | Status                      |
| ----- | ----------------------------------------------------- | --------------------------- |
| 0     | Monorepo scaffolding                                  | Complete                    |
| 1     | Database + core backend (auth, roles)                 | Complete                    |
| 2     | Core public read APIs (locations, categories, search) | Complete                    |
| 3     | Frontend foundations                                  | Complete                    |
| 4     | Public discovery experience                           | Complete                    |
| 5     | Accounts & contributions                              | Complete, browser-verified  |
| 6     | Business owner experience                             | Complete, browser-verified  |
| 7     | Admin & moderation                                    | Complete, verified          |
| 8     | Trust, safety & anti-spam                             | Complete, verified          |
| 9     | Hardening, performance, SEO, a11y, observability      | Complete, verified          |
| 10    | Lahore launch (deployment & go-live)                  | **In progress** — see below |

## Phase 10 — Lahore launch

Ops phase, not feature work: no new product code, only production infrastructure, real credentials, real
launch content, and the last unverified surfaces (Google Maps SDK) exercised for real. Full task list and
acceptance criteria are in `PROGRESS.md`'s Phase 10 entry; this section only records the decisions made at
kickoff so future phases don't have to re-derive them.

**Infra decisions made at kickoff:**

- **Hosting**: Vercel for `apps/web`, Railway for `apps/api` + managed Postgres + managed Redis. Chosen over a
  single VPS for lower ops burden at this stage (managed backups/TLS/scaling vs. self-managed).
- **Storage/CDN**: Cloudflare R2 (already the target referenced throughout the codebase's comments/docs since
  Phase 5 — free egress, S3-compatible, no code change needed beyond `S3_*` env vars).
- **Edge/DNS**: Cloudflare in front of both Vercel and Railway (proxy + SSL + caching + DDoS protection),
  domain registrar TBD (pending — see `PROGRESS.md`).
- **Email**: no provider chosen yet at kickoff — `MailService` currently only logs verification/reset links
  (Phase 1 deviation, never revisited). Recommendation to make when a provider is picked: Resend (simple REST
  API, generous free tier, good deliverability) — not yet implemented in code.

**What blocks full completion** (tracked in detail in `PROGRESS.md`): real credentials for Maps/Sentry/
PostHog/OAuth/email, a registered domain, and real Lahore business listing data all require account creation
or data the user provides — none of these can be created by an AI agent without account/dashboard access.
