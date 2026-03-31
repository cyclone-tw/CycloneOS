#!/usr/bin/env node
// Usage: node scripts/get-gmail-token.mjs <CLIENT_ID> <CLIENT_SECRET>
// Opens browser for OAuth consent, then prints the refresh token.

import http from "node:http";
import { google } from "googleapis";

const [clientId, clientSecret] = process.argv.slice(2);

if (!clientId || !clientSecret) {
  console.error("Usage: node scripts/get-gmail-token.mjs <CLIENT_ID> <CLIENT_SECRET>");
  process.exit(1);
}

const REDIRECT_URI = "http://localhost:3456/callback";
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.labels",
];

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: SCOPES,
});

console.log("\n📧 Gmail OAuth Setup\n");
console.log("1. Opening browser for authorization...");
console.log("   If browser doesn't open, visit:\n");
console.log(`   ${authUrl}\n`);

// Open browser
import("node:child_process").then(({ exec }) => {
  exec(`open "${authUrl}"`);
});

// Start local server to catch the callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:3456`);
  if (!url.pathname.startsWith("/callback")) {
    res.writeHead(404);
    res.end();
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400);
    res.end("Missing code parameter");
    return;
  }

  try {
    const { tokens } = await oauth2.getToken(code);

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <html><body style="font-family:system-ui;padding:40px;background:#1a1a2e;color:#e0e0e0">
        <h1 style="color:#4ecdc4">✅ 授權成功！</h1>
        <p>Refresh token 已顯示在 terminal，可以關閉此頁面。</p>
      </body></html>
    `);

    console.log("\n✅ Authorization successful!\n");
    console.log("2. Add these to your .env.local:\n");
    console.log(`GOOGLE_CLIENT_ID=${clientId}`);
    console.log(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log("");

    server.close();
    process.exit(0);
  } catch (err) {
    res.writeHead(500);
    res.end("Token exchange failed: " + err.message);
    console.error("Error:", err.message);
    server.close();
    process.exit(1);
  }
});

server.listen(3456, () => {
  console.log("2. Waiting for authorization callback on port 3456...\n");
});
