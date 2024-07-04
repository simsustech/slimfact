import fastify, { type FastifyRequest, type FastifyReply } from 'fastify'
import { chromium } from 'playwright'
import fastifyRateLimit from '@fastify/rate-limit'
const app = fastify({
  logger: {
    level: 'info'
  }
})

await app.register(fastifyRateLimit, {
  max: 30,
  timeWindow: '1 minute'
})

app.get(
  '/',
  async (
    request: FastifyRequest<{ Querystring: { host: string; uuid: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { host, uuid } = request.query
      if (!host || !uuid) {
        reply.statusCode = 404
        return reply.send()
      }
      app.log.info(host)
      app.log.info(uuid)
      const browser = await chromium.launch({})
      const page = await browser.newPage({
        ignoreHTTPSErrors: !!process.env.DEV
      })
      await page.goto(`https://${host}/invoice/${uuid}`)
      await page.waitForLoadState('networkidle')

      const download = await page.pdf({
        format: 'A4',
        printBackground: true
      })

      reply.header(
        'Content-Disposition',
        `attachment; filename=${await page.title()}`
      )

      reply.send(download)
    } catch (e) {
      app.log.info(e)
      reply.statusCode = 404
      return reply.send()
    }
  }
)

app.listen({
  port: Number(process.env.PORT || 3002),
  host: process.env.HOST || 'localhost'
})
