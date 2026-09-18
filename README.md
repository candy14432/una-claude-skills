# una-claude-skills

Claude Code 的 UI / UX 設計方法論 skill 收藏，涵蓋雙鑽流程、設計系統、
無障礙與 Tailwind 寫法規範。

> 授權與出處請見 [NOTICE.md](NOTICE.md)：多數內容為第三方 MIT skill 的重新散布。

## 內容

### 樣式與規範
| Skill | 用途 |
| --- | --- |
| `tailwind-css` | 通用 Tailwind 寫法規範：token 優先、禁寫死值、複用元件 class |
| `accessibility-design` | WCAG / a11y 檢查：對比度、鍵盤操作、語意化、螢幕閱讀器 |
| `design-system` | 設計系統、Design Tokens、元件規範與文件結構 |
| `ui-visual-design` | UI 視覺風格選擇與應用 |

### 雙鑽流程（Double Diamond）
| Skill | 階段 |
| --- | --- |
| `empathize` | 蒐集使用者洞察、訪談、人物誌背景 |
| `define` | 收斂洞察、界定問題、成功指標與限制條件 |
| `ideate` | 發散解法、線框、視覺方向探索 |
| `prototype` | 優選解法轉可操作原型，設定互動與狀態 |
| `test` | 規劃執行可用性測試，整理優先修正清單 |

### 研究與規劃方法
| Skill | 用途 |
| --- | --- |
| `user-interview` | 規劃與執行使用者訪談 |
| `persona-creation` | 研究資料整理成人物誌 |
| `usability-testing` | 可用性測試的規劃、執行與整理 |
| `information-architecture` | 資訊架構、內容層級、導航結構 |
| `wireframing` | 低至中保真線框圖 |
| `prototyping` | 可互動原型與互動流程說明 |

### Figma 產出
| Skill | 用途 |
| --- | --- |
| `figma-flow-builder` | 把 HTML 原型匯回 Figma：產生自寫 Figma plugin，一鍵建出變數、元件（variants／boolean／text 屬性）、UI Flow 與規格板；含本機 mock 驗證與 Plugin API 坑清單 |

### 實作片段
| Skill | 用途 |
| --- | --- |
| `loading-screen` | 載入 / splash / 進站畫面的設計與實作 |
| `waving-hand-animation` | 揮手動畫 |

## 安裝

全部安裝到全域（所有專案可用）：

```bash
git clone https://github.com/candy14432/una-claude-skills.git
cp -R una-claude-skills/*/ ~/.claude/skills/
```

只裝其中幾個：

```bash
cp -R una-claude-skills/tailwind-css ~/.claude/skills/
cp -R una-claude-skills/accessibility-design ~/.claude/skills/
```

裝到單一專案（只在該專案生效）：

```bash
mkdir -p your-project/.claude/skills
cp -R una-claude-skills/tailwind-css your-project/.claude/skills/
```

安裝後重開 Claude Code，用 `/tailwind-css`、`/accessibility-design` 等叫用，
或讓 Claude 依 description 自動判斷載入。
