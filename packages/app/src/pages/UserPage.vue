<template>
  <q-page padding>
    <div class="row">
      <q-styled-card v-if="user">
        <q-item>
          <q-item-section avatar>
            <q-icon name="person"></q-icon>
          </q-item-section>

          <q-item-section>
            <q-item-label
              >{{ user.email }}
              <q-icon name="check" :color="user.verified ? 'green' : 'grey'">
                <q-tooltip>
                  {{ user.verified ? 'Email verified' : 'Email not verified' }}
                </q-tooltip>
              </q-icon>
            </q-item-label>
          </q-item-section>

          <q-item-section side top> </q-item-section>
        </q-item>
        <q-item clickable :href="emailChangeUri">
          {{ lang.account.messages.changeEmailAddress }}</q-item
        >
        <!-- <q-item clickable @click="emailVerifyRoute"> Verify email address</q-item> -->
      </q-styled-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { QStyledCard } from '@simsustech/quasar-components'
import { user } from '../oauth.js'
import { useLang } from '../lang/index.js'
const lang = useLang()
const emailChangeUri =
  import.meta.env.VITE_OIDC_EMAIL_CHANGE_URI || `./interaction/email/change`
</script>
