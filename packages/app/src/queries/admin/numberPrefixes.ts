import { defineQuery, useMutation, useQuery } from '@pinia/colada'
import { ref } from 'vue'
import { trpc } from '../../trpc.js'
import { NumberPrefix } from '@slimfact/api/zod'

export const useAdminGetNumberPrefixesQuery = defineQuery(() => {
  // Lazy: the number-prefix select has no filter event, so the document form
  // calls `activate()` when it opens. Until then the query stays off the page
  // mount batch.
  const active = ref(false)

  const { data: numberPrefixes, ...rest } = useQuery({
    enabled: () => !import.meta.env.SSR && active.value,
    key: () => ['adminGetNumberPrefixes'],
    query: () => trpc.admin.getNumberPrefixes.query()
  })

  const activate = () => {
    active.value = true
    return rest.refetch()
  }

  return {
    numberPrefixes,
    activate,
    ...rest
  }
})

export const useAdminCreateNumberPrefixMutation = () => {
  const { ...rest } = useMutation({
    mutation: (numberPrefix: NumberPrefix) =>
      trpc.admin.createNumberPrefix.mutate(numberPrefix)
  })
  return {
    ...rest
  }
}

export const useAdminUpdateNumberPrefixMutation = () => {
  const { ...rest } = useMutation({
    mutation: (numberPrefix: NumberPrefix) =>
      trpc.admin.updateNumberPrefix.mutate(numberPrefix)
  })
  return {
    ...rest
  }
}

export const useAdminGetInitialNumberForPrefixesQuery = defineQuery(() => {
  const { data: initialNumbers, ...rest } = useQuery({
    enabled: !import.meta.env.SSR,
    key: () => ['adminGetInitialNumberForPrefixes'],
    query: () => trpc.admin.getInitialNumberForPrefixes.query()
  })
  return {
    initialNumbers,
    ...rest
  }
})

export const useAdminCreateInitialNumberForPrefixMutation = () => {
  const { ...rest } = useMutation({
    mutation: ({
      companyId,
      numberPrefix,
      initialNumber
    }: {
      companyId: number
      numberPrefix: string
      initialNumber: number
    }) =>
      trpc.admin.createInitialNumberForPrefix.mutate({
        companyId,
        numberPrefix,
        initialNumber
      })
  })
  return {
    ...rest
  }
}

export const useAdminUpdateInitialNumberForPrefixMutation = () => {
  const { ...rest } = useMutation({
    mutation: ({
      id,
      companyId,
      numberPrefix,
      initialNumber
    }: {
      id: number
      companyId: number
      numberPrefix: string
      initialNumber: number
    }) =>
      trpc.admin.updateInitialNumberForPrefix.mutate({
        id,
        companyId,
        numberPrefix,
        initialNumber
      })
  })
  return {
    ...rest
  }
}
