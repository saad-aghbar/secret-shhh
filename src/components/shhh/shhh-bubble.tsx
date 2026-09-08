import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const bubbleVariants = cva(
  "max-w-[85%] px-4 py-2.5 text-sm leading-relaxed shadow-[var(--shhh-shadow-soft)]",
  {
    variants: {
      side: {
        outgoing: "self-end bg-outgoing-bubble text-outgoing-text",
        incoming: "self-start bg-incoming-bubble text-incoming-text",
      },
      group: {
        single: "",
        first: "",
        middle: "",
        last: "",
      },
    },
    compoundVariants: [
      {
        side: "outgoing",
        group: "single",
        class: "rounded-[1.4rem_1.35rem_0.5rem_1.4rem]",
      },
      {
        side: "outgoing",
        group: "first",
        class: "rounded-[1.4rem_1.35rem_0.65rem_1.4rem]",
      },
      {
        side: "outgoing",
        group: "middle",
        class: "rounded-[1.4rem_0.7rem_0.7rem_1.4rem]",
      },
      {
        side: "outgoing",
        group: "last",
        class: "rounded-[1.4rem_0.7rem_0.5rem_1.4rem]",
      },
      {
        side: "incoming",
        group: "single",
        class: "rounded-[1.35rem_1.4rem_1.4rem_0.5rem]",
      },
      {
        side: "incoming",
        group: "first",
        class: "rounded-[1.35rem_1.4rem_1.4rem_0.7rem]",
      },
      {
        side: "incoming",
        group: "middle",
        class: "rounded-[0.7rem_1.4rem_1.4rem_0.7rem]",
      },
      {
        side: "incoming",
        group: "last",
        class: "rounded-[0.7rem_1.4rem_1.4rem_0.5rem]",
      },
    ],
    defaultVariants: {
      side: "outgoing",
      group: "single",
    },
  },
);

export type ShhhBubbleProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof bubbleVariants>;

/** Asymmetric, sender-aware bubble. Side follows sender, never language. */
export function ShhhBubble({ className, side, group, ...props }: ShhhBubbleProps) {
  return (
    <div
      className={cn(bubbleVariants({ side, group }), "shhh-bubble-radius", className)}
      {...props}
    />
  );
}
