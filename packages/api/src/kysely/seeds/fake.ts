import { db } from '../index.js'
import type { Clients, Companies } from '../types.js'
import type { Insertable } from 'kysely'
import { c } from 'compress-tag'
const logo = c`<svg
  width="35mm"
  height="12mm"
  viewBox="0 0 35 12"
  version="1.1"
  id="svg1"
  inkscape:version="1.3.2 (091e20ef0f, 2023-11-25, custom)"
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
    inkscape:zoom="1.5625561"
    inkscape:cx="52.798104"
    inkscape:cy="116.79581"
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
  <text
      xml:space="preserve"
      style="font-size:13.0528px;line-height:1.25;font-family:sans-serif;stroke-width:0.264583"
      x="31.383038"
      y="117.63371"
      id="text1"><tspan
        sodipodi:role="line"
        id="tspan1"
        x="31.383038"
        y="117.63371"
        style="font-style:normal;font-variant:normal;font-weight:normal;font-stretch:normal;font-family:Gidolinya;-inkscape-font-specification:Gidolinya;stroke-width:0.264583">ACME</tspan></text>
  </g>
</svg>`

const companies: Insertable<Companies>[] = [
  {
    name: 'Acme Inc',
    address: 'Hoofdweg 1',
    postalCode: '1234 AB',
    city: 'Amsterdam',
    country: 'Netherlands',
    email: 'john@acme.local',
    telephoneNumber: '0987654321',
    cocNumber: '123456789',
    iban: 'NL82RABO6579776978',
    bic: 'RABONL2U',
    prefix: 'acme',
    vatIdNumber: 'NL12345678',
    emailBcc: 'bcc@acme.local',
    logoSvg: logo.replaceAll(/(\r\n|\n|\r)/gm, '')
  }
]

const clients: Insertable<Clients>[] = [
  {
    companyName: 'Goods For All',
    address: 'Hoofdweg 2',
    postalCode: '1234 AB',
    city: 'Amsterdam',
    country: 'Nederland',
    email: 'jane@goodsforall.local',
    contactPersonName: 'Jane Doe'
  }
]

// const initialNumberForPrefixes: Insertable<InitialNumberForPrefixes>[] = [
//   {
//     companyId: 1,
//     numberPrefix: '2024.',
//     initialNumber: 5
//   }
// ]

const seed = async () => {
  await db.insertInto('companies').values(companies).execute()
  await db.insertInto('clients').values(clients).execute()
  // await db
  //   .insertInto('initialNumberForPrefixes')
  //   .values(initialNumberForPrefixes)
  //   .execute()
}

await seed()
