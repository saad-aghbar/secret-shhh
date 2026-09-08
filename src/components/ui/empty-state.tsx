import { ShhhEmptyState } from "@/components/shhh";

type EmptyStateProps = {
  title: string;
  description: string;
};

/** @deprecated Prefer importing ShhhEmptyState from @/components/shhh */
export function EmptyState({ title, description }: EmptyStateProps) {
  return <ShhhEmptyState title={title} description={description} />;
}
