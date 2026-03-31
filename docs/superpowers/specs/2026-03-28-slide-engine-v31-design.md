# Slide Engine V3.1 Design Spec

> V3 基礎上的視覺升級 + 動畫系統 + 使用者控制

## 背景

V3（commit a36ba92）完成固定畫布 1280×720 + transform:scale() 等比縮放。使用者測試後提出改進需求，歸納為 4 大項（拖拉排序已在 V3 完成）。

## 分批策略

**Batch 1（Visual）**：Theme personality + Glass toggle + Custom params + 響應式佈局
**Batch 2（Animation）**：Animation system + Presentation mode

## 設計決策摘要

| 決策 | 選擇 | 理由 |
|------|------|------|
| 分批順序 | Visual first | CSS 改動不動架構；動畫需要好主題才有效果 |
| 主題差異化 | 完整性格（佈局+裝飾+卡片） | 使用者要求每個主題有明顯不同 |
| 玻璃擬態 | 使用者可切換（glass/solid） | 有些場合需要正式（實色），有些要現代感（玻璃） |
| 自訂參數 | 主題預設 + 滑桿精細覆寫 | 多數時候用預設，需要時能微調 |
| 演示模式 | 自動播放 + 手動控制兩種 | 分享連結 vs 站台報告場景不同 |
| 動畫強度 | 使用者可選 4 檔 + 每張 slide 獨立設定 | 預設智慧分配不同動畫，可個別調整 |
| 畫布內佈局 | 改用相對單位 + clamp() | 解決內容少時底部/右邊空白的問題 |

---

## Batch 1: Visual Upgrade

### 1.1 響應式畫布內佈局

保持 1280×720 固定畫布 + transform:scale()，但內部 CSS 改用相對單位。

**改動原則**：

| 現有 | 改為 | 目的 |
|------|------|------|
| `font-size: 48px` | `font-size: clamp(32px, 3.75%, 56px)` | 字體隨畫布比例（% 相對於 .slide-inner 寬度） |
| `padding: 60px` | `padding: 5%` | 間距相對化 |
| `gap: 24px` | `gap: 2%` | 元素間距相對化 |
| 固定高度卡片 | `flex: 1; min-height: 0` | 自動撐滿可用空間 |
| 內容靠上對齊 | `justify-content: center` | 垂直置中分佈 |

**技術方案**：
- `.slide-inner` 使用 `display: flex; flex-direction: column; justify-content: center; height: 100%`
- 多欄佈局用 CSS Grid `fr` 單位等分
- `clamp()` 的基準值可被 CustomParams 的 scale 值調整
- 匯出的 HTML 在任何螢幕打開都能自適應

### 1.2 Theme Personality System

在 `PresentationTheme` 加入 `personality` 屬性，透過 CSS variables 實現差異化。

**介面定義**：

```typescript
interface ThemePersonality {
  // 佈局
  titleAlign: 'center' | 'left' | 'top-left';
  contentDensity: 'compact' | 'normal' | 'spacious';

  // 卡片風格
  borderRadius: number;        // 0 (方正) ~ 24 (圓潤)
  shadowDepth: 'none' | 'subtle' | 'medium' | 'heavy';
  borderStyle: 'none' | 'thin' | 'thick' | 'accent-left';

  // 裝飾元素
  decorations: {
    titleUnderline: 'none' | 'thin' | 'thick' | 'accent-gradient';
    sectionDivider: 'none' | 'line' | 'dots' | 'geometric';
    accentShape: 'none' | 'circle' | 'square' | 'triangle' | 'wave';
  };

  // 卡片預設風格
  cardEffect: 'solid' | 'glass';
}
```

**24 個主題的 personality 分配**：

