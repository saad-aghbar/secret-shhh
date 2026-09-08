import { LoginExperience } from "@/features/auth/login-experience";
import { getPublicProfiles } from "@/lib/auth/profiles";
import { publicEnv } from "@/lib/public-env";

export const metadata = {
  title: "Who’s here?",
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const cards = getPublicProfiles();

  return (
    <LoginExperience
      cards={cards}
      appName={publicEnv.NEXT_PUBLIC_APP_NAME}
      errorCode={params.error ?? null}
    />
  );
}
