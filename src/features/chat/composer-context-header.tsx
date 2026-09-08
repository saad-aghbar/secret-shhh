"use client";

import { X } from "lucide-react";

import { ShhhIconButton } from "@/components/shhh";
import { ReplyPreviewStrip } from "@/features/chat/reply-preview-strip";
import type { ReplyPreview } from "@/lib/chat/types";

type ComposerContextHeaderProps =
  | {
      mode: "reply";
      senderName: string;
      preview: ReplyPreview;
      onClose: () => void;
    }
  | {
      mode: "edit";
      onClose: () => void;
    };

export function ComposerContextHeader(props: ComposerContextHeaderProps) {
  return (
    <div
      className="animate-shhh-settle mx-3 mb-1 flex items-center gap-2 rounded-[1.35rem] bg-surface-elevated/90 px-3 py-2 shadow-[var(--shhh-shadow-soft)] motion-reduce:animate-none"
      data-testid={props.mode === "reply" ? "composer-reply" : "composer-edit"}
    >
      <div className="min-w-0 flex-1">
        {props.mode === "reply" ? (
          <ReplyPreviewStrip preview={props.preview} senderName={props.senderName} compact />
        ) : (
          <p className="text-accent-strong px-1 text-[13px] font-semibold">Editing message</p>
        )}
      </div>
      <ShhhIconButton
        type="button"
        label={props.mode === "reply" ? "Cancel reply" : "Cancel edit"}
        className="text-secondary-text size-10 shrink-0"
        onClick={props.onClose}
        data-testid="composer-context-close"
      >
        <X className="size-4" strokeWidth={2.2} />
      </ShhhIconButton>
    </div>
  );
}
