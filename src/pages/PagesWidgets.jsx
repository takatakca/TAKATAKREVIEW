import {
  Plus,
  Star,
  LayoutGrid,
  ExternalLink,
  Link as LinkIcon,
  Copy,
  ShieldCheck,
  Trash2,
  Pencil,
  Code,
} from "lucide-react";
import { Badge, Button, PageHead } from "../components/ui.jsx";

function Pages({ data, query, open, setToast }) {
  const pages = data.pages.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title="A place for their experience."
        description="A simple, branded home for honest customer feedback."
      >
        <Button variant="primary" icon={Plus} onClick={() => open("page")}>
          Create review page
        </Button>
      </PageHead>
      <div className="card-grid">
        {pages.map((p) => (
          <section className="panel page-card" key={p.id}>
            <div className="page-preview">
              <div className="preview-browser">
                <i />
                <i />
                <i />
                <span>your business · review page</span>
              </div>
              <div className="page-preview-content">
                <span className="preview-mark">
                  <Star size={20} fill="currentColor" />
                </span>
                <strong>{p.title}</strong>
                <p>{p.description}</p>
                <div className="preview-stars">☆ ☆ ☆ ☆ ☆</div>
                <span className="preview-button">Share your experience</span>
              </div>
            </div>
            <div className="page-card-content">
              <div className="card-title">
                <h3>{p.name}</h3>
                <Badge tone={p.active ? "success" : "neutral"} dot>
                  {p.active ? "Active" : "Paused"}
                </Badge>
              </div>
              <p>{data.locations.find((l) => l.id === p.locationId)?.name}</p>
              <div className="page-link">
                <LinkIcon size={14} />
                <span>/r/{p.slug}</span>
                <button
                  className="icon-button"
                  aria-label={`Copy link for ${p.name}`}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        `${location.origin}/r/${p.slug}`,
                      );
                      setToast("Page link copied");
                    } catch {
                      setToast(`${location.origin}/r/${p.slug}`);
                    }
                  }}
                >
                  <Copy size={14} />
                </button>
              </div>
              <div className="card-footer">
                <a
                  className="button"
                  href={"/r/" + p.slug}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={14} />
                  <span>Preview</span>
                </a>
                <Button
                  icon={Pencil}
                  variant="text"
                  onClick={() => open("page", p)}
                >
                  Edit page
                </Button>
                <button
                  className="icon-button"
                  aria-label={`Delete ${p.name}`}
                  onClick={() => open("delete", { kind: "pages", ...p })}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </section>
        ))}
        <button className="add-card" onClick={() => open("page")}>
          <span>
            <Plus size={25} />
          </span>
          <strong>A new place to connect</strong>
          <p>Create a review page for another location or service.</p>
        </button>
      </div>
      <div className="privacy-note">
        <ShieldCheck size={16} /> All ratings receive the same experience.
        Feedback is never gated by score, and public display requires explicit
        consent.
      </div>
    </>
  );
}
function Widgets({ data, query, open, setToast }) {
  return (
    <>
      <PageHead
        title="Let your customers do the talking."
        description="Bring first-party reviews to your website with a simple embed."
      >
        <Button variant="primary" icon={Plus} onClick={() => open("widget")}>
          Create a widget
        </Button>
      </PageHead>
      <div className="provider-note">
        <ShieldCheck size={18} />
        <p>
          Only first-party reviews with explicit public-display consent appear
          in widgets. External source reviews are kept private until
          redistribution rights are verified.
        </p>
      </div>
      <div className="card-grid">
        {data.widgets
          .filter((w) => w.name.toLowerCase().includes(query.toLowerCase()))
          .map((w) => (
            <section className="panel widget-card" key={w.id}>
              <div className="widget-preview">
                <div className={"widget-drawing " + w.type}>
                  {[0, 1, 2].map((i) => (
                    <div key={i}>
                      <span>★★★★★</span>
                      <i />
                      <i />
                      <small />
                    </div>
                  ))}
                </div>
              </div>
              <div className="page-card-content">
                <div className="card-title">
                  <h3>{w.name}</h3>
                  <Badge>{w.type}</Badge>
                </div>
                <p>
                  {w.minRating}+ stars · Up to {w.limit} reviews
                </p>
                <div className="card-footer">
                  <Button icon={Code} onClick={() => open("embed", w)}>
                    Get embed code
                  </Button>
                  <Button
                    variant="text"
                    icon={Pencil}
                    onClick={() => open("widget", w)}
                  >
                    Edit
                  </Button>
                  <button
                    className="icon-button"
                    aria-label={`Delete ${w.name}`}
                    onClick={() => open("delete", { kind: "widgets", ...w })}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </section>
          ))}
        <button className="add-card" onClick={() => open("widget")}>
          <span>
            <LayoutGrid size={25} />
          </span>
          <strong>Put your reputation on display</strong>
          <p>
            Choose a carousel, grid, badge, review wall, list, or popup layout.
          </p>
        </button>
      </div>
    </>
  );
}

export { Pages, Widgets };
