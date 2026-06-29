import env from '@vitrify/tools/env'

export { appConfig } from './env.js'
export { postgresConfig } from './postgres.js'

export function read(key: string, defaultValue?: string): string | undefined {
  const val = env.read(key)
  if (val !== undefined) return val
  if (!key.startsWith('VITE_')) {
    const prefixedVal = env.read(`VITE_${key}`)
    if (prefixedVal !== undefined) return prefixedVal
  }
  return defaultValue
}

export function required(key: string): string {
  const val = read(key)
  if (val === undefined) {
    throw new Error(
      `Missing required environment variable: ${key} or VITE_${key}`
    )
  }
  return val
}

export { env }
