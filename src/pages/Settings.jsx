import { useEffect, useState } from "react";
import {
  ChevronRight,
  Plus,
  PanelsTopLeft,
  LayoutGrid,
  Workflow,
  Settings,
  Bell,
  Check,
  MapPin,
  Mail,
  Globe,
  CheckCircle2,
  Lock,
  Trash2,
  Pencil,
  Sparkles,
  Code,
  Info,
  Building2,
  Layers,
  Tag,
} from "lucide-react";
import {
  api,
  nav,
  Stars,
  Provider,
  Badge,
  Button,
  Field,
  PageHead,
  Sources,
} from "../components/ui.jsx";

const settingSections = [
  ["general", "Project", Building2],
  ["locations", "Locations", MapPin],
  ["strategy", "Request strategy", Workflow],
  ["email", "Email templates", Mail],
  ["alerts", "Alerts & notifications", Bell],
  ["appearance", "Page appearance", PanelsTopLeft],
  ["sources", "Review sources", Globe],
  ["signature", "Signatures", Pencil],
  ["tags", "Tags", Tag],
  ["ai", "AI tools", Sparkles],
  ["api", "API & webhooks", Code],
];
function SettingsPage({ data, open, go, act, busy }) {
  const [section, setSection] = useState("general"),
    [values, setValues] = useState(data.settings),
    [saved, setSaved] = useState(false);
  useEffect(() => setValues(data.settings), [data.settings.updatedAt]);
  const set = (name, value) => {
    setValues((v) => ({ ...v, [name]: value }));
    setSaved(false);
  };
  async function save(e) {
    e.preventDefault();
    const result = await act(
      () => api("/settings", { method: "PUT", body: values }),
      "Workspace settings saved",
    );
    if (result) setSaved(true);
  }
  return (
    <>
      <PageHead
        title="Make it yours."
        description="The little details that make every interaction feel like your business."
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {settingSections.map(([key, label, Icon]) => (
            <button
              key={key}
              className={section === key ? "active" : ""}
              onClick={() => setSection(key)}
            >
              <Icon size={16} />
              {label}
              <ChevronRight size={13} />
            </button>
          ))}
        </nav>
        <div className="settings-content">
          <form onSubmit={save}>
            {section === "general" && (
              <section className="panel setting-card">
                <div className="panel-head">
                  <div>
                    <h2>Business profile</h2>
                    <p>Put a familiar face on your customer experience.</p>
                  </div>
                  <Building2 size={21} />
                </div>
                <div className="form-body">
                  <Field
                    label="Business name"
                    value={values.name}
                    onChange={(e) => set("name", e.target.value)}
                    required
                    maxLength={100}
                  />
                  <Field label="Business description">
                    <textarea
                      maxLength={500}
                      value={values.description}
                      onChange={(e) => set("description", e.target.value)}
                      placeholder="Tell customers a little about your business."
                    />
                  </Field>
                  <Field label="Content language">
                    <select
                      value={values.language}
                      onChange={(e) => set("language", e.target.value)}
                    >
                      <option value="en">English</option>
                      <option value="fr">Français canadien</option>
                    </select>
                  </Field>
                  <p className="subtle">
                    Language preference is stored for future provider/template
                    localization. The cockpit interface currently uses English.
                  </p>
                </div>
              </section>
            )}
            {section === "locations" && (
              <section className="panel setting-card">
                <div className="panel-head">
                  <div>
                    <h2>Your locations</h2>
                    <p>A local view of every customer experience.</p>
                  </div>
                  <Button
                    type="button"
                    icon={Plus}
                    onClick={() => open("location")}
                  >
                    Add location
                  </Button>
                </div>
                <div className="location-list">
                  {data.locations.map((l) => (
                    <div className="location-row" key={l.id}>
                      <span>
                        <MapPin size={20} />
                      </span>
                      <div>
                        <strong>{l.name}</strong>
                        <p>
                          {l.address || "Address not added"} · {l.timezone}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Edit ${l.name}`}
                        onClick={() => open("location", l)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Delete ${l.name}`}
                        onClick={() =>
                          open("delete", { kind: "locations", ...l })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {section === "strategy" && (
              <section className="panel setting-card">
                <div className="panel-head">
                  <div>
                    <h2>A thoughtful invitation strategy</h2>
                    <p>
                      Respectful requests. Honest feedback. No rating gating.
                    </p>
                  </div>
                  <Workflow size={21} />
                </div>
                <div className="form-body">
                  <div className="provider-note">
                    <Info size={18} />
                    <p>
                      Requests go to your own TAKATAK review page. This
                      workspace does not solicit Yelp reviews. Email requires
                      explicit customer consent.
                    </p>
                  </div>
                  <Field
                    label="Preferred reminder interval"
                    help="Stored as a team preference. Scheduled reminders are not sent automatically."
                    type="number"
                    min={1}
                    max={30}
                    value={values.reminderDays}
                    onChange={(e) =>
                      set("reminderDays", Number(e.target.value))
                    }
                  />
                  <Field
                    label="Thank-you message"
                    value={values.thankYou}
                    maxLength={500}
                    onChange={(e) => set("thankYou", e.target.value)}
                  />
                  <p className="subtle">
                    Every rating sees the same thank-you message and feedback
                    form.
                  </p>
                </div>
              </section>
            )}
            {section === "email" && (
              <section className="panel setting-card">
                <div className="panel-head">
                  <div>
                    <h2>A message that sounds like you</h2>
                    <p>Personal, clear, and easy to respond to.</p>
                  </div>
                  <Mail size={21} />
                </div>
                <div className="form-body">
                  <Field
                    label="Invitation subject"
                    required
                    maxLength={200}
                    value={values.requestSubject}
                    onChange={(e) => set("requestSubject", e.target.value)}
                  />
                  <Field
                    label="Invitation message"
                    help="Use {business} for your business name and {link} for the customer's personal review link."
                  >
                    <textarea
                      required
                      maxLength={2000}
                      value={values.requestBody}
                      onChange={(e) => set("requestBody", e.target.value)}
                    />
                  </Field>
                  <div className="template-preview">
                    <span>MESSAGE PREVIEW</span>
                    <strong>{values.requestSubject}</strong>
                    <p>
                      {values.requestBody
                        .replaceAll("{business}", values.name)
                        .replaceAll("{link}", "[personal review link]")}
                    </p>
                  </div>
                  <Badge tone={data.capabilities.email ? "success" : "warning"}>
                    {data.capabilities.email
                      ? "Delivery connected"
                      : "Email delivery not configured — invitations remain queued"}
                  </Badge>
                </div>
              </section>
            )}
            {section === "alerts" && (
              <section className="panel setting-card">
                <div className="panel-head">
                  <div>
                    <h2>Stay close to every experience</h2>
                    <p>New review alerts, delivered to your team.</p>
                  </div>
                  <Bell size={21} />
                </div>
                <div className="form-body">
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={values.alertsEnabled}
                      onChange={(e) => set("alertsEnabled", e.target.checked)}
                    />
                    <div>
                      <strong>Email me when a new review arrives</strong>
                      <small>
                        One durable alert per newly imported review. Repeated
                        syncs do not create duplicate alerts.
                      </small>
                    </div>
                  </label>
                  <Field
                    label="Alert email address"
                    type="email"
                    placeholder="team@yourbusiness.com"
                    value={values.alertEmail}
                    onChange={(e) => set("alertEmail", e.target.value)}
                    required={values.alertsEnabled}
                  />
                  <div className="provider-note">
                    <Info size={18} />
                    <p>
                      {data.capabilities.email
                        ? "Email delivery is enabled. Accepted delivery does not guarantee the recipient has read the message."
                        : "Alerts are stored in the outbox. Configure verified email delivery on the server before sending."}
                    </p>
                  </div>
                </div>
              </section>
            )}
            {section === "appearance" && (
              <section className="panel setting-card">
                <div className="panel-head">
                  <div>
                    <h2>Your review pages & widgets</h2>
                    <p>
                      Consistent TAKATAK styling across customer touchpoints.
                    </p>
                  </div>
                  <PanelsTopLeft size={21} />
                </div>
                <div className="form-body">
                  <div className="appearance-swatches">
                    <span style={{ background: "#060d1f" }} />
                    <span style={{ background: "#1f8bff" }} />
                    <span style={{ background: "#29c3ff" }} />
                    <span style={{ background: "#f5f8fc" }} />
                  </div>
                  <p>
                    Customize page titles and welcome copy per location. Choose
                    a widget layout and review count for your website.
                  </p>
                  <div className="button-row">
                    <Button
                      type="button"
                      icon={PanelsTopLeft}
                      onClick={() => go("/pages")}
                    >
                      Manage pages
                    </Button>
                    <Button
                      type="button"
                      icon={LayoutGrid}
                      onClick={() => go("/widgets")}
                    >
                      Manage widgets
                    </Button>
                  </div>
                </div>
              </section>
            )}
            {section === "sources" && (
              <section className="panel setting-card">
                <div className="panel-head">
                  <h2>Review source connections</h2>
                </div>
                <Sources data={data} />
                <div className="form-body">
                  <Button
                    type="button"
                    icon={Layers}
                    onClick={() => go("/integrations")}
                  >
                    Manage integrations
                  </Button>
                  <p className="subtle">
                    Provider permissions are verified by the server. A profile
                    photo uploaded elsewhere does not clear a provider's account
                    photo gate.
                  </p>
                </div>
              </section>
            )}
            {section === "signature" && (
              <section className="panel setting-card">
                <div className="panel-head">
                  <div>
                    <h2>Sign off with a personal touch</h2>
                    <p>Keep your team's voice consistent.</p>
                  </div>
                  <Pencil size={21} />
                </div>
                <div className="form-body">
                  <Field
                    label="Team signature"
                    maxLength={200}
                    value={values.signature}
                    onChange={(e) => set("signature", e.target.value)}
                  />
                  <div className="signature-preview">
                    <Stars rating={5} />
                    <p>Thank you for sharing your experience.</p>
                    <strong>— {values.signature}</strong>
                  </div>
                </div>
              </section>
            )}
            {section === "tags" && (
              <section className="panel setting-card">
                <div className="panel-head">
                  <div>
                    <h2>Find the themes that matter</h2>
                    <p>Organize customers and reviews with useful tags.</p>
                  </div>
                  <Tag size={21} />
                </div>
                <div className="form-body">
                  <div className="tag-list">
                    {[
                      ...new Set([
                        ...data.customers.flatMap((c) => c.tags),
                        ...data.reviews.flatMap((r) => r.tags || []),
                      ]),
                    ].map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </div>
                  <p>
                    Tags are editable on each customer and review. Use them for
                    themes such as service, product, or returning customer.
                  </p>
                  <div className="button-row">
                    <Button type="button" onClick={() => go("/customers")}>
                      Customer tags
                    </Button>
                    <Button type="button" onClick={() => go("/reviews")}>
                      Review tags
                    </Button>
                  </div>
                </div>
              </section>
            )}
            {section === "ai" && (
              <section className="panel setting-card">
                <div className="panel-head">
                  <div>
                    <h2>AI, with a human touch</h2>
                    <p>
                      Provider-powered assistance belongs behind explicit
                      configuration.
                    </p>
                  </div>
                  <Sparkles size={21} />
                </div>
                <div className="form-body">
                  {[
                    "Review reply suggestions",
                    "Review summaries",
                    "Automatic theme tagging",
                    "Review highlights",
                  ].map((t) => (
                    <div className="feature-row" key={t}>
                      <Sparkles size={19} />
                      <strong>{t}</strong>
                      <Badge>Not connected</Badge>
                    </div>
                  ))}
                  <div className="provider-note">
                    <Lock size={18} />
                    <p>
                      The ecosystem already has an AI credit and approval
                      system. This standalone cockpit does not send customer
                      content to an AI provider or fabricate AI results.
                    </p>
                  </div>
                </div>
              </section>
            )}
            {section === "api" && (
              <section className="panel setting-card">
                <div className="panel-head">
                  <div>
                    <h2>Connect with confidence</h2>
                    <p>
                      A signed, tenant-scoped ingress for your review providers.
                    </p>
                  </div>
                  <Code size={21} />
                </div>
                <div className="form-body">
                  <Field
                    label="Review webhook endpoint"
                    readOnly
                    value={location.origin + "/api/webhooks/reviews"}
                  />
                  <p>
                    Provider events require a timestamped HMAC signature and a
                    server-provisioned tenant mapping. Secrets are configured on
                    the server and are never exposed here.
                  </p>
                  <pre className="code-block">
                    {
                      "POST /api/webhooks/reviews\nx-takatak-signature: t=timestamp,v1=signature\n\n{ id, tenant, provider, locationId, reviews }"
                    }
                  </pre>
                  <div className="provider-note">
                    <Info size={18} />
                    <p>
                      API credentials, MCP access, and OAuth setup are managed
                      by the existing TAKATAK ecosystem. No new API key or MCP
                      server is implied by this screen.
                    </p>
                  </div>
                </div>
              </section>
            )}
            {["general", "strategy", "email", "alerts", "signature"].includes(
              section,
            ) && (
              <div className="settings-save">
                {saved && (
                  <span>
                    <CheckCircle2 size={15} /> All changes saved
                  </span>
                )}
                <Button variant="primary" icon={Check} busy={busy}>
                  Save changes
                </Button>
              </div>
            )}
          </form>
        </div>
      </div>
    </>
  );
}

export { SettingsPage };
