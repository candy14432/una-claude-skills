#!/usr/bin/env node
// 極簡 Figma Plugin API mock：在本機跑 code.js，抓執行期錯誤與 API 誤用（不算版面、不驗視覺）。
// 用法：node mock-figma.mjs <code.js> [--target 6624:52233] [--vars basicText,primary,...] [--font "PingFang TC"]
//   --target  假裝存在的目標 frame id（要和 code.js 的 CFG.targetFrameId 一樣，否則會走「找不到 frame」分支）
//   --vars    假裝檔案已有的色彩變數名（逗號分隔），用來測「同名沿用」
//   --font    假裝已安裝的字型家族（含 Regular/Medium/Semibold），預設 PingFang TC
// 會攔的錯：componentPropertyReferences 綁在元件外、FILL 用在 HUG 軸、layoutPositioning 用在非 auto-layout 子層、
//          setProperties 用了不存在的屬性／變體、文字未載字型、combineAsVariants 塞了非元件、非 <svg 開頭的 SVG。
import fs from 'node:fs';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const TARGET_ID = opt('target', '0:1');
const EXISTING_VARS = opt('vars', 'basicText,primary,assistBasicBackground,assistBasicBackground2,assistBasicLine,assistBasicLine2,assistBasicSecondary,assistBasicSecondary2').split(',').filter(Boolean);
const FONT_FAMILY = opt('font', 'PingFang TC');
if (!file) { console.error('用法：node mock-figma.mjs <code.js> [--target id] [--vars a,b] [--font family]'); process.exit(2); }

