<template>
  <q-page padding>
    <div class="row q-mt-lg justify-evenly q-col-gutter-x-md">
      <comparison-card
        v-for="(option, index) in options[lang]"
        class="col-12 col-md-4"
        :title="option.title"
        :price="option.price"
        :key="index"
        :pros="option.pros"
        :cons="option.cons"
      ></comparison-card>
    </div>

    <div
      class="row full-width justify-center bg-primary q-pb-lg q-pt-lg q-mt-lg"
    >
      <div class="col-4">
        <div class="row justify-center">
          <a class="text-h5">Interested?</a>
        </div>
        <div class="row justify-center">
          <q-no-ssr>
            <q-btn
              href="mailto:info@simsus.tech"
              label="Contact us"
              color="accent"
            />
          </q-no-ssr>
        </div>
      </div>
    </div>
  </q-page>
</template>

<scirpt lang="ts">
export default {
  name: 'IndexPage'
}
</scirpt>

<script setup lang="ts">
import { ref, watch } from 'vue'
import ComparisonCard from '../components/ComparisonCard.vue'
import FeatureCard from '../components/FeatureCard.vue'
import { useQuasar } from 'quasar'

const $q = useQuasar()

const lang = ref($q.lang.isoName)
watch($q.lang, (newVal) => {
  lang.value = newVal.isoName
})
const options = ref({
  'en-US': [
    {
      title: 'Standard',
      price: '€15 per month',
      pros: [
        {
          message: 'Unlimited bills, receipt and invoices (Fair Use Policy).'
        },
        {
          message:
            'Once sent, invoices are immutable and are stored in the database (not as a file).'
        },
        {
          message: 'A PDF of an invoice can be rendered in the browser.'
        },
        {
          message: 'All invoices are accessible by an unique identifier (UUID).'
        },
        {
          message:
            'Create subscriptions which automatically create bills or invoices based on a schedule.'
        },
        {
          message: 'Mollie payment integrations. Clients can easily pay online.'
        },
        {
          message:
            'Create and send invoices in multiple languages by defining a locale on invoice level.'
        },
        {
          message: 'Automatically calculate all (discounted) totals and taxes.'
        },
        {
          message: 'Can be used headless or integrated into other applications.'
        },
        {
          message: 'Personal support.'
        }
      ],
      cons: []
    },
    {
      title: 'Self hosted',
      price: '€0',
      pros: [
        {
          message: 'All paid features.'
        }
      ],
      cons: [
        {
          message: 'No personal support.'
        }
      ]
    }
  ]
})
</script>
