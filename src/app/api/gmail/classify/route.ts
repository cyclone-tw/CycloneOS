// dashboard/src/app/api/gmail/classify/route.ts
import { type NextRequest } from "next/server";
import { getGmailClient, parseThreadMessage } from "@/lib/gmail-client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const LABEL_CATEGORIES = [
  { id: "公務", description: "學校行政、公文、會議通知" },
  { id: "家長", description: "家長聯繫、親師溝通" },
  { id: "行政", description: "差假、報支、系統通知" },
  { id: "個人", description: "個人事務、訂閱、社群" },
  { id: "重要", description: "需要盡快處理或回覆" },
  { id: "資訊", description: "純資訊通知，不需回覆" },
] as const;

async function callGemini(prompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.3,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export async function POST(request: NextRequest) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }

  const gmail = getGmailClient();
  if (!gmail) {
    return Response.json({ error: "Gmail not configured" }, { status: 503 });
  }

  try {
    const { threadId, generateReply } = (await request.json()) as {
      threadId: string;
      generateReply?: boolean;
    };
    if (!threadId) {
      return Response.json({ error: "threadId is required" }, { status: 400 });
    }

    // Fetch thread content
    const res = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });
    const messages = (res.data.messages ?? []).map(parseThreadMessage);

    const mailContext = messages
      .map(
        (m) =>
          `From: ${m.from}\nDate: ${m.date}\nSubject: ${m.subject}\n\n${m.body.slice(0, 2000)}`
      )
      .join("\n---\n");

    const prompt = generateReply
      ? `你是一位特教資源班老師的郵件助理。請分析以下郵件對話串，並生成一份專業、友善的回覆草稿。

重要：無論郵件是否需要回覆，你都必須在 draft 欄位生成一份合適的回覆內容。即使是推廣郵件或通知，也請生成一份簡短的禮貌回覆。

郵件內容：
${mailContext}

請回傳以下 JSON 格式（不要加 markdown code block）：
{"labels": [{"id": "分類名", "confidence": 0.0-1.0}], "summary": "一句話摘要", "needsReply": true/false, "urgency": "high/medium/low", "draft": "回覆草稿內容（繁體中文，語氣專業友善，不可為空）"}

可用分類：${LABEL_CATEGORIES.map((c) => c.id).join("、")}`
      : `你是一位特教資源班老師的郵件助理。請分析以下郵件對話串，回傳 JSON 格式的分類建議。

可用分類：
${LABEL_CATEGORIES.map((c) => `- ${c.id}：${c.description}`).join("\n")}

郵件內容：
${mailContext}

請回傳以下 JSON 格式（不要加 markdown code block）：
{"labels": [{"id": "分類名", "confidence": 0.0-1.0}], "summary": "一句話摘要", "needsReply": true/false, "urgency": "high/medium/low"}`;

    const text = await callGemini(prompt, generateReply ? 1000 : 500);

    // Parse JSON from response — strip markdown code blocks if present
    let cleaned = text.trim();
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) cleaned = codeBlockMatch[1].trim();

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      result = jsonMatch
        ? JSON.parse(jsonMatch[0])
        : { labels: [], summary: cleaned, needsReply: false, urgency: "low" };
    }

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
