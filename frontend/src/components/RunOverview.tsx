import { Representation } from "../types/domain";
import { duration, execution_strip_selector, run_stats_selector } from "../store/selectors/runSelectors";
import { useTable } from "./useTable";
import { ChartView } from "./ChartView";
import { LoadError } from "./LoadError";
import { Sparkline } from "./Sparkline";

const EXECUTION_COLUMNS = 120;

export function RunOverview({ path }: { path: string }) {
  const metrics = useTable(`${path}.metrics`);
  const meta = useTable(`${path}.meta`);
  const failed = [metrics, meta].find((load) => load.loadState === "error");
  if (failed) return <LoadError message={failed.error} retry={failed.retry} />;
  const strip = metrics.table && execution_strip_selector(metrics.table, EXECUTION_COLUMNS);

  return (
    <section className="run-overview">
      <div className="run-hero">
        {metrics.table ? <ChartView table={metrics.table} representation={Representation.Line} overview /> : "Loading…"}
      </div>
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
      {strip && (
        <div className="execution-strip">
          <span className="subtitle">
            time between logged steps · median {duration(strip.median)} · slowest {duration(strip.slowest.seconds)} at step {strip.slowest.steps}
          </span>
          {strip.lanes.map((lane) => (
            <div key={lane.rank} className="execution-lane">
              <span className="subtitle">rank {lane.rank}</span>
              <div>
                {lane.cells.map((cell) => (
                  <i
                    key={cell.steps}
                    title={`steps ${cell.steps}: ${duration(cell.seconds)}`}
                    style={{ background: `color-mix(in srgb, var(--accent) ${Math.round((cell.seconds / strip.slowest.seconds) * 100)}%, var(--gray-100))` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
