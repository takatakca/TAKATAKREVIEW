import {
  Plus,
  Send,
  Download,
  ExternalLink,
  CheckCheck,
  RefreshCw,
  Link as LinkIcon,
  Copy,
  Mail,
  Clock,
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
  download,
  Kpi,
} from "../components/ui.jsx";

function Requests({ data, query, open, locationId, setToast, act, busy }) {
  const rows = data.requests.filter((r) =>
    r.customerName.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title="A simple ask. An honest voice."
        description="Invite customers to share their experience on your own review page."
      >
        <Button
          icon={Download}
          onClick={() => download("requests", locationId)}
        >
          Export
        </Button>
        <Button variant="primary" icon={Send} onClick={() => open("request")}>
          Create a request
        </Button>
      </PageHead>
      <div className="three-stats">
        <Kpi
          label="Invitations created"
          value={data.requests.length}
          icon={Send}
          color="blue"
          note="Personal links & email invitations"
        />
        <Kpi
          label="Feedback received"
          value={data.requests.filter((r) => r.status === "completed").length}
          icon={CheckCheck}
          color="green"
          note="Completed feedback invitations"
        />
        <Kpi
          label="Awaiting feedback"
          value={data.requests.filter((r) => r.status !== "completed").length}
          icon={Clock}
          color="violet"
          note="A little patience goes a long way"
        />
      </div>
      <div className="provider-note">
        <Info size={18} />
        <p>
          {data.capabilities.email
            ? "Email delivery is enabled. Provider acceptance is recorded separately from customer completion."
            : "Email delivery is not connected. You can create and copy personal review links; email invitations stay queued until delivery is configured."}
        </p>
      </div>
      <section className="panel table-panel">
        <div className="panel-head">
          <h2>Your invitations</h2>
          <Button
            variant="text"
            icon={RefreshCw}
            busy={busy}
            onClick={() =>
              act(
                () => api("/outbox/retry", { method: "POST" }),
                (r) =>
                  r.blocked ||
                  `Provider accepted ${r.processed} emails; ${r.failed} need retry.`,
              )
            }
          >
            Process email queue
          </Button>
        </div>
        {rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Review link</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="table-person">
                        <Avatar name={r.customerName} />
                        <strong>{r.customerName}</strong>
                      </div>
                    </td>
                    <td>
                      <span className="inline-icon">
                        {r.channel === "email" ? (
                          <Mail size={15} />
                        ) : (
                          <LinkIcon size={15} />
                        )}{" "}
                        {r.channel === "email" ? "Email" : "Personal link"}
                      </span>
                    </td>
                    <td>
                      <Badge
                        tone={
                          r.status === "completed"
                            ? "success"
                            : r.status === "queued"
                              ? "warning"
                              : "neutral"
                        }
                        dot
                      >
                        {r.status.replaceAll("_", " ")}
                      </Badge>
                    </td>
                    <td>{relative(r.createdAt)}</td>
                    <td>
                      <Button
                        variant="text"
                        icon={Copy}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              location.origin + r.path,
                            );
                            setToast("Review link copied");
                          } catch {
                            setToast(location.origin + r.path);
                          }
                        }}
                      >
                        Copy link
                      </Button>
                      <a
                        className="icon-button"
                        href={r.path}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open request for ${r.customerName}`}
                      >
                        <ExternalLink size={14} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={Send}
            title="Your first invitation awaits"
            text="Choose a customer and create a personal link to your review page."
            action={
              <Button onClick={() => open("request")} icon={Plus}>
                Create an invitation
              </Button>
            }
          />
        )}
      </section>
    </>
  );
}

export { Requests };
