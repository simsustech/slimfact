import { defineQuery, useMutation, useQuery } from '@pinia/colada'
import { trpc } from '../../trpc.js'
import { ref } from 'vue'
import { Company } from '@slimfact/api/zod'

export const useAdminGetCompaniesQuery = defineQuery(() => {
  const { data: companies, ...rest } = useQuery({
    enabled: !import.meta.env.SSR,
    key: () => ['adminGetCompanies'],
    query: () => trpc.admin.getCompanies.query()
  })
  return {
    companies,

    ...rest
  }
})

export const useAdminSearchCompaniesQuery = defineQuery(() => {
  const searchPhrase = ref('')

  const { data: companies, ...rest } = useQuery({
    enabled: () => !import.meta.env.SSR && !!searchPhrase.value,
    key: () => ['adminSearchCompanies', searchPhrase.value],
    query: () => trpc.admin.searchCompanies.query(searchPhrase.value),
    placeholderData: () => []
  })

  return {
    companies,
    searchPhrase,
    ...rest
  }
})

export const useAdminCreateCompanyMutation = () => {
  const { ...rest } = useMutation({
    mutation: (company: Company) => trpc.admin.createCompany.mutate(company)
  })
  return {
    ...rest
  }
}

export const useAdminUpdateCompanyMutation = () => {
  const { ...rest } = useMutation({
    mutation: (company: Company) => trpc.admin.updateCompany.mutate(company)
  })
  return {
    ...rest
  }
}
