# Slide Engine V3.1 Batch 2 — Animation System + Presentation Mode

> Design spec for Batch 2 implementation. Batch 1 (visual upgrade) already merged to main.

## Design Decisions Summary

| 決策 | 選擇 | 理由 |
|------|------|------|
| 實作策略 | CSS-Only Animation + JS Mode Switch | 硬體加速、最小 JS、完美延伸現有 buildCSS/buildNavJS 架構 |
| 匯出 HTML | 包含完整動畫 + 演示模式 | 獨立簡報工具，瀏覽器開就能用 |
| PDF 匯出 | @media print + window.print() | 靜態全展開，無需 server-side |
| 動畫設定 UI | StyleSettingsPanel 內 | 全域強度 + 選中 slide 的獨立設定，集中管理 |
| 編輯預覽 | 不播動畫 | 編輯流暢，動畫只在演示模式播放 |
| 動畫預設 | 前端 code 對照表 | slide type → animation，確定性邏輯，不靠 AI |
| Typewriter | 不實作 | 用 fade + slow stagger 模擬逐句效果更可靠 |

---

## 1. Data Model

### 1.1 SlideSettings 擴充（presentations-store.ts）

```typescript
interface SlideSettings {
  cardStyle: 'solid' | 'glass';           // Batch 1 — 已有
  customParams: CustomParams;              // Batch 1 — 已有
  animationLevel: 'none' | 'subtle' | 'moderate' | 'dynamic';  // Batch 2
}
```

Default: `animationLevel: 'moderate'`

### 1.2 SlideContent 擴充（per-slide animation override）

```typescript
interface SlideAnimation {
  entrance: 'fade' | 'slide-up' | 'slide-left' | 'zoom';
  fragmentStyle: 'fade' | 'slide-up' | 'slide-left' | 'flip';
  speed: 'slow' | 'normal' | 'fast';
}

interface SlideContent {
  // ...existing fields (id, type, order, title, body, etc.)
  animation?: SlideAnimation;  // undefined = use default for slide type
}
```

### 1.3 Animation Defaults（新檔案 slide-animation-defaults.ts）

```typescript
const ANIMATION_DEFAULTS: Record<SlideType, SlideAnimation> = {
  'cover':           { entrance: 'zoom',       fragmentStyle: 'fade',       speed: 'normal' },
  'section-divider': { entrance: 'slide-left', fragmentStyle: 'fade',       speed: 'normal' },
  'content':         { entrance: 'fade',       fragmentStyle: 'slide-up',   speed: 'normal' },
  'two-column':      { entrance: 'fade',       fragmentStyle: 'slide-left', speed: 'normal' },
  'dataviz':         { entrance: 'fade',       fragmentStyle: 'slide-up',   speed: 'normal' },
  'quote':           { entrance: 'fade',       fragmentStyle: 'fade',       speed: 'slow'   },
  'story-cards':     { entrance: 'fade',       fragmentStyle: 'zoom',       speed: 'normal' },
  'closing':         { entrance: 'fade',       fragmentStyle: 'fade',       speed: 'normal' },
};

function getSlideAnimation(slide: SlideContent): SlideAnimation {
  return slide.animation ?? ANIMATION_DEFAULTS[slide.type];
}
```

### 1.4 Store Actions（新增）

```typescript
setAnimationLevel(level: AnimationLevel): void
setSlideAnimation(slideId: string, animation: Partial<SlideAnimation>): void
resetSlideAnimation(slideId: string): void  // 移除 override，回歸 type 預設
```

---

## 2. CSS Animation System（slide-engine-css.ts）

### 2.1 Animation Level → CSS Variables

`buildCSS()` 根據 `animationLevel` 注入：

| Level | --anim-duration | --anim-translate | --anim-stagger | --anim-easing |
|-------|----------------|-----------------|----------------|---------------|
| none | 不注入動畫 CSS | — | — | — |
| subtle | 300ms | 0px（opacity only） | 100ms | ease |
| moderate | 400ms | 8px | 150ms | ease |
| dynamic | 500ms | 20px | 200ms | cubic-bezier(0.16, 1, 0.3, 1) |

