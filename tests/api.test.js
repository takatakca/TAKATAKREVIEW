import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import express from "express";
import { createApp, processOutbox } from "../server/app.js";
import { Store, ensureWorkspace } from "../server/store.js";
import { metrics, verifySignature } from "../server/domain.js";

async function fixture(t, env = {}, transport) {
  const store = new Store(":memory:");
  const { app } = createApp({ store, env, transport });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => {
    server.closeAllConnections();
    server.close();
    store.close();
  });
  const request = async (
    path,
    { method = "GET", body, headers = {}, raw } = {},
  ) => {
    const response = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    const content = await response.text();
    let data;
    try {
      data = JSON.parse(content);
    } catch {
      data = content;
    }
    return { status: response.status, data, headers: response.headers };
  };
  await request("/api/bootstrap");
  return { store, request, base };
}
const customer = {
  name: "Test Customer",
  email: "customer@example.com",
  consent: true,
  locationId: "main",
};
const feedback = {
  author: "Test Reviewer",
  rating: 2,
  text: "A useful, honest experience.",
  publishConsent: true,
  contactAllowed: true,
};
const item = {
  externalId: "provider-1",
  author: "Test Reviewer",
  rating: 5,
  text: "Clear and helpful.",
  publishedAt: "2026-10-31T12:00:00.000Z",
  recommended: true,
  publishConsent: false,
};
function sign(
  raw,
  secret = "test-secret",
  timestamp = Math.floor(Date.now() / 1000),
) {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.`).update(raw).digest("hex")}`;
}

