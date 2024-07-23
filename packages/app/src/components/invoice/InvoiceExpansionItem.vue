<template>
  <q-expansion-item class="full-width" :content-inset-level="1">
    <template #header>
      <q-item-section avatar>
        <div class="row self-center items-center">
          <invoice-status-avatar
            :model-value="modelValue.status"
            :paid="
              !!modelValue.amountPaid &&
              modelValue.amountPaid >= modelValue.totalIncludingTax
            "
          />
          <price
            :model-value="modelValue.totalIncludingTax"
            :currency="modelValue.currency"
          />
          <!-- <q-icon
            v-if="
              modelValue.amountPaid &&
              modelValue.amountPaid >= modelValue.totalIncludingTax
            "
            name="check"
            color="green"
          >
            <q-tooltip>
              {{ lang.invoice.status.paid }}
            </q-tooltip>
          </q-icon> -->
        </div>
      </q-item-section>
      <q-item-section>
        <q-item-label overline>
          {{ modelValue.companyDetails.name }} {{ modelValue.numberPrefix
          }}{{ modelValue.number }}
        </q-item-label>
        <q-item-label v-if="modelValue.reminderSentDates.length" overline>
          {{
            lang.invoice.messages.remindersSentOn(
              modelValue.reminderSentDates?.map((date) => formatDate(date))
            )
          }}
        </q-item-label>
        <q-item-label>
          <div class="row justify-between">
            <div class="col-9">
              {{
                modelValue.clientDetails.companyName ||
                modelValue.clientDetails.contactPersonName
              }}
            </div>
            <div class="col-3 text-right">
              <!-- <price
                :model-value="modelValue.totalIncludingTax"
                :currency="modelValue.currency"
              /> -->
            </div>
          </div>
        </q-item-label>
        <!-- <q-item-label caption>
          <q-icon
            v-if="
              modelValue.amountPaid &&
              modelValue.amountPaid >= modelValue.totalIncludingTax
            "
            name="check"
            color="green"
          >
            <q-tooltip>
              {{ lang.invoice.status.paid }}
            </q-tooltip>
          </q-icon>
          <price
            :model-value="modelValue.totalIncludingTax"
            :currency="modelValue.currency"
          />
        </q-item-label> -->
      </q-item-section>
      <q-item-section side>
        <q-btn flat round icon="more_vert">
          <q-menu>
            <q-list>
              <q-item
                v-if="
                  ![InvoiceStatus.CONCEPT, InvoiceStatus.CANCELED].includes(
                    modelValue.status
                  )
                "
                v-close-popup
                :href="`/invoice/${modelValue.uuid}`"
                target="_blank"
                clickable
              >
                <q-item-section avatar>
                  <q-icon name="open_in_new" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ lang.invoice.labels.open }}
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                v-if="
                  [InvoiceStatus.CONCEPT, InvoiceStatus.BILL].includes(
                    modelValue.status
                  )
                "
                v-close-popup
                clickable
                @click.stop="update(modelValue)"
              >
                <q-item-section avatar>
                  <q-icon name="edit" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ lang.invoice.labels.update }}
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                v-if="
                  [InvoiceStatus.CONCEPT, InvoiceStatus.BILL].includes(
                    modelValue.status
                  ) && onSend
                "
                v-close-popup
                clickable
                @click.stop="send(modelValue)"
              >
                <q-item-section avatar>
                  <q-icon name="send" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ lang.invoice.labels.send }}
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                v-if="[InvoiceStatus.RECEIPT].includes(modelValue.status)"
                v-close-popup
                clickable
                @click.stop="sendInvoice(modelValue)"
              >
                <q-item-section avatar>
                  <q-icon name="send" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ lang.invoice.labels.sendInvoice }}
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                v-if="
                  modelValue.status === 'open' &&
                  getFutureDate(lastReminderDate, { days: 7 }) < currentDate
                "
                v-close-popup
                clickable
                @click.stop="sendReminder(modelValue)"
              >
                <q-item-section avatar>
                  <q-icon name="notifications" color="yellow" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ lang.invoice.labels.sendReminder }}
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                v-if="
                  modelValue.status === 'open' &&
                  modelValue.reminderSentDates?.length === 2 &&
                  getFutureDate(lastReminderDate, { days: 5 }) < currentDate
                "
                v-close-popup
                clickable
                @click.stop="sendExhortation(modelValue)"
              >
                <q-item-section avatar>
                  <q-icon name="notifications" color="red" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ lang.invoice.labels.sendExhortation }}
                  </q-item-label>
                </q-item-section>
              </q-item>

              <!-- <q-item
                v-if="
                  [InvoiceStatus.OPEN, InvoiceStatus.BILL].includes(
                    modelValue.status
                  ) && modelValue.amountPaid
                    ? modelValue.amountPaid >= modelValue.totalIncludingTax
                    : false
                "
                @click="markPaid(modelValue)"
                clickable
              >
                <q-item-section avatar>
                  <q-icon name="paid" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ lang.invoice.labels.markPaid }}
                  </q-item-label>
                </q-item-section>
              </q-item> -->
              <q-item
                v-if="
                  [InvoiceStatus.BILL].includes(modelValue.status) &&
                  modelValue.amountPaid
                    ? modelValue.amountPaid >= modelValue.totalIncludingTax
                    : false
                "
                v-close-popup
                clickable
                @click="sendReceipt(modelValue)"
              >
                <q-item-section avatar>
                  <q-icon name="receipt" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ lang.bill.labels.sendReceipt }}
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                v-if="
                  [InvoiceStatus.OPEN, InvoiceStatus.BILL].includes(
                    modelValue.status
                  ) &&
                  modelValue.amountDue &&
                  (onAddPaymentCash || onAddPaymentBankTransfer)
                "
                clickable
              >
                <q-item-section avatar>
                  <q-icon name="payment" />
                </q-item-section>
                <q-item-section>{{ lang.payment.addPayment }}</q-item-section>
                <q-item-section side>
                  <q-icon name="keyboard_arrow_right" />
                </q-item-section>
                <q-menu anchor="top end" self="top start">
                  <q-list>
                    <q-item
                      v-if="onAddPaymentCash"
                      v-close-popup
                      clickable
                      @click="addPaymentCash(modelValue)"
                    >
                      <q-item-section avatar>
                        <q-icon name="attach_money"></q-icon>
                      </q-item-section>
                      <q-item-section>
                        <q-item-label>
                          {{ lang.payment.methods.cash }}
                        </q-item-label>
                      </q-item-section>
                    </q-item>
                    <q-item
                      v-if="onAddPaymentBankTransfer"
                      v-close-popup
                      clickable
                      @click="addPaymentBankTransfer(modelValue)"
                    >
                      <q-item-section avatar>
                        <q-icon name="account_balance"></q-icon>
                      </q-item-section>
                      <q-item-section>
                        <q-item-label>
                          {{ lang.payment.methods.bankTransfer }}
                        </q-item-label>
                      </q-item-section>
                    </q-item>
                    <q-item
                      v-if="onAddPaymentIdeal"
                      v-close-popup
                      clickable
                      @click="addPaymentIdeal(modelValue)"
                    >
                      <q-item-section avatar>
                        <q-icon name="fa-brands fa-ideal"></q-icon>
                      </q-item-section>
                      <q-item-section>
                        <q-item-label>
                          {{ lang.payment.methods.ideal }}
                        </q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-item>
              <q-item
                v-if="
                  [InvoiceStatus.CONCEPT, InvoiceStatus.BILL].includes(
                    modelValue.status
                  ) && !modelValue.amountPaid
                "
                v-close-popup
                clickable
                @click.stop="cancel(modelValue)"
              >
                <q-item-section avatar>
                  <q-icon name="cancel" color="red" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ lang.invoice.labels.cancel }}
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
        <!-- <q-btn
          v-if="modelValue.status !== 'concept'"
          icon="download"
          @click.stop="downloadPdf"
        />
        <q-btn
          v-if="modelValue.status === 'concept'"
          icon="edit"
          @click.stop="update(modelValue)"
        />
        <q-btn
          v-if="modelValue.status === 'concept'"
          icon="send"
          @click.stop="send(modelValue)"
        /> -->
      </q-item-section>
    </template>

    <q-tabs v-model="tab">
      <q-tab name="overview" :label="lang.overview" />
      <q-tab
        v-if="modelValue.payments?.length"
        name="payments"
        :label="lang.payment.payments"
      />
    </q-tabs>

    <q-separator />

    <q-tab-panels v-model="tab" animated>
      <q-tab-panel name="overview">
        <div class="row items-center">
          {{ lang.invoice.lines }}
        </div>
        <invoice-line-row
          v-for="(line, index) in modelValue.lines"
          :key="index"
          :model-value="line"
          :currency="modelValue.currency"
          disable
        />

        <div v-if="modelValue.discounts?.length">
          <div class="row items-center">
            {{ lang.invoice.discounts }}
          </div>
          <invoice-discount-surcharge-row
            v-for="(discount, index) in modelValue.discounts"
            :key="index"
            :model-value="discount"
            :currency="modelValue.currency"
            disable
          />
        </div>

        <div v-if="modelValue.surcharges?.length">
          <div class="row items-center">
            {{ lang.invoice.surcharges }}
          </div>
          <invoice-discount-surcharge-row
            v-for="(surcharge, index) in modelValue.surcharges"
            :key="index"
            :model-value="surcharge"
            :currency="modelValue.currency"
            disable
          />
        </div>
      </q-tab-panel>
      <q-tab-panel v-if="modelValue.payments?.length" name="payments">
        <q-list>
          <payment-item
            v-for="payment in modelValue.payments"
            :key="payment.id"
            :model-value="payment"
          />
        </q-list>
      </q-tab-panel>
    </q-tab-panels>

    <!-- <q-scroll-area :style="scrollAreaSize">
      <q-resize-observer @resize="onResize" />
      <div ref="pdfRef">
        <invoice-page
          v-if="modelValue"
          ref="invoiceRef"
          :model-value="modelValue"
        />
      </div>
    </q-scroll-area> -->
  </q-expansion-item>
