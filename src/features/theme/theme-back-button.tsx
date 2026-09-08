"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ShhhButton, ShhhIconButton, ShhhModal } from "@/components/shhh";
import { discardThemeDraft, isThemeDirty, subscribeThemeDirty } from "@/features/theme/theme-dirty";

export function ThemeBackButton() {
  const router = useRouter();
  const [dirty, setDirty] = useState(isThemeDirty);
  const [open, setOpen] = useState(false);

  useEffect(() => subscribeThemeDirty(setDirty), []);

  return (
    <>
      <ShhhIconButton
        label="Back to Appearance"
        data-testid="theme-back"
        onClick={() => {
          if (dirty) {
            setOpen(true);
            return;
          }
          router.push("/more/appearance");
        }}
      >
        <ArrowLeft className="size-5" strokeWidth={2.2} />
      </ShhhIconButton>
      <ShhhModal
        open={open}
        onClose={() => setOpen(false)}
        title="Leave without applying?"
        footer={
          <div className="flex flex-col gap-2">
            <ShhhButton
              type="button"
              data-testid="theme-discard-confirm"
              onClick={() => {
                discardThemeDraft();
                router.push("/more/appearance");
              }}
            >
              Discard
            </ShhhButton>
            <ShhhButton type="button" variant="ghost" onClick={() => setOpen(false)}>
              Keep editing
            </ShhhButton>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-secondary-text">Your new look isn’t saved yet.</p>
      </ShhhModal>
    </>
  );
}
