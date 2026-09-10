---
name: tailwind-css
description: 通用的 Tailwind CSS 最佳實踐與寫法規範，適用任何使用 Tailwind 的前端專案。當要寫或改 className / 樣式、調色、排版、做元件、設計 token、處理深淺主題或響應式、產生 Storybook 視覺時使用。強調 token 優先、禁寫死值、複用元件 class、無障礙；專案專屬規則以該專案的設計系統文件為準。
---

# Tailwind CSS 寫法規範（通用）

適用任何 Tailwind 專案。**先讀專案自己的設計系統**（若有），它優先於本通用規範：

1. 找 `tailwind.config.{js,ts}` → 看 `theme.extend` 定義了哪些 token（colors / fontFamily / spacing / borderRadius …）。
2. 找設計系統文件（常見：`design-system/TOKENS.md`、`DESIGN_PRINCIPLES.md`、`.cursor/rules/*.mdc`、`CLAUDE.md`）。
3. 找全域 CSS（`@tailwind` 指令所在，通常 `main.css` / `globals.css` / `index.css`）看 CSS 變數與 `@layer components` 既有 class。
4. 沒有上述文件時，才套用下方通用原則。

## 核心鐵則

1. **用 token，不寫死值**。優先用設定好的語意 class（`bg-card`、`text-primary`），其次標準 scale（`p-4`、`text-sm`）。
   - ✅ `className="bg-surface text-secondary rounded-lg"`
   - ❌ `className="bg-[#1b1b1b] text-[#888] rounded-[10px]"`（arbitrary value 只在一次性、無對應 token 時才用）
2. **顏色集中管理**。新顏色加進 `tailwind.config` 或 CSS 變數，不散落在 className。深淺主題的色要同時備兩套值。
3. **語意化命名 token**，不要用色相命名。用 `primary`/`danger`/`surface`，不要 `blue-500`/`red`——換色時才不用全站改。
4. **複用既有 component class / 元件**，不重造。先翻 `@layer components` 和現有元件再決定要不要新增。
5. **響應式 mobile-first**：先寫小螢幕，再用 `sm: md: lg:` 往上加。
6. **無障礙**：正文 ≥16px、對比 ≥4.5:1、互動目標 ≥44px、尊重 `prefers-reduced-motion`、focus 樣式不可拿掉。

## 主題（深 / 淺色）

- 用 CSS 變數承載色值，Tailwind token 指向變數（`rgb(var(--color-x) / <alpha-value>)` 可支援透明度修飾如 `bg-card/60`）。
- 主題切換用 class / data 屬性（`dark:` 或自訂 `[data-theme]` selector）。**設定好變數後，token class 會自動跟著主題變**，不必到處寫 `dark:`；只有需要分支時才用變體。
- 深色 UI 用**亮度**分層（card 比 page 亮）＋一條淡邊框即可；深色底大陰影會糊，別靠陰影分層。

### ⚠️ 深色模式頭號陷阱：繼承色的文字會「消失」

若主題 class 掛在 `<body>` **裡面**的 `<div>`，那 `body { color: var(--color-fg) }` 仍解析成**淺色**值——任何只靠**繼承**取色的文字就變暗底暗字、直接看不見。兩道防線一起用：

1. 把基礎文字色掛在**主題容器本身**（root div 給 `class="text-fg theme-dark"`），讓子孫繼承到已解析的值。
2. 文字仍給**明確**顏色 class——尤其裸 `<b>`/`<span>`、清單項、以及 modal / dropdown / portal 裡的東西。別信任繼承。

每個深色畫面都自問：有沒有讀不到的字？modal、下拉、表格格、空狀態是常見兇手。

## 整理 className 的習慣

- 順序大致：佈局 → 盒模型 → 排版 → 視覺 → 狀態/變體（`hover: focus: dark: sm:`）。
- className 太長、或同組合重複 3+ 次 → 抽成元件，或 `@layer components` 的 class（用 `@apply`）。
- 用 `clsx` / `cn()` 處理條件 class，不要字串拼接一堆三元運算。
- 不要 `@apply` 一長串把 Tailwind 當 CSS 寫——失去 utility 意義；元件化更好。

## 元件配方（重複 3+ 次就抽成這些）

- **Button**：variants（`primary` 實心／漸層強調、`secondary` 描邊、`ghost` 透明），一套尺寸，`rounded-xl`，可見的 `focus-visible:ring-2 ring-brand-500`，按壓回饋 `active:scale-[0.98]`；停用 `disabled:opacity-40 disabled:cursor-not-allowed`。
- **Card**：`rounded-2xl border border-border bg-surface shadow-card`。用 padding／陰影分強弱，別靠染背景色。
- **Badge / Chip**：柔和 tonal 填色（`bg-brand-50 text-brand-600`）、小圓角、克制。選取態的邊框用半透明強調色（`border-brand-500/35`）勝過亮實色——亮邊在深色會刺眼。
- **Input**：一致高度、`border border-border bg-surface`、`focus:border-brand-500` 或 focus ring；**永不拿掉 focus 樣式**。
- 巢狀圓角：內圈 ≈ 外圈 − padding（同心），否則轉角會歪。

## 數字與動態

- **會變動或要對齊的數字一律 `tabular-nums`**（價格、計數、表格格），等寬字位不跳動。
- 動畫**指定屬性**：`transition-[transform,color,background-color]`，**別用 `transition-all`**——它會animate layout 屬性造成 jank，也吃掉 GPU 合成。尊重 `motion-reduce:`。
- 顏色不作唯一資訊（配 icon／文字）；紅／綠只留給真正的負／正、跌／漲。

## 常見雷

- arbitrary value 濫用（`w-[327px]`、`text-[#abc]`）→ 多半該用 token 或標準 scale。
- 動態拼 class（`` `text-${color}-500` ``）→ Tailwind 掃不到、會被 purge 掉；改用完整 class 對照表。
- `transition-all`、拿掉 focus outline 不補替代。
- 直接改第三方/全域樣式而非用 token。
- 忘了深色或響應式分支，或深色畫面有繼承色文字看不見。

## 自我檢查

- [ ] 有先讀專案的 tailwind.config 與設計系統文件
- [ ] 沒寫死 hex / 任意 px（除非真的一次性無 token）
- [ ] 用語意 token，不是色相名
- [ ] 深淺主題、響應式都顧到；深色畫面沒有繼承色看不見的文字
- [ ] 複用了既有元件 / component class，沒重造
- [ ] focus / 對比 / 觸控尺寸符合無障礙
- [ ] 會變動 / 要對齊的數字有 `tabular-nums`；動畫沒用 `transition-all`
