import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Star,
  Settings,
  Search,
  Bell,
  MoreHorizontal,
  X,
  RefreshCw,
  MapPin,
  ShieldCheck,
  Menu,
  Sparkles,
  Info,
  Filter,
  Building2,
  Layers,
  HelpCircle,
  Loader2,
} from "lucide-react";
import {
  api,
  useRoute,
  nav,
  relative,
  Avatar,
  Badge,
  Empty,
  Button,
  ErrorLine,
} from "./components/ui.jsx";
import { Overview } from "./pages/Overview.jsx";
import { Reviews } from "./pages/Reviews.jsx";
import { ReviewDetail } from "./pages/Reviews.jsx";
import { Customers } from "./pages/Customers.jsx";
import { Requests } from "./pages/Requests.jsx";
import { Pages } from "./pages/PagesWidgets.jsx";
import { Widgets } from "./pages/PagesWidgets.jsx";
import { Messages } from "./pages/MessagesAutomations.jsx";
import { Automations } from "./pages/MessagesAutomations.jsx";
import { Analytics } from "./pages/Analytics.jsx";
import { Integrations } from "./pages/Integrations.jsx";
import { SettingsPage } from "./pages/Settings.jsx";
import { Billing } from "./pages/BillingAccount.jsx";
import { Account } from "./pages/BillingAccount.jsx";
import { Editor } from "./components/Editor.jsx";
import { PublicReview } from "./pages/Public.jsx";
import { PublicWidget } from "./pages/Public.jsx";

