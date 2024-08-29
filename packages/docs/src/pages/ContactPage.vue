<template>
  <q-page padding>
    <q-list>
      <q-item>
        <q-item-section avatar>
          <q-icon name="email" />
        </q-item-section>
        <q-item-section>
          <q-item-label>
            <q-no-ssr>
              {{ email }}
            </q-no-ssr>
          </q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </q-page>
</template>

<scirpt lang="ts">
export default {
  name: 'IndexPage'
}
</scirpt>

<script setup lang="ts">
import { ref, watch } from 'vue'
import FeatureCard from '../components/FeatureCard.vue'
import { useQuasar } from 'quasar'

const $q = useQuasar()

const lang = ref($q.lang.isoName)
watch($q.lang, (newVal) => {
  lang.value = newVal.isoName
})

const email = 'info@simsus.tech'
</script>
