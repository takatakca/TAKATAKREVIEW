import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Star,
  MessageSquare,
  Users,
  Send,
  MoreHorizontal,
  Download,
  X,
  RefreshCw,
  Link as LinkIcon,
  Copy,
  ShieldCheck,
  Mail,
  Lock,
  Pencil,
  Info,
  Filter,
  Layers,
  UserRound,
  Flag,
  ThumbsUp,
  MessageCircle,
  Tag,
  Image as ImageIcon,
} from "lucide-react";
import {
  api,
  providerName,
  relative,
  Stars,
  Provider,
  Avatar,
  Badge,
  Empty,
  Button,
  Field,
  PageHead,
  download,
} from "../components/ui.jsx";

function Reviews({ data, reviews, go, open, locationId }) {
  const [provider, setProvider] = useState("all"),
    [rating, setRating] = useState("all"),
    [status, setStatus] = useState("all"),
    [sort, setSort] = useState("newest"),
    [tab, setTab] = useState("recommended"),
    [page, setPage] = useState(1),
    [photoDismissed, setPhotoDismissed] = useState(false);
  useEffect(() => setPage(1), [provider, rating, status, tab, locationId]);
  const yelp = provider === "yelp";
  const filtered = reviews
    .filter(
      (r) =>
        (provider === "all" || r.provider === provider) &&
        (rating === "all" || r.rating === Number(rating)) &&
        (status === "all" ||
          (status === "unanswered" ? !r.reply : !!r.reply)) &&
        (!yelp ||
          (tab === "unrecommended"
            ? r.recommended === false
            : r.recommended !== false)),
    )
    .sort((a, b) =>
      sort === "rating"
        ? b.rating - a.rating
        : new Date(b.publishedAt) - new Date(a.publishedAt),
    );
  const countYelpUnrecommended = reviews.filter(
    (r) => r.provider === "yelp" && r.recommended === false,
  ).length;
  return (
    <>
      <PageHead
        title="Every voice, one view."
        description="Listen closely. Respond thoughtfully. Build lasting trust."
      >
        <Button icon={Download} onClick={() => download("reviews", locationId)}>
          Export
        </Button>
        <Button
          variant="primary"
          icon={RefreshCw}
          onClick={() => go("/integrations")}
        >
          Sync reviews
        </Button>
      </PageHead>
      <div className="provider-tabs" role="tablist" aria-label="Review sources">
        {["all", "takatak", "google", "tripadvisor", "yelp", "facebook"].map(
          (p) => (
            <button
              key={p}
              role="tab"
              aria-selected={provider === p}
              className={provider === p ? "active" : ""}
              onClick={() => {
                setProvider(p);
                setTab("recommended");
                setRating("all");
                setStatus("all");
              }}
            >
              {p === "all" ? <Layers size={16} /> : <Provider name={p} />}
              <span>{p === "all" ? "All reviews" : providerName[p]}</span>
              <b>
                {reviews.filter((r) => p === "all" || r.provider === p).length}
              </b>
            </button>
          ),
        )}
      </div>
      {yelp && (
        <>
          <div className="provider-note">
            <Info size={18} />
            <div>
              <strong>Provider-specific workspace</strong>
              <p>
                This view follows the documented review-list behavior. Reviews
                excluded by the source do not affect your average rating.
                Requests and promotional widgets are not available for this
                source.
              </p>
            </div>
          </div>
          {!photoDismissed &&
            !data.integrations.find((p) => p.id === "yelp")?.photoVerified && (
              <div className="photo-gate">
                <ImageIcon size={20} />
                <div>
                  <strong>
                    Your provider account photo needs verification
                  </strong>
                  <span>
                    Reply actions stay locked until the provider verifies your
                    account and grants supported reply access.
                  </span>
                </div>
                <Button onClick={() => go("/integrations")}>
                  View requirements <ArrowUpRight size={14} />
                </Button>
                <button
                  className="icon-button"
                  aria-label="Dismiss provider photo notice"
                  onClick={() => setPhotoDismissed(true)}
                >
                  <X size={15} />
                </button>
              </div>
            )}
          <div className="subtabs">
            <button
              className={tab === "recommended" ? "active" : ""}
              onClick={() => setTab("recommended")}
            >
              Recommended reviews
            </button>
            {countYelpUnrecommended > 0 && (
              <button
                className={tab === "unrecommended" ? "active" : ""}
                onClick={() => setTab("unrecommended")}
              >
                Not recommended ({countYelpUnrecommended})
              </button>
            )}
          </div>
        </>
      )}
      {!yelp && (
        <div className="review-summary">
          <div>
            <strong>{data.metrics.average?.toFixed(1) || "—"}</strong>
            <div>
              <Stars rating={Math.round(data.metrics.average || 0)} />
              <p>{data.metrics.total} reviews in this location view</p>
            </div>
          </div>
          <span />
          <div>
            <MessageSquare size={20} />
            <div>
              <strong>{data.metrics.unanswered}</strong>
              <p>awaiting a thoughtful reply</p>
            </div>
          </div>
          <div className="summary-right">
            <ShieldCheck size={20} />
            <p>
              All ratings welcome.
              <br />
              <strong>Every experience matters.</strong>
            </p>
          </div>
        </div>
      )}
      {yelp && tab === "unrecommended" && (
        <div className="explanation">
          <h3>Understanding the source's review selection</h3>
          <p>
            The source decides which reviews contribute to its rating. These
            reviews are retained for context and excluded from the overall score
            in this workspace.
          </p>
        </div>
      )}
      {!yelp && (
        <div className="filterbar">
          <div className="filter-group">
            <Filter size={15} />
            <select
              aria-label="Filter reviews by rating"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            >
              <option value="all">All ratings</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} stars
                </option>
              ))}
            </select>
            <select
              aria-label="Filter reviews by response"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">All responses</option>
              <option value="unanswered">Needs a reply</option>
              <option value="answered">Answered</option>
            </select>
          </div>
          <select
            aria-label="Sort reviews"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="newest">Most recent</option>
            <option value="rating">Highest rating</option>
          </select>
        </div>
      )}
      <div className="review-count">
        {filtered.length}{" "}
        {yelp && tab === "unrecommended" ? "not recommended " : ""}reviews
      </div>
      {filtered.length ? (
        <>
          <div className="review-cards">
            {(yelp ? filtered : filtered.slice((page - 1) * 8, page * 8)).map(
              (r) => (
                <ReviewCard key={r.id} review={r} go={go} open={open} />
              ),
            )}
          </div>
          {yelp ? (
            <p className="page-count">Page 1 of 1</p>
          ) : (
            <div className="pagination">
              <span>
                Showing {Math.min((page - 1) * 8 + 1, filtered.length)}–
                {Math.min(page * 8, filtered.length)} of {filtered.length}
              </span>
              <Button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                icon={ArrowLeft}
              >
                Previous
              </Button>
              <Button
                onClick={() => setPage(page + 1)}
                disabled={page * 8 >= filtered.length}
                icon={ArrowRight}
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        <section className="panel">
          <Empty
            icon={Star}
            title={
              yelp
                ? tab === "unrecommended"
                  ? "No excluded reviews"
                  : "No recommended reviews yet"
                : "A fresh start for your reputation"
            }
            text="Reviews will appear here when you connect a source or collect first-party feedback."
            action={
              !yelp && (
                <Button onClick={() => go("/pages")} icon={LinkIcon}>
                  View review pages
                </Button>
              )
            }
          />
          {yelp && (
            <div className="yelp-guidance">
              <h3>Build trust through great experiences</h3>
              <p>
                Keep your business information current and focus on thoughtful
                customer service. Follow the source's review policies;
                solicitation tools are not offered in this provider view.
              </p>
              <button className="text-link" onClick={() => go("/settings")}>
                Complete your business profile <ArrowRight size={15} />
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
function ReviewCard({ review: r, go, open, detail = false }) {
  const [menu, setMenu] = useState(false);
  if (r.provider === "yelp")
    return (
      <article className={"panel yelp-review-card " + (detail ? "detail" : "")}>
        <aside className="yelp-reviewer">
          <span className="reviewer-silhouette">
            <UserRound size={30} />
          </span>
          <strong>{r.author}</strong>
          {r.reviewer?.city && <span>{r.reviewer.city}</span>}
          <small>
            <Users size={12} /> {r.reviewer?.friends || 0} friends ·{" "}
            {r.reviewer?.reviews || 0} reviews · {r.reviewer?.photos || 0}{" "}
            photos
          </small>
          {r.sample && <Badge tone="sample">Sample</Badge>}
        </aside>
        <div className="yelp-review-body">
          <div className="review-card-top">
            <div className="review-stars-line">
              <Stars rating={r.rating} />
              <time>
                {detail
                  ? r.publishedAt.slice(2, 10)
                  : new Date(r.publishedAt).toLocaleDateString("en-US", {
                      timeZone: "UTC",
                    })}
              </time>
              {r.recommended === false && <Badge>Not recommended</Badge>}
            </div>
            <div className="more-wrap">
              <button
                className="icon-button"
                aria-label={`More actions for ${r.author}`}
                aria-expanded={menu}
                onClick={() => setMenu(!menu)}
              >
                <MoreHorizontal size={19} />
              </button>
              {menu && (
                <div className="dropdown">
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(
                        location.origin + "/reviews/" + r.id,
                      );
                      setMenu(false);
                    }}
                  >
                    <LinkIcon size={15} />
                    Copy workspace link
                  </button>
                  <button
                    onClick={() => {
                      open("report", r);
                      setMenu(false);
                    }}
                  >
                    <Flag size={15} />
                    Report review guidance
                  </button>
                </div>
              )}
            </div>
          </div>
          <p className="review-text">{r.text}</p>
          {!detail && (
            <div className="yelp-review-footer">
              <Button
                icon={MessageSquare}
                onClick={() => go("/reviews/" + r.id)}
              >
                Public comment
              </Button>
              {r.contactAllowed ? (
                <Button
                  icon={Mail}
                  onClick={() => go("/reviews/" + r.id + "/message")}
                >
                  Direct message
                </Button>
              ) : (
                <strong>This reviewer does not accept direct messages.</strong>
              )}
            </div>
          )}
        </div>
      </article>
    );
  return (
    <article
      className={"panel review-card " + (detail ? "review-detail-card" : "")}
    >
      <div className="review-card-top">
        <div className="review-author">
          <Avatar name={r.author} />
          <div>
            <strong>{r.author}</strong>
            <div>
              <Provider name={r.provider} label />
              {r.sample && <Badge tone="sample">Sample</Badge>}
              {r.recommended === false && <Badge>Not recommended</Badge>}
            </div>
          </div>
        </div>
        <div className="review-actions">
          <time>{relative(r.publishedAt)}</time>
          <div className="more-wrap">
            <button
              className="icon-button"
              aria-label={`More actions for ${r.author}`}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <MoreHorizontal size={19} />
            </button>
            {menu && (
              <div className="dropdown">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      location.origin + "/reviews/" + r.id,
                    );
                    setMenu(false);
                  }}
                >
                  <LinkIcon size={15} />
                  Copy workspace link
                </button>
                <button
                  onClick={() => {
                    open("report", r);
                    setMenu(false);
                  }}
                >
                  <Flag size={15} />
                  Report review guidance
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="review-stars-line">
        <Stars rating={r.rating} />
        <span>
          {r.reply ? (
            <Badge tone="success" dot>
              Answered
            </Badge>
          ) : (
            <Badge tone="warning" dot>
              Needs a reply
            </Badge>
          )}
        </span>
      </div>
      {r.provider === "yelp" && r.reviewer && (
        <p className="reviewer-stats">
          {r.reviewer.city} · {r.reviewer.friends} friends ·{" "}
          {r.reviewer.reviews} reviews · {r.reviewer.photos} photos
        </p>
      )}
      <p className="review-text">{r.text}</p>
      {r.reply && (
        <div className="owner-reply">
          <span>
            <MessageSquare size={15} /> Your response
          </span>
          <p>{r.reply}</p>
        </div>
      )}
      {!detail && (
        <div className="review-card-footer">
          <div>
            {r.tags?.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
          <Button
            variant="text"
            icon={MessageSquare}
            onClick={() => go("/reviews/" + r.id)}
          >
            {r.reply
              ? "View conversation"
              : r.provider === "yelp"
                ? "Public comment"
                : "Reply to review"}
          </Button>
          {r.provider === "yelp" && r.contactAllowed && (
            <Button
              variant="text"
              icon={Mail}
              onClick={() => go("/reviews/" + r.id + "/message")}
            >
              Direct message
            </Button>
          )}
          {r.provider === "yelp" && !r.contactAllowed && (
            <span className="subtle">
              This reviewer does not accept direct messages.
            </span>
          )}
        </div>
      )}
    </article>
  );
}
function ReviewDetail({ data, id, go, open, act, busy }) {
  const review = data.reviews.find((r) => r.id === id);
  const [text, setText] = useState(""),
    [showReview, setShowReview] = useState(false);
  const dm = location.pathname.endsWith("/message");
  if (!review)
    return (
      <Empty
        title="Review not found"
        text="This review is not in the current location view."
        action={<Button onClick={() => go("/reviews")}>Back to reviews</Button>}
      />
    );
  const yelp = review.provider === "yelp";
  const canReply =
    !review.sample &&
    (review.provider === "takatak" ||
      (review.provider === "google" &&
        data.integrations.find((p) => p.id === "google")?.configured &&
        data.integrations.find((p) => p.id === "google")?.entitled));
  return (
    <>
      <button className="back-link" onClick={() => go("/reviews")}>
        <ArrowLeft size={15} /> All reviews
      </button>
      <PageHead
        eyebrow="EVERY CONVERSATION COUNTS"
        title={dm ? "A personal conversation" : `${review.author}'s review`}
        description={
          dm
            ? "Keep your follow-up thoughtful, relevant, and welcome."
            : "A little care can make a lasting impression."
        }
      />
      <div className="detail-grid">
        <div>
          {dm ? (
            <section className="panel dm-panel">
              <div className="review-author">
                <Avatar name={review.author} />
                <strong>{review.author}</strong>
              </div>
              <button
                className="text-link"
                onClick={() => setShowReview(!showReview)}
              >
                {showReview ? "Hide review" : "See review"}
                <ChevronDown size={15} />
              </button>
              {showReview && (
                <div>
                  <Stars rating={review.rating} />
                  <p>{review.text}</p>
                </div>
              )}
              <div className="thread-empty">
                <MessageSquare size={28} />
                <span>No messages in this conversation.</span>
              </div>
              <div className="provider-note">
                <Info size={17} />
                <p>
                  Source messaging may limit the first message until the
                  customer responds.
                </p>
              </div>
              <textarea
                aria-label="Direct message"
                disabled
                placeholder="Direct messaging requires verified provider access."
              />
              <Button disabled icon={Send}>
                Send message
              </Button>
            </section>
          ) : (
            <>
              <ReviewCard review={review} go={go} open={open} detail />
              {yelp ? (
                <section className="panel response-gate">
                  <Lock size={25} />
                  <h3>Verify your provider account to respond</h3>
                  <p>
                    The account photo gate and provider permissions must be
                    cleared first. This reference does not expose an active
                    public-reply composer.
                  </p>
                  <div>
                    <Button disabled icon={ThumbsUp}>
                      Thank
                    </Button>
                    <Button disabled icon={MessageSquare}>
                      Respond
                    </Button>
                    <Button disabled={true} icon={Mail}>
                      Direct message
                    </Button>
                  </div>
                  {review.contactAllowed && (
                    <button
                      className="text-link"
                      onClick={() => go("/reviews/" + review.id + "/message")}
                    >
                      View message screen <ArrowRight size={14} />
                    </button>
                  )}
                </section>
              ) : (
                <section className="panel reply-composer">
                  <div className="panel-head">
                    <div>
                      <h2>
                        {review.reply
                          ? "Update your response"
                          : "Make it personal"}
                      </h2>
                      <p>
                        A thoughtful reply shows customers you're listening.
                      </p>
                    </div>
                    <MessageSquare size={20} />
                  </div>
                  {!canReply && (
                    <div className="provider-note">
                      <Info size={17} />
                      <p>
                        {review.sample
                          ? "This is a fictional sample review. Collect first-party feedback to test a real response."
                          : "Configure a supported provider connection before publishing a response."}
                      </p>
                    </div>
                  )}
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const result = await act(
                        () =>
                          api("/reviews/" + review.id + "/reply", {
                            method: "POST",
                            body: { text },
                          }),
                        "Response saved",
                      );
                      if (result) setText("");
                    }}
                  >
                    <Field label="Your response">
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        required
                        maxLength={5000}
                        placeholder="Thank you for sharing your experience…"
                        disabled={!canReply}
                      />
                    </Field>
                    <div className="composer-footer">
                      <span className="subtle">
                        {text.length}/5,000 characters
                      </span>
                      <Button
                        variant="primary"
                        busy={busy}
                        disabled={!canReply || !text.trim()}
                        icon={Send}
                      >
                        {review.provider === "takatak"
                          ? "Save response"
                          : "Publish response"}
                      </Button>
                    </div>
                  </form>
                  {review.provider === "takatak" &&
                    review.contactAllowed &&
                    !review.sample && (
                      <div className="internal-note-action">
                        <Button
                          icon={Pencil}
                          variant="text"
                          onClick={() => open("message", review)}
                        >
                          Save internal follow-up note
                        </Button>
                      </div>
                    )}
                </section>
              )}
            </>
          )}
        </div>
        <aside className="detail-aside">
          <section className="panel">
            <span className="tip-icon">
              <MessageCircle size={21} />
            </span>
            <h3>Show them you're listening.</h3>
            <p>
              Thank the customer, acknowledge their experience, and keep it
              personal. Never include private customer details in a public
              response.
            </p>
            <div className="aside-rule" />
            <h4>Source guidelines</h4>
            <p>
              {yelp
                ? "Respect this source’s policy on unsolicited reviews and customer contact. Customer consent and provider account restrictions apply."
                : "Respond to all feedback with care. Acknowledge areas for improvement and offer a practical next step."}
            </p>
          </section>
          <section className="panel">
            <h3>Review details</h3>
            <dl>
              <dt>Source</dt>
              <dd>{providerName[review.provider]}</dd>
              <dt>Received</dt>
              <dd>
                {new Date(review.publishedAt).toLocaleDateString("en-CA")}
              </dd>
              <dt>Location</dt>
              <dd>
                {data.locations.find((l) => l.id === review.locationId)?.name}
              </dd>
              <dt>Follow-up</dt>
              <dd>{review.contactAllowed ? "Allowed" : "Not requested"}</dd>
            </dl>
            <Button
              variant="text"
              icon={Tag}
              onClick={() => open("review-tags", review)}
            >
              Manage tags
            </Button>
          </section>
        </aside>
      </div>
    </>
  );
}

export { Reviews, ReviewCard, ReviewDetail };
