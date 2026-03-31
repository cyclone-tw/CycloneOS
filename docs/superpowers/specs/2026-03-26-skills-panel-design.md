# Skills 面板設計規格

> CycloneOS Dashboard — Skills Panel Design Spec
> Date: 2026-03-26

## 1. 概述

Skills 面板是 CycloneOS Dashboard 的技能目錄與工作站入口。第一版包含五個工作站，以統一卡片流呈現，點擊卡片展開為全屏工作站 UI。Chat skill 機制保留供未來擴充，但 v1 所有技能均為工作站類型。

### 設計決策摘要

| 決策 | 結論 | 原因 |
|------|------|------|
| 面板風格 | 統一卡片流（B 方案） | 卡片同大小，用標記區分類型，附 filter tabs |
| 工作站展開方式 | Skills 面板內部 state 切換 | 不新增 sidebar page，保留返回 Skills 的上下文 |
| Documents sidebar | 保留為工作站捷徑 | 使用頻率高，值得 sidebar 專屬位置 |
| v1 範圍 | 5 個工作站，無 Chat skill | 全部需求都升級為工作站 |
| 資料來源 | 第一版靜態配置 | 未來可動態讀取 `.claude/skills/` 目錄 |

## 2. Sidebar 配置

```
主導航（上方）：
  LayoutDashboard  — Overview
  Mail             — Gmail
  HardDrive        — Drive
  FileText         — Documents    ← 捷徑，直接開啟 Skills + Documents 工作站
  Sparkles         — Skills
  Clock            — Timeline

分隔線 + 外部連結：
  ListTodo         — Tasks (Notion)

底部：
  Search           — Search（暫定）
  Settings         — Settings
```

### Documents 捷徑行為

點擊 sidebar Documents 按鈕呼叫統一的導航 action：

```typescript
navigateTo("skills", "documents");
```

### Sidebar 實作變更

移除 `"pipeline"` SidebarPage 類型。Documents sidebar 按鈕改為特殊處理，不再走 NAV_ITEMS 的統一 `setActivePage` 路徑：

```typescript
// sidebar.tsx — Documents 使用 onClick override
const NAV_ITEMS: NavItem[] = [
  { page: "overview", icon: LayoutDashboard, label: "Overview" },
  { page: "gmail", icon: Mail, label: "Gmail" },
  { page: "drive", icon: HardDrive, label: "Drive" },
  // Documents 不在 NAV_ITEMS 中，改為獨立按鈕
  { page: "skills", icon: Sparkles, label: "Skills" },
  { page: "timeline", icon: Clock, label: "Timeline" },
];

// Documents 捷徑按鈕獨立渲染，onClick 呼叫 navigateTo("skills", "documents")
```

### dashboard-panel.tsx 變更

移除 `pipeline` 條目，新增 `skills`：

```typescript
const PAGE_COMPONENTS: Record<SidebarPage, ReactNode> = {
  overview: <OverviewPage />,
  gmail: <GmailPanel />,
  drive: <DrivePanel />,
  skills: <SkillsPanel />,     // 取代 pipeline
  timeline: <TimelinePanel />,
  search: <PlaceholderPage ... />,
  settings: <PlaceholderPage ... />,
};
```

## 3. Skills 面板 UI

### 3.1 卡片目錄（預設視圖）

```
┌──────────────────────────────────────────────────┐
│ Skills                               [🔍 搜尋]   │
│                                                    │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│ │ 📄       │ │ 📜       │ │ 🎓       │           │
│ │Documents │ │ 公文處理  │ │ 教育工作站│           │
│ │ 展開 →   │ │ 展開 →   │ │ 展開 →   │  ← 3 欄   │
│ └──────────┘ └──────────┘ └──────────┘           │
│ ┌──────────┐ ┌──────────┐                         │
│ │ 🎙️       │ │ 📱       │                         │
│ │語音轉錄  │ │ 社群發文  │                         │
│ │ 展開 →   │ │ 展開 →   │                         │
│ └──────────┘ └──────────┘                         │
└──────────────────────────────────────────────────┘
```