### 2.2 Per-slide Speed Override

Speed 用 data attribute 覆寫 duration：

```css
[data-speed="slow"]  { --anim-duration: 600ms; --anim-stagger: 250ms; }
[data-speed="fast"]  { --anim-duration: 200ms; --anim-stagger: 80ms; }
/* "normal" 使用全域值 */
```

### 2.3 Fragment Hidden → Visible

```css
/* 只在 animationLevel != none 時注入 */
.slide.active .fragment {
  opacity: 0;
  transition: opacity var(--anim-duration) var(--anim-easing),
              transform var(--anim-duration) var(--anim-easing);
}

.slide.active .fragment.visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}
```

### 2.4 Fragment Styles（4 種）

```css
/* fade — 只 opacity */
[data-fragment="fade"] .fragment { transform: none; }

/* slide-up */
[data-fragment="slide-up"] .fragment { transform: translateY(var(--anim-translate)); }

/* slide-left */
[data-fragment="slide-left"] .fragment { transform: translateX(calc(var(--anim-translate) * -1)); }

/* flip */
[data-fragment="flip"] .fragment {
  transform: perspective(400px) rotateX(10deg);
  transform-origin: top center;
}
```

### 2.5 Entrance Animations（4 種 @keyframes）

作用在 `.slide.active .slide-inner`：

```css
@keyframes entrance-fade {
  from { opacity: 0; } to { opacity: 1; }
}
@keyframes entrance-slide-up {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes entrance-slide-left {
  from { opacity: 0; transform: translateX(-30px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes entrance-zoom {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.slide.active[data-entrance="fade"] .slide-inner      { animation: entrance-fade var(--anim-duration) var(--anim-easing); }
.slide.active[data-entrance="slide-up"] .slide-inner   { animation: entrance-slide-up var(--anim-duration) var(--anim-easing); }
.slide.active[data-entrance="slide-left"] .slide-inner { animation: entrance-slide-left var(--anim-duration) var(--anim-easing); }
.slide.active[data-entrance="zoom"] .slide-inner       { animation: entrance-zoom var(--anim-duration) var(--anim-easing); }
```

### 2.6 Fragment Stagger Delay

`buildCSS()` 生成 nth-child rules（最多 20 個）：

```css
.slide.active .fragment:nth-child(1) { transition-delay: 0ms; }
.slide.active .fragment:nth-child(2) { transition-delay: var(--anim-stagger); }
.slide.active .fragment:nth-child(3) { transition-delay: calc(var(--anim-stagger) * 2); }
/* ... nth-child(20) */
```

### 2.7 animationLevel = 'none'

不注入 2.3~2.6 的任何 CSS。Fragment 保持 `opacity: 1`（現有行為），無 entrance animation。零 overhead。

### 2.8 @media print（PDF 匯出）

```css
@media print {
  .viewport { transform: none !important; }
  .slide {
    page-break-after: always;
    break-after: page;
    position: relative !important;
    display: block !important;
  }
  .slide .fragment { opacity: 1 !important; transform: none !important; }
  .slide .slide-inner { animation: none !important; }
  .nav-bar, .nav-title, #progress-bar { display: none !important; }
}
```

---

## 3. HTML Template Changes（slide-templates.ts）

### 3.1 Data Attributes

`slideToHtml()` 從 `getSlideAnimation(slide)` 取得動畫設定，注入 data attributes：

```html
<div class="slide cover"
     data-index="0"
     data-entrance="zoom"
     data-fragment="fade"
     data-speed="normal">
  <div class="slide-inner cover-inner">
    <h1 class="fragment">Title</h1>
    <p class="fragment">Subtitle</p>
  </div>
</div>
```

改動範圍：只修改 `slideToHtml()` 函數開頭的 `<div class="slide ...">` 產生邏輯，加入 3 個 data attributes。Fragment 包裝（`frag()` helper）不變。

