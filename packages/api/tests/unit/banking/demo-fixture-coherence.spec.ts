import { describe, expect, it } from 'vitest'
import { demoCore } from '@slimfact/tools/banking/demo/core'
import { demoBanking } from '@slimfact/tools/banking/demo/banking'

// Cross-fixture coherence (critique #1): the api `demoCore` and the
// banking-api `demoBanking` fixtures are generated from the same in-memory
// model but committed as two separate files. This spec imports BOTH committed
// modules and fails on any drift between them (invoice numbers, settlement
// ids, amounts, and the settlement net math).

describe('demo fixture coherence', () => {
  it('every psp_payment.invoiceNumber is a numbered demo invoice', () => {
    const numbered = new Set(
      demoCore.invoices
        .filter((inv) => inv.number !== null)
        .map((inv) => inv.number!)
    )
    expect(numbered.size).toBeGreaterThan(0)
    for (const p of demoBanking.pspPayments) {
      expect(numbered.has(p.invoiceNumber)).toBe(true)
    }
  })

  it('every core payment settlementId is a banking settlement', () => {
    const settlementIds = new Set(
      demoBanking.pspSettlements.map((s) => s.externalId)
    )
    expect(settlementIds.size).toBeGreaterThan(0)
    for (const payment of demoCore.payments) {
      if (payment.settlementId === null) continue
      expect(settlementIds.has(payment.settlementId)).toBe(true)
    }
  })

  it('banking psp_payments and core PSP payments agree 1:1 by externalId', () => {
    const coreById = new Map(
      demoCore.payments
        .filter((p) => p.externalId !== null)
        .map((p) => [p.externalId, p])
    )
    const bankingById = new Map(
      demoBanking.pspPayments.map((p) => [p.externalId, p])
    )
    // Every banking psp_payment has a matching core payment with same amount + settlement.
    for (const p of demoBanking.pspPayments) {
      const core = coreById.get(p.externalId)
      expect(core).toBeDefined()
      expect(core!.settlementId).toBe(p.settlementId)
      expect(core!.amountCents).toBe(p.amountCents)
    }
    // And every core PSP payment has a matching banking psp_payment.
    for (const p of demoCore.payments) {
      if (p.externalId === null) continue
      expect(bankingById.has(p.externalId)).toBe(true)
    }
  })

  it('per-settlement net math holds across both fixtures', () => {
    const grossBySettlement = new Map<string, number>()
    for (const p of demoBanking.pspPayments) {
      grossBySettlement.set(
        p.settlementId,
        (grossBySettlement.get(p.settlementId) ?? 0) + p.amountCents
      )
    }
    const refundsBySettlement = new Map<string, number>()
    for (const refund of demoCore.refunds) {
      const payment = demoBanking.pspPayments.find(
        (p) => p.externalId === refund.paymentExternalId
      )
      if (!payment) continue
      refundsBySettlement.set(
        payment.settlementId,
        (refundsBySettlement.get(payment.settlementId) ?? 0) +
          refund.amountCents
      )
    }
    for (const s of demoBanking.pspSettlements) {
      const gross = grossBySettlement.get(s.externalId) ?? 0
      const refunds = refundsBySettlement.get(s.externalId) ?? 0
      expect(s.amountCents).toBe(gross - refunds - s.feeCents)
    }
  })
})
