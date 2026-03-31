# Slide Engine V3 — 重構設計 Spec

> Date: 2026-03-27
> Status: Draft
> Author: Claude Code + Cyclone

## 問題摘要

Slide Engine V2 有以下致命問題：

1. **不縮放** — 所有字體用固定 px，不隨螢幕大小等比放大縮小
2. **CSS class 衝突** — variant 名稱（如 `stats-row`）與 layout class 撞名，導致 `display: flex` 覆蓋 `display: none`，整個導航壞掉
3. **大量空白** — 大多數 slide type 用 `justify-content: flex-start`，內容擠在頂部，下半頁空白
4. **主題字型不完整** — 24 個主題中多數只有英文字型，缺乏中文字型支援
5. **內容密度低** — AI prompt 沒有限制，容易產出 25 頁灌水投影片

## 設計目標

- 匯出的 HTML 在任何螢幕上看起來一致（如向量圖等比縮放）
- 主題切換後顏色、字型、風格都有明顯差異
- 內容均勻分佈在 slide 上，不留大面積空白
- 自包含 HTML（一個檔案，無外部相依除了 Google Fonts CDN）

---

## 架構變更

### 1. 固定畫布 + transform: scale()

採用 reveal.js 同款架構：

- **設計解析度**: `1280 × 720` px（16:9 HD）
- **所有尺寸**（字體、padding、margin）都用固定 px，在 1280×720 座標系內設計
- **JS 縮放**: `Math.min(viewportW / 1280, viewportH / 720)` 計算 scale factor
- **CSS transform**: `transform: translate(-50%, -50%) scale(${factor})` 置中並縮放
- **Letterboxing**: 螢幕比例不同時自動出現黑邊（或背景色），slide 內容不變形

**HTML 結構變更：**

```html
<!-- V2 (現有) -->
<div class="slide-deck">
  <div class="slide active">...</div>
  <div class="slide">...</div>
</div>

<!-- V3 (新) -->
<div class="viewport">
  <div class="slide-deck">
    <div class="slide active">...</div>
    <div class="slide">...</div>
  </div>
</div>
```

**CSS 核心：**

```css
html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
.viewport {
  width: 100vw; height: 100vh;
  position: relative; overflow: hidden;
}
.slide-deck {
  width: 1280px; height: 720px;
  position: absolute; left: 50%; top: 50%;
  transform-origin: center center;
  /* transform 由 JS 動態設定 */
}
.slide {
  width: 1280px; height: 720px;
  position: absolute; top: 0; left: 0;
  display: none; overflow: hidden;
}
.slide.active { display: flex; }
```

**Nav JS 新增 resize handler：**

```javascript
const SLIDE_W = 1280, SLIDE_H = 720;
const deck = document.querySelector('.slide-deck');

function rescale() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const scale = Math.min(vw / SLIDE_W, vh / SLIDE_H);
  deck.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
}

window.addEventListener('resize', rescale);
rescale(); // initial
```

**影響範圍：** `slide-engine-css.ts`、`slide-engine-nav.ts`、`presentations-utils.ts`

---

### 2. CSS Class 衝突修復

**問題：** slide element 的 class 包含 variant 名稱，與內部 layout class 撞名。

| 衝突 class | 在 slide 上的效果 | 修復方式 |
|-----------|---------------|--------|
| `stats-row` | `display: flex` 覆蓋 `display: none` | selector 改為 `.slide-inner .stats-row` |
| `big-number` | `text-align: center; padding: 40px 0` 加到 slide | selector 改為 `.slide-inner .big-number` |

**全面修復策略：** 所有 slide 內部 layout class 的 CSS selector 都加上 `.slide-inner` 前綴或使用更精確的 selector，確保不會影響 `.slide` 元素本身。

涉及的 class 清單（需加 parent selector）：
- `.stats-row` → `.dataviz-inner > .stats-row`
- `.big-number` → `.dataviz-inner > .big-number`
- `.comparison-grid` → `.dataviz-inner > .comparison-grid`
- `.cards-grid` → `.story-cards-inner > .cards-grid`
- `.columns` → `.two-column-inner > .columns`

---

### 3. 內容垂直分佈改善

**問題：** content、two-column、dataviz、story-cards 都用 `justify-content: flex-start`，導致內容擠在頂部。

**修復策略：**

```css
/* 通用 slide-inner：內容垂直居中 */
.slide-inner {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  padding: 48px 64px;
  justify-content: center;  /* 預設居中 */
  gap: 24px;
}

/* 有標題的 slide：標題在上，內容區域用 flex: 1 撐滿 */
.content-inner, .dataviz-inner, .story-cards-inner, .two-column-inner {
  justify-content: flex-start;
  padding-top: 56px;
}

/* 內容區域用 flex: 1 + 自身 justify-content 來分佈 */
.content-list, .cards-grid, .columns, .stats-row, .comparison-grid {
  flex: 1;
  display: flex;
  align-content: center;
}
```

核心原則：**標題固定在頂部，內容區域用 `flex: 1` 佔滿剩餘空間並居中。**

---

### 4. 字型系統升級

**問題：** mckinsey 等主題用 `Georgia, serif` / `Arial, sans-serif`，無中文字型。

