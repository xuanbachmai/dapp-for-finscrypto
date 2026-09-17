<script setup lang="ts">
useHead({
  title: 'Approval & Drain Lab',
})
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="What just happened"
      eyebrow="Approval & Drain Lab"
      :badges="[{ label: 'Week 3', color: 'primary', variant: 'soft' }]"
      description="There was no airdrop. The page existed to get one signature out of you, and it did."
    />

    <ClientOnly>
      <LabsApprovalLabDebrief />

      <template #fallback>
        <UCard class="border border-white/10 bg-slate-950/70">
          <p class="text-sm text-gray-400">Loading lab state...</p>
        </UCard>
      </template>
    </ClientOnly>
  </div>
</template>
