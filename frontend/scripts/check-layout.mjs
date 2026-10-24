import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:8000";
const VIEWPORTS = [{ width: 1400, height: 900 }, { width: 390, height: 844 }];

async function screens() {
  const runs = await (await fetch(`${BASE}/api/runs`)).json();
  const run = `${runs[0].project}.${runs[0].name}`;
  const table = await (await fetch(`${BASE}/api/runs/${runs[0].project}/${runs[0].name}`)).json();
  const child = table.cells.flat().find((cell) => cell.ref)?.ref;
  return ["/", `/${runs[0].project}`, `/${run}`, `/${run}?modal=${child}`, "/?settings=1", "/design-system"];
}

function violations() {
  const SPACE = [0, 4, 8, 16, 24, 32, 48, 64];
  const TEXT = ["--text-page", "--text-section", "--text-tile", "--text-body", "--text-meta"]
    .map((token) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(token)));
  const RADIUS = ["0px", "2px", "6px", "50%"];
  const CONTROL = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--control"));
  const SPACING = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "marginTop", "marginRight", "marginBottom", "marginLeft", "rowGap", "columnGap"];
  const found = [];
  const name = (element) => `${element.tagName.toLowerCase()}.${[...element.classList].join(".")}`;
  const outside = (element) => element.closest("svg, .js-plotly-plot, .lab, .catalog-chart, .catalog-space") !== null;
  const visible = (element) => element.getClientRects().length > 0;
  for (const element of document.querySelectorAll("#root *, .menu, .menu *, .notices *")) {
    if (outside(element) || !visible(element)) continue;
    const style = getComputedStyle(element);
    for (const property of SPACING) {
      const value = style[property];
      if (property.startsWith("margin") && element.matches(".push")) continue;
      if (value.endsWith("px") && !SPACE.includes(Math.abs(parseFloat(value)))) found.push(`${name(element)} ${property} ${value}`);
    }
    if (element.childNodes.length && [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())
      && !TEXT.includes(parseFloat(style.fontSize))) found.push(`${name(element)} font-size ${style.fontSize}`);
    if (!RADIUS.includes(style.borderTopLeftRadius)) found.push(`${name(element)} radius ${style.borderTopLeftRadius}`);
    const control = element.matches("button, select, input:not([type=range]):not([type=checkbox]):not(.cell-input)")
      && !element.closest("table");
    if (control && Math.round(element.getBoundingClientRect().height) !== CONTROL) found.push(`${name(element)} height ${element.getBoundingClientRect().height}`);
    if (element.matches(".modal .content, .tile .content")) found.push(`${name(element)} adds a second page inset inside a surface`);
    if (element.matches(".content, .modal, .tile > .tile-body")) {
      const lefts = new Set([...element.children]
        .filter((child) => visible(child) && ["static", "relative"].includes(getComputedStyle(child).position))
        .map((child) => Math.round(child.getBoundingClientRect().left)));
      if (lefts.size > 1) found.push(`${name(element)} children start at ${[...lefts].join(", ")}`);
    }
    if (element.matches(".bar, .table-filter, .toggle, .group, .tile, .modal, .content, .stat-strip")
      && element.scrollWidth > element.clientWidth + 1) found.push(`${name(element)} overflows ${element.scrollWidth} > ${element.clientWidth}`);
  }
  const modal = document.querySelector(".modal");
  const floating = (element) => element.closest(".modal, .menu, .notices") !== null;
  if (modal) {
    const box = modal.getBoundingClientRect();
    for (const element of document.querySelectorAll("#root *")) {
      if (floating(element) || getComputedStyle(element).zIndex === "auto") continue;
      const rect = element.getBoundingClientRect();
      const left = Math.max(rect.left, box.left), right = Math.min(rect.right, box.right);
      const top = Math.max(rect.top, box.top), bottom = Math.min(rect.bottom, box.bottom);
      if (right <= left || bottom <= top) continue;
      const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
      if (hit && !floating(hit)) found.push(`${name(hit)} paints over the modal`);
    }
  }
  return [...new Set(found)];
}

const browser = await chromium.launch();
let failed = 0;
for (const path of await screens()) {
  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport });
    await page.goto(BASE + path);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    const found = await page.evaluate(violations);
    failed += found.length;
    console.log(`${found.length ? "FAIL" : "ok  "} ${viewport.width}px ${path}`);
    for (const line of found) console.log(`     ${line}`);
    await page.close();
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
