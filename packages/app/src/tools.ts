// import { type Invoice } from '@modular-api/fastify-checkout'

export const computeNumberPrefix = (invoice) => {
  if (invoice.numberPrefixTemplate) {
    const currentDate = new Date()

    const template = {
      YYYY: currentDate.getFullYear(),
      MM: currentDate.getMonth() + 1,
      clientDetails: {
        number: invoice.clientDetails?.number
      },
      companyDetails: {
        prefix: invoice.companyPrefix
      },
      projectId: invoice.projectId
    }
    return (
      invoice.numberPrefixTemplate
        .replace('{{YYYY}}', template.YYYY.toString())
        .replace('{{MM}}', template.MM.toString())
        .replace(
          '{{clientDetails.number}}',
          template.clientDetails.number
            ? template.clientDetails.number.toString()
            : ''
        )
        .replace(
          '{{companyDetails.prefix}}',
          template.companyDetails.prefix.toString()
        )
        .replace(
          '{{projectId}}',
          template.projectId ? template.projectId.toString() : ''
        ) + '#'
    )
  }
}
