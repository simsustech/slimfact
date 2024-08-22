<template>
  {{ data }}
</template>

<script setup lang="ts">
import { createUseTrpc } from '../../trpc.js'
const { useQuery } = await createUseTrpc()

const { data } = useQuery('admin.exportPayments', {
  args: {
    startDate: '2024-08-01',
    endDate: '2024-08-31'
  },
  immediate: true
})
</script>
