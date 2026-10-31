# Integration contracts

Read before wiring a live service. All example values and review text below are synthetic. — Codex, 2026-10-31

## Canonical identity and paid modules

Production refuses to start without `AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE`, and an HTTPS `APP_ORIGIN`. JWTs are verified with the configured issuer, audience, and RS256/ES256 key set. A token must contain `sub`, an expiration, a signed `clientId`, and `role` (`owner`, `admin`, `manager`, or `viewer`). A `modules` array containing `reputation` grants the paid provider capability. Browser location/query/body fields do not select a tenant or grant access.

Use `Authorization: Bearer <canonical JWT>` from the same-origin ecosystem gateway, or exchange an already-issued canonical token through `POST /api/session` with JSON `{ "token": "<canonical JWT>" }`. That endpoint verifies the token before setting a Secure, HttpOnly, SameSite=Strict production cookie. It does not create accounts or mint tokens. `POST /api/session/logout` clears the cookie. Integrate this under the existing authenticated TAKATAK origin/gateway; this repository does not implement a new password directory or invent a cross-domain SSO handshake.

`viewer` is read-only; workspace settings, billing, and provider connection changes require `owner`/`admin`. Signed entitlements are cached only until the JWT's actual expiration for scheduled reads; the canonical gateway must refresh them. Access revocation semantics and maximum token lifetime remain the identity authority's responsibility.

`TAKATAK_BILLING_URL` points to the existing HTTPS Growth/Stripe pricing portal (the inspected ecosystem has `/dashboard/growth/pricing`). The cockpit returns that configured URL and never accepts a browser-provided redirect, price, customer, or plan activation. It does not create a duplicate Stripe customer/subscription. A successful return URL does not grant an entitlement.

## Native Google Business Profile