### 3.2 outlineToHtml() 傳遞

`outlineToHtml()` 需要把 `SlideSettings` 傳遞給 `slideToHtml()`，讓它能呼叫 `getSlideAnimation()`。如果 `animationLevel === 'none'`，不加 data attributes（讓 CSS 不作用）。

---

## 4. Navigation System（slide-engine-nav.ts）

### 4.1 Mode 變數

```javascript
let mode = 'browse';  // 'browse' | 'present'
```

### 4.2 Browse Mode（編輯預覽 + 匯出 HTML 預設）

切換到新 slide 時：
1. Entrance animation 由 CSS 自動觸發（`.slide.active` class 加上去，keyframe 跑一次）
2. **所有 fragment 立即加上 `.visible`**（與現有行為相同）
3. 沒有 stagger delay，沒有逐個顯示

原因：編輯時要快速預覽，不需要等動畫。匯出的 HTML 打開時也是 browse mode。

### 4.3 Present Mode（演示模式）

切換到新 slide 時：
1. Entrance animation 由 CSS 自動觸發
2. **Fragment 不自動顯示**，等待使用者操作
3. 每次按鍵（→ / Space / Enter / Click）推進一個 fragment
4. 所有 fragment 都 visible 後，下一次按鍵 → 下一頁
5. 按 ← 回上一頁（上一頁所有 fragment 已展開）

```javascript
function advancePresentation() {
  const currentSlide = slides[currentIndex];
  const hiddenFragments = currentSlide.querySelectorAll('.fragment:not(.visible)');

  if (hiddenFragments.length > 0) {
    hiddenFragments[0].classList.add('visible');
    updateFragmentProgress();
  } else {
    goToSlide(currentIndex + 1);
  }
}
```

### 4.4 Fragment Progress UI（演示模式專用）

```html
<span id="fragment-progress" style="display:none">
  <!-- "● ● ● ○ ○ (3/5)" -->
</span>
```

Present mode 時顯示，Browse mode 隱藏。每次 fragment advance 更新。

### 4.5 Mode Switch（postMessage）

```javascript
window.addEventListener('message', (e) => {
  if (e.data.setMode === 'present') {
    mode = 'present';
    // 重設當前 slide 的 fragment 狀態
    resetFragments(slides[currentIndex]);
    document.documentElement.requestFullscreen?.();
  }
  if (e.data.setMode === 'browse') {
    mode = 'browse';
    document.exitFullscreen?.();
    // 展開所有 fragment
    revealAllFragments(slides[currentIndex]);
  }
});

// ESC 退出全螢幕 → 自動回 browse
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && mode === 'present') {
    mode = 'browse';
    revealAllFragments(slides[currentIndex]);
    notifyParent({ modeChanged: 'browse' });
  }
});
```

### 4.6 Iframe → Parent 通訊（新增）

目前 postMessage 只有 parent → iframe。新增反向通訊：

```javascript
// iframe 通知 parent
function notifyParent(data) {
  window.parent?.postMessage(data, '*');
}

// 事件：
notifyParent({ modeChanged: 'browse' });     // 退出全螢幕時
notifyParent({ slideChanged: currentIndex }); // 換頁時（同步 outline selection）
```

---

## 5. Presentation Mode UI

### 5.1 Workstation 演示按鈕（slide-preview.tsx）

在 preview 區域右上角加「▶ 演示」按鈕：

```
┌─ Preview ──────────────────────────────────────┐
│                                    [▶ 演示]     │
│                                                  │
│             [ iframe ]                           │
│                                                  │
└──────────────────────────────────────────────────┘
```

點擊後：
1. `iframe.contentWindow.postMessage({ setMode: 'present' }, '*')`
2. Iframe 進入全螢幕 + present mode
3. 按鈕文字不需變（全螢幕時看不到 workstation）

ESC 退出全螢幕後，iframe 發送 `{ modeChanged: 'browse' }` 回 parent。

