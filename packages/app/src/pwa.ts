import { useRegisterSW } from 'virtual:pwa-register/vue'
import { watch } from 'vue'
import { Notify } from 'quasar'
import { useLang } from './lang/index.js'

const { needRefresh, updateServiceWorker } = useRegisterSW()
const lang = useLang()

watch(needRefresh, (val) => {
  if (val) {
    Notify.create({
      type: 'warning',
      message: lang.value.updateAvailable,
      closeBtn: lang.value.refresh,
      onDismiss: updateServiceWorker,
      timeout: 0
    })
  }
})
