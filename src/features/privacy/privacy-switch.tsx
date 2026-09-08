import { cn } from "@/lib/utils";

export function PrivacySwitch({
  label,
  description,
  checked,
  disabled,
  testId,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  testId: string;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 rounded-[1.35rem] bg-bg-soft px-4 py-3">
      <div>
        <p className="font-semibold text-primary-text">{label}</p>
        <p className="text-sm text-secondary-text">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-disabled={disabled}
        disabled={disabled}
        data-testid={testId}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "shhh-press relative h-11 w-16 shrink-0 rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]",
          checked ? "bg-accent" : "bg-[var(--shhh-border-soft)]",
          disabled && "opacity-50",
        )}
      >
        <span
          className={cn(
            "block size-9 rounded-full bg-surface-elevated shadow-[var(--shhh-shadow-soft)] transition-transform motion-reduce:transition-none",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}
