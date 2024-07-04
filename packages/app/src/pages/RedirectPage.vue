<template>
  <div v-if="user">
    {{ user }}
  </div>
</template>

<script lang="ts">
export default {
  name: 'OidcRedirect'
}
</script>
<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { userRouteKey } from '../oauth.js'
import { useOAuthClient } from '../oauth.js'
import { useUser, user } from '../oauth.js'

const router = useRouter()

onMounted(async () => {
  const oAuthClient = await useOAuthClient()
  if (oAuthClient.value) {
    await oAuthClient.value.handleCallback()
    await useUser()
    router.push({ name: userRouteKey })
  }
})
</script>
