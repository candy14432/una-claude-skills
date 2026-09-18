# Figma Plugin API 實機踩過的坑

這些全部在 Figma desktop 真機上出過錯，本機 mock 只抓得到前六條。範本 `assets/plugin-template/code.js` 的 helper 已經內建對應處理，自己寫新 helper 時要記得。

## mock 抓得到

1. **`componentPropertyReferences` 只能設在已掛進元件的子層**
   錯誤：`Can only set component property references on symbol sublayer`。
   做法：`component(name, c => { const t = add(c, text(...)); textProp(c, 'Label', t); })`，先 `add` 進元件再綁。所有需要綁屬性的子層（含深層）都要在 `build(c)` 裡建。

2. **FILL 只能用在父層該軸為 FIXED、或父層自己也 FILL 的情況**
   HUG 的父層放 FILL 子層會報錯或被忽略。`add(parent, child, { h: 'FILL' })` 前確認父層 `primaryFixed/counterFixed` 或父層本身 `{ h: 'FILL' }`。

3. **`layoutPositioning = 'ABSOLUTE'` 只能用在 auto-layout 子層**
   `absLine()` 已判斷：非 auto-layout 父層直接用 x/y。

4. **`setProperties` 的 key 必須是元件真的有的屬性**
   變體屬性用 `prop=value` 命名（`state=on`），TEXT/BOOLEAN 屬性的 key 帶 `#id` 後綴，所以改 instance 文字不要走 `setProperties`，用 `setText(inst, 'layerName', str)` 找圖層名改 `characters`。

5. **文字要先 `loadFontAsync` 才能設 `characters`**
   `setupFonts()` 一次載好 regular/medium/semibold；改字重時只能用這三個 style。

6. **`createNodeFromSvg` 不支援 `<text>`**
   刻度、日期等文字用 `labelsOverlay()` 另放 text 節點疊上去。markup 必須以 `<svg` 開頭、帶 `xmlns`。

## mock 抓不到，要人在 Figma 看

7. **綁了變數的 paint 會忽略自己的 opacity**
   要半透明就綁「帶 alpha 的變數」，例如 `primary/10`（值 = primary 色 + a 0.1）。`P(name, opacity)` 已自動建 `name/NN` 變數並分到 `name/` 群組。

8. **`combineAsVariants` 之後變體全疊在 (0,0)**
   `variants()` 已把變體集開成垂直 auto-layout；不做的話元件庫板上看起來只有一個變體。

9. **SVG 轉進來的容器 frame 也有 fills/strokes**
   `recolor()` 只碰向量圖層、跳過 FRAME/GROUP/INSTANCE/COMPONENT/TEXT，否則星星外面會多一個描邊方框。

10. **`◀ ▶ ▲ ▼` 等字元在 PingFang 下會被畫成 emoji 或字形不一致**
    箭頭一律用 SVG 三角形（`svg('<svg …><path d="M10 0L0 6L10 12Z"/></svg>')`），排序符號用小字級 `▲\n▼` 尚可接受。

11. **變體集內共用的文字要逐一設**
    `variants()` 把多個元件合成 set 後，每個變體是獨立元件；「標題」這種每個變體都有的字要在各自 `component()` 裡 `setText`，不能只設一個。

12. **`getNodeByIdAsync` 找到的 frame 可能在別頁**
    先 `setCurrentPageAsync` 到該頁再 append，否則 selection/viewport 會失敗。`documentAccess: "dynamic-page"` 時所有找節點的呼叫都要用 Async 版本。

13. **重跑要能覆蓋**
    照板名前綴刪舊板再建（`olds.forEach(n => n.remove())`），變數同名沿用不重建。已拉到別頁的 instance 在主元件刪掉後會脫離，重跑前提醒使用者。

14. **Figma 忽略 paint opacity 之外，也不會幫你排 clone**
    UI Flow 用 `sc.clone()` 複製畫面後要自己設 x/y；clone 保留 instance 連結，改主元件會同步。

## 除錯

- Figma desktop → Plugins → Development → **Show/Hide console**，`console.log('[prefix] report', …)` 會印統計與 warnings。
- 錯誤 toast 只顯示 message，堆疊在 console。
- 改完 code.js 直接重跑 plugin 即可，不用重新 import manifest。