Requires approved Google Business Profile API access, an OAuth web client, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_ORIGIN`, and `GOOGLE_TOKEN_ENCRYPTION_KEY` (a securely generated 32-byte key encoded as 64 hex characters). Configure the key as a server secret, never a committed value. The Google callback URL is exactly:

```text
https://<your-review-origin>/api/oauth/google/callback
```

An entitled owner/admin starts authorization using `POST /api/integrations/google/connect`; the UI navigates to its returned URL. The state is short-lived, one-use, hash-stored, and bound to an independent HttpOnly browser cookie. PKCE S256 is used. The callback requires a refresh token and the `business.manage` scope, then AES-256-GCM encrypts credentials at rest.

Discover account-owned locations with `GET /api/integrations/google/locations`. An owner/admin links one verified remote resource to a local location through `POST` on the same path with `{locationId, remoteId}`. A caller cannot inject an arbitrary remote location ID absent from the verified catalog.

`POST /api/integrations/google/sync` with `{locationId}` pulls the entire linked review collection before committing. It rejects inconsistent counts, repeated page tokens, duplicate IDs, foreign resource names, and bounded-pagination overflow. Upserts are stable by tenant/provider/location/external ID; only new reviews enqueue notifications/alerts. Imported content is not exposed through public widgets.

`POST /api/reviews/:id/reply` publishes to the verified resource only after tenant, module, and location checks. The response is persisted only when Google returns the matching comment and update timestamp. Existing Google replies are read during synchronization.

Optional automatic reads require `ALLOW_GOOGLE_SYNC=true`. `GOOGLE_SYNC_INTERVAL_SECONDS` defaults to 900 (minimum 300). A loop processes up to five due locations per cycle with persisted scheduling and leases; stale entitlement snapshots never grant scheduled access. It stops processing a connection after credential disconnection. Intervals are evaluated while this server is running; they are not a hosted external scheduler.

Native requests use these official HTTPS hosts:

- `accounts.google.com` (browser consent)
- `oauth2.googleapis.com` (code exchange/token refresh)
- `mybusinessaccountmanagement.googleapis.com`
- `mybusinessbusinessinformation.googleapis.com`
- `mybusiness.googleapis.com`

The managed environment proxy and CA trust are preserved. No live Google request was authorized or performed during tests. Real OAuth consent, provider approval, application visibility, tenant membership, rate limits, and publication still need a controlled live test.

## Signed provider ingress

`POST /api/webhooks/reviews` accepts raw `application/json`. Sign the **exact bytes** using a raw server-side `REVIEW_WEBHOOK_SECRET`:

```text
x-takatak-signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, timestamp + "." + rawBody)>
```

Clock tolerance is five minutes. The receiver requires a pre-provisioned workspace and existing location. Event IDs are unique per tenant; event processing and replay registration commit together. Never provide a network-proxy placeholder where a raw local HMAC key is needed.

```json
{
  "id": "synthetic-event-001",
  "tenant": "canonical-client-id",
  "provider": "google",
  "locationId": "main",
  "reviews": [
    {
      "externalId": "synthetic-source-review-id",
      "author": "Example Customer",
      "rating": 4,
      "text": "A fictional example used to illustrate the contract.",
      "publishedAt": "2026-10-31T12:00:00.000Z",
      "recommended": true,
      "contactAllowed": false,
      "publishConsent": false,
      "reply": ""
    }
  ]
}
```

Providers: `google`, `tripadvisor`, `yelp`, `facebook`, `trustpilot`. Maximum 500 reviews/event and 2 MB raw body. Ingress does not fabricate provider API permission or activate a billing module. The signing adapter is trusted to route the correct canonical tenant; use a separately managed secret and audit its provisioning.

## Optional provider relay

`REVIEW_BRIDGE_URL` is a fixed server-configured HTTPS base; `REVIEW_BRIDGE_KEY` authenticates only to it. The relay is an **explicit new contract**, not a claim these endpoints already exist in takatak-v1. Its implementation must call approved provider APIs with server-side tenant ownership checks.

- `POST /v1/reviews/sync`: `{tenant, provider, locationId}` → `{complete:true, reviews:[...same review schema...]}`. No partial collection is committed.
- `POST /v1/reviews/reply`: `{tenant,provider,externalId,locationId,text,idempotencyKey}` → `{published:true}` only after real provider publication. The current client enables relay publication for Google only. Yelp, TripAdvisor, Facebook, and Trustpilot remain locked pending verified provider capabilities and interface documentation.

No credential-bearing redirect is followed. Provider failure is an error; no green “synced” or “published” state is recorded on failure.

## Email delivery

Set a verified `EMAIL_FROM`, raw `RESEND_API_KEY`, and explicitly enable `ALLOW_DELIVERY=true`. Outbound domain: `api.resend.com`. Workspace owners configure alert recipient and notification rules; customer invitation email requires a valid opted-in address. Requests/alerts are enqueued durably. The worker uses one stable provider idempotency key per delivery and retries at most five times. Interrupted sending rows resume with the same key after restart. Sample deliveries are blocked even with sending enabled. Queued invitations recheck current contact consent and recipient ownership before sending; deleted/opted-out customers and completed/expired invitations are canceled.

Statuses distinguish `pending`, `retry`, `sending`, `accepted`, `canceled`, and `sample_blocked`. `accepted` means the provider accepted the send; it does **not** prove inbox delivery or reading. The current implementation does not process delivery/bounce webhooks, run scheduled invitation reminders, or offer SMS/WhatsApp sending. Provider idempotency retention limits still apply to delayed retries.

## Existing ecosystem reuse and limits

Inspected `takatak-v1/src/lib/reputation`, Google Business Profile integration, Growth reputation/AI contracts, and `src/lib/billing/growth/stripe.ts`. This app uses the same tenant/role/module boundary and hands off billing; it does not migrate or alter those checkouts. The SQLite store is a standalone implementation, not an automatic migration from the canonical Prisma database. A gateway/adapter integration and data migration plan are required before replacing an existing production workspace.
