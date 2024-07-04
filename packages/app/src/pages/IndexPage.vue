<template>
  <q-page padding>
    <!-- <div class="row justify-around q-mb-md">
      <announcements-list v-model="announcements" bordered />
    </div>
    <div class="row justify-around q-ma-lg"></div> -->
    <div class="row q-mb-md q-col-gutter-lg">
      <div class="col-md-8 justify-center row q-gutter-lg">
        <q-styled-card v-if="user">
          <template #title> {{ `${lang.welcome} ${user.email}` }} </template>
          <q-list>
            <q-item clickable to="/user">
              <q-item-section>
                <q-item-label>
                  {{ lang.account.title }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-styled-card>
        <q-styled-card v-else>
          <template #title>
            <div class="text-center">
              {{ title }}
            </div>
          </template>
          <template #image>
            <div class="text-center">
              <q-img
                loading="eager"
                style="max-width: 100px"
                :img-style="{ overflow: 'visible', width: '100%' }"
                :src="logoUrl"
                placeholder-src="~assets/logo.svg"
              />
            </div>
          </template>
          <template #actions>
            <div class="row justify-center full-width">
              <login-button color="primary" @click="login" />
            </div>
          </template>
        </q-styled-card>
      </div>
    </div>
    <div class="row justify-center q-gutter-md"></div>
  </q-page>
</template>

<scirpt lang="ts">
export default {
  name: 'IndexPage'
}
</scirpt>

<script setup lang="ts">
import { user, oAuthClient } from '../oauth.js'
import { LoginButton } from '@simsustech/quasar-components/authentication'
import { QStyledCard } from '@simsustech/quasar-components'
import { useConfiguration } from '../configuration.js'
import { useLang } from '../lang/index.js'
import { computed, onMounted } from 'vue'
const configuration = useConfiguration()
const lang = useLang()

const title = computed(() => configuration.value.TITLE)
const logoUrl = `./logo.svg`
const login = () => {
  if (oAuthClient.value) oAuthClient.value.signIn({})
}

onMounted(async () => {})
</script>
