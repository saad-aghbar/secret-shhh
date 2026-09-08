import { THEME_STYLE_ID } from "@/lib/theme/css";

export function ThemeStyle({ css }: { css: string }) {
  if (!css) return null;
  return <style id={THEME_STYLE_ID} dangerouslySetInnerHTML={{ __html: css }} />;
}
