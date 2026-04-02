# CycloneOS Computer Use 設計文件

> 日期：2026-03-31
> 狀態：Draft

## 概述

讓 Claude 透過 Anthropic API 的 Computer Use 功能，直接操控使用者的 Mac 桌面。CycloneOS 作為控制介面，本地 Agent 負責截圖和執行動作。

## 架構

```
┌─────────────────────────────────────────────────┐
│  CycloneOS Dashboard (瀏覽器)                     │
│  ┌──────────────────┐  ┌──────────────────────┐  │
│  │  對話/指令面板     │  │  即時螢幕預覽         │  │
│  │                  │  │  (WebSocket 串流截圖)  │  │
│  │  [開始控制]       │  │                      │  │
│  │  [暫停] [停止]    │  │  點擊 → 送回 Agent    │  │
│  └──────────────────┘  └──────────────────────┘  │
└─────────────┬───────────────────────────────────┘
              │ WebSocket (ws://localhost:9800)
              │
┌─────────────▼───────────────────────────────────┐
│  Local Agent (Node.js 常駐程式)                    │
│                                                   │
│  ┌─────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ 截圖模組  │  │ 輸入控制  │  │ Claude API 橋接 │  │
│  │ screenshot│  │ mouse    │  │ anthropic SDK  │  │
│  │ -desktop │  │ keyboard │  │ computer tool  │  │
│  └─────────┘  └──────────┘  └────────────────┘  │
│                                                   │
│  Loop:                                            │
│    1. 截圖 → base64                               │
│    2. 送截圖 + 上下文給 Claude API                  │
│    3. 收到動作指令 (click/type/scroll/key)          │
│    4. 執行動作                                     │
│    5. 等待 + 再截圖 → 回到 1                        │
└───────────────────────────────────────────────────┘
              │
              │ Anthropic API (HTTPS)
              ▼
┌───────────────────────────────────────────────────┐
│  Claude API (claude-sonnet-4-6)                    │
│  Tool: computer-use-2025-01-24                    │
│  輸入: screenshot (base64)                         │
│  輸出: action (click/type/scroll/key/screenshot)   │
└───────────────────────────────────────────────────┘
```

## 元件

### 1. Local Agent (`cycloneos-agent/`)

獨立的 Node.js 程式，跑在使用者的 Mac 上。不是 CycloneOS 的一部分（不跑在 Next.js 裡）。

```
cycloneos-agent/
├── package.json
├── src/
│   ├── index.ts              ← 入口，啟動 WebSocket server
│   ├── screenshot.ts         ← 截圖（screencapture CLI 或 screenshot-desktop）
│   ├── input-control.ts      ← 滑鼠/鍵盤控制（@nut-tree/nut-js 或 osascript）
│   ├── claude-bridge.ts      ← Anthropic SDK 呼叫 + computer tool 處理
│   ├── session.ts            ← 控制 session 管理（開始/暫停/停止）
│   └── ws-server.ts          ← WebSocket server（跟 CycloneOS 通訊）
└── tsconfig.json
```

**核心依賴：**
- `@anthropic-ai/sdk` — Claude API
- `screenshot-desktop` — 跨平台截圖（macOS 也可用 `screencapture -x`）
- `@nut-tree/nut-js` — 跨平台滑鼠/鍵盤控制（或用 macOS 原生 `osascript`）
- `ws` — WebSocket server
- `sharp` — 圖片縮放（Claude 建議 1280x800 解析度）

### 2. CycloneOS Skill 卡片

```
src/components/skills/workstations/computer-use/
├── computer-use-workstation.tsx   ← 主元件
├── computer-use-screen.tsx        ← 螢幕預覽（WebSocket 接收截圖）
├── computer-use-controls.tsx      ← 控制面板（開始/暫停/停止/設定）
└── computer-use-chat.tsx          ← 任務對話（輸入指令、看 Claude 的思考過程）
```

**Skill 定義：**
```typescript
{
  id: "computer-use",
  name: "電腦操控",
  description: "讓 Claude 操控你的 Mac — 開 App、填表單、自動化任務",
  icon: "🖥️",
  type: "workstation",
  tags: ["Computer Use", "自動化", "桌面操控", "RPA"],
}
```

### 3. WebSocket 通訊協定

**CycloneOS → Agent：**
```typescript
// 開始控制 session
{ type: "start", task: "打開 Keynote 做一份融合教育的簡報" }

// 暫停/繼續/停止
{ type: "pause" }
{ type: "resume" }
{ type: "stop" }

// 使用者直接在預覽畫面點擊（手動介入）
{ type: "manual-click", x: 500, y: 300 }
{ type: "manual-type", text: "hello" }
```

**Agent → CycloneOS：**
```typescript
// 螢幕截圖串流
{ type: "screenshot", image: "data:image/png;base64,...", timestamp: 1234567890 }

// Claude 的動作（即時顯示 Claude 在做什麼）
{ type: "action", action: "click", params: { x: 500, y: 300 }, reasoning: "點擊 Keynote 圖示" }
{ type: "action", action: "type", params: { text: "融合教育" }, reasoning: "輸入標題" }

// 狀態更新
{ type: "status", status: "thinking" | "acting" | "waiting" | "paused" | "done" }

// Claude 的思考過程
{ type: "thinking", content: "我看到桌面上有 Keynote 圖示，準備點擊它..." }

// 錯誤
{ type: "error", message: "截圖失敗" }
```

