import { z } from "zod";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";

export const providerKeys = [
  "takatak",
  "google",
  "tripadvisor",
  "yelp",
  "facebook",
  "trustpilot",
];
export const providers = [
  {
    id: "takatak",
    name: "TAKATAK",
    initial: "T",
    color: "#1565d8",
    description: "Your own feedback, review pages, and customer conversations.",
    mode: "native",
    price: "Included",
  },
  {
    id: "google",
    name: "Google Business Profile",
    initial: "G",
    color: "#4285f4",
    description:
      "Bring your locations and customer reviews into one workspace.",
    mode: "api",
    price: "Paid integration",
  },
  {
    id: "tripadvisor",
    name: "TripAdvisor",
    initial: "t",
    color: "#16806a",
    description:
      "Keep travel and hospitality reviews in your reputation cockpit.",
    mode: "bridge",
    price: "Paid integration",
  },
  {
    id: "yelp",
    name: "Yelp",
    initial: "y",
    color: "#c64245",
    description:
      "A dedicated review workspace with provider-specific reply rules.",
    mode: "bridge",
    price: "Paid integration",
  },
  {
    id: "facebook",
    name: "Facebook",
    initial: "f",
    color: "#1877f2",
    description:
      "Monitor recommendations alongside your other review channels.",
    mode: "bridge",
    price: "Paid integration",
  },
  {
    id: "trustpilot",
    name: "Trustpilot",
    initial: "★",
    color: "#16806a",
    description: "Bring verified customer experiences into your workspace.",
    mode: "bridge",
    price: "Paid integration",
  },
];
const text = (max = 200) => z.string().trim().max(max);
const email = z.string().trim().email().max(254);
export const locationSchema = z.object({
  name: text(100).min(2),
  address: text(300).default(""),
  timezone: text(80).default("America/Toronto"),
});
export const customerSchema = z.object({
  name: text(100).min(1),
  email: z.union([email, z.literal("")]).default(""),
  phone: text(30)
    .regex(/^[+\d() .-]*$/)
    .default(""),
  tags: z.array(text(40).min(1)).max(20).default([]),
  consent: z.boolean().default(false),
  locationId: text(100).min(1),
});
export const pageSchema = z.object({
  name: text(100).min(2),
  title: text(160).min(2),
  description: text(1000).default(""),
  active: z.boolean().default(true),
  locationId: text(100).min(1),
});
export const widgetSchema = z.object({
  name: text(100).min(2),
  type: z.enum(["carousel", "grid", "badge", "wall", "popup", "list"]),
  minRating: z.number().int().min(1).max(5).default(1),
  limit: z.number().int().min(1).max(30).default(6),
  locationId: text(100).min(1),
});
export const automationSchema = z.object({
  name: text(100).min(2),
  enabled: z.boolean(),
  trigger: z.enum(["new_review", "low_rating", "unanswered"]),
  action: z.literal("notify"),
  locationId: text(100).min(1),
});
export const settingsSchema = z.object({
  name: text(100).min(2),
  description: text(500).default(""),
  language: z.enum(["en", "fr"]).default("en"),
  alertEmail: z.union([email, z.literal("")]).default(""),
  alertsEnabled: z.boolean().default(false),
  requestSubject: text(200).min(1),
  requestBody: text(2000).min(1),
  thankYou: text(500),
  signature: text(200),
  reminderDays: z.number().int().min(1).max(30),
});
export const reviewSchema = z.object({
  externalId: text(200).min(1),
  author: text(100).min(1),
  rating: z.number().int().min(1).max(5),
  text: text(10000),
  publishedAt: z.string().datetime(),
  sourceUpdatedAt: z.string().datetime().optional(),
  recommended: z.boolean().default(true),
  contactAllowed: z.boolean().default(false),
  publishConsent: z.boolean().default(false),
  reply: text(5000).default(""),
  reviewer: z
    .object({
      city: text(200).default(""),
      friends: z.number().int().nonnegative().default(0),
      reviews: z.number().int().nonnegative().default(0),
      photos: z.number().int().nonnegative().default(0),
    })
    .default({}),
});
export function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
export function required(record) {
  if (!record) fail(404, "Not found in this workspace.");
  return record;
}
export function metrics(reviews, requests) {
  const included = reviews.filter((r) => r.recommended !== false);
  const total = included.length;
  return {
    total,
    average: total ? included.reduce((n, r) => n + r.rating, 0) / total : null,
    unanswered: included.filter((r) => !r.reply).length,
    responseRate: total
      ? Math.round((included.filter((r) => !!r.reply).length * 100) / total)
      : 0,
    requests: requests.length,
    distribution: [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: included.filter((r) => r.rating === rating).length,
    })),
  };
}
export function mergeReview(old, item) {
  if (
    old?.sourceUpdatedAt &&
    item.sourceUpdatedAt &&
    new Date(item.sourceUpdatedAt) < new Date(old.sourceUpdatedAt)
  )
    return old;
  const merged = { ...old, ...item };
  if (
    old?.repliedAt &&
    (!item.sourceUpdatedAt ||
      new Date(item.sourceUpdatedAt) < new Date(old.repliedAt))
  )
    merged.reply = old.reply;
  return merged;
}
export function importReviews(
  store,
  tenant,
  provider,
  locationId,
  items,
  { atomic = true } = {},
) {
  const settings = store.get(tenant, "settings", "workspace");
  let imported = 0;
  const apply = () => {
    for (const item of items) {
      const id = createHmac("sha256", "takatak-review-id-v1")
        .update(`${provider}:${locationId}:${item.externalId}`)
        .digest("hex");
      const old = store.get(tenant, "reviews", id);
      store.put(
        tenant,
        "reviews",
        { ...mergeReview(old, item), provider, locationId, sample: false },
        id,
      );
      if (!old) {
        imported++;
        store.put(tenant, "notifications", {
          title: "New review",
          text: `${item.author} left a ${item.rating}-star review.`,
          reviewId: id,
          locationId,
          read: false,
        });
        const automations = store.list(tenant, "automations", locationId);
        const automationWantsAlert = automations.some(
          (a) =>
            a.enabled &&
            (a.trigger === "new_review" ||
              (a.trigger === "low_rating" && item.rating <= 3) ||
              (a.trigger === "unanswered" && !item.reply)),
        );
        if (settings.alertsEnabled || automationWantsAlert) {
          if (settings.alertEmail)
            store.enqueue(tenant, `review-alert:${id}`, "alert", {
              to: settings.alertEmail,
              subject: `New ${item.rating}-star review · ${settings.name}`,
              text: `${item.author}: ${item.text}`,
              reviewId: id,
            });
        }
      }
    }
  };
  if (atomic) store.transaction(apply);
  else apply();
  return { imported, total: items.length };
}
export function verifySignature(raw, signature, secret, now = Date.now()) {
  if (!secret || typeof signature !== "string") return false;
  const values = Object.fromEntries(
    signature.split(",").map((s) => s.split("=")),
  );
  if (!/^\d+$/.test(values.t || "") || !/^[a-f0-9]{64}$/.test(values.v1 || ""))
    return false;
  if (Math.abs(now / 1000 - Number(values.t)) > 300) return false;
  const expected = createHmac("sha256", secret)
    .update(`${values.t}.`)
    .update(raw)
    .digest();
  return timingSafeEqual(expected, Buffer.from(values.v1, "hex"));
}
export function csv(rows, columns) {
  const escape = (value) =>
    '"' +
    String(value ?? "")
      .replace(/^[=+\-@\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  return [
    columns.join(","),
    ...rows.map((r) => columns.map((c) => escape(r[c])).join(",")),
  ].join("\r\n");
}
export function publicId() {
  return randomUUID().replaceAll("-", "");
}
