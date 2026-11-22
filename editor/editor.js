// Live editor for d2-js: D2 text -> parse -> compile -> layout (dagre / ELK / TALA) -> SVG, all in the browser.
// The library modules are imported directly from ../src (no build step); markdown-it is the global from vendor/markdown-it.min.js.
import { init, compile } from '../src/d2lib.js';
import { renderAsync } from '../src/d2svg.js';

const EXAMPLES = {
  'Hello': 'browser -> server: request\nserver -> github: api call\ngithub: {\n  label: GitHub API\n}\n',
  'Containers': 'cloud: AWS {\n  lb: Load balancer\n  app: {\n    api; worker; cache\n    api -> worker: queue\n    api -> cache\n  }\n  db: {shape: cylinder}\n  lb -> app.api\n  app.worker -> db\n}\nuser -> cloud.lb: HTTPS\nuser -> cdn: static\ncdn -> cloud.lb\n',
  'Microservices': 'direction: right\nclient -> gateway\ngateway -> auth\ngateway -> orders\ngateway -> search\norders -> db: write\norders -> queue: events\nqueue -> worker\nworker -> db\nsearch -> index\nauth -> db: sessions\n',
  'Sequence diagram': 'shape: sequence_diagram\nalice: Alice\nbob: Bob\nalice -> bob: hello\nbob -> alice: hi back\nalice -> bob: "what is up?"\nbob."thinking" -> alice: nothing much\n',
  'SQL tables': 'users: {\n  shape: sql_table\n  id: int {constraint: primary_key}\n  name: string\n  team_id: int {constraint: foreign_key}\n}\nteams: {\n  shape: sql_table\n  id: int {constraint: primary_key}\n  title: string\n}\nusers.team_id -> teams.id\n',
  'Classes and shapes': 'Parser: {\n  shape: class\n  -path: string\n  +parse(text string): Map\n}\nstart: {shape: circle}\ncheck: {shape: diamond}\ndocs: {shape: document}\nq: {shape: queue}\nstart -> check -> docs\ncheck -> q: no\n',
  'Grid': 'grid-rows: 2\ngrid-columns: 3\ngrid-gap: 10\na; b; c; d; e; f\na.style.fill: "#ddf4ff"\ne.style.fill: "#fff8c5"\n',
  'Markdown': 'explain: |md\n  # D2 in JS\n  - **parse**, compile, layout, render\n  - 日本語 and Русский work too\n|\ntitle: Port status {near: top-center; shape: text; style.font-size: 28}\nexplain -> next: then\n',
  'Code': 'f: |python\n  def fib(n: int) -> int:\n      """Return the n-th Fibonacci number."""\n      a, b = 0, 1\n      for _ in range(n):\n          a, b = b, a + b\n      return a  # fast\n|\nf -> g\ng: |go\n  func main() { fmt.Println("hi") }\n|\n',
  'LaTeX': 'euler: |latex\n  e^{i\\pi} + 1 = 0\n|\ngauss: |latex\n  \\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}\n|\neuler -> gauss: famous\n',
  'Layers': 'x -> y\nlayers: {\n  detail: {\n    x: {a -> b}\n  }\n}\n',
};

const THEMES = [[0, 'Neutral default'], [1, 'Neutral grey'], [3, 'Flagship Terrastruct'], [4, 'Cool classics'], [5, 'Mixed berry blue'], [6, 'Grape soda'], [7, 'Aubergine'], [8, 'Colorblind clear'], [100, 'Vanilla nitro cola'], [101, 'Orange creamsicle'], [102, 'Shirley temple'], [103, 'Earth tones'], [104, 'Everglade green'], [105, 'Buttered toast'], [200, 'Dark mauve'], [201, 'Dark flagship'], [300, 'Terminal'], [301, 'Terminal grayscale'], [302, 'Origami']];

const $ = (id) => document.getElementById(id);
const el = { src: $('src'), example: $('example'), layout: $('layout'), theme: $('theme'), sketch: $('sketch'), pad: $('pad'), img: $('img'), err: $('err'), status: $('status'), download: $('download'), share: $('share') };

for (const name of Object.keys(EXAMPLES)) el.example.add(new Option(name, name));
for (const [id, name] of THEMES) el.theme.add(new Option(name, String(id)));

// ---- state in the URL hash (shareable) ----
const b64 = {
  enc: (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))),
};
function stateToHash() {
  return '#' + b64.enc(JSON.stringify({ s: el.src.value, l: el.layout.value, t: el.theme.value, k: el.sketch.checked, p: el.pad.value }));
}
function loadHash() {
  if (location.hash.length < 2) return false;
  try {
    const o = JSON.parse(b64.dec(location.hash.slice(1)));
    el.src.value = o.s ?? ''; el.layout.value = o.l ?? 'dagre'; el.theme.value = o.t ?? '0'; el.sketch.checked = !!o.k; el.pad.value = o.p ?? '100';
    return true;
  } catch { return false; }
}

// ---- rendering ----
let runId = 0, blobUrl = null, lastSvg = '', timer = null, ready = null;
const fmtBytes = (n) => (n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB');

async function render() {
  const id = ++runId;
  el.status.textContent = 'rendering…';
  try {
    if (!ready) ready = init({ markdownit: window.markdownit });
    await ready;
    const layout = el.layout.value;
    const ro = { themeID: Number(el.theme.value), sketch: el.sketch.checked, pad: Number(el.pad.value) };
    const t0 = performance.now();
    const { diagram, err } = await compile(el.src.value, { utf16: true, inputPath: 'index.d2', layout }, ro);
    if (id !== runId) return;
    if (err) return showError(err.message);
    const t1 = performance.now();
    const svg = await renderAsync(diagram, { fonts: 'embed', ...ro });
    if (id !== runId) return;
    const t2 = performance.now();
    // an <img> keeps the diagram sandboxed: no scripts, no links, no network from diagram content
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    el.img.src = url; el.img.hidden = false;
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = url; lastSvg = svg;
    el.err.hidden = true; el.download.disabled = false;
    el.status.textContent = `${layout} · compile + layout ${Math.round(t1 - t0)} ms · render ${Math.round(t2 - t1)} ms · SVG ${fmtBytes(svg.length)}`;
  } catch (e) {
    if (id === runId) showError(String(e && e.message || e));
  }
}
function showError(msg) {
  el.err.textContent = msg; el.err.hidden = false;
  el.status.textContent = 'error';
}
function schedule(delay = 450) { clearTimeout(timer); timer = setTimeout(render, delay); }

el.src.addEventListener('input', () => schedule());
for (const c of [el.layout, el.theme, el.sketch, el.pad]) c.addEventListener('change', () => schedule(50));
el.example.addEventListener('change', () => { el.src.value = EXAMPLES[el.example.value]; history.replaceState(null, '', location.pathname); schedule(0); });
el.src.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') { e.preventDefault(); const s = el.src, a = s.selectionStart; s.setRangeText('  ', a, s.selectionEnd, 'end'); schedule(); }
});
el.download.addEventListener('click', () => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lastSvg], { type: 'image/svg+xml' })); a.download = 'diagram.svg'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
el.share.addEventListener('click', async () => {
  history.replaceState(null, '', stateToHash());
  try { await navigator.clipboard.writeText(location.href); el.share.textContent = 'Copied!'; } catch { el.share.textContent = 'Link in address bar'; }
  setTimeout(() => (el.share.textContent = 'Copy link'), 1500);
});

if (!loadHash()) { el.example.value = 'Hello'; el.src.value = EXAMPLES.Hello; }
render();