test("fresh workspace is empty, persistent, and never claims provider readiness", async (t) => {
  const { store, request } = await fixture(t);
  const { data } = await request("/api/bootstrap");
  assert.equal(data.reviews.length, 0);
  assert.equal(data.metrics.average, null);
  assert.equal(
    data.integrations.find((p) => p.id === "google").status,
    "not_connected",
  );
  assert.equal(data.capabilities.email, false);
  assert.equal(store.get("local", "settings", "workspace").name, "My business");
});
test("customer validation, CRUD, scope checking and CSV duplicate handling", async (t) => {
  const { request } = await fixture(t);
  assert.equal(
    (
      await request("/api/customers", {
        method: "POST",
        body: { ...customer, email: "bad" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/customers", {
        method: "POST",
        body: { ...customer, locationId: "elsewhere" },
      })
    ).status,
    404,
  );
  const { data: c, status } = await request("/api/customers", {
    method: "POST",
    body: customer,
  });
  assert.equal(status, 201);
  assert.equal(
    (
      await request("/api/customers/" + c.id, {
        method: "PUT",
        body: { ...customer, name: "Updated" },
      })
    ).data.name,
    "Updated",
  );
  const imported = await request("/api/customers/import", {
    method: "POST",
    body: { rows: [customer, { ...customer, email: "second@example.com" }] },
  });
  assert.deepEqual(imported.data, { imported: 1, skipped: 1 });
  assert.equal(
    (await request("/api/customers/" + c.id, { method: "DELETE" })).status,
    200,
  );
});
test("public feedback, invitation completion and response form a real end-to-end workflow", async (t) => {
  const { request } = await fixture(t);
  const c = (
    await request("/api/customers", { method: "POST", body: customer })
  ).data;
  const snapshot = (await request("/api/bootstrap")).data;
  const page = snapshot.pages[0];
  const invitation = (
    await request("/api/requests", {
      method: "POST",
      body: { customerIds: [c.id], pageId: page.id, channel: "link" },
    })
  ).data.requests[0];
  assert.equal(invitation.status, "link_ready");
  const input = { ...feedback, requestToken: invitation.id };
  assert.equal(
    (
      await request("/api/public/pages/" + page.slug, {
        method: "POST",
        body: input,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await request("/api/public/pages/" + page.slug, {
        method: "POST",
        body: input,
      })
    ).status,
    409,
  );
  const after = (await request("/api/bootstrap")).data;
  assert.equal(after.requests[0].status, "completed");
  assert.equal(after.metrics.total, 1);
  const review = after.reviews[0];
  assert.equal(
    (
      await request("/api/reviews/" + review.id + "/reply", {
        method: "POST",
        body: { text: "Thank you. We are working on this." },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/bootstrap")).data.metrics.responseRate,
    100,
  );
  const widget = (
    await request("/api/widgets", {
      method: "POST",
      body: { name: "Our customer voices", type: "grid", locationId: "main" },
    })
  ).data;
  const pub = (await request("/api/public/widgets/" + widget.id)).data;
  assert.equal(pub.reviews.length, 1);
  assert.equal(pub.reviews[0].reply, "Thank you. We are working on this.");
  assert.equal(pub.reviews[0].email, undefined);
});
test("low and high ratings have the same public submission flow; no consent means no showcase", async (t) => {
  const { request } = await fixture(t);
  const page = (await request("/api/bootstrap")).data.pages[0];
  for (const rating of [1, 5])
    assert.equal(
      (
        await request("/api/public/pages/" + page.slug, {
          method: "POST",
          body: { ...feedback, rating, publishConsent: false },
        })
      ).status,
      201,
    );
  const widget = (
    await request("/api/widgets", {
      method: "POST",
      body: { name: "Consent test", type: "wall", locationId: "main" },
    })
  ).data;
  assert.equal(
    (await request("/api/public/widgets/" + widget.id)).data.reviews.length,
    0,
  );
  assert.equal((await request("/api/bootstrap")).data.metrics.total, 2);
});
test("paused pages reject feedback and cannot be used for invitations", async (t) => {
  const { request } = await fixture(t);
  const page = (await request("/api/bootstrap")).data.pages[0];
  await request("/api/pages/" + page.id, {
    method: "PUT",
    body: { ...page, active: false },
  });
  assert.equal((await request("/api/public/pages/" + page.slug)).status, 404);
  assert.equal(
    (
      await request("/api/public/pages/" + page.slug, {
        method: "POST",
        body: feedback,
      })
    ).status,
    404,
  );
  const c = (
    await request("/api/customers", { method: "POST", body: customer })
  ).data;
  assert.equal(
    (
      await request("/api/requests", {
        method: "POST",
        body: { customerIds: [c.id], pageId: page.id, channel: "link" },
      })
    ).status,
    409,
  );
});
test("email requests enforce consent, location boundaries, queue truth and disabled delivery", async (t) => {
  const { request } = await fixture(t);
  const page = (await request("/api/bootstrap")).data.pages[0];
  const noConsent = (
    await request("/api/customers", {
      method: "POST",
      body: { ...customer, consent: false },
    })
  ).data;
  assert.equal(
    (
      await request("/api/requests", {
        method: "POST",
        body: {
          customerIds: [noConsent.id],
          pageId: page.id,
          channel: "email",
        },
      })
    ).status,
    400,
  );
  const other = (
    await request("/api/locations", {
      method: "POST",
      body: { name: "Other location" },
    })
  ).data;
  const elsewhere = (
    await request("/api/customers", {
      method: "POST",
      body: { ...customer, locationId: other.id },
    })
  ).data;
  assert.equal(
    (
      await request("/api/requests", {
        method: "POST",
        body: { customerIds: [elsewhere.id], pageId: page.id, channel: "link" },
      })
    ).status,
    400,
  );
  const c = (
    await request("/api/customers", { method: "POST", body: customer })
  ).data;
  assert.equal(
    (
      await request("/api/requests", {
        method: "POST",
        body: { customerIds: [c.id], pageId: page.id, channel: "email" },
      })
    ).data.requests[0].status,
    "queued",
  );
  assert.match(
    (await request("/api/outbox/retry", { method: "POST" })).data.blocked,
    /Nothing was sent/,
  );
});
test("signed review ingress is atomic, replay-safe and alert-deduplicated", async (t) => {
  const { store, request } = await fixture(t, {
    REVIEW_WEBHOOK_SECRET: "test-secret",
  });
  const settings = (await request("/api/bootstrap")).data.settings;
  await request("/api/settings", {
    method: "PUT",
    body: { ...settings, alertsEnabled: true, alertEmail: "team@example.com" },
  });
  const raw = JSON.stringify({
    id: "event-1",
    tenant: "local",
    provider: "google",
    locationId: "main",
    reviews: [item],
  });
  assert.equal(
    (
      await request("/api/webhooks/reviews", {
        method: "POST",
        raw,
        headers: { "x-takatak-signature": "bad" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/api/webhooks/reviews", {
        method: "POST",
        raw,
        headers: { "x-takatak-signature": sign(raw) },
      })
    ).data.imported,
    1,
  );
  assert.equal(
    (
      await request("/api/webhooks/reviews", {
        method: "POST",
        raw,
        headers: { "x-takatak-signature": sign(raw) },
      })
    ).data.duplicate,
    true,
  );
  const another = JSON.stringify({
    id: "event-2",
    tenant: "local",
    provider: "google",
    locationId: "main",
    reviews: [{ ...item, text: "Updated text" }],
  });
  assert.equal(
    (
      await request("/api/webhooks/reviews", {
        method: "POST",
        raw: another,
        headers: { "x-takatak-signature": sign(another) },
      })
    ).data.imported,
    0,
  );
  assert.equal(store.outbox("local").length, 1);
  assert.equal(store.list("local", "reviews").length, 1);
  assert.equal(store.list("local", "reviews")[0].text, "Updated text");
});
test("invalid webhook batches never partly import; old signatures and unknown scopes fail", async (t) => {
  const { store, request } = await fixture(t, {
    REVIEW_WEBHOOK_SECRET: "test-secret",
  });
  for (const payload of [
    {
      id: "bad",
      tenant: "local",
      provider: "google",
      locationId: "main",
      reviews: [item, { ...item, rating: 9 }],
    },
    {
      id: "unknown",
      tenant: "not-provisioned",
      provider: "google",
      locationId: "main",
      reviews: [item],
    },
  ]) {
    const raw = JSON.stringify(payload);
    assert.ok(
      (
        await request("/api/webhooks/reviews", {
          method: "POST",
          raw,
          headers: { "x-takatak-signature": sign(raw) },
        })
      ).status >= 400,
    );
  }
  assert.equal(store.list("local", "reviews").length, 0);
  assert.equal(
    verifySignature(
      Buffer.from("{}"),
      sign("{}", "test-secret", 1),
      "test-secret",
    ),
    false,
  );
});
test("nonrecommended reviews are excluded from score and source content never leaks into widgets", async (t) => {
  const { store, request } = await fixture(t);
  store.put(
    "local",
    "reviews",
    { ...item, provider: "yelp", locationId: "main", recommended: false },
    "hidden",
  );
  store.put(
    "local",
    "reviews",
    { ...item, provider: "google", locationId: "main", publishConsent: true },
    "external",
  );
  const snapshot = (await request("/api/bootstrap")).data;
  assert.equal(snapshot.metrics.total, 1);
  assert.equal(snapshot.metrics.average, 5);
  const widget = (
    await request("/api/widgets", {
      method: "POST",
      body: { name: "Safe display", type: "badge", locationId: "main" },
    })
  ).data;
  assert.equal(
    (await request("/api/public/widgets/" + widget.id)).data.reviews.length,
    0,
  );
});
test("Yelp account gate, provider reply gates and customer contact restrictions are server enforced", async (t) => {
  const { store, request } = await fixture(t);
  for (const [id, provider, contactAllowed] of [
    ["y", "yelp", true],
    ["g", "google", true],
    ["t", "takatak", false],
  ])
    store.put(
      "local",
      "reviews",
      { ...item, provider, locationId: "main", contactAllowed },
      id,
    );
  assert.equal(
    (
      await request("/api/reviews/y/reply", {
        method: "POST",
        body: { text: "Do not publish" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/api/reviews/g/reply", {
        method: "POST",
        body: { text: "Do not publish" },
      })
    ).status,
    402,
  );
  assert.equal(
    (
      await request("/api/reviews/y/messages", {
        method: "POST",
        body: { text: "Do not send" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/api/reviews/t/messages", {
        method: "POST",
        body: { text: "Do not contact" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/integrations/google/sync", {
        method: "POST",
        body: { locationId: "main" },
      })
    ).status,
    402,
  );
  assert.equal(
    (
      await request("/api/billing/checkout", {
        method: "POST",
        body: { paid: true },
      })
    ).status,
    503,
  );
});
test("cross-origin writes are rejected and exports neutralize spreadsheet formulas", async (t) => {
  const { request } = await fixture(t);
  assert.equal(
    (
      await request("/api/customers", {
        method: "POST",
        headers: { Origin: "https://attacker.example" },
        body: customer,
      })
    ).status,
    403,
  );
  await request("/api/customers", {
    method: "POST",
    body: { ...customer, name: '=IMPORTXML("bad")' },
  });
  const csv = (await request("/api/export/customers")).data;
  assert.match(csv, /"'=IMPORTXML/);
});
test("email worker marks provider acceptance, preserves idempotency key, and retries failures", async (t) => {
  const { store } = await fixture(t);
  const id = store.enqueue("local", "key-1", "alert", {
    to: "team@example.com",
    subject: "Test",
    text: "Test",
  });
  let calls = 0;
  const keys = [];
  const transport = async (_url, options) => {
    calls++;
    keys.push(options.headers["Idempotency-Key"]);
    if (calls === 1) throw new Error("Temporary failure");
    return { id: "email-1" };
  };
  const env = {
    ALLOW_DELIVERY: "true",
    RESEND_API_KEY: "test-only",
    EMAIL_FROM: "test@example.com",
  };
  assert.equal((await processOutbox(store, env, transport, "local")).failed, 1);
  assert.equal(store.outbox("local")[0].status, "retry");
  assert.equal(
    (await processOutbox(store, env, transport, "local")).processed,
    1,
  );
  assert.equal(store.outbox("local")[0].status, "accepted");
  assert.deepEqual(keys, [id, id]);
  assert.equal(
    (await processOutbox(store, env, transport, "local")).processed,
    0,
  );
});
test("sample email is never sent, even with configured delivery", async (t) => {
  const { store, request } = await fixture(t);
  await request("/api/sample", { method: "POST" });
  const sample = store.list("local", "customers")[0];
  const page = store
    .list("local", "pages")
    .find((p) => p.locationId === sample.locationId);
  const selected = page
    ? sample
    : store.list("local", "customers").find((c) => c.locationId === "main");
  const selectedPage = page || store.list("local", "pages")[0];
  await request("/api/requests", {
    method: "POST",
    body: {
      customerIds: [selected.id],
      pageId: selectedPage.id,
      channel: "email",
    },
  });
  let sent = false;
  await processOutbox(
    store,
    {
      ALLOW_DELIVERY: "true",
      RESEND_API_KEY: "test",
      EMAIL_FROM: "test@example.com",
    },
    async () => {
      sent = true;
      return { id: "bad" };
    },
  );
  assert.equal(sent, false);
  assert.equal(store.outbox("local")[0].status, "sample_blocked");
});
test("database survives reopening and isolation is built into record ownership", async (t) => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "review-store-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "test.sqlite");
  let store = new Store(file);
  ensureWorkspace(store, "tenant-a");
  ensureWorkspace(store, "tenant-b");
  store.put("tenant-a", "customers", customer, "private-id");
  store.close();
  store = new Store(file);
  assert.equal(
    store.get("tenant-a", "customers", "private-id").name,
    customer.name,
  );
  assert.equal(store.get("tenant-b", "customers", "private-id"), null);
  assert.equal(store.list("tenant-b", "customers").length, 0);
  store.close();
});
test("canonical JWT tenant scoping, expired tokens, viewer permissions and billing entitlement checks", async (t) => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "test";
  const jwks = express();
  jwks.get("/jwks", (_req, res) => res.json({ keys: [jwk] }));
  const keysServer = jwks.listen(0, "127.0.0.1");
  await new Promise((r) => keysServer.once("listening", r));
  t.after(() => {
    keysServer.closeAllConnections();
    keysServer.close();
  });
  const env = {
    AUTH_JWKS_URL: `http://127.0.0.1:${keysServer.address().port}/jwks`,
    AUTH_ISSUER: "https://auth.example.com",
    AUTH_AUDIENCE: "takatak-review",
  };
  const { store, request } = await fixture(t, env);
  ensureWorkspace(store, "tenant-a");
  ensureWorkspace(store, "tenant-b");
  store.put(
    "tenant-a",
    "reviews",
    { ...item, provider: "takatak", locationId: "main" },
    "private-review",
  );
  store.put("tenant-a", "customers", customer, "private-customer");
  async function token(tenant, role = "owner", expired = false) {
    return new SignJWT({ clientId: tenant, role, modules: [] })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setSubject("user-1")
      .setIssuer(env.AUTH_ISSUER)
      .setAudience(env.AUTH_AUDIENCE)
      .setExpirationTime(expired ? "1s" : "5m")
      .setIssuedAt(expired ? 1 : undefined)
      .sign(privateKey);
  }
  const a = { Authorization: `Bearer ${await token("tenant-a")}` };
  const b = { Authorization: `Bearer ${await token("tenant-b")}` };
  assert.equal((await request("/api/bootstrap")).status, 401);
  assert.equal(
    (await request("/api/bootstrap", { headers: b })).data.reviews.length,
    0,
  );
  assert.equal(
    (
      await request("/api/reviews/private-review/reply", {
        method: "POST",
        headers: b,
        body: { text: "cross-tenant" },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request("/api/customers/private-customer", {
        method: "DELETE",
        headers: b,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request("/api/reviews/private-review/reply", {
        method: "POST",
        headers: a,
        body: { text: "Thank you" },
      })
    ).status,
    200,
  );
  const viewer = {
    Authorization: `Bearer ${await token("tenant-a", "viewer")}`,
  };
  assert.equal(
    (
      await request("/api/customers", {
        method: "POST",
        headers: viewer,
        body: customer,
      })
    ).status,
    403,
  );
  const expired = new SignJWT({ clientId: "tenant-a", role: "owner" })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setSubject("user-1")
    .setIssuer(env.AUTH_ISSUER)
    .setAudience(env.AUTH_AUDIENCE)
    .setExpirationTime(1);
  assert.equal(
    (
      await request("/api/bootstrap", {
        headers: { Authorization: `Bearer ${await expired.sign(privateKey)}` },
      })
    ).status,
    401,
  );
});
test("production refuses to run without canonical auth", () => {
  assert.throws(
    () =>
      createApp({
        store: new Store(":memory:"),
        env: { NODE_ENV: "production" },
      }),
    /Production requires/,
  );
});

test("stale source updates cannot erase a confirmed response, and hidden consented reviews stay private", async (t) => {
  const { store, request } = await fixture(t, {
    REVIEW_WEBHOOK_SECRET: "test-secret",
  });
  const send = async (id, review) => {
    const raw = JSON.stringify({
      id,
      tenant: "local",
      provider: "google",
      locationId: "main",
      reviews: [review],
    });
    return request("/api/webhooks/reviews", {
      method: "POST",
      raw,
      headers: { "x-takatak-signature": sign(raw) },
    });
  };
  await send("new-version", {
    ...item,
    sourceUpdatedAt: "2026-10-31T12:00:00.000Z",
  });
  const review = store.list("local", "reviews")[0];
  store.put(
    "local",
    "reviews",
    {
      ...review,
      reply: "Confirmed provider reply",
      repliedAt: "2026-10-31T12:05:00.000Z",
    },
    review.id,
  );
  await send("stale-version", {
    ...item,
    reply: "",
    sourceUpdatedAt: "2026-10-31T11:00:00.000Z",
  });
  assert.equal(
    store.get("local", "reviews", review.id).reply,
    "Confirmed provider reply",
  );
  await send("missing-version", { ...item, reply: "" });
  assert.equal(
    store.get("local", "reviews", review.id).reply,
    "Confirmed provider reply",
  );
  const page = (await request("/api/bootstrap")).data.pages[0];
  await request("/api/public/pages/" + page.slug, {
    method: "POST",
    body: feedback,
  });
  const firstParty = store
    .list("local", "reviews")
    .find((r) => r.provider === "takatak");
  await request("/api/reviews/" + firstParty.id, {
    method: "PATCH",
    body: { hidden: true },
  });
  const widget = (
    await request("/api/widgets", {
      method: "POST",
      body: { name: "Privacy regression", type: "grid", locationId: "main" },
    })
  ).data;
  assert.equal(
    (await request("/api/public/widgets/" + widget.id)).data.reviews.length,
    0,
  );
});
