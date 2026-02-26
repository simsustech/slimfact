<template>
  <md3-layout :ready="ready">
    <template #header-toolbar>
      <q-toolbar-title> {{ title }} </q-toolbar-title>

      <user-menu-button
        v-if="user"
        color="accent"
        :user-route="userRoute"
        :icons="{ person: 'i-mdi-person' }"
        @sign-out="logout"
      />
      <login-button v-else color="accent" @click="login" />
      <q-btn icon="i-mdi-more-vert" flat>
        <q-menu>
          <q-list>
            <q-item v-if="configuration.SUPPORT_EMAIL">
              <q-item-section avatar>
                <q-icon name="i-mdi-email" />
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  {{ configuration.SUPPORT_EMAIL }}
                </q-item-label>
              </q-item-section>
            </q-item>

            <q-language-select
              v-model="locale"
              :language-imports="languageImports"
              :locales="languageLocales"
              is-item
            />
            <q-item>
              <q-item-section label>
                {{ lang.darkMode }}
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  :model-value="$q.dark.isActive"
                  checked-icon="i-mdi-moon-and-stars"
                  unchecked-icon="i-mdi-brightness-7"
                  size="2em"
                  @update:model-value="$q.dark.set"
                />
              </q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </template>

    <template #drawer-mini-navigation>
      <div class="col">
        <navigation-tabs vertical dense />
      </div>
    </template>

    <template #drawer>
      <q-scroll-area class="fit">
        <div class="q-px-md">
          <div class="text-overline">{{ title }}</div>
          <q-list>
            <q-expansion-item
              v-if="user"
              ref="accountExpansionItemRef"
              :header-class="
                route.path.includes('/account/') ? 'text-primary' : undefined
              "
              :content-inset-level="1"
            >
              <template #header>
                <q-item-section avatar>
                  <q-icon name="i-mdi-person" />
                </q-item-section>
                <q-item-section>
                  <q-item-section>
                    <q-item-label> Account </q-item-label>
                  </q-item-section>
                </q-item-section>
              </template>
              <q-expansion-item to="/account/bills">
                <template #header>
                  <q-item-section avatar>
                    <q-icon name="i-mdi-receipt-outline" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label> {{ lang.bill.title }} </q-item-label>
                  </q-item-section>
                </template>
                <q-item to="/account/receipts">
                  <q-item-section avatar>
                    <q-icon name="i-mdi-receipt" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label> {{ lang.receipt.title }} </q-item-label>
                  </q-item-section>
                </q-item>
              </q-expansion-item>
              <q-item to="/account/invoices">
                <q-item-section avatar>
                  <q-icon name="i-mdi-invoice" />
                </q-item-section>
                <q-item-section>
                  <q-item-label> {{ lang.invoice.title }} </q-item-label>
                </q-item-section>
              </q-item>
            </q-expansion-item>
            <q-expansion-item
              v-if="user?.roles?.includes('administrator')"
              default-opened
              :content-inset-level="1"
            >
              <template #header>
                <q-item-section avatar>
                  <q-icon name="i-mdi-account-cog" />
                </q-item-section>
                <q-item-section>
                  <q-item-label> {{ lang.administrator }} </q-item-label>
                </q-item-section>
              </template>
              <q-item to="/admin/clients">
                <q-item-section avatar>
                  <q-icon name="i-mdi-person" />
                </q-item-section>
                <q-item-section>
                  <q-item-label> {{ lang.client.title }} </q-item-label>
                </q-item-section>
              </q-item>
              <q-expansion-item to="/admin/bills" :content-inset-level="1">
                <template #header>
                  <q-item-section avatar>
                    <q-icon name="i-mdi-receipt-outline" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label> {{ lang.bill.title }} </q-item-label>
                  </q-item-section>
                </template>
                <q-item to="/admin/receipts">
                  <q-item-section avatar>
                    <q-icon name="i-mdi-receipt" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label> {{ lang.receipt.title }} </q-item-label>
                  </q-item-section>
                </q-item>
              </q-expansion-item>
              <q-item to="/admin/invoices">
                <q-item-section avatar>
                  <q-icon name="i-mdi-invoice" />
                </q-item-section>
                <q-item-section>
                  <q-item-label> {{ lang.invoice.title }} </q-item-label>
                </q-item-section>
              </q-item>
              <q-item to="/admin/subscriptions">
                <q-item-section avatar>
                  <q-icon name="i-mdi-subscriptions" />
                </q-item-section>
                <q-item-section>
                  <q-item-label> {{ lang.subscription.title }} </q-item-label>
                </q-item-section>
              </q-item>
              <q-expansion-item
                ref="settingsExpansionItemRef"
                :label="lang.administrator"
                :header-class="
                  route.path.includes('/settings/') ? 'text-primary' : undefined
                "
                :content-inset-level="1"
              >
                <template #header>
                  <q-item-section avatar>
                    <q-icon name="i-mdi-account-settings" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label> {{ lang.settings.title }} </q-item-label>
                  </q-item-section>
                  <q-item-section side> </q-item-section>
                </template>
                <q-item to="/admin/companies">
                  <!-- <q-item-section avatar>
                    <q-icon name="store" />
                  </q-item-section> -->
                  <q-item-section>
                    <q-item-label> {{ lang.company.title }} </q-item-label>
                  </q-item-section>
                </q-item>
                <q-expansion-item
                  to="/admin/settings/numberprefixes"
                  :content-inset-level="1"
                >
                  <template #header>
                    <q-item-section>
                      <q-item-label>
                        {{ lang.numberPrefix.title }}
                      </q-item-label>
                    </q-item-section>
                  </template>
                  <q-item to="/admin/settings/initialnumberforprefixes">
                    <q-item-section>
                      <q-item-label>{{
                        lang.initialNumberForPrefix.title
                      }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-expansion-item>
                <q-item to="/admin/settings/accounts">
                  <q-item-section>
                    <q-item-label> {{ lang.account.accounts }} </q-item-label>
                  </q-item-section>
                </q-item>
                <q-item to="/admin/settings/exports">
                  <q-item-section>
                    <q-item-label> {{ lang.exports.title }} </q-item-label>
                  </q-item-section>
                </q-item>
              </q-expansion-item>
            </q-expansion-item>

            <q-item to="/" exact>
              <q-item-section avatar>
                <q-icon color="primary" name="i-mdi-home" />
              </q-item-section>

              <q-item-section>
                <q-item-label> Home </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </q-scroll-area>
      <q-list
        v-if="!configuration.HIDE_BRANDING"
        class="items-end justify-end self-end"
      >
        <q-item>
          <q-item-section avatar>
            <slimfact-icon size="lg" />
          </q-item-section>
          <q-item-section>
            <q-item-label> SlimFact </q-item-label>
            <q-item-label caption> © simsustech </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </template>

    <template #footer>
      <div class="column fit items-center justify-center">
        <navigation-tabs dense class="col-12 lt-md" />
      </div>
    </template>

    <template #fabs="{ showSticky }">
      <router-view name="fabs" :show-sticky="showSticky" />
    </template>
  </md3-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useQuasar } from 'quasar'
