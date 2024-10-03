import { computed, reactive } from 'vue'
import { useTRPC } from 'use-trpc'
import { httpLink, getFetch } from '@trpc/client'
import { useOAuthClient } from './oauth.js'
import { Notify } from 'quasar'
import { useLang } from './lang/index.js'

import type { AppRouter } from '@slimfact/api/trpc'

export const createUseTrpc = async () => {
  const oAuthClient = await useOAuthClient()

  const headers = reactive({
    Authorization: computed(() => {
      if (oAuthClient.value) {
        oAuthClient.value.getUser()
        return `Bearer ${oAuthClient.value.getAccessToken()}`
      }
      return ''
    })
  })

  const lang = useLang()
  const fetch = getFetch()
  const handleErrorFetch = async (input, init) => {
    return fetch(input, init).then(async (res) => {
      try {
        if (!res.ok) {
          const body = await res.clone().json()

          const serverErrors = body?.error || body?.[0]?.error
          let caption: string
          const { message, code, path, expected, received } = serverErrors
          if (message) {
            caption = message
          } else if (path && lang.value.errors?.[code]) {
            caption = lang.value.errors[code]({ path, expected, received })
          } else if (path) {
            caption = `${message}: ${path.join(':')}`
          } else {
            caption = ''
          }
          Notify.create({
            message: lang.value.serverError,
            caption,
            type: 'negative'
          })
        }
        return res
      } catch (e) {
        console.error(e)
        return res
      }
    })
  }

  return useTRPC<AppRouter>({
    client: {
      links: [
        httpLink({
          url: import.meta.env.VITE_API_HOSTNAME
            ? `https://${import.meta.env.VITE_API_HOSTNAME}/trpc`
            : '/trpc',
          headers,
          fetch: handleErrorFetch
        })
      ]
    },
    headers
  })
}
