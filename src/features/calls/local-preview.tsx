"use client";

/* eslint-disable react-hooks/refs -- callback ref binds the local camera preview */

import { ShhhAvatar } from "@/components/shhh";
import { cn } from "@/lib/utils";

import { partnerInitials } from "@/features/calls/call-identity";

export function LocalPreview(props: {
  bindVideo: (element: HTMLVideoElement | null) => void;
  cameraOn: boolean;
  selfName: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute end-3 overflow-hidden rounded-[1.35rem] shadow-[var(--shhh-shadow-float)]",
        "h-36 w-28 border border-[rgb(247_241_232_/0.28)] bg-[var(--shhh-viewer-ink)]",
        props.className,
      )}
      style={{ top: "calc(5.25rem + var(--shhh-safe-top))" }}
      data-testid="local-preview"
    >
      <video
        ref={props.bindVideo}
        autoPlay
        muted
        playsInline
        className={cn("size-full object-cover", !props.cameraOn && "hidden")}
      />
      {!props.cameraOn ? (
        <div className="grid size-full place-items-center">
          <ShhhAvatar
            initials={partnerInitials(props.selfName)}
            alt=""
            size="md"
            className="size-14"
          />
        </div>
      ) : null}
    </div>
  );
}
