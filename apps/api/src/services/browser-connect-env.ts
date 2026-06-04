export const BROWSER_CONNECT_UNAVAILABLE =
  "Browser login only works on your own computer. On Railway/VPS, run the login command on your PC, then paste the session below.";

/** True when API can open an interactive Chromium window (local dev). */
export function isBrowserConnectAvailable(): boolean {
  if (process.env.ALLOW_BROWSER_CONNECT === "true") return true;
  if (process.env.DISABLE_BROWSER_CONNECT === "true") return false;
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_NAME) {
    return false;
  }
  if (process.env.CI === "true") return false;
  if (
    process.platform === "linux" &&
    !process.env.DISPLAY &&
    process.env.NODE_ENV === "production"
  ) {
    return false;
  }
  return true;
}
