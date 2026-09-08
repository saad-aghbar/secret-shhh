"use client";

import { useState } from "react";

import { ShhhButton } from "@/components/shhh";
import { MediaOverlay } from "@/features/media/media-overlay";

type StickerRenameDialogProps = {
  open: boolean;
  initialName?: string | null;
  onClose: () => void;
  onSave: (name: string | null) => void;
};

export function StickerRenameDialog({
  open,
  initialName,
  onClose,
  onSave,
}: StickerRenameDialogProps) {
  const [name, setName] = useState(initialName ?? "");

  return (
    <MediaOverlay
      open={open}
      onClose={onClose}
      title="Rename sticker"
      footer={
        <div className="flex justify-end gap-2">
          <ShhhButton type="button" variant="ghost" onClick={onClose}>
            Cancel
          </ShhhButton>
          <ShhhButton
            type="button"
            data-testid="sticker-rename-save"
            onClick={() => onSave(name.trim() || null)}
          >
            Save
          </ShhhButton>
        </div>
      }
    >
      <input
        dir="auto"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Optional name"
        data-testid="sticker-rename-input"
        className="bg-bg-soft text-primary-text placeholder:text-muted-text w-full rounded-pill px-4 py-2.5 text-sm outline-none [unicode-bidi:plaintext]"
      />
    </MediaOverlay>
  );
}