import {
  LoginButton,
  UserMenuButton
} from '@simsustech/quasar-components/authentication'
import { QLanguageSelect } from '@simsustech/quasar-components'
import { Md3Layout } from '@simsustech/quasar-components/md3'
import { loadLang as loadGeneralLang } from '@simsustech/quasar-components'
import {
  loadLang as loadFormLang,
  type Locales
} from '@simsustech/quasar-components/form'
import { loadLang as loadCheckoutLang } from '@modular-api/quasar-components/checkout'
import { useOAuthClient, userRouteKey, user, oAuthClient } from '../oauth.js'
import { useRoute, useRouter } from 'vue-router'
import { useLang, loadLang } from '../lang/index.js'
import { useConfiguration, loadConfiguration } from '../configuration'
import SlimfactIcon from '../components/SlimFactIcon.vue'
import NavigationTabs from './NavigationTabs.vue'
import { initializeTRPCClient } from 'src/trpc.js'
import { languageLocales, languageImports } from '../configuration.js'

const $q = useQuasar()

const quasarLanguageMap: Partial<Record<Locales, string>> = {
  'en-US': 'en-US',
  'nl-NL': 'nl'
}
const locale = ref<Locales>('en-US')

watch(locale, (newVal) => {
  const quasarLang = quasarLanguageMap[newVal]
  if (quasarLang) {
    loadLang(quasarLang)
    loadFormLang(quasarLang)
    loadCheckoutLang(quasarLang)
    loadGeneralLang(quasarLang)

    // @ts-expect-error string
    languageImports.value[quasarLang]().then((lang) => {
      $q.lang.set(lang.default)
    })
  }
})

await loadConfiguration(locale)
const configuration = useConfiguration()
await initializeTRPCClient(configuration.value.API_HOST)

const router = useRouter()
const route = useRoute()
const lang = useLang()

const login = () => {
  if (oAuthClient.value) oAuthClient.value.signIn({})
}

const logout = () => {
  if (oAuthClient.value) oAuthClient.value.signOut({})
}

const userRoute = {
  name: userRouteKey
}

const title = computed(() => {
  let title = configuration.value.TITLE
  // @ts-expect-error key might not exist
  if (lang.value[route.meta?.lang]) title = lang.value[route.meta.lang].title
  return title
})

const accountExpansionItemRef = ref()
const settingsExpansionItemRef = ref()
// const adminExpansionItemRef = ref()

const authenticatedRoutes = ['/account', '/employee', '/admin']
const isAuthenticatedRoute = (route: string) => {
  return authenticatedRoutes.some((authenticatedRoute) =>
    route.includes(authenticatedRoute)
  )
}

const ready = ref(false)

onMounted(async () => {
  if (__IS_PWA__) {
    await import('../pwa.js')
  }
  await useOAuthClient()
  await oAuthClient.value?.getUserInfo()

  if (oAuthClient.value?.getAccessToken()) {
    user.value = await oAuthClient.value?.getUser()
    if (!user.value && isAuthenticatedRoute(route.path))
      router.push({ path: '/' })
  } else if (isAuthenticatedRoute(route.path)) {
    router.push({ path: '/' })
  }

  ready.value = true
})
</script>
