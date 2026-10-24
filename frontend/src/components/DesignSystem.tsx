import { ReactNode } from "react";
import { Cell, CellType, Representation, SavedView, Table, TableKind } from "../types/domain";
import { useStore } from "../store/store";
import { SERIES } from "../store/slices/settingsSlice";
import { Button } from "./Button";
import { ChartView } from "./ChartView";
import { DesignSystemLab } from "./DesignSystemLab";
import { Icon, ICON_NAMES } from "./Icon";
import { LoadError } from "./LoadError";
import { Menu } from "./Menu";
import { Notices, attempt } from "./Notices";
import { MenuButton } from "./MenuButton";
import { Settings, useTheme } from "./Settings";
import { TableView } from "./TableView";
import { Tile } from "./Tile";
import { TileFrame } from "./TileFrame";

const TOKENS = {
  color: ["--gray-0", "--gray-50", "--gray-100", "--gray-200", "--gray-400", "--gray-600", "--gray-900", "--accent", "--positive", "--warning", "--critical", ...SERIES],
  space: ["--space-0-5", "--space", "--space-2", "--space-3", "--space-4"],
  text: ["--text-page", "--text-section", "--text-tile", "--text-body", "--text-meta"],
  size: ["--radius", "--radius-float", "--control", "--icon", "--handle", "--hit", "--menu-width", "--menu-column", "--menu-height"],
};

const BUTTON_STATES = ["idle", "hover", "pressed", "pending", "error"];

const number = (value: number): Cell => ({ type: CellType.Number, value: String(value), ref: null });
const text = (value: string): Cell => ({ type: CellType.String, value, ref: null });
const link = (value: string, ref: string): Cell => ({ type: CellType.TableRef, value, ref });

const table = (name: string, kind: TableKind, column_names: string[] | null, cells: Cell[][], source_path: string): Table => ({
  name,
  kind,
  column_names,
  row_names: null,
  cells,
  representation: Representation.Grid,
  source_path,
});

const runs = table("catalog", TableKind.Folder, ["run", "status", "samples_seen"], [
  [link("baseline", "catalog.baseline"), text("finished"), number(51200)],
  [link("high_lr", "catalog.high_lr"), text("crashed"), number(12800)],
  [link("warmup", "catalog.warmup"), text("running"), number(30720)],
], "catalog");

const loss = table("loss", TableKind.Column, ["step", "loss", "accuracy"],
  Array.from({ length: 60 }, (_, step) => [number(step), number(+(2.4 * Math.exp(-step / 18) + 0.05 * Math.sin(step)).toFixed(3)), number(+(1 - Math.exp(-step / 25)).toFixed(3))]),
  "catalog.loss");

const weights = table("weights", TableKind.Grid, null,
  Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => number(+Math.sin(r * c / 6).toFixed(3)))),
  "catalog.weights");

const config = table("config", TableKind.Column, ["key", "value"], [
  [text("lr"), text("0.0003")],
  [text("batch_size"), text("64")],
  [text("optimizer"), text("adamw")],
], "catalog.config");

const CHARTS: [Table, Representation][] = [
  [loss, Representation.Line],
  [loss, Representation.Histogram],
  [weights, Representation.Heatmap],
];

const views: SavedView[] =[loss, weights, config].map((fixture) => ({ ...fixture, id: fixture.source_path! }));
useStore.getState().tables_setViews(views);

