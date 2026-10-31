# REVEW — current ecosystem integration mission

2026-10-31 — BEFORE / active — signed REVEW

Owner request: extend the review system already built in TAKATAK V1 into the central review cockpit; research Facebook, Yelp, Google, Instagram and other reputation APIs; keep the ecosystem connected; leave API handoff notes for QMAPS and FLEXS; keep signed notes in GitHub and Google Drive throughout the work.

## Sources inspected

- TAKATAKREVIEW issue #2, both requirement comments and original Yelp reference.
- TAKATAK V1 main `35c62f0`, agent rules, work log, open PR titles, Growth/Reputation, Google Business Profile, QMAPS synchronization/reply implementation and AI agent/credit/billing boundaries.
- Agent board `takatakca/foodhubca#105`: no REVEW/review/QMAPS/FLEXS ownership overlap found in the retrieved comments.
- knowledgeAI main `be98a20`, integration standards and project inventory; ecosystem-map branch `cd04ec2`: child → TAKATAK V1 → authorized child, one master identity.
- QMAPS main `6e73f0f`: businesses, native review screens, signed matching, business linking, review reply and review event code already exist.
- FLEXS is `takatakca/flexsca`, known domain `flexs.ca` in the project inventory; never infer API identity from the differently spelled user domain. Its native verified customer reviews, opportunity intake and attribution are existing code, while a general authorized business/lead/review export API remains a counterpart contract.

## Implementation direction

Enhance `/dashboard/growth/reviews` inside V1 using its existing Prisma data, session permissions, paid-module entitlements, Google replies, QMAPS bridge and AI queue. The standalone TAKATAKREVIEW branch remains a product/UI reference; it is not a second production identity/billing authority or a replacement database migration.

Publish capability/provenance for each source. Instagram comments/conversations are not fabricated star ratings. Source API access, display rights and write permission remain independently checked. All customer/business/lead reads remain scoped to an authorized workspace.

## Notes delivery evidence

- GitHub: this file is the signed current mission note on `codex/review-cockpit`; V1 implementation claim is on `codex/review-ecosystem`.
- QMAPS/FLEXS: dedicated signed counterpart API handoff documents are being prepared on review branches in their actual repositories.
- Google Drive: **NOT UPLOADED**. No Google Drive, Gmail or cross-chat tools are callable in this session. Other agents' historical connector inventories do not grant this session access. Matching files are retained in `/workspace/review-reference/drive-ready/` for upload when the connector is available. No folder, document ID or successful upload is invented.
- Public GitHub issue/PR reads work through web pages and native Git; GitHub API requests return 403. Issue/board comment creation is blocked; publishing branch documents does not mean an issue comment or agent notification was delivered.

## Current external blockers

Provider documentation hosts and `api.github.com` are blocked by the running network policy. Their additions were saved in the environment draft while preserving existing domains; this does not apply or publish runtime changes. Google Drive access is independently unavailable. Continue code, offline adapter tests and GitHub branch notes; do not stop independent work or claim verified live API connectivity.

— REVEW

## Owner-requested email coordination cadence

2026-10-31 — user requested a 30-minute recurring read/write cycle in the existing bot email thread for takatak.ca@gmail.com, identifying this agent as REVEW. **NOT ACTIVE / NOT SCHEDULED:** neither a Gmail connector nor a scheduling tool is available in this session. No email has been sent. Thread instructions remain unread. Do not substitute a sleeping shell loop, invent credentials, or claim continuous execution. Keep matching signed GitHub/Drive-ready notes while the existing review implementation continues. — REVEW

## DURING — native V1 delivery and counterpart notes

The V1-owned implementation is on https://github.com/takatakca/takatak-v1/tree/codex/review-ecosystem : unified tenant-scoped feedback/Google/QMAPS feed, source/rating/status/time filters, private CSV, existing Google/QMAPS response workflows, and existing AI workforce draft requests. No additional identity, billing authority or database migration. Local 15 cockpit, 4 QMAPS bridge and 13 QMAPS sync checks passed; changed-source lint 0 errors; real V1 foundation page/permission and mobile rendering checked. Full Prisma generation remains blocked locally by proxy 403; focused GitHub CI will use a generated client.

Requested counterpart notes are actually pushed: [QMAPS](https://github.com/takatakca/qmaps/blob/revew/review-api-handoff/docs/TAKATAK_REVIEW_API_HANDOFF.md) and [FLEXS](https://github.com/takatakca/flexsca/blob/revew/review-api-handoff/docs/TAKATAK_REVIEW_API_HANDOFF.md). These request dedicated scoped APIs/keys and complete authorized business/review/lead pagination, not global private-data exports. No issue comment or agent acknowledgment is claimed. Drive copies remain NOT UPLOADED; email task remains NOT SCHEDULED. — REVEW
