<template>
  <q-expansion-item class="full-width" :content-inset-level="1">
    <template #header>
      <q-item-section avatar>
        <q-icon :name="modelValue.active ? 'i-mdi-play-arrow' : 'i-mdi-stop'" />
      </q-item-section>

      <q-item-section>
        <q-item-label overline>
          {{ modelValue.company?.name }}
        </q-item-label>
        <q-item-label>
          {{
            modelValue.client?.companyName ||
            modelValue.client?.contactPersonName
          }}
        </q-item-label>
        <q-item-label caption>
          {{ lang.subscription.types[modelValue.type] }},
          {{
            cronstrue.toString(modelValue.cronSchedule, {
              locale: $q.lang.isoName.slice(0, 2)
            })
          }}
        </q-item-label>
      </q-item-section>

      <q-item-section side>
        <q-btn icon="i-mdi-more-vert" @click.stop>
          <q-menu>
            <q-list>
              <q-item clickable @click="update(modelValue)">
                <q-item-section avatar>
                  <q-icon name="i-mdi-edit" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ lang.subscription.labels.update }}
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                v-if="!modelValue.active"
                clickable
                @click="start(modelValue)"
              >
                <q-item-section avatar>
                  <q-icon name="play_arrow" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ lang.subscription.labels.start }}
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                v-if="modelValue.active"
                clickable
                @click="stop(modelValue)"
              >
                <q-item-section avatar>
                  <q-icon name="i-mdi-stop" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ lang.subscription.labels.stop }}
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-item-section>
    </template>

    <q-list separator bordered>
      <q-item-label header>{{ lang.invoice.lines }}</q-item-label>
      <invoice-line-item
        v-for="(line, index) in modelValue.lines"
        :key="index"
        :model-value="line"
        :locale="modelValue.locale"
        :currency="modelValue.currency"
      ></invoice-line-item>
    </q-list>

    <q-list separator bordered>
      <q-item-label header>{{ lang.invoice.discounts }}</q-item-label>
      <invoice-line-item
        v-for="(discount, index) in modelValue.discounts"
        :key="index"
        :model-value="discount"
        :locale="modelValue.locale"
        :currency="modelValue.currency"
      ></invoice-line-item>
    </q-list>

    <q-list separator bordered>
      <q-item-label header>{{ lang.invoice.surcharges }}</q-item-label>
      <invoice-line-item
        v-for="(surcharge, index) in modelValue.surcharges"
        :key="index"
        :model-value="surcharge"
        :locale="modelValue.locale"
        :currency="modelValue.currency"
      ></invoice-line-item>
    </q-list>
  </q-expansion-item>
</template>

<script setup lang="ts">
import { Subscription } from '@slimfact/api/zod'
import { toRefs } from 'vue'
import { useQuasar } from 'quasar'
import { useLang } from '../../lang/index.js'
import { InvoiceLineItem } from '@modular-api/quasar-components/checkout'
import cronstrue from 'cronstrue'
import 'cronstrue/locales/nl'
import 'cronstrue/locales/en'

export interface Props {
  modelValue: Subscription
}
const props = defineProps<Props>()

const emit = defineEmits<{
  (
    e: 'update',
    {
      data,
      done
    }: {
      data: Subscription
      done: (success?: boolean) => void
    }
  ): void
  (
    e: 'send',
    {
      data,
      done
    }: {
      data: Subscription
      done: (success?: boolean) => void
    }
  ): void
  (
    e: 'markPaid',
    {
      data,
      done
    }: {
      data: Subscription
      done: (success?: boolean) => void
    }
  ): void
  (
    e: 'start',
    {
      data,
      done
    }: {
      data: Subscription
      done: (success?: boolean) => void
    }
  ): void
  (
    e: 'stop',
    {
      data,
      done
    }: {
      data: Subscription
      done: (success?: boolean) => void
    }
  ): void
}>()

const $q = useQuasar()

const lang = useLang()
const { modelValue } = toRefs(props)

const update = (data: Subscription) => {
  function done() {
    //
  }
  emit('update', { data, done })
}

const start = (data: Subscription) => {
  function done() {
    //
  }
  emit('start', { data, done })
}

const stop = (data: Subscription) => {
  function done() {
    //
  }
  emit('stop', { data, done })
}
</script>
