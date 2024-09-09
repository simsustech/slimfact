export const invoiceEmailTemplates = import.meta.glob<{
  subject: string
  body: string
}>('./**/*.ts')
