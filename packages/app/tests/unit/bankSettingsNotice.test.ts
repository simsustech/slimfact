import { describe, it, expect } from 'vitest'
import enUS from '../../src/lang/en-US.js'
import nl from '../../src/lang/nl.js'
import de from '../../src/lang/de.js'

// The banner on /admin/settings/banking renders `lang.bank.notConfigured` when
// the api reports banking as disabled, i.e. when `bankingEnabled()` in
// packages/api is false — which needs BANKING_API_KEY *and* BANKING_API_URL on
// the SlimFact api service.
//
// It used to tell operators to set OPENBANKING_CREDENTIALS_JSON, which belongs
// to the banking-api proxy; setting it there cannot turn this banner off. The
// e2e that covers the notice (packages/api/tests/e2e/banking-review.spec.ts)
// skips itself whenever a stack runs with banking configured, so this is the
// only guard against the message naming the wrong variable again.
const locales = Object.entries({ 'en-US': enUS, nl, de })

describe('bank settings not-configured notice', () => {
  it('names the variables the SlimFact api actually needs', () => {
    for (const [name, lang] of locales) {
      expect(lang.bank.notConfigured, name).toContain('BANKING_API_URL')
      expect(lang.bank.notConfigured, name).toContain('BANKING_API_KEY')
    }
  })

  it('never points at a banking-api-only variable', () => {
    for (const [name, lang] of locales) {
      expect(lang.bank.notConfigured, name).not.toContain(
        'OPENBANKING_CREDENTIALS_JSON'
      )
      expect(lang.bank.notConfigured, name).not.toContain('POSTGRES_')
    }
  })
})
