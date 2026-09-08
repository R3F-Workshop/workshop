"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ACCESS_CODES } from "@/lib/attendees";

export function CodeEntry() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    const code = value.trim().toLowerCase();
    if ((ACCESS_CODES as readonly string[]).includes(code)) {
      router.push(`/attendees/${code}`);
      return;
    }
    setWrong(true);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setWrong(false);
        }}
        // Codes are lowercase; phone keyboards should not fight the user.
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        aria-label="Access code"
        aria-invalid={wrong}
        placeholder="access code"
        className="w-full rounded-lg border border-input bg-card px-4 py-3 font-mono text-sm text-foreground outline-none placeholder:text-ghost focus:border-ring aria-[invalid=true]:border-destructive"
      />
      <Button type="submit" size="lg" disabled={!value.trim()}>
        Continue
      </Button>
      <div
        role="status"
        className="min-h-5 font-mono text-[11px] text-destructive"
        aria-live="polite"
      >
        {wrong
          ? "That code doesn't match. Check your confirmation email."
          : null}
      </div>
    </form>
  );
}
