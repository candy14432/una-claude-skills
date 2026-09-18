# figma-flow-builder 快速上手

把 HTML 原型匯回 Figma，做成變數、元件、UI Flow 與規格板。Claude 會產生一支 Figma plugin 給你在 Figma desktop 執行。

## 觸發

在 Claude Code 對話裡直接說，例如：

- 「幫我把這個原型匯回 Figma，做成元件和 UI Flow」（附 HTML 路徑）
- 「重跑 plugin」「plugin 同步一下」
- 或直接打 `/figma-flow-builder`

## 使用（四步）

1. **給 Claude 三樣東西**：原型 HTML 路徑、Figma 目標 frame 連結、元件命名（如 `dualblade`）。
2. **確認清單**：Claude 會先列「畫面清單、元件清單、箭頭清單」給你看，確認後產生 `figma-plugin/` 資料夾，並在本機跑 mock 確認沒錯。
3. **在 Figma desktop 執行**：Plugins → Development → Import plugin from manifest…（選那個資料夾的 `manifest.json`，只需一次）→ Plugins → Development → 執行。右下角 toast 會顯示建了多少變數、元件、畫面、箭頭。
4. **之後要改**：跟 Claude 說要改什麼，它會同時改 HTML 原型和 plugin，你回 Figma 重跑一次就覆蓋。

## 會建出什麼

目標 frame 內三塊板：

- 🧩 元件庫：元件與變體集，顏色全綁變數
- 🔀 UI Flow：流程畫面＋黃色箭頭＋觸發標籤
- 📋 規格板：PM 規格、設計定案、待確認

## 注意

- 重跑會刪掉同名舊板再重建；已拉到別頁用的元件 instance 會脫離。
- 只支援 Figma desktop（瀏覽器版不能載入開發中 plugin）。
- 改 code.js 後直接重跑即可，不用重新 import。

## 給 Claude 看的細節

流程與規則在 `SKILL.md`，坑與慣例在 `references/`，plugin 範本在 `assets/plugin-template/`，本機驗證用 `scripts/mock-figma.mjs`。