</template>

<script setup lang="ts">
import type { Invoice } from '@modular-api/fastify-checkout'
import Price from '../Price.vue'
import {
  InvoiceLineRow,
  InvoiceDiscountSurchargeRow,
  PaymentItem
} from '@modular-api/quasar-components/checkout'
import { computed, ref, toRefs } from 'vue'
import { useQuasar } from 'quasar'
import { useLang } from '../../lang/index.js'
// import InvoiceStatusIcon from './InvoiceStatusIcon.vue'
import InvoiceStatusAvatar from './InvoiceStatusAvatar.vue'
import { date as dateUtil } from 'quasar'
import { InvoiceStatus } from '@slimfact/api/zod'

export interface Props {
  modelValue: Invoice
  onAddPaymentCash?: unknown
  onAddPaymentBankTransfer?: unknown
  onAddPaymentIdeal?: unknown
  onSend?: unknown
}
const props = defineProps<Props>()

const emit = defineEmits<{
  (
    e: 'update',
    {
      data,
      done
    }: {
      data: Invoice
      done: (success?: boolean) => void
    }
  ): void
  (
    e: 'send',
    {
      data,
      done
    }: {
      data: Invoice
      done: (success?: boolean) => void
    }
  ): void
  (
    e: 'send:invoice',
    {
      data,
      done
    }: {
      data: Invoice
      done: (success?: boolean) => void
    }
  ): void
  (
    e: 'send:reminder',
    {
      data,
      done
    }: {
      data: Invoice
      done: (success?: boolean) => void
    }
  ): void
  (
    e: 'send:exhortation',
    {
      data,
      done
    }: {
      data: Invoice
      done: (success?: boolean) => void
    }
  ): void
  (
    e: 'addPaymentCash',
    {
      data,
      done
    }: {
      data: Invoice
      done: (success?: boolean) => void
    }
  ): void
  (
    e: 'addPaymentBankTransfer',
    {
      data,
      done
    }: {
      data: Invoice
      done: (success?: boolean) => void
    }
  ): void
  (
    e: 'addPaymentIdeal',
    {
      data,
      done
    }: {
      data: Invoice
      done: (success?: boolean) => void
    }
  ): void
  (
    e: 'sendReceipt',
    {
      data,
      done
    }: {
      data: Invoice
      done: (success?: boolean) => void
    }
  ): void
  (
    e: 'cancel',
    {
      data,
      done
    }: {
      data: Invoice
      done: (success?: boolean) => void
    }
  ): void
}>()