let nid = 1;
class Node {
  constructor(type) {
    this.type = type; this.id = String(nid++); this.name = type; this.children = []; this.parent = null;
    this.width = 100; this.height = 40; this.x = 0; this.y = 0; this.fills = []; this.strokes = []; this.visible = true;
    this.layoutMode = 'NONE'; this._cpr = null; this._props = {}; this._defs = {}; this.primaryAxisSizingMode = 'AUTO'; this.counterAxisSizingMode = 'AUTO';
  }
  set componentPropertyReferences(v) {
    if (v && Object.keys(v).length) { let p = this.parent, ok = false; while (p) { if (p.type === 'COMPONENT') { ok = true; break; } p = p.parent; } if (!ok) throw new Error(`in set_componentPropertyReferences: Can only set component property references on symbol sublayer ("${this.name}") — 先 add 進元件再綁屬性`); }
    this._cpr = v;
  }
  get componentPropertyReferences() { return this._cpr; }
  set layoutPositioning(v) { if (!this.parent || this.parent.layoutMode === 'NONE') throw new Error(`layoutPositioning on "${this.name}" whose parent "${this.parent && this.parent.name}" is not auto-layout`); this._lp = v; }
  get layoutPositioning() { return this._lp || 'AUTO'; }
  _axisFixed(horizontal) {
    const p = this.parent; const primaryIsH = p.layoutMode === 'HORIZONTAL'; const isPrimary = horizontal === primaryIsH;
    const mode = isPrimary ? p.primaryAxisSizingMode : p.counterAxisSizingMode; const pFill = horizontal ? p._lsh === 'FILL' : p._lsv === 'FILL'; return mode === 'FIXED' || pFill;
  }
  appendChild(c) { if (c.parent) c.parent.children = c.parent.children.filter(x => x !== c); c.parent = this; this.children.push(c); }
  resize(w, h) { this.width = w; this.height = h; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); this.parent = null; }
  findAll(fn) { const out = []; const walk = n => { n.children.forEach(c => { if (!fn || fn(c)) out.push(c); walk(c); }); }; walk(this); return out; }
  findOne(fn) { return this.findAll(fn)[0] || null; }
  setProperties(p) {
    if (this.type !== 'INSTANCE') throw new Error(`setProperties on non-instance "${this.name}"`);
    for (const k of Object.keys(p)) {
      if (!(k in this._defs)) throw new Error(`setProperties: unknown property "${k}" on instance "${this.name}" (known: ${Object.keys(this._defs).join(', ')})`);
      const d = this._defs[k]; if (d.type === 'VARIANT' && !d.variantOptions.includes(p[k])) throw new Error(`variant "${k}=${p[k]}" not in ${d.variantOptions}`); this._props[k] = p[k];
      if (d.type === 'VARIANT' && this.mainComponent && this.mainComponent.parent && this.mainComponent.parent.type === 'COMPONENT_SET') {
        const set = this.mainComponent.parent; const target = set.children.find(v => v.name.split(',').map(x => x.trim()).includes(`${k}=${p[k]}`));
        if (target) { this.mainComponent = target; this.children = []; target.children.forEach(ch => this.appendChild(ch.clone())); }
      }
    }
  }
  set layoutSizingHorizontal(v) { if (!this.parent || this.parent.layoutMode === 'NONE') throw new Error(`layoutSizingHorizontal on "${this.name}" whose parent is not auto-layout`); if (v === 'FILL' && !this._axisFixed(true)) throw new Error(`layoutSizingHorizontal=FILL on "${this.name}" but parent "${this.parent.name}" hugs horizontally`); this._lsh = v; }
  get layoutSizingHorizontal() { return this._lsh; }
  set layoutSizingVertical(v) { if (!this.parent || this.parent.layoutMode === 'NONE') throw new Error(`layoutSizingVertical on "${this.name}" whose parent is not auto-layout`); if (v === 'FILL' && !this._axisFixed(false)) throw new Error(`layoutSizingVertical=FILL on "${this.name}" but parent "${this.parent.name}" hugs vertically`); this._lsv = v; }
  get layoutSizingVertical() { return this._lsv; }
  clone() {
    const c = new Node(this.type);
    Object.assign(c, { name: this.name, width: this.width, height: this.height, layoutMode: this.layoutMode, visible: this.visible, fontName: this.fontName, fills: this.fills, _cpr: this._cpr, _defs: this._defs, _variant: this._variant, primaryAxisSizingMode: this.primaryAxisSizingMode, counterAxisSizingMode: this.counterAxisSizingMode, _lsh: this._lsh, _lsv: this._lsv });
    if (this.type === 'TEXT') c._c = this._c; c.mainComponent = this.mainComponent; c.children = []; this.children.forEach(ch => c.appendChild(ch.clone())); return c;
  }
}
class Text extends Node {
  constructor() { super('TEXT'); this.fontName = { family: 'Inter', style: 'Regular' }; this._c = ''; }
  set characters(v) { if (!figma._loaded.has(this.fontName.family + '/' + this.fontName.style)) throw new Error(`font not loaded ${JSON.stringify(this.fontName)}`); this._c = v; }
  get characters() { return this._c; }
}
class Component extends Node {
  constructor() { super('COMPONENT'); }
  addComponentProperty(name, type, def) { const key = type === 'VARIANT' ? name : `${name}#${this.id}:${Object.keys(this._defs).length}`; this._defs[key] = { type, defaultValue: def }; return key; }
  get componentPropertyDefinitions() { return this._defs; }
  createInstance() { const i = this.clone(); i.type = 'INSTANCE'; i.mainComponent = this; i._defs = this.parent && this.parent.type === 'COMPONENT_SET' ? Object.assign({}, this.parent._defs, this._defs) : this._defs; return i; }
}

const page = new Node('PAGE'); page.name = 'Mock Page';
const target = new Node('FRAME'); target.name = 'target'; target.width = 4000; target.height = 3000; page.appendChild(target);
const byId = { [TARGET_ID]: target };
const vars = []; const collections = [];
function mkCollection(name) { const c = { id: 'col' + collections.length, name, modes: [{ modeId: 'm1', name: 'Mode 1' }] }; collections.push(c); return c; }
const existing = mkCollection('existing');
EXISTING_VARS.forEach(n => vars.push({ id: 'v' + vars.length, name: n, variableCollectionId: existing.id, setValueForMode() {} }));
const preexisting = vars.length;

