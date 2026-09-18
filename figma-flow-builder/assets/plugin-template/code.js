// __PLUGIN_NAME__ Library Builder — Figma plugin（由 figma-flow-builder skill 產生）
// 一次執行建出：色彩變數（沿用同名、缺的補建）→ 元件庫 → 流程畫面（instance 組裝）→ UI Flow（箭頭＋觸發標籤）→ 規格板
// 純 JS、無 build step、不連網。Figma desktop → Plugins → Development → Import plugin from manifest…
// 重跑會刪掉同名舊板再重建（變數同名沿用）。
//
// 檔案分四段：[CONFIG] 專案設定 → [LIB] 通用 helper（不用改）→ [PROJECT] 元件／資料／畫面／流程／規格（照專案改）→ [FINISH] 放進目標 frame
/* eslint-disable no-undef */
(async function main() {
  // ================================================================ [CONFIG]
  const CFG = {
    targetFrameId: '__TARGET_FRAME_ID__',   // 產物要放進去的 frame／section id（找不到就放目前頁面）
    ns: '__NS__/',                          // 元件命名空間，如 'dualblade/'
    boardPrefix: '__BOARD__',               // 板名前綴：🧩 <prefix> components／🔀 <prefix> ui-flow／📋 <prefix> spec
    flowTitle: '__FLOW_TITLE__',
    flowSubtitle: '__FLOW_SUBTITLE__',
    W: 390, H: 844,                          // 畫面尺寸（iPhone 13/14）
    collectionName: '__COLLECTION__',       // 找不到既有變數集合時新建的集合名
    fonts: [                                 // 依序找齊 regular/medium/semibold 三個字重
      { family: 'PingFang TC', regular: 'Regular', medium: 'Medium', semibold: 'Semibold' },
      { family: 'Noto Sans TC', regular: 'Regular', medium: 'Medium', semibold: 'Bold' },
      { family: 'Inter', regular: 'Regular', medium: 'Medium', semibold: 'Semi Bold' }
    ],
    anchorVars: ['assistBasicBackground2', 'assistBasicLine', 'basicText'] // 用來找到檔案既有的變數集合
  };
  // 色彩 token：名稱對齊檔案既有變數（同名直接綁），找不到才新建。值請從 Figma 變數或設計稿取得。
  const TOKENS = {
    basicText: '#FFFFFF',
    primary: '#FFD55E',
    assistBasicBackground: '#141414', assistBasicBackground2: '#212121',
    assistBasicLine: '#2F2F2F', assistBasicLine2: '#595959',
    assistBasicSecondary: '#7A7A7A', assistBasicSecondary2: '#ABABAB',
    up: '#F84444', down: '#47AB75'
    // __MORE_TOKENS__
  };
  const W = CFG.W, H = CFG.H, NS = CFG.ns;
  const report = { variablesReused: [], variablesCreated: [], components: [], screens: [], arrows: 0, font: null, warnings: [] };

  // ================================================================ [LIB] 變數
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 };
  }
  const VARS = {}; let VCOL = null, VMODE = null; const VBYNAME = {};
  async function setupVariables() {
    const locals = await figma.variables.getLocalVariablesAsync('COLOR');
    locals.forEach(v => { VBYNAME[v.name] = v; });
    let collection = null;
    const anchor = CFG.anchorVars.map(n => VBYNAME[n]).find(Boolean);
    if (anchor) collection = await figma.variables.getVariableCollectionByIdAsync(anchor.variableCollectionId);
    if (!collection) {
      const cols = await figma.variables.getLocalVariableCollectionsAsync();
      collection = cols.find(c => c.name === CFG.collectionName) || figma.variables.createVariableCollection(CFG.collectionName);
    }
    VCOL = collection; VMODE = collection.modes[0].modeId;
    for (const name of Object.keys(TOKENS)) {
      if (VBYNAME[name]) { VARS[name] = VBYNAME[name]; report.variablesReused.push(name); continue; }
      const v = figma.variables.createVariable(name, collection, 'COLOR');
      const c = hexToRgb(TOKENS[name]);
      v.setValueForMode(VMODE, { r: c.r, g: c.g, b: c.b, a: 1 });
      VARS[name] = v; report.variablesCreated.push(name);
    }
  }
  // 綁變數的 solid paint。Figma 會忽略「綁了變數的 paint」自己的 opacity，
  // 所以半透明一律綁「帶 alpha 的變數」（如 primary/10），透明度放進變數值。
  function P(name, opacity) {
    const c = hexToRgb(TOKENS[name]);
    const op = opacity == null ? 1 : opacity;
    if (!VARS[name]) return { type: 'SOLID', color: c, opacity: op };
    let v = VARS[name];
    if (op < 1) {
      const key = name + '/' + Math.round(op * 100);
      v = VBYNAME[key];
      if (!v) {
        v = figma.variables.createVariable(key, VCOL, 'COLOR');
        v.setValueForMode(VMODE, { r: c.r, g: c.g, b: c.b, a: op });
        VBYNAME[key] = v; report.variablesCreated.push(key);
      }
    }
    return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: c, opacity: 1 }, 'color', v);
  }
  const RAW = hex => [{ type: 'SOLID', color: hexToRgb(hex) }]; // 不綁變數的純色（圖表色等一次性顏色）

  // ================================================================ [LIB] 字型
  const FONT = { family: 'Inter', regular: 'Regular', medium: 'Regular', semibold: 'Regular' };
  async function setupFonts() {
    const all = await figma.listAvailableFontsAsync();
    const has = (fam, sty) => all.some(f => f.fontName.family === fam && f.fontName.style === sty);
    let pick = CFG.fonts.find(c => has(c.family, c.regular) && has(c.family, c.medium) && has(c.family, c.semibold));
    if (!pick) { pick = { family: 'Inter', regular: 'Regular', medium: 'Regular', semibold: 'Regular' }; report.warnings.push('找不到完整字重，全部用 Inter Regular'); }
    Object.assign(FONT, pick); report.font = pick.family;
    for (const s of [FONT.regular, FONT.medium, FONT.semibold]) await figma.loadFontAsync({ family: FONT.family, style: s });
  }
  const WEIGHT = { 400: 'regular', 500: 'medium', 600: 'semibold' };

  // ================================================================ [LIB] 節點
  // o: {layout:'HORIZONTAL'|'VERTICAL', primaryFixed, counterFixed, gap, pad:[t,r,b,l], mainAlign, crossAlign, wrap, rowGap,
  //     w, h, fill, fillOpacity, stroke, strokeOpacity, strokeWeight, radius, clip}
  function applyLayout(f, o) {
    f.fills = o.fill ? [P(o.fill, o.fillOpacity)] : [];
    if (o.layout) {
      f.layoutMode = o.layout;
      f.primaryAxisSizingMode = o.primaryFixed ? 'FIXED' : 'AUTO';
      f.counterAxisSizingMode = o.counterFixed ? 'FIXED' : 'AUTO';
      f.itemSpacing = o.gap || 0;
      const p = o.pad || [0, 0, 0, 0];
      f.paddingTop = p[0]; f.paddingRight = p[1]; f.paddingBottom = p[2]; f.paddingLeft = p[3];
      f.primaryAxisAlignItems = o.mainAlign || 'MIN';
      f.counterAxisAlignItems = o.crossAlign || 'MIN';
      if (o.wrap) { f.layoutWrap = 'WRAP'; f.counterAxisSpacing = o.rowGap || o.gap || 0; }
    }
    if (o.w != null || o.h != null) f.resize(o.w != null ? o.w : f.width, o.h != null ? o.h : f.height);
    if (o.stroke) { f.strokes = [P(o.stroke, o.strokeOpacity)]; f.strokeWeight = o.strokeWeight || 1; f.strokeAlign = 'INSIDE'; }
    if (o.radius != null) f.cornerRadius = o.radius;
    f.clipsContent = !!o.clip;
  }
  function frame(name, o) { const f = figma.createFrame(); f.name = name; applyLayout(f, o || {}); return f; }
  // 先 appendChild 再設伸縮（FILL 只能用在父層該軸為 FIXED 或父層自己 FILL 的情況）
  function add(parent, child, sizing) {
    parent.appendChild(child);
    if (sizing && parent.layoutMode && parent.layoutMode !== 'NONE') {
      if (sizing.h) child.layoutSizingHorizontal = sizing.h;   // 'FILL' | 'HUG' | 'FIXED'
      if (sizing.v) child.layoutSizingVertical = sizing.v;
    }
    return child;
  }
  // o: {size, weight:400|500|600, color:tokenName, opacity, lineHeight, align, width(固定寬→自動換行), name}
  function text(str, o) {
    o = o || {};
    const t = figma.createText();
    t.fontName = { family: FONT.family, style: FONT[WEIGHT[o.weight || 400]] };
    t.characters = str;
    t.fontSize = o.size || 14;
    t.fills = [P(o.color || 'basicText', o.opacity)];
    if (o.lineHeight) t.lineHeight = { value: o.lineHeight, unit: 'PIXELS' };
    t.textAlignHorizontal = o.align || 'LEFT';
    t.textAutoResize = o.width != null ? 'HEIGHT' : 'WIDTH_AND_HEIGHT';
    if (o.width != null) t.resize(o.width, t.height);
    if (o.name) t.name = o.name;
    return t;
  }
  function restyle(node, size, weight, lineHeight) { // 覆寫 instance 內所有文字的字級（同一元件在不同處用不同字級時）
    node.findAll(n => n.type === 'TEXT').forEach(n => {
      n.fontName = { family: FONT.family, style: FONT[WEIGHT[weight || 400]] };
      n.fontSize = size; if (lineHeight) n.lineHeight = { value: lineHeight, unit: 'PIXELS' };
    });
  }
  function divider(name, color, w, h) {
    const r = figma.createRectangle();
    r.name = name || 'divider'; r.fills = [P(color || 'assistBasicLine')];
    r.resize(w || 100, h || 1);
    return r;
  }
  // 絕對定位分隔線：side = 'bottom' | 'top' | x 座標（直線）。父層不是 auto-layout 時直接用 x/y。
  function absLine(parent, name, color, side) {
    const isH = side === 'bottom' || side === 'top';
    const r = divider(name, color, isH ? parent.width : 1, isH ? 1 : parent.height);
    parent.appendChild(r);
    if (parent.layoutMode && parent.layoutMode !== 'NONE') r.layoutPositioning = 'ABSOLUTE';
    if (side === 'bottom') { r.constraints = { horizontal: 'STRETCH', vertical: 'MAX' }; r.x = 0; r.y = parent.height - 1; }
    else if (side === 'top') { r.constraints = { horizontal: 'STRETCH', vertical: 'MIN' }; r.x = 0; r.y = 0; }
    else { r.constraints = { horizontal: 'MIN', vertical: 'STRETCH' }; r.x = side; r.y = 0; }
    return r;
  }
  // SVG → 向量。不支援 <text>，文字另放 text 節點（見 labelsOverlay）。
  function svg(markup, name) {
    const n = figma.createNodeFromSvg(markup);
    n.name = name || 'icon'; n.fills = [];
    return n;
  }
  // SVG 進來後把顏色綁回變數。只碰向量，不碰容器 frame（否則會多出一個描邊方框）
  function recolor(node, fillVar, strokeVar) {
    const SKIP = { FRAME: 1, GROUP: 1, INSTANCE: 1, COMPONENT: 1, COMPONENT_SET: 1, TEXT: 1 };
    node.findAll(n => !SKIP[n.type] && 'fills' in n).forEach(n => {
      if (fillVar !== undefined) n.fills = fillVar ? [P(fillVar)] : [];
      if (strokeVar !== undefined && 'strokes' in n) n.strokes = strokeVar ? [P(strokeVar)] : [];
    });
  }
  // 在 SVG 圖上疊文字（刻度、日期）：labels = [{text, x, y, size, color:'#hex', anchor:'start'|'middle'|'end'}]
  function labelsOverlay(parent, w, h, labels) {
    const lab = frame('labels', { w: w, h: h }); parent.appendChild(lab); lab.x = 0; lab.y = 0;
    labels.forEach(l => {
      const t = text(l.text, { size: l.size || 11 }); t.fills = RAW(l.color || TOKENS.assistBasicSecondary2); lab.appendChild(t);
      t.x = Math.round(l.anchor === 'end' ? l.x - t.width : (l.anchor === 'middle' ? l.x - t.width / 2 : l.x)); t.y = Math.round(l.y - t.height + 2);
    });
  }
  function wrapIcon(inner, size) { return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`; }

  // ================================================================ [LIB] 元件
  const board = frame('🧩 ' + CFG.boardPrefix + ' components', { layout: 'HORIZONTAL', wrap: true, gap: 48, rowGap: 64, pad: [48, 48, 48, 48], fill: 'assistBasicBackground', w: 2400, primaryFixed: true });
  board.strokes = [{ type: 'SOLID', color: { r: 0.545, g: 0.435, b: 0.788 } }]; board.strokeWeight = 1; board.dashPattern = [6, 4];

  // component(name, build(c), layoutOpts)：build 裡把子層 add 進 c 之後才能綁 boolProp/textProp
  function component(name, build, o) {
    o = o || {};
    const c = figma.createComponent();
    c.name = name;
    applyLayout(c, o);
    build(c);
    if (!o.noBoard) board.appendChild(c);
    report.components.push(name);
    return c;
  }
  // variants('ns/name', [component('state=on',…), component('state=off',…)])：變體名就是 "prop=value"
  function variants(setName, comps) {
    const set = figma.combineAsVariants(comps, board);
    set.name = setName;
    // combineAsVariants 不排版，變體會全疊在 (0,0) → 變體集開垂直 auto-layout
    set.layoutMode = 'VERTICAL'; set.primaryAxisSizingMode = 'AUTO'; set.counterAxisSizingMode = 'AUTO';
    set.itemSpacing = 16; set.paddingTop = set.paddingBottom = set.paddingLeft = set.paddingRight = 16;
    set.counterAxisAlignItems = 'MIN';
    report.components.push(setName + ' (set)');
    return set;
  }
  function boolProp(comp, label, node, def) {  // 可有可無的圖層用 boolean 控 visible，不要為了有／無翻倍變體
    const key = comp.addComponentProperty(label, 'BOOLEAN', def !== false);
    node.componentPropertyReferences = Object.assign({}, node.componentPropertyReferences || {}, { visible: key });
    return key;
  }
  function textProp(comp, label, node) {       // 只差文字的不另建元件：綁 TEXT 屬性
    const key = comp.addComponentProperty(label, 'TEXT', node.characters);
    node.componentPropertyReferences = Object.assign({}, node.componentPropertyReferences || {}, { characters: key });
    return key;
  }
  function inst(compOrSet, name, variantProps) {
    const comp = compOrSet.type === 'COMPONENT_SET' ? compOrSet.defaultVariant : compOrSet;
    const i = comp.createInstance();
    if (name) i.name = name;
    if (variantProps) i.setProperties(variantProps);
    return i;
  }
  function setText(node, name, str) {          // 依圖層名改 instance 內文字
    const t = node.findOne(n => n.type === 'TEXT' && n.name === name);
    if (t) t.characters = str; else report.warnings.push('找不到文字圖層 ' + name + ' in ' + node.name);
  }
  function setNested(node, name, props) {      // 切 nested instance 的變體
    const n = node.findOne(x => x.type === 'INSTANCE' && x.name === name);
    if (n) n.setProperties(props); else report.warnings.push('找不到 nested instance ' + name + ' in ' + node.name);
  }
  function nested(node, name) { return node.findOne(x => x.type === 'INSTANCE' && x.name === name); }
  const tone = v => { const n = parseFloat(v); return isNaN(n) || n === 0 ? 'neutral' : (n > 0 ? 'up' : 'down'); };

  // ================================================================ [LIB] 畫面／UI Flow／規格板
  const screensRow = frame('📱 ' + CFG.boardPrefix + ' screens', { layout: 'HORIZONTAL', gap: 60, pad: [48, 48, 48, 48] });
  function screen(name) {  // 390×844 直排 auto-layout，超出裁掉
    const s = frame(name, { layout: 'VERTICAL', w: W, h: H, primaryFixed: true, counterFixed: true, fill: 'assistBasicBackground', clip: true });
    add(screensRow, s);
    report.screens.push(name);
    return s;
  }
  const flow = frame('🔀 ' + CFG.boardPrefix + ' ui-flow', { fill: 'assistBasicBackground' });
  const FLOW = { COLW: W + 170, ROWH: H + 320, OX: 60, OY: 360 }; // OY 留給往上繞的回程箭頭
  const clones = [];
  // 把畫面複本排進 flow：grid = { screenIndex: [col,row] }
  function layoutFlow(grid) {
    screensRow.children.slice().forEach((sc, i) => {
      const c = sc.clone(); flow.appendChild(c);
      const g = grid[i] || [i, 0]; c.x = FLOW.OX + g[0] * FLOW.COLW; c.y = FLOW.OY + g[1] * FLOW.ROWH; clones[i] = c;
      const cap = text(sc.name, { size: 22, weight: 600 }); flow.appendChild(cap); cap.x = c.x; cap.y = c.y - 44;
    });
    const hd1 = text(CFG.flowTitle, { size: 34, weight: 600 }); flow.appendChild(hd1); hd1.x = FLOW.OX; hd1.y = 40;
    const hd2 = text(CFG.flowSubtitle, { size: 15, color: 'assistBasicSecondary2' }); flow.appendChild(hd2); hd2.x = FLOW.OX; hd2.y = 90;
  }
  // 畫面 i 的邊界：x 左、r 右、y 上、b 下、cx/cy 中心
  const R = i => { const n = clones[i]; return { x: n.x, y: n.y, r: n.x + W, b: n.y + H, cx: n.x + W / 2, cy: n.y + H / 2 }; };
  // 黃色向量箭頭＋觸發標籤。pts = 折線點（水平／垂直段）；opts.both 雙向；opts.at 指定標籤放在第幾段
  function arrow(pts, label, opts) {
    opts = opts || {};
    const pad = 14;
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const minx = Math.min.apply(null, xs) - pad, miny = Math.min.apply(null, ys) - pad;
    const w = Math.max.apply(null, xs) - minx + pad, h = Math.max.apply(null, ys) - miny + pad;
    const L = pts.map(p => [p[0] - minx, p[1] - miny]);
    const d = 'M' + L.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
    const col = TOKENS.primary;
    function head(a, b) {
      const dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]), sz = 10;
      if (dx) return `${b[0]},${b[1]} ${b[0] - dx * sz},${b[1] - sz * 0.6} ${b[0] - dx * sz},${b[1] + sz * 0.6}`;
      return `${b[0]},${b[1]} ${b[0] - sz * 0.6},${b[1] - dy * sz} ${b[0] + sz * 0.6},${b[1] - dy * sz}`;
    }
    let m = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`
      + `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round"/>`
      + `<polygon points="${head(L[L.length - 2], L[L.length - 1])}" fill="${col}"/>`;
    if (opts.both) m += `<polygon points="${head(L[1], L[0])}" fill="${col}"/>`;
    m += '</svg>';
    const n = svg(m, 'arrow · ' + label); flow.appendChild(n); n.x = minx; n.y = miny;
    let seg = opts.at;
    if (seg == null) { let best = 0, bl = -1; for (let i = 0; i < pts.length - 1; i++) { const l = Math.abs(pts[i + 1][0] - pts[i][0]) + Math.abs(pts[i + 1][1] - pts[i][1]); if (l > bl) { bl = l; best = i; } } seg = best; }
    const mx = (pts[seg][0] + pts[seg + 1][0]) / 2, my = (pts[seg][1] + pts[seg + 1][1]) / 2;
    const chip = frame('label · ' + label, { layout: 'HORIZONTAL', pad: [6, 14, 6, 14], fill: 'assistBasicBackground2', stroke: 'primary', strokeOpacity: 0.6, radius: 16 });
    add(chip, text(label, { size: 15, weight: 500 }));
    flow.appendChild(chip); chip.x = Math.round(mx - chip.width / 2);
    // 橫向短箭頭：標籤放線上方，不蓋住線頭；長箭頭置中
    const horiz = pts[seg][1] === pts[seg + 1][1], segLen = Math.abs(pts[seg + 1][0] - pts[seg][0]);
    chip.y = Math.round(horiz && chip.width + 60 > segLen ? my - chip.height - 10 : my - chip.height / 2);
    report.arrows++;
  }
  // 規格板：SPEC = {title, subtitle, sections:[{id, title, lead?, items:[…], note?, tone?:'design'}]}
  function buildSpecBoard(SPEC) {
    const sb = frame('📋 ' + CFG.boardPrefix + ' spec', { layout: 'VERTICAL', w: 1100, counterFixed: true, pad: [40, 40, 48, 40], gap: 20, fill: 'assistBasicBackground' });
    sb.strokes = [{ type: 'SOLID', color: { r: 0.545, g: 0.435, b: 0.788 } }]; sb.strokeWeight = 1; sb.dashPattern = [6, 4];
    add(sb, text(SPEC.title, { size: 32, weight: 600, lineHeight: 40 }));
    add(sb, text(SPEC.subtitle, { size: 15, color: 'assistBasicSecondary2', lineHeight: 24, width: 1020 }), { h: 'FILL' });
    SPEC.sections.forEach(sec => {
      const dim = sec.tone === 'design';
      const card = add(sb, frame('spec/' + sec.id, { layout: 'VERTICAL', pad: [20, 24, 22, 24], gap: 10, fill: 'assistBasicBackground2', radius: 12 }), { h: 'FILL' });
      add(card, text(sec.title, { size: 20, weight: 600, color: dim ? 'assistBasicSecondary2' : 'primary', lineHeight: 28 }));
      if (sec.lead) add(card, text(sec.lead, { size: 15, lineHeight: 24, width: 1000 }), { h: 'FILL' });
      (sec.items || []).forEach(it => {
        const row = add(card, frame('item', { layout: 'HORIZONTAL', gap: 10, crossAlign: 'MIN' }), { h: 'FILL' });
        add(row, text('•', { size: 15, lineHeight: 24, color: dim ? 'assistBasicSecondary2' : 'primary' }));
        add(row, text(it, { size: 15, lineHeight: 24, width: 960 }), { h: 'FILL' });
      });
      if (sec.note) add(card, text(sec.note, { size: 14, color: 'assistBasicSecondary2', lineHeight: 22, width: 1000 }), { h: 'FILL' });
    });
    return sb;
  }

  await setupFonts();
  await setupVariables();

  // ================================================================ [PROJECT] 元件（照專案改；下面是最小示例）
  const C = {};
  // 範例 1：變體集 value tone=up|down|neutral ＋ 文字屬性（所有數值欄共用一個元件，改字即可）
  C.value = variants(NS + 'value', [['neutral', 'basicText', '97'], ['up', 'up', '15.4'], ['down', 'down', '-3.2']].map(([t, col, def]) => component('tone=' + t, c => {
    textProp(c, 'Value', add(c, text(def, { size: 15, color: col, lineHeight: 20, name: 'value' })));
  }, { layout: 'HORIZONTAL' })));
  // 範例 2：單一元件＋boolean 控顯示
  C.pill = component(NS + 'pill', c => {
    const dot = add(c, frame('dot', { w: 8, h: 8, radius: 4, fill: 'primary' }));
    boolProp(c, 'Show dot', dot);
    textProp(c, 'Label', add(c, text('標籤', { size: 13, lineHeight: 18, name: 'label' })));
  }, { layout: 'HORIZONTAL', gap: 6, pad: [4, 10, 4, 10], radius: 8, stroke: 'primary', crossAlign: 'CENTER' });
  // __COMPONENTS__

  // ================================================================ [PROJECT] 資料（示意資料集中放這裡，畫面只負責排）
  // __DATA__

  // ================================================================ [PROJECT] 畫面（全部用 instance 組裝）
  function exampleScreen(name, o) {
    const s = screen(name);
    const hd = add(s, frame('header', { layout: 'VERTICAL', pad: [56, 16, 12, 16], fill: 'assistBasicBackground2' }), { h: 'FILL' });
    add(hd, text(o.title, { size: 17, weight: 500, lineHeight: 24 }));
    const row = add(s, frame('row', { layout: 'HORIZONTAL', pad: [12, 16, 12, 16], gap: 12, crossAlign: 'CENTER' }), { h: 'FILL' });
    const v = add(row, inst(C.value, 'value', { tone: tone(o.value) })); setText(v, 'value', o.value);
    const p = add(row, inst(C.pill, 'pill')); setText(p, 'label', o.pill);
    absLine(row, 'row-divider', 'assistBasicLine', 'bottom');
    return s;
  }
  exampleScreen('01 範例 A', { title: '畫面 A', value: '15.4', pill: '入口' });
  exampleScreen('02 範例 B', { title: '畫面 B', value: '-3.2', pill: '返回' });
  // __SCREENS__

  // ================================================================ [PROJECT] UI Flow（依原型的跳轉關係）
  layoutFlow({ 0: [0, 0], 1: [1, 0] /* __GRID__ */ });
  const S01 = R(0), S02 = R(1); // __RECTS__
  arrow([[S01.r, S01.cy], [S02.x, S02.cy]], '點入口');
  arrow([[S02.x, S02.cy + 80], [S01.r, S01.cy + 80]], '返回');
  // __ARROWS__

  // ================================================================ [PROJECT] 規格板（PM 規格＋設計定案＋待確認）
  const SPEC = {
    title: '__SPEC_TITLE__', subtitle: '__SPEC_SUBTITLE__',
    sections: [
      { id: 'why', title: '需求背景', items: ['__WHY__'] },
      { id: 'rule-1', title: '規則 ①', items: ['__RULE__'] },
      { id: 'design', tone: 'design', title: '設計定案（設計側，非 PM 規格）', items: ['__DESIGN__'] },
      { id: 'open', tone: 'design', title: '待確認', items: ['__OPEN__'] }
    ]
  };
  const specBoard = buildSpecBoard(SPEC);

  // ================================================================ [FINISH] 放進目標 frame、覆蓋舊板、回報
  let target = null;
  try { target = await figma.getNodeByIdAsync(CFG.targetFrameId); } catch (e) { /* ignore */ }
  if (target && target.type !== 'PAGE') {
    let pg = target; while (pg && pg.type !== 'PAGE') pg = pg.parent;
    if (pg && figma.currentPage !== pg) await figma.setCurrentPageAsync(pg);
  } else {
    report.warnings.push('找不到 frame ' + CFG.targetFrameId + '，改放在目前頁面');
    target = figma.currentPage;
  }
  const prefix = CFG.boardPrefix;
  const olds = target.children ? target.children.filter(n => n.name.startsWith('🧩 ' + prefix) || n.name.startsWith('📱 ' + prefix) || n.name.startsWith('🔀 ' + prefix) || n.name.startsWith('📋 ' + prefix)) : [];
  if (olds.length) { olds.forEach(n => n.remove()); report.warnings.push('已刪除上一版產物 ' + olds.length + ' 塊並重建'); }
  target.appendChild(board); board.x = 40; board.y = 40;
  screensRow.remove(); // 畫面已複製進 UI Flow，不另出畫面板（要保留就改成 target.appendChild(screensRow)）
  target.appendChild(flow); flow.x = 40; flow.y = board.y + board.height + 120;
  target.appendChild(specBoard); specBoard.x = board.x + board.width + 80; specBoard.y = 40;
  if (target.type === 'FRAME' && target.layoutMode === 'NONE') {
    const needW = Math.max(board.width + 80 + specBoard.width, flow.width) + 80, needH = Math.max(flow.y + flow.height, specBoard.y + specBoard.height) + 40;
    if (target.width < needW || target.height < needH) target.resize(Math.max(target.width, needW), Math.max(target.height, needH));
  }
  figma.currentPage.selection = [board, specBoard, flow];
  figma.viewport.scrollAndZoomIntoView([board, specBoard, flow]);

  const msg = `${prefix}：變數 沿用 ${report.variablesReused.length}／新建 ${report.variablesCreated.length}，元件 ${report.components.length}，UI Flow 畫面 ${report.screens.length}／箭頭 ${report.arrows}，規格板 ${SPEC.sections.length} 節，字型 ${report.font}` + (report.warnings.length ? `，警告 ${report.warnings.length}（看 console）` : '');
  console.log('[' + prefix + '] report', JSON.stringify(report, null, 2));
  figma.notify(msg, { timeout: 8000 });
  figma.closePlugin(msg);
})().catch(e => { console.error(e); figma.closePlugin('builder 失敗：' + (e && e.message ? e.message : e)); });
