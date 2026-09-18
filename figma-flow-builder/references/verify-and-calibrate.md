# 驗證與量測

## 1. 本機 mock（每次改 code.js 都跑）

```bash
node <skill>/scripts/mock-figma.mjs <project>/figma-plugin/code.js --target <frameId>
```

- 正常結尾會印 `[notify] …變數 沿用 N／新建 M，元件 X，UI Flow 畫面 Y／箭頭 Z…`，再列 boards／instances／新變數。
- 有錯就是 JS 例外或 API 誤用，訊息會指出圖層名。修完再跑。
- mock 不算版面：對齊、重疊、溢出只能在 Figma 看，或先用原型 HTML 的 headless 截圖確認數值。

## 2. 原型 HTML 的 headless 截圖（改視覺時用）

原型通常把整頁 JS 包在 IIFE 裡，測試 hook 要插在 IIFE 內（例如 `render();` 之後），不能另開 `<script>`。

```bash
# 產生測試檔：在 IIFE 結尾前插入操作腳本
python3 - <<'EOF'
s=open('proto.html',encoding='utf-8').read()
anchor='  render();\n\n})();'   # 依原型實際結尾調整
js='openMonitor();'          # 要驗的操作
open('/tmp/test.html','w',encoding='utf-8').write(s.replace(anchor,'  render();\n  '+js+'\n})();'))
EOF
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --window-size=510,860 --screenshot=/tmp/test.png file:///tmp/test.html
```

- Chrome 視窗最小 500 寬，所以開 510 再裁：390 寬的 `.phone` 置中時裁 `(60, 0, 450, 844)`。
- 要驗 sticky／捲動：在 hook 裡設 `el.scrollLeft / scrollTop` 後截圖。
- 用 PIL 把「參考截圖｜我們的」拼成一張看差異。

## 3. 從實機截圖量字級（使用者說「太大／太小」時）

實機截圖的像素不等於 pt：**先確認機型的 pt 寬**（iPhone 17 Pro Max = 440pt，iPhone 13/14 = 390pt）。曾把 868px 寬截圖當成 390 寬換算，全部偏大。

```
scale = 390 / 機型pt寬 × (機型pt寬 / 截圖px寬)      # 先 px→pt，再 pt→390 基準
字級 ≈ 字形像素高 × scale ÷ 0.87（CJK）或 ÷ 0.72（數字／拉丁）
```

用 PIL 量字形上下緣（灰階門檻找非背景像素的行範圍），間距、欄寬、列高同法。量完的數值寫進原型 CSS 與 plugin 常數，並記到 README 的「視覺規格」。

## 4. Figma 端驗證（使用者跑完 plugin 後）

Figma MCP 只能讀：`get_metadata` 看板與元件是否建出、`get_screenshot` 看版面、`get_variable_defs` 看變數。發現問題 → 改 code.js → 請使用者重跑（重跑會覆蓋舊板）。

## 5. 常見視覺問題與對策

| 現象 | 原因 | 對策 |
|---|---|---|
| 星星外面有方框 | recolor 碰到 SVG 容器 frame | `recolor()` 跳過容器類型 |
| 半透明變全實色 | 綁變數 paint 的 opacity 被忽略 | 用 `P(name, 0.1)` 走 alpha 變數 |
| 變體疊成一團 | combineAsVariants 不排版 | 變體集開 auto-layout（`variants()` 已做） |
| 兩區塊黏在一起 | 沒留 gap 或 padding | 加 `frame('gap', {w, h})` 或 pad |
| 標籤蓋住箭頭頭 | 短箭頭置中標籤 | `arrow()` 已把短橫向箭頭標籤移到線上方 |
| 第一張畫面看不到收藏欄 | 表格寬於 390 | 用「已捲到底」狀態呈現（clip 內容位移） |