| 主題 | titleAlign | borderRadius | shadow | border | decoration | cardEffect |
|------|-----------|-------------|--------|--------|------------|------------|
| McKinsey | left | 2 | subtle | thin | thin underline | solid |
| BCG | left | 4 | subtle | accent-left | thin underline | solid |
| Deloitte | left | 4 | medium | thin | thick underline | solid |
| Accenture | left | 6 | subtle | thin | accent-gradient underline | solid |
| YC Minimal | left | 8 | none | none | none | solid |
| Sequoia | left | 4 | subtle | thin | thin underline | solid |
| Dark Tech | center | 12 | medium | thin | geometric | glass |
| Glass | center | 16 | none | thin | accent-gradient underline | glass |
| Bento | left | 12 | subtle | thin | line divider | solid |
| Neobrutalism | left | 0 | heavy | thick | geometric | solid |
| Editorial | left | 2 | none | none | thick underline | solid |
| Swiss | center | 0 | none | thin | line divider | solid |
| Soft | center | 20 | subtle | none | none | solid |
| Monochrome Bold | center | 4 | medium | thick | none | solid |
| Dashboard | left | 8 | medium | thin | line divider | glass |
| Infographic | center | 12 | subtle | none | dots divider | solid |
| Academic | left | 4 | subtle | thin | thick underline | solid |
| Classroom | left | 12 | subtle | accent-left | dots divider | solid |
| Takahashi | center | 0 | none | none | none | solid |
| Zen | center | 12 | none | none | dots divider | solid |
| Gov Official | left | 4 | subtle | thin | thick underline | solid |
| Trust | left | 8 | subtle | accent-left | thin underline | solid |
| Aurora | center | 20 | medium | none | wave | glass |
| Noir | center | 8 | medium | thin | thin underline | solid |

**CSS 實現**：

`buildCSS()` 將 personality 屬性注入為 CSS variables：

```css
:root {
  --slide-title-align: left;
  --slide-border-radius: 2px;
  --slide-shadow: 0 1px 3px rgba(0,0,0,0.1);
  --slide-border: 1px solid rgba(0,0,0,0.1);
  --slide-card-radius: 2px;
}
```

裝飾元素用 `::before` / `::after` pseudo-elements 實現：

```css
/* accent-gradient underline */
.slide h2::after {
  content: '';
  display: block;
  width: 60px;
  height: 3px;
  background: linear-gradient(90deg, var(--slide-accent), var(--slide-secondary));
  margin-top: 12px;
}

/* geometric accent — 半透明三角形裝飾 */
.decor-geometric .cover .slide-inner::before {
  content: '';
  position: absolute;
  top: -40px;
  right: -40px;
  width: 200px;
  height: 200px;
  background: var(--slide-accent);
  opacity: 0.08;
  clip-path: polygon(100% 0, 0 0, 100% 100%);
}

/* wave accent — 底部波浪線 */
.decor-wave .slide-inner::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 6px;
  background: linear-gradient(90deg, var(--slide-accent), var(--slide-secondary), var(--slide-accent));
  border-radius: 3px;
}

/* dots section divider */
.decor-dots .slide h2::after {
  content: '● ● ●';
  display: block;
  font-size: 8px;
  letter-spacing: 6px;
  color: var(--slide-accent);
  margin-top: 12px;
}
```

### 1.3 Glass Toggle

**資料結構**：

```typescript
// SlideSettings（存在 PresentationSession 上）— 完整定義
interface SlideSettings {
  cardStyle: 'solid' | 'glass';                                      // Batch 1
  customParams: CustomParams;                                         // Batch 1
  animationLevel: 'none' | 'subtle' | 'moderate' | 'dynamic';       // Batch 2
}
```

**CSS 實現**：

```css
/* Glass mode */
.card-glass .story-card,
.card-glass .stat-card,
.card-glass .quote-card,
.card-glass .content-card {
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* Dark theme glass */
.card-glass.dark .story-card {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

/* Light theme glass */
.card-glass.light .story-card {
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(12px);
}
```

在 `outlineToHtml()` 組裝時，根據 `cardStyle` 在 `.slide-deck` 上加 class：
`<div class="slide-deck card-glass dark">` 或 `<div class="slide-deck card-solid light">`

