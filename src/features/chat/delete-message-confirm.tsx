"use client";

import { ShhhButton } from "@/components/shhh";
import { MediaOverlay } from "@/features/media/media-overlay";

type DeleteMessageConfirmProps = {
  open: boolean;
  keepsMedia: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteMessageConfirm({
  open,
  keepsMedia,
  onClose,
  onConfirm,
}: DeleteMessageConfirmProps) {
  return (
    <MediaOverlay
      open={open}
      onClose={onClose}
      title="Delete message?"
      footer={
        <div className="flex justify-end gap-2">
          <ShhhButton type="button" variant="ghost" onClick={onClose}>
            Cancel
          </ShhhButton>
          <ShhhButton
            type="button"
            variant="danger"
            data-testid="delete-confirm"
            onClick={onConfirm}
          >
            Delete
          </ShhhButton>
        </div>
      }
    >
      <p className="text-secondary-text text-sm leading-relaxed">
        {keepsMedia
          ? "This will remove it from the conversation. Photos and videos stay in Media."
          : "This will remove it from the conversation."}
      </p>
    </MediaOverlay>
  );
}
