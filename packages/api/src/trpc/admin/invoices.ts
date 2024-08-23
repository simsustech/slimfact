import { TRPCError } from '@trpc/server'
import { t } from '../index.js'
import * as z from 'zod'
import type { FastifyInstance } from 'fastify'
import { invoice as invoiceValidation } from '../../zod/invoice.js'
import { db } from '../../kysely/index.js'
import handlebars from 'handlebars'
import env from '@vitrify/tools/env'
import { Readable } from 'stream'
import { Invoice } from '@modular-api/fastify-checkout'
import { addDays } from 'date-fns'
import { PaymentMethod, InvoiceStatus } from '@modular-api/fastify-checkout'
const hostname = env.read('API_HOSTNAME') || env.read('VITE_API_HOSTNAME')
const slimfactDownloaderHostname =
  env.read('SLIMFACT_DOWNLOADER_HOSTNAME') ||
  env.read('VITE_SLIMFACT_DOWNLOADER_HOSTNAME') ||
  'download.slimfact.app'
const formatDateShort = ({
  dateString,
  locale
}: {
  dateString: string
  locale: string
}) => {
  const shortDateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'short'
  })
  const date = new Date(dateString)
  return shortDateFormatter.format(date)
}
const formatPrice = ({
  currency,
  value,
  locale
}: {
  currency: string
  value: number
  locale: string
}) =>
  Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    style: 'currency',
    currency: currency
  }).format(value / 100)

const composeEmail = ({
  invoice,
  emailSubject,
  emailBody
}: {
  invoice: Invoice
  emailSubject: string
  emailBody: string
}) => {
  const subject = handlebars.compile(emailSubject)({
    numberPrefix: invoice.numberPrefix,
    number: invoice.number,
    dueDate: formatDateShort({
      dateString: invoice.dueDate!,
      locale: invoice.locale
    })
  })
  const body = handlebars.compile(emailBody)({
    numberPrefix: invoice.numberPrefix,
    number: invoice.number,
    dueDate: formatDateShort({
      dateString: invoice.dueDate!,
      locale: invoice.locale
    }),
    invoiceUrl: `https://${hostname}/invoice/${invoice.uuid}`
  })

  return { subject, body }
}

