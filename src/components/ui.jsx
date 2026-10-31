import { useEffect, useRef, useState } from "react";
import {
  Star,
  LayoutDashboard,
  MessageSquare,
  Users,
  Send,
  PanelsTopLeft,
  LayoutGrid,
  Workflow,
  ChartNoAxesCombined,
  X,
  AlertCircle,
  Inbox,
  Loader2,
} from "lucide-react";

async function api(path, options = {}) {
  const response = await fetch("/api" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
function useRoute() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const fn = () => setPath(location.pathname);
    window.addEventListener("popstate", fn);
    return () => window.removeEventListener("popstate", fn);
  }, []);
  const go = (to) => {
    history.pushState({}, "", to);
    setPath(to);
    window.scrollTo(0, 0);
  };
  return [path, go];
}
const nav = [
  ["/", "Overview", LayoutDashboard],
  ["/reviews", "Reviews", Star],
  ["/customers", "Customers", Users],
  ["/requests", "Review requests", Send],
  ["/pages", "Review pages", PanelsTopLeft],
  ["/widgets", "Widgets", LayoutGrid],
  ["/messages", "Messages", MessageSquare],
  ["/automations", "Automations", Workflow],
  ["/analytics", "Analytics", ChartNoAxesCombined],
];
const providerName = {
  google: "Google",
  takatak: "TAKATAK",
  yelp: "Yelp",
  tripadvisor: "TripAdvisor",
  facebook: "Facebook",
  trustpilot: "Trustpilot",
};
const providerColor = {
  google: "#4285f4",
  takatak: "#1565d8",
  yelp: "#c64245",
  tripadvisor: "#16806a",
  facebook: "#1877f2",
  trustpilot: "#16806a",
};
const relative = (value) =>
  new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" }).format(
    new Date(value),
  );
function Stars({ rating, small = false }) {
  return (
    <span
      className={"stars " + (small ? "small" : "")}
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={small ? 12 : 16}
          fill={i <= rating ? "currentColor" : "none"}
          className={i <= rating ? "" : "unfilled"}
        />
      ))}
    </span>
  );
}
function Provider({ name, label = false }) {
  return (
    <span className={"provider " + (label ? "with-label" : "")}>
      <span
        className={"provider-icon " + name}
        style={{ "--provider": providerColor[name] }}
      >
        {name === "google"
          ? "G"
          : name === "tripadvisor"
            ? "t"
            : name === "takatak"
              ? "T"
              : name === "trustpilot"
                ? "★"
                : name?.[0]}
      </span>
      {label && <span>{providerName[name] || name}</span>}
    </span>
  );
}
function Avatar({ name, size = "normal" }) {
  return (
    <span
      className={`avatar ${size}`}
      style={{
        "--avatar-hue":
          (name || "").split("").reduce((s, c) => s + c.charCodeAt(0), 0) % 360,
      }}
    >
      {name
        ?.split(" ")
        .map((x) => x[0])
        .slice(0, 2)
        .join("") || "?"}
    </span>
  );
}
function Badge({ children, tone = "neutral", dot = false }) {
  return (
    <span className={`badge ${tone}`}>
      {dot && <i />}
      {children}
    </span>
  );
}
function Empty({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={27} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function Button({
  children,
  icon: Icon,
  variant = "",
  className = "",
  busy = false,
  ...props
}) {
  return (
    <button
      {...props}
      className={`button ${variant} ${className}`}
      disabled={busy || props.disabled}
    >
      {busy ? (
        <Loader2 size={16} className="spin" />
      ) : (
        Icon && <Icon size={16} />
      )}
      <span>{children}</span>
    </button>
  );
}
function Modal({ title, subtitle, children, onClose, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const element = ref.current;
    element.showModal();
    const handler = (e) => {
      e.preventDefault();
      onClose();
    };
    element.addEventListener("cancel", handler);
    return () => element.removeEventListener("cancel", handler);
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={"modal " + (wide ? "wide" : "")}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <header>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
function Field({ label, help, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || <input {...props} />}
      {help && <small>{help}</small>}
    </label>
  );
}
function PageHead({ eyebrow, title, description, children }) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow || "REPUTATION WORKSPACE"}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="head-actions">{children}</div>
    </div>
  );
}
function ErrorLine({ error }) {
  return error ? (
    <div className="inline-error" role="alert">
      <AlertCircle size={17} />
      {error}
    </div>
  ) : null;
}
function download(kind, locationId) {
  const a = document.createElement("a");
  a.href = `/api/export/${kind}${locationId ? `?location=${encodeURIComponent(locationId)}` : ""}`;
  a.download = "";
  a.click();
}
function parseCSV(text) {
  const rows = [];
  let row = [],
    value = "",
    quote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quote && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quote = !quote;
    } else if (c === "," && !quote) {
      row.push(value);
      value = "";
    } else if ((c === "\n" || c === "\r") && !quote) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else value += c;
  }
  if (quote) throw new Error("CSV has an unclosed quote.");
  row.push(value);
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2)
    throw new Error("Add a header row and at least one customer.");
  const headers = rows.shift().map((s) => s.trim().toLowerCase());
  if (!headers.includes("name") || !headers.includes("email"))
    throw new Error("CSV needs name and email columns.");
  return rows.map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, (r[i] || "").trim()])),
  );
}

