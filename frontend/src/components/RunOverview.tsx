import { CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { evalTable } from "../api/client";
import { Representation } from "../types/domain";
import {
  alert_marks_selector,
  checkpoint_marks_selector,
  duration,
  epoch_marks_selector,
  execution_strip_selector,
  hero_metric_selector,
  hero_table_selector,
  metric_names,
  phase_track_selector,
  resumed_from_selector,
  run_stats_selector,
  slowness,
  splice_table_selector,
} from "../store/selectors/runSelectors";
import { path_segments, with_param } from "../store/selectors/pathSelectors";
import { Button } from "./Button";
import { useStore } from "../store/store";
import { table_selector } from "../store/selectors/tableSelectors";
import { CATEGORICAL_ORDER } from "../store/slices/settingsSlice";
import { useLoadedTable } from "./useLoadedTable";
import { useProjectSettings } from "./useProjectSettings";
import { Menu } from "./Menu";
import { MenuButton } from "./MenuButton";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const metrics = useTable(`${path}.metrics`);
  const meta = useTable(`${path}.meta`);
  const alerts = useTable(`${path}.alerts`);
  const folder = useStore((state) => table_selector(state, path));
  const listed = (name: string) => (folder?.cells.some((row) => row[0]?.ref === `${path}.${name}`) ? `${path}.${name}` : null);
  const checkpoints = useTable(listed("checkpoints"));
  const spans = useTable(listed("spans"));
  const { settings, save } = useProjectSettings(path_segments(path)[0]);
  const resumed = meta.table ? resumed_from_selector(meta.table) : null;
  const spliceExpression = resumed && searchParams.get("splice") === "1" ? `splice(${resumed.run}, ${path})` : null;
  const splice = useLoadedTable(spliceExpression, () => evalTable(spliceExpression!));
  const failed = [metrics, meta].find((load) => load.loadState === "error");
  if (failed) return <LoadError message={failed.error} retry={failed.retry} />;
  const stats = metrics.table && meta.table ? run_stats_selector(meta.table, metrics.table) : BLANK_STATS;
  const ranks = Number(meta.table?.cells.find(([key]) => key.value === "world_size")?.[1].value) || 1;
  const timing = metrics.table && execution_strip_selector(metrics.table, EXECUTION_COLUMNS);
  const strip = timing || blank_strip(ranks);
  const hero = metrics.table && hero_metric_selector(metrics.table, settings?.hero);
  const heroTable = metrics.table && hero && (spliceExpression && splice.table ? splice_table_selector(splice.table, hero, path) : hero_table_selector(metrics.table, hero));
  const phases = spans.table ? phase_track_selector(spans.table) : [];
  const marks = [
    ...(metrics.table ? epoch_marks_selector(metrics.table) : []),
    ...(checkpoints.table ? checkpoint_marks_selector(checkpoints.table) : []),
    ...(alerts.table ? alert_marks_selector(alerts.table) : []),
    ...(spliceExpression && resumed ? [{ x: resumed.step, label: `resumed from ${resumed.run}`, kind: "checkpoint" as const }] : []),
  ];

  return (
    <section className="run-overview">
      <div className="bar">
        <div className="group">
          <Link className="tile-name link" to={`/${path}.metrics`}>metrics</Link>
          {metrics.table && hero && (
            <MenuButton label={`${hero} ▾`} ghost title="Main chart metric for every run of this project">
              {(close) => (
                <Menu
                  items={metric_names(metrics.table!).map((name) => ({
                    label: name,
                    onPick: () => {
                      save({ alerts: {}, ...settings, hero: name });
                      close();
                    },
                  }))}
                />
              )}
            </MenuButton>
          )}
          {resumed && (
            <Button
              label={`resumed from ${resumed.run}`}
              ghost
              active={spliceExpression !== null}
              title={`This run continues ${resumed.run} from step ${resumed.step}; draw both as one line`}
              onClick={() => setSearchParams(with_param(searchParams, "splice", spliceExpression ? null : "1"))}
            />
          )}
        </div>
      </div>
      <div className="run-hero">
        {heroTable ? (
          <Chart table={heroTable} representation={Representation.Line} marks={marks} />
        ) : (
          <Placeholder label={metrics.table ? "no metrics logged" : "loading"} />
        )}
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
          {listed("spans") && (
            <div className="execution-track">
              {phases.length === 0 && <span>{BLANK}</span>}
              {phases.map((phase, index) => (
                <span
                  key={phase.name}
                  style={{ flexGrow: phase.share, "--phase": `var(${CATEGORICAL_ORDER[index % CATEGORICAL_ORDER.length]})` } as CSSProperties}
                  title={`${phase.name}: median ${duration(phase.seconds)} per step`}
                >
                  {phase.name} {Math.round(phase.share * 100)}%
                </span>
              ))}
            </div>
          )}
          {strip.lanes.map((lane, index) => (
            <div key={index} className="execution-lane">
              <span className="subtitle">{lane.rank ? `rank ${lane.rank}` : BLANK}</span>
              <div>
                {lane.cells.map((cell) => (
                  <i
                    key={cell.steps}
                    title={`steps ${cell.steps}: ${duration(cell.seconds)}`}
                    style={{ background: `color-mix(in srgb, var(--accent) ${Math.round(slowness(cell.seconds, strip.median, strip.slowest.seconds) * 100)}%, var(--gray-100))` }}
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
