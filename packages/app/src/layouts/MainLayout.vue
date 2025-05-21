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
            <q-item clickable href="/privacypolicy.pdf" target="_blank">
              <q-item-section avatar>
                <q-icon name="i-mdi-document" />
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  {{ lang.privacyPolicy }}
                </q-item-label>
              </q-item-section>
            </q-item>

            <q-item
              :href="`https://www.petboarding.app/documentation/users?lang=${$q.lang.isoName}`"
              target="_blank"
            >
              <q-item-section avatar>
                <q-icon name="i-mdi-link" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ lang.documentation }}</q-item-label>
              </q-item-section>
            </q-item>
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
              v-model="language"
              :language-imports="languageImports"
              :locales="languageLocales"
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
              <q-expansion-item to="/admin/bills">
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
              >
                <template #header>
                  <q-item-section avatar>
                    <q-icon name="i-mdi-account-settings" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label> {{ lang.settings }} </q-item-label>
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
                <q-expansion-item to="/settings/numberprefixes">
                  <template #header>
                    <q-item-section>
                      <q-item-label>
                        {{ lang.numberPrefix.title }}
                      </q-item-label>
                    </q-item-section>
                  </template>
                  <q-item to="/settings/initialnumberforprefixes">
                    <q-item-section>
                      <q-item-label>{{
                        lang.initialNumberForPrefix.title
                      }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-expansion-item>
                <q-item to="/settings/accounts">
                  <q-item-section>
                    <q-item-label> Accounts </q-item-label>
                  </q-item-section>
                </q-item>
                <q-item to="/admin/exports">
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
import { loadLang as loadFormLang } from '@simsustech/quasar-components/form'
import { loadLang as loadCheckoutLang } from '@modular-api/quasar-components/checkout'
import { useOAuthClient, userRouteKey, user, oAuthClient } from '../oauth.js'
import { useRoute, useRouter } from 'vue-router'
import { useLang, loadLang } from '../lang/index.js'
import { useConfiguration, loadConfiguration } from '../configuration'
import SlimfactIcon from '../components/SlimFactIcon.vue'
import NavigationTabs from './NavigationTabs.vue'

const configuration = useConfiguration()

const router = useRouter()
const route = useRoute()
const lang = useLang()

const $q = useQuasar()

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

const language = ref($q.lang.isoName)

const languageLocales = ref([
  {
    icon: 'i-flagpack-nl',
    isoName: 'nl'
  },
  {
    icon: 'i-flagpack-us',
    isoName: 'en-US'
  }
])

// prettier-ignore
const languageImports = ref({
  nl: () => import(`../../node_modules/quasar/lang/nl.js`),
  'en-US': () => import(`../../node_modules/quasar/lang/en-US.js`)
})

if (lang.value.isoName !== $q.lang.isoName) loadLang($q.lang.isoName)
watch($q.lang, () => {
  loadLang($q.lang.isoName)
  loadFormLang($q.lang.isoName)
  loadCheckoutLang($q.lang.isoName)
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
  await loadConfiguration(language)
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