function Kpi({ label, value, icon: Icon, note, color }) {
  return (
    <section className="kpi">
      <div className="kpi-top">
        <span>{label}</span>
        <span className={"kpi-icon " + color}>
          <Icon size={18} />
        </span>
      </div>
      <strong>{value}</strong>
      <div className="kpi-note">{note}</div>
    </section>
  );
}
function Trend({ reviews }) {
  const now = new Date();
  const months = Array.from(
    { length: 6 },
    (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1),
  );
  const counts = months.map(
    (date) =>
      reviews.filter(
        (r) =>
          r.recommended !== false &&
          new Date(r.publishedAt).getMonth() === date.getMonth() &&
          new Date(r.publishedAt).getFullYear() === date.getFullYear(),
      ).length,
  );
  const max = Math.max(4, ...counts);
  const points = counts
    .map((c, i) => `${45 + i * 95},${170 - (c / max) * 130}`)
    .join(" ");
  const line = counts
    .map((c, i) => `${i ? "L" : "M"} ${45 + i * 95} ${170 - (c / max) * 130}`)
    .join(" ");
  return (
    <div className="trend-chart">
      <svg
        viewBox="0 0 565 210"
        role="img"
        aria-label={`Review volume for six months: ${counts.join(", ")}`}
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#1f8bff" stopOpacity=".2" />
            <stop offset="100%" stopColor="#1f8bff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line
              x1="35"
              x2="535"
              y1={40 + i * 32.5}
              y2={40 + i * 32.5}
              stroke="#e9edf3"
              strokeDasharray="4 5"
            />
            <text x="8" y={44 + i * 32.5} fill="#5f7087" fontSize="10">
              {Math.round(max - (i * max) / 4)}
            </text>
          </g>
        ))}
        <path d={`${line} L 520 170 L 45 170 Z`} fill="url(#chart-fill)" />
        <polyline
          points={points}
          fill="none"
          stroke="#1f8bff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {counts.map((c, i) => (
          <g key={i}>
            <circle
              cx={45 + i * 95}
              cy={170 - (c / max) * 130}
              r="4"
              fill="white"
              stroke="#1f8bff"
              strokeWidth="2"
            />
            <text
              textAnchor="middle"
              x={45 + i * 95}
              y="197"
              fill="#5f7087"
              fontSize="10"
            >
              {months[i].toLocaleDateString("en", { month: "short" })}
            </text>
          </g>
        ))}
      </svg>
      {!reviews.length && (
        <span className="chart-no-data">
          Your review history will grow here
        </span>
      )}
    </div>
  );
}
function Sources({ data }) {
  const sources = ["google", "takatak", "tripadvisor", "yelp"];
  return (
    <div className="source-list">
      {sources.map((p) => {
        const list = data.reviews.filter(
          (r) => r.provider === p && r.recommended !== false,
        );
        const avg = list.length
          ? list.reduce((a, b) => a + b.rating, 0) / list.length
          : null;
        const connected =
          data.integrations.find((i) => i.id === p)?.status === "connected";
        return (
          <div className="source-row" key={p}>
            <Provider name={p} />
            <div>
              <strong>{providerName[p]}</strong>
              <span>
                {list.length} {list.some((r) => r.sample) ? "sample " : ""}
                reviews
              </span>
            </div>
            <span className="source-rating">
              {avg ? (
                <>
                  {avg.toFixed(1)} <Star size={12} fill="currentColor" />
                </>
              ) : (
                <span className="source-not-connected">
                  {connected ? "Connected" : "Not connected"}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export {
  api,
  useRoute,
  nav,
  providerName,
  providerColor,
  relative,
  Stars,
  Provider,
  Avatar,
  Badge,
  Empty,
  Button,
  Modal,
  Field,
  PageHead,
  ErrorLine,
  download,
  parseCSV,
  Kpi,
  Trend,
  Sources,
};
