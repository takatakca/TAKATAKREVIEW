import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export class Store {
  constructor(path = "var/review.sqlite") {
    if (path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS records (id TEXT NOT NULL, tenant TEXT NOT NULL, kind TEXT NOT NULL, location TEXT NOT NULL DEFAULT '', body TEXT NOT NULL, created TEXT NOT NULL, updated TEXT NOT NULL, PRIMARY KEY(tenant,kind,id));
      CREATE INDEX IF NOT EXISTS records_scope ON records(tenant,kind,location);
      CREATE TABLE IF NOT EXISTS deliveries (id TEXT PRIMARY KEY, tenant TEXT NOT NULL, key TEXT NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, updated TEXT NOT NULL, UNIQUE(tenant,key));
      CREATE TABLE IF NOT EXISTS webhook_events (tenant TEXT NOT NULL, id TEXT NOT NULL, PRIMARY KEY(tenant,id));`);
  }
  list(tenant, kind, location = "") {
    const rows = location
      ? this.db
          .prepare(
            "SELECT * FROM records WHERE tenant=? AND kind=? AND location=? ORDER BY created DESC,id",
          )
          .all(tenant, kind, location)
      : this.db
          .prepare(
            "SELECT * FROM records WHERE tenant=? AND kind=? ORDER BY created DESC,id",
          )
          .all(tenant, kind);
    return rows.map(this.decode);
  }
  decode(row) {
    return row
      ? {
          ...JSON.parse(row.body),
          id: row.id,
          locationId: row.location,
          createdAt: row.created,
          updatedAt: row.updated,
        }
      : null;
  }
  get(tenant, kind, id) {
    return this.decode(
      this.db
        .prepare("SELECT * FROM records WHERE tenant=? AND kind=? AND id=?")
        .get(tenant, kind, id),
    );
  }
  put(tenant, kind, data, id = randomUUID()) {
    const existing = this.get(tenant, kind, id);
    const now = new Date().toISOString();
    const { id: _, createdAt, updatedAt, ...body } = data;
    this.db
      .prepare(
        `INSERT INTO records(id,tenant,kind,location,body,created,updated) VALUES(?,?,?,?,?,?,?) ON CONFLICT(tenant,kind,id) DO UPDATE SET body=excluded.body,location=excluded.location,updated=excluded.updated`,
      )
      .run(
        id,
        tenant,
        kind,
        data.locationId || "",
        JSON.stringify(body),
        existing?.createdAt || now,
        now,
      );
    return this.get(tenant, kind, id);
  }
  delete(tenant, kind, id) {
    return (
      this.db
        .prepare("DELETE FROM records WHERE tenant=? AND kind=? AND id=?")
        .run(tenant, kind, id).changes > 0
    );
  }
  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  enqueue(tenant, key, kind, body) {
    const id = randomUUID();
    const result = this.db
      .prepare(
        "INSERT OR IGNORE INTO deliveries(id,tenant,key,kind,body,updated) VALUES(?,?,?,?,?,?)",
      )
      .run(
        id,
        tenant,
        key,
        kind,
        JSON.stringify(body),
        new Date().toISOString(),
      );
    return result.changes ? id : null;
  }
  outbox(tenant) {
    return this.db
      .prepare(
        "SELECT id,kind,status,attempts,updated FROM deliveries WHERE tenant=? ORDER BY updated DESC LIMIT 100",
      )
      .all(tenant);
  }
  close() {
    this.db.close();
  }
}

export function ensureWorkspace(store, tenant) {
  if (!store.get(tenant, "settings", "workspace")) {
    store.transaction(() => {
      store.put(
        tenant,
        "settings",
        {
          name: "My business",
          description: "",
          language: "en",
          photoVerified: false,
          alertsEnabled: false,
          alertEmail: "",
          requestSubject: "How was your experience?",
          requestBody:
            "Thank you for choosing {business}. Share your honest feedback: {link}",
          thankYou: "Thank you for sharing your experience.",
          signature: "The team",
          reminderDays: 7,
        },
        "workspace",
      );
      store.put(
        tenant,
        "locations",
        { name: "Main location", address: "", timezone: "America/Toronto" },
        "main",
      );
      store.put(
        tenant,
        "pages",
        {
          name: "Your review page",
          slug: `review-${randomUUID().slice(0, 12)}`,
          title: "Your experience matters",
          description: "We would love to hear how we did.",
          active: true,
          locationId: "main",
        },
        "main",
      );
    });
  }
}

export function loadSample(store, tenant) {
  ensureWorkspace(store, tenant);
  const names = [
    "Alex Morgan",
    "Camille Roy",
    "Jordan Lee",
    "Sam Parker",
    "Taylor Chen",
    "Noah Martin",
    "Avery Wilson",
    "Robin Ellis",
  ];
  store.transaction(() => {
    names.forEach((name, i) => {
      const locationId = i === 7 ? "west" : "main";
      store.put(
        tenant,
        "customers",
        {
          name,
          email: `sample${i + 1}@example.com`,
          phone: "",
          tags: i % 2 ? ["Returning"] : ["New customer"],
          consent: true,
          sample: true,
          locationId,
        },
        `sample-customer-${i}`,
      );
      const publishedAt = new Date(
        Date.now() - (i * 3 + 1) * 86400000,
      ).toISOString();
      store.put(
        tenant,
        "reviews",
        {
          author: name,
          rating: [5, 5, 4, 5, 3, 5, 4, 5][i],
          text: [
            "A thoughtful team and a really smooth experience. Every detail was taken care of.",
            "Service attentionné et très professionnel. Une excellente expérience !",
            "Friendly, helpful, and quick to answer my questions. I would visit again.",
            "Exactly what we were looking for. Thank you to the whole team!",
            "The team was kind, but the wait was longer than expected.",
            "An excellent experience from start to finish. Highly appreciated.",
            "A great first visit. Clear communication made everything easy.",
            "Wonderful service and a warm welcome.",
          ][i],
          provider: [
            "google",
            "takatak",
            "google",
            "tripadvisor",
            "takatak",
            "yelp",
            "yelp",
            "google",
          ][i],
          externalId: `sample-${i}`,
          recommended: i !== 6,
          contactAllowed: i !== 5,
          reviewer: { city: "Montréal, QC", friends: 0, reviews: 2, photos: 0 },
          publishedAt,
          reply:
            i === 0
              ? "Thank you for your kind words, Alex. We look forward to welcoming you again!"
              : "",
          publishConsent: true,
          sample: true,
          locationId,
        },
        `sample-review-${i}`,
      );
    });
    store.put(
      tenant,
      "locations",
      {
        name: "West location · Sample",
        address: "Synthetic location",
        timezone: "America/Toronto",
        sample: true,
      },
      "west",
    );
    store.put(
      tenant,
      "notifications",
      {
        title: "Sample workspace loaded",
        text: "All sample customers and reviews are fictional. No providers are connected.",
        read: false,
        sample: true,
      },
      "sample-notice",
    );
  });
}
