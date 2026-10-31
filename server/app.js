import express from "express";
import { randomUUID, createHmac } from "node:crypto";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { z } from "zod";
import { createAuth } from "./auth.js";
import { Store, ensureWorkspace, loadSample } from "./store.js";
import {
  providers,
  providerKeys,
  locationSchema,
  customerSchema,
  pageSchema,
  widgetSchema,
  automationSchema,
  settingsSchema,
  reviewSchema,
  fail,
  required,
  metrics,
  importReviews,
  verifySignature,
  csv,
  publicId,
} from "./domain.js";
import { requestJson } from "./network.js";
import {
  googleConfigured,
  startGoogle,
  finishGoogle,
  googleLocations,
  linkGoogleLocation,
  fetchGoogleReviews,
  replyToGoogle,
} from "./google.js";

const sendSchema = z.object({ text: z.string().trim().min(1).max(5000) });
const publicFeedback = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(3).max(3000),
  author: z.string().trim().min(1).max(100),
  publishConsent: z.boolean().default(false),
  contactAllowed: z.boolean().default(false),
});
const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res)).catch(next);
const encode = encodeURIComponent;
function publicPage(store, slug) {
  return store.db
    .prepare(
      "SELECT tenant,id FROM records WHERE kind='pages' AND json_extract(body,'$.slug')=? AND json_extract(body,'$.active')=1",
    )
    .get(slug);
}
function localOrigin(env, req) {
  return env.APP_ORIGIN || `${req.protocol}://${req.get("host")}`;
}
function scopeLocation(store, tenant, id) {
  if (id) required(store.get(tenant, "locations", id));
  return id || "";
}
function safeHttps(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}