const $q = useQuasar()
const lang = useLang()
const { modelValue } = toRefs(props)

const tab = ref<'overview' | 'payments'>('overview')

const update = (data: Invoice) => {
  function done() {
    //
  }
  emit('update', { data, done })
}

const send = (data: Invoice) => {
  function done() {
    //
  }
  emit('send', { data: data, done })
}

const sendInvoice = (data: Invoice) => {
  function done() {
    //
  }
  emit('send:invoice', { data: data, done })
}

const sendReminder = (data: Invoice) => {
  function done() {
    //
  }
  emit('send:reminder', { data: data, done })
}

const sendExhortation = (data: Invoice) => {
  function done() {
    //
  }
  emit('send:exhortation', { data: data, done })
}

const addPaymentCash = (data: Invoice) => {
  function done() {
    //
  }
  emit('addPaymentCash', { data: data, done })
}

const addPaymentBankTransfer = (data: Invoice) => {
  function done() {
    //
  }
  emit('addPaymentBankTransfer', { data: data, done })
}
const addPaymentIdeal = (data: Invoice) => {
  function done() {
    //
  }
  emit('addPaymentIdeal', { data: data, done })
}
const sendReceipt = (data: Invoice) => {
  function done() {
    //
  }
  emit('sendReceipt', { data: data, done })
}
// const markPaid = (data: Invoice) => {
//   function done() {
//     //
//   }
//   emit('markPaid', { data: data, done })
// }

const cancel = (data: Invoice) => {
  function done() {
    //
  }
  emit('cancel', { data: data, done })
}

const dateFormatter = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    dateStyle: 'long'
  }).format(date)
const formatDate = (date: string | null) => {
  if (date) return dateFormatter(new Date(date), $q.lang.isoName)
  return '-'
}

const currentDate = new Date().toISOString().slice(0, 10)
const lastReminderDate = computed(() => {
  const lastReminder = modelValue.value.reminderSentDates?.at(-1)
  if (lastReminder) return lastReminder
  if (modelValue.value.dueDate) return modelValue.value.dueDate
  return ''
})

const getFutureDate = (date: string, { days }: { days: number }) =>
  dateUtil.addToDate(new Date(date), { days }).toISOString().slice(0, 10)
</script>
