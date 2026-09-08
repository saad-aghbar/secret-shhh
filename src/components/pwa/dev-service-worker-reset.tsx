/**
 * Dev-only. Leftover service workers from e2e (`NEXT_PUBLIC_ENABLE_SW=1`)
 * cache `/_next` chunks; a root-layout throw then mounts `global-error`
 * and never reaches `ServiceWorkerRegistrar`. This inline script runs from
 * the SSR HTML before hydration, so it still fires on that crash path.
 *
 * Not emitted when `NEXT_PUBLIC_ENABLE_SW=1` (Playwright needs the worker).
 */
const RESET_SCRIPT = `(function(){var h=location.hostname;if(h!=="localhost"&&h!=="127.0.0.1"&&h!=="[::1]")return;try{if(sessionStorage.getItem("shhh-dev-sw-reset")==="1")return;if(navigator.serviceWorker&&navigator.serviceWorker.controller){sessionStorage.setItem("shhh-dev-sw-reset","1");location.replace("/sw-reset.html");}}catch(e){}})();`;

export function DevServiceWorkerReset() {
  if (process.env.NODE_ENV === "production") return null;
  if (process.env.NEXT_PUBLIC_ENABLE_SW === "1") return null;
  return <script dangerouslySetInnerHTML={{ __html: RESET_SCRIPT }} />;
}
