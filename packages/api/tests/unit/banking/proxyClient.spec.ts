import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AddressInfo } from 'node:net'
import type { IncomingMessage } from 'node:http'
import { WebSocketServer, type WebSocket } from 'ws'
import { createClient } from '../../../src/banking/client.js'
import { createBankingApiClient } from '@slimfact/banking-api/client'

const jsonResponse = (data: unknown) =>
  new Response(JSON.stringify([{ result: { data } }]), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })

describe('proxy client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the API key as Authorization on httpBatchLink requests', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({ items: [], total: 0 })
    )
    vi.stubGlobal('fetch', fetchMock)

    const api = createClient({
      url: 'http://banking-api',
      apiKey: 'obk_test_xxx'
    })
    await api.getTransactions('acc-1', { from: '2026-01-01', limit: 5 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [urlArg, init] = fetchMock.mock.calls[0]!
    const url = String(urlArg)
    expect(url).toContain('banking-api/trpc/listTransactions')
    expect(init?.headers).toMatchObject({
      authorization: 'Bearer obk_test_xxx'
    })

    // TransactionQuery is mapped onto the listTransactions input (GET batch).
    const decoded = decodeURIComponent(url)
    expect(decoded).toContain('"accountId":"acc-1"')
    expect(decoded).toContain('"from":"2026-01-01"')
    expect(decoded).toContain('"limit":5')
    expect(decoded).toContain('"offset":0')
  })

  it('maps getTransactions to a TransactionPage', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({
          items: [
            {
              externalId: 'tx-1',
              bookingDate: '2026-08-01',
              amountCents: 4200,
              creditDebit: 'CRDT',
              remittanceInformation: '2026-0001'
            }
          ],
          total: 1
        })
    )
    vi.stubGlobal('fetch', fetchMock)

    const api = createClient({
      url: 'http://banking-api',
      apiKey: 'obk_test_xxx'
    })
    const page = await api.getTransactions('acc-1')

    expect(page.total).toBe(1)
    expect(page.items).toHaveLength(1)
  })

  it('maps getPspSettlements rows and passes through the psp/from filters', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse([
          {
            externalId: 'setl-1',
            psp: 'mollie',
            amountCents: 4950,
            feeCents: 50,
            currency: 'EUR',
            payoutDate: '2026-08-01',
            status: 'paidout',
            syncedAt: '2026-08-01T10:00:00Z',
            metadata: { reference: 'SET-1' }
          }
        ])
    )
    vi.stubGlobal('fetch', fetchMock)

    const api = createClient({
      url: 'http://banking-api',
      apiKey: 'obk_test_xxx'
    })
    const rows = await api.getPspSettlements({
      psp: 'mollie',
      from: '2026-07-01'
    })

    const url = String(fetchMock.mock.calls[0]![0])
    expect(url).toContain('listPspSettlements')
    const decoded = decodeURIComponent(url)
    expect(decoded).toContain('"psp":"mollie"')
    expect(decoded).toContain('"from":"2026-07-01"')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      externalId: 'setl-1',
      psp: 'mollie',
      amountCents: 4950,
      feeCents: 50,
      currency: 'EUR',
      payoutDate: '2026-08-01'
    })
  })

  it('maps getPspPayments rows with the settlementId filter', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse([
          {
            psp: 'mollie',
            externalId: 'pay-1',
            settlementId: 'setl-1',
            amountCents: 2500,
            currency: 'EUR',
            status: 'paid',
            paidAt: '2026-07-30T10:00:00Z',
            syncedAt: '2026-07-31T10:00:00Z'
          }
        ])
    )
    vi.stubGlobal('fetch', fetchMock)

    const api = createClient({
      url: 'http://banking-api',
      apiKey: 'obk_test_xxx'
    })
    const rows = await api.getPspPayments({ settlementId: 'setl-1' })

    const url = String(fetchMock.mock.calls[0]![0])
    expect(url).toContain('listPspPayments')
    expect(decodeURIComponent(url)).toContain('"settlementId":"setl-1"')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      externalId: 'pay-1',
      settlementId: 'setl-1',
      amountCents: 2500,
      status: 'paid'
    })
  })

  // The handshake can be delayed when sibling tests in this file each created
  // a banking-api client whose eager WS open to an unresolvable host (the
  // stubbed-fetch tests use url 'http://banking-api') spins DNS lookups that
  // saturate libuv's thread pool — give the localhost connect a real budget.
  it(
    'sends the API key at the WS handshake (event bus)',
    { timeout: 20000 },
    async () => {
      const handshakeHeaders: Record<string, string | undefined>[] = []
      const wss = new WebSocketServer({ port: 0 })
      wss.on('connection', (_socket: WebSocket, req: IncomingMessage) => {
        handshakeHeaders.push(req.headers as Record<string, string | undefined>)
      })

      try {
        const port = (wss.address() as AddressInfo).port
        const client = createBankingApiClient({
          url: `http://localhost:${port}`,
          apiKey: 'obk_test_yyy'
        })
        const unsubscribe = client.subscribeEvents('bank.sync.*', () => {})

        await vi.waitFor(
          () => {
            expect(handshakeHeaders.length).toBe(1)
          },
          { timeout: 15000 }
        )
        expect(handshakeHeaders[0]!.authorization).toBe('Bearer obk_test_yyy')

        unsubscribe()
        await new Promise((resolve) => setTimeout(resolve, 100))
        await client.close()
      } finally {
        await new Promise((resolve) => wss.close(resolve))
      }
    }
  )
})
