function originFrom(raw: string | undefined | null) {
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export type EnvMap = Record<string, string | undefined>;

function deployedProduction(env: EnvMap) {
  return env.VERCEL_ENV === "production";
}

export function allowedMutationOrigins(request: Request, env: EnvMap = process.env) {
  const allowed = new Set<string>();
  const requestOrigin = originFrom(request.url);
  if (requestOrigin) allowed.add(requestOrigin);

  const appOrigin = originFrom(env.NEXT_PUBLIC_APP_URL);
  if (appOrigin) allowed.add(appOrigin);

  const vercelHost = env.VERCEL_URL?.replace(/^https?:\/\//, "");
  if (vercelHost) allowed.add(`https://${vercelHost}`);

  if (!deployedProduction(env)) {
    allowed.add("http://localhost:3000");
    allowed.add("http://127.0.0.1:3000");
  }

  return allowed;
}

export function isAllowedMutationOrigin(request: Request, env: EnvMap = process.env) {
  const site = request.headers.get("sec-fetch-site");
  if (site === "same-origin" || site === "same-site" || site === "none") {
    return true;
  }

  const origin = request.headers.get("origin");
  if (!origin || origin === "null") {
    return !deployedProduction(env);
  }

  return allowedMutationOrigins(request, env).has(origin);
}

export function isStateChangingMethod(method: string) {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}