- 3 欄 responsive grid（< 768px 2 欄，< 480px 1 欄）
- v1 不顯示 filter tabs（所有卡片同類型）。未來新增 Chat skill 時加 filter
- 搜尋框：case-insensitive substring match on name、description、tags，200ms debounce
- 每張卡片顯示：icon、名稱、一行描述、類型標記
- 未實作的工作站顯示 placeholder 狀態（卡片可點擊但內容為 coming soon）

### 3.2 卡片資料模型

```typescript
// dashboard/src/config/skills-config.ts

interface SkillCard {
  id: string;                    // "documents", "gov-doc", "education", "transcribe", "social"
  name: string;                  // "Documents 工作站"
  description: string;           // "複合式資料處理：多源讀取→AI加工→多格式輸出"
  icon: string;                  // emoji
  type: "workstation" | "chat";  // 決定點擊行為 + 用於未來 filter
  tags: string[];                // 用於搜尋
  chatCommand?: string;          // type=chat 時的 slash command
}

const SKILLS: SkillCard[] = [
  {
    id: "documents",
    name: "Documents 工作站",
    description: "複合式資料處理：多源讀取→AI加工→多格式輸出",
    icon: "📄",
    type: "workstation",
    tags: ["PDF", "OCR", "合併", "拆分", "簡報", "Excel", "會議紀錄"],
  },
  {
    id: "gov-doc",
    name: "公文處理工作站",
    description: "公文掃描→AI分析→分類歸檔→進階管理",
    icon: "📜",
    type: "workstation",
    tags: ["公文", "歸檔", "掃描", "分類"],
  },
  {
    id: "education",
    name: "教育工作站",
    description: "IEP・課程計畫・教案・學習單・教材設計",
    icon: "🎓",
    type: "workstation",
    tags: ["IEP", "課程計畫", "教案", "學習單", "特教"],
  },
  {
    id: "transcribe",
    name: "語音轉錄工作站",
    description: "YT影片・手機錄音・電腦錄影→逐字稿→文件產出",
    icon: "🎙️",
    type: "workstation",
    tags: ["YT", "錄音", "逐字稿", "Whisper", "轉錄"],
  },
  {
    id: "social",
    name: "社群發文模組",
    description: "FB・IG・Threads・Notion 格式切換與自動化發文",
    icon: "📱",
    type: "workstation",
    tags: ["Facebook", "Instagram", "Threads", "Notion", "社群"],
  },
];
```

### 3.3 工作站展開機制

**State 管理（app-store.ts 擴充）：**

```typescript
export type SidebarPage =
  | "overview" | "gmail" | "drive"
  | "skills" | "timeline" | "search" | "settings";
// NOTE: "pipeline" 已移除，Documents 改為 skills 工作站捷徑

interface AppState {
  activePage: SidebarPage;
  activeWorkstation: string | null;
  setActivePage: (page: SidebarPage) => void;
  setActiveWorkstation: (id: string | null) => void;
  navigateTo: (page: SidebarPage, workstation?: string | null) => void;
}

// 實作
export const useAppStore = create<AppState>((set) => ({
  activePage: "overview",
  activeWorkstation: null,
  setActivePage: (page) => set({ activePage: page, activeWorkstation: null }),
  // ↑ 切換頁面時自動清除 activeWorkstation，避免殘留 state
  setActiveWorkstation: (id) => set({ activeWorkstation: id }),
  navigateTo: (page, workstation = null) =>
    set({ activePage: page, activeWorkstation: workstation }),
  // ↑ 統一導航 action，Documents 捷徑呼叫 navigateTo("skills", "documents")
}));
```

**關鍵 state 行為：**
- `setActivePage` 永遠會重置 `activeWorkstation` 為 null（防止殘留）
- `navigateTo` 是原子操作，同時設定 page + workstation
- Documents sidebar 捷徑使用 `navigateTo("skills", "documents")`
- 其他 sidebar 按鈕使用 `setActivePage`（自動清除 workstation）

