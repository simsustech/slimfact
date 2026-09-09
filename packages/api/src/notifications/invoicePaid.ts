import handlebars from 'handlebars'
import type { FastifyInstance } from 'fastify'
import type { OnInvoicePaidArgs } from '@modular-api/fastify-checkout'
import { emailTemplates } from '../templates/email/index.js'

export type InvoicePaidNotificationOptions = {
  /** ADMIN_NOTIFICATION_EMAIL; when unset the company's own email is used. */
  adminNotificationEmail: string | undefined
  /** Request host, used to build the invoice URL in the mail body. */
  host: string
}

/**
 * Best-effort admin notification fired by the invoiceHandler whenever an
 * invoice transitions into PAID (PSP settlement, bank-sync apply, or manual
 * payment). Recipient: ADMIN_NOTIFICATION_EMAIL, falling back to the
 * company's own email address.
 *
 * Takes `fastify` like the other notifying routes (e.g. the trpc invoice
 * handlers) and reads `fastify.log` / `fastify.mailer` at call time: the
 * nodemailer plugin only decorates `fastify.mailer` during registration, and
 * this callback fires on a paid transition — i.e. after startup — so the
 * decoration is always resolved by then.
 *
 * Returns true when the email was sent; never throws — a notification
 * failure must never break a settlement (the invoiceHandler already wraps
 * this call in its own catch, but we keep that guarantee local too).
 */
export const sendInvoicePaidNotification = async (
  fastify: FastifyInstance,
  { invoice }: OnInvoicePaidArgs,
  { adminNotificationEmail, host }: InvoicePaidNotificationOptions
): Promise<boolean> => {
  const mailer = fastify.mailer
  if (!mailer) {
    fastify.log.warn(
      'mailer not configured — skipping invoice-paid notification'
    )
    return false
  }
  const recipient = adminNotificationEmail || invoice.companyDetails.email
  if (!recipient) {
    fastify.log.warn(
      `invoice ${invoice.numberPrefix}${invoice.number} paid but no recipient configured — set ADMIN_NOTIFICATION_EMAIL`
    )
    return false
  }
  const locale = invoice.locale || 'en-US'
  let template: { subject: string; body: string }
  try {
    template = await emailTemplates[`./invoice/paid/${locale}.ts`]()
  } catch {
    template = await emailTemplates['./invoice/paid/en-US.ts']()
  }
  const totalIncludingTax = Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    style: 'currency',
    currency: invoice.currency
  }).format(invoice.totalIncludingTax / 100)
  const context = {
    numberPrefix: invoice.numberPrefix,
    number: invoice.number,
    totalIncludingTax,
    companyDetails: invoice.companyDetails,
    clientDetails: invoice.clientDetails,
    invoiceUrl: `https://${host}/invoice/${invoice.uuid}`
  }
  await mailer.sendMail({
    from: `${invoice.companyDetails.name} <noreply@slimfact.app>`,
    to: recipient,
    subject: handlebars.compile(template.subject)(context),
    html: handlebars.compile(template.body)(context)
  })
  fastify.log.info(
    `sent invoice-paid notification for ${invoice.numberPrefix}${invoice.number} to ${recipient}`
  )
  return true
}
