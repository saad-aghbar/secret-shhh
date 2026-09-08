import { ShhhSurface } from "@/components/shhh/shhh-surface";
import { cn } from "@/lib/utils";

export type ShhhEmptyStateProps = {
  title: string;
  description: string;
  className?: string;
};

export function ShhhEmptyState({ title, description, className }: ShhhEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center px-6 py-16 text-center",
        className,
      )}
    >
      <ShhhSurface tone="raised" round="xl" elevation="soft" padding="lg" className="max-w-sm">
        <h1 className="font-handmade text-2xl tracking-tight text-primary-text">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-secondary-text">{description}</p>
      </ShhhSurface>
    </div>
  );
}
