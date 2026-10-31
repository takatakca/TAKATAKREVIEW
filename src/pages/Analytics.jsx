import { useState } from "react";
import {
  Star,
  MessageSquare,
  ChartNoAxesCombined,
  Download,
} from "lucide-react";
import {
  Provider,
  Button,
  PageHead,
  download,
  Kpi,
  Trend,
} from "../components/ui.jsx";

function Analytics({ data, locationId }) {
  const [period, setPeriod] = useState("all");
  const now = Date.now();
  const reviews = data.reviews.filter(
    (r) =>
      r.recommended !== false &&
      (period === "all" ||
        now - new Date(r.publishedAt).getTime() <= Number(period) * 86400000),
  );
  const n = reviews.length,
    average = n ? reviews.reduce((s, r) => s + r.rating, 0) / n : null,
    answered = reviews.filter((r) => r.reply).length;
  return (
    <>
      <PageHead
        title="See the bigger picture."
        description="Understand the experiences shaping your reputation."
      >
        <select
          className="standalone-select"
          aria-label="Analytics time period"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="all">All time</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
        <Button icon={Download} onClick={() => download("reviews", locationId)}>
          Export reviews
        </Button>
      </PageHead>
      <div className="kpi-grid">
        <Kpi
          label="Reviews received"
          value={n}
          icon={Star}
          color="blue"
          note="Recommended & first-party reviews"
        />
        <Kpi
          label="Average rating"
          value={average?.toFixed(1) || "—"}
          icon={Star}
          color="amber"
          note="Excluded reviews do not affect score"
        />
        <Kpi
          label="Responses published"
          value={answered}
          icon={MessageSquare}
          color="green"
          note="Recorded responses"
        />
        <Kpi
          label="Response rate"
          value={`${n ? Math.round((answered / n) * 100) : 0}%`}
          icon={ChartNoAxesCombined}
          color="violet"
          note="Every response makes a difference"
        />
      </div>
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Review volume</h2>
              <p>How your customer voices add up.</p>
            </div>
          </div>
          <Trend reviews={reviews} />
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Rating breakdown</h2>
              <p>Every experience is part of the picture.</p>
            </div>
          </div>
          <div className="distribution">
            {[5, 4, 3, 2, 1].map((rating) => (
              <div key={rating}>
                <span>
                  {rating}
                  <Star size={12} fill="currentColor" />
                </span>
                <div>
                  <i
                    style={{
                      width: `${n ? (reviews.filter((r) => r.rating === rating).length / n) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span>{reviews.filter((r) => r.rating === rating).length}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Performance by source</h2>
            <p>Visibility across your reputation channels.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Reviews</th>
                <th>Average rating</th>
                <th>Answered</th>
                <th>Response rate</th>
              </tr>
            </thead>
            <tbody>
              {data.integrations.map((p) => {
                const rs = reviews.filter((r) => r.provider === p.id);
                const answered = rs.filter((r) => r.reply).length;
                return (
                  <tr key={p.id}>
                    <td>
                      <Provider name={p.id} label />
                    </td>
                    <td>{rs.length}</td>
                    <td>
                      {rs.length
                        ? (
                            rs.reduce((s, r) => s + r.rating, 0) / rs.length
                          ).toFixed(1)
                        : "—"}
                    </td>
                    <td>{answered}</td>
                    <td>
                      {rs.length
                        ? Math.round((answered / rs.length) * 100) + "%"
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export { Analytics };
