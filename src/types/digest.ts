export interface DigestLink {
  topic: string;
  title: string;
  source: string;
  description: string;
  url: string;
}

export interface MailCategory {
  label: string;
  count: number;
  items: string[];
}

export interface YtEntry {
  title: string;
  channel: string;
  url: string;
  date: string;
  topics: string[];
}

export interface DailyInfoData {
  date: string;
  links: DigestLink[];
}

export interface MailReportData {
  date: string;
  time: string;
  unreadCount: number;
  actionRequired: number;
  categories: MailCategory[];
}

export interface WeeklyReviewData {
  date: string;
  week: string;
  highlights: string[];
  path: string;
}

export interface DigestData {
  dailyInfo: DailyInfoData | null;
  mailReport: MailReportData | null;
  weeklyReview: WeeklyReviewData | null;
  ytSummaries: YtEntry[];
}
