import { Ref, ref } from 'vue'
import { Loading, setCssVar } from 'quasar'
import { useLang } from './lang/index.js'

const lang = useLang()

export interface MODULARAPI_CLIENT_CONFIGURATION {
  LICENSE_KEY?: string
  LANG: string
  COUNTRY: string
  TITLE?: string
  CURRENCY: '€' | '$'
  HIDE_BRANDING: boolean
  SASS_VARIABLES?: {
    $primary?: string
    $secondary?: string
    $accent?: string
    $dark?: string
    $positive?: string
    $negative?: string
    $info?: string
    $warning?: string
  }
  PAYMENT_HANDLERS: {
    cash: boolean
    pin: boolean
    ideal: boolean
    bankTransfer: boolean
    smartpin: boolean
  }
}

export const configuration = ref<MODULARAPI_CLIENT_CONFIGURATION>({
  LANG: import.meta.env.VITE_LANG || 'en-US',
  COUNTRY: import.meta.env.VITE_COUNTRY || 'NL',
  TITLE: import.meta.env.VITE_TITLE || 'SlimFact',
  CURRENCY: '€',
  HIDE_BRANDING: false,
  PAYMENT_HANDLERS: {
    cash: false,
    ideal: false,
    bankTransfer: false,
    smartpin: false
  }
})

export const useConfiguration = () => configuration

export const loadConfiguration = async (language: Ref<string>) => {
  Loading.show({
    message: lang.value.configuration.loading + '...',
    boxClass: 'bg-grey-2 text-grey-9',
    spinnerColor: 'primary'
  })
  return fetch('/configuration')
    .then((res) => res.json())
    .then((res) => {
      configuration.value = { ...configuration.value, ...res }
      if (configuration.value.LANG) language.value = configuration.value.LANG
    })
    .then(() => {
      const sassVariables = configuration.value.SASS_VARIABLES
      if (sassVariables) {
        for (const key in sassVariables) {
          if (sassVariables[key]) setCssVar(key.slice(1), sassVariables[key])
        }
      }
    })
    .then(() => Loading.hide())
    .catch(() => {
      Loading.show({
        message: lang.value.configuration.errorLoading,
        messageColor: 'red',
        boxClass: 'bg-grey-2 text-grey-9',
        spinner: undefined
      })
    })
}

export const BILL_ICON = 'i-mdi-receipt-outline'
export const RECEIPT_ICON = 'i-mdi-receipt'
export const INVOICE_ICON = 'i-mdi-invoice'
