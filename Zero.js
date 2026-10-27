// ZERO — Scriptable widget: the Brain agent's face + one line in his voice, on EVERY widget size.
//   Home Screen: small / medium / large        Lock Screen: accessoryRectangular / accessoryCircular / accessoryInline
// Zero's face changes with the state (PNG renders of the 3D model, published next to zero.html):
//   happy     agents healthy, nothing special
//   surprised a NEW hot X Radar coin showed up (first seen < 6h ago, score >= 75)
//   focused   SOL / BTC / ETH moved >= 4% in 24h (up)           worried = the same move, down
//   sleepy    data is stale (> 6h old) or the feeds can't be reached
// Public, already-published files only (no contact names, file paths, P&L, balances, positions or account data):
//   brain-widget.json  gem-x.json  (agent-home-app)      live.json  (agent-home-web; only status lines, update time, public SOL/BTC/ETH marks)
//   zero-face-<expr>.png  (agent-home-app, cached on the phone so the widget still draws offline)
// Tap opens Zero's 3D page (…/agent-home-app/zero.html).
const APP_URL = "https://elpsjerome158-arch.github.io/agent-home-app/";
const ZERO_URL = APP_URL + "zero.html";
const SUMMARY_URL = APP_URL + "brain-widget.json";
const GEM_URL = APP_URL + "gem-x.json";
const LIVE_URL = "https://elpsjerome158-arch.github.io/agent-home-web/StreamingAssets/AgentHome/live.json";
const EXPRS = ["happy", "focused", "surprised", "worried", "sleepy"];
const FACE_URL = (e) => APP_URL + "zero-face-" + e + ".png";
const CACHE_NAME = "zero-widget-cache.json";
const STALE_AFTER_S = 6 * 3600;         // data older than this => sleepy
const HOT_NEW_S = 6 * 3600, HOT_SCORE = 75;
const MOVE_PCT = 4;                      // SOL / BTC / ETH 24h move that counts as a market move

const CYAN = "#2DD4FF", PINK = "#FF3B7A", AMBER = "#FFB020", SLATE = "#8FA3C8", TXT = "#E9ECF2", DIM = "#9AA6BD", BG = "#05060B";
const ACCENT = { happy: CYAN, focused: CYAN, surprised: AMBER, worried: PINK, sleepy: SLATE };

async function getJSON(url) {
  try {
    const r = new Request(url + "?t=" + Date.now());
    r.timeoutInterval = 15;
    const j = await r.loadJSON();
    return j && typeof j === "object" ? j : null;
  } catch (e) { return null; }
}
const fmLocal = () => FileManager.local();
function docPath(name) { const fm = fmLocal(); return fm.joinPath(fm.documentsDirectory(), name); }
function readCache() { try { const fm = fmLocal(), p = docPath(CACHE_NAME); return fm.fileExists(p) ? JSON.parse(fm.readString(p)) : null; } catch (e) { return null; } }
function writeCache(o) { try { fmLocal().writeString(docPath(CACHE_NAME), JSON.stringify(o)); } catch (e) {} }

// Face art: download -> keep the original bytes on disk -> fall back to the on-disk copy when offline.
async function loadFace(expr) {
  if (EXPRS.indexOf(expr) < 0) expr = "happy";
  const p = docPath("zero-face-" + expr + ".png");
  try {
    const r = new Request(FACE_URL(expr)); r.timeoutInterval = 20;
    const data = await r.load();
    const img = Image.fromData(data);
    if (img) { try { fmLocal().write(p, data); } catch (e) {} return { img, cached: false, expr }; }
  } catch (e) {}
  try { if (fmLocal().fileExists(p)) { const img = Image.fromFile(p); if (img) return { img, cached: true, expr }; } } catch (e) {}
  return { img: null, cached: false, expr };
}

