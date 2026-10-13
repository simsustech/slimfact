/**
 * Chromium flags shared by the Playwright projects and the global-setup auth
 * capture, so both hit the same stack. `--host-resolver-rules` resolves the
 * dev host without /etc/hosts (sandbox-friendly); the global-setup launches
 * its own browser and must pass the same args or it cannot reach the app.
 */
export const CHROMIUM_LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  // Resolve slimfact.localhost without /etc/hosts (sandbox-friendly).
  '--host-resolver-rules=MAP slimfact.localhost 127.0.0.1,EXCLUDE localhost'
]
