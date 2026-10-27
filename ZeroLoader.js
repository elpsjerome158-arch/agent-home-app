// Zero loader for Scriptable — paste this ONCE. It always downloads and runs the latest published Zero.js,
// so future art/text changes reach the widget with no re-paste. Falls back to the last good copy when offline.
const SRC = "https://elpsjerome158-arch.github.io/agent-home-app/Zero.js";
const fm = FileManager.local(), p = fm.joinPath(fm.documentsDirectory(), "Zero-latest.js");
let code = null;
try { const r = new Request(SRC + "?t=" + Date.now()); r.timeoutInterval = 15; code = await r.loadString(); if (!/ListWidget/.test(code)) code = null; else fm.writeString(p, code); } catch (e) {}
if (!code && fm.fileExists(p)) code = fm.readString(p);
if (!code) { const w = new ListWidget(); w.backgroundColor = new Color("#07040D"); const t = w.addText("ZERO · offline"); t.textColor = new Color("#BDB0F2"); Script.setWidget(w); Script.complete(); }
else await (new (Object.getPrototypeOf(async function () {}).constructor)("module", code.replace(/\nif \(typeof __NODE_TEST__ === "undefined"\) main\(\);\s*$/, "\nawait main();")))({});
