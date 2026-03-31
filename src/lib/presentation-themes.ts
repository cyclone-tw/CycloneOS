// dashboard/src/lib/presentation-themes.ts

export type ThemeCategory =
  | "consulting"
  | "startup"
  | "modern"
  | "minimal"
  | "data"
  | "education"
  | "asian"
  | "institutional"
  | "creative";

export interface PresentationTheme {
  id: string;
  name: string;
  nameZh: string;
  category: ThemeCategory;

  colors: {
    bg: string;
    text: string;
    accent: string;
    secondary?: string;
    muted: string;
    cardBg?: string;
    barColors?: string[];
  };
  fonts: {
    heading: string;
    body: string;
    mono?: string;
  };

  isDark: boolean;
  googleFontsUrl?: string;

  // Kept for Canva/Felo renderers
  canvaStylePrompt: string;
  feloThemeId?: string;
  personality: ThemePersonality;
}

export interface ThemePersonality {
  titleAlign: "center" | "left" | "top-left";
  contentDensity: "compact" | "normal" | "spacious";
  borderRadius: number;
  shadowDepth: "none" | "subtle" | "medium" | "heavy";
  borderStyle: "none" | "thin" | "thick" | "accent-left";
  decorations: {
    titleUnderline: "none" | "thin" | "thick" | "accent-gradient";
    sectionDivider: "none" | "line" | "dots" | "geometric";
    accentShape: "none" | "circle" | "square" | "triangle" | "wave";
  };
  cardEffect: "solid" | "glass";
}

export const THEME_CATEGORIES: Record<ThemeCategory, string> = {
  consulting: "顧問商務",
  startup: "科技新創",
  modern: "現代設計",
  minimal: "極簡",
  data: "數據分析",
  education: "教育",
  asian: "日式/亞洲",
  institutional: "政府/機構",
  creative: "創意表現",
};

