import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Star,
  Send,
  Check,
  X,
  Link as LinkIcon,
  ShieldCheck,
  Building2,
  Loader2,
} from "lucide-react";
import {
  api,
  relative,
  Stars,
  Empty,
  Button,
  Field,
  ErrorLine,
} from "../components/ui.jsx";

function PublicReview({ slug }) {
  const [page, setPage] = useState(null),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false),
    [rating, setRating] = useState(0),
    [hover, setHover] = useState(0);
  useEffect(() => {
    api("/public/pages/" + encodeURIComponent(slug))
      .then(setPage)
      .catch((e) => setError(e.message));
  }, [slug]);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(e.currentTarget);
      await api("/public/pages/" + encodeURIComponent(slug), {
        method: "POST",
        body: {
          rating,
          text: form.get("text"),
          author: form.get("author"),
          publishConsent: form.get("publishConsent") === "on",
          contactAllowed: form.get("contactAllowed") === "on",
          requestToken:
            new URLSearchParams(location.search).get("request") || "",
        },
      });
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="public-shell">
      <header>
        <div className="public-wordmark">
          TAKATAK<span>REVIEW</span>
        </div>
        <span>
          <ShieldCheck size={14} /> An honest experience matters.
        </span>
      </header>
      <div className="public-background" />
      <main className="public-review-panel">
        {page ? (
          <>
            {done ? (
              <div className="public-thanks">
                <span>
                  <Check size={35} />
                </span>
                <h1>Thank you for sharing.</h1>
                <p>{page.thankYou}</p>
                <div className="public-divider" />
                <p className="subtle">
                  Your feedback was saved. Public display is controlled by your
                  consent.
                </p>
              </div>
            ) : (
              <>
                <div className="public-business">
                  <span>
                    <Building2 size={23} />
                  </span>
                  <strong>{page.name}</strong>
                </div>
                <span className="eyebrow">
                  A MOMENT OF YOUR TIME. A WORLD OF DIFFERENCE.
                </span>
                <h1>{page.title}</h1>
                <p>{page.description}</p>
                <form onSubmit={submit}>
                  <fieldset className="rating-picker">
                    <legend>How was your experience?</legend>
                    <div>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          type="button"
                          key={n}
                          aria-label={`Rate ${n} ${n === 1 ? "star" : "stars"}`}
                          aria-pressed={rating === n}
                          onMouseEnter={() => setHover(n)}
                          onMouseLeave={() => setHover(0)}
                          onClick={() => setRating(n)}
                        >
                          <Star
                            size={37}
                            fill={
                              n <= (hover || rating) ? "currentColor" : "none"
                            }
                          />
                        </button>
                      ))}
                    </div>
                    {rating > 0 && (
                      <span>
                        {
                          [
                            "",
                            "There is room to improve",
                            "Could be better",
                            "It was okay",
                            "A good experience",
                            "An excellent experience",
                          ][rating]
                        }
                      </span>
                    )}
                  </fieldset>
                  <Field
                    label="Your name"
                    name="author"
                    required
                    maxLength={100}
                    placeholder="How should we address you?"
                  />
                  <Field label="Tell us about your experience">
                    <textarea
                      name="text"
                      minLength={3}
                      maxLength={3000}
                      required
                      rows={4}
                      placeholder="What stood out? What could be better? We’re listening."
                    />
                  </Field>
                  <label className="checkbox-field">
                    <input name="publishConsent" type="checkbox" />
                    <span>
                      I agree to have my name and review shown publicly.
                    </span>
                  </label>
                  <label className="checkbox-field">
                    <input name="contactAllowed" type="checkbox" />
                    <span>
                      The business may keep follow-up notes about this
                      experience.
                    </span>
                  </label>
                  <ErrorLine error={error} />
                  <Button
                    variant="primary"
                    className="full-width"
                    busy={busy}
                    disabled={!rating}
                    icon={Send}
                  >
                    Share my experience
                  </Button>
                  <p className="privacy-fine">
                    All ratings are welcome. Public sharing is optional and
                    never required to submit.
                  </p>
                </form>
              </>
            )}
          </>
        ) : error ? (
          <Empty
            icon={LinkIcon}
            title="This review page is unavailable"
            text={error}
          />
        ) : (
          <div className="empty">
            <Loader2 className="spin" />
          </div>
        )}
      </main>
      <footer>
        Powered by <strong>TAKATAK</strong> · Digital Solutions. Real Results.
      </footer>
    </div>
  );
}
function PublicWidget({ id }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [index, setIndex] = useState(0),
    [open, setOpen] = useState(false);
  useEffect(() => {
    api("/public/widgets/" + encodeURIComponent(id))
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);
  if (error) return <Empty title="Widget unavailable" text={error} />;
  if (!data)
    return (
      <div className="empty">
        <Loader2 className="spin" />
      </div>
    );
  const { reviews, widget } = data;
  const avg = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : null;
  const cards =
    widget.type === "carousel" ? reviews.slice(index, index + 1) : reviews;
  return (
    <div className={"public-widget " + widget.type}>
      <header>
        <span className="eyebrow">CUSTOMER VOICES</span>
        <h2>{widget.name}</h2>
        <span>First-party feedback · shared with permission</span>
      </header>
      {widget.type === "badge" ? (
        <div className="rating-badge">
          <strong>{avg?.toFixed(1) || "—"}</strong>
          <Stars rating={Math.round(avg || 0)} />
          <p>{reviews.length} consented reviews</p>
        </div>
      ) : widget.type === "popup" && !open ? (
        <Button variant="primary" icon={Star} onClick={() => setOpen(true)}>
          Read customer experiences
        </Button>
      ) : (
        <>
          {widget.type === "popup" && (
            <button
              className="icon-button popup-close"
              aria-label="Close review popup"
              onClick={() => setOpen(false)}
            >
              <X size={19} />
            </button>
          )}
          <div className="public-widget-cards">
            {cards.map((r, i) => (
              <article key={i}>
                <Stars rating={r.rating} />
                <p>“{r.text}”</p>
                <strong>{r.author}</strong>
                <small>{relative(r.publishedAt)}</small>
                {r.reply && (
                  <div className="owner-reply">
                    <span>Business response</span>
                    <p>{r.reply}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
          {!reviews.length && (
            <p className="subtle">
              Consented customer experiences will appear here.
            </p>
          )}
          {widget.type === "carousel" && reviews.length > 1 && (
            <div className="carousel-controls">
              <Button
                icon={ArrowLeft}
                disabled={index === 0}
                onClick={() => setIndex(index - 1)}
              >
                Previous
              </Button>
              <span>
                {index + 1} / {reviews.length}
              </span>
              <Button
                icon={ArrowRight}
                disabled={index >= reviews.length - 1}
                onClick={() => setIndex(index + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
      <footer>TAKATAK Review</footer>
    </div>
  );
}

export { PublicReview, PublicWidget };
