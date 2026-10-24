import { CSSProperties, useState } from "react";
import { Button } from "./Button";

const stats = [
  ["loss", "0.218", "−0.034", "bad"],
  ["top-1 acc", "73.4%", "+1.2%", "good"],
  ["gpu util", "94%", "A100 × 2", "good"],
  ["epoch", "47/200", "~6h left", "neutral"],
] as const;

const operations = [
  ["forward", 22, "var(--series-4)"],
  ["attention", 14, "var(--series-1)"],
  ["backward", 31, "var(--series-6)"],
  ["all-reduce", 12, "var(--warning)"],
  ["optimizer", 21, "var(--series-5)"],
] as const;

const rows = [
  ["residual.add", "enc.0–11", "18.4ms", 82, "17%"],
  ["linear.forward", "enc.0–11", "14.1ms", 66, "13%"],
  ["linear.backward", "enc.0–11", "24.3ms", 100, "22%"],
  ["all_reduce", "grad sync", "8.7ms", 44, "8%"],
] as const;

function MiniLine({ tone = "accent" }: { tone?: "accent" | "blue" | "green" }) {
  return (
    <svg className={`lab-spark lab-spark--${tone}`} viewBox="0 0 120 28" aria-hidden="true">
      <path d="M1 21 C16 7 25 22 39 12 S63 17 77 8 S101 17 119 3" />
    </svg>
  );
}

