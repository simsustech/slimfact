<template>
  <q-page>
    <div class="column justify-center" style="min-height: inherit">
      <div class="col bg-primary"></div>
      <div class="col bg-primary">
        <div class="row items-center">
          <div class="col-12 col-md-5 justify-center q-pa-md">
            <div class="row justify-center">
              <div v-if="lang === 'en-US'" style="max-width: 350px">
                <div class="text-h4">Streamlined invoicing made easy.</div>
                <br />
                <div class="text-h6">
                  SlimFact is a smart invoicing solution designed to simplify
                  your billing process.
                </div>
                <br />
                <q-btn
                  class="q-mt-md"
                  color="accent"
                  href="https://demo.slimfact.app"
                >
                  Open the demo
                </q-btn>
                <br />
                <router-link class="text-caption" to="/pricing"
                  >Or look at the options.</router-link
                >
              </div>
            </div>
          </div>
          <div class="col-12 col-md-7">
            <q-carousel
              v-model="slide"
              class="bg-primary"
              animated
              arrows
              infinite
              control-color="accent"
              style="height: 100%"
            >
              <q-carousel-slide
                v-for="(slide, index) in slides[lang]"
                :key="index"
                :name="index"
              >
                <q-img
                  :src="slide.imgSrc"
                  style="height: 400px"
                  fit="contain"
                />
                <div class="text-subtitle1 text-center">
                  {{ slide.title }}
                </div>
              </q-carousel-slide>
            </q-carousel>
          </div>
        </div>
        <div class="col bg-primary"></div>
      </div>
    </div>

    <div class="row justify-center q-col-gutter-x-md q-ma-md">
      <feature-card
        v-for="(feature, index) in features[lang]"
        class="col-12 col-md-4"
        :key="index"
        :title="feature.title"
        :content="feature.content"
        :img-src="feature.imgSrc"
      />
    </div>

    <!-- <div class="row full-width justify-center q-pb-lg q-ma-md">
      <q-carousel
        v-model="responsiveSlide"
        class="full-width"
        animated
        arrows
        infinite
        control-color="primary"
        style="min-height: 470px"
      >
        <q-carousel-slide
          v-for="(slide, index) in responsiveSlides[lang]"
          :key="index"
          :name="index"
        >
          <q-img :src="slide.imgSrc" style="height: 350px" fit="contain" />
          <div class="q-mt-md text-subtitle1 text-center">
            {{ slide.title }}
          </div>
        </q-carousel-slide>
      </q-carousel>
    </div> -->
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
import { useQuasar, useMeta } from 'quasar'

const $q = useQuasar()
useMeta(() => {
  if (!import.meta.env.SSR) {
    return {
      link: {
        material: { rel: 'canonical', href: window?.location.origin }
      }
    }
  }
  return {}
})

const lang = ref($q.lang.isoName)
watch($q.lang, (newVal) => {
  lang.value = newVal.isoName
})

const slide = ref(0)
const slides = ref({
  'en-US': [
    {
      title: 'Bills can be created for orders which are subject to change.',
      imgSrc: '/slides/bills.png'
    },
    {
      title:
        'Once paid, a bill can be converted to a receipt with the click of a button.',
      imgSrc: '/slides/receipts.png'
    },
    {
      title:
        'If a client would like to receive an official invoice, a receipt can be seamlessy converted to an invoice. Of course, invoices can also be created directly.',
      imgSrc: '/slides/invoices.png'
    },
    {
      title: 'An invoice can be viewed, downloaded, printed and paid online.',
      imgSrc: '/slides/invoice.png'
    }
  ]
})

const responsiveSlide = ref(0)
const responsiveSlides = ref({
  nl: [],
  'en-US': []
})

const features = ref({
  'en-US': [
    {
      title: 'Mollie payment integration',
      content: 'Mollie (mollie.com) can be used to receive online payments.',
      imgSrc: '/features/ideal.png'
    },
    {
      title: 'Number prefixes',
      content: 'Use multiple invoice number prefixes for your company.',
      imgSrc: '/features/numberprefixes.png'
    },
    {
      title: 'Client account',
      content:
        'Clients can view an overview of their bills, receipts and invoices online.',
      imgSrc: '/features/clientaccount.png'
    }
  ]
})
</script>
