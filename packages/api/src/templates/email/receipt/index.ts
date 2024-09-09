export const receiptEmailTemplates = import.meta.glob<{
  subject: string
  body: string
}>('./**/*.ts')
