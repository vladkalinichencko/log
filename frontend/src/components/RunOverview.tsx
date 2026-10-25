import { Link } from "react-router-dom";
import { Representation } from "../types/domain";
import { duration, execution_strip_selector, run_stats_selector } from "../store/selectors/runSelectors";
import { useTable } from "./useTable";
import { Chart } from "../modules/chart";
import { LoadError } from "./LoadError";
import { Sparkline } from "./Sparkline";
import { Placeholder } from "./Placeholder";

const EXECUTION_COLUMNS = 120;
const BLANK = "\u00a0";
const BLANK_STATS = [{ label: BLANK, value: BLANK, trend: [] }];
const blank_strip = (ranks: number) => ({
  lanes: Array.from({ length: ranks }, () => ({ rank: "", cells: [] })),
  median: 0,
  slowest: { steps: "", seconds: 0 },
});

export function RunOverview({ path }: { path: string }) {
  const metrics = useTable(`${path}.metrics`);
  const meta = useTable(`${path}.meta`);
  const failed = [metrics, meta].find((load) => load.loadState === "error");
  if (failed) return <LoadError message={failed.error} retry={failed.retry} />;
  const stats = metrics.table && meta.table ? run_stats_selector(meta.table, metrics.table) : BLANK_STATS;
  const ranks = Number(meta.table?.cells.find(([key]) => key.value === "world_size")?.[1].value) || 1;
  const timing = metrics.table && execution_strip_selector(metrics.table, EXECUTION_COLUMNS);
  const strip = timing || blank_strip(ranks);

  return (
    <section className="run-overview">
      <div className="bar">
        <Link className="tile-name link" to={`/${path}.metrics`}>metrics</Link>
      </div>
      <div className="run-hero">
        {metrics.table ? <Chart table={metrics.table} representation={Representation.Line} overview /> : <Placeholder label="loading" />}
      </div>
      <div className="stat-strip">
        {stats.map((stat) => (
          <article key={stat.label} className="stat">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <Sparkline values={stat.trend} />
          </article>
        ))}
      </div>
      {strip && (
        <div className="execution-strip">
          <span className="subtitle">
            {timing
              ? `time between logged steps · median ${duration(timing.median)} · slowest ${duration(timing.slowest.seconds)} at step ${timing.slowest.steps}`
              : metrics.table ? "fewer than two logged steps per rank" : BLANK}
          </span>
          {strip.lanes.map((lane, index) => (
            <div key={index} className="execution-lane">
              <span className="subtitle">{lane.rank ? `rank ${lane.rank}` : BLANK}</span>
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
