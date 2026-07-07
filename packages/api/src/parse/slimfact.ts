interface InvoiceLine {
  quantity: number
  description: string
  unitPrice: number
  vatRate: number
  amountExclTax: number
}

interface ParsedInvoice {
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  lines: InvoiceLine[]
  totalExclTax: number
  vatAmount: number
  totalInclTax: number
}
function parseInvoice(ocrText: string): ParsedInvoice {
  const toCents = (val: string): number =>
    Math.round(parseFloat(val.replace(/[^\d.-]/g, '')) * 100)

  // 1. Robust Header Parsing
  // We look for the values that typically appear near the "Invoice number" label
  const linesArray = ocrText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')

  let invoiceNumber = ''
  let invoiceDate = ''

  linesArray.forEach((line, index) => {
    if (line.toLowerCase().includes('invoice number')) {
      // Check current line, then the line above (common in multi-column OCR)
      invoiceNumber = line.match(/[\d.]+/)?.[0] || linesArray[index - 2] || ''
    }
    if (line.toLowerCase().includes('invoice date')) {
      invoiceDate =
        line.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)?.[0] ||
        linesArray[index - 2] ||
        ''
    }
  })

  // 2. Due Date Extraction
  const dueDateMatch = ocrText.match(/before\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)

  // 3. Line Items (Improved Regex to handle potential OCR artifacts)
  const lines: InvoiceLine[] = []
  // Pattern: [Qty] [Desc] [Currency] [Price] [=] [VAT%] [Currency] [Total]
  const lineRegex =
    /^(\d+)\s+(.*?)\s+€\s*([\d,.]+)\s*=\s*(\d+)%\s*€\s*([\d,.]+)$/gm

  let match
  while ((match = lineRegex.exec(ocrText)) !== null) {
    lines.push({
      quantity: parseInt(match[1]),
      description: match[2].trim(),
      unitPrice: toCents(match[3]),
      vatRate: parseInt(match[4]),
      amountExclTax: toCents(match[5])
    })
  }

  // 4. Totals Extraction
  const totalExcl = toCents(
    ocrText.match(/Total excl\. tax:\s*€\s*([\d,.]+)/i)?.[1] || '0'
  )
  const vatTotal = toCents(
    ocrText.match(/VAT\s*21%:\s*€\s*([\d,.]+)/i)?.[1] || '0'
  )
  const totalIncl = toCents(
    ocrText.match(/Total incl\. tax:\s*€\s*([\d,.]+)/i)?.[1] || '0'
  )

  // 5. Validation Logic
  if (lines.length === 0) throw new Error('No invoice lines found.')

  let calculatedExcl = 0
  lines.forEach((line) => {
    // Basic line integrity
    if (Math.abs(line.quantity * line.unitPrice - line.amountExclTax) > 1) {
      throw new Error(`Line math mismatch for: ${line.description}`)
    }
    calculatedExcl += line.amountExclTax
  })

  // Final check: Line sum vs Total Footer
  if (calculatedExcl !== totalExcl) {
    throw new Error(
      `Subtotal mismatch! Calculated: ${calculatedExcl}, OCR Footer: ${totalExcl}`
    )
  }

  return {
    invoiceNumber,
    invoiceDate,
    dueDate: dueDateMatch?.[1] || '',
    lines,
    totalExclTax: totalExcl,
    vatAmount: vatTotal,
    totalInclTax: totalIncl
  }
}
// Example Usage:
const ocrInputString = `ACME

Sipes and Sons

Patsy Labadie DVM
2287 Freeman Fall
10503-2904 Asheville
United States

Invoice

Quantity Description

Batz, Ullrich and Gutmann
60280 Western Avenue
94807-0227 Koelpinland
The Netherlands

1-961-913-1182 x1439
Camron87@yahoo.com

CoC number: 978-1-4922-0067-3
VAT ID: NL705568076B01
IBAN: LI13302676111064472765
BIC: CBBTSXM6

2026.1
3/29/26

Invoice number:
Invoice date:

Unit price Discount VAT Amount excl. tax

1 Handcrafted Granite Sausages

€ 582.78 = 21% € 582.78
Total excl. tax: € 582.78
VAT 21%: € 122.38
Total incl. tax: € 705.16

Payment to be received within 14 days (before 4/12/26) on bank account number LI3302676111064472765 in the name of Batz, Ullrich and Gutmann. Please include your invoice
`

try {
  const result = parseInvoice(ocrInputString)
  console.log('Invoice Verified:', JSON.stringify(result, null, 2))
} catch (error) {
  console.error('Data Integrity Error:', error)
}
