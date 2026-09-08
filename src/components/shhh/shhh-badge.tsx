import { cn } from "@/lib/utils";

export type ShhhBadgeProps = {
  label: string;
  tone?: "neutral" | "success" | "accent" | "love" | "danger";
  dot?: boolean;
  className?: string;
  "aria-live"?: "off" | "polite" | "assertive";
};

const tones = {
  neutral: "text-secondary-text",
  success: "text-success",
  accent: "text-accent",
  love: "text-love",
  danger: "text-danger",
} as const;

const dots = {
  neutral: "bg-secondary-text/50",
  success: "bg-success",
  accent: "bg-accent",
  love: "bg-love",
  danger: "bg-danger",
} as const;

export function ShhhBadge({
  label,
  tone = "neutral",
  dot = true,
  className,
  "aria-live": ariaLive,
}: ShhhBadgeProps) {
  return (
    <p
      className={cn("inline-flex max-w-full items-center gap-1.5 text-xs font-medium", tones[tone], className)}
      aria-live={ariaLive}
    >
      {dot ? (
        <span className={cn("size-1.5 shrink-0 rounded-full", dots[tone])} aria-hidden />
      ) : null}
      <span className="truncate">{label}</span>
    </p>
  );
}
