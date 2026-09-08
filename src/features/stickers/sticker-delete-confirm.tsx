"use client";

import { ShhhButton } from "@/components/shhh";

type StickerDeleteConfirmProps = {
  onClose: () => void;
  onConfirm: () => void;
};

export function StickerDeleteConfirm({ onClose, onConfirm }: StickerDeleteConfirmProps) {
  return (
    <div className="px-1 py-2" data-testid="sticker-delete-panel">
      <p className="text-primary-text text-sm font-semibold">Remove from stickers?</p>
      <p className="text-secondary-text mt-2 text-sm leading-relaxed">
        It’ll leave the tray so it can’t be sent again. Messages that already used it keep the art.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <ShhhButton type="button" variant="ghost" onClick={onClose}>
          Keep
        </ShhhButton>
        <ShhhButton
          type="button"
          variant="danger"
          data-testid="sticker-delete-confirm"
          onClick={onConfirm}
        >
          Delete
        </ShhhButton>
      </div>
    </div>
  );
}
