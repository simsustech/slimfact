<template>
  <q-page>
    <div class="row q-mt-xl justify-center q-ma-md">
      <a class="text-h5"> Streamlined invoicing made easy </a>
    </div>

    <div class="row full-width justify-center q-pb-lg q-ma-md">
      <q-carousel
        v-model="slide"
        class="full-width"
        animated
        arrows
        infinite
        control-color="primary"
        style="height: 100%"
      >
        <q-carousel-slide
          v-for="(slide, index) in slides[lang]"
          :key="index"
          :name="index"
        >
          <q-img :src="slide.imgSrc" style="height: 400px" fit="contain" />
          <div class="text-subtitle1 text-center">
            {{ slide.title }}
          </div>
        </q-carousel-slide>
      </q-carousel>
    </div>
    <div
      class="row full-width justify-center bg-primary q-pb-lg q-pt-lg q-mt-lg q-ma-md"
    >
      <div class="q-pa-none q-ma-none">
        <div class="col-4">
          <div class="row justify-center">
            <a class="text-h5">Try the demo</a>
          </div>
          <div class="row justify-center">
            <q-btn
              href="https://demo.slimfact.app"
              label="Open demo"
              color="accent"
            />
          </div>
          <div class="row justify-center">
            <a class="text-h5">Login: admin@slimfact.app / N6QD4HzGYf4h</a>
          </div>
          <div class="row justify-center">
            <a class="text-h5">
              Email:
              <a class="text-h5" href="https://mail.demo.slimfact.app"
                >https://mail.demo.slimfact.app
              </a>
            </a>
          </div>
        </div>
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

    <div class="row full-width justify-center q-pb-lg q-ma-md">
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
import FeatureCard from '../components/FeatureCard.vue'
import { useQuasar } from 'quasar'

const $q = useQuasar()

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
