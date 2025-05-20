<template>
  <q-layout view="lHh Lpr lFf">
    <div v-show="ready">
      <q-header elevated>
        <q-toolbar>
          <q-btn flat dense round aria-label="Menu" @click="toggleLeftDrawer">
            <q-icon name="i-mdi-menu" />
          </q-btn>

          <q-toolbar-title> {{ title }} </q-toolbar-title>

          <user-menu-button
            v-if="user"
            color="accent"
            :icons="{
              person: 'i-mdi-person'
            }"
            :user-route="userRoute"
            @sign-out="logout"
          />
          <login-button v-else color="accent" @click="login" />
          <q-btn icon="i-mdi-more-vert" flat>
            <q-menu>
              <q-list>
                <q-language-select
                  v-model="language"
                  :language-imports="languageImports"
                  :locales="languageLocales"
                  borderless
                />
                <!-- <q-item clickable href="/privacypolicy.pdf" target="_blank">
                  <q-item-section>
                    <q-item-label>
                      {{ lang.privacyPolicy }}
                    </q-item-label>
                  </q-item-section>
                </q-item> -->
              </q-list>
            </q-menu>
          </q-btn>
        </q-toolbar>
      </q-header>

      <q-drawer v-model="leftDrawerOpen" show-if-above bordered>
        <q-scroll-area
          style="height: calc(100% - 60px); border-right: 1px solid #ddd"
        >
          <q-drawer-list>
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
          </q-drawer-list>
        </q-scroll-area>
        <q-space />
        <q-list v-if="!configuration.HIDE_BRANDING">
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
      </q-drawer>

      <q-page-container>
        <router-view />
      </q-page-container>
    </div>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useQuasar } from 'quasar'
import {
  LoginButton,
  UserMenuButton
} from '@simsustech/quasar-components/authentication'
import { QLanguageSelect, QDrawerList } from '@simsustech/quasar-components'
import { loadLang as loadFormLang } from '@simsustech/quasar-components/form'
import { loadLang as loadCheckoutLang } from '@modular-api/quasar-components/checkout'
import { useOAuthClient, userRouteKey, user, oAuthClient } from '../oauth.js'
import { useRoute, useRouter } from 'vue-router'
import { useLang, loadLang } from '../lang/index.js'
import { useConfiguration, loadConfiguration } from '../configuration'
import SlimfactIcon from '../components/SlimFactIcon.vue'

const configuration = useConfiguration()

const router = useRouter()
const route = useRoute()
const lang = useLang()

const $q = useQuasar()
const leftDrawerOpen = ref(false)

const toggleLeftDrawer = () => {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

const login = () => {
  if (oAuthClient.value) oAuthClient.value.signIn({})
}

const logout = () => {
  if (oAuthClient.value) oAuthClient.value.signOut({})
}

const userRoute = {
  name: userRouteKey
}

const title = computed(() => configuration.value.TITLE)

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

watch(route, (val) => {
  if (val.path.includes('account')) accountExpansionItemRef.value.show()
  if (val.path.includes('settings')) settingsExpansionItemRef.value.show()
  // if (val.path.includes('admin')) adminExpansionItemRef.value.show()
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