**展開/返回流程：**

1. 使用者在 Skills 面板點擊工作站卡片
2. `setActiveWorkstation("documents")` → Skills 面板內部切換到工作站 UI
3. 工作站頂部有 `← 返回 Skills` 按鈕
4. 點返回 → `setActiveWorkstation(null)` → 回到卡片目錄

**全寬邏輯（resizable-layout.tsx）：**

```typescript
// resizable-layout.tsx 需新增 import activeWorkstation from app-store
const { activePage, activeWorkstation } = useAppStore();

const FULL_WIDTH_PAGES: SidebarPage[] = ["timeline", "settings"];

const isFullWidth =
  FULL_WIDTH_PAGES.includes(activePage) ||
  (activePage === "skills" && activeWorkstation !== null);
```

**Chat panel 狀態保持：**

切換全寬模式時 Chat panel 會被條件式卸載。為避免丟失對話狀態，Chat panel 的訊息和 scroll position 已由 agent-store（Zustand）管理，重新掛載時會從 store 恢復。如果未來出現 state 丟失問題，可改為 CSS `display:none` 隱藏取代條件式渲染。

### 3.4 Chat Skill 點擊行為（v2 預留）

v1 無 Chat skill。未來新增時的互動流程：

1. 使用者點擊 type=chat 的卡片
2. 在 Chat panel input 自動填入 `chatCommand`（如 `/doc-analyze`）
3. Focus 切換到 Chat panel
4. 使用者按 Enter 啟動工作流

## 4. 五大工作站概述

每個工作站是一個獨立的 React 組件，掛載在 `dashboard/src/components/skills/workstations/` 下。未實作的工作站暫時使用 placeholder 組件（標題 + "Coming Soon" + 預計功能清單）。

### 4.1 Documents 工作站

```
dashboard/src/components/skills/workstations/documents-workstation.tsx
```

**輸入層（資料來源）：**
- PDF / 圖片檔案（支援 OCR，文字型與純圖片型）
- Obsidian vault 本機資料
- Google Drive 掛載（個人 + 學校帳號）
- Notion 資料庫

**處理層（AI 加工）：**
- 摘要產出
- 深度思考（調用外部搜尋、研究資料）
- PDF 操作：合併、拆分、重組頁面排序
- 內容規劃與結構化

**輸出層（檔案生成）：**
- 會議紀錄（指定格式 markdown / docx）
- PPT（可編輯 .pptx，本機可修改文字圖片）
- HTML 簡報（強制比例，如 16:9）
- Google Slides
- PDF
- Excel (.xlsx)

**關鍵整合：**
- 與 Drive 面板共用 `StorageProvider` 和 `accounts.ts` 帳號配置
- 與 Chat panel 的 agent 共用 MCP 工具（Notion、Gmail）

### 4.2 公文處理工作站

```
dashboard/src/components/skills/workstations/gov-doc-workstation.tsx
```

**基礎：** 移植現有 OpenClaw `document-processor` skill 的核心邏輯

**現有功能（來自 document-processor）：**
- 掃描 `00.Inbox` 中的 `*_print.pdf` + `*_ATTACH*` 附件
- AI 分析：主旨、類型、優先級、關鍵重點、行動項目、截止日
- 22 條路由規則自動歸檔到 `04.學校相關/` 子目錄
- 產出 Obsidian 索引筆記

**進階歸檔功能（新增）：**
- 視覺化歸檔狀態儀表板
- 手動重新分類 / 修正 AI 建議
- 批次處理進度追蹤
- 歸檔歷史瀏覽與搜尋
- 路徑映射：支援 Mac 本機路徑（原系統以 Windows Google Drive 路徑為主）

**設計參考：** `docs/plans/2026-03-07-document-processor-integration-design.md`

### 4.3 教育工作站

```
dashboard/src/components/skills/workstations/education-workstation.tsx
```

