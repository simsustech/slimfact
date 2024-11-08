import { db } from '../index.js'
import type { Companies } from '../types.js'
import type { Insertable } from 'kysely'
import { c } from 'compress-tag'
import {
  createInvoiceHandler,
  InvoiceStatus
} from '@modular-api/fastify-checkout'
import { fastify as createFastify } from 'fastify'
import { readFileSync } from 'fs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chunk = (arr: any[], size: number) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
    arr.slice(i * size, i * size + size)
  )

const logo = c`
<svg
   width="35mm"
   height="12mm"
   viewBox="0 0 35 12"
   version="1.1"
   id="svg1"
   inkscape:version="1.3.2 (091e20ef0f, 2023-11-25, custom)"
   sodipodi:docname="logoacme.svg"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <sodipodi:namedview
     id="namedview1"
     pagecolor="#ffffff"
     bordercolor="#666666"
     borderopacity="1.0"
     inkscape:showpageshadow="2"
     inkscape:pageopacity="0.0"
     inkscape:pagecheckerboard="0"
     inkscape:deskcolor="#d1d1d1"
     inkscape:document-units="mm"
     inkscape:zoom="4.4195761"
     inkscape:cx="51.701792"
     inkscape:cy="59.847369"
     inkscape:window-width="2048"
     inkscape:window-height="1083"
     inkscape:window-x="0"
     inkscape:window-y="0"
     inkscape:window-maximized="1"
     inkscape:current-layer="layer1" />
  <defs
     id="defs1" />
  <g
     inkscape:label="Layer 1"
     inkscape:groupmode="layer"
     id="layer1"
     transform="translate(-29.520281,-107.28713)">
    <path
       style="font-size:13.0528px;line-height:1.25;font-family:Gidolinya;-inkscape-font-specification:Gidolinya;stroke-width:0.264583"
       d="m 35.259719,108.86223 c -0.339373,0 -0.691798,0.11748 -0.952854,0.36548 -0.221898,0.20884 -0.32632,0.39158 -0.600429,1.43581 l -1.86655,6.97019 h 0.992012 l 0.678746,-2.54529 h 3.49815 l 0.678746,2.54529 h 0.992013 l -1.866551,-6.97019 c -0.274108,-1.04423 -0.378531,-1.22697 -0.600428,-1.43581 -0.261056,-0.248 -0.613482,-0.36548 -0.952855,-0.36548 z m -1.501072,5.31249 0.887591,-3.30236 c 0.182739,-0.70485 0.248003,-0.90064 0.339372,-0.99201 0.06526,-0.0653 0.169687,-0.10442 0.274109,-0.10442 0.104423,0 0.208845,0.0392 0.274109,0.10442 0.09137,0.0914 0.156634,0.28716 0.339373,0.99201 l 0.88759,3.30236 z m 8.902002,-5.31249 c -1.096435,0 -1.853497,0.45685 -2.310345,1.04423 -0.626535,0.82232 -0.626535,1.69686 -0.626535,3.38067 0,1.68381 0,2.55835 0.626535,3.38068 0.456848,0.58737 1.21391,1.04422 2.310345,1.04422 0.900643,0 1.775181,-0.31327 2.427821,-0.88759 l -0.587376,-0.7179 c -0.482954,0.44379 -1.161699,0.69179 -1.840445,0.69179 -0.678745,0 -1.200857,-0.248 -1.514125,-0.65264 -0.456848,-0.60043 -0.456848,-1.22696 -0.456848,-2.85856 0,-1.6316 0,-2.25813 0.456848,-2.85856 0.313268,-0.39159 0.83538,-0.65264 1.514125,-0.65264 0.626535,0 1.253069,0.22189 1.72297,0.61348 l 0.56127,-0.73096 c -0.639587,-0.52211 -1.474966,-0.79622 -2.28424,-0.79622 z m 6.604708,0 c -0.783168,0 -1.39665,0.27411 -1.827392,0.71791 -0.65264,0.66569 -0.65264,1.56633 -0.65264,2.62361 v 5.42996 h 0.965907 v -5.42996 c 0,-0.99201 0,-1.54023 0.365478,-1.98403 0.234951,-0.28716 0.626535,-0.44379 1.083383,-0.44379 0.456848,0 0.848432,0.15663 1.083382,0.44379 0.365479,0.4438 0.365479,0.99202 0.365479,1.98403 v 5.42996 h 0.965907 v -5.42996 c 0,-0.99201 0,-1.54023 0.365478,-1.98403 0.234951,-0.28716 0.626535,-0.44379 1.083383,-0.44379 0.456848,0 0.848432,0.15663 1.083382,0.44379 0.365478,0.4438 0.365478,0.99202 0.365478,1.98403 v 5.42996 h 0.965908 v -5.42996 c 0,-1.05728 0,-1.93182 -0.626535,-2.62361 -0.404637,-0.4438 -0.992013,-0.71791 -1.722969,-0.71791 -0.887591,0 -1.540231,0.36548 -1.95792,1.04423 -0.365479,-0.6918 -1.07033,-1.04423 -1.905709,-1.04423 z m 9.071692,3.83752 v -1.73602 c 0,-0.53516 0,-0.82232 0.221897,-0.99201 0.156634,-0.11748 0.378531,-0.11748 0.861485,-0.11748 h 2.780246 v -0.91369 h -2.780246 c -0.574323,0 -1.096435,0 -1.527178,0.36548 -0.522112,0.45684 -0.522112,1.03117 -0.522112,1.6577 v 4.6468 c 0,0.62653 0,1.20086 0.522112,1.6577 0.430743,0.36548 0.952855,0.36548 1.527178,0.36548 h 2.780246 v -0.91369 h -2.780246 c -0.482954,0 -0.704851,0 -0.861485,-0.11748 -0.221897,-0.16968 -0.221897,-0.45685 -0.221897,-0.99201 v -1.99708 l 3.08046,-0.0131 v -0.9137 z"
       id="text1"
       aria-label="ACME" />
  </g>
</svg>`

