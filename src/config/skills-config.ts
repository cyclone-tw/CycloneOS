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
    id: "felo",
    name: "Felo AI 工作站",
    description: "AI 生圖・Web 擷取・Deep Research・Logo 設計・通用對話",
    icon: "🤖",
    type: "workstation",
    tags: ["Felo", "AI", "生圖", "Research", "SuperAgent", "Web Fetch"],
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
    description: "會議記錄・IEP・課程計畫・教案・特推會",
    icon: "🎓",
    type: "workstation",
    tags: ["IEP", "特推會", "會議記錄", "課程計畫", "教案", "特教"],
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
    description: "素材轉社群貼文：FB・IG・LINE・學校網站・Notion 一鍵生成",
    icon: "📱",
    type: "workstation",
    tags: ["Facebook", "Instagram", "LINE", "Notion", "社群", "貼文"],
  },
];
