# Development and deployment

No production host, account, source connection or deployment was selected or changed by this implementation. — Codex, 2026-10-31

## Local and cloud development

The cloud task is already isolated. Use the existing `/workspace/TAKATAKREVIEW` checkout; do not create a Git worktree unless the user requests one.

```sh
cd /workspace/TAKATAKREVIEW
export PATH=/workspace/.tools/node_modules/.bin:$PATH # current cloud instance's prepared Node 22
npm ci
npm run dev
```

The optional `.env` file is loaded by Node; no credentials are needed for local first-party workflows. `HOST=127.0.0.1` is the default. Binding to a public/container address does not enable development authentication for remote connections; production requires canonical authentication.

Use `npm run build && npm start` for the built UI. Startup processes do not survive restoration; restart them in a later task. Dependencies and the ignored SQLite store are filesystem state. Build artifacts are generated and ignored by Git. Do not publish actual customer databases in this public repository or bake live credentials into snapshots.

## Production prerequisites

- Node 22.13+ and a persistent writable directory for `DATA_FILE` (default `var/review.sqlite`). The application uses Node's built-in SQLite API; Node 22 emits its experimental-API notice.
- HTTPS origin and canonical authentication described in INTEGRATIONS.md. Production startup fails closed if required auth configuration is missing or invalid. A working health response is process/storage availability, not provider readiness.
- Run behind the established authenticated TAKATAK gateway. For public first-party pages/widgets, route only the documented public paths publicly. Keep `/api` workspace actions behind canonical identity. Public widgets permit embedding; workspace pages prohibit cross-origin framing.
- Raw encryption/HMAC credentials belong in the server process via secure settings. Network-proxy placeholders do not substitute for raw encryption or HMAC keys.
- SQLite is intended for this standalone service with a persistent volume. Do not run unrelated replicas against independent ephemeral files and call them one shared workspace. Horizontal scale and integration with canonical Prisma storage require a deliberate migration/adapter plan.
- Back up the SQLite database together with its active WAL using SQLite's online backup support or a clean stopped-service snapshot. Test restore before accepting customer data. Protect the containing directory and encryption key independently.

## Start and inspect

```sh
npm ci
npm run build
NODE_ENV=production npm start
```

Supply configuration securely; never put credential values in that command, shell history or this file. Readiness sequence:

1. `GET /api/health` → `status: ok`.
2. Authenticate through the canonical same-origin gateway/session exchange.
3. `GET /api/bootstrap` → the correct signed tenant and expected role/capabilities.
4. Exercise a first-party invitation/feedback/response/widget with synthetic data and explicit display consent.
5. Validate provider OAuth, synchronization, publication and email acceptance/receipt separately using authorized test accounts.

The local run does not prove steps 2/5 in a real deployment. Paid modules, provider permission, identity membership, sender verification and network allowlists are distinct prerequisites.

## Network settings

Ordinary development/build/testing uses the package registry and no external fonts. Live Google uses the official hosts in INTEGRATIONS.md; live Resend uses `api.resend.com`. The optional provider relay and canonical auth/billing domains must come from the actual selected services. Preserve existing environment allowlists and add only the chosen destinations; never replace an unknown list. Keep TLS, checksum and signature verification enabled.

## Operational behavior and limits

- Email queue and optional Google sync run in a 30-second process loop. Only explicitly enabled, configured work executes. Native sync has persisted per-location intervals/leases and requires a non-expired canonical entitlement. These are not managed external cron jobs.
- Email provider idempotency keys are stable per delivery; acceptance and actual delivery are different. Five failed attempts exhaust automatic retries. Resend's idempotency retention still limits recovery after very long interruptions.
- Default public-form limiter is in-memory and per process. An Internet deployment should use the existing gateway's distributed abuse controls and request limits.
- OAuth records expire logically after ten minutes; public request links after thirty days. A production retention/deletion policy and scheduled database housekeeping must be chosen before collecting real customer data.
- No external provider messages, purchases, DNS changes, payment settlements, key rotation or production database migrations were performed.