const n0 = (x) => (Number.isFinite(+x) && x !== null ? +x : 0);
function ageSecs(iso, ts, nowMs) {
  const now = nowMs || Date.now();
  if (ts) return Math.max(0, now / 1000 - ts);
  const t = Date.parse(iso || ""); return Number.isFinite(t) ? Math.max(0, (now - t) / 1000) : null;
}
function ageText(s) {
  if (s == null) return "--";
  if (s < 3600) return Math.max(1, Math.round(s / 60)) + "m";
  if (s < 86400) return Math.round(s / 3600) + "h";
  return Math.round(s / 86400) + "d";
}
const pct = (x) => (x >= 0 ? "+" : "") + (Math.abs(x) >= 10 ? x.toFixed(0) : x.toFixed(1)) + "%";
function shortKey(s) { s = String(s || ""); return s.length > 12 ? s.slice(0, 4) + "…" + s.slice(-4) : s; }

// the hottest NEW coin on the public X Radar feed (first seen < 6h ago, score >= 75); null when there is none
function pickHot(gem, nowMs) {
  if (!gem || !Array.isArray(gem.finds)) return null;
  const now = nowMs || Date.now();
  const c = gem.finds.filter((f) => {
    const t = Date.parse(f.first_seen || ""); return Number.isFinite(t) && now - t <= HOT_NEW_S * 1000 && n0(f.score) >= HOT_SCORE;
  }).sort((a, b) => n0(b.score) - n0(a.score))[0];
  return c ? { name: shortKey(c.ticker || c.key), score: n0(c.score), mentions: n0(c.mentions), flag: Array.isArray(c.flags) && c.flags.length ? String(c.flags[0]) : "" } : null;
}
// SOL / BTC / ETH 24h change from the public live.json scout block
function pickMoves(live) {
  const s = live && live.scout; if (!s) return [];
  return [["SOL", s.sol_chg_24h_pct], ["BTC", s.btc_chg_24h_pct], ["ETH", s.eth_chg_24h_pct]]
    .filter((x) => Number.isFinite(+x[1]) && x[1] !== null).map((x) => ({ sym: x[0], chg: +x[1] }));
}

async function loadData(nowMs) {
  const [bw, live, gem] = await Promise.all([getJSON(SUMMARY_URL), getJSON(LIVE_URL), getJSON(GEM_URL)]);
  let sum = bw && bw.schema === "brain-widget/1" ? { notes: n0(bw.second_brain && bw.second_brain.notes), open: n0(bw.pipeline && bw.pipeline.open), newest: (bw.neural && bw.neural.newest_ts) || null } : null;
  let lv = live ? { agents: Array.isArray(live.agent_status_lines) ? live.agent_status_lines.length : 0, iso: live.updated_iso || null, moves: pickMoves(live) } : null;
  let gm = gem && gem.schema === "gem-x/1" ? { finds: (gem.finds || []).slice(0, 25).map((f) => ({ ticker: f.ticker, key: f.key, score: f.score, mentions: f.mentions, flags: f.flags, first_seen: f.first_seen })) } : null;
  let cached = false;
  if (sum || lv || gm) { const old = readCache() || {}; sum = sum || old.sum || null; lv = lv || old.lv || null; gm = gm || old.gm || null; writeCache({ sum, lv, gm }); cached = !(bw && live && gem); }
  else { const old = readCache(); if (old) { sum = old.sum || null; lv = old.lv || null; gm = old.gm || null; cached = true; } }
  // freshness follows the live feed; if it is missing, the newest brain event stands in
  const age = lv && lv.iso ? ageSecs(lv.iso, null, nowMs) : (sum && sum.newest ? ageSecs(null, sum.newest, nowMs) : null);
  const ok = !!(sum || lv);
  const d = { ok, cached, notes: sum ? sum.notes : 0, open: sum ? sum.open : 0, haveSum: !!sum, agents: lv ? lv.agents : 0, haveLive: !!lv, age,
    stale: !ok || age == null || age > STALE_AFTER_S, moves: lv ? lv.moves : [], hot: pickHot(gm, nowMs) };
  const big = d.moves.filter((m) => Math.abs(m.chg) >= MOVE_PCT).sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg))[0];
  d.bigMove = big || null;
  const s = pickState(d); d.expr = s.expr; d.kind = s.kind;
  d.msg = voiceLine(d);
  return d;
}