### 5.2 匯出 HTML 的演示按鈕

匯出的 HTML 沒有外層 workstation，需要內建演示按鈕。在 nav-bar 右側加：

```html
<button id="present-btn" onclick="enterPresent()">▶ 演示</button>
```

```
[◀] [▶]  第 3 / 8 頁                    [▶ 演示]
```

Present mode 時 nav-bar 變為：

```
[◀] [▶]  第 3 / 8 頁  ● ● ○ ○ (2/4)     [✕ 退出]
```

### 5.3 PDF 匯出按鈕

在 slide-preview.tsx 的匯出選項旁加「PDF」按鈕：

```typescript
// 在 iframe 內觸發 print
function exportPDF() {
  iframeRef.current?.contentWindow?.print();
}
```

`@media print` CSS（Section 2.8）確保列印時所有 slide 全展開、一頁一張、無 UI。

---

## 6. StyleSettingsPanel 擴充

### 6.1 動畫強度（全域）

在現有「卡片風格」和 scale 滑桿下方新增：

```
┌─ 樣式調整 ──────────────────┐
│ 卡片風格：  [實色] [玻璃]    │  ← 已有
│ 標題大小    ──●──────────    │  ← 已有
│ 內文大小    ────●────────    │
│ 卡片大小    ────●────────    │
│ 間距        ──────●──────    │
│                              │
│ ─── 動畫 ─────────────────  │  ← 新增
│ 動畫強度：                   │
│ [無] [輕微] [適中] [豐富]    │  ← 4 格按鈕組
│                              │
│ ─── 選中 Slide 動畫 ───────  │  ← 選中 slide 時才顯示
│ 進場效果：  [淡入 ▾]         │  ← dropdown
│ 片段動畫：  [上滑 ▾]         │
│ 速度：      [正常 ▾]         │
│ [↺ 重設為預設]               │
│                              │
│ [↺ 重設為主題預設]           │  ← 已有
└──────────────────────────────┘
```

### 6.2 行為

- 動畫強度改變 → 立即更新 iframe srcDoc（但因為 browse mode，fragment 瞬間展開）
- Per-slide 設定改變 → 同上，即時更新
- 如果 animationLevel = 'none'，per-slide 設定區灰掉並顯示「動畫已關閉」
- 「重設為預設」只重設該 slide 的 animation override
- 「重設為主題預設」重設所有 customParams（已有行為不變）

---

## 7. 影響的檔案

| 檔案 | 改動 |
|------|------|
| `slide-engine-css.ts` | 動畫 CSS variables、@keyframes、fragment transitions、@media print |
| `slide-engine-nav.ts` | browse/present 模式、fragment 推進、postMessage 雙向、全螢幕 |
| `slide-templates.ts` | data-entrance/data-fragment/data-speed attributes |
| `slide-animation-defaults.ts` | **新檔案** — 預設對照表 + getSlideAnimation() |
| `presentations-utils.ts` | 傳遞 animationLevel、呼叫 getSlideAnimation()、匯出 HTML 演示按鈕 |
| `presentations-store.ts` | animationLevel in SlideSettings、SlideAnimation type、3 個 actions |
| `presentations-workstation.tsx` | 無直接改動（StyleSettingsPanel 負責 UI） |
| `style-settings-panel.tsx` | 動畫強度按鈕組 + per-slide 動畫 dropdowns |
| `slide-preview.tsx` | 演示按鈕、PDF 匯出、postMessage 雙向監聽 |

## 8. 不做的事

- 講者備註 / 計時器 — 超出 V3.1 範圍
- 觸控手勢 / 滑動 — 未來再考慮
- Slide transition（頁間過場）— 只做 fragment 動畫 + entrance，頁間保持即時切換
- 影片匯出 — 只匯出 HTML + PDF
- 3D 圖表 / sparkline — dataviz 維持現有類型
- Typewriter 動畫 — 用 fade + slow stagger 替代，CSS 更可靠
- 編輯預覽播動畫 — 只有演示模式才播