**學生管理：**
- IEP 文件產出（個別化教育計畫）
- 學生能力現況描述
- 學生資料讀取（Notion / 本機）

**教材產出：**
- 課程計畫（學期 / 單元）
- 教案設計
- 學習單 / 評量單
- 教材簡報

**教材設計：**
- 差異化教學素材
- 視覺化教具
- 輔助溝通圖卡

### 4.4 語音轉錄工作站

```
dashboard/src/components/skills/workstations/transcribe-workstation.tsx
```

**輸入：**
- YouTube 影片 URL → 擷取 MP3
- 手機錄音檔上傳
- 電腦錄影 → 擷取音軌

**處理：**
- Whisper API / whisper.cpp 本機轉錄
- 逐字稿時間軸對齊
- AI 結構化摘要

**輸出：**
- 純逐字稿（markdown / txt）
- 銜接 Documents 工作站產出各類格式（PPT、會議紀錄等）

**工作站銜接（v2）：** 語音轉錄完成後，提供「傳送到 Documents 工作站」按鈕，自動帶入轉錄結果。具體機制（state 傳遞或暫存檔案）延後設計。

### 4.5 社群發文模組

```
dashboard/src/components/skills/workstations/social-workstation.tsx
```

**功能：**
- 單一內容 → 多平台格式自動轉換
  - Facebook 貼文（含圖文排版）
  - Instagram 貼文（方形 / 直式比例）
  - Threads 貼文
  - Notion 頁面
- 排程發文
- 草稿預覽（各平台即時預覽切換）
- 發文歷史追蹤

## 5. 檔案結構

```
dashboard/src/
├── config/
│   └── skills-config.ts              # SkillCard 資料定義
├── stores/
│   └── app-store.ts                  # 新增 activeWorkstation + navigateTo
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx               # Documents 捷徑（獨立按鈕，呼叫 navigateTo）
│   │   ├── dashboard-panel.tsx       # 移除 pipeline，新增 skills
│   │   └── resizable-layout.tsx      # 全寬判斷（import activeWorkstation）
│   └── skills/
│       ├── skills-panel.tsx           # 主面板：卡片目錄 + 工作站切換
│       ├── skill-card.tsx             # 單張卡片組件
│       ├── skill-search.tsx           # 搜尋框
│       └── workstations/
│           ├── workstation-placeholder.tsx  # 共用 placeholder（未實作的工作站）
│           ├── documents-workstation.tsx
│           ├── gov-doc-workstation.tsx
│           ├── education-workstation.tsx
│           ├── transcribe-workstation.tsx
│           └── social-workstation.tsx
```

## 6. 實作優先順序建議

| Phase | 內容 | 說明 |
|-------|------|------|
| **Phase 1** | Skills 面板骨架 + 卡片目錄 | skills-panel、skill-card、搜尋、state 管理、Documents 捷徑、移除 pipeline |
| **Phase 2** | Documents 工作站 | 最核心的複合式工作站，涵蓋最多使用場景 |
| **Phase 3** | 公文處理工作站 | 移植現有 document-processor + 進階歸檔 UI |
| **Phase 4** | 教育工作站 | IEP / 課程計畫 / 教材設計 |
| **Phase 5** | 語音轉錄工作站 | Whisper 整合 + 銜接 Documents |
| **Phase 6** | 社群發文模組 | 多平台格式 + 自動化 |

## 7. 設計原則

1. **Skills 面板是入口，工作站是展開** — 面板不做具體工作，只負責目錄和導航
2. **工作站之間可銜接** — 語音轉錄的輸出可直接進 Documents 工作站加工（具體機制 v2 設計）
3. **漸進式建設** — 每個工作站獨立開發，先 placeholder 後實作
4. **共用基礎設施** — StorageProvider、MCP 工具、帳號配置跨工作站共用
5. **靜態配置起步** — 技能清單先硬編碼，未來再做動態發現
6. **State 清潔** — 頁面切換時自動清除 workstation state，防止殘留
