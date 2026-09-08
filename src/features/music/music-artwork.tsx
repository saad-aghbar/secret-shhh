import { Music2 } from "lucide-react";

import { cn } from "@/lib/utils";

type MusicArtworkProps = {
  src: string | null | undefined;
  alt: string;
  size?: "sm" | "md" | "lg" | "hero";
  className?: string;
};

const sizes = {
  sm: "size-12",
  md: "size-16",
  lg: "size-24",
  hero: "size-full max-h-80 max-w-80",
};

function classHasBox(className?: string) {
  if (!className) return false;
  return /(?:^|\s)!?(?:size|w|h|min-w|min-h|max-w|max-h|aspect)-/.test(className);
}

export function MusicArtwork({ src, alt, size = "md", className }: MusicArtworkProps) {
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden bg-accent-soft/50 shadow-[var(--shhh-shadow-soft)]",
        "rounded-[1.15rem]",
        !classHasBox(className) && sizes[size],
        className,
      )}
    >
      {src ? (
        // External provider art; unoptimized so Spotify/Apple/YouTube CDNs work without a remote config.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="size-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span className="text-accent grid size-full place-items-center" aria-hidden>
          <Music2 className={size === "sm" ? "size-5" : "size-7"} strokeWidth={1.8} />
        </span>
      )}
    </span>
  );
}