const fastify = createFastify()
const kysely = db
const invoiceHandler = createInvoiceHandler({
  fastify,
  kysely
})

const seed = async () => {
  const { companies, clients, invoiceLines } = JSON.parse(
    readFileSync(new URL('./fake/data.json', import.meta.url).pathname, 'utf-8')
  )

  await db
    .insertInto('companies')
    .values(
      companies.map((company: Insertable<Companies>) => ({
        ...company,
        logoSvg: logo.replaceAll(/(\r\n|\n|\r)/gm, '')
      }))
    )
    .execute()

  for (const insertClients of chunk(clients, 1000)) {
    await db.insertInto('clients').values(insertClients).execute()
  }

  const insertedCompanies = await db
    .selectFrom('companies')
    .selectAll()
    .execute()
  const insertedClients = await db.selectFrom('clients').selectAll().execute()
  const numberPrefix = await db
    .selectFrom('numberPrefixes')
    .selectAll()
    .executeTakeFirstOrThrow()

  for (const client of insertedClients) {
    const company =
      insertedCompanies[Math.floor(Math.random() * companies.length)]

    for (let i = 0; i < Math.floor(Math.random() * 10); i++) {
      await invoiceHandler.createInvoice({
        companyDetails: company,
        clientDetails: client,
        companyPrefix: company.prefix,
        numberPrefixTemplate: numberPrefix.template,
        currency: 'EUR',
        lines: [invoiceLines[Math.floor(Math.random() * invoiceLines.length)]],
        discounts: [],
        surcharges: [],
        paymentTermDays: 14,
        locale: 'en-US',
        status: Math.random() > 0.2 ? InvoiceStatus.BILL : undefined,
        companyId: company.id,
        clientId: client.id
      })
    }
  }
}

await seed()
