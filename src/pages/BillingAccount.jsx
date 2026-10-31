import {
  ArrowUpRight,
  ArrowRight,
  ChartNoAxesCombined,
  Check,
  ShieldCheck,
  Lock,
  CreditCard,
  UserRound,
} from "lucide-react";
import {
  api,
  Provider,
  Avatar,
  Badge,
  Button,
  PageHead,
} from "../components/ui.jsx";

function Billing({ data, act, busy, go }) {
  return (
    <>
      <PageHead
        eyebrow="GROW YOUR REPUTATION"
        title="More connected. More possible."
        description="Review integrations are part of the TAKATAK ecosystem's existing plans."
      />
      <div className="billing-layout">
        <section className="panel billing-card">
          <span className="eyebrow">YOUR CORE WORKSPACE</span>
          <h2>Built for better connections.</h2>
          <p>Your first-party review tools are ready to use.</p>
          <div className="plan-price">
            Included<span>in this workspace</span>
          </div>
          <ul>
            {[
              "Customer management & consent tracking",
              "Branded first-party review pages",
              "Feedback collection & responses",
              "Review widgets with publication consent",
              "CSV imports & exports",
              "Notifications & durable email queue",
            ].map((t) => (
              <li key={t}>
                <Check size={16} />
                {t}
              </li>
            ))}
          </ul>
          <Button onClick={() => go("/pages")} icon={ArrowRight}>
            Explore your tools
          </Button>
        </section>
        <section className="panel billing-card featured">
          <Badge tone="info">TAKATAK REPUTATION</Badge>
          <h2>Your reputation, everywhere.</h2>
          <p>
            Add connected provider review management through canonical TAKATAK
            billing.
          </p>
          <div className="billing-quote">
            One account.
            <br />
            <span>One connected ecosystem.</span>
          </div>
          <ul>
            {[
              "Google review synchronization & supported replies",
              "Provider-specific cockpit modules",
              "Server-verified plan entitlements",
              "The existing TAKATAK Stripe subscription",
              "Provider API approval and configuration required",
            ].map((t) => (
              <li key={t}>
                <Check size={16} />
                {t}
              </li>
            ))}
          </ul>
          <Button
            variant="primary"
            icon={ArrowUpRight}
            busy={busy}
            onClick={async () => {
              const result = await act(() =>
                api("/billing/checkout", { method: "POST" }),
              );
              if (result) location.assign(result.url);
            }}
          >
            Open TAKATAK billing
          </Button>
          {!data.capabilities.billing && (
            <p className="subtle">
              Billing portal not configured on this server. No payment has been
              started.
            </p>
          )}
        </section>
      </div>
      <div className="provider-note">
        <ShieldCheck size={18} />
        <p>
          Pricing and subscription status come from the existing billing
          authority. This cockpit does not invent prices, duplicate customers,
          or activate modules from a checkout return URL.
        </p>
      </div>
    </>
  );
}
function Account({ data, go, act }) {
  return (
    <>
      <PageHead
        title="Your place in the workspace."
        description="Identity and account security stay with your TAKATAK account."
      />
      <div className="account-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Account</h2>
            <UserRound size={20} />
          </div>
          <div className="form-body">
            <div className="account-avatar">
              <Avatar name="Workspace owner" size="large" />
              <div>
                <h3>
                  {data.identity.mode === "local"
                    ? "Local developer"
                    : "TAKATAK workspace member"}
                </h3>
                <Badge>{data.identity.role}</Badge>
              </div>
            </div>
            <dl>
              <dt>Session</dt>
              <dd>
                {data.identity.mode === "local"
                  ? "Loopback-only development"
                  : "Verified canonical JWT"}
              </dd>
              <dt>Workspace</dt>
              <dd>{data.settings.name}</dd>
              <dt>Authentication</dt>
              <dd>
                {data.identity.mode === "local"
                  ? "Production requires canonical sign-in"
                  : "TAKATAK identity provider"}
              </dd>
            </dl>
            <div className="provider-note">
              <Lock size={18} />
              <p>
                Password changes, two-factor authentication, personal profile
                photos, and account recovery are managed by the canonical
                TAKATAK identity service.
              </p>
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Usage & delivery</h2>
            <ChartNoAxesCombined size={20} />
          </div>
          <div className="form-body">
            {[
              ["Locations", data.locations.length],
              ["Customers", data.customers.length],
              ["Reviews", data.reviews.length],
              ["Delivery queue", data.outbox.length],
            ].map(([label, n]) => (
              <div className="usage-row" key={label}>
                <span>{label}</span>
                <strong>{n}</strong>
              </div>
            ))}
            <Button onClick={() => go("/billing")} icon={CreditCard}>
              Plans & billing
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}

export { Billing, Account };
