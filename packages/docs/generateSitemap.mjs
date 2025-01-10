import { generateSitemap } from 'sitemap-ts'

const args = process.argv.slice(2)
const hostname = args[0]
const protocol = args[1] || 'https'
if (!hostname) throw new Error('Please provide a hostname argument')

const origin = `${protocol}://${hostname}`
generateSitemap({
  hostname: origin,
  outDir: new URL(`./dist/static/`, import.meta.url).pathname
})
