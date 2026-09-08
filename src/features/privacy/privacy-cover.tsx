import { publicEnv } from "@/lib/public-env";

export function PrivacyCover() {
  return (
    <div
      data-testid="privacy-cover"
      role="presentation"
      aria-hidden="true"
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{
        background: "var(--shhh-bg)",
        paddingTop: "var(--shhh-safe-top)",
        paddingBottom: "var(--shhh-safe-bottom)",
      }}
    >
      <p className="font-handmade text-4xl tracking-tight text-primary-text">
        {publicEnv.NEXT_PUBLIC_APP_NAME}
      </p>
    </div>
  );
}
