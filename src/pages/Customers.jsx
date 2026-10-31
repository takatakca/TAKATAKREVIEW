import { useState } from "react";
import {
  Plus,
  Users,
  Send,
  Download,
  Upload,
  ShieldCheck,
  Trash2,
  Pencil,
} from "lucide-react";
import {
  relative,
  Avatar,
  Badge,
  Empty,
  Button,
  PageHead,
  download,
} from "../components/ui.jsx";

function Customers({ data, query, open, act, busy, locationId }) {
  const [selected, setSelected] = useState([]);
  const rows = data.customers.filter((c) =>
    `${c.name} ${c.email} ${c.tags.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title="People behind the stars."
        description="Good relationships start with knowing your customers."
      >
        <Button
          icon={Download}
          onClick={() => download("customers", locationId)}
        >
          Export
        </Button>
        <Button icon={Upload} onClick={() => open("import")}>
          Import CSV
        </Button>
        <Button variant="primary" icon={Plus} onClick={() => open("customer")}>
          Add customer
        </Button>
      </PageHead>
      <div className="section-toolbar">
        <h2>
          Customers <Badge>{rows.length}</Badge>
        </h2>
        {selected.length > 0 && (
          <Button
            icon={Send}
            onClick={() => open("request", { customerIds: selected })}
          >
            Request feedback ({selected.length})
          </Button>
        )}
      </div>
      <section className="panel table-panel">
        {rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Select all customers"
                      checked={
                        rows.length > 0 &&
                        rows.every((r) => selected.includes(r.id))
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? rows.map((r) => r.id) : [],
                        )
                      }
                    />
                  </th>
                  <th>Customer</th>
                  <th>Contact details</th>
                  <th>Tags</th>
                  <th>Contact permission</th>
                  <th>Added</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${c.name}`}
                        checked={selected.includes(c.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, c.id]
                              : selected.filter((x) => x !== c.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      <div className="table-person">
                        <Avatar name={c.name} />
                        <div>
                          <strong>{c.name}</strong>
                          {c.sample && <small>Sample customer</small>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span>{c.email || "—"}</span>
                      {c.phone && <small>{c.phone}</small>}
                    </td>
                    <td>
                      <div className="tag-list">
                        {c.tags.map((t) => (
                          <Badge key={t}>{t}</Badge>
                        ))}
                      </div>
                    </td>
                    <td>
                      <Badge tone={c.consent ? "success" : "neutral"} dot>
                        {c.consent ? "Opted in" : "Not provided"}
                      </Badge>
                    </td>
                    <td>{relative(c.createdAt)}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="icon-button"
                          aria-label={`Edit ${c.name}`}
                          onClick={() => open("customer", c)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Delete ${c.name}`}
                          onClick={() =>
                            open("delete", { kind: "customers", ...c })
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={Users}
            title="Every relationship starts somewhere"
            text="Add your first customer or import a CSV to start collecting honest feedback."
            action={
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => open("customer")}
              >
                Add your first customer
              </Button>
            }
          />
        )}
      </section>
      <div className="privacy-note">
        <ShieldCheck size={16} />
        <span>
          Contact customers only with their permission. Consent is required for
          email invitations.
        </span>
      </div>
    </>
  );
}

export { Customers };
