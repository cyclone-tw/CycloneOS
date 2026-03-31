// dashboard/src/config/skills-config.ts

export interface SkillCard {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: "workstation" | "chat";
  tags: string[];
  chatCommand?: string;
}

export const SKILLS: SkillCard[] = [
  {
    id: "documents",
    name: "Documents 工作站",
    description: "複合式資料處理：多源讀取→AI加工→多格式輸出",
    icon: "📄",
    type: "workstation",
    tags: ["PDF", "OCR", "合併", "拆分", "簡報", "Excel", "會議紀錄"],
  },
  {
    id: "presentations",
    name: "簡報工作站",
    description: "多來源 AI 簡報生成、編輯、匯出",
    icon: "📊",
    type: "workstation",
    tags: ["簡報", "reveal.js", "Canva", "Felo", "投影片"],
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
