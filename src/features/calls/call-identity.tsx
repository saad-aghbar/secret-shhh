"use client";

import { ShhhAvatar } from "@/components/shhh";
import { cn } from "@/lib/utils";

export function partnerInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function CallIdentity(props: {
  name: string;
  status: string;
  duration?: string | null;
  breathing?: boolean;
  ink?: boolean;
  avatarOnly?: boolean;
}) {
  return (
    <div className="flex w-full flex-col items-center px-6 text-center">
      <div
        className={cn(
          "relative",
          props.breathing && "animate-shhh-breathe motion-reduce:animate-none",
        )}
      >
        <span
          className={cn(
            "absolute inset-[-1rem] rounded-full blur-2xl",
            props.ink ? "bg-[rgb(247_241_232_/0.18)]" : "bg-accent/25",
          )}
          aria-hidden
        />
        <ShhhAvatar
          initials={partnerInitials(props.name)}
          alt={props.name}
          size="xl"
          className="size-32 text-4xl ring-4 ring-accent/25"
        />
      </div>
      {props.avatarOnly ? null : (
        <>
          <h1
            className={cn(
              "mt-6 w-full max-w-[18rem] truncate text-2xl font-semibold tracking-tight",
              props.ink ? "text-[var(--shhh-viewer-ivory)]" : "text-primary-text",
            )}
          >
            {props.name}
          </h1>
          <p
            className={cn(
              "mt-1 text-sm",
              props.ink ? "text-[rgb(247_241_232_/0.78)]" : "text-secondary-text",
            )}
          >
            {props.status}
          </p>
          {props.duration ? (
            <p
              className={cn(
                "mt-1 text-sm tabular-nums",
                props.ink ? "text-[rgb(247_241_232_/0.7)]" : "text-muted-text",
              )}
              aria-hidden
            >
              {props.duration}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