### 4. Claude API 呼叫

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const response = await client.messages.create({
  model: "claude-sonnet-4-6-20250514",
  max_tokens: 4096,
  tools: [
    {
      type: "computer_20250124",
      name: "computer",
      display_width_px: 1280,
      display_height_px: 800,
      display_number: 0,
    },
  ],
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: task },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: screenshotBase64,
          },
        },
      ],
    },
  ],
});

// 解析回應中的 tool_use
for (const block of response.content) {
  if (block.type === "tool_use" && block.name === "computer") {
    const { action, coordinate, text } = block.input;
    // action: "click" | "type" | "scroll" | "key" | "screenshot"
    // coordinate: [x, y] — 點擊/scroll 的座標
    // text: 要輸入的文字（type action 用）
  }
}
```

## 控制流程

```
使用者輸入任務：「打開 Safari 搜尋融合教育」
  │
  ▼
Agent 截圖（1280x800）→ 送給 Claude + 任務描述
  │
  ▼
Claude 回傳：{ action: "click", coordinate: [680, 790] }
  reasoning: "點擊 Dock 上的 Safari"
  │
  ▼
Agent 執行滑鼠點擊 → 等 1 秒 → 再截圖
  │
  ▼
Claude 回傳：{ action: "click", coordinate: [640, 45] }
  reasoning: "點擊網址列"
  │
  ▼
Agent 執行 → 截圖 → Claude 回傳：{ action: "type", text: "融合教育" }
  │
  ▼
Agent 輸入文字 → 截圖 → Claude 回傳：{ action: "key", text: "Return" }
  │
  ▼
Agent 按 Enter → 截圖 → Claude 判斷任務完成
  │
  ▼
Agent 回報 status: "done"
```

## 安全機制

### 必要的防護

1. **暫停按鈕** — 使用者隨時可以暫停，Claude 停止送出動作
2. **動作確認模式** — 可選：每個動作都要使用者確認才執行（適合高風險操作）
3. **禁止區域** — 可設定螢幕上的區域不允許 Claude 點擊（如密碼管理器）
4. **Session 超時** — 預設 10 分鐘無動作自動停止
5. **動作速率限制** — 每秒最多 2 個動作，避免失控
6. **危險指令過濾** — 不允許 `sudo`、`rm -rf` 等終端指令

### macOS 權限

Agent 需要以下權限（首次啟動時會彈系統提示）：
- **輔助使用（Accessibility）** — 控制滑鼠/鍵盤
- **螢幕錄製（Screen Recording）** — 截圖

## UI 設計

```
┌────────────────────────────────────────────────────────┐
│ ← 🖥️ 電腦操控                                          │
│    讓 Claude 操控你的 Mac                                │
├──────────────────────┬─────────────────────────────────┤
│                      │                                 │
│  [任務對話]           │  [即時螢幕預覽]                  │
│                      │                                 │
│  User: 打開 Keynote  │  ┌─────────────────────────┐   │
│  做融合教育簡報       │  │                         │   │
│                      │  │    Mac 桌面截圖           │   │
│  🤖 正在操控...      │  │    (WebSocket 串流)       │   │
│  · 點擊 Keynote 圖示 │  │                         │   │
│  · 選擇空白簡報      │  │    🔴 Claude 點擊位置     │   │
│  · 輸入標題          │  │                         │   │
│                      │  └─────────────────────────┘   │
│                      │                                 │
│                      │  [⏸ 暫停] [⏹ 停止] [⚙ 設定]    │
├──────────────────────┴─────────────────────────────────┤
│  輸入任務指令...                              [送出]     │
└────────────────────────────────────────────────────────┘
```

**螢幕預覽功能：**
- Claude 的點擊位置用紅色圓點標示
- 使用者可以直接在預覽上點擊（手動介入）
- 截圖更新頻率：動作執行後立即更新 + idle 時每 2 秒更新

## 實作分期

### Phase 1：Local Agent 核心（可獨立運作）
- WebSocket server
- 截圖模組
- 滑鼠/鍵盤控制
- Claude API 橋接
- 基本 loop（截圖 → Claude → 執行 → 截圖）
- CLI 介面（不需要 CycloneOS，直接終端機操作）

### Phase 2：CycloneOS Skill 卡片
- Skill 註冊 + workstation
- WebSocket 連線到 Agent
- 螢幕預覽（串流截圖）
- 任務對話 UI
- 開始/暫停/停止控制

### Phase 3：進階功能
- 動作確認模式
- 禁止區域設定
- 動作歷史記錄
- 多螢幕支援
- 預設任務模板（「開 Keynote 做簡報」「整理桌面」等）

## 成本估算

每次 Claude API 呼叫包含一張截圖（~800 tokens）+ context：
- 一個簡單任務（10 步）≈ 10 次 API call ≈ ~30K tokens
- 一個複雜任務（50 步）≈ 50 次 API call ≈ ~200K tokens
- 使用 Sonnet 最划算，Opus 用於需要高判斷力的場景

## 與現有系統的整合

- **Felo Skill** — Computer Use 可以操控瀏覽器開 Felo 網頁版
- **Presentations Skill** — 可以讓 Claude 操控 Keynote/PowerPoint 做簡報
- **Documents Skill** — 可以操控 Word/Pages 編輯文件

## 技術風險

1. **截圖延遲** — macOS screencapture 大約 200-500ms，可能影響體驗
2. **座標精準度** — 截圖縮放後座標轉換需要精確計算
3. **應用程式動畫** — 等 app 動畫完成才截圖，否則 Claude 看到的是過渡畫面
4. **Token 成本** — 每步都送截圖，長任務成本高
5. **安全** — Claude 有完整桌面存取權，需要嚴格的安全機制
