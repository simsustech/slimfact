import handlebars from 'handlebars'
import type { OnInvoicePaidArgs } from '@modular-api/fastify-checkout'
import { emailTemplates } from '../templates/email/index.js'

type PaidNotificationLogger = {
  warn: (msg: string) => void
  info: (msg: string) => void
}

type PaidNotificationMailer = {
  sendMail: (opts: {
    from: string
    to: string
    subject: string
    html: string
  }) => Promise<unknown>
}

export type InvoicePaidNotificationDeps = {
  logger: PaidNotificationLogger
  mailer: PaidNotificationMailer | undefined
  adminNotificationEmail: string | undefined
  host: string
}

/**
 * Best-effort admin notification fired by the invoiceHandler whenever an
 * invoice transitions into PAID (PSP settlement, bank-sync apply, or manual
 * payment). Recipient: ADMIN_NOTIFICATION_EMAIL, falling back to the
 * company's own email address.
 *
 * Returns true when the email was sent; never throws — a notification
 * failure must never break a settlement (the invoiceHandler already wraps
 * this call in its own catch, but we keep that guarantee local too).
 */
export const sendInvoicePaidNotification = async (
  { invoice }: OnInvoicePaidArgs,
  { logger, mailer, adminNotificationEmail, host }: InvoicePaidNotificationDeps
): Promise<boolean> => {
  if (!mailer) {
    logger.warn('mailer not configured — skipping invoice-paid notification')
    return false
  }
  const recipient = adminNotificationEmail || invoice.companyDetails.email
  if (!recipient) {
    logger.warn(
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
  logger.info(
    `sent invoice-paid notification for ${invoice.numberPrefix}${invoice.number} to ${recipient}`
  )
  return true
}
