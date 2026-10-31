import { useEffect, useState } from "react";
import {
  Send,
  LayoutGrid,
  Settings,
  Upload,
  ExternalLink,
  Check,
  Copy,
  ShieldCheck,
  Trash2,
  FileText,
  Info,
  Flag,
} from "lucide-react";
import {
  api,
  providerName,
  Avatar,
  Badge,
  Button,
  Modal,
  Field,
  ErrorLine,
  parseCSV,
} from "./ui.jsx";

function Editor({
  modal: { type, record },
  data,
  defaultLocation,
  onClose,
  onSaved,
}) {
  const initial = () => {
    if (
      record &&
      ["customer", "page", "widget", "location", "automation"].includes(type)
    )
      return { ...record, tags: (record.tags || []).join(", ") };
    return {
      name: "",
      email: "",
      phone: "",
      tags: "",
      consent: false,
      locationId: defaultLocation,
      title: "Your experience matters",
      description:
        "Tell us about your experience. Every piece of feedback helps us grow.",
      active: true,
      type: "carousel",
      minRating: 1,
      limit: 6,
      enabled: true,
      trigger: "new_review",
      action: "notify",
      address: "",
      timezone: "America/Toronto",
      channel: "link",
      pageId:
        data.pages.find((p) => p.locationId === defaultLocation)?.id || "",
      customerIds: record?.customerIds || [],
      csv: "",
      text: record?.tags?.join(", ") || "",
    };
  };
  const [googleOptions, setGoogleOptions] = useState([]);
  useEffect(() => {
    if (type === "google-location")
      api("/integrations/google/locations")
        .then((r) => setGoogleOptions(r.locations))
        .catch((e) => setError(e.message));
  }, [type]);
  const [values, setValues] = useState(initial),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));
  const titles = {
    "google-location": "Link a Google location",
    customer: record ? "Edit customer" : "Add a customer",
    page: record ? "Edit review page" : "Create a review page",
    widget: record ? "Edit widget" : "Create a widget",
    location: record ? "Edit location" : "Add a location",
    automation: record
      ? "Edit notification rule"
      : "Create a notification rule",
    request: "Invite a customer to share",
    import: "Import your customers",
    embed: "A little code. A lot of credibility.",
    delete: "Delete this record?",
    "review-tags": "Organize this review",
    report: "Review reporting guidance",
    help: "A stronger reputation starts here",
    message: "Save a follow-up note",
  };
  const locationField = (
    <Field label="Location">
      <select
        value={values.locationId}
        onChange={(e) => set("locationId", e.target.value)}
      >
        {data.locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </Field>
  );
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (type === "google-location") {
        await api("/integrations/google/locations", {
          method: "POST",
          body: { locationId: values.locationId, remoteId: values.remoteId },
        });
        return await onSaved("Google location linked");
      }
      if (type === "delete") {
        await api("/" + record.kind + "/" + record.id, { method: "DELETE" });
        return await onSaved("Record deleted");
      }
      if (type === "import") {
        const rows = parseCSV(values.csv).map((row) => ({
          name: row.name,
          email: row.email,
          phone: row.phone || "",
          tags: (row.tags || "")
            .split(";")
            .map((t) => t.trim())
            .filter(Boolean),
          consent: ["true", "yes", "1"].includes(
            (row.consent || "").toLowerCase(),
          ),
          locationId: values.locationId,
        }));
        const result = await api("/customers/import", {
          method: "POST",
          body: { rows },
        });
        return await onSaved(
          `${result.imported} customers imported; ${result.skipped} duplicate emails skipped.`,
        );
      }
      if (type === "request") {
        if (!values.customerIds.length)
          throw new Error("Select at least one customer.");
        await api("/requests", {
          method: "POST",
          body: {
            customerIds: values.customerIds,
            pageId: values.pageId,
            channel: values.channel,
          },
        });
        return await onSaved(
          values.channel === "link"
            ? "Personal review links created"
            : "Email invitations queued — not yet delivered",
        );
      }
      if (type === "review-tags") {
        await api("/reviews/" + record.id, {
          method: "PATCH",
          body: {
            tags: values.text
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          },
        });
        return await onSaved("Review tags saved");
      }
      if (type === "message") {
        await api("/reviews/" + record.id + "/messages", {
          method: "POST",
          body: { text: values.text },
        });
        return await onSaved("Internal follow-up note saved");
      }
      const kind = {
        customer: "customers",
        page: "pages",
        widget: "widgets",
        location: "locations",
        automation: "automations",
      }[type];
      const body = {
        ...values,
        ...(type === "customer"
          ? {
              tags: values.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            }
          : {}),
      };
      await api("/" + kind + (record ? "/" + record.id : ""), {
        method: record ? "PUT" : "POST",
        body,
      });
      await onSaved(record ? "Changes saved" : "Created successfully");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (type === "help")
    return (
      <Modal title={titles[type]} onClose={onClose}>
        <div className="form-body">
          <div className="help-steps">
            {[
              [
                "1",
                "Make it yours",
                "Add your business name and create a location.",
              ],
              [
                "2",
                "Invite honest feedback",
                "Create a review page, add customers with consent, and copy personal links.",
              ],
              [
                "3",
                "Keep the conversation going",
                "Read feedback, respond with care, and build a review widget.",
              ],
              [
                "4",
                "Bring in your channels",
                "Configure approved provider APIs and the existing TAKATAK billing module.",
              ],
            ].map(([n, title, text]) => (
              <div key={n}>
                <span>{n}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="provider-note">
            <ShieldCheck size={18} />
            <p>
              Sample records are fictional. Live provider sync, AI tools, email
              delivery, and billing always show their actual configuration
              status.
            </p>
          </div>
        </div>
        <div className="modal-footer">
          <Button variant="primary" onClick={onClose}>
            Let's get started
          </Button>
        </div>
      </Modal>
    );
  if (type === "report")
    return (
      <Modal title={titles[type]} onClose={onClose}>
        <div className="form-body">
          <Flag size={26} />
          <h3>Report through the original source</h3>
          <p>
            TAKATAK cannot remove a provider's review. Use the reporting tools
            on {providerName[record.provider] || "the original platform"} and
            follow its content policies.
          </p>
          <p className="subtle">
            No report has been submitted. Copying a workspace link does not make
            a review public or report it to a provider.
          </p>
        </div>
        <div className="modal-footer">
          <Button onClick={onClose}>Understood</Button>
        </div>
      </Modal>
    );
  if (type === "embed") {
    const code = `<iframe src="${location.origin}/embed/${record.id}" title="Customer reviews" width="100%" height="420" style="border:0;border-radius:16px" loading="lazy"></iframe>`;
    return (
      <Modal
        title={titles[type]}
        subtitle="Copy this embed into your website's HTML."
        onClose={onClose}
        wide
      >
        <div className="form-body">
          <Field label="Embed code">
            <textarea readOnly value={code} rows={5} />
          </Field>
          <p>
            Displays only consented first-party reviews. A provider's imported
            reviews are not redistributed.
          </p>
          <a
            className="button"
            href={"/embed/" + record.id}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={15} />
            Preview widget
          </a>
        </div>
        <div className="modal-footer">
          <Button
            variant="primary"
            icon={Copy}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code);
                await onSaved("Embed code copied");
              } catch {
                setError("Copy the code above manually.");
              }
            }}
          >
            Copy embed code
          </Button>
        </div>
        <ErrorLine error={error} />
      </Modal>
    );
  }
  const availablePages = data.pages.filter((p) => p.active);
  const selectedPage = availablePages.find((p) => p.id === values.pageId);
  const availableCustomers = data.customers.filter(
    (c) => !selectedPage || c.locationId === selectedPage.locationId,
  );
  return (
    <Modal
      title={titles[type]}
      subtitle={
        {
          customer: "A familiar name. A better connection.",
          page: "Give every customer a welcoming place to share.",
          widget: "Choose a layout that fits your website.",
          location: "Keep every experience close to home.",
          automation: "Stay informed without the busywork.",
          request: "Every customer deserves the same opportunity to share.",
          import: "Bring your relationships with you.",
        }[type]
      }
      onClose={onClose}
      wide={type === "import"}
    >
      <form onSubmit={submit}>
        <div className="form-body">
          <ErrorLine error={error} />
          {type === "google-location" && (
            <>
              {locationField}
              <Field label="Google business location">
                <select
                  required
                  value={values.remoteId || ""}
                  onChange={(e) => set("remoteId", e.target.value)}
                >
                  <option value="">Select a verified Google location</option>
                  {googleOptions.map((l) => (
                    <option key={l.remoteId} value={l.remoteId}>
                      {l.title} — {l.address}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="subtle">
                Locations are loaded from the connected Google account. A local
                location can only sync the Google profile linked here.
              </p>
            </>
          )}
          {type === "customer" && (
            <>
              <Field
                label="Full name"
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                required
                maxLength={100}
              />
              <div className="form-columns">
                <Field
                  label="Email address"
                  type="email"
                  value={values.email}
                  onChange={(e) => set("email", e.target.value)}
                  maxLength={254}
                />
                <Field
                  label="Phone number"
                  type="tel"
                  value={values.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  maxLength={30}
                />
              </div>
              {locationField}
              <Field
                label="Tags"
                placeholder="Returning customer, VIP"
                value={values.tags}
                onChange={(e) => set("tags", e.target.value)}
                help="Separate tags with commas."
              />
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={values.consent}
                  onChange={(e) => set("consent", e.target.checked)}
                />
                <div>
                  <strong>This customer has opted in to contact</strong>
                  <small>
                    Required before sending an email invitation. Do not assume
                    consent from a purchase.
                  </small>
                </div>
              </label>
            </>
          )}
          {type === "page" && (
            <>
              <Field
                label="Page name"
                required
                maxLength={100}
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
              />
              {locationField}
              <Field
                label="Welcome heading"
                required
                maxLength={160}
                value={values.title}
                onChange={(e) => set("title", e.target.value)}
              />
              <Field label="Welcome message">
                <textarea
                  maxLength={1000}
                  value={values.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={values.active}
                  onChange={(e) => set("active", e.target.checked)}
                />
                <span>Page is active and accepts feedback</span>
              </label>
            </>
          )}
          {type === "widget" && (
            <>
              <Field
                label="Widget name"
                required
                maxLength={100}
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
              />
              <div className="widget-types">
                {["carousel", "grid", "badge", "wall", "popup", "list"].map(
                  (t) => (
                    <button
                      key={t}
                      type="button"
                      className={values.type === t ? "active" : ""}
                      onClick={() => set("type", t)}
                    >
                      <LayoutGrid size={21} />
                      {t}
                    </button>
                  ),
                )}
              </div>
              {locationField}
              <div className="form-columns">
                <Field label="Minimum displayed rating">
                  <select
                    value={values.minRating}
                    onChange={(e) => set("minRating", Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}+ stars
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Maximum reviews"
                  type="number"
                  min={1}
                  max={30}
                  value={values.limit}
                  onChange={(e) => set("limit", Number(e.target.value))}
                />
              </div>
              <p className="subtle">
                Display filters affect this widget only. They never change which
                customers can submit feedback.
              </p>
            </>
          )}
          {type === "location" && (
            <>
              <Field
                label="Location name"
                required
                maxLength={100}
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
              />
              <Field
                label="Address"
                maxLength={300}
                value={values.address}
                onChange={(e) => set("address", e.target.value)}
              />
              <Field label="Timezone">
                <select
                  value={values.timezone}
                  onChange={(e) => set("timezone", e.target.value)}
                >
                  {[
                    "America/Toronto",
                    "America/Montreal",
                    "America/Vancouver",
                    "America/Edmonton",
                    "America/Winnipeg",
                    "America/Halifax",
                    "America/St_Johns",
                    "America/New_York",
                    "UTC",
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
            </>
          )}
          {type === "automation" && (
            <>
              <Field
                label="Rule name"
                required
                maxLength={100}
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
              />
              {locationField}
              <Field label="When this happens">
                <select
                  value={values.trigger}
                  onChange={(e) => set("trigger", e.target.value)}
                >
                  <option value="new_review">A new review arrives</option>
                  <option value="low_rating">A 1–3 star review arrives</option>
                  <option value="unanswered">
                    An unanswered review arrives
                  </option>
                </select>
              </Field>
              <Field label="Then do this">
                <select value="notify" readOnly>
                  <option value="notify">
                    Email the workspace alert address
                  </option>
                </select>
              </Field>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={values.enabled}
                  onChange={(e) => set("enabled", e.target.checked)}
                />
                <span>Rule is enabled</span>
              </label>
              <p className="subtle">
                Runs on new review ingestion. Requires an alert email address in
                Settings and configured delivery.
              </p>
            </>
          )}
          {type === "request" && (
            <>
              {!data.customers.length && (
                <div className="provider-note">
                  <Info size={18} />
                  <p>Add customers before creating invitations.</p>
                </div>
              )}
              <Field label="Review page">
                <select
                  required
                  value={values.pageId}
                  onChange={(e) => {
                    set("pageId", e.target.value);
                    set("customerIds", []);
                  }}
                >
                  <option value="">Select an active page</option>
                  {availablePages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Invitation channel">
                <select
                  value={values.channel}
                  onChange={(e) => set("channel", e.target.value)}
                >
                  <option value="link">Personal link · copy & share</option>
                  <option value="email">
                    Email · queued for provider delivery
                  </option>
                </select>
              </Field>
              <div className="field">
                <span>Customers</span>
                <div className="customer-picker">
                  {availableCustomers.map((c) => (
                    <label key={c.id}>
                      <input
                        type="checkbox"
                        checked={values.customerIds.includes(c.id)}
                        onChange={(e) =>
                          set(
                            "customerIds",
                            e.target.checked
                              ? [...values.customerIds, c.id]
                              : values.customerIds.filter((id) => id !== c.id),
                          )
                        }
                      />
                      <Avatar name={c.name} size="small" />
                      <span>
                        <strong>{c.name}</strong>
                        <small>
                          {c.email || "No email"}
                          {c.sample ? " · Sample" : ""}
                        </small>
                      </span>
                      {c.consent && <Badge tone="success">Opted in</Badge>}
                    </label>
                  ))}
                  {!availableCustomers.length && (
                    <p className="subtle">
                      No customers in this page's location.
                    </p>
                  )}
                </div>
              </div>
              {values.channel === "email" && (
                <p className="subtle">
                  Email requests require an opted-in email address. Creating a
                  request queues it; it does not prove delivery.
                </p>
              )}
            </>
          )}
          {type === "import" && (
            <>
              {locationField}
              <div className="csv-example">
                <FileText size={19} />
                <div>
                  <strong>A clean list is a good start.</strong>
                  <p>
                    Required columns: name, email. Optional: phone, tags
                    (separated by semicolons), consent (true or false).
                  </p>
                </div>
              </div>
              <Field
                label="Upload a CSV file"
                type="file"
                accept=".csv,text/csv"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    if (f.size > 1000000) {
                      setError("Use a CSV smaller than 1 MB.");
                      return;
                    }
                    set("csv", await f.text());
                  }
                }}
              />
              <Field label="CSV contents">
                <textarea
                  rows={8}
                  value={values.csv}
                  onChange={(e) => set("csv", e.target.value)}
                  required
                  placeholder={
                    "name,email,phone,tags,consent\nCasey Example,casey@example.com,,Returning,false"
                  }
                />
              </Field>
              <p className="subtle">
                Duplicate email addresses within the same location are skipped.
                Consent is false unless explicitly supplied.
              </p>
            </>
          )}
          {type === "delete" && (
            <>
              <div className="delete-icon">
                <Trash2 size={25} />
              </div>
              <p>
                <strong>{record.name}</strong> will be permanently deleted from
                this workspace.
              </p>
              <p className="subtle">
                Records with active dependent invitations or locations
                containing data cannot be deleted.
              </p>
            </>
          )}
          {type === "review-tags" && (
            <Field
              label="Review tags"
              value={values.text}
              onChange={(e) => set("text", e.target.value)}
              help="Separate tags with commas. Up to 20 tags."
            />
          )}
          {type === "message" && (
            <>
              <Field label="Internal follow-up note">
                <textarea
                  required
                  maxLength={5000}
                  value={values.text}
                  onChange={(e) => set("text", e.target.value)}
                />
              </Field>
              <p className="subtle">
                This note is saved in your workspace. It is not sent to the
                reviewer.
              </p>
            </>
          )}
        </div>
        <div className="modal-footer">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={type === "delete" ? "danger" : "primary"}
            busy={busy}
            icon={
              type === "delete" ? Trash2 : type === "request" ? Send : Check
            }
          >
            {type === "delete"
              ? "Delete record"
              : type === "import"
                ? "Import customers"
                : type === "request"
                  ? "Create invitations"
                  : record
                    ? "Save changes"
                    : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export { Editor };
