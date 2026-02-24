"use client";

import { useState, useEffect, useRef } from "react";
import { useI18n } from "@/context/I18nContext";
import { LinkIcon, BriefcaseIcon } from "@/components/ui/Icons";

interface DemoStageInputProps {
  visible: boolean;
}

export default function DemoStageInput({ visible }: DemoStageInputProps) {
  const { t } = useI18n();
  const [charIndex, setCharIndex] = useState(0);
  const [showTarget, setShowTarget] = useState(false);
  const url = t.landing.demoInputUrl;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible) {
      setCharIndex(0);
      setShowTarget(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setCharIndex((prev) => {
        if (prev >= url.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, 55);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visible, url]);

  // Show target field after typing finishes
  useEffect(() => {
    if (charIndex >= url.length && visible) {
      const timeout = setTimeout(() => setShowTarget(true), 300);
      return () => clearTimeout(timeout);
    }
  }, [charIndex, url.length, visible]);

  const typingDone = charIndex >= url.length;

  return (
    <div className="flex flex-col gap-4 p-5 sm:p-6">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--surface-secondary)] rounded-lg w-fit">
        <div className="px-3 py-1.5 text-xs font-medium rounded-md bg-white text-[var(--accent)] shadow-sm">
          {t.landing.demoInputTab1}
        </div>
        <div className="px-3 py-1.5 text-xs font-medium rounded-md text-[var(--text-muted)]">
          {t.landing.demoInputTab2}
        </div>
      </div>

      {/* URL Field */}
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
          {t.landing.demoInputUrlLabel}
        </label>
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-[var(--border)] bg-white">
          <LinkIcon size={16} className="text-[var(--text-muted)] shrink-0" />
          <span className="text-sm text-[var(--text-primary)] font-mono">
            {url.slice(0, charIndex)}
            {!typingDone && <span className="demo-cursor" />}
          </span>
          {typingDone && (
            <span className="ml-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] inline-block" />
            </span>
          )}
        </div>
      </div>

      {/* Target Job Field (fades in) */}
      <div
        className={`transition-all duration-500 ease-out ${
          showTarget
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2 pointer-events-none"
        }`}
      >
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
          {t.landing.demoInputTargetLabel}
        </label>
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-[var(--border)] bg-white">
          <BriefcaseIcon size={16} className="text-[var(--text-muted)] shrink-0" />
          <span className="text-sm text-[var(--text-secondary)]">
            {t.landing.demoInputTargetValue}
          </span>
        </div>
      </div>
    </div>
  );
}
