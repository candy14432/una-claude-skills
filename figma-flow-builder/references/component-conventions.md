# 元件庫慣例與「原型 → 元件」拆法

## 命名與結構（CMoney 處置神器元件庫慣例，使用者 2026-07 定案）

1. **全部英文命名**，加命名空間：`<ns>/<name>`（如 `dualblade/title-bar`）。變體屬性也英文：`state=on|off`、`tone=up|down|neutral`、`level=none|warning|locked|released`、`type=add|remove`。
2. **單一樣式用斜線路徑**，不硬做 variants：`dualblade/tag/notice`。
3. **只差文字或顏色的不另建元件**：一個 set ＋ TEXT 屬性（`Value`、`Label`），各處用 `restyle()` 覆寫字級。
4. **可有可無的元素用 BOOLEAN 控 visible**（`Show prev arrow`、`Show count`），不要為了有／無把變體數翻倍。
5. **組合元件全部用 nested instance 組裝**（列 = 股名格 + 狀態格 + 數值格 + 星號），狀態靠切 nested 變體＋改字，組合元件本身不做狀態變體。
6. 變體集開垂直 auto-layout（`variants()` 已做），元件庫板用 wrap 的橫向 auto-layout，一眼看得到全部。
7. 字型 PingFang TC 優先，退 Noto Sans TC → Inter；字重只用 Regular／Medium／Semibold 三檔。
8. 顏色一律綁變數：同名沿用檔案既有變數（`assistBasic*`、`primary`、`basicText`），新色放進同一個集合；半透明用 `name/NN` alpha 變數。
9. 不要動既有元件庫裡別人的元件；要用它們（如 `asset/icon`）就 `getNodeByIdAsync` 拿來 `createInstance`。
10. 改名安全：instance 綁元件 id 不綁名稱，改 set／變體／屬性名不會斷 instance。

## 從 HTML 原型拆元件的順序

1. **先列畫面清單**（原型每個 `.screen`／狀態＝一張），決定要幾張、每張叫什麼（`01 清單初始`、`02 已收藏 1 組`…）。
2. **再列原子元件**：在多張畫面重複出現、或同一畫面重複多列的東西——狀態列、標題列、分頁、表頭、列、數值、星號、徽章、按鈕、彈窗、空狀態、搜尋框。
3. **每個原子決定「靠什麼變」**：
   - 換字 → TEXT 屬性
   - 有／無 → BOOLEAN
   - 外觀不同（顏色、圖示、結構）→ 變體
   - 只是字級不同 → 同一元件，用 `restyle()`
4. **組合元件**（列、頁首、表格）用 nested instance；資料填入用 `setText / setNested / nested`。
5. **畫面 = `screen()` + 一串 instance**，示意資料集中放在 `[PROJECT] 資料` 區，畫面函式吃參數（`listScreen(name, { stars, count, modal })`），同一函式產出多個狀態。
6. **UI Flow 的箭頭 = 原型裡每一個會 `showOnly()`／跳頁的事件**，標籤寫觸發條件（「點空心星」「儲存 → 星號填黃」「返回 → 回比較頁」）。

## 數值對齊原型

原型 CSS 的 px 直接搬（390 寬、字級、padding、欄寬、列高、圓角、線色）。改了原型就改 plugin，反過來也一樣；README 要寫明「兩邊同步」。欄寬用陣列常數（`LCOLS = [57, 76, …]`）讓表頭與列共用。
