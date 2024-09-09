export const emailTemplates = import.meta.glob<{
  subject: string
  body: string
}>('./**/*.ts')
