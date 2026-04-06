// src/components/skills/workstations/social/platform-preview.tsx
"use client";

import { useState } from "react";
import { Check, Copy, BookOpen, ExternalLink } from "lucide-react";
import { useSocialStore } from "@/stores/social-store";
import type { Platform } from "@/lib/social/prompts";
import type { GeneratedContents } from "@/stores/social-store";

const PLATFORM_LABEL: Record<string, string> = {
  fb: "FB",
  ig: "IG",
  line: "LINE",
  school: "學校",
  notion: "Notion",
};

type ContentKey = keyof GeneratedContents;

export function PlatformPreview() {
  const {
    generatedContents,
    activePreviewTab,
    setActivePreviewTab,
    platforms,
    images,
    isPublishing,
    setPublishing,
    setLastPublishedUrl,
    lastPublishedUrl,
    setError,
    updateGeneratedContent,
    sourceLabel,
    sourceText,
  } = useSocialStore();

  const [copied, setCopied] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Build list of tabs that have content
  const availableTabs = platforms.filter(
    (p) => generatedContents?.[p as ContentKey]
  ) as Platform[];

  if (!generatedContents || availableTabs.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-cy-border bg-cy-input">
        <p className="text-sm text-cy-muted">在左側輸入素材並點擊「生成貼文」</p>
      </div>
    );
  }

  // Ensure activePreviewTab is valid
  const currentTab = availableTabs.includes(activePreviewTab as Platform)
    ? (activePreviewTab as Platform)
    : availableTabs[0];
  const currentContent = generatedContents[currentTab as ContentKey] ?? "";
  const hashtags = generatedContents.hashtags ?? "";
  const hashtagArray = Array.isArray(hashtags)
    ? (hashtags as string[])
    : typeof hashtags === "string" && hashtags.trim()
    ? hashtags
        .split(/[\s,]+/)
        .map((h) => h.replace(/^#/, ""))
        .filter(Boolean)
    : [];

  const showHashtags = (currentTab === "fb" || currentTab === "ig") && hashtagArray.length > 0;

  const handleCopy = async () => {
    let text = currentContent;
    if (showHashtags && hashtagArray.length > 0) {
      text += "\n\n" + hashtagArray.map((h) => `#${h}`).join(" ");
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePublishNotion = async () => {
    setPublishing(true);
    setPublishError(null);
    setError(null);

    try {
      // 1. Upload unuploaded images
      const uploadedUrls: string[] = [];
      for (const img of images) {
        if (img.uploadedUrl) {
          uploadedUrls.push(img.uploadedUrl);
        } else {
          const formData = new FormData();
          formData.append("images", img.file);
          const uploadRes = await fetch("/api/social/upload-image", {
            method: "POST",
            body: formData,
          });
          const uploadData = (await uploadRes.json()) as { urls?: string[]; error?: string };
          if (uploadData.urls) {
            uploadedUrls.push(...uploadData.urls);
          }
        }
      }

      // 2. Build contents object from generated content
      const contents: Partial<Record<Platform, string>> = {};
      for (const p of platforms) {
        const text = generatedContents[p as ContentKey];
        if (typeof text === "string" && text) {
          contents[p] = text;
        }
      }

      // 3. POST to publish-notion
      const title = sourceLabel || "社群貼文 " + new Date().toLocaleDateString("zh-TW");
      const body = {
        title,
        platforms,
        contents,
        hashtags: hashtagArray,
        imageUrls: uploadedUrls,
        source: sourceText.slice(0, 200),
      };

      const res = await fetch("/api/social/publish-notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { notionUrl?: string; error?: string };

      if (data.notionUrl) {
        setLastPublishedUrl(data.notionUrl);
      } else {
        const errMsg = data.error ?? "發布失敗";
        setPublishError(errMsg);
        setError(errMsg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "發布失敗";
      setPublishError(msg);
      setError(msg);
    } finally {
      setPublishing(false);
    }
  };

  const tabBase = "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors";
  const activeTabCls = `${tabBase} bg-cy-card text-cy-text shadow-sm`;
  const inactiveTabCls = `${tabBase} text-cy-muted hover:text-cy-text`;

  return (
    <div className="flex flex-col gap-3">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-cy-input p-1 w-fit flex-wrap">
        {availableTabs.map((p) => (
          <button
            key={p}
            onClick={() => setActivePreviewTab(p)}
            className={currentTab === p ? activeTabCls : inactiveTabCls}
          >
            {PLATFORM_LABEL[p] ?? p}
          </button>
        ))}
      </div>

      {/* Editable textarea */}
      <textarea
        className="w-full min-h-[200px] rounded-lg border border-cy-border bg-cy-input px-3 py-2 text-sm text-cy-text resize-y focus:outline-none focus:ring-1 focus:ring-cy-accent"
        value={currentContent}
        onChange={(e) => updateGeneratedContent(currentTab as ContentKey, e.target.value)}
      />

      {/* Hashtags */}
      {showHashtags && (
        <div className="flex flex-wrap gap-1.5">
          {hashtagArray.map((h, i) => (
            <span key={i} className="text-xs text-cy-accent font-medium">
              #{h}
            </span>
          ))}
        </div>
      )}

      {/* Image thumbnail strip */}
      {images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={img.id}
              src={img.previewUrl}
              alt=""
              className="h-14 w-14 flex-shrink-0 rounded-lg border border-cy-border object-cover"
            />
          ))}
        </div>
      )}

      {/* Publish error */}
      {publishError && (
        <p className="text-xs text-cy-error">{publishError}</p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {/* Copy */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg border border-cy-border bg-cy-input px-3 py-2 text-xs font-medium text-cy-text hover:bg-cy-card transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "已複製" : "複製文字"}
        </button>

        {/* Publish to Notion */}
        <button
          onClick={handlePublishNotion}
          disabled={isPublishing}
          className="flex items-center gap-1.5 rounded-lg border border-cy-border bg-cy-input px-3 py-2 text-xs font-medium text-cy-text hover:bg-cy-card transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <BookOpen className="h-3.5 w-3.5" />
          {isPublishing ? "儲存中…" : "存到 Notion"}
        </button>

        {/* Notion link (after publish) */}
        {lastPublishedUrl && (
          <a
            href={lastPublishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-cy-accent/50 bg-cy-accent/10 px-3 py-2 text-xs font-medium text-cy-accent hover:bg-cy-accent/20 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            開啟 Notion
          </a>
        )}
      </div>
    </div>
  );
}
