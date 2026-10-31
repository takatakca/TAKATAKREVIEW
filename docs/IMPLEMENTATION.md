# Requirements and implementation evidence

BEFORE: GitHub issue #2, both requirement comments, every committed file at `65e2f1f`, the 66 screenshot references, and the ecosystem's reputation/Google/Stripe implementation were read before building. — Codex, 2026-10-31

DURING: Implemented an independent cockpit in this repository; left all other repository checkouts and the verbatim Yelp observation unchanged. Reference customer names, support identifiers, and source review text are not application fixtures. — Codex, 2026-10-31

## Issue acceptance matrix

| Requirement                                       | Delivered behavior                                                                                                                                                        | Verification / remaining dependency                                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Establish this repository's purpose (#1)          | README, implementation, deployment and integration contracts identify TAKATAK's own review cockpit.                                                                       | Repository contains runnable source and frozen npm lock.                                                                                            |
| Cockpit with navigation, buttons and widgets (#2) | Overview, reviews, customers, invitations, pages, six widgets, messages/notes, rules, analytics, integrations, settings, account and billing views.                       | Browser navigation and mobile tests; production build.                                                                                              |
| Alerts by email                                   | New source/first-party feedback creates a notification and a deduplicated outbox entry when alerts/rules are enabled. Worker requires verified email configuration.       | API tests cover consent, retries, idempotency and sample-send blocking. Real email sender/key required for live delivery.                           |
| Reply inside TAKATAK                              | First-party replies persist and appear on consented widgets. Google replies require ownership checks and confirmed provider publication.                                  | Full browser first-party flow and mocked Google publication tests. Real Google approval/OAuth required.                                             |
| Synchronize reviews                               | Google complete-paginated API reads, encrypted refresh, linked locations and optional entitled scheduler. Signed replay-safe ingress supports authorized source adapters. | Mocked pagination, ownership, refresh and webhook tests. No live source was connected.                                                              |
| Paid integrations with existing Stripe            | Configured canonical billing portal handoff; issuer-signed Reputation module gates provider operations.                                                                   | API rejects unpaid operations and ignores client-supplied activation flags. Existing production auth/billing configuration needed.                  |
| Platform-specific interfaces                      | Detailed Yelp state implementation and shared source tabs.                                                                                                                | Google/TripAdvisor full owner-interface observations are not in the repository yet. Cannot verify or invent their complete source-specific screens. |
| Preserve source brands/content boundary           | TAKATAK palette and original product copy; fictional examples only; provider names identify integrations.                                                                 | Original Yelp reference is unchanged; screenshots are not shipped as application data.                                                              |
| Notes before/during/after with signature          | WORKLOG.md plus this matrix and signed documentation.                                                                                                                     | These are implementation notes; they do not claim live actions or deployment.                                                                       |

## Yelp observation mapping

| Committed observation                                                               | Cockpit implementation                                                                                                                                                         |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Empty recommended view without average/distribution/sort/filter/pagination controls | Yelp source tab has its own empty state and guidance; shared rating/filter controls disappear in that source view.                                                             |
| Separate excluded list with count and explanation                                   | Separate Not recommended tab; records do not affect the overall average; plain page text.                                                                                      |
| Reviewer avatar, name, city, stats, square stars, date, body, menu and actions      | Dedicated two-column Yelp review card; safe generic silhouette and synthetic fixtures. Dates use list M/D/YYYY and detail YY-MM-DD.                                            |
| Dismissible photo notice                                                            | Dismissal applies to the current mounted view; it reappears on a new page load unless verified provider metadata clears the photo requirement.                                 |
| No reply composer observable while photo-gated                                      | Detail page shows disabled Thank/Respond/Direct message controls, explanatory gate and no active public-reply field. No unsupported unlocked composer is invented.             |
| Direct messages unavailable without consent / account verification                  | List entry absent for opted-out customers; message view has collapsed review, empty thread, information strip and disabled composer/send. Server rejects unsupported messages. |
| Share/report dropdown                                                               | Workspace-link copying and provider reporting guidance. No actual report or provider-side share is claimed.                                                                    |
| Bell is an activity feed, not provider alert settings                               | Workspace notification feed is distinct from TAKATAK's own alert preferences. No unknown Yelp email-settings UI is invented.                                                   |
| No native Yelp requests, widgets or synchronization controls observed               | No Yelp solicitation action or public redistribution. Authorized ingress is TAKATAK's integration layer, not a claim Yelp offers a native free sync control.                   |

## Screenshot reference mapping

- Customers → persistent CRUD/import/selection with consent.
- Reviews → source tabs, truthful response state, tags, detail and filters where supported.
- Review pages → per-location pages and consent-aware public form.
- Widgets → creation, editing, six actual layouts and iframe code.
- Messages → truthful empty states and stored internal notes, not fabricated delivery.
- Analytics → actual stored counts, rating breakdown, source performance and bounded time views.
- Settings → project, locations, strategy preference, email template, alerts, appearance entry points, signatures, tags, source setup, AI capability status and API contract.
- Billing/account → actual usage and canonical billing handoff, no invented prices, card collection, local password directory, 2FA implementation, or affiliate program.
- AI, SMS/WhatsApp, application connectors, DNS sending domains, and MCP → not connected; no fake working controls or unverified live behavior. These require the ecosystem's adapters rather than copied visual placeholders that pretend to operate.

## Remaining live acceptance work

1. Choose the canonical authenticated deployment/gateway and configure its existing issuer, audience, JWKS and signed workspace/module claims.
2. Connect the existing TAKATAK billing portal. Validate module activation/revocation through canonical signed entitlements; do not create a second Stripe customer system.
3. Configure approved Google OAuth/client/key/allowlisted hosts. Test owner consent → location mapping → full sync → an explicitly approved test-review reply. Test revocation and API quota failures.
4. Configure verified email delivery and an authorized test recipient. Verify provider acceptance and actual receipt separately.
5. Obtain the pending Google and TripAdvisor interface observations and each non-Google source's approved management capabilities. Implement/validate provider-specific adapters before unlocking reply controls.
6. Review data migration/retention, backups, public URL origin, canonical database integration and operational limits before production rollout.

AFTER: See WORKLOG.md for the final executed test outcomes. Live provider access, canonical account configuration and production deployment remain explicit outside dependencies; local tests do not establish them. — Codex, 2026-10-31
