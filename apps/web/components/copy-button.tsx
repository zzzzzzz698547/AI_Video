"use client";

import { useState } from "react";

export function CopyButton({ text, label = "複製" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button type="button" className="copy-btn" onClick={handleCopy}>
      {copied ? "已複製" : label}
    </button>
  );
}

