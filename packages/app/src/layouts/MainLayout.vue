<template>
  <q-layout view="lHh Lpr lFf">
    <div v-show="ready">
      <q-header elevated>
        <q-toolbar>
          <q-btn flat dense round aria-label="Menu" @click="toggleLeftDrawer">
            <q-icon :name="matMenu" />
          </q-btn>

          <q-toolbar-title> {{ title }} </q-toolbar-title>
          <q-language-select
            v-model="language"
            :language-imports="languageImports"
          />

          <user-menu-button
            v-if="user"
            color="accent"
            :user-route="userRoute"
            @sign-out="logout"
          />
          <login-button v-else color="accent" @click="login" />
          <q-btn icon="more_vert" flat>
            <q-menu>
              <q-list>
                <q-item clickable href="/privacypolicy.pdf" target="_blank">
                  <q-item-section>
                    <q-item-label>
                      {{ lang.privacyPolicy }}
                    </q-item-label>
                  </q-item-section>
                </q-item>
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
                  <q-icon name="person" />
                </q-item-section>
                <q-item-section>
                  <q-item-section>
                    <q-item-label> Account </q-item-label>
                  </q-item-section>
                </q-item-section>
              </template>
              <q-item to="/account/bills">
                <q-item-section avatar>
                  <q-icon name="request_quote" />
                </q-item-section>
                <q-item-section>
                  <q-item-label> {{ lang.bill.title }} </q-item-label>
                </q-item-section>
              </q-item>
              <q-item to="/account/receipts">
                <q-item-section avatar>
                  <q-icon name="receipt" />
                </q-item-section>
                <q-item-section>
                  <q-item-label> {{ lang.receipt.title }} </q-item-label>
                </q-item-section>
              </q-item>
              <q-item to="/account/invoices">
                <q-item-section avatar>
                  <q-icon name="receipt_long" />
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
                  <q-icon name="admin_panel_settings" />
                </q-item-section>
                <q-item-section>
                  <q-item-label> {{ lang.administrator }} </q-item-label>
                </q-item-section>
              </template>
              <q-item to="/admin/companies">
                <q-item-section avatar>
                  <q-icon name="store" />
                </q-item-section>
                <q-item-section>
                  <q-item-label> {{ lang.company.title }} </q-item-label>
                </q-item-section>
              </q-item>
              <q-item to="/admin/clients">
                <q-item-section avatar>
                  <q-icon name="people" />
                </q-item-section>
                <q-item-section>
                  <q-item-label> {{ lang.client.title }} </q-item-label>
                </q-item-section>
              </q-item>
              <q-item to="/admin/subscriptions">
                <q-item-section avatar>
                  <q-icon name="subscriptions" />
                </q-item-section>
                <q-item-section>
                  <q-item-label> {{ lang.subscription.title }} </q-item-label>
                </q-item-section>
              </q-item>
              <q-item to="/admin/bills">
                <q-item-section avatar>
                  <q-icon name="request_quote" />
                </q-item-section>
                <q-item-section>
                  <q-item-label> {{ lang.bill.title }} </q-item-label>
                </q-item-section>
              </q-item>
              <q-item to="/admin/receipts">
                <q-item-section avatar>
                  <q-icon name="receipt" />
                </q-item-section>
                <q-item-section>
                  <q-item-label> {{ lang.receipt.title }} </q-item-label>
                </q-item-section>
              </q-item>
              <q-item to="/admin/invoices">
                <q-item-section avatar>
                  <q-icon name="receipt_long" />
                </q-item-section>
                <q-item-section>
                  <q-item-label> {{ lang.invoice.title }} </q-item-label>
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
                    <q-icon name="settings" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label> {{ lang.settings }} </q-item-label>
                  </q-item-section>
                  <q-item-section side> </q-item-section>
                </template>
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
              </q-expansion-item>
            </q-expansion-item>

            <q-separator />

            <q-item to="/" exact>
              <q-item-section avatar>
                <q-icon color="primary" name="home" />
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
import { matMenu } from '@quasar/extras/material-icons'
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

import type { QuasarLanguage } from 'quasar'

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

const quasarLang = import.meta.glob<{ default: QuasarLanguage }>(
  '../../node_modules/quasar/lang/*.js'
)

const languageImports = ref(
  Object.entries(quasarLang).reduce(
    (acc, [key, value]) => {
      const langKey = key.split('/').at(-1)?.split('.').at(0)
      if (langKey) acc[langKey] = value
      return acc
    },
    {} as Record<string, () => Promise<{ default: QuasarLanguage }>>
  )
)

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
