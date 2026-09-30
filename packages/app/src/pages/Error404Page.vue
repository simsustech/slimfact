<template>
  <!--
    A page, not `.fullscreen`. `.fullscreen` is `position: fixed; inset: 0;
    z-index: 6000` — above the app bar's 2000 — so the overlay swallowed the
    header's controls: measured 4 blocked at both 1440x900 and 375x812
    (`elementFromPoint` at the user button's centre returned this div).

    The accent also stays an accent. `bg-primary` made the whole viewport the
    primary colour, which in dark mode is the scheme's light blue
    (`rgb(134, 206, 255)`) under white text: 1.71:1, a full-screen flash of
    light. Now the numeral carries `text-primary` on the surface, and the message
    inherits the scheme-aware default text instead of being muted to 40 % opacity
    (which dropped it under 4.5:1).
  -->
  <q-page padding class="flex flex-center text-center">
    <div>
      <div class="text-primary" style="font-size: 30vh">404</div>

      <div class="text-h2">{{ lang[404] }}</div>

      <q-btn
        class="q-mt-xl"
        color="primary"
        unelevated
        to="/"
        :label="lang.goHome"
        no-caps
      />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { useLang } from '../lang/index.js'

const lang = useLang()
</script>