export function createApp({
  store,
  env = process.env,
  transport = requestJson,
} = {}) {
  store ||= new Store(env.DATA_FILE || "var/review.sqlite");
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'self'",
    });
    if (req.path.startsWith("/embed/"))
      res.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors *",
      );
    next();
  });
  app.get("/api/health", (_req, res) =>
    res.json({
      status: "ok",
      app: "TAKATAK Review",
      storage: "sqlite",
      mode: env.NODE_ENV === "production" ? "canonical" : "local",
    }),
  );
  // Signed ingress is independent of browser sessions; parse exactly the signed bytes.
  app.post(
    "/api/webhooks/reviews",
    express.raw({ type: "application/json", limit: "2mb" }),
    (req, res, next) => {
      try {
        if (
          !Buffer.isBuffer(req.body) ||
          !verifySignature(
            req.body,
            req.get("x-takatak-signature"),
            env.REVIEW_WEBHOOK_SECRET,
          )
        )
          fail(401, "Invalid webhook signature.");
        const event = z
          .object({
            id: z.string().min(1).max(150),
            tenant: z.string().min(1).max(100),
            provider: z.enum([
              "google",
              "tripadvisor",
              "yelp",
              "facebook",
              "trustpilot",
            ]),
            locationId: z.string().min(1).max(100),
            reviews: z.array(reviewSchema).max(500),
            photoVerified: z.boolean().optional(),
          })
          .parse(JSON.parse(req.body.toString()));
        required(store.get(event.tenant, "settings", "workspace"));
        scopeLocation(store, event.tenant, event.locationId);
        const outcome = store.transaction(() => {
          if (
            store.db
              .prepare("SELECT 1 FROM webhook_events WHERE tenant=? AND id=?")
              .get(event.tenant, event.id)
          )
            return { duplicate: true, imported: 0 };
          const { imported } = importReviews(
            store,
            event.tenant,
            event.provider,
            event.locationId,
            event.reviews,
            { atomic: false },
          );
          const connection =
            store.get(event.tenant, "integrations", event.provider) || {};
          store.put(
            event.tenant,
            "integrations",
            {
              ...connection,
              status: "connected",
              lastSyncAt: new Date().toISOString(),
              ...(event.photoVerified !== undefined
                ? { photoVerified: event.photoVerified }
                : {}),
            },
            event.provider,
          );
          store.db
            .prepare("INSERT INTO webhook_events(tenant,id) VALUES(?,?)")
            .run(event.tenant, event.id);
          return { imported };
        });
        res.json({ ok: true, ...outcome });
      } catch (error) {
        next(error);
      }
    },
  );
  app.use(express.json({ limit: "1mb" }));
  const authenticate = createAuth(env, transport);
  app.post("/api/session", (req, res, next) => {
    if (!env.AUTH_JWKS_URL || typeof req.body?.token !== "string")
      return res
        .status(400)
        .json({ error: "Canonical sign-in is not configured." });
    req.headers.authorization = `Bearer ${req.body.token}`;
    authenticate(req, res, (error) => {
      if (error) return next(error);
      res.cookie("review_session", req.body.token, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 3600000,
      });
      res.json({ ok: true });
    });
  });
  app.get(
    "/api/oauth/google/callback",
    asyncRoute(async (req, res) => {
      const cookie = (req.headers.cookie || "")
        .split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("review_google_state="))
        ?.split("=")[1];
      await finishGoogle(store, req.query, cookie, env, transport);
      res.clearCookie("review_google_state", {
        path: "/api/oauth/google",
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
      });
      res.redirect("/integrations?google=connected");
    }),
  );
  // Rate-limited, consent-aware first-party review collection. No rating gating.
  const limits = new Map();
  app.use("/api/public", (req, res, next) => {
    const now = Date.now();
    const key = req.socket.remoteAddress;
    const entry = limits.get(key) || { at: now, count: 0 };
    if (now - entry.at > 60000) {
      entry.at = now;
      entry.count = 0;
    }
    entry.count++;
    limits.set(key, entry);
    if (limits.size > 10000) limits.clear();
    if (entry.count > 60)
      return res
        .status(429)
        .json({ error: "Please wait a minute before trying again." });
    next();
  });
  app.get("/api/public/pages/:slug", (req, res, next) => {
    try {
      const found = required(publicPage(store, req.params.slug));
      const page = store.get(found.tenant, "pages", found.id);
      const settings = store.get(found.tenant, "settings", "workspace");
      res.json({
        name: settings.name,
        title: page.title,
        description: page.description,
        thankYou: settings.thankYou,
      });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/public/pages/:slug", (req, res, next) => {
    try {
      const found = required(publicPage(store, req.params.slug));
      const page = store.get(found.tenant, "pages", found.id);
      const data = publicFeedback.parse(req.body);
      const token =
        typeof req.body.requestToken === "string" ? req.body.requestToken : "";
      const request = token ? store.get(found.tenant, "requests", token) : null;
      if (
        token &&
        (!request ||
          request.pageId !== page.id ||
          new Date(request.expiresAt).getTime() < Date.now())
      )
        fail(400, "This review invitation has expired.");
      if (request?.status === "completed")
        fail(409, "This invitation has already received feedback.");
      const settings = store.get(found.tenant, "settings", "workspace");
      store.transaction(() => {
        const review = store.put(found.tenant, "reviews", {
          ...data,
          provider: "takatak",
          externalId: randomUUID(),
          locationId: page.locationId,
          publishedAt: new Date().toISOString(),
          recommended: true,
          reply: "",
          sample: false,
        });
        if (request)
          store.put(
            found.tenant,
            "requests",
            { ...request, status: "completed" },
            request.id,
          );
        store.put(found.tenant, "notifications", {
          title: "New customer feedback",
          text: `${data.author} shared a ${data.rating}-star experience.`,
          reviewId: review.id,
          locationId: page.locationId,
          read: false,
        });
        const rules = store.list(found.tenant, "automations", page.locationId);
        const ruleAlert = rules.some(
          (a) =>
            a.enabled &&
            (a.trigger === "new_review" ||
              (a.trigger === "low_rating" && data.rating <= 3) ||
              a.trigger === "unanswered"),
        );
        if ((settings.alertsEnabled || ruleAlert) && settings.alertEmail)
          store.enqueue(found.tenant, `review-alert:${review.id}`, "alert", {
            to: settings.alertEmail,
            subject: `New review · ${settings.name}`,
            text: data.text,
          });
      });
      res.status(201).json({ ok: true, message: settings.thankYou });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/public/widgets/:id", (req, res, next) => {
    try {
      const row = store.db
        .prepare("SELECT tenant FROM records WHERE kind='widgets' AND id=?")
        .get(req.params.id);
      required(row);
      const widget = store.get(row.tenant, "widgets", req.params.id);
      const reviews = store
        .list(row.tenant, "reviews", widget.locationId)
        .filter(
          (r) =>
            r.provider === "takatak" &&
            r.publishConsent &&
            !r.hidden &&
            r.recommended !== false &&
            r.rating >= widget.minRating,
        )
        .slice(0, widget.limit);
      res.json({
        widget: { name: widget.name, type: widget.type },
        reviews: reviews.map(
          ({ author, rating, text, publishedAt, reply }) => ({
            author,
            rating,
            text,
            publishedAt,
            reply,
          }),
        ),
      });
    } catch (e) {
      next(e);
    }
  });
  app.use("/api", authenticate);
  app.use("/api", (req, _res, next) => {
    ensureWorkspace(store, req.identity.tenant);
    if (req.identity.mode === "canonical")
      store.put(
        req.identity.tenant,
        "runtime_entitlements",
        { modules: req.identity.modules, expiresAt: req.identity.expiresAt },
        "canonical",
      );
    next();
  });
  app.get("/api/bootstrap", (req, res) => {
    const tenant = req.identity.tenant;
    const location = scopeLocation(store, tenant, req.query.location);
    const reviews = store
      .list(tenant, "reviews", location)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    const requests = store.list(tenant, "requests", location);
    const integrations = providers.map((p) => {
      const connection = store.get(tenant, "integrations", p.id);
      return {
        ...p,
        lastSyncAt: connection?.lastSyncAt,
        photoVerified: connection?.photoVerified,
        id: p.id,
        status:
          p.mode === "native"
            ? "connected"
            : connection?.status || "not_connected",
        configured:
          p.mode === "native" ||
          (p.id === "google" && googleConfigured(env)) ||
          Boolean(env.REVIEW_BRIDGE_URL && env.REVIEW_BRIDGE_KEY),
        entitled:
          p.mode === "native" || req.identity.modules.includes("reputation"),
        canReply:
          p.mode === "native" ||
          (p.id === "google" &&
            Boolean(
              googleConfigured(env) ||
              (env.REVIEW_BRIDGE_URL && env.REVIEW_BRIDGE_KEY),
            )),
        nativeGoogle: p.id === "google" && googleConfigured(env),
        linkedLocations:
          p.id === "google"
            ? store
                .list(tenant, "google_links")
                .map((l) => ({ locationId: l.locationId, title: l.title }))
            : [],
      };
    });
    res.json({
      identity: { role: req.identity.role, mode: req.identity.mode },
      settings: store.get(tenant, "settings", "workspace"),
      locations: store.list(tenant, "locations"),
      reviews,
      requests,
      customers: store.list(tenant, "customers", location),
      pages: store.list(tenant, "pages", location),
      widgets: store.list(tenant, "widgets", location),
      automations: store.list(tenant, "automations", location),
      messages: store.list(tenant, "messages", location),
      notifications: store
        .list(tenant, "notifications", location)
        .slice(0, 100),
      integrations,
      metrics: metrics(reviews, requests),
      outbox: store.outbox(tenant),
      capabilities: {
        email: Boolean(
          env.RESEND_API_KEY && env.EMAIL_FROM && env.ALLOW_DELIVERY === "true",
        ),
        billing: Boolean(
          env.TAKATAK_BILLING_URL && safeHttps(env.TAKATAK_BILLING_URL),
        ),
        ai: false,
      },
    });
  });
  app.post("/api/session/logout", (req, res) => {
    res.clearCookie("review_session", {
      path: "/",
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
    });
    res.json({ ok: true });
  });
  app.delete("/api/integrations/google", (req, res) => {
    if (!["owner", "admin"].includes(req.identity.role))
      fail(403, "Only an owner or admin can disconnect a source.");
    store.transaction(() => {
      store.delete(req.identity.tenant, "google_credentials", "oauth");
      store.delete(req.identity.tenant, "google_catalog", "verified");
      store.delete(req.identity.tenant, "integrations", "google");
      for (const state of store.list(req.identity.tenant, "oauth"))
        store.delete(req.identity.tenant, "oauth", state.id);
      for (const row of store.list(req.identity.tenant, "google_links"))
        store.delete(req.identity.tenant, "google_links", row.id);
    });
    res.json({ ok: true });
  });
  app.post("/api/integrations/google/connect", (req, res) => {
    if (!["owner", "admin"].includes(req.identity.role))
      fail(403, "An owner or admin must connect this source.");
    if (!req.identity.modules.includes("reputation"))
      fail(402, "Enable the Reputation module through TAKATAK billing.");
    const result = startGoogle(
      store,
      req.identity.tenant,
      req.identity.userId,
      env,
    );
    res.cookie("review_google_state", result.state, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/api/oauth/google",
      maxAge: 600000,
    });
    res.json({ url: result.url });
  });
  app.get(
    "/api/integrations/google/locations",
    asyncRoute(async (req, res) => {
      if (!req.identity.modules.includes("reputation"))
        fail(402, "Enable the Reputation module through TAKATAK billing.");
      res.json({
        locations: await googleLocations(
          store,
          req.identity.tenant,
          env,
          transport,
        ),
      });
    }),
  );
  app.post("/api/integrations/google/locations", (req, res) => {
    if (!["owner", "admin"].includes(req.identity.role))
      fail(403, "Only an owner or admin can link locations.");
    if (!req.identity.modules.includes("reputation"))
      fail(402, "Enable the Reputation module through TAKATAK billing.");
    const data = z
      .object({ locationId: z.string(), remoteId: z.string() })
      .parse(req.body);
    linkGoogleLocation(
      store,
      req.identity.tenant,
      data.locationId,
      data.remoteId,
    );
    res.json({ ok: true });
  });
  app.post("/api/sample", (req, res) => {
    if (req.identity.mode !== "local")
      fail(403, "Sample data is only available in local development.");
    loadSample(store, req.identity.tenant);
    res.json({ ok: true });
  });
  app.delete("/api/sample", (req, res) => {
    if (req.identity.mode !== "local")
      fail(403, "Sample data is only available in local development.");
    store.transaction(() => {
      const tenant = req.identity.tenant;
      const sampleCustomers = new Set(
        store
          .list(tenant, "customers")
          .filter((r) => r.sample)
          .map((r) => r.id),
      );
      for (const request of store.list(tenant, "requests"))
        if (sampleCustomers.has(request.customerId))
          store.delete(tenant, "requests", request.id);
      store.db
        .prepare(
          "DELETE FROM deliveries WHERE tenant=? AND json_extract(body,'$.sample')=1",
        )
        .run(tenant);
      for (const kind of ["customers", "reviews", "notifications"])
        for (const row of store.list(tenant, kind))
          if (row.sample) store.delete(tenant, kind, row.id);
      for (const location of store.list(tenant, "locations")) {
        if (!location.sample) continue;
        const occupied = [
          "customers",
          "reviews",
          "requests",
          "pages",
          "widgets",
          "automations",
          "messages",
        ].some((kind) => store.list(tenant, kind, location.id).length);
        if (!occupied) store.delete(tenant, "locations", location.id);
      }
    });
    res.json({ ok: true });
  });
  app.put("/api/settings", (req, res) => {
    if (!["owner", "admin"].includes(req.identity.role))
      fail(403, "Only a workspace owner or admin can change settings.");
    const data = settingsSchema.parse(req.body);
    if (data.alertsEnabled && !data.alertEmail)
      fail(400, "Add an alert email address first.");
    res.json(store.put(req.identity.tenant, "settings", data, "workspace"));
  });
  const resources = {
    customers: customerSchema,
    pages: pageSchema,
    widgets: widgetSchema,
    automations: automationSchema,
    locations: locationSchema,
  };
  for (const [kind, schema] of Object.entries(resources)) {
    app.post(`/api/${kind}`, (req, res) => {
      const data = schema.parse(req.body);
      if (kind !== "locations")
        scopeLocation(store, req.identity.tenant, data.locationId);
      if (kind === "pages") data.slug = `review-${publicId()}`;
      res.status(201).json(store.put(req.identity.tenant, kind, data));
    });
    app.put(`/api/${kind}/:id`, (req, res) => {
      const old = required(store.get(req.identity.tenant, kind, req.params.id));
      const data = schema.parse(req.body);
      if (kind !== "locations")
        scopeLocation(store, req.identity.tenant, data.locationId);
      res.json(
        store.put(req.identity.tenant, kind, { ...old, ...data }, old.id),
      );
    });
    app.delete(`/api/${kind}/:id`, (req, res) => {
      const old = required(store.get(req.identity.tenant, kind, req.params.id));
      if (kind === "locations") {
        if (store.list(req.identity.tenant, "locations").length < 2)
          fail(409, "Keep at least one location.");
        if (
          [
            "customers",
            "pages",
            "widgets",
            "reviews",
            "automations",
            "requests",
            "messages",
          ].some((k) => store.list(req.identity.tenant, k, old.id).length)
        )
          fail(409, "This location still contains records.");
      }
      if (
        kind === "pages" &&
        store
          .list(req.identity.tenant, "requests")
          .some((r) => r.pageId === old.id && r.status !== "completed")
      )
        fail(409, "This page still has active invitations.");
      store.delete(req.identity.tenant, kind, old.id);
      res.json({ ok: true });
    });
  }
  app.post("/api/customers/import", (req, res) => {
    const rows = z.array(customerSchema).min(1).max(1000).parse(req.body.rows);
    const tenant = req.identity.tenant;
    const emails = new Set(
      store
        .list(tenant, "customers")
        .map((r) => `${r.locationId}:${r.email.toLowerCase()}`),
    );
    let imported = 0,
      skipped = 0;
    store.transaction(() => {
      for (const row of rows) {
        scopeLocation(store, tenant, row.locationId);
        const key = `${row.locationId}:${row.email.toLowerCase()}`;
        if (row.email && emails.has(key)) {
          skipped++;
          continue;
        }
        store.put(tenant, "customers", row);
        emails.add(key);
        imported++;
      }
    });
    res.status(201).json({ imported, skipped });
  });
  app.get("/api/export/:kind", (req, res) => {
    if (!["reviews", "customers", "requests"].includes(req.params.kind))
      fail(404, "Unknown export.");
    const tenant = req.identity.tenant;
    const rows = store.list(
      tenant,
      req.params.kind,
      scopeLocation(store, tenant, req.query.location),
    );
    const columns =
      req.params.kind === "reviews"
        ? ["author", "provider", "rating", "text", "reply", "publishedAt"]
        : req.params.kind === "customers"
          ? ["name", "email", "phone", "consent"]
          : ["id", "customerName", "channel", "status", "createdAt"];
    res
      .type("text/csv")
      .attachment(`takatak-${req.params.kind}.csv`)
      .send(csv(rows, columns));
  });
  app.post("/api/requests", (req, res) => {
    const data = z
      .object({
        customerIds: z.array(z.string()).min(1).max(100),
        pageId: z.string(),
        channel: z.enum(["link", "email"]),
      })
      .parse(req.body);
    const tenant = req.identity.tenant;
    const page = required(store.get(tenant, "pages", data.pageId));
    if (!page.active) fail(409, "This review page is paused.");
    const ids = [...new Set(data.customerIds)];
    const customers = ids.map((id) =>
      required(store.get(tenant, "customers", id)),
    );
    for (const c of customers) {
      if (c.locationId !== page.locationId)
        fail(
          400,
          "Customers and review page must belong to the same location.",
        );
      if (data.channel === "email" && (!c.consent || !c.email))
        fail(
          400,
          "Email requests require an address and explicit contact consent.",
        );
    }
    const settings = store.get(tenant, "settings", "workspace");
    const created = [];
    store.transaction(() => {
      for (const c of customers) {
        const id = publicId();
        const path = `/r/${page.slug}?request=${id}`;
        const row = store.put(
          tenant,
          "requests",
          {
            customerId: c.id,
            customerName: c.name,
            pageId: page.id,
            locationId: page.locationId,
            channel: data.channel,
            status: data.channel === "link" ? "link_ready" : "queued",
            path,
            expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
          },
          id,
        );
        created.push(row);
        if (data.channel === "email")
          store.enqueue(tenant, `request:${id}`, "request", {
            to: c.email,
            subject: settings.requestSubject,
            text: settings.requestBody
              .replaceAll("{business}", settings.name)
              .replaceAll("{link}", localOrigin(env, req) + path),
            requestId: id,
            sample: !!c.sample,
          });
      }
    });
    res.status(201).json({ requests: created });
  });
  app.patch("/api/notifications/read", (req, res) => {
    const tenant = req.identity.tenant;
    for (const row of store.list(tenant, "notifications"))
      store.put(tenant, "notifications", { ...row, read: true }, row.id);
    res.json({ ok: true });
  });
  app.patch("/api/reviews/:id", (req, res) => {
    const tenant = req.identity.tenant;
    const review = required(store.get(tenant, "reviews", req.params.id));
    const data = z
      .object({
        tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
        hidden: z.boolean().optional(),
      })
      .parse(req.body);
    res.json(store.put(tenant, "reviews", { ...review, ...data }, review.id));
  });
  app.post(
    "/api/reviews/:id/reply",
    asyncRoute(async (req, res) => {
      const tenant = req.identity.tenant;
      const review = required(store.get(tenant, "reviews", req.params.id));
      const { text } = sendSchema.parse(req.body);
      if (review.sample)
        fail(
          409,
          "Sample reviews cannot be published to a provider. Collect a real first-party review to test a reply.",
        );
      if (review.provider === "yelp")
        fail(
          409,
          "Yelp replies are gated by provider verification and supported API access.",
        );
      if (review.provider !== "takatak") {
        if (!req.identity.modules.includes("reputation"))
          fail(402, "Enable the Reputation module through TAKATAK billing.");
        if (
          review.provider === "google" &&
          googleConfigured(env) &&
          store.get(tenant, "google_credentials", "oauth")
        ) {
          await replyToGoogle(store, tenant, review, text, env, transport);
          return res.json(
            store.put(
              tenant,
              "reviews",
              { ...review, reply: text, repliedAt: new Date().toISOString() },
              review.id,
            ),
          );
        }
        if (
          review.provider !== "google" ||
          !env.REVIEW_BRIDGE_URL ||
          !env.REVIEW_BRIDGE_KEY
        )
          fail(503, "Provider reply access is not configured.");
        if (!safeHttps(env.REVIEW_BRIDGE_URL))
          fail(503, "The provider bridge requires HTTPS.");
        const result = await transport(
          `${env.REVIEW_BRIDGE_URL.replace(/\/$/, "")}/v1/reviews/reply`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${env.REVIEW_BRIDGE_KEY}` },
            body: {
              tenant,
              provider: review.provider,
              externalId: review.externalId,
              locationId: review.locationId,
              text,
              idempotencyKey: createHmac("sha256", "reply-v1")
                .update(`${tenant}:${review.id}:${text}`)
                .digest("hex"),
            },
          },
        );
        if (result.published !== true)
          fail(502, "The provider did not confirm publication.");
      }
      res.json(
        store.put(
          tenant,
          "reviews",
          { ...review, reply: text, repliedAt: new Date().toISOString() },
          review.id,
        ),
      );
    }),
  );
  app.post("/api/reviews/:id/messages", (req, res) => {
    const tenant = req.identity.tenant;
    const review = required(store.get(tenant, "reviews", req.params.id));
    const data = sendSchema.parse(req.body);
    if (review.provider !== "takatak" || review.sample)
      fail(409, "Direct messaging is unavailable for this provider.");
    if (!review.contactAllowed)
      fail(403, "This customer has not consented to follow-up.");
    res.status(201).json(
      store.put(tenant, "messages", {
        reviewId: review.id,
        customerName: review.author,
        text: data.text,
        locationId: review.locationId,
        status: "saved",
        direction: "outbound",
        channel: "internal_note",
      }),
    );
  });
  app.post(
    "/api/integrations/:provider/sync",
    asyncRoute(async (req, res) => {
      const tenant = req.identity.tenant;
      const provider = req.params.provider;
      if (!providerKeys.includes(provider) || provider === "takatak")
        fail(400, "Select an external review provider.");
      if (!req.identity.modules.includes("reputation"))
        fail(
          402,
          "This integration requires the Reputation module in TAKATAK billing.",
        );
      const locationId = scopeLocation(
        store,
        tenant,
        z.string().min(1).parse(req.body.locationId),
      );
      if (
        provider === "google" &&
        googleConfigured(env) &&
        store.get(tenant, "google_credentials", "oauth")
      ) {
        const items = await fetchGoogleReviews(
          store,
          tenant,
          locationId,
          env,
          transport,
        );
        const outcome = importReviews(
          store,
          tenant,
          provider,
          locationId,
          items,
        );
        store.put(
          tenant,
          "integrations",
          { status: "connected", lastSyncAt: new Date().toISOString() },
          provider,
        );
        return res.json({ ok: true, ...outcome });
      }
      if (
        !env.REVIEW_BRIDGE_URL ||
        !env.REVIEW_BRIDGE_KEY ||
        !safeHttps(env.REVIEW_BRIDGE_URL)
      )
        fail(503, "The provider bridge is not configured.");
      const result = await transport(
        `${env.REVIEW_BRIDGE_URL.replace(/\/$/, "")}/v1/reviews/sync`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${env.REVIEW_BRIDGE_KEY}` },
          body: { tenant, provider, locationId },
        },
      );
      const batch = z
        .object({
          complete: z.literal(true),
          reviews: z.array(reviewSchema).max(500),
        })
        .parse(result);
      const outcome = importReviews(
        store,
        tenant,
        provider,
        locationId,
        batch.reviews,
      );
      store.put(
        tenant,
        "integrations",
        { status: "connected", lastSyncAt: new Date().toISOString() },
        provider,
      );
      res.json({ ok: true, ...outcome });
    }),
  );
  app.post("/api/billing/checkout", (req, res) => {
    if (!["owner", "admin"].includes(req.identity.role))
      fail(403, "Only an owner or admin can manage billing.");
    if (!env.TAKATAK_BILLING_URL || !safeHttps(env.TAKATAK_BILLING_URL))
      fail(503, "Connect the existing TAKATAK Stripe billing portal first.");
    res.json({ url: env.TAKATAK_BILLING_URL });
  });
  app.post(
    "/api/outbox/retry",
    asyncRoute(async (req, res) => {
      if (!["owner", "admin"].includes(req.identity.role))
        fail(403, "Only an owner or admin can process delivery.");
      res.json(await processOutbox(store, env, transport, req.identity.tenant));
    }),
  );
  app.get("/api/audit", (req, res) =>
    res.json({
      outbox: store.outbox(req.identity.tenant),
      providerState: store.list(req.identity.tenant, "integrations"),
    }),
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API endpoint not found." }),
  );
  if (existsSync(resolve("dist/index.html"))) {
    app.use(express.static(resolve("dist"), { index: false }));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(resolve("dist/index.html")),
    );
  }
  app.use((error, _req, res, _next) => {
    const status =
      error instanceof z.ZodError || error instanceof SyntaxError
        ? 400
        : error.status || 500;
    res.status(status).json({
      error:
        error instanceof SyntaxError
          ? "The JSON body is invalid."
          : error instanceof z.ZodError
            ? error.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("; ")
            : status < 500
              ? error.message
              : "The operation could not be completed. Please try again or check server configuration.",
    });
  });
  return { app, store };
}

