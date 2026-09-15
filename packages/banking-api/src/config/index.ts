import env from "@vitrify/tools/env";

export function read(key: string, defaultValue?: string): string | undefined {
  // Server-side: no VITE_ prefix fallback. Browser-prefixed variables are a
  // public override surface and must never configure the proxy
  // (e.g. VITE_BANKING_API_CONFIG_PATH would otherwise win over the real one).
  return env.read(key) ?? defaultValue;
}

export function required(key: string): string {
  const val = read(key);
  if (val === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

export { env };
