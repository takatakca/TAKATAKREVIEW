import {
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  Plus,
  Star,
  MessageSquare,
  Send,
  Check,
  CheckCheck,
  Link as LinkIcon,
  Sparkles,
  CalendarDays,
  Code,
  MessageCircle,
} from "lucide-react";
import {
  api,
  relative,
  Stars,
  Provider,
  Avatar,
  Badge,
  Empty,
  Button,
  PageHead,
  Kpi,
  Trend,
  Sources,
} from "../components/ui.jsx";

function Overview({ data, go, open, act, busy, local, locationId }) {
  const m = data.metrics;
  const reviews = data.reviews
    .filter((r) => r.recommended !== false)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, 3);
  const hasSamples = data.reviews.some((r) => r.sample);
  return (
    <>
      <PageHead
        eyebrow="A LITTLE CLARITY. A LOT OF POSSIBILITY."
        title="Your reputation, in focus."
        description="Every review. Every conversation. One place to make it count."
      >
        <Button icon={Send} variant="primary" onClick={() => open("request")}>
          Request a review
        </Button>
      </PageHead>
      <section className="overview-banner">
        <div className="banner-content">
          <span className="banner-kicker">
            <span /> YOUR NEXT GREAT REVIEW STARTS HERE
          </span>
          <h2>
            Good experiences.
            <br />
            <span>Stronger connections.</span>
          </h2>
          <p>
            Bring your customer feedback together and turn
            <br className="desktop-break" /> every conversation into an
            opportunity to grow.
          </p>
          <button onClick={() => go("/integrations")}>
            Connect a review source <ArrowUpRight size={17} />
          </button>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <span className="spark spark-one">✦</span>
          <span className="spark spark-two">✧</span>
          <div className="floating-rating">
            <span className="art-star">
              <Star size={34} fill="currentColor" />
            </span>
            <div>
              <span className="rating-label">A REPUTATION THAT SHINES</span>
              <span className="rating-stars">★ ★ ★ ★ ★</span>
              <span className="rating-caption">Made of great experiences.</span>
            </div>
            <span className="art-check">
              <Check size={13} />
            </span>
          </div>
          <span className="art-small-card">
            <MessageSquare size={18} />
            <span>Every voice matters.</span>
          </span>
        </div>
      </section>
      <div className="section-toolbar">
        <h2>
          At a glance <span>YOUR REPUTATION SNAPSHOT</span>
        </h2>
        <span className="subtle">
          <CalendarDays size={14} /> All time
        </span>
      </div>
      <div className="kpi-grid">
        <Kpi
          label="Total reviews"
          value={m.total}
          icon={MessageSquare}
          note="Recommended & first-party"
          color="blue"
        />
        <Kpi
          label="Average rating"
          value={m.average ? m.average.toFixed(1) : "—"}
          icon={Star}
          note={
            m.total ? (
              <Stars rating={Math.round(m.average)} small />
            ) : (
              "Your first review starts the story"
            )
          }
          color="amber"
        />
        <Kpi
          label="Response rate"
          value={`${m.responseRate}%`}
          icon={CheckCheck}
          note={`${m.total - m.unanswered} of ${m.total} reviews answered`}
          color="green"
        />
        <Kpi
          label="Needs a reply"
          value={m.unanswered}
          icon={MessageCircle}
          note={
            <button onClick={() => go("/reviews")}>
              Keep the conversation going <ArrowRight size={12} />
            </button>
          }
          color="violet"
        />
      </div>
      <div className="overview-grid">
        <section className="panel trend-panel">
          <div className="panel-head">
            <div>
              <h2>Reputation over time</h2>
              <p>Small moments. Lasting impressions.</p>
            </div>
            <Badge>Last 6 months</Badge>
          </div>
          <Trend reviews={data.reviews} />
          <div className="chart-legend">
            <span>
              <i className="blue-dot" /> Reviews received
            </span>
            <span>
              <i className="cyan-dot" /> 6-month activity
            </span>
          </div>
        </section>
        <section className="panel source-panel">
          <div className="panel-head">
            <div>
              <h2>Your review sources</h2>
              <p>All your voices, together.</p>
            </div>
            <button
              className="text-link"
              onClick={() => go("/integrations")}
              aria-label="Manage review sources"
            >
              <ArrowUpRight size={18} />
            </button>
          </div>
          <Sources data={data} />
          <button className="source-add" onClick={() => go("/integrations")}>
            <Plus size={15} /> Connect another source
          </button>
        </section>
      </div>
      <div className="overview-grid bottom-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Latest reviews</h2>
              <p>A little feedback goes a long way.</p>
            </div>
            <button className="text-link" onClick={() => go("/reviews")}>
              View all <ArrowRight size={14} />
            </button>
          </div>
          {reviews.length ? (
            reviews.map((r) => (
              <button
                className="recent-review"
                key={r.id}
                onClick={() => go("/reviews/" + r.id)}
              >
                <Avatar name={r.author} />
                <div>
                  <div className="recent-review-top">
                    <strong>{r.author}</strong>
                    <span>{relative(r.publishedAt)}</span>
                  </div>
                  <div className="review-meta">
                    <Stars rating={r.rating} small />
                    <Provider name={r.provider} label />
                    {r.sample && <span className="sample-label">Sample</span>}
                  </div>
                  <p>{r.text}</p>
                </div>
                <ChevronRight size={16} />
              </button>
            ))
          ) : (
            <Empty
              icon={Star}
              title="Your next great story starts here"
              text="Connect a source or collect your first review to see it here."
              action={
                <Button onClick={() => go("/pages")} icon={LinkIcon}>
                  Get your review link
                </Button>
              }
            />
          )}
        </section>
        <section className="panel checklist-panel">
          <div className="panel-head">
            <div>
              <h2>Make yourself review-ready</h2>
              <p>A few small steps to a big first impression.</p>
            </div>
            <span className="completion-ring">
              {
                [
                  data.settings.name !== "My business",
                  data.customers.length > 0,
                  data.pages.length > 0,
                  data.integrations.some(
                    (i) => i.id !== "takatak" && i.status === "connected",
                  ),
                ].filter(Boolean).length
              }
              /4
            </span>
          </div>
          {[
            [
              "Set up your business",
              data.settings.name !== "My business",
              "/settings",
            ],
            [
              "Add your first customers",
              data.customers.length > 0,
              "/customers",
            ],
            ["Create your review page", data.pages.length > 0, "/pages"],
            [
              "Connect a review source",
              data.integrations.some(
                (i) => i.id !== "takatak" && i.status === "connected",
              ),
              "/integrations",
            ],
          ].map(([label, done, to]) => (
            <button
              key={label}
              className="checklist-item"
              onClick={() => go(to)}
            >
              <span className={done ? "checked" : ""}>
                {done ? <Check size={13} /> : null}
              </span>
              <strong>{label}</strong>
              <ArrowUpRight size={15} />
            </button>
          ))}
          <div className="checklist-tip">
            <Sparkles size={17} />
            <p>
              Consistency builds trust.
              <br />
              <strong>One conversation at a time.</strong>
            </p>
          </div>
        </section>
      </div>
      {local && (
        <div className="local-banner">
          <div>
            <Code size={18} />
            <span>
              <strong>Local workspace</strong> ·{" "}
              {hasSamples
                ? "Sample reviews are fictional. Provider accounts are not connected."
                : "Explore with sample data, or start collecting real first-party feedback."}
            </span>
          </div>
          <button
            disabled={busy}
            onClick={() =>
              act(
                () =>
                  api("/sample", { method: hasSamples ? "DELETE" : "POST" }),
                hasSamples
                  ? "Sample records removed"
                  : "Fictional sample workspace loaded",
              )
            }
          >
            {hasSamples ? "Clear sample data" : "Explore sample data"}
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </>
  );
}

export { Overview };