**修復：** 每個主題的 `fonts` 都加上中文 fallback，並確保 `googleFontsUrl` 載入對應字型。

**推薦的 Google Fonts 中文字型組合（全部 SIL OFL）：**

| 用途 | 字型 | Google Fonts 名稱 |
|------|------|-----------------|
| 黑體標題/內文 | 思源黑體 | `Noto Sans TC` |
| 宋體/正式 | 思源宋體 | `Noto Serif TC` |
| 現代專業 | 昭源黑體 | `Chiron Hei HK` |
| 手寫楷書 | 霞鶩文楷 | `LXGW WenKai TC` |
| 圓體活潑 | jf open 粉圓 | `Huninn` |

**主題字型升級策略：**

- **consulting 類（mckinsey, bcg, deloitte, accenture）**: heading 加 `Noto Sans TC`，body 加 `Noto Sans TC`
- **startup 類**: 保持現有英文字型 + fallback `Noto Sans TC`
- **modern/creative 類**: 保持現有 + fallback `Noto Sans TC`
- **education 類（classroom）**: 改用 `Huninn`（粉圓）標題 + `Noto Sans TC` 內文
- **asian 類（takahashi, zen）**: 已有 Noto Sans/Serif TC，維持
- **institutional 類**: 加 `Noto Sans TC` fallback

**font-family 格式範例：**

```
heading: "'Georgia', 'Noto Serif TC', serif"
body: "'Arial', 'Noto Sans TC', sans-serif"
```

**googleFontsUrl 都要包含中文字型：**

```
https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=Georgia...&display=swap
```

---

### 5. 排版微調（在 1280×720 畫布上）

**字型大小（固定 px，會隨畫布等比縮放）：**

| 元素 | V2 大小 | V3 大小 | 備註 |
|------|--------|--------|------|
| h1 (cover) | 72px | 56px | 畫布小了，比例上更大 |
| h2 | 44px | 36px | |
| h3 | 28px | 24px | |
| body/li | 20px | 18px | |
| subtitle | 28px | 22px | |
| badge | 14px | 12px | |
| stat-value | 80px | 64px | |
| big-value | 120px | 88px | |
| quote-text | 32px | 28px | |
| footnote | 16px | 13px | |

**Padding：**

| 元素 | V2 | V3 | 備註 |
|------|-----|-----|------|
| .slide-inner | 60px 80px | 48px 64px | 1280×720 比例下更適合 |
| cover | 80px | 64px | |

---

### 6. Bullet 風格升級

**現有：** 純文字 `<li>` 列表，視覺單調。

**V3：** 改為卡片式 bullet（類似雷蒙風格），有左邊色條：

```css
.content-list li {
  padding: 14px 20px;
  margin-bottom: 8px;
  border-left: 3px solid var(--slide-accent);
  background: var(--slide-card-bg);
  border-radius: 6px;
  font-size: 18px;
  line-height: 1.5;
}
```

這會讓每個 bullet point 看起來像一張小卡片，比純文字更有設計感。

---

### 7. 導航 UI 調整

導航元素也要適配 1280×720 畫布：

- nav-bar、nav-title、progress-bar 改為放在 `.slide-deck` 內部（隨畫布縮放）
- 或保持在 viewport 層級（不縮放），但用較小的固定尺寸

**建議：** 導航放在 viewport 層級（不縮放），因為使用者操作的 UI 不應該隨簡報縮放。

---

### 8. 來源檔案讀取（已修復）

**V2 問題：** Claude CLI subprocess 用 Read tool 讀檔，Google Drive 中文路徑導致失敗。

**V3（已在本 session 修復）：** Server 端用 `readFile()` 預讀檔案內容，直接嵌入 prompt。不再依賴 Claude CLI 的檔案存取能力。

---

## 變更檔案清單

| 檔案 | 變更類型 | 說明 |
|------|--------|------|
| `slide-engine-css.ts` | **重寫** | 固定畫布 CSS、class 衝突修復、垂直分佈、字型大小、卡片 bullet |
| `slide-engine-nav.ts` | **重寫** | 加入 rescale()、resize listener、viewport 結構 |
| `presentations-utils.ts` | **修改** | HTML 結構加 `.viewport` wrapper |
| `presentation-themes.ts` | **修改** | 24 個主題加中文字型 fallback + googleFontsUrl |
| `slide-templates.ts` | **小改** | 確認 template output 不依賴衝突 class |
| `slide-preview.tsx` | **可能調整** | iframe srcDoc 結構可能需配合 viewport |

---

## 不變的部分

- **8 種 slide type + variants** — 維持不變
- **Store 結構** — `SlideOutline`、`SlideContent` 等 type 不變
- **API routes** — generate/refine 的 prompt 和 parsing 邏輯不變
- **大綱編輯器、縮圖列表、layout picker** — 不變

---

## 驗收標準

1. 匯出 HTML 在 1366×768、1920×1080、2560×1440 三種解析度下看起來等比縮放一致
2. 所有 24 個主題切換後顏色和字型都有可見差異
3. 選 stats-row 類型後，其餘頁面正常顯示（class 衝突已修復）
4. 內容頁不出現超過 40% 的空白區域
5. 中文字型正確載入顯示（Google Fonts CDN）
6. 從 Google Drive 選擇 .md 來源能成功生成簡報
