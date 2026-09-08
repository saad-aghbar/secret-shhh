"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ShhhButton } from "@/components/shhh";
import { MediaOverlay } from "@/features/media/media-overlay";
import { PhotoPicker } from "@/features/media/photo-picker";
import { ALBUM_NOTE_MAX, ALBUM_TITLE_MAX } from "@/features/media/album-constants";
import { apiCreateAlbum } from "@/lib/media/client-api";
import { cn } from "@/lib/utils";

type Step = "details" | "photos";

export function AlbumCreateFlow({
  open,
  onClose,
  onCreated,
  userId,
  userName,
  partnerName,
  partnerId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (albumId: string) => void;
  userId: string;
  userName: string;
  partnerName: string;
  partnerId: string | null;
}) {
  const [step, setStep] = useState<Step>("details");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: () =>
      apiCreateAlbum({ title: title.trim(), note: note.trim() || null, mediaIds: selected }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["media", "albums"] });
      reset();
      onCreated(result.album.id);
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error && mutationError.message
          ? mutationError.message
          : "Couldn't create that album.",
      );
    },
  });

  function reset() {
    setStep("details");
    setTitle("");
    setNote("");
    setSelected([]);
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  const canContinue = title.trim().length > 0;

  const footer =
    step === "details" ? (
      <ShhhButton
        variant="primary"
        fullWidth
        data-testid="album-create-continue"
        disabled={!canContinue}
        onClick={() => setStep("photos")}
      >
        Choose photos or videos
      </ShhhButton>
    ) : (
      <div className="flex gap-2">
        <ShhhButton
          variant="ghost"
          className="flex-1"
          data-testid="album-create-back"
          onClick={() => setStep("details")}
        >
          Back
        </ShhhButton>
        <ShhhButton
          variant="primary"
          className="flex-[1.6]"
          data-testid="album-create-submit"
          disabled={create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending
            ? "Creating…"
            : selected.length > 0
              ? `Create album · ${selected.length}`
              : "Create album"}
        </ShhhButton>
      </div>
    );

  return (
    <MediaOverlay open={open} onClose={close} title="New album" footer={footer}>
      {error ? (
        <p className="mb-3 text-sm text-danger" role="status">
          {error}
        </p>
      ) : null}

      {step === "details" ? (
        <div className="grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-secondary-text">Album name</span>
            <input
              data-testid="album-title-input"
              value={title}
              dir="auto"
              maxLength={ALBUM_TITLE_MAX}
              placeholder="Summer 2026"
              autoComplete="off"
              className={cn(
                "min-h-12 w-full rounded-[1.25rem] bg-bg-soft px-4 text-[15px] text-primary-text",
                "placeholder:text-secondary-text/70",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]",
              )}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-secondary-text">Note (optional)</span>
            <textarea
              data-testid="album-note-input"
              value={note}
              dir="auto"
              rows={3}
              maxLength={ALBUM_NOTE_MAX}
              placeholder="Add a little note…"
              className={cn(
                "font-message w-full resize-none rounded-[1.25rem] bg-bg-soft px-4 py-3 text-[15px] leading-relaxed text-primary-text",
                "placeholder:text-secondary-text/70 [unicode-bidi:plaintext]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]",
              )}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </div>
      ) : (
        <PhotoPicker
          userId={userId}
          userName={userName}
          partnerName={partnerName}
          partnerId={partnerId}
          selected={selected}
          onSelectedChange={setSelected}
        />
      )}
    </MediaOverlay>
  );
}
