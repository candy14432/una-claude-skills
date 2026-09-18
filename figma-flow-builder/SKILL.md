---
name: figma-flow-builder
description: >-
  把互動原型（HTML 或一組畫面截圖＋規格）匯回 Figma，做成有變數、元件（variants／boolean／text 屬性、nested instance）、
  流程畫面、UI Flow（箭頭＋觸發標籤）與規格板的完整產物。做法是產生一支自寫的 Figma plugin（manifest.json + code.js）給使用者在
  Figma desktop 執行，因為 Figma MCP 只能讀不能寫。只要使用者說「匯回 Figma」「匯進 Figma」「做成元件／變數」「畫 UI Flow」
  「把畫面放進 Figma」「重跑 plugin」「plugin 匯入 figma」，或要把 HTML 原型、PM 規格、流程畫面變成 Figma 元件庫，就用這個 skill，
  即使他沒提到 plugin。也涵蓋後續維護：改原型後同步 plugin、重跑覆蓋、用 mock 驗證、對實機截圖校字級。
---

# Figma Flow Builder

把「原型 → Figma 元件庫＋畫面＋UI Flow＋規格板」這整段做成可重複的流程。核心產物是一支 Figma plugin：純 JS、無 build、不連網，使用者在 Figma desktop 用 Import plugin from manifest 匯入後一鍵執行，重跑會覆蓋。

為什麼走 plugin：Figma MCP（`get_design_context`／`get_metadata`／`get_screenshot`／`get_variable_defs`）全是讀取；公司的 Production UI Import 明文不建變數／元件。Plugin API 是唯一能寫進檔案的路徑，而且可以把「原型數值 → Figma」做成程式，改一處重跑即可。

## 流程

### 0. 先確認三件事（缺一件就問，其餘先做）

1. **來源**：原型 HTML 路徑（最好），或畫面截圖＋文字規格。原型的 CSS 數值（390 寬、字級、padding、欄寬）就是 Figma 的數值。
2. **目的地**：Figma 檔案與目標 frame／section 的 node id（使用者給連結就從 URL 的 `node-id` 取，`6624-52233` → `6624:52233`）。
3. **命名空間與板名前綴**（如 `dualblade/`、`dualblade`）。使用者沒說就照功能名取英文。

順手用 Figma MCP `get_variable_defs` 讀目標檔的既有色彩變數名，`TOKENS` 用同名沿用，不重建。

### 1. 拆解原型（寫 code.js 前先列清單，給使用者過一眼）

讀 `references/component-conventions.md`，照它的順序列出：畫面清單（每張叫什麼、什麼狀態）→ 原子元件（靠 TEXT／BOOLEAN／變體哪種變化）→ 組合元件（nested）→ UI Flow 的箭頭（原型每個跳頁事件一條，標籤寫觸發條件）→ 規格板章節（PM 原文 + 設計定案 + 待確認）。

畫面數量以「一個狀態一張」計；同一頁的不同狀態（0 組／1 組／彈窗開著）都是獨立畫面，用同一個畫面函式吃參數產生。

### 2. 產生 plugin

1. 在專案下建 `figma-plugin/`，複製 `assets/plugin-template/manifest.json` 與 `code.js`，把 `__PLUGIN_NAME__`、`__PLUGIN_ID__`、`__TARGET_FRAME_ID__`、`__NS__`、`__BOARD__`、`__FLOW_TITLE__`、`__FLOW_SUBTITLE__`、`__COLLECTION__`、`__SPEC_*__` 全部換掉（`grep __ code.js` 應該沒剩）。
2. `[CONFIG]` 填 TOKENS（值取自 Figma 變數或原型 CSS 變數）。`[LIB]` 不用改；helper 一覽在範本註解裡：`frame/add/text/restyle/divider/absLine/svg/recolor/labelsOverlay`、`component/variants/boolProp/textProp/inst/setText/setNested/nested`、`screen/layoutFlow/R/arrow/buildSpecBoard`。
3. `[PROJECT]` 四段照第 1 步的清單寫：元件 → 資料 → 畫面 → UI Flow → SPEC。範例元件與畫面刪掉換成真的。
4. 每寫一段就跑 mock：

```bash
node ~/.claude/skills/figma-flow-builder/scripts/mock-figma.mjs <project>/figma-plugin/code.js --target <frameId>
```

   結尾的 `[notify]` 行就是 Figma 會看到的 toast。有錯先看 `references/figma-plugin-api-gotchas.md`——那六條 mock 抓得到的錯佔了九成。

5. 寫 `figma-plugin/README.md`：安裝步驟、會建出什麼（變數／元件表／畫面／UI Flow／規格板）、視覺規格數值、「HTML 與 plugin 要同步」、重跑會覆蓋、已知限制。

### 3. 交給使用者執行

告訴他：Figma **desktop** 開檔、切到有目標 frame 的頁 → Plugins → Development → Import plugin from manifest…（只需一次）→ Plugins → Development → 執行。跑完自動選取並 zoom，右下 toast 顯示統計；細節在 Show/Hide console 搜 `[<prefix>] report`。改 code.js 後直接重跑，不用重新 import。

### 4. 驗證與修

使用者跑完後用 Figma MCP `get_metadata` / `get_screenshot` 看實際結果（板有沒有建出、元件數對不對、版面有沒有疊）。mock 抓不到的視覺問題（半透明、變體疊在一起、SVG 容器方框、emoji 箭頭）看 `references/figma-plugin-api-gotchas.md` 第 7 條起與 `references/verify-and-calibrate.md` 的對策表。改 → mock → 請他重跑。

### 5. 之後每次改

原型 HTML 與 code.js 是一對：改字級、欄寬、文案、流程，兩邊同一次改，改完 mock 跑過，回報時說明「重跑 plugin 即生效」。使用者說「太大／太小」時，照 `references/verify-and-calibrate.md` 從實機截圖量，先確認機型 pt 寬再換算。

## 產物長相

目標 frame 內三塊板（畫面只出現在 UI Flow，不另出畫面板；要保留就把 `screensRow.remove()` 改成 append）：

- `🧩 <prefix> components`：wrap 排列的元件與變體集，虛線紫框
- `🔀 <prefix> ui-flow`：畫面複本照 GRID 排列，每張上方有標題，黃色向量箭頭＋觸發標籤 chip
- `📋 <prefix> spec`：標題、副標、每節一張卡（PM 原文用 primary 標題，設計側用灰）

## 對使用者說話

- 回報用 toast 那行的統計（變數沿用／新建、元件、畫面、箭頭、規格板節數），加一句「重跑會覆蓋」。
- 使用者反覆改細節是常態（欄位位置、有無底圖、兩行或一行）：每次都同步 HTML＋plugin，截圖確認再回，不要只改一邊。
- PM 文字與畫面矛盾時，問使用者哪個為準，結果與日期寫進 SPEC 與規格 md。

## 檔案

- `assets/plugin-template/manifest.json`、`code.js` — 可直接在 mock 跑通的範本（含 helper 與最小示例）
- `scripts/mock-figma.mjs` — 本機 Figma API mock，抓 API 誤用
- `references/figma-plugin-api-gotchas.md` — 實機踩過的 14 條坑
- `references/component-conventions.md` — 元件命名／屬性慣例、原型拆元件的順序
- `references/verify-and-calibrate.md` — mock、headless 截圖、實機字級換算、Figma 端驗證
