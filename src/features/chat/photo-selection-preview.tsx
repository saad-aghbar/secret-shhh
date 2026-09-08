"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ShhhButton, ShhhIconButton } from "@/components/shhh";
import { cn } from "@/lib/utils";

type PhotoSelectionPreviewProps = {
  files: File[];
  onChange: (files: File[]) => void;
  onCancel: () => void;
  onSend: (files: File[], caption: string) => void;
  onRetake?: () => void;
  note?: string;
  disabled?: boolean;
};

export function PhotoSelectionPreview({
  files,
  onChange,
  onCancel,
  onSend,
  onRetake,
  note,
  disabled,
}: PhotoSelectionPreviewProps) {
  const [caption, setCaption] = useState("");
  const urls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => {
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [urls]);

  function removeAt(index: number) {
    const next = files.filter((_, itemIndex) => itemIndex !== index);
    if (next.length) onChange(next);
    else onCancel();
  }

  const single = files.length === 1;

  return (
    <div
      data-testid="photo-selection"
      className="bg-surface-elevated mx-3 mb-1 rounded-[1.85rem] p-3 shadow-[var(--shhh-shadow-float)]"
    >
      <div className="mb-3 flex items-center justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <p className="text-secondary-text text-sm font-medium">
            {files.length === 1 ? "1 photo" : `${files.length} photos`}
          </p>
          {note ? <p className="text-muted-text mt-0.5 text-xs">{note}</p> : null}
        </div>
        <ShhhIconButton label="Cancel photo selection" className="size-10" onClick={onCancel}>
          <X className="size-5" />
        </ShhhIconButton>
      </div>

      {single ? (
        <div className="bg-bg-soft relative mx-auto max-h-[min(52vh,22rem)] overflow-hidden rounded-[1.55rem] shadow-[var(--shhh-shadow-soft)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URLs */}
          <img
            src={urls[0]!}
            alt=""
            className="mx-auto max-h-[min(52vh,22rem)] w-full object-contain"
          />
          <button
            type="button"
            data-testid="photo-remove-0"
            aria-label="Remove photo"
            className="shhh-press absolute top-2.5 right-2.5 grid size-9 place-items-center rounded-full bg-[color-mix(in_srgb,var(--shhh-text)_55%,transparent)] text-[var(--shhh-bg)] backdrop-blur-sm"
            onClick={() => removeAt(0)}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-2 transition-[grid-template-columns] duration-[var(--shhh-motion-normal)] ease-[var(--shhh-ease-settle)] motion-reduce:transition-none",
            files.length === 2 && "grid-cols-2",
            files.length === 3 && "grid-cols-3",
            files.length >= 4 && "grid-cols-3 sm:grid-cols-4",
          )}
        >
          {files.map((file, index) => (
            <div
              key={`${file.name}:${file.lastModified}:${index}`}
              className="animate-shhh-settle bg-bg-soft relative aspect-square overflow-hidden rounded-[1.25rem] motion-reduce:animate-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URLs */}
              <img src={urls[index]!} alt="" className="size-full object-cover" />
              <button
                type="button"
                data-testid={`photo-remove-${index}`}
                aria-label={`Remove photo ${index + 1}`}
                className="shhh-press absolute top-1.5 right-1.5 grid size-8 place-items-center rounded-full bg-[color-mix(in_srgb,var(--shhh-text)_55%,transparent)] text-[var(--shhh-bg)] backdrop-blur-sm"
                onClick={() => removeAt(index)}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="sr-only" htmlFor="photo-caption">
        Caption
      </label>
      <textarea
        id="photo-caption"
        data-testid="photo-caption"
        dir="auto"
        rows={2}
        maxLength={8000}
        value={caption}
        placeholder="Say something…"
        onChange={(event) => setCaption(event.target.value)}
        className="font-message bg-bg-soft text-primary-text placeholder:text-muted-text mt-3 min-h-12 w-full resize-none rounded-[1.25rem] px-3.5 py-3 text-start outline-none [unicode-bidi:plaintext] focus:ring-2 focus:ring-[var(--shhh-focus-ring)]"
      />
      <div className="mt-3 flex justify-end gap-2">
        {onRetake ? (
          <ShhhButton
            variant="secondary"
            data-testid="photo-retake"
            disabled={disabled}
            className="shhh-press"
            onClick={onRetake}
          >
            Retake
          </ShhhButton>
        ) : null}
        <ShhhButton
          data-testid="photo-send"
          disabled={disabled || files.length === 0}
          className="shhh-press min-w-[7.5rem]"
          onClick={() => onSend(files, caption)}
        >
          {files.length > 1 ? "Send photos" : "Send"}
        </ShhhButton>
      </div>
    </div>
  );
}