const DEFAULT_BAR_COLORS = ["#3B82F6", "#10B981", "#A78BFA", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4"];

export const PRESENTATION_THEMES: PresentationTheme[] = [
  // Consulting & Corporate
  {
    id: "mckinsey",
    name: "McKinsey Classic",
    nameZh: "麥肯錫經典",
    category: "consulting",
    isDark: false,
    colors: {
      bg: "#FFFFFF",
      text: "#333333",
      accent: "#003A70",
      muted: "#64748B",
      cardBg: "rgba(0,0,0,0.04)",
      barColors: DEFAULT_BAR_COLORS,
    },
    fonts: {
      heading: "'Georgia', 'Noto Serif TC', serif",
      body: "'Arial', 'Noto Sans TC', sans-serif",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@400;600;700&display=swap",
    canvaStylePrompt: "McKinsey-style clean corporate presentation with navy blue accents, action titles, generous white space, professional consulting layout",
    personality: { titleAlign: "left", contentDensity: "normal", borderRadius: 2, shadowDepth: "subtle", borderStyle: "thin", decorations: { titleUnderline: "thin", sectionDivider: "line", accentShape: "none" }, cardEffect: "solid" },
  },
  {
    id: "bcg",
    name: "BCG Analytical",
    nameZh: "BCG 分析",
    category: "consulting",
    isDark: false,
    colors: {
      bg: "#FFFFFF",
      text: "#2D2D2D",
      accent: "#00A651",
      muted: "#64748B",
      cardBg: "rgba(0,0,0,0.04)",
      barColors: DEFAULT_BAR_COLORS,
    },
    fonts: {
      heading: "'Trebuchet MS', 'Noto Sans TC', sans-serif",
      body: "'Trebuchet MS', 'Noto Sans TC', sans-serif",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap",
    canvaStylePrompt: "BCG-style data-heavy analytical presentation with green accents, charts and matrix diagrams, professional consulting format",
    personality: { titleAlign: "left", contentDensity: "normal", borderRadius: 4, shadowDepth: "subtle", borderStyle: "accent-left", decorations: { titleUnderline: "thin", sectionDivider: "line", accentShape: "none" }, cardEffect: "solid" },
  },
  {
    id: "deloitte",
    name: "Deloitte Executive",
    nameZh: "Deloitte 行政",
    category: "consulting",
    isDark: false,
    colors: {
      bg: "#FFFFFF",
      text: "#000000",
      accent: "#86BC25",
      muted: "#64748B",
      cardBg: "rgba(0,0,0,0.04)",
      barColors: DEFAULT_BAR_COLORS,
    },
    fonts: {
      heading: "'Montserrat', 'Noto Sans TC', sans-serif",
      body: "'Open Sans', 'Noto Sans TC', sans-serif",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&family=Open+Sans:wght@400;500;600&family=Noto+Sans+TC:wght@400;500;700&display=swap",
    canvaStylePrompt: "Deloitte-style executive presentation with green accents, headline-evidence-bumper structure, professional and balanced",
    personality: { titleAlign: "left", contentDensity: "normal", borderRadius: 4, shadowDepth: "medium", borderStyle: "thin", decorations: { titleUnderline: "thick", sectionDivider: "line", accentShape: "none" }, cardEffect: "solid" },
  },
  {
    id: "accenture",
    name: "Accenture Bold",
    nameZh: "Accenture 大膽",
    category: "consulting",
    isDark: false,
    colors: {
      bg: "#FFFFFF",
      text: "#000000",
      accent: "#A100FF",
      muted: "#64748B",
      cardBg: "rgba(0,0,0,0.04)",
      barColors: DEFAULT_BAR_COLORS,
    },
    fonts: {
      heading: "'Arial', 'Noto Sans TC', sans-serif",
      body: "'Arial', 'Noto Sans TC', sans-serif",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap",
    canvaStylePrompt: "Accenture-style bold modern presentation with purple accents, dynamic layouts, technology-forward design",
    personality: { titleAlign: "left", contentDensity: "normal", borderRadius: 6, shadowDepth: "subtle", borderStyle: "thin", decorations: { titleUnderline: "accent-gradient", sectionDivider: "line", accentShape: "none" }, cardEffect: "solid" },
  },
  // Tech & Startup
  {
    id: "yc-minimal",
    name: "YC Minimal",
    nameZh: "YC 極簡",
    category: "startup",
    isDark: false,
    colors: {
      bg: "#FFFFFF",
      text: "#1A1A1A",
      accent: "#FF6600",
      muted: "#64748B",
      cardBg: "rgba(0,0,0,0.04)",
      barColors: DEFAULT_BAR_COLORS,
    },
    fonts: {
      heading: "'Inter', 'Noto Sans TC', sans-serif",
      body: "'Inter', 'Noto Sans TC', sans-serif",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;700&display=swap",
    canvaStylePrompt: "Y Combinator style minimal pitch deck, one idea per slide, large numbers for metrics, orange accent, extreme simplicity",
    personality: { titleAlign: "left", contentDensity: "spacious", borderRadius: 8, shadowDepth: "none", borderStyle: "none", decorations: { titleUnderline: "none", sectionDivider: "none", accentShape: "none" }, cardEffect: "solid" },
  },
  {
    id: "sequoia",
    name: "Sequoia Storyteller",
    nameZh: "紅杉敘事",
    category: "startup",
    isDark: false,
    colors: {
      bg: "#FFFFFF",
      text: "#1C1C1C",
      accent: "#CC0000",
      muted: "#64748B",
      cardBg: "rgba(0,0,0,0.04)",
      barColors: DEFAULT_BAR_COLORS,
    },
    fonts: {
      heading: "'Helvetica Neue', 'Noto Sans TC', sans-serif",
      body: "'Helvetica Neue', 'Noto Sans TC', sans-serif",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap",
    canvaStylePrompt: "Sequoia Capital style narrative pitch deck, mission-driven, clean data visualization, red accent, storytelling format",
    personality: { titleAlign: "left", contentDensity: "normal", borderRadius: 4, shadowDepth: "subtle", borderStyle: "thin", decorations: { titleUnderline: "thin", sectionDivider: "line", accentShape: "none" }, cardEffect: "solid" },
  },
  {
    id: "dark-tech",
    name: "Dark Tech",
    nameZh: "暗黑科技",
    category: "startup",
    isDark: true,
    colors: {
      bg: "#0D0D0D",
      text: "#E8EDF4",
      accent: "#00D4FF",
      secondary: "#8B5CF6",
      muted: "#94A3B8",
      cardBg: "rgba(30,41,59,0.85)",
      barColors: ["#3B82F6", "#8B5CF6", "#A78BFA", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4"],
    },
    fonts: {
      heading: "'Space Grotesk', 'Noto Sans TC', sans-serif",
      body: "'Inter', 'Noto Sans TC', sans-serif",
      mono: "JetBrains Mono, monospace",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+TC:wght@400;500;700&display=swap",
    canvaStylePrompt: "Dark futuristic tech presentation with neon cyan and purple accents on black background, high contrast, developer-oriented",
    personality: { titleAlign: "center", contentDensity: "normal", borderRadius: 12, shadowDepth: "medium", borderStyle: "thin", decorations: { titleUnderline: "none", sectionDivider: "none", accentShape: "triangle" }, cardEffect: "glass" },
  },
  // Modern Design
  {
    id: "glass",
    name: "Glassmorphism",
    nameZh: "玻璃擬態",
    category: "modern",
    isDark: true,
    colors: {
      bg: "linear-gradient(135deg, #667eea, #764ba2)",
      text: "#FFFFFF",
      accent: "rgba(255,255,255,0.9)",
      muted: "#94A3B8",
      cardBg: "rgba(30,41,59,0.85)",
      barColors: DEFAULT_BAR_COLORS,
    },
    fonts: {
      heading: "'Poppins', 'Noto Sans TC', sans-serif",
      body: "'Poppins', 'Noto Sans TC', sans-serif",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;700&display=swap",
    canvaStylePrompt: "Glassmorphism style with frosted glass cards, vibrant gradient backgrounds, blur effects, premium modern tech feel",
    personality: { titleAlign: "center", contentDensity: "spacious", borderRadius: 16, shadowDepth: "none", borderStyle: "thin", decorations: { titleUnderline: "accent-gradient", sectionDivider: "none", accentShape: "none" }, cardEffect: "glass" },
  },
  {
    id: "bento",
    name: "Bento Grid",
    nameZh: "便當格局",
    category: "modern",
    isDark: false,
    colors: {
      bg: "#F5F5F7",
      text: "#1D1D1F",
      accent: "#0071E3",
      muted: "#64748B",
      cardBg: "rgba(0,0,0,0.04)",
      barColors: DEFAULT_BAR_COLORS,
    },
    fonts: {
      heading: "'Inter', 'Noto Sans TC', sans-serif",
      body: "'Inter', 'Noto Sans TC', sans-serif",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;700&display=swap",
    canvaStylePrompt: "Apple-inspired Bento grid layout with modular rounded cards, clean typography, blue accent, product showcase style",
    personality: { titleAlign: "left", contentDensity: "compact", borderRadius: 12, shadowDepth: "subtle", borderStyle: "thin", decorations: { titleUnderline: "none", sectionDivider: "line", accentShape: "none" }, cardEffect: "solid" },
  },
  {
    id: "neobrutal",
    name: "Neobrutalism",
    nameZh: "新粗獷主義",
    category: "modern",
    isDark: false,
    colors: {
      bg: "#FFFFFF",
      text: "#000000",
      accent: "#FFDE59",
      secondary: "#FF6B6B",
      muted: "#64748B",
      cardBg: "rgba(0,0,0,0.04)",
      barColors: ["#3B82F6", "#FF6B6B", "#A78BFA", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4"],
    },
    fonts: {
      heading: "'Archivo Black', 'Noto Sans TC', sans-serif",
      body: "'Inter', 'Noto Sans TC', sans-serif",
      mono: "Space Mono, monospace",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600&family=Space+Mono:wght@400;700&family=Noto+Sans+TC:wght@400;500;700&display=swap",
    canvaStylePrompt: "Neobrutalist design with thick black borders, bold flat colors, hard drop shadows, quirky anti-design aesthetic",
    personality: { titleAlign: "left", contentDensity: "normal", borderRadius: 0, shadowDepth: "heavy", borderStyle: "thick", decorations: { titleUnderline: "none", sectionDivider: "none", accentShape: "square" }, cardEffect: "solid" },
  },
  {
    id: "editorial",
    name: "Editorial Magazine",
    nameZh: "編輯雜誌",
    category: "modern",
    isDark: false,
    colors: {
      bg: "#FAFAF9",
      text: "#1A1A1A",
      accent: "#B91C1C",
      muted: "#64748B",
      cardBg: "rgba(0,0,0,0.04)",
      barColors: DEFAULT_BAR_COLORS,
    },
    fonts: {
      heading: "'Playfair Display', 'Noto Serif TC', serif",
      body: "'Source Serif Pro', 'Noto Serif TC', serif",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Source+Serif+Pro:wght@400;600&family=Noto+Serif+TC:wght@400;600;700&display=swap",
    canvaStylePrompt: "Magazine editorial style with serif typography, asymmetric grids, pull quotes, sophisticated print-inspired layout",
    personality: { titleAlign: "left", contentDensity: "spacious", borderRadius: 2, shadowDepth: "none", borderStyle: "none", decorations: { titleUnderline: "thick", sectionDivider: "line", accentShape: "none" }, cardEffect: "solid" },
  },
  // Minimalist
  {
    id: "swiss",
    name: "Swiss Minimalist",
    nameZh: "瑞士極簡",
    category: "minimal",
    isDark: false,
    colors: {
      bg: "#FFFFFF",
      text: "#000000",
      accent: "#FF0000",
      muted: "#64748B",
      cardBg: "rgba(0,0,0,0.04)",
      barColors: DEFAULT_BAR_COLORS,
    },
    fonts: {
      heading: "'Helvetica Neue', 'Noto Sans TC', sans-serif",
      body: "'Helvetica Neue', 'Noto Sans TC', sans-serif",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap",
    canvaStylePrompt: "Swiss International Typographic Style, strict grid, extreme clarity, sans-serif only, red accent, mathematical precision",
    personality: { titleAlign: "center", contentDensity: "spacious", borderRadius: 0, shadowDepth: "none", borderStyle: "thin", decorations: { titleUnderline: "none", sectionDivider: "line", accentShape: "none" }, cardEffect: "solid" },
  },
  {
    id: "soft",
    name: "Soft Minimal",
    nameZh: "柔和極簡",
    category: "minimal",
    isDark: false,
    colors: {
      bg: "#FDF6F0",
      text: "#2D2D2D",
      accent: "#94A3B8",
      secondary: "#F0ABFC",
      muted: "#64748B",
      cardBg: "rgba(0,0,0,0.04)",
      barColors: ["#3B82F6", "#F0ABFC", "#A78BFA", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4"],
    },
    fonts: {
      heading: "'DM Sans', 'Noto Sans TC', sans-serif",
      body: "'Nunito', 'Noto Sans TC', sans-serif",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Nunito:wght@400;500;600&family=Noto+Sans+TC:wght@400;500;700&display=swap",
    canvaStylePrompt: "Soft warm minimalism with pastel tones, rounded shapes, warm white background, calm and approachable",
    personality: { titleAlign: "center", contentDensity: "spacious", borderRadius: 20, shadowDepth: "subtle", borderStyle: "none", decorations: { titleUnderline: "none", sectionDivider: "none", accentShape: "none" }, cardEffect: "solid" },
  },
  {
    id: "mono-bold",
    name: "Monochrome Bold",
    nameZh: "單色大字",
    category: "minimal",
    isDark: true,
    colors: {
      bg: "#000000",
      text: "#FFFFFF",
      accent: "#FF3D00",
      muted: "#94A3B8",
      cardBg: "rgba(30,41,59,0.85)",
      barColors: DEFAULT_BAR_COLORS,
    },
    fonts: {
      heading: "'Bebas Neue', 'Noto Sans TC', sans-serif",
      body: "'Inter', 'Noto Sans TC', sans-serif",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&family=Noto+Sans+TC:wght@400;500;700&display=swap",
    canvaStylePrompt: "Monochrome bold typography presentation, massive headings, black and white with single accent color, TED-talk style",
    personality: { titleAlign: "center", contentDensity: "normal", borderRadius: 4, shadowDepth: "medium", borderStyle: "thick", decorations: { titleUnderline: "none", sectionDivider: "none", accentShape: "none" }, cardEffect: "solid" },
  },
  // Data & Analytics
  {
    id: "dashboard",
    name: "Dashboard Analyst",
    nameZh: "儀表板分析",
    category: "data",
    isDark: true,
    colors: {
      bg: "#1E293B",
      text: "#FFFFFF",
      accent: "#3B82F6",
      secondary: "#10B981",
      muted: "#94A3B8",
      cardBg: "rgba(30,41,59,0.85)",
      barColors: ["#3B82F6", "#10B981", "#A78BFA", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4"],
    },
    fonts: {
      heading: "'Roboto', 'Noto Sans TC', sans-serif",
      body: "'Roboto', 'Noto Sans TC', sans-serif",
      mono: "Roboto Mono, monospace",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400;500&family=Noto+Sans+TC:wght@400;500;700&display=swap",
    canvaStylePrompt: "Dark dashboard analytics style with KPI cards, multiple chart types, traffic-light indicators, data-dense professional layout",
    personality: { titleAlign: "left", contentDensity: "compact", borderRadius: 8, shadowDepth: "medium", borderStyle: "thin", decorations: { titleUnderline: "none", sectionDivider: "line", accentShape: "none" }, cardEffect: "glass" },
  },
  {
    id: "infographic",
    name: "Infographic Story",
    nameZh: "資訊圖表故事",
    category: "data",
    isDark: false,
    colors: {
      bg: "#FFFFFF",
      text: "#1A1A1A",
      accent: "#2563EB",
      secondary: "#7C3AED",
      muted: "#64748B",
      cardBg: "rgba(0,0,0,0.04)",
      barColors: ["#3B82F6", "#7C3AED", "#A78BFA", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4"],
    },
    fonts: {
      heading: "'Poppins', 'Noto Sans TC', sans-serif",
      body: "'Open Sans', 'Noto Sans TC', sans-serif",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Open+Sans:wght@400;500;600&family=Noto+Sans+TC:wght@400;500;700&display=swap",
    canvaStylePrompt: "Infographic storytelling with icon-driven data, process flows, large statistics, vibrant but coordinated color palette",
    personality: { titleAlign: "center", contentDensity: "normal", borderRadius: 12, shadowDepth: "subtle", borderStyle: "none", decorations: { titleUnderline: "none", sectionDivider: "dots", accentShape: "circle" }, cardEffect: "solid" },
  },
  // Education
  {
    id: "academic",
    name: "Academic Formal",
    nameZh: "學術正式",
    category: "education",
    isDark: false,
    colors: {
      bg: "#FFFFFF",
      text: "#1A1A1A",
      accent: "#1E3A5F",
      secondary: "#C41E3A",
      muted: "#64748B",
      cardBg: "rgba(0,0,0,0.04)",
      barColors: ["#3B82F6", "#C41E3A", "#A78BFA", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4"],
    },
    fonts: {
      heading: "'Source Serif Pro', 'Noto Serif TC', serif",
      body: "'Calibri', 'Noto Sans TC', sans-serif",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Source+Serif+Pro:wght@400;600;700&family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@400;600;700&display=swap",
    canvaStylePrompt: "Academic formal style with assertion-evidence format, consistent template, citation footnotes, conference presentation format",
    personality: { titleAlign: "left", contentDensity: "normal", borderRadius: 4, shadowDepth: "subtle", borderStyle: "thin", decorations: { titleUnderline: "thick", sectionDivider: "line", accentShape: "none" }, cardEffect: "solid" },
  },
  {
    id: "classroom",
    name: "Classroom Friendly",
    nameZh: "教室親和",
    category: "education",
    isDark: false,
    colors: {
      bg: "#FFF7ED",
      text: "#1E40AF",
      accent: "#DC2626",
      secondary: "#16A34A",
      muted: "#64748B",
      cardBg: "rgba(0,0,0,0.04)",
      barColors: ["#3B82F6", "#16A34A", "#A78BFA", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4"],
    },
    fonts: {
      heading: "'Huninn', 'Noto Sans TC', sans-serif",
      body: "'DM Sans', 'Noto Sans TC', sans-serif",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Huninn&family=Noto+Sans+TC:wght@400;500;700&display=swap",
    canvaStylePrompt: "Classroom-friendly educational style with large fonts, high contrast, chunky icons, section color-coding, warm and engaging",
    personality: { titleAlign: "left", contentDensity: "spacious", borderRadius: 12, shadowDepth: "subtle", borderStyle: "accent-left", decorations: { titleUnderline: "none", sectionDivider: "dots", accentShape: "none" }, cardEffect: "solid" },
  },
  // Japanese / Asian
  {
    id: "takahashi",
    name: "Takahashi Method",
    nameZh: "高橋流",
    category: "asian",
    isDark: false,
    colors: {
      bg: "#FFFFFF",
      text: "#000000",
      accent: "#C41E3A",
      muted: "#64748B",
      cardBg: "rgba(0,0,0,0.04)",
      barColors: DEFAULT_BAR_COLORS,
    },
    fonts: {
      heading: "Noto Sans TC, sans-serif",
      body: "Inter, sans-serif",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=Inter:wght@400;500;600&display=swap",
    canvaStylePrompt: "Takahashi method with giant text, one idea per slide, extreme simplicity, black on white, rapid-fire presentation style",
    personality: { titleAlign: "center", contentDensity: "spacious", borderRadius: 0, shadowDepth: "none", borderStyle: "none", decorations: { titleUnderline: "none", sectionDivider: "none", accentShape: "none" }, cardEffect: "solid" },
  },
  {
    id: "zen",
    name: "Zen Harmony",
    nameZh: "禪意和風",
    category: "asian",
    isDark: false,
    colors: {
      bg: "#F5F0EB",
      text: "#3D3D3D",
      accent: "#8B7355",
      secondary: "#6B8E6B",
      muted: "#64748B",
      cardBg: "rgba(0,0,0,0.04)",
      barColors: ["#3B82F6", "#6B8E6B", "#A78BFA", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4"],
    },
    fonts: {
      heading: "Noto Serif TC, serif",
      body: "Noto Sans TC, sans-serif",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;600;700&family=Noto+Sans+TC:wght@400;500;600&display=swap",
    canvaStylePrompt: "Zen harmony wabi-sabi inspired with muted earth tones, generous negative space, nature imagery, calming meditative feel",
    personality: { titleAlign: "center", contentDensity: "spacious", borderRadius: 12, shadowDepth: "none", borderStyle: "none", decorations: { titleUnderline: "none", sectionDivider: "dots", accentShape: "none" }, cardEffect: "solid" },
  },
  // Government / Institutional
  {
    id: "gov-official",
    name: "Government Official",
    nameZh: "政府公務",
    category: "institutional",
    isDark: false,
    colors: {
      bg: "#FFFFFF",
      text: "#1A1A1A",
      accent: "#003366",
      secondary: "#006633",
      muted: "#64748B",
      cardBg: "rgba(0,0,0,0.04)",
      barColors: ["#3B82F6", "#006633", "#A78BFA", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4"],
    },
    fonts: {
      heading: "Noto Sans TC, sans-serif",
      body: "Noto Sans TC, sans-serif",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap",
    canvaStylePrompt: "Government official presentation style, formal structured layout, blue header, traffic-light status indicators, conservative authoritative",
    personality: { titleAlign: "left", contentDensity: "normal", borderRadius: 4, shadowDepth: "subtle", borderStyle: "thin", decorations: { titleUnderline: "thick", sectionDivider: "line", accentShape: "none" }, cardEffect: "solid" },
  },
  {
    id: "institutional",
    name: "Institutional Trust",
    nameZh: "機構信賴",
    category: "institutional",
    isDark: false,
    colors: {
      bg: "#FFFFFF",
      text: "#1A1A1A",
      accent: "#1B365D",
      secondary: "#B8860B",
      muted: "#64748B",
      cardBg: "rgba(0,0,0,0.04)",
      barColors: ["#3B82F6", "#B8860B", "#A78BFA", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4"],
    },
    fonts: {
      heading: "'Merriweather', 'Noto Sans TC', serif",
      body: "'Open Sans', 'Noto Sans TC', sans-serif",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Open+Sans:wght@400;500;600&family=Noto+Sans+TC:wght@400;500;700&display=swap",
    canvaStylePrompt: "Institutional trust style with understated professionalism, navy and gold accents, structured grids, conservative typography",
    personality: { titleAlign: "left", contentDensity: "normal", borderRadius: 8, shadowDepth: "subtle", borderStyle: "accent-left", decorations: { titleUnderline: "thin", sectionDivider: "line", accentShape: "none" }, cardEffect: "solid" },
  },
  // Creative
  {
    id: "aurora",
    name: "Gradient Aurora",
    nameZh: "極光漸層",
    category: "creative",
    isDark: true,
    colors: {
      bg: "linear-gradient(135deg, #667eea, #764ba2, #f093fb)",
      text: "#FFFFFF",
      accent: "#FFFFFF",
      muted: "#94A3B8",
      cardBg: "rgba(30,41,59,0.85)",
      barColors: DEFAULT_BAR_COLORS,
    },
    fonts: {
      heading: "'Outfit', 'Noto Sans TC', sans-serif",
      body: "'Sora', 'Noto Sans TC', sans-serif",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Sora:wght@400;500;600&family=Noto+Sans+TC:wght@400;500;700&display=swap",
    canvaStylePrompt: "Aurora gradient style with vivid shifting gradient backgrounds, white text, floating elements, dreamy immersive atmosphere",
    personality: { titleAlign: "center", contentDensity: "spacious", borderRadius: 20, shadowDepth: "medium", borderStyle: "none", decorations: { titleUnderline: "accent-gradient", sectionDivider: "none", accentShape: "wave" }, cardEffect: "glass" },
  },
  {
    id: "noir",
    name: "Premium Noir",
    nameZh: "尊爵黑金",
    category: "creative",
    isDark: true,
    colors: {
      bg: "#0A0A0A",
      text: "#FFFFFF",
      accent: "#D4AF37",
      muted: "#94A3B8",
      cardBg: "rgba(30,41,59,0.85)",
      barColors: DEFAULT_BAR_COLORS,
    },
    fonts: {
      heading: "'Cormorant Garamond', 'Noto Serif TC', serif",
      body: "'Montserrat', 'Noto Sans TC', sans-serif",
    },
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Montserrat:wght@400;500;600&family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@400;600;700&display=swap",
    canvaStylePrompt: "Premium noir luxury style with black background, gold metallic accents, elegant thin borders, dramatic and exclusive",
    personality: { titleAlign: "center", contentDensity: "normal", borderRadius: 8, shadowDepth: "medium", borderStyle: "thin", decorations: { titleUnderline: "thin", sectionDivider: "line", accentShape: "none" }, cardEffect: "solid" },
  },
];

export function getThemeById(id: string): PresentationTheme | undefined {
  return PRESENTATION_THEMES.find((t) => t.id === id);
}

export function getThemesByCategory(category: ThemeCategory): PresentationTheme[] {
  return PRESENTATION_THEMES.filter((t) => t.category === category);
}
