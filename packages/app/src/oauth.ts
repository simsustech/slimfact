import type { OauthClient, User } from 'lionel-oauth-client'
import { ref } from 'vue'
import type { InjectionKey, Ref } from 'vue'

export const oAuthClientKey = Symbol('oAuthClient') as InjectionKey<
  Ref<OauthClient>
>
export const useOAuthClientKey = Symbol('useOAuthClient') as InjectionKey<
  () => Promise<OauthClient>
>
export const useAuthorizedFetchKey = Symbol('authorizedFetch') as InjectionKey<
  () => typeof fetch
>
export const userKey = Symbol('useUser') as InjectionKey<Ref<User | null>>
export const redirectRouteKey = 'oidc_redirect'
export const userRouteKey = 'oidc_user'

export const oAuthClient = ref<OauthClient>()
export const user = ref<User | null | undefined>()
export const createOauthClient = async () => {
  let oAuthClient: OauthClient
  if (!import.meta.env.SSR) {
    const { createOauthClient } = await import('lionel-oauth-client')

    oAuthClient = createOauthClient({
      issuer:
        import.meta.env.VITE_OIDC_ISSUER || `${window.location.origin}/oidc`,
      clientId: import.meta.env.VITE_OIDC_CLIENT_ID || 'slimfact',
      redirectUri:
        import.meta.env.VITE_OIDC_REDIRECT_URI ||
        `${window.location.origin}/redirect`,
      scopes: ['openid', 'profile', 'email', 'api'],
      tokenStorage: import.meta.env.DEV ? 'session' : 'local',
      debug: import.meta.env.DEV
    })
    return oAuthClient
  }
  return
}

export const useOAuthClient = async () => {
  if (!oAuthClient.value) {
    const client = await createOauthClient()
    if (client) oAuthClient.value = client
  }

  return oAuthClient
}

export const useUser = async () => {
  if (!user.value && oAuthClient.value) {
    try {
      const accessToken = oAuthClient.value.getAccessToken()
      if (accessToken) {
        await oAuthClient.value.getUserInfo()
        user.value = await oAuthClient.value.getUser()
      }
    } catch (error) {
      console.error(error)
    }
  }
  return user
}
