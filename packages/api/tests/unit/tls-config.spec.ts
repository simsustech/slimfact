import { afterAll, describe, expect, it, vi, type MockInstance } from 'vitest'

process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'unused'
process.env.POSTGRES_DB = process.env.POSTGRES_DB || 'slimfact_unit'

// kysely/index.ts installs a BigInt.prototype.toJSON getter at import time;
// block that define so vitest's own BigInt serialization stays untouched.
// No DB connection is attempted on import.
const originalDefineProperty = Object.defineProperty
const definePropertySpy: MockInstance = vi
  .spyOn(Object, 'defineProperty')
  .mockImplementation((target, prop, desc) => {
    if (target === BigInt.prototype && prop === 'toJSON') return target
    return originalDefineProperty(target, prop, desc)
  })

const { buildSslConfig, postgresConnectionString } = await import(
  '../../src/kysely/index.js'
)

afterAll(() => {
  definePropertySpy.mockRestore()
})

describe('buildSslConfig (POSTGRES TLS)', () => {
  it('verifies certificates by default when SSL is enabled', () => {
    expect(buildSslConfig(true, false, undefined)).toEqual({
      rejectUnauthorized: true,
      ca: undefined
    })
  })

  it('downgrades verification only with POSTGRES_SSL_INSECURE=true', () => {
    expect(buildSslConfig(true, true, undefined)).toEqual({
      rejectUnauthorized: false,
      ca: undefined
    })
  })

  it('passes the CA cert through', () => {
    expect(buildSslConfig(true, false, 'PEM')).toEqual({
      rejectUnauthorized: true,
      ca: 'PEM'
    })
  })

  it('disables TLS entirely when POSTGRES_SSL is unset', () => {
    expect(buildSslConfig(false, true, undefined)).toBe(false)
    expect(buildSslConfig(false, false, undefined)).toBe(false)
  })

  it('keeps TLS settings out of the pg-boss connection string', () => {
    // pg lets sslmode/sslrootcert in the URL override the `ssl` option.
    expect(postgresConnectionString).not.toMatch(/sslmode|sslrootcert/)
  })
})