export async function processOutbox(
  store,
  env,
  transport = requestJson,
  tenant = null,
) {
  if (env.ALLOW_DELIVERY !== "true" || !env.RESEND_API_KEY || !env.EMAIL_FROM)
    return {
      processed: 0,
      blocked: "Email delivery is not configured. Nothing was sent.",
    };
  const rows = store.db
    .prepare(
      `SELECT * FROM deliveries WHERE status IN ('pending','retry') AND attempts<5 ${tenant ? "AND tenant=?" : ""} ORDER BY updated LIMIT 25`,
    )
    .all(...(tenant ? [tenant] : []));
  let processed = 0,
    failed = 0;
  for (const row of rows) {
    const data = JSON.parse(row.body);
    if (data.sample) {
      store.db
        .prepare(
          "UPDATE deliveries SET status='sample_blocked',updated=? WHERE id=?",
        )
        .run(new Date().toISOString(), row.id);
      continue;
    }
    if (row.kind === "request" && data.requestId) {
      const invitation = store.get(row.tenant, "requests", data.requestId);
      const customer = invitation
        ? store.get(row.tenant, "customers", invitation.customerId)
        : null;
      const expired =
        invitation && new Date(invitation.expiresAt).getTime() < Date.now();
      if (
        !invitation ||
        invitation.status === "completed" ||
        expired ||
        !customer?.consent ||
        customer.email.toLowerCase() !== String(data.to).toLowerCase()
      ) {
        store.db
          .prepare(
            "UPDATE deliveries SET status='canceled',updated=? WHERE id=?",
          )
          .run(new Date().toISOString(), row.id);
        if (invitation && invitation.status !== "completed")
          store.put(
            row.tenant,
            "requests",
            { ...invitation, status: expired ? "expired" : "canceled" },
            invitation.id,
          );
        continue;
      }
    }
    const claimed = store.db
      .prepare(
        "UPDATE deliveries SET status='sending',attempts=attempts+1,updated=? WHERE id=? AND status IN ('pending','retry')",
      )
      .run(new Date().toISOString(), row.id);
    if (!claimed.changes) continue;
    try {
      const result = await transport("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Idempotency-Key": row.id,
        },
        body: {
          from: env.EMAIL_FROM,
          to: [data.to],
          subject: data.subject,
          text: data.text,
        },
      });
      if (typeof result.id !== "string" || !result.id)
        throw new Error("Missing delivery acceptance");
      store.db
        .prepare("UPDATE deliveries SET status='accepted',updated=? WHERE id=?")
        .run(new Date().toISOString(), row.id);
      if (data.requestId) {
        const request = store.get(row.tenant, "requests", data.requestId);
        if (request && request.status !== "completed")
          store.put(
            row.tenant,
            "requests",
            { ...request, status: "accepted" },
            request.id,
          );
      }
      processed++;
    } catch {
      store.db
        .prepare("UPDATE deliveries SET status='retry',updated=? WHERE id=?")
        .run(new Date().toISOString(), row.id);
      failed++;
    }
  }
  return { processed, failed };
}
