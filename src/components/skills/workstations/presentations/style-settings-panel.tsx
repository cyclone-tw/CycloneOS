"use client";

import { RotateCcw } from "lucide-react";
import { usePresentationsStore } from "@/stores/presentations-store";
import type {
  CustomParams,
  AnimationLevel,
  SlideAnimation,
  BadgePosition,
  TextAlign,
} from "@/stores/presentations-store";
import { ANIMATION_DEFAULTS } from "@/lib/slide-animation-defaults";
import { ThemePicker } from "./theme-picker";

function ParamSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-cy-muted w-16 shrink-0">{label}</span>
      <input
        type="range"
        min={0.5}
        max={2.0}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 accent-cy-accent"
      />
      <span className="text-xs text-cy-muted w-10 text-right tabular-nums">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

export function StyleSettingsPanel() {
  const session = usePresentationsStore((s) => s.getActiveSession());
  const setCardStyle = usePresentationsStore((s) => s.setCardStyle);
  const setCustomParam = usePresentationsStore((s) => s.setCustomParam);
  const resetCustomParams = usePresentationsStore((s) => s.resetCustomParams);
  const setSlideCustomParam = usePresentationsStore((s) => s.setSlideCustomParam);
  const resetSlideCustomParams = usePresentationsStore((s) => s.resetSlideCustomParams);
  const setAnimationLevel = usePresentationsStore((s) => s.setAnimationLevel);
  const setSlideAnimation = usePresentationsStore((s) => s.setSlideAnimation);
  const resetSlideAnimation = usePresentationsStore((s) => s.resetSlideAnimation);
  const setBadgePosition = usePresentationsStore((s) => s.setBadgePosition);
  const setTextAlign = usePresentationsStore((s) => s.setTextAlign);
  const setSlideImageLayout = usePresentationsStore((s) => s.setSlideImageLayout);
  const setSlideImage = usePresentationsStore((s) => s.setSlideImage);
  const removeSlideImage = usePresentationsStore((s) => s.removeSlideImage);

  if (!session) return null;

  const { cardStyle, customParams } = session.slideSettings;
  const animationLevel = session.slideSettings.animationLevel ?? "moderate";
  const selectedSlideId = session.selectedSlideId;
  const selectedSlide = session.outline.slides.find((s) => s.id === selectedSlideId);
  const selectedAnimation = selectedSlide
    ? (selectedSlide.animation ?? ANIMATION_DEFAULTS[selectedSlide.content.slideType])
    : null;
  const hasCustomAnimation = selectedSlide?.animation !== undefined;
  const selectedBadgePos = selectedSlide?.content.badgePosition ?? "top-center";
  const selectedTextAlign = selectedSlide?.content.textAlign ?? "center";
  const selectedLayout = selectedSlide?.content.layout;
  const layoutMode = selectedLayout?.mode ?? "default";
  const layoutImage = selectedLayout?.image;
  const splitRatio = selectedLayout?.splitRatio ?? 50;
  const imagePosition = selectedLayout?.imagePosition ?? (layoutMode === "split-vertical" ? "top" : "right");

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedSlideId) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSlideImage(selectedSlideId, { base64 });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="border-t border-cy-border/30 pt-3 mt-3">
      <h4 className="text-xs font-medium text-cy-muted uppercase tracking-wider mb-3">
        樣式調整
      </h4>

      {/* Theme picker — allows switching theme during editing */}
      <ThemePicker />

      {/* Card style toggle */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-cy-muted w-16 shrink-0">卡片風格</span>
        <div className="flex rounded-md overflow-hidden border border-cy-border/30">
          <button
            onClick={() => setCardStyle("solid")}
            className={`px-3 py-1 text-xs transition-colors ${
              cardStyle === "solid"
                ? "bg-cy-accent/20 text-cy-accent"
                : "text-cy-muted hover:bg-cy-input/50"
            }`}
          >
            實色
          </button>
          <button
            onClick={() => setCardStyle("glass")}
            className={`px-3 py-1 text-xs transition-colors ${
              cardStyle === "glass"
                ? "bg-cy-accent/20 text-cy-accent"
                : "text-cy-muted hover:bg-cy-input/50"
            }`}
          >
            玻璃
          </button>
        </div>
      </div>

      {/* Per-slide sliders (when a slide is selected) */}
      {selectedSlideId && selectedSlide && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-cy-accent">此頁調整</span>
            {selectedSlide.customParams && (
              <button
                onClick={() => resetSlideCustomParams(selectedSlideId)}
                className="text-[10px] text-cy-muted hover:text-cy-accent transition-colors"
              >
                ↺ 重設此頁
              </button>
            )}
          </div>
          <div className="space-y-2">
            <ParamSlider
              label="標題大小"
              value={selectedSlide.customParams?.titleScale ?? customParams.titleScale}
              onChange={(v) => setSlideCustomParam(selectedSlideId, "titleScale", v)}
            />
            <ParamSlider
              label="副標大小"
              value={selectedSlide.customParams?.subtitleScale ?? customParams.subtitleScale}
              onChange={(v) => setSlideCustomParam(selectedSlideId, "subtitleScale", v)}
            />
            <ParamSlider
              label="內文大小"
              value={selectedSlide.customParams?.bodyScale ?? customParams.bodyScale}
              onChange={(v) => setSlideCustomParam(selectedSlideId, "bodyScale", v)}
            />
            <ParamSlider
              label="卡片大小"
              value={selectedSlide.customParams?.cardScale ?? customParams.cardScale}
              onChange={(v) => setSlideCustomParam(selectedSlideId, "cardScale", v)}
            />
            <ParamSlider
              label="徽章大小"
              value={selectedSlide.customParams?.badgeScale ?? customParams.badgeScale}
              onChange={(v) => setSlideCustomParam(selectedSlideId, "badgeScale", v)}
            />
          </div>
        </div>
      )}

      {/* Global sliders */}
      <details className="mb-1">
        <summary className="text-xs text-cy-muted cursor-pointer hover:text-cy-text transition-colors">
          全域調整（影響所有頁面）
        </summary>
        <div className="space-y-2 mt-2">
          <ParamSlider
            label="標題大小"
            value={customParams.titleScale}
            onChange={(v) => setCustomParam("titleScale", v)}
          />
          <ParamSlider
            label="副標大小"
            value={customParams.subtitleScale}
            onChange={(v) => setCustomParam("subtitleScale", v)}
          />
          <ParamSlider
            label="內文大小"
            value={customParams.bodyScale}
            onChange={(v) => setCustomParam("bodyScale", v)}
          />
          <ParamSlider
            label="卡片大小"
            value={customParams.cardScale}
            onChange={(v) => setCustomParam("cardScale", v)}
          />
          <ParamSlider
            label="間距"
            value={customParams.spacingScale}
            onChange={(v) => setCustomParam("spacingScale", v)}
          />
          <ParamSlider
            label="徽章大小"
            value={customParams.badgeScale}
            onChange={(v) => setCustomParam("badgeScale", v)}
          />
        </div>
      </details>

      {/* Animation Level */}
      <div className="border-t border-cy-border/30 pt-3 mt-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-cy-muted w-16 shrink-0">動畫強度</span>
          <div className="flex rounded-md overflow-hidden border border-cy-border/30">
            {(
              [
                { value: "none", label: "無" },
                { value: "subtle", label: "輕微" },
                { value: "moderate", label: "適中" },
                { value: "dynamic", label: "豐富" },
              ] as { value: AnimationLevel; label: string }[]
            ).map((lvl) => (
              <button
                key={lvl.value}
                onClick={() => setAnimationLevel(lvl.value)}
                className={`px-2 py-1 text-xs transition-colors ${
                  animationLevel === lvl.value
                    ? "bg-cy-accent/20 text-cy-accent"
                    : "text-cy-muted hover:bg-cy-input/50"
                }`}
              >
                {lvl.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Per-slide animation (only when selected + animation enabled) */}
      {selectedSlideId && selectedAnimation && animationLevel !== "none" && (
        <div className="border-t border-cy-border/30 pt-3 mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-cy-muted">選中 Slide 動畫</span>
            {hasCustomAnimation && (
              <button
                onClick={() => resetSlideAnimation(selectedSlideId)}
                className="text-[10px] text-cy-muted hover:text-cy-accent transition-colors"
              >
                ↺ 重設
              </button>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-cy-muted">進場效果</span>
              <select
                value={selectedAnimation.entrance}
                onChange={(e) => setSlideAnimation(selectedSlideId, { entrance: e.target.value as SlideAnimation["entrance"] })}
                className="bg-cy-input/50 text-cy-text text-xs rounded px-2 py-1 border border-cy-border/30"
              >
                <option value="fade">淡入</option>
                <option value="slide-up">上滑</option>
                <option value="slide-left">左滑</option>
                <option value="zoom">縮放</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-cy-muted">片段動畫</span>
              <select
                value={selectedAnimation.fragmentStyle}
                onChange={(e) => setSlideAnimation(selectedSlideId, { fragmentStyle: e.target.value as SlideAnimation["fragmentStyle"] })}
                className="bg-cy-input/50 text-cy-text text-xs rounded px-2 py-1 border border-cy-border/30"
              >
                <option value="fade">淡入</option>
                <option value="slide-up">上滑</option>
                <option value="slide-left">左滑</option>
                <option value="flip">翻轉</option>
                <option value="zoom">縮放</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-cy-muted">速度</span>
              <select
                value={selectedAnimation.speed}
                onChange={(e) => setSlideAnimation(selectedSlideId, { speed: e.target.value as SlideAnimation["speed"] })}
                className="bg-cy-input/50 text-cy-text text-xs rounded px-2 py-1 border border-cy-border/30"
              >
                <option value="slow">慢</option>
                <option value="normal">正常</option>
                <option value="fast">快</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Disabled message */}
      {selectedSlideId && animationLevel === "none" && (
        <div className="border-t border-cy-border/30 pt-3 mt-3">
          <p className="text-xs text-cy-muted/50 italic">動畫已關閉</p>
        </div>
      )}

      {/* Layout Mode (per-slide) */}
      {selectedSlideId && (
        <div className="border-t border-cy-border/30 pt-3 mt-3">
          <span className="text-xs text-cy-muted mb-2 block">佈局模式</span>
          <div className="flex rounded-md overflow-hidden border border-cy-border/30 mb-2">
            {(
              [
                { value: "default", label: "預設" },
                { value: "split-horizontal", label: "左右分割" },
                { value: "split-vertical", label: "上下分割" },
                { value: "image-overlay", label: "圖片覆蓋" },
              ] as { value: string; label: string }[]
            ).map((m) => (
              <button
                key={m.value}
                onClick={() =>
                  setSlideImageLayout(selectedSlideId, {
                    mode: m.value as "default" | "split-horizontal" | "split-vertical" | "image-overlay",
                  })
                }
                className={`px-2 py-1 text-xs transition-colors flex-1 ${
                  layoutMode === m.value
                    ? "bg-cy-accent/20 text-cy-accent"
                    : "text-cy-muted hover:bg-cy-input/50"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Image Settings — shown when not default */}
          {layoutMode !== "default" && (
            <div className="space-y-3 mt-3 p-3 rounded-lg bg-cy-input/20 border border-cy-border/20">
              <span className="text-xs text-cy-muted font-medium block">圖片設定</span>

              {/* URL Input */}
              <div>
                <label className="text-[10px] text-cy-muted block mb-1">圖片 URL</label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/..."
                  value={layoutImage?.url ?? ""}
                  onChange={(e) =>
                    setSlideImage(selectedSlideId, {
                      ...layoutImage,
                      url: e.target.value,
                      base64: layoutImage?.base64,
                    })
                  }
                  className="w-full bg-cy-input/50 text-cy-text text-xs rounded px-2 py-1.5 border border-cy-border/30"
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="text-[10px] text-cy-muted block mb-1">上傳圖片</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full text-xs text-cy-muted file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-cy-accent/20 file:text-cy-accent"
                />
              </div>

              {/* AI Generation Prompt */}
              <div>
                <label className="text-[10px] text-cy-muted block mb-1">AI 生成（描述想要的圖片）</label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="例：科技感的抽象背景，深藍色調"
                    value={layoutImage?.prompt ?? ""}
                    onChange={(e) =>
                      setSlideImage(selectedSlideId, {
                        ...layoutImage,
                        prompt: e.target.value,
                      })
                    }
                    className="flex-1 bg-cy-input/50 text-cy-text text-xs rounded px-2 py-1.5 border border-cy-border/30"
                  />
                  <button
                    onClick={() => {
                      alert("AI 圖片生成功能開發中");
                    }}
                    className="px-2 py-1.5 text-xs bg-cy-accent/20 text-cy-accent rounded border border-cy-accent/30 hover:bg-cy-accent/30 transition-colors shrink-0"
                  >
                    生成
                  </button>
                </div>
              </div>

              {/* Preview */}
              {(layoutImage?.base64 || layoutImage?.url) && (
                <div className="relative rounded overflow-hidden h-20 bg-cy-input/30">
                  <img
                    src={layoutImage.base64 || layoutImage.url}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeSlideImage(selectedSlideId)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/80 text-white text-[10px] flex items-center justify-center hover:bg-red-600"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Split Ratio — only for split modes */}
              {(layoutMode === "split-horizontal" || layoutMode === "split-vertical") && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-cy-muted w-14 shrink-0">圖片比例</span>
                  <input
                    type="range"
                    min={30}
                    max={70}
                    step={5}
                    value={splitRatio}
                    onChange={(e) =>
                      setSlideImageLayout(selectedSlideId, {
                        splitRatio: parseInt(e.target.value),
                      })
                    }
                    className="flex-1 h-1 accent-cy-accent"
                  />
                  <span className="text-[10px] text-cy-muted w-8 text-right tabular-nums">
                    {splitRatio}%
                  </span>
                </div>
              )}

              {/* Image Position */}
              {layoutMode === "split-horizontal" && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-cy-muted w-14 shrink-0">圖片位置</span>
                  <div className="flex rounded-md overflow-hidden border border-cy-border/30">
                    <button
                      onClick={() => setSlideImageLayout(selectedSlideId, { imagePosition: "left" })}
                      className={`px-2 py-1 text-[10px] transition-colors ${
                        imagePosition === "left" ? "bg-cy-accent/20 text-cy-accent" : "text-cy-muted hover:bg-cy-input/50"
                      }`}
                    >
                      左
                    </button>
                    <button
                      onClick={() => setSlideImageLayout(selectedSlideId, { imagePosition: "right" })}
                      className={`px-2 py-1 text-[10px] transition-colors ${
                        imagePosition === "right" ? "bg-cy-accent/20 text-cy-accent" : "text-cy-muted hover:bg-cy-input/50"
                      }`}
                    >
                      右
                    </button>
                  </div>
                </div>
              )}

              {layoutMode === "split-vertical" && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-cy-muted w-14 shrink-0">圖片位置</span>
                  <div className="flex rounded-md overflow-hidden border border-cy-border/30">
                    <button
                      onClick={() => setSlideImageLayout(selectedSlideId, { imagePosition: "top" })}
                      className={`px-2 py-1 text-[10px] transition-colors ${
                        imagePosition === "top" ? "bg-cy-accent/20 text-cy-accent" : "text-cy-muted hover:bg-cy-input/50"
                      }`}
                    >
                      上
                    </button>
                    <button
                      onClick={() => setSlideImageLayout(selectedSlideId, { imagePosition: "bottom" })}
                      className={`px-2 py-1 text-[10px] transition-colors ${
                        imagePosition === "bottom" ? "bg-cy-accent/20 text-cy-accent" : "text-cy-muted hover:bg-cy-input/50"
                      }`}
                    >
                      下
                    </button>
                  </div>
                </div>
              )}

              {/* Image Fit */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-cy-muted w-14 shrink-0">填充方式</span>
                <div className="flex rounded-md overflow-hidden border border-cy-border/30">
                  <button
                    onClick={() => setSlideImage(selectedSlideId, { ...layoutImage, fit: "cover" })}
                    className={`px-2 py-1 text-[10px] transition-colors ${
                      (layoutImage?.fit ?? "cover") === "cover" ? "bg-cy-accent/20 text-cy-accent" : "text-cy-muted hover:bg-cy-input/50"
                    }`}
                  >
                    填滿
                  </button>
                  <button
                    onClick={() => setSlideImage(selectedSlideId, { ...layoutImage, fit: "contain" })}
                    className={`px-2 py-1 text-[10px] transition-colors ${
                      layoutImage?.fit === "contain" ? "bg-cy-accent/20 text-cy-accent" : "text-cy-muted hover:bg-cy-input/50"
                    }`}
                  >
                    適應
                  </button>
                </div>
              </div>

              {/* Overlay Type — only for overlay mode */}
              {layoutMode === "image-overlay" && (
                <>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-cy-muted w-14 shrink-0">遮罩</span>
                  <div className="flex rounded-md overflow-hidden border border-cy-border/30">
                    {(
                      [
                        { value: "dark", label: "深色" },
                        { value: "light", label: "淺色" },
                        { value: "gradient", label: "漸層" },
                      ] as { value: "dark" | "light" | "gradient"; label: string }[]
                    ).map((ov) => (
                      <button
                        key={ov.value}
                        onClick={() => setSlideImage(selectedSlideId, { ...layoutImage, overlay: ov.value })}
                        className={`px-2 py-1 text-[10px] transition-colors ${
                          (layoutImage?.overlay ?? "dark") === ov.value
                            ? "bg-cy-accent/20 text-cy-accent"
                            : "text-cy-muted hover:bg-cy-input/50"
                        }`}
                      >
                        {ov.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Overlay Opacity */}
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] text-cy-muted w-14 shrink-0">透明度</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round((layoutImage?.overlayOpacity ?? (layoutImage?.overlay === "light" ? 0.4 : 0.55)) * 100)}
                    onChange={(e) =>
                      setSlideImage(selectedSlideId!, {
                        ...layoutImage,
                        overlayOpacity: parseInt(e.target.value) / 100,
                      })
                    }
                    className="flex-1 h-1 accent-cy-accent"
                  />
                  <span className="text-[10px] text-cy-muted w-8 text-right tabular-nums">
                    {Math.round((layoutImage?.overlayOpacity ?? (layoutImage?.overlay === "light" ? 0.4 : 0.55)) * 100)}%
                  </span>
                </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Badge Position (per-slide) */}
      {selectedSlideId && (
        <div className="border-t border-cy-border/30 pt-3 mt-3">
          <span className="text-xs text-cy-muted mb-2 block">徽章位置</span>
          <div className="grid grid-cols-3 gap-1 w-fit">
            {(
              [
                { value: "top-left", label: "↖" },
                { value: "top-center", label: "↑" },
                { value: "top-right", label: "↗" },
                { value: "bottom-left", label: "↙" },
                { value: "bottom-center", label: "↓" },
                { value: "bottom-right", label: "↘" },
              ] as { value: BadgePosition; label: string }[]
            ).map((pos) => (
              <button
                key={pos.value}
                onClick={() => setBadgePosition(selectedSlideId, pos.value)}
                className={`w-8 h-8 text-xs rounded border transition-colors ${
                  selectedBadgePos === pos.value
                    ? "bg-cy-accent/20 text-cy-accent border-cy-accent/40"
                    : "text-cy-muted border-cy-border/30 hover:bg-cy-input/50"
                }`}
              >
                {pos.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Text Alignment (per-slide) */}
      {selectedSlideId && (
        <div className="border-t border-cy-border/30 pt-3 mt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-cy-muted w-16 shrink-0">文字對齊</span>
            <div className="flex rounded-md overflow-hidden border border-cy-border/30">
              {(
                [
                  { value: "left", label: "左" },
                  { value: "center", label: "中" },
                  { value: "right", label: "右" },
                ] as { value: TextAlign; label: string }[]
              ).map((align) => (
                <button
                  key={align.value}
                  onClick={() => setTextAlign(selectedSlideId, align.value)}
                  className={`px-3 py-1 text-xs transition-colors ${
                    selectedTextAlign === align.value
                      ? "bg-cy-accent/20 text-cy-accent"
                      : "text-cy-muted hover:bg-cy-input/50"
                  }`}
                >
                  {align.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reset button */}
      <button
        onClick={resetCustomParams}
        className="mt-3 flex items-center gap-1.5 text-xs text-cy-muted hover:text-cy-accent transition-colors"
      >
        <RotateCcw className="h-3 w-3" />
        重設為主題預設
      </button>
    </div>
  );
}