function App() {
  const [path, go] = useRoute(),
    [data, setData] = useState(null),
    [locationId, setLocationId] = useState(""),
    [query, setQuery] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState(null),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false),
    [notifications, setNotifications] = useState(false);
  const locationRef = useRef(locationId);
  locationRef.current = locationId;
  const requestRef = useRef(0);
  async function refresh() {
    const request = ++requestRef.current;
    try {
      const result = await api(
        "/bootstrap" +
          (locationRef.current
            ? "?location=" + encodeURIComponent(locationRef.current)
            : ""),
      );
      if (request === requestRef.current) {
        setData(result);
        setError("");
      }
    } catch (e) {
      if (request === requestRef.current) setError(e.message);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }
  useEffect(() => {
    const shortcut = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.querySelector(".global-search input")?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    refresh();
  }, [locationId]);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(id);
    }
  }, [toast]);
  async function act(fn, message) {
    setBusy(true);
    try {
      const result = await fn();
      await refresh();
      if (message)
        setToast(typeof message === "function" ? message(result) : message);
      return result;
    } catch (e) {
      setToast(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  function navigate(to) {
    go(to);
    setMobile(false);
    setQuery("");
  }
  function open(type, record = null) {
    setModal({ type, record });
  }
  if (path.startsWith("/r/")) return <PublicReview slug={path.split("/")[2]} />;
  if (path.startsWith("/embed/"))
    return <PublicWidget id={path.split("/")[2]} />;
  if (loading)
    return (
      <div className="loading-screen">
        <div className="wordmark">
          TAKATAK<span>REVIEW</span>
        </div>
        <Loader2 className="spin" />
        <p>Opening your workspace…</p>
      </div>
    );
  if (!data)
    return (
      <div className="loading-screen">
        <ShieldCheck size={40} />
        <h1>Your TAKATAK workspace</h1>
        <p>{error}</p>
        <Button onClick={refresh} icon={RefreshCw}>
          Try again
        </Button>
      </div>
    );
  const isSample = data.reviews.some((r) => r.sample);
  const local = data.identity.mode === "local";
  const route = nav.find((n) => n[0] === path);
  const activeLocation = data.locations.find((l) => l.id === locationId);
  const defaultLocation =
    locationId ||
    data.locations.find((l) => !l.sample)?.id ||
    data.locations[0]?.id;
  const filteredReviews = data.reviews.filter((r) =>
    `${r.author} ${r.text} ${r.provider}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const context = {
    data,
    go: navigate,
    open,
    act,
    busy,
    locationId,
    defaultLocation,
    query,
    setToast,
    reviews: filteredReviews,
  };
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="sidebar-overlay"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <button
          className="brand"
          onClick={() => navigate("/")}
          aria-label="TAKATAK Review home"
        >
          <div className="brand-symbol">
            <Star size={22} fill="currentColor" />
          </div>
          <span>
            <strong>TAKATAK</strong>
            <small>REVIEW</small>
          </span>
        </button>
        <div className="workspace-card">
          <span className="workspace-icon">
            <Building2 size={19} />
          </span>
          <div>
            <strong>{data.settings.name}</strong>
            <small>Reputation workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(([to, label, Icon]) => (
            <button
              key={to}
              aria-label={label}
              className={
                path === to ||
                (to === "/reviews" && path.startsWith("/reviews/"))
                  ? "active"
                  : ""
              }
              onClick={() => navigate(to)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {to === "/reviews" && data.metrics.unanswered > 0 && (
                <b>{data.metrics.unanswered}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="nav-caption tools-caption">MANAGE</div>
        <nav aria-label="Workspace management">
          {[
            ["/integrations", "Integrations", Layers],
            ["/settings", "Settings", Settings],
          ].map(([to, label, Icon]) => (
            <button
              key={to}
              aria-label={label}
              className={path === to ? "active" : ""}
              onClick={() => navigate(to)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {to === "/integrations" && <span className="new-tag">NEW</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="plan-card">
            <div className="plan-icon">
              <Sparkles size={17} />
              <span>More possibilities.</span>
            </div>
            <p>
              Connect every experience.
              <br />
              Build a stronger reputation.
            </p>
            <button onClick={() => navigate("/billing")}>
              Explore integrations <ArrowUpRight size={15} />
            </button>
          </div>
          <button className="sidebar-help" onClick={() => open("help")}>
            <HelpCircle size={17} />
            <span>Help & getting started</span>
            <ArrowUpRight size={14} />
          </button>
          <button
            className="profile-button"
            onClick={() => navigate("/account")}
          >
            <Avatar name="Workspace owner" />
            <span>
              <strong>Workspace owner</strong>
              <small>{local ? "Local development" : "TAKATAK account"}</small>
            </span>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {route?.[1] ||
                {
                  "/integrations": "Integrations",
                  "/settings": "Settings",
                  "/account": "Account",
                  "/billing": "Plans & billing",
                }[path] ||
                "Reviews"}
            </strong>
          </div>
          <div className="topbar-right">
            <label className="global-search">
              <Search size={17} />
              <input
                aria-label="Search workspace"
                placeholder="Search your workspace…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>⌘ K</kbd>
            </label>
            <span className="header-divider" />
            <div className="notifications-wrap">
              <button
                className={
                  "icon-button notification-bell " +
                  (data.notifications.some((n) => !n.read) ? "unread" : "")
                }
                aria-label="Notifications"
                aria-expanded={notifications}
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={19} />
              </button>
              {notifications && (
                <div className="notification-panel">
                  <header>
                    <h3>Notifications</h3>
                    <button
                      onClick={() =>
                        act(
                          () => api("/notifications/read", { method: "PATCH" }),
                          "All notifications marked as read",
                        )
                      }
                    >
                      Mark all as read
                    </button>
                  </header>
                  {data.notifications.length ? (
                    data.notifications.map((n) => (
                      <button
                        key={n.id}
                        className={
                          "notification-item " + (!n.read ? "unread-item" : "")
                        }
                        onClick={() => {
                          if (n.reviewId) navigate("/reviews/" + n.reviewId);
                          setNotifications(false);
                        }}
                      >
                        <span>
                          <Star size={16} />
                        </span>
                        <div>
                          <strong>{n.title}</strong>
                          <p>{n.text}</p>
                          <small>{relative(n.createdAt)}</small>
                        </div>
                      </button>
                    ))
                  ) : (
                    <Empty
                      icon={Bell}
                      title="You're all caught up"
                      text="New reviews and workspace updates will appear here."
                    />
                  )}
                </div>
              )}
            </div>
            <button
              className="top-avatar"
              aria-label="Open account"
              onClick={() => navigate("/account")}
            >
              <Avatar name="Workspace owner" size="small" />
            </button>
          </div>
        </header>
        <main>
          <div className="context-row">
            <div className="location-select">
              <MapPin size={15} />
              <select
                aria-label="Filter by location"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                <option value="">All locations</option>
                {data.locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </div>
            <div className="context-status">
              {isSample ? (
                <Badge tone="sample" dot>
                  Sample data
                </Badge>
              ) : (
                <span>
                  <i />
                  Your workspace
                </span>
              )}
              <span className="context-dot">·</span>
              <span>{activeLocation?.timezone || "America/Toronto"}</span>
            </div>
          </div>
          {error && <ErrorLine error={error} />}
          {query.trim() ? (
            <GlobalResults
              data={data}
              query={query}
              go={navigate}
              open={open}
              clear={() => setQuery("")}
            />
          ) : path === "/" ? (
            <Overview {...context} local={local} />
          ) : path === "/reviews" ? (
            <Reviews {...context} />
          ) : path.startsWith("/reviews/") ? (
            <ReviewDetail {...context} id={path.split("/")[2]} />
          ) : path === "/customers" ? (
            <Customers {...context} />
          ) : path === "/requests" ? (
            <Requests {...context} />
          ) : path === "/pages" ? (
            <Pages {...context} />
          ) : path === "/widgets" ? (
            <Widgets {...context} />
          ) : path === "/messages" ? (
            <Messages {...context} />
          ) : path === "/automations" ? (
            <Automations {...context} />
          ) : path === "/analytics" ? (
            <Analytics {...context} />
          ) : path === "/integrations" ? (
            <Integrations {...context} />
          ) : path === "/settings" ? (
            <SettingsPage {...context} />
          ) : path === "/billing" ? (
            <Billing {...context} />
          ) : path === "/account" ? (
            <Account {...context} />
          ) : (
            <Empty
              title="Page not found"
              text="This page isn't in your workspace."
              action={
                <Button onClick={() => navigate("/")}>Back to overview</Button>
              }
            />
          )}
          <footer className="app-footer">
            <span>
              TAKATAK Review <span>·</span> Digital Solutions. Real Results.
            </span>
            <span>
              <ShieldCheck size={13} /> Your reputation, connected.
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Info size={18} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {modal && (
        <Editor
          modal={modal}
          data={data}
          defaultLocation={defaultLocation}
          onClose={() => setModal(null)}
          onSaved={async (message) => {
            setModal(null);
            await refresh();
            setToast(message);
          }}
        />
      )}
    </div>
  );
}

function GlobalResults({ data, query, go, open, clear }) {
  const q = query.trim().toLowerCase();
  const reviews = data.reviews.filter((r) =>
    `${r.author} ${r.text} ${r.provider}`.toLowerCase().includes(q),
  );
  const customers = data.customers.filter((c) =>
    `${c.name} ${c.email} ${c.tags.join(" ")}`.toLowerCase().includes(q),
  );
  const pages = data.pages.filter((p) =>
    `${p.name} ${p.title}`.toLowerCase().includes(q),
  );
  return (
    <section className="panel search-results">
      <div className="panel-head">
        <div>
          <h2>Search results</h2>
          <p>
            {reviews.length + customers.length + pages.length} matches in the
            current location view
          </p>
        </div>
        <Button icon={X} onClick={clear}>
          Clear search
        </Button>
      </div>
      {reviews.length + customers.length + pages.length === 0 ? (
        <Empty
          icon={Search}
          title="No matches yet"
          text="Try a customer name, review phrase, email address, or page name."
        />
      ) : (
        <>
          {reviews.slice(0, 20).map((r) => (
            <button
              key={r.id}
              className="search-result"
              onClick={() => go("/reviews/" + r.id)}
            >
              <Star size={17} />
              <div>
                <strong>{r.author}</strong>
                <p>{r.text}</p>
                <small>Review · {r.provider}</small>
              </div>
              <ChevronRight size={16} />
            </button>
          ))}
          {customers.slice(0, 20).map((c) => (
            <button
              key={c.id}
              className="search-result"
              onClick={() => {
                clear();
                go("/customers");
                open("customer", c);
              }}
            >
              <Avatar name={c.name} />
              <div>
                <strong>{c.name}</strong>
                <p>{c.email}</p>
                <small>Customer</small>
              </div>
              <ChevronRight size={16} />
            </button>
          ))}
          {pages.slice(0, 20).map((p) => (
            <button
              key={p.id}
              className="search-result"
              onClick={() => {
                clear();
                go("/pages");
                open("page", p);
              }}
            >
              <Search size={17} />
              <div>
                <strong>{p.name}</strong>
                <p>{p.title}</p>
                <small>Review page</small>
              </div>
              <ChevronRight size={16} />
            </button>
          ))}
        </>
      )}
    </section>
  );
}
export { App };
