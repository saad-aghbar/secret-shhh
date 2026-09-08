"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { isAppearanceDirty, subscribeAppearanceDirty } from "@/features/appearance/appearance-dirty";
import { ShhhButton, ShhhIconButton, ShhhModal } from "@/components/shhh";

export function AppearanceBackButton() {
  const router = useRouter();
  const [dirty, setDirty] = useState(isAppearanceDirty);
  const [open, setOpen] = useState(false);

  useEffect(() => subscribeAppearanceDirty(setDirty), []);

  return (
    <>
      <ShhhIconButton
        label="Back to More"
        data-testid="appearance-back"
        onClick={() => {
          if (dirty) {
            setOpen(true);
            return;
          }
          router.push("/more");
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
              data-testid="appearance-discard-confirm"
              onClick={() => router.push("/more")}
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