// state -> face. Priority: stale/offline, market move, new hot coin, healthy
function pickState(d) {
  if (!d.ok) return { kind: "offline", expr: "sleepy" };
  if (d.stale) return { kind: "stale", expr: "sleepy" };
  if (d.bigMove) return { kind: "move", expr: d.bigMove.chg < 0 ? "worried" : "focused" };
  if (d.hot) return { kind: "hot", expr: "surprised" };
  return { kind: "healthy", expr: "happy" };
}
// one line from Zero (short enough for the small widget; lock-screen sizes truncate it)
function voiceLine(d, hour) {
  const k = d.kind || pickState(d).kind;
  if (k === "offline") return "Can't reach my feeds. Zzz.";
  if (k === "stale") return `Data's ${ageText(d.age)} old. Wake me up.`;
  if (k === "move") return `${d.bigMove.sym} ${pct(d.bigMove.chg)} in 24h. ${d.bigMove.chg < 0 ? "Watching the floor." : "Eyes on it."}`;
  if (k === "hot") return `New on X Radar: $${d.hot.name}${d.hot.flag ? " (" + d.hot.flag + ")" : ""}.`;
  const h = hour == null ? new Date().getHours() : hour;
  const lines = [];
  if (d.haveLive && d.agents) lines.push(`${d.agents} agents healthy. All quiet.`);
  if (d.haveSum) lines.push(d.open ? `${d.open} open decision${d.open === 1 ? "" : "s"}. Your call.` : "Nothing open. Standing by.");
  lines.push(h >= 22 || h < 5 ? "Visor on. Night shift." : "Visor lit. Standing by.");
  return lines[Math.floor(h / 2) % lines.length];
}
function statusLine(d) {
  if (!d.ok) return "ZERO offline";
  const head = d.stale ? "ZERO STALE" : "ZERO online";
  return d.haveSum ? `${head} · ${d.notes} notes · ${d.open} open` : head;
}
function marketLine(d) { return d.moves.length ? d.moves.map((m) => `${m.sym} ${pct(m.chg)}`).join("  ") : ""; }

// face + dark scrim at the bottom, drawn as one background image (the face is square; it is scaled to the widget width)
function composeBg(face, w, h, scrimFrom) {
  if (!face) return null;
  const dc = new DrawContext();
  dc.size = new Size(w, h); dc.opaque = true; dc.respectScreenScale = true;
  dc.setFillColor(new Color(BG)); dc.fillRect(new Rect(0, 0, w, h));
  dc.drawImageInRect(face, new Rect(0, 0, w, w));
  const bands = 14, y0 = h * scrimFrom;
  for (let i = 0; i < bands; i++) { dc.setFillColor(new Color(BG, 0.05 + 0.6 * (i / bands) * (i / bands + 0.4))); dc.fillRect(new Rect(0, y0 + (h - y0) * i / bands, w, (h - y0) / bands + 1)); }
  return dc.getImage();
}

function txt(parent, s, size, color, bold, lines) {
  const t = parent.addText(String(s));
  t.font = bold ? Font.boldMonospacedSystemFont(size) : Font.regularMonospacedSystemFont(size);
  t.textColor = new Color(color || TXT);
  t.minimumScaleFactor = 0.6; t.lineLimit = lines || 1;
  return t;
}
function dot(parent, d, size, col) {
  const h = parent.addStack(); h.centerAlignContent(); h.spacing = 4;
  txt(h, "●", size, col, true);
  txt(h, "ZERO", size + 1, col, true);
  if (d.stale) txt(h, "STALE", size - 1, PINK, true);
  return h;
}

