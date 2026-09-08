import { cn } from "@/lib/utils";

export type ShhhSpinnerProps = {
  className?: string;
  label?: string;
};

export function ShhhSpinner({ className, label = "Loading" }: ShhhSpinnerProps) {
  return (
    <div role="status" aria-label={label} className={cn("relative size-8", className)}>
      <span
        className="absolute inset-0 rounded-full border-2 border-accent-soft border-t-accent motion-safe:animate-[spin_0.9s_linear_infinite]"
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
