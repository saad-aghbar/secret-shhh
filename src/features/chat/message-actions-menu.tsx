"use client";

import { BookmarkMinus, BookmarkPlus, Heart, ListPlus, Music2, Pencil, Reply, Save, Share2, Smile, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { ShhhPopover, type PopoverAlign, type PopoverAnchor } from "@/components/shhh/shhh-popover";
import { ReactionTray } from "@/features/chat/reaction-tray";
import { cn } from "@/lib/utils";

export type MessageActionId =
  | "reply"
  | "react"
  | "edit"
  | "delete"
  | "save"
  | "save-sticker"
  | "unsave-sticker"
  | "rename"
  | "add-music"
  | "save-my-music"
  | "in-my-music"
  | "save-our-music"
  | "in-our-music"
  | "add-playlist"
  | "recommend-music"
  | "open-song";

type ListedActionId = Exclude<MessageActionId, "react">;

type MessageActionsMenuProps = {
  open: boolean;
  onClose: () => void;
  anchor: PopoverAnchor | null;
  actions: MessageActionId[];
  onAction: (action: MessageActionId) => void;
  selectedReaction?: string | null;
  onReact?: (emoji: string) => void;
  align?: PopoverAlign;
  picking?: boolean;
};

const COPY: Record<ListedActionId, { label: string; icon: ReactNode; danger?: boolean }> = {
  reply: { label: "Reply", icon: <Reply className="size-4" strokeWidth={2.1} /> },
  edit: { label: "Edit", icon: <Pencil className="size-4" strokeWidth={2.1} /> },
  save: { label: "Save", icon: <Save className="size-4" strokeWidth={2.1} /> },
  "save-sticker": {
    label: "Save sticker",
    icon: <BookmarkPlus className="size-4" strokeWidth={2.1} />,
  },
  "unsave-sticker": {
    label: "Unsave sticker",
    icon: <BookmarkMinus className="size-4" strokeWidth={2.1} />,
  },
  rename: { label: "Rename", icon: <Smile className="size-4" strokeWidth={2.1} /> },
  "add-music": { label: "Add to Music", icon: <Music2 className="size-4" strokeWidth={2.1} /> },
  "save-my-music": { label: "Add to My Music", icon: <Heart className="size-4" strokeWidth={2.1} /> },
  "in-my-music": { label: "✓ In My Music", icon: <Heart className="size-4 fill-current" strokeWidth={2.1} /> },
  "save-our-music": { label: "Add to Our Music", icon: <Heart className="size-4" strokeWidth={2.1} /> },
  "in-our-music": { label: "✓ In Our Music", icon: <Heart className="size-4 fill-current" strokeWidth={2.1} /> },
  "add-playlist": { label: "Add to Playlist", icon: <ListPlus className="size-4" strokeWidth={2.1} /> },
  "recommend-music": { label: "Recommend", icon: <Share2 className="size-4" strokeWidth={2.1} /> },
  "open-song": { label: "Open song", icon: <Music2 className="size-4" strokeWidth={2.1} /> },
  delete: { label: "Delete", icon: <Trash2 className="size-4" strokeWidth={2.1} />, danger: true },
};

function ActionButton({ id, onClick }: { id: ListedActionId; onClick: () => void }) {
  const item = COPY[id];
  return (
    <button
      type="button"
      role="menuitem"
      data-testid={`action-${id}`}
      className={cn(
        "shhh-press flex min-h-11 w-full items-center gap-3 rounded-[1.15rem] px-3 py-2 text-start text-sm font-medium",
        item.danger ? "text-danger hover:bg-love-soft/70" : "text-primary-text hover:bg-bg-soft",
      )}
      ref={(node) => {
        if (node) node.onclick = () => onClick();
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span className="bg-bg-soft grid size-8 place-items-center rounded-full">{item.icon}</span>
      {item.label}
    </button>
  );
}

export function MessageActionsMenu({
  open,
  onClose,
  anchor,
  actions,
  onAction,
  selectedReaction = null,
  onReact,
  align = "center",
  picking = false,
}: MessageActionsMenuProps) {
  const items = actions
    .filter((id): id is ListedActionId => id !== "react")
    .map((id) => <ActionButton key={id} id={id} onClick={() => onAction(id)} />);

  return (
    <ShhhPopover
      open={open}
      onClose={onClose}
      anchor={anchor}
      align={align}
      label="Message"
      role="dialog"
      dim
      bare
      className="flex min-w-0 flex-col gap-2"
    >
      {onReact ? (
        <div className={cn("flex", align === "end" ? "justify-end" : "justify-start")}>
          <ReactionTray
            selected={selectedReaction}
            picking={picking || undefined}
            onPick={(emoji) => {
              onReact(emoji);
              onClose();
            }}
            onClose={onClose}
          />
        </div>
      ) : null}
      {items.length > 0 ? (
        <div
          role="menu"
          aria-label="Message actions"
          data-testid="message-actions"
          className="bg-surface-elevated min-w-[13.5rem] rounded-[1.5rem] p-1.5 shadow-[var(--shhh-shadow-float)]"
        >
          {items}
        </div>
      ) : null}
    </ShhhPopover>
  );
}