### 1.4 Custom Parameters UI

**資料結構**：

```typescript
interface CustomParams {
  titleScale: number;    // 0.8 ~ 1.4, step 0.05, 預設 1.0
  bodyScale: number;     // 0.8 ~ 1.4
  cardScale: number;     // 0.8 ~ 1.4
  spacingScale: number;  // 0.8 ~ 1.4
}
```

**Scale 如何影響 CSS**：

`buildCSS()` 將 scale 值乘入 clamp 的基準：

```css
/* titleScale = 1.2 時 */
.slide h2 {
  font-size: clamp(38px, 4.5%, 67px);  /* 基準 × 1.2 */
}
```

注意：`%` 在 font-size 中相對於父元素寬度（`.slide-inner`），而 `.slide-inner` 寬度固定為 1280px 減去 padding。因此 `3.75%` ≈ 48px（基準），乘上 scale 後動態計算 clamp 的三個值。`buildCSS()` 在生成時直接計算好像素值，不依賴瀏覽器計算。

**UI 位置**：

Workstation 左側面板 → 新增「樣式調整」折疊區（在 theme selector 下方）：

```
┌─ 樣式調整 ──────────────────┐
│ 卡片風格：  [實色] [玻璃]    │
│                              │
│ 標題大小    ──●──────────    │  80% ← → 140%
│ 內文大小    ────●────────    │
│ 卡片大小    ────●────────    │
│ 間距        ──────●──────    │
│                              │
│ [↺ 重設為主題預設]           │
└──────────────────────────────┘
```

滑桿改值 → 即時更新 iframe srcDoc → 預覽立刻反映。

---

## Batch 2: Animation System + Presentation Mode

### 2.1 動畫強度（全域）

（SlideSettings 完整定義見 1.3 節，animationLevel 在 Batch 2 加入）

| 等級 | entrance | fragment | 時間 |
|------|----------|----------|------|
| `none` | 無 | 全部立即顯示 | 0ms |
| `subtle` | 淡入 | opacity only | 300ms, delay +100ms |
| `moderate` | 淡入 | opacity + translateY(8px) | 400ms, delay +150ms |
| `dynamic` | 淡入 | opacity + translateY(20px) + 標題打字機 | 500ms, delay +200ms |

CSS 實現：

```css
/* 基礎（hidden state） */
.anim-subtle .fragment,
.anim-moderate .fragment,
.anim-dynamic .fragment {
  opacity: 0;
  transition: opacity var(--anim-duration) ease,
              transform var(--anim-duration) ease;
}

/* moderate/dynamic 加位移 */
.anim-moderate .fragment,
.anim-dynamic .fragment {
  transform: translateY(var(--anim-translate));
}

/* 可見狀態 */
.fragment.visible {
  opacity: 1;
  transform: translateY(0);
}

/* 每個 fragment 遞增 delay */
.fragment:nth-child(1) { transition-delay: 0ms; }
.fragment:nth-child(2) { transition-delay: var(--anim-stagger); }
.fragment:nth-child(3) { transition-delay: calc(var(--anim-stagger) * 2); }
/* ... */
```

### 2.2 每張 Slide 獨立動畫

```typescript
interface SlideContent {
  // ...existing fields...
  animation?: {
    entrance: 'fade' | 'slide-up' | 'slide-left' | 'zoom' | 'typewriter';
    fragmentStyle: 'fade' | 'slide-up' | 'slide-left' | 'flip';
    speed: 'slow' | 'normal' | 'fast';
  };
}
```

**智慧預設**（AI 生成時自動分配）：

| Slide Type | entrance | fragmentStyle |
|-----------|----------|---------------|
| cover | zoom | fade |
| section-divider | slide-left | fade |
| content (bullets) | fade | slide-up |
| two-column | fade | slide-left |
| dataviz (bars) | fade | slide-up (bar grow) |
| quote | fade | typewriter |
| story-cards | fade | zoom |
| closing | fade | fade |

