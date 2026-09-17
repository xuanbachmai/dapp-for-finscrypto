<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  eyebrow?: string
  badges?: {
    label: string
    color?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
    variant?: 'solid' | 'outline' | 'soft' | 'subtle'
    icon?: string
  }[]
}>()
</script>

<template>
  <div class="mb-8">
    <div v-if="eyebrow || badges?.length" class="mb-3 flex flex-wrap items-center gap-2">
      <p v-if="eyebrow" class="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
        {{ eyebrow }}
      </p>

      <UBadge
        v-for="badge in badges"
        :key="badge.label"
        :label="badge.label"
        :color="badge.color ?? 'neutral'"
        :variant="badge.variant ?? 'soft'"
        :icon="badge.icon"
        size="md"
      />
    </div>

    <h1 class="text-3xl font-bold tracking-tight">{{ title }}</h1>
    <p v-if="description" class="mt-2 text-gray-400">{{ description }}</p>
  </div>
</template>
