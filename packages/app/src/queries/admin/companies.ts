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
  // Lazy: the query stays off (and out of the page-mount batch) until a
  // company select asks for data via `activate()` — called from the document
  // dialog when it opens and from the select's filter handler.
  const active = ref(false)

  const { data: companies, ...rest } = useQuery({
    enabled: () => !import.meta.env.SSR && active.value,
    key: () => ['adminSearchCompanies', searchPhrase.value],
    query: () => trpc.admin.searchCompanies.query(searchPhrase.value),
    placeholderData: () => []
  })

  const activate = () => {
    active.value = true
    return rest.refetch()
  }

  return {
    companies,
    searchPhrase,
    activate,
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
