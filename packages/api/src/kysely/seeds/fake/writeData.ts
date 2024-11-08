import generateData from './generateData.js'
import { writeFileSync } from 'fs'

const { companies, clients, invoiceLines } = generateData()

const json = JSON.stringify({
  companies,
  clients,
  invoiceLines
})

writeFileSync(new URL('./data.json', import.meta.url).pathname, json, 'utf-8')
