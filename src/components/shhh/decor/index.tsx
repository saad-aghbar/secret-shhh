import { cn } from "@/lib/utils";

type DecorProps = {
  className?: string;
  "aria-hidden"?: boolean;
};

export function LoveStroke({ className, ...rest }: DecorProps) {
  return (
    <svg
      viewBox="0 0 64 12"
      fill="none"
      className={cn("text-love", className)}
      {...rest}
    >
      <path
        d="M2 7.5c8-6 14 4 22 0s12-7 20-1 12 5 18-1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

export function SoftSpark({ className, ...rest }: DecorProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={cn("text-accent", className)}
      {...rest}
    >
      <path
        d="M8 1.5v3.2M8 11.3v3.2M1.5 8h3.2M11.3 8h3.2M3.4 3.4l2.2 2.2M10.4 10.4l2.2 2.2M12.6 3.4l-2.2 2.2M5.6 10.4l-2.2 2.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
}

export function DoodleUnderline({ className, ...rest }: DecorProps) {
  return (
    <svg
      viewBox="0 0 120 10"
      fill="none"
      className={cn("text-accent", className)}
      {...rest}
    >
      <path
        d="M2 6c18-4 28 3 40 0s22-5 38 1 24 2 36-2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

export function OrganicBlob({ className, ...rest }: DecorProps) {
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      className={cn("text-accent-soft", className)}
      {...rest}
    >
      <path
        d="M42 6c14 2 28 14 30 28 2 16-10 32-26 36-14 4-32-2-38-16-6-14 0-30 12-38C28 10 34 5 42 6Z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}

export function TinyStar({ className, ...rest }: DecorProps) {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      className={cn("text-love", className)}
      {...rest}
    >
      <path
        d="M6 1.2 6.9 4.6 10.5 5.1 7.8 7.4 8.6 10.9 6 9.1 3.4 10.9 4.2 7.4 1.5 5.1 5.1 4.6 6 1.2Z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  );
}

export function BubbleHalo({ className, ...rest }: DecorProps) {
  return (
    <svg
      viewBox="0 0 88 88"
      fill="none"
      className={cn("text-accent", className)}
      {...rest}
    >
      <ellipse
        cx="44"
        cy="44"
        rx="40"
        ry="38"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="3 5"
        opacity="0.35"
      />
    </svg>
  );
}
