<template>
  <q-card>
    <q-card-section class="q-pb-none">
      <div class="text-h6">{{ title }}</div>
      <div class="text-subtitle1 text-primary">{{ price }}</div>
    </q-card-section>
    <q-card-section class="q-pt-none q-mt-none">
      <q-list dense>
        <q-item v-for="(pro, index) in pros" :key="index">
          <q-item-section avatar>
            <q-icon name="check" color="green" />
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ pro.message }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-for="(con, index) in cons" :key="index">
          <q-item-section avatar>
            <q-icon name="close" color="red" />
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ con.message }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
export interface ProCon {
  message: string
}
export interface Props {
  title: string
  price: string
  pros?: ProCon[]
  cons?: ProCon[]
}
defineProps<Props>()
</script>