export const downloadPdf = async (invoice: Invoice) => {
  let filename
  let pdf
  try {
    const pdfResponse = await fetch(
      `https://${slimfactDownloaderHostname}/?uuid=${invoice.uuid}&host=${hostname}`
    )

    const header = pdfResponse.headers.get('Content-Disposition')
    const parts = header!.split(';')
    filename = parts[1].split('=')[1]
    // @ts-expect-error body does not match type
    if (pdfResponse.body) pdf = Readable.fromWeb(pdfResponse.body)
    return { success: true as const, filename, pdf }
  } catch (e) {
    console.error('Failed to download PDF')
    return { success: false as const }
  }
}
export const adminInvoiceRoutes = ({
  fastify,
  procedure
}: {
  fastify: FastifyInstance
  procedure: typeof t.procedure
}) => ({
  createInvoice: procedure
    .input(invoiceValidation)
    .mutation(async ({ input }) => {
      if (fastify.checkout?.invoiceHandler) {
        if (input.companyId) {
          const companyDetails = await db
            .selectFrom('companies')
            .where('id', '=', input.companyId)
            .selectAll()
            .executeTakeFirstOrThrow()

          const clientDetails =
            (await db
              .selectFrom('clients')
              .where('id', '=', input.clientId)
              .select([
                'clients.id',
                'clients.companyName',
                'clients.contactPersonName',
                'clients.address',
                'clients.postalCode',
                'clients.city',
                'clients.country',
                'clients.vatIdNumber',
                'clients.email',
                'clients.number'
              ])
              .executeTakeFirst()) || input.clientDetails

          if (!clientDetails)
            throw new Error('Please define clientDetails or clientId.')

          const result = await fastify?.checkout?.invoiceHandler?.createInvoice(
            {
              companyDetails,
              clientDetails,
              companyPrefix: companyDetails.prefix,
              numberPrefixTemplate: input.numberPrefixTemplate,
              currency: input.currency,
              lines: input.lines,
              discounts: input.discounts,
              surcharges: input.surcharges,
              paymentTermDays: input.paymentTermDays,
              locale: input.locale,
              notes: input.notes,
              projectId: input.projectId,
              requiredDownPaymentAmount: input.requiredDownPaymentAmount,
              status: input.status,
              companyId: companyDetails.id,
              clientId: clientDetails.id,
              metadata: input.metadata
            }
          )

          if (result.success) return result.invoice
          else console.error(result.errorMessage)
        }
      }
      throw new TRPCError({
        code: 'BAD_REQUEST'
      })
    }),
  updateInvoice: procedure
    .input(invoiceValidation)
    .mutation(async ({ input }) => {
      if (fastify.checkout?.invoiceHandler) {
        const { id, uuid } = input
        if ((id || uuid) && input.companyId) {
          const companyDetails = await db
            .selectFrom('companies')
            .where('id', '=', input.companyId)
            .selectAll()
            .executeTakeFirstOrThrow()

          const clientDetails =
            (await db
              .selectFrom('clients')
              .where('id', '=', input.clientId)
              .select([
                'clients.id',
                'clients.companyName',
                'clients.contactPersonName',
                'clients.address',
                'clients.postalCode',
                'clients.city',
                'clients.country',
                'clients.vatIdNumber',
                'clients.email',
                'clients.number'
              ])
              .executeTakeFirst()) || input.clientDetails

          if (!clientDetails)
            throw new Error('Please define clientDetails or clientId.')

          const result = await fastify?.checkout?.invoiceHandler?.updateInvoice(
            {
              id,
              uuid,
              companyDetails,
              clientDetails,
              companyPrefix: companyDetails.prefix,
              numberPrefixTemplate: input.numberPrefixTemplate,
              currency: input.currency,
              lines: input.lines,
              discounts: input.discounts,
              surcharges: input.surcharges,
              paymentTermDays: input.paymentTermDays,
              locale: input.locale,
              notes: input.notes,
              projectId: input.projectId,
              requiredDownPaymentAmount: input.requiredDownPaymentAmount,
              status: input.status,
              companyId: companyDetails.id,
              clientId: clientDetails.id,
              metadata: input.metadata
            }
          )

          if (result.success) return result.invoice
          else console.error(result.errorMessage)
        }
      }
      throw new TRPCError({
        code: 'BAD_REQUEST'
      })
    }),
  getInvoices: procedure
    .input(
      z
        .object({
          companyId: z.number().nullable().optional(),
          clientId: z.number().nullable().optional(),
          status: z.nativeEnum(InvoiceStatus).nullable(),
          pagination: z
            .object({
              limit: z.number(),
              offset: z.number(),
              sortBy: z.union([
                z.literal('id'),
                z.literal('companyId'),
                z.literal('clientId'),
                z.literal('totalIncludingTax')
              ]),
              descending: z.boolean()
            })
            .optional()
        })
        .optional()
    )
    .query(async ({ input }) => {
      const { companyId, clientId, status, pagination } = input || {}
      if (fastify.checkout?.invoiceHandler) {
        const invoices = await fastify.checkout.invoiceHandler.getInvoices({
          companyId,
          clientId,
          status,
          options: {
            withPayments: true,
            withAmountPaid: true,
            withAmountDue: true,
            withRefunds: true,
            withAmountRefunded: true
          },
          pagination
        })
        return invoices
      }
    }),
  getInvoice: procedure
    .input(
      z.object({
        id: z.number().optional(),
        uuid: z.string().optional()
      })
    )
    .query(async ({ input }) => {
      if (fastify.checkout?.invoiceHandler) {
        const { id, uuid } = input
        const invoice = await fastify.checkout.invoiceHandler.getInvoice({
          id,
          uuid,
          options: {
            withAmountPaid: true,
            withPayments: true,
            withAmountDue: true,
            withAmountRefunded: true,
            withRefunds: true
          }
        })
        return invoice
      }
      throw new TRPCError({
        code: 'BAD_REQUEST'
      })
    }),
  sendInvoice: procedure
    .input(
      z.object({
        id: z.number(),
        emailSubject: z.string(),
        emailBody: z.string()
      })
    )
    .mutation(async ({ input }) => {
      try {
        if (fastify.checkout?.invoiceHandler) {
          const { id, emailSubject, emailBody } = input
          const invoice = await fastify.checkout.invoiceHandler.getInvoice({
            id
          })
          if (invoice) {
            const currentDate = new Date()

            const numberPrefix = handlebars.compile(
              invoice.numberPrefixTemplate
            )({
              YYYY: currentDate.getFullYear(),
              MM: currentDate.getMonth() + 1,
              clientDetails: {
                number: invoice.clientDetails.number
              },
              companyDetails: {
                prefix: invoice.companyPrefix
              },
              projectId: invoice.projectId
            })
            const { initialNumber } =
              (await db
                .selectFrom('initialNumberForPrefixes')
                .where('numberPrefix', '=', numberPrefix)
                .select('initialNumber')
                .executeTakeFirst()) || {}

            const result = await fastify.checkout.invoiceHandler.openInvoice({
              id,
              numberPrefix,
              initialNumber
            })
            if (result.success) {
              const { subject, body } = composeEmail({
                invoice: result.invoice,
                emailSubject,
                emailBody
              })

              const pdfResult = await downloadPdf(invoice)
              const attachments = []
              if (pdfResult.success)
                attachments.push({
                  filename: pdfResult.filename,
                  content: pdfResult.pdf
                })
              await fastify.mailer?.sendMail({
                from: `${invoice.companyDetails.name} <noreply@slimfact.app>`,
                replyTo: invoice.companyDetails.email,
                to: invoice.clientDetails.email,
                subject,
                html: body,
                attachments
              })
              return true
            }
            return false
          }
        }
      } catch (e) {
        if (import.meta.env.DEBUG) fastify.log.debug(e)
        throw new TRPCError({
          code: 'BAD_REQUEST'
        })
      }
    }),
  remindInvoice: procedure
    .input(
      z.object({
        id: z.number(),
        emailSubject: z.string(),
        emailBody: z.string()
      })
    )
    .mutation(async ({ input }) => {
      try {
        if (fastify.checkout?.invoiceHandler) {
          const { id, emailSubject, emailBody } = input
          const invoice = await fastify.checkout.invoiceHandler.getInvoice({
            id
          })
          const reminderSentDates = invoice?.reminderSentDates
          const currentDate = new Date().toISOString().slice(0, 10)
          if (invoice?.dueDate && invoice.dueDate < currentDate) {
            const lastReminder = reminderSentDates
              ?.sort((a, b) => {
                if (a < b) return -1
                if (a > b) return 1
                return 0
              })
              .at(-1)
            if (lastReminder) {
              const lastReminderExpirationDate = addDays(lastReminder, 7)
                .toISOString()
                .slice(0, 10)
              if (lastReminderExpirationDate > currentDate) {
                throw new Error(
                  'Please wait until the last reminder has expired.'
                )
              }
            }
            if (reminderSentDates && reminderSentDates.length > 1) {
              throw new Error(
                'Please sent an exhortation instead of a reminder'
              )
            }

            const { subject, body } = composeEmail({
              invoice: invoice,
              emailSubject,
              emailBody
            })

            const pdfResult = await downloadPdf(invoice)
            const attachments = []
            if (pdfResult.success)
              attachments.push({
                filename: pdfResult.filename,
                content: pdfResult.pdf
              })

            await fastify.mailer?.sendMail({
              from: `${invoice.companyDetails.name} <noreply@slimfact.app>`,
              replyTo: invoice.companyDetails.email,
              to: invoice.clientDetails.email,
              subject,
              html: body,
              attachments
            })

            await fastify.checkout.invoiceHandler.addReminderSent({
              id: invoice.id,
              date: new Date().toISOString().slice(0, 10)
            })
            return true
          }
          console.error('Invoice is not due yet.')
          return false
        }
      } catch (e) {
        if (import.meta.env.DEBUG) fastify.log.debug(e)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: e as string
        })
      }
    }),
  exhortInvoice: procedure
    .input(
      z.object({
        id: z.number(),
        emailSubject: z.string(),
        emailBody: z.string()
      })
    )
    .mutation(async ({ input }) => {
      try {
        if (fastify.checkout?.invoiceHandler) {
          const { id, emailSubject, emailBody } = input
          const invoice = await fastify.checkout.invoiceHandler.getInvoice({
            id
          })
          const reminderSentDates = invoice?.reminderSentDates
          const currentDate = new Date().toISOString().slice(0, 10)
          if (invoice?.dueDate && invoice.dueDate < currentDate) {
            const lastReminder = reminderSentDates
              ?.sort((a, b) => {
                if (a < b) return -1
                if (a > b) return 1
                return 0
              })
              .at(-1)
            if (lastReminder) {
              const lastReminderExpirationDate = addDays(lastReminder, 7)
                .toISOString()
                .slice(0, 10)
              if (lastReminderExpirationDate > currentDate) {
                throw new Error(
                  'Please wait until the last reminder has expired.'
                )
              }
            }
            if (reminderSentDates && reminderSentDates.length < 2) {
              throw new Error('Please sent a reminder first')
            }
            const { subject, body } = composeEmail({
              invoice: invoice,
              emailSubject,
              emailBody
            })

            const pdfResult = await downloadPdf(invoice)
            const attachments = []
            if (pdfResult.success)
              attachments.push({
                filename: pdfResult.filename,
                content: pdfResult.pdf
              })

            await fastify.mailer?.sendMail({
              from: `${invoice.companyDetails.name} <noreply@slimfact.app>`,
              replyTo: invoice.companyDetails.email,
              to: invoice.clientDetails.email,
              subject,
              html: body,
              attachments
            })

            await fastify.checkout.invoiceHandler.addReminderSent({
              id: invoice.id,
              date: new Date().toISOString().slice(0, 10)
            })

            return true
          }
          return false
        }
      } catch (e) {
        if (import.meta.env.DEBUG) fastify.log.debug(e)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: e as string
        })
      }
    }),
  sendBill: procedure
    .input(
      z.object({
        id: z.number(),
        emailSubject: z.string(),
        emailBody: z.string()
      })
    )
    .mutation(async ({ input }) => {
      try {
        if (fastify.checkout?.invoiceHandler) {
          const { id, emailSubject, emailBody } = input
          const invoice = await fastify.checkout.invoiceHandler.getInvoice({
            id
          })
          if (invoice) {
            const { subject, body } = composeEmail({
              invoice,
              emailSubject,
              emailBody
            })

            const pdfResult = await downloadPdf(invoice)
            const attachments = []
            if (pdfResult.success)
              attachments.push({
                filename: pdfResult.filename,
                content: pdfResult.pdf
              })
            await fastify.mailer?.sendMail({
              from: `${invoice.companyDetails.name} <noreply@slimfact.app>`,
              replyTo: invoice.companyDetails.email,
              to: invoice.clientDetails.email,
              subject,
              html: body,
              attachments
            })
            return true
          }
        }
      } catch (e) {
        if (import.meta.env.DEBUG) fastify.log.debug(e)
        throw new TRPCError({
          code: 'BAD_REQUEST'
        })
      }
    }),
  sendReceipt: procedure
    .input(
      z.object({
        id: z.number(),
        emailSubject: z.string(),
        emailBody: z.string()
      })
    )
    .mutation(async ({ input }) => {
      try {
        if (fastify.checkout?.invoiceHandler) {
          const { id, emailSubject, emailBody } = input
          fastify.checkout.invoiceHandler.setInvoiceStatus({
            id,
            status: InvoiceStatus.RECEIPT
          })
          const invoice = await fastify.checkout.invoiceHandler.getInvoice({
            id
          })
          if (invoice) {
            const { subject, body } = composeEmail({
              invoice,
              emailSubject,
              emailBody
            })

            const pdfResult = await downloadPdf(invoice)
            const attachments = []
            if (pdfResult.success)
              attachments.push({
                filename: pdfResult.filename,
                content: pdfResult.pdf
              })
            await fastify.mailer?.sendMail({
              from: `${invoice.companyDetails.name} <noreply@slimfact.app>`,
              replyTo: invoice.companyDetails.email,
              to: invoice.clientDetails.email,
              subject,
              html: body,
              attachments
            })
            return true
          }
        }
      } catch (e) {
        if (import.meta.env.DEBUG) fastify.log.debug(e)
        throw new TRPCError({
          code: 'BAD_REQUEST'
        })
      }
    }),
  getInvoiceEmail: procedure
    .input(
      z.object({
        id: z.number(),
        type: z.union([
          z.literal('sendInvoice'),
          z.literal('remindInvoice'),
          z.literal('exhortInvoice'),
          z.literal('sendBill'),
          z.literal('sendReceipt')
        ])
      })
    )
    .query(async ({ input }) => {
      if (fastify.checkout?.invoiceHandler) {
        const { id, type } = input
        const invoice = await fastify.checkout.invoiceHandler.getInvoice({
          id,
          options: {
            withAmountPaid: true,
            withAmountDue: true
          }
        })
        if (invoice) {
          const { body: bodyTemplate, subject: subjectTemplate } = await db
            .selectFrom('emailTemplates')
            .select(['body', 'subject'])
            .where('name', '=', `${type}`)
            .where('locale', '=', invoice.locale)
            .executeTakeFirstOrThrow()

          const subject = handlebars.compile(subjectTemplate)({
            companyDetails: invoice.companyDetails,
            clientDetails: invoice.clientDetails,
            paymentTermDays: invoice.paymentTermDays,
            dueDate: formatDateShort({
              dateString: invoice.dueDate!,
              locale: invoice.locale
            }),
            totalIncludingTax: formatPrice({
              currency: invoice.currency,
              value: invoice.totalIncludingTax,
              locale: invoice.locale
            })
          })
          const body = handlebars.compile(bodyTemplate)({
            companyDetails: invoice.companyDetails,
            clientDetails: invoice.clientDetails,
            numberPrefix: invoice.numberPrefix,
            number: invoice.number,
            paymentTermDays: invoice.paymentTermDays,
            dueDate: formatDateShort({
              dateString: invoice.dueDate!,
              locale: invoice.locale
            }),
            totalIncludingTax: formatPrice({
              currency: invoice.currency,
              value: invoice.totalIncludingTax,
              locale: invoice.locale
            }),
            paid: invoice.amountPaid
              ? invoice.amountPaid >= invoice.totalIncludingTax
              : false,
            amountDue: formatPrice({
              currency: invoice.currency,
              value: invoice.amountDue || invoice.totalIncludingTax,
              locale: invoice.locale
            })
          })
          return { subject, body }
        }
      }
      throw new TRPCError({
        code: 'BAD_REQUEST'
      })
    }),
  cancelInvoice: procedure
    .input(
      z.object({
        id: z.number()
      })
    )
    .mutation(async ({ input }) => {
      if (fastify.checkout?.invoiceHandler) {
        const { id } = input
        const result = await fastify.checkout.invoiceHandler.cancelInvoice({
          id
        })

        if (result.success) return true

        throw new TRPCError({
          code: 'BAD_REQUEST'
        })
      }
    }),
  addPaymentToInvoice: procedure
    .input(
      z.object({
        id: z.number(),
        payment: z.object({
          description: z.string().optional(),
          amount: z.number(),
          currency: z.union([z.literal('EUR'), z.literal('USD')]),
          method: z.nativeEnum(PaymentMethod)
        })
      })
    )
    .mutation(async ({ input }) => {
      const { id, payment } = input
      if (fastify.checkout?.invoiceHandler) {
        const invoice = await fastify.checkout.invoiceHandler.getInvoice({
          id
        })
        if (invoice) {
          const webhookUrl =
            env.read('VITE_MOLLIE_WEBHOOK_URL') ||
            env.read('MOLLIE_WEBHOOK_URL')
          const result =
            await fastify.checkout.invoiceHandler.addPaymentToInvoice({
              id,
              payment: {
                amount: payment.amount,
                currency: payment.currency,
                description: payment.description || `${invoice.uuid}`,
                method: payment.method,
                redirectUrl: `https://${hostname}/checkout/success`,
                webhookUrl
              }
            })

          if (result.success) {
            return {
              checkoutUrl: result.checkoutUrl,
              payment: result.payment
            }
          } else {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: result.errorMessage
            })
          }
        }
      }
      throw new TRPCError({
        code: 'BAD_REQUEST'
      })
    }),
  setInvoiceStatus: procedure
    .input(
      z.object({
        id: z.number(),
        status: z.nativeEnum(InvoiceStatus)
      })
    )
    .mutation(async ({ input }) => {
      const { id, status } = input
      if (fastify.checkout?.invoiceHandler) {
        fastify.checkout.invoiceHandler.setInvoiceStatus({
          id,
          status
        })
      }
    }),
  refundInvoice: procedure
    .input(
      z.object({
        id: z.number()
      })
    )
    .mutation(async ({ input }) => {
      const { id } = input

      if (fastify.checkout?.invoiceHandler) {
        const result = await fastify.checkout.invoiceHandler.refundInvoice({
          id
        })

        if (result.success) {
          return result.refund
        } else {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: result.errorMessage
          })
        }
      }
      throw new TRPCError({
        code: 'BAD_REQUEST'
      })
    })
})
