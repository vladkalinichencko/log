import { Representation } from "../types/domain";
import { run_stats_selector } from "../store/selectors/runSelectors";
import { useTable } from "./useTable";
import { render } from "./render";
import { LoadError } from "./LoadError";
import { Sparkline } from "./Sparkline";

export function RunOverview({ path }: { path: string }) {
  const metrics = useTable(`${path}.metrics`);
  const meta = useTable(`${path}.meta`);
  const failed = [metrics, meta].find((load) => load.loadState === "error");
  if (failed) return <LoadError message={failed.error} retry={failed.retry} />;

  return (
    <section className="run-overview">
      <div className="run-hero">{metrics.table ? render(metrics.table, Representation.Line) : "Loading…"}</div>
      {metrics.table && meta.table && (
        <div className="stat-strip">
          {run_stats_selector(meta.table, metrics.table).map((stat) => (
            <article key={stat.label} className="stat">
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <Sparkline values={stat.trend} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
