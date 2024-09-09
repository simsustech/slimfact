export const billEmailTemplates = import.meta.glob<{
  subject: string
  body: string
}>('./**/*.ts')
