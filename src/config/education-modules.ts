export interface EducationModule {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: "active" | "coming-soon";
}

export const EDUCATION_MODULES: EducationModule[] = [
  {
    id: "iep-meeting",
    name: "IEP 會議記錄",
    description: "錄音→逐字稿→AI 分析→會議記錄",
    icon: "📋",
    status: "coming-soon",
  },
  {
    id: "spc-meeting",
    name: "特推會會議記錄",
    description: "填表→AI 草擬→會議記錄",
    icon: "📋",
    status: "active",
  },
  {
    id: "iep-plan",
    name: "IEP 服務計劃",
    description: "學生資料→AI 輔助→服務計劃",
    icon: "📝",
    status: "coming-soon",
  },
  {
    id: "curriculum",
    name: "課程計劃",
    description: "分組→課綱→AI 產出→課程計劃",
    icon: "📚",
    status: "coming-soon",
  },
];
