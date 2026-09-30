<template>
  <q-tabs class="navigation-rail">
    <q-route-tab icon="i-mdi-home" to="/" :label="lang.home.title" />
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

/*
 * Cut with an ellipsis, never silently clipped. `q-tab__label` carries Quasar's
 * `white-space: nowrap` but no `text-overflow`, so its computed value is the CSS
 * initial `clip` — the audit measured this rail rendering "Administrato".
 *
 * Re-verification on the current build finds every label inside its box (delta 0
 * at 1440x900 in the 80dp mini drawer and at 375x812 in the bottom bar, in all
 * three locales), so this is the guard rather than a correction: it turns any
 * future longer label into an indicated truncation. `tests/e2e/frontend/
 * layout.spec.ts` asserts the invariant. The rail's width is untouched — 80dp is
 * MD3's, and `Md3Layout`'s mini-width.
 */
.navigation-rail:deep(.q-tab__label) {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
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