globalThis.figma = {
  _loaded: new Set(),
  currentPage: page,
  root: { children: [page] },
  viewport: { scrollAndZoomIntoView() {} },
  notify: (m) => console.log('[notify]', m),
  closePlugin: (m) => { console.log('[closePlugin]', m || ''); },
  createFrame: () => { const f = new Node('FRAME'); f.name = 'Frame'; return f; },
  createRectangle: () => new Node('RECTANGLE'),
  createEllipse: () => new Node('ELLIPSE'),
  createLine: () => new Node('LINE'),
  createText: () => new Text(),
  createComponent: () => new Component(),
  createNodeFromSvg: (svg) => { if (!/^<svg/.test(svg.trim())) throw new Error('createNodeFromSvg: markup 必須以 <svg 開頭'); if (/<text[\s>]/.test(svg)) throw new Error('createNodeFromSvg: 不支援 <text>，文字改用 text 節點疊上去'); const f = new Node('FRAME'); const v = new Node('VECTOR'); f.appendChild(v); return f; },
  combineAsVariants: (nodes, parent) => {
    const s = new Node('COMPONENT_SET'); parent.appendChild(s); const opts = {};
    nodes.forEach(n => { if (n.type !== 'COMPONENT') throw new Error('combineAsVariants needs components'); s.appendChild(n); n.name.split(',').forEach(pair => { const [k, v] = pair.trim().split('='); if (!k || v === undefined) throw new Error(`變體名 "${n.name}" 必須是 prop=value`); (opts[k] = opts[k] || []).push(v); }); });
    for (const k of Object.keys(opts)) s._defs[k] = { type: 'VARIANT', variantOptions: opts[k] }; s.defaultVariant = nodes[0]; return s;
  },
  getNodeByIdAsync: async (id) => byId[id] || null,
  setCurrentPageAsync: async (p) => { figma.currentPage = p; },
  listAvailableFontsAsync: async () => ['Regular', 'Medium', 'Semibold', 'Bold', 'Semi Bold'].map(s => ({ fontName: { family: FONT_FAMILY, style: s } })).concat(['Regular', 'Medium', 'Semi Bold'].map(s => ({ fontName: { family: 'Inter', style: s } }))),
  loadFontAsync: async (f) => { figma._loaded.add(f.family + '/' + f.style); },
  variables: {
    getLocalVariablesAsync: async () => vars,
    getLocalVariableCollectionsAsync: async () => collections,
    getVariableCollectionByIdAsync: async (id) => collections.find(c => c.id === id) || null,
    createVariableCollection: (name) => mkCollection(name),
    createVariable: (name, col, type) => { const v = { id: 'v' + vars.length, name, variableCollectionId: col.id, resolvedType: type, setValueForMode() {} }; vars.push(v); return v; },
    setBoundVariableForPaint: (paint, field, v) => Object.assign({}, paint, { boundVariables: { [field]: { type: 'VARIABLE_ALIAS', id: v.id } } })
  }
};

const src = fs.readFileSync(file, 'utf8');
await (new Function(src + '\nreturn (async()=>{})();'))();
await new Promise(r => setTimeout(r, 200));

const comps = target.findAll(n => n.type === 'COMPONENT' || n.type === 'COMPONENT_SET');
const inst = target.findAll(n => n.type === 'INSTANCE').length;
console.log(`boards in target: ${target.children.map(n => n.name).join(' | ') || '(none — 是否走到「找不到 frame」分支？用 --target 指定)'}`);
console.log(`components/sets: ${comps.length} | instances: ${inst}`);
console.log(`variables: existing ${preexisting} | new ${vars.length - preexisting}: ${vars.slice(preexisting).map(v => v.name).join(', ')}`);
const flow = target.children.find(n => n.name.startsWith('🔀'));
if (flow) console.log(`ui-flow: screens ${flow.children.filter(n => n.type === 'FRAME' && n.width === 390).length} | arrows ${flow.children.filter(n => n.name.startsWith('arrow')).length}`);
