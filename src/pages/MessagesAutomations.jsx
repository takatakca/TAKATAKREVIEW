import {
  ArrowRight,
  Plus,
  MessageSquare,
  Workflow,
  Bell,
  Trash2,
  Pencil,
  Info,
} from "lucide-react";
import {
  api,
  relative,
  Provider,
  Avatar,
  Badge,
  Empty,
  Button,
  PageHead,
} from "../components/ui.jsx";

function Messages({ data, query, go }) {
  const rows = data.messages.filter((m) =>
    `${m.customerName} ${m.text}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title="Conversations with a little more care."
        description="Customer follow-up and internal conversation notes, all together."
      />
      <div className="provider-note">
        <Info size={18} />
        <p>
          Provider direct messaging requires supported API permissions and
          customer consent. Internal notes are saved locally and are never
          presented as delivered messages.
        </p>
      </div>
      <section className="panel">
        {rows.length ? (
          rows.map((m) => (
            <div className="message-row" key={m.id}>
              <Avatar name={m.customerName} />
              <div>
                <strong>{m.customerName}</strong>
                <p>{m.text}</p>
                <Badge>Internal note · {m.status}</Badge>
              </div>
              <span>{relative(m.createdAt)}</span>
            </div>
          ))
        ) : (
          <Empty
            icon={MessageSquare}
            title="A quiet inbox, for now"
            text="Conversations and follow-up notes will appear here. Open a review to see the available actions."
            action={
              <Button icon={ArrowRight} onClick={() => go("/reviews")}>
                Go to reviews
              </Button>
            }
          />
        )}
      </section>
    </>
  );
}
function Automations({ data, open, act }) {
  return (
    <>
      <PageHead
        title="Thoughtful follow-up, on autopilot."
        description="Simple notification rules help your team stay close to every customer."
      >
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => open("automation")}
        >
          Create a rule
        </Button>
      </PageHead>
      <div className="automation-intro">
        <span>
          <Workflow size={30} />
        </span>
        <div>
          <h2>A little less busywork. A lot more connection.</h2>
          <p>
            Notify your team when a review arrives, a customer needs care, or a
            reply is waiting.
          </p>
        </div>
        <Badge>Human-led. Always.</Badge>
      </div>
      <div className="automation-list">
        {data.automations.map((a) => (
          <section className="panel automation-row" key={a.id}>
            <span className="automation-icon">
              <Bell size={22} />
            </span>
            <div>
              <h3>{a.name}</h3>
              <p>
                When{" "}
                <strong>
                  {
                    {
                      new_review: "a new review arrives",
                      low_rating: "a 1–3 star review arrives",
                      unanswered: "an unanswered review arrives",
                    }[a.trigger]
                  }
                </strong>{" "}
                <ArrowRight size={13} /> Notify workspace team
              </p>
            </div>
            <button
              className={"toggle " + (a.enabled ? "on" : "")}
              role="switch"
              aria-checked={a.enabled}
              aria-label={`Enable ${a.name}`}
              onClick={() =>
                act(
                  () =>
                    api("/automations/" + a.id, {
                      method: "PUT",
                      body: { ...a, enabled: !a.enabled },
                    }),
                  "Rule updated",
                )
              }
            >
              <span />
            </button>
            <Button
              icon={Pencil}
              variant="text"
              onClick={() => open("automation", a)}
            >
              Edit
            </Button>
            <button
              className="icon-button"
              aria-label={`Delete ${a.name}`}
              onClick={() => open("delete", { kind: "automations", ...a })}
            >
              <Trash2 size={16} />
            </button>
          </section>
        ))}
      </div>
      {!data.automations.length && (
        <section className="panel">
          <Empty
            icon={Workflow}
            title="Let the little things take care of themselves"
            text="Set up your first rule. Email rules use the verified workspace alert address and the delivery queue."
            action={
              <Button icon={Plus} onClick={() => open("automation")}>
                Create your first rule
              </Button>
            }
          />
        </section>
      )}
    </>
  );
}

export { Messages, Automations };
