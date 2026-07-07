// Manual verification script — run against a running stack
// Usage: npx tsx tests/manual-verify-flow.ts

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://slimfact.localhost'

interface Invoice {
  id: number
  uuid: string
  status: string
  companyId: number
  clientId: number
  companyPrefix: string
  numberPrefixTemplate: string
  amountDue?: number
  amountPaid?: number
}

async function call(path: string, body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  return res.json()
}

async function main() {
  console.log('=== Testing setInvoiceStatus guards ===\n')

  // Test 1: BILL → OPEN (should fail)
  console.log('1. BILL → OPEN (should fail)')
  // First find a bill
  const bills = await call('/api/trpc/admin.getBills?input={}')
  console.log('  Bills response:', JSON.stringify(bills).substring(0, 200))

  // Test 2: RECEIPT → OPEN (should fail)
  console.log('\n2. RECEIPT → OPEN (should fail)')

  // Test 3: BILL → RECEIPT with amountDue > 0 (should fail)
  console.log('\n3. BILL → RECEIPT with amountDue > 0 (should fail)')

  // Test 4: PAID → CANCELED (should fail)
  console.log('\n4. PAID → CANCELED (should fail)')

  // Test 5: RECEIPT → CANCELED (should fail)
  console.log('\n5. RECEIPT → CANCELED (should fail)')

  // Test 6: CONCEPT → RECEIPT (should fail)
  console.log('\n6. CONCEPT → RECEIPT (should fail)')

  // Test 7: CONCEPT → OPEN (should succeed)
  console.log('\n7. CONCEPT → OPEN (should succeed)')

  // Test 8: CONCEPT → CANCELED (should succeed)
  console.log('\n8. CONCEPT → CANCELED (should succeed)')

  // Test 9: BILL with no payments → CANCELED (should succeed)
  console.log('\n9. BILL (no payments) → CANCELED (should succeed)')

  // Test 10: BILL with payments → CANCELED (should fail)
  console.log('\n10. BILL (with payments) → CANCELED (should fail)')
}

main()
