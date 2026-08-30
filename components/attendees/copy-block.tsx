"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * A copy-pasteable command block. These pages get read on a phone in a hallway
 * or on a laptop that is, at that moment, broken — so the commands need to come
 * out in one tap.
 */
export function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard is blocked without a secure context or permission — the text
      // is right there and selectable, so this is a non-event.
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={copy}
        className="absolute top-2.5 right-2.5 flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 font-mono text-[10px] tracking-[0.09em] text-dim uppercase transition-colors hover:text-foreground"
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="overflow-x-auto px-4.5 py-4 pr-20 font-mono text-[13px] leading-[1.7] text-zinc-300">
        {code}
      </pre>
    </div>
  );
}