const computed = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function Section({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <section className="catalog-section">
      <div className="section-heading">
        <span className="subtitle">{number}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function DesignSystem() {
  useTheme();

  return (
    <main className="content catalog">
      <h1>Design system</h1>
      <p className="subtitle">
        Every block below is the production component or the production CSS class. Edit styles/tokens.css or a component and this page and the app change together.
      </p>
      <Settings />

      <Section number="01" title="Tokens">
        <div className="catalog-row">
          {TOKENS.color.map((name) => (
            <figure key={name} className="catalog-swatch">
              <span style={{ background: `var(${name})` }} />
              <figcaption className="subtitle">{name}</figcaption>
            </figure>
          ))}
        </div>
        <div className="catalog-row">
          {TOKENS.space.map((name) => (
            <figure key={name} className="catalog-space">
              <span style={{ width: `var(${name})` }} />
              <figcaption className="subtitle">{name} {computed(name)}</figcaption>
            </figure>
          ))}
        </div>
        {TOKENS.text.map((name) => (
          <p key={name} style={{ fontSize: `var(${name})`, margin: 0 }}>
            {name} <span className="subtitle">{computed(name)}</span>
          </p>
        ))}
        <div className="catalog-row">
          {TOKENS.size.map((name) => (
            <span key={name} className="subtitle">{name} {computed(name)}</span>
          ))}
          <span className="catalog-shadow subtitle">--shadow</span>
        </div>
      </Section>

      <Section number="02" title="Icons">
        <div className="catalog-row">
          {ICON_NAMES.map((name) => (
            <figure key={name} className="catalog-icon">
              <Icon name={name} />
              <figcaption className="subtitle">{name}</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section number="03" title="Buttons — every button_fsm state">
        {[["default", ""], ["ghost", "ghost"], ["active", "active"]].map(([label, className]) => (
          <div key={label} className="catalog-row">
            <span className="catalog-label subtitle">{label}</span>
            {BUTTON_STATES.map((state) => (
              <button key={state} className={className} data-state={state}>{state}</button>
            ))}
            <button className={className} disabled>disabled</button>
            <button className={`${className} ghost`} data-state="idle"><Icon name="expand" /></button>
          </div>
        ))}
        <div className="catalog-row">
          <span className="catalog-label subtitle">live</span>
          <Button label="instant" onClick={() => {}} />
          <Button label="succeeds in 1s" onClick={() => new Promise((done) => setTimeout(done, 1000))} />
          <Button label="fails in 1s" onClick={() => new Promise((_, fail) => setTimeout(fail, 1000))} />
          <div className="toggle">
            <Button icon="table" title="table" active onClick={() => {}} />
            <Button icon="chart" title="visualization" onClick={() => {}} />
          </div>
        </div>
      </Section>

      <Section number="04" title="Menus">
        <div className="catalog-row">
          <MenuButton label="list menu ▾" title="list menu">
            {(close) => <Menu items={["csv", "json", "png"].map((label) => ({ label, onPick: close }))} />}
          </MenuButton>
          <MenuButton icon="save" ghost title="sectioned menu">
            {(close) => (
              <Menu
                sections={[
                  { title: "export as", items: ["csv", "json", "png"].map((label) => ({ label, onPick: close })) },
                  { title: "line color", items: SERIES.map((token) => ({ label: token.slice(2), swatch: `var(${token})`, onPick: close })) },
                ]}
              />
            )}
          </MenuButton>
          <MenuButton icon="trash" ghost title="confirm panel">
            {() => <Menu><Button label="confirm" onClick={() => {}} /></Menu>}
          </MenuButton>
        </div>
      </Section>

      <Section number="05" title="Failures">
        <LoadError message="Run demo.gone not found" retry={() => {}} />
        <div className="catalog-row">
          <Button label="fail an action" onClick={() => Promise.reject(new Error("disk full"))} />
          <Button label="fail a background job" onClick={() => attempt("saving demo.baseline.config", () => Promise.reject(new Error("permission denied")))} />
        </div>
        <Notices />
      </Section>

      <Section number="06" title="Inputs">
        <div className="catalog-row">
          <input placeholder="Filter rows…" />
          <input className="picking" defaultValue="derive(mean_«col» = mean(«col»))" />
          <span className="error">no column 'los'</span>
        </div>
      </Section>

      <Section number="07" title="Tables">
        <TableView table={runs} />
        <TableView table={config} editable />
      </Section>

      <Section number="08" title="Tiles">
        <div className="tile-grid">
          {views.map((view) => (
            <TileFrame key={view.id} path={view.id}>
              <Tile path={view.id} titled />
            </TileFrame>
          ))}
        </div>
      </Section>

      <Section number="09" title="Charts">
        <div className="tile-grid">
          {CHARTS.map(([fixture, representation]) => (
            <div key={representation} className="tile catalog-chart">
              <span className="tile-name">{representation}</span>
              <ChartView table={fixture} representation={representation} />
            </div>
          ))}
        </div>
      </Section>

      <Section number="10" title="Proposals (not yet in the product)">
        <DesignSystemLab />
      </Section>
    </main>
  );
}