export function DesignSystemLab() {
  const [density, setDensity] = useState<"compact" | "comfortable">("compact");
  const [focus, setFocus] = useState(78);

  return (
    <main className="lab" data-density={density}>
      <header className="lab-topbar">
        <div>
          <p className="subtitle">LOG / DESIGN SYSTEM 0.1</p>
          <h1>Training Run</h1>
        </div>
        <div className="toggle" aria-label="Table density">
          <Button label="compact" active={density === "compact"} onClick={() => setDensity("compact")} />
          <Button label="comfortable" active={density === "comfortable"} onClick={() => setDensity("comfortable")} />
        </div>
      </header>

      <section className="lab-section lab-hero">
        <div className="lab-section-heading">
          <div><span>01</span><h2>Run timeline</h2></div>
          <p>Time is the primary axis. Current values live at the line ends; the overview remains visible.</p>
        </div>
        <div className="timeline-panel" style={{ "--focus": `${focus}%` } as CSSProperties}>
          <div className="timeline-legend"><span><i className="red" />train loss</span><span><i className="green" />eval loss</span><b>step 78,320</b></div>
          <svg className="hero-chart" viewBox="0 0 1000 320" preserveAspectRatio="none" role="img" aria-label="Training loss over eight epochs">
            <defs><linearGradient id="loss-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".28"/><stop offset="1" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs>
            <g className="chart-grid">{[50,100,150,200,250,300].map(y => <line key={y} x1="0" y1={y} x2="1000" y2={y}/>)}{[125,250,375,500,625,750,875].map(x => <line key={x} x1={x} y1="0" x2={x} y2="320"/>)}</g>
            <path className="hero-area" d="M0 25 C90 170 150 190 230 220 S330 245 400 210 S500 250 600 260 S720 270 800 255 S900 285 1000 278 L1000 320 L0 320 Z"/>
            <path className="hero-line" d="M0 25 C90 170 150 190 230 220 S330 245 400 210 S500 250 600 260 S720 270 800 255 S900 285 1000 278"/>
            <path className="eval-line" d="M0 62 C120 150 180 175 260 195 S390 218 470 202 S600 230 690 238 S820 240 1000 250"/>
            <circle className="focus-dot" cx={`${focus * 10}`} cy="266" r="6"/>
          </svg>
          <div className="end-values"><strong>0.218</strong><small>train</small><strong>0.244</strong><small>eval</small></div>
          <div className="epoch-axis">{Array.from({ length: 8 }, (_, i) => <span key={i}>epoch {i + 1}</span>)}</div>
          <input className="timeline-range" type="range" min="5" max="98" value={focus} onChange={(event) => setFocus(Number(event.target.value))} aria-label="Timeline focus" />
        </div>
      </section>

      <section className="lab-section">
        <div className="lab-section-heading"><div><span>02</span><h2>Status and comparison</h2></div><p>Labels stay quiet; numbers carry hierarchy; change always has direction and meaning.</p></div>
        <div className="stat-strip">{stats.map(([label, value, delta, tone]) => <article className="stat" key={label}><span>{label}</span><strong>{value}</strong><small className={tone}>{delta}</small><MiniLine tone={tone === "good" ? "green" : tone === "bad" ? "accent" : "blue"}/></article>)}</div>
      </section>

      <section className="lab-section lab-split">
        <div>
          <div className="lab-section-heading"><div><span>03</span><h2>Dense table</h2></div></div>
          <div className="lab-table-wrap"><table className="lab-table"><thead><tr><th>operation</th><th>scope</th><th>mean</th><th>share</th><th>% step</th></tr></thead><tbody>{rows.map(([name, scope, mean, width, share], index) => <tr key={name}><td>{name}{index === 0 && <em>suspect</em>}</td><td>{scope}</td><td className="num">{mean}</td><td><span className="microbar"><i style={{ width: `${width}%` }}/></span></td><td className="num">{share}</td></tr>)}</tbody></table></div>
        </div>
        <div>
          <div className="lab-section-heading"><div><span>04</span><h2>Execution strip</h2></div></div>
          <div className="execution"><div className="execution-track">{operations.map(([name, width, color]) => <span key={name} style={{ width: `${width}%`, background: color }}>{name}</span>)}</div><div className="execution-row"><b>GPU 0</b><span className="busy"/><span/><span className="busy wide"/><span/></div><div className="execution-row"><b>GPU 1</b><span/><span className="busy wide"/><span/><span className="busy"/></div></div>
          <div className="alert-list"><article><i className="critical"/><div><b>gradient spike</b><p>residual.add exceeded the run baseline by 2.8σ</p></div><time>12:29</time></article><article><i className="warning"/><div><b>throughput drift</b><p>samples/s fell 7% after checkpoint 46</p></div><time>12:24</time></article></div>
        </div>
      </section>

      <section className="lab-section">
        <div className="lab-section-heading"><div><span>05</span><h2>Visualization bank</h2></div><p>Each family answers a different question; 3D is reserved for genuine depth, tensors, trajectories, and fields.</p></div>
        <div className="viz-bank">
          <article><header><b>distribution</b><span>N × 1</span></header><svg viewBox="0 0 180 88"><path className="viz-fill" d="M3 82 C28 80 34 12 70 34 S100 79 177 82 L177 87 L3 87Z"/><path className="viz-line" d="M3 82 C28 80 34 12 70 34 S100 79 177 82"/></svg><p>histogram · ECDF · violin · ridgeline</p></article>
          <article><header><b>relationship</b><span>N × 2+</span></header><svg viewBox="0 0 180 88">{[[20,68],[32,51],[45,61],[59,40],[71,49],[88,26],[103,44],[118,20],[137,31],[158,13]].map(([x,y]) => <circle className="viz-point" key={x} cx={x} cy={y} r="4"/>)}</svg><p>scatter · hexbin · contour · regression</p></article>
          <article><header><b>matrix</b><span>N × M</span></header><div className="matrix">{Array.from({length: 35}, (_, i) => <i key={i} style={{ opacity: .12 + ((i * 7) % 10) / 12 }}/>)}</div><p>heatmap · correlation · confusion</p></article>
          <article><header><b>hierarchy</b><span>tree</span></header><div className="tree"><b>run</b><span>encoder</span><span>decoder</span><i>attn</i><i>mlp</i><i>head</i></div><p>icicle · treemap · dendrogram</p></article>
          <article><header><b>attribution</b><span>features</span></header><div className="waterfall"><i style={{width:"82%"}}/><i style={{width:"61%"}}/><i style={{width:"42%"}}/><i className="negative" style={{width:"28%"}}/></div><p>waterfall · SHAP · saliency · ICE</p></article>
          <article><header><b>tensor / 3D</b><span>N × M × K</span></header><div className="cube"><i/><i/><i/></div><p>slices · volume · surface · trajectory</p></article>
        </div>
      </section>
    </main>
  );
}