每張 slide 的 animation 設定透過 `data-*` 屬性傳遞：

```html
<div class="slide cover" data-entrance="zoom" data-fragment="fade" data-speed="normal">
```

nav JS 讀取 `data-*` 屬性決定該頁的動畫行為。

### 2.3 Presentation Mode

**兩種模式**：

| | Browse（瀏覽） | Present（演示） |
|--|---------------|----------------|
| 觸發 | 預設模式 | 點擊 `[▶ 演示]` 按鈕 |
| 全螢幕 | 否 | 是（requestFullscreen） |
| Fragment | 進入 slide 後自動依序播放 | 每次按鍵推進一個 fragment |
| 進度顯示 | 頁碼 | 頁碼 + fragment 進度 (3/5) |
| 退出 | — | ESC 回到瀏覽模式 |

**導航列 UI**：

```
瀏覽模式：[◀] [▶]  第 3 / 8 頁                    [▶ 演示]
演示模式：[◀] [▶]  第 3 / 8 頁  ● ● ● ○ ○ (3/5)   [✕ 退出]
```

**模式切換架構**：

```typescript
// Workstation → iframe 通訊
iframe.contentWindow.postMessage({ setMode: 'present' }, '*');
iframe.contentWindow.postMessage({ setMode: 'browse' }, '*');

// iframe 內部
let mode: 'browse' | 'present' = 'browse';

function handleKeydown(e) {
  if (mode === 'browse') {
    // 按鍵 → 換頁（現有邏輯）
    // fragment 自動播放
  } else {
    // 按鍵 → 推進 fragment
    // fragment 全部顯示後 → 下一頁
  }
}

window.addEventListener('message', (e) => {
  if (e.data.setMode) {
    mode = e.data.setMode;
    if (mode === 'present') document.documentElement.requestFullscreen();
    if (mode === 'browse') document.exitFullscreen();
  }
});
```

**瀏覽模式自動播放機制**：

進入新 slide 時，nav JS 用 `setTimeout` 依序觸發每個 fragment 的 `.visible`：

```javascript
function autoRevealFragments(slide) {
  const fragments = slide.querySelectorAll('.fragment');
  const stagger = getComputedStyle(slide).getPropertyValue('--anim-stagger');
  fragments.forEach((frag, i) => {
    setTimeout(() => frag.classList.add('visible'), i * parseInt(stagger));
  });
}
```

---

## 影響的檔案

### Batch 1
| 檔案 | 改動 |
|------|------|
| `presentation-themes.ts` | 每個主題加 `personality` 屬性 |
| `slide-engine-css.ts` | 相對單位重寫 + personality CSS vars + glass CSS + custom scale |
| `presentations-utils.ts` | `outlineToHtml()` 接收 `SlideSettings`，注入 card-style class |
| `presentations-workstation.tsx` | 左面板加「樣式調整」UI |
| `presentations-store.ts` | `PresentationSession` 加 `SlideSettings` |

### Batch 2
| 檔案 | 改動 |
|------|------|
| `slide-engine-css.ts` | 動畫 CSS（entrance + fragment transitions） |
| `slide-engine-nav.ts` | browse/present 模式切換 + fragment 推進邏輯 |
| `slide-templates.ts` | 每張 slide 加 `data-entrance`/`data-fragment`/`data-speed` |
| `presentations-utils.ts` | 傳遞 animationLevel + per-slide animation 設定 |
| `presentations-workstation.tsx` | 演示按鈕 + 每張 slide 動畫設定 UI |
| `slide-preview.tsx` | postMessage 控制模式切換 |

---

## 不做的事

- 講者備註 / 計時器 — 超出 V3.1 範圍
- 觸控手勢 / 滑動 — 未來再考慮
- Slide transition（頁間過場）— 只做 fragment 動畫，頁間保持即時切換
- 影片匯出 — 只匯出 HTML
- 3D 圖表 / sparkline — dataviz 維持現有類型
