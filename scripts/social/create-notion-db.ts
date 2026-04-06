// scripts/social/create-notion-db.ts
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const API_KEY = process.env.NOTION_API_KEY;

if (!API_KEY) {
  console.error("Missing NOTION_API_KEY in .env.local");
  process.exit(1);
}

async function createDatabase() {
  const searchRes = await fetch(`${NOTION_API}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: "CycloneOS",
      filter: { value: "page", property: "object" },
      page_size: 5,
    }),
  });

  const searchData = await searchRes.json();
  let parentPage = searchData.results?.[0];

  if (!parentPage) {
    // Fallback: search all accessible pages and pick the first one
    console.warn("No 'CycloneOS' page found, searching all accessible pages...");
    const fallbackRes = await fetch(`${NOTION_API}/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: "Cyclone",
        filter: { value: "page", property: "object" },
        page_size: 1,
      }),
    });
    const fallbackData = await fallbackRes.json();
    parentPage = fallbackData.results?.[0];
  }

  if (!parentPage) {
    console.error("No parent page found. Create a 'CycloneOS' page in Notion first, or share any page with the integration.");
    process.exit(1);
  }

  console.log(`Using parent page: ${parentPage.id}`);

  const dbBody = {
    parent: { page_id: parentPage.id },
    title: [{ text: { content: "社群發文" } }],
    properties: {
      Title: { title: {} },
      Status: {
        status: {
          options: [
            { name: "草稿", color: "gray" },
            { name: "待發布", color: "yellow" },
            { name: "已發布", color: "green" },
            { name: "失敗", color: "red" },
          ],
        },
      },
      Platforms: {
        multi_select: {
          options: [
            { name: "FB", color: "blue" },
            { name: "IG", color: "purple" },
            { name: "LINE", color: "green" },
            { name: "學校網站", color: "orange" },
            { name: "Notion", color: "default" },
          ],
        },
      },
      Published: {
        multi_select: {
          options: [
            { name: "FB", color: "blue" },
            { name: "IG", color: "purple" },
            { name: "LINE", color: "green" },
            { name: "學校網站", color: "orange" },
            { name: "Notion", color: "default" },
          ],
        },
      },
      "Publish Date": { date: {} },
      Tags: {
        multi_select: {
          options: [
            { name: "特教宣導", color: "blue" },
            { name: "IEP技巧", color: "green" },
            { name: "活動紀錄", color: "yellow" },
            { name: "研習心得", color: "purple" },
            { name: "法規更新", color: "red" },
          ],
        },
      },
      Tone: {
        select: {
          options: [
            { name: "知識分享", color: "blue" },
            { name: "日常", color: "green" },
            { name: "活動宣傳", color: "yellow" },
          ],
        },
      },
      Source: { rich_text: {} },
      "Content FB": { rich_text: {} },
      "Content IG": { rich_text: {} },
      "Content LINE": { rich_text: {} },
      "Content School": { rich_text: {} },
      Hashtags: { rich_text: {} },
      "Image URLs": { rich_text: {} },
      "Error Log": { rich_text: {} },
    },
  };

  const createRes = await fetch(`${NOTION_API}/databases`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dbBody),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error("Failed to create database:", createRes.status, err);
    process.exit(1);
  }

  const db = await createRes.json();
  console.log(`\n✅ Database created!`);
  console.log(`   ID: ${db.id}`);
  console.log(`   URL: ${db.url}`);
  console.log(`\nAdd this to .env.local:`);
  console.log(`NOTION_SOCIAL_DATABASE_ID=${db.id.replace(/-/g, "")}`);
}

createDatabase().catch(console.error);
