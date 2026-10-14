export const computeNumberPrefix = ({
  numberPrefixTemplate,
  companyDetails,
  clientDetails,
  projectId
}: {
  numberPrefixTemplate: string
  companyDetails: {
    prefix: string
  }
  clientDetails?: {
    number?: string | number | null
  }
  projectId?: string | null
}) => {
  if (numberPrefixTemplate) {
    const currentDate = new Date()

    const template = {
      YYYY: currentDate.getFullYear(),
      MM: currentDate.getMonth() + 1,
      clientDetails: {
        number: clientDetails?.number
      },
      companyDetails: {
        prefix: companyDetails?.prefix
      },
      projectId: projectId
    }
    return (
      numberPrefixTemplate
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
