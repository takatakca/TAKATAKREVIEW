import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Send,
  X,
  RefreshCw,
  Link as LinkIcon,
  MapPin,
  Mail,
  Lock,
  CreditCard,
} from "lucide-react";
import {
  api,
  relative,
  Provider,
  Badge,
  Button,
  PageHead,
} from "../components/ui.jsx";

function Integrations({ data, go, open, act, busy, defaultLocation }) {
  const [category, setCategory] = useState("all");
  return (
    <>
      <PageHead
        eyebrow="YOUR REPUTATION. BETTER CONNECTED."
        title="Bring every experience together."
        description="Connect the places your customers already share their stories."
      >
        <Button icon={CreditCard} onClick={() => go("/billing")}>
          Plans & billing
        </Button>
      </PageHead>
      <div className="integration-hero">
        <div>
          <span className="eyebrow">ONE WORKSPACE. MORE POSSIBILITIES.</span>
          <h2>
            All your voices.
            <br />
            <span>One clear picture.</span>
          </h2>
          <p>
            Connect review channels, keep your team informed,
            <br />
            and respond with care from a single workspace.
          </p>
        </div>
        <div className="integration-art" aria-hidden="true">
          <div className="integration-center">
            T<span>REVIEW</span>
          </div>
          <span className="integration-orbit">
            <Provider name="google" />
            <Provider name="tripadvisor" />
            <Provider name="yelp" />
            <Provider name="facebook" />
          </span>
        </div>
      </div>
      <div className="provider-tabs">
        <button
          className={category === "all" ? "active" : ""}
          onClick={() => setCategory("all")}
        >
          All integrations <b>{data.integrations.length + 2}</b>
        </button>
        <button
          className={category === "reviews" ? "active" : ""}
          onClick={() => setCategory("reviews")}
        >
          Review sources
        </button>
        <button
          className={category === "delivery" ? "active" : ""}
          onClick={() => setCategory("delivery")}
        >
          Email & billing
        </button>
      </div>
      <div className="integration-grid">
        {category !== "delivery" &&
          data.integrations.map((p) => (
            <section className="panel integration-card" key={p.id}>
              <div className="integration-card-top">
                <Provider name={p.id} />
                <Badge
                  tone={p.status === "connected" ? "success" : "neutral"}
                  dot
                >
                  {p.status === "connected"
                    ? "Connected"
                    : p.configured
                      ? "Available to connect"
                      : "Not configured"}
                </Badge>
              </div>
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              {p.lastSyncAt && (
                <small className="subtle">
                  Last sync {relative(p.lastSyncAt)}
                </small>
              )}
              <div className="integration-card-footer">
                <span>{p.price}</span>
                {p.id === "google" && p.nativeGoogle && p.entitled ? (
                  <div className="integration-native-actions">
                    {p.status !== "connected" ? (
                      <Button
                        icon={LinkIcon}
                        onClick={async () => {
                          const result = await act(() =>
                            api("/integrations/google/connect", {
                              method: "POST",
                            }),
                          );
                          if (result) location.assign(result.url);
                        }}
                      >
                        Connect Google
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="text"
                          icon={MapPin}
                          onClick={() => open("google-location")}
                        >
                          Link location
                        </Button>
                        <button
                          className="icon-button"
                          aria-label="Disconnect Google"
                          onClick={() =>
                            open("delete", {
                              kind: "integrations",
                              id: "google",
                              name: "Google connection",
                            })
                          }
                        >
                          <X size={14} />
                        </button>
                        <Button
                          icon={RefreshCw}
                          disabled={
                            !p.linkedLocations?.some(
                              (l) => l.locationId === defaultLocation,
                            )
                          }
                          onClick={() =>
                            act(
                              () =>
                                api("/integrations/google/sync", {
                                  method: "POST",
                                  body: { locationId: defaultLocation },
                                }),
                              (r) => `${r.imported} new reviews synchronized`,
                            )
                          }
                        >
                          Sync
                        </Button>
                      </>
                    )}
                  </div>
                ) : p.id === "takatak" ? (
                  <Button
                    variant="text"
                    icon={ArrowRight}
                    onClick={() => go("/pages")}
                  >
                    Manage
                  </Button>
                ) : (
                  <Button
                    disabled={busy}
                    icon={p.entitled ? RefreshCw : ArrowUpRight}
                    onClick={() =>
                      p.entitled
                        ? act(
                            () =>
                              api("/integrations/" + p.id + "/sync", {
                                method: "POST",
                                body: { locationId: defaultLocation },
                              }),
                            (r) => `${r.imported} new reviews synchronized`,
                          )
                        : go("/billing")
                    }
                  >
                    {p.entitled ? "Sync reviews" : "View integration"}
                  </Button>
                )}
              </div>
            </section>
          ))}
        {category !== "reviews" && (
          <>
            <section className="panel integration-card">
              <div className="integration-card-top">
                <span className="connection-icon">
                  <Mail size={25} />
                </span>
                <Badge
                  tone={data.capabilities.email ? "success" : "neutral"}
                  dot
                >
                  {data.capabilities.email ? "Enabled" : "Not configured"}
                </Badge>
              </div>
              <h3>Email delivery</h3>
              <p>
                Send review alerts and consented invitations through a
                configured email provider.
              </p>
              <div className="integration-card-footer">
                <span>Delivery queue</span>
                <Button variant="text" onClick={() => go("/settings")}>
                  Set up alerts <ArrowRight size={14} />
                </Button>
              </div>
            </section>
            <section className="panel integration-card">
              <div className="integration-card-top">
                <span className="connection-icon violet">
                  <CreditCard size={25} />
                </span>
                <Badge
                  tone={data.capabilities.billing ? "success" : "neutral"}
                  dot
                >
                  {data.capabilities.billing ? "Configured" : "Not configured"}
                </Badge>
              </div>
              <h3>TAKATAK billing</h3>
              <p>
                Use the existing ecosystem's Stripe plans and signed
                entitlements for paid modules.
              </p>
              <div className="integration-card-footer">
                <span>One billing authority</span>
                <Button variant="text" onClick={() => go("/billing")}>
                  Manage plans <ArrowRight size={14} />
                </Button>
              </div>
            </section>
          </>
        )}
      </div>
      <div className="provider-note">
        <Lock size={18} />
        <p>
          Live synchronization and publication require approved API access, a
          configured bridge, and a signed Reputation entitlement. Account
          registration alone does not grant provider API permissions. Google and
          TripAdvisor interface references are still pending.
        </p>
      </div>
    </>
  );
}

export { Integrations };
