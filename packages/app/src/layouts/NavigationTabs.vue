<template>
  <q-tabs class="navigation-rail">
    <q-route-tab icon="i-mdi-home" to="/" label="Home" />
    <q-route-tab
      v-if="user"
      icon="i-mdi-person"
      to="/account"
      :label="lang.account.title"
    />
    <q-route-tab
      v-if="user?.roles.includes('administrator')"
      icon="i-mdi-account-cog"
      to="/admin"
      :label="lang.administrator"
    />
  </q-tabs>
</template>

<script setup lang="ts">
import { user } from '../oauth.js'
import { useLang } from '../lang/index.js'

const lang = useLang()
</script>

<style scoped>
.navigation-rail:deep(.q-tab__content) {
  min-width: 52px;
  justify-content: flex-start !important;
}

.navigation-rail:deep(.q-tab__indicator) {
  color: var(--light-secondary-container);
  position: absolute;
  width: 52px;
  border-radius: 16px;
  height: 32px;
  min-height: unset;
  left: calc(50% - 26px);
  top: calc(50% - 35px);
}

.navigation-rail:deep(.q-tabs--vertical .q-tab__indicator) {
  top: calc(50% - 23px);
}

.body--dark .navigation-rail:deep(.q-tab__indicator) {
  color: var(--dark-secondary-container);
}
</style>
