import { describe, it, expect, beforeEach, vi } from 'vitest'

async function loadBankingEnv() {
  vi.resetModules()
  return import('../../../src/config/env.js')
}

describe('banking env config', () => {
  beforeEach(() => {
    // env.ts calls required() for a few base vars at module load
    process.env.API_HOST = 'slimfact.test'
    process.env.OTP_SECRET = 'test-otp-secret'
    process.env.OIDC_CLIENT_SECRET = 'test-client-secret'
    process.env.OIDC_COOKIES_KEYS = 'test-cookie-keys'
    delete process.env.BANKING_API_URL
    delete process.env.BANKING_API_KEY
    delete process.env.BANKING_SYNC_CRON
    delete process.env.BANKING_SYNC_WAIT_MS
    delete process.env.BANKING_INGEST_DISABLED
  })

  it('is disabled when BANKING_API_KEY is absent', async () => {
    const { bankingEnabled, appConfig } = await loadBankingEnv()
    expect(bankingEnabled()).toBe(false)
    expect(appConfig.bankingApiKey).toBeUndefined()
  })

  it('is enabled when BANKING_API_KEY and BANKING_API_URL are set', async () => {
    process.env.BANKING_API_KEY = 'obk_test_xxx'
    process.env.BANKING_API_URL = 'http://banking-api'
    const { bankingEnabled } = await loadBankingEnv()
    expect(bankingEnabled()).toBe(true)
  })

  it('stays disabled with only BANKING_API_KEY (no URL → zombie cron)', async () => {
    process.env.BANKING_API_KEY = 'obk_test_xxx'
    delete process.env.BANKING_API_URL
    const { bankingEnabled } = await loadBankingEnv()
    expect(bankingEnabled()).toBe(false)
  })

  it('applies the default sync cron when BANKING_SYNC_CRON is absent', async () => {
    const { appConfig } = await loadBankingEnv()
    expect(appConfig.bankingSyncCron).toBe('*/15 7-23 * * *')
  })

  it('reads an explicit BANKING_SYNC_CRON', async () => {
    process.env.BANKING_SYNC_CRON = '*/10 * * * *'
    const { appConfig } = await loadBankingEnv()
    expect(appConfig.bankingSyncCron).toBe('*/10 * * * *')
  })

  it('reads BANKING_API_URL and BANKING_SYNC_WAIT_MS', async () => {
    process.env.BANKING_API_URL = 'http://banking-api'
    process.env.BANKING_SYNC_WAIT_MS = '30000'
    const { appConfig } = await loadBankingEnv()
    expect(appConfig.bankingApiUrl).toBe('http://banking-api')
    expect(appConfig.bankingSyncWaitMs).toBe(30000)
  })

  it('defaults bankingIngestDisabled to false when BANKING_INGEST_DISABLED is absent', async () => {
    const { appConfig } = await loadBankingEnv()
    expect(appConfig.bankingIngestDisabled).toBe(false)
  })

  it('reads BANKING_INGEST_DISABLED=true as bankingIngestDisabled', async () => {
    process.env.BANKING_INGEST_DISABLED = 'true'
    const { appConfig } = await loadBankingEnv()
    expect(appConfig.bankingIngestDisabled).toBe(true)
  })
})