async function build(d, family, face) {
  const w = new ListWidget();
  w.url = ZERO_URL;
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  const expr = d.expr || "happy", col = ACCENT[expr] || CYAN;
  const img = face && face.img ? face.img : face || null;

  if (family === "accessoryInline") {
    txt(w, `ZERO · ${d.msg}`, 12, TXT, false);
  } else if (family === "accessoryCircular") {
    w.addAccessoryWidgetBackground = true;
    const s = w.addStack(); s.centerAlignContent();
    if (img) { const im = s.addImage(img); im.imageSize = new Size(52, 52); im.cornerRadius = 26; }
    else { const a = txt(s, "ZERO", 11, TXT, true); a.centerAlignText(); }
  } else if (family === "accessoryRectangular") {
    w.addAccessoryWidgetBackground = true;
    const row = w.addStack(); row.centerAlignContent(); row.spacing = 6;
    if (img) { const im = row.addImage(img); im.imageSize = new Size(46, 46); im.cornerRadius = 8; }
    const c = row.addStack(); c.layoutVertically();
    txt(c, d.ok ? (d.stale ? "ZERO · STALE" : "ZERO · online") : "ZERO · offline", 12, TXT, true);
    txt(c, d.msg, 11, TXT, false, 3);
  } else if (family === "medium") {
    w.backgroundColor = new Color(BG);
    w.setPadding(10, 10, 10, 12);
    const row = w.addStack(); row.centerAlignContent(); row.spacing = 10;
    if (img) { const im = row.addImage(img); im.imageSize = new Size(130, 130); im.cornerRadius = 14; }
    const c = row.addStack(); c.layoutVertically(); c.spacing = 3;
    const top = c.addStack(); top.centerAlignContent();
    dot(top, d, 10, col); top.addSpacer();
    txt(top, d.ok ? (d.cached ? "cached" : ageText(d.age)) : "offline", 9, DIM, false);
    c.addSpacer(2);
    txt(c, `“${d.msg}”`, 13, col, true, 4);
    c.addSpacer();
    if (marketLine(d)) txt(c, marketLine(d), 9, TXT, false);
    txt(c, d.haveSum ? `${d.notes} notes · ${d.open} open · ${d.agents} agents` : "no summary", 9, DIM, false);
  } else {
    // small / large (extraLarge treated as large): face as the background, text over a scrim
    const big = family !== "small";
    const bg = composeBg(img, big ? 676 : 360, big ? 708 : 360, big ? 0.52 : 0.55);
    if (bg) w.backgroundImage = bg; else w.backgroundColor = new Color(BG);
    const pad = big ? 14 : 10; w.setPadding(pad, pad, pad, pad);
    const top = w.addStack(); top.centerAlignContent();
    dot(top, d, big ? 12 : 10, col);
    top.addSpacer();
    txt(top, d.ok ? (d.cached ? "cached" : ageText(d.age)) : "offline", big ? 11 : 9, DIM, false);
    w.addSpacer();
    if (!big) {
      txt(w, `“${d.msg}”`, 11, col, true, 3);
    } else {
      txt(w, `“${d.msg}”`, 16, col, true, 2);
      w.addSpacer(4);
      txt(w, statusLine(d), 12, TXT, true);
      if (marketLine(d)) { w.addSpacer(2); txt(w, marketLine(d), 11, TXT, false); }
      w.addSpacer(6);
      const r = w.addStack(); r.spacing = 18;
      [[d.haveSum ? d.notes : "--", "notes"], [d.haveSum ? d.open : "--", "open"], [d.haveLive ? d.agents : "--", "agents"]].forEach((x) => {
        const c = r.addStack(); c.layoutVertically(); txt(c, x[0], 20, col, true); txt(c, x[1], 10, DIM, false);
      });
      w.addSpacer(4);
      txt(w, "tap → Zero in 3D", 9, DIM, false);
    }
  }
  return w;
}

async function main() {
  const d = await loadData();
  // in the Scriptable app (not as a widget) pick the preview size with the run-time argument, e.g. "small", "accessoryCircular"
  const family = config.widgetFamily || (args.widgetParameter && String(args.widgetParameter).trim()) || "large";
  const face = await loadFace(d.expr);
  const w = await build(d, family, face);
  if (config.runsInWidget) Script.setWidget(w);
  else if (family === "small") await w.presentSmall();
  else if (family === "medium") await w.presentMedium();
  else if (family === "accessoryRectangular") await w.presentAccessoryRectangular();
  else if (family === "accessoryCircular") await w.presentAccessoryCircular();
  else if (family === "accessoryInline") await w.presentAccessoryInline();
  else await w.presentLarge();
  Script.complete();
}
if (typeof module !== "undefined" && module.exports) module.exports = { loadData, loadFace, build, composeBg, statusLine, voiceLine, pickState, pickHot, pickMoves, ageText, EXPRS, STALE_AFTER_S, URLS: { ZERO_URL, SUMMARY_URL, GEM_URL, LIVE_URL, FACE_URL } };
if (typeof __NODE_TEST__ === "undefined") main();
