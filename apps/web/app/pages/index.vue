<script setup lang="ts">
useHead({
  title: 'FINSCRYPTO Labs',
})

const links = [
  { title: 'Approvals', to: '/tools/approvals', icon: 'i-lucide-shield-check', description: 'Find and revoke every open token approval on your wallet. A permanent tool, useful long after the course.' },
  { title: 'Approval & Drain Lab', to: '/labs/approval-debrief', icon: 'i-lucide-flask-conical', description: 'Debrief, progress checklist and recovery steps for the simulated drain.' },
  { title: 'Activities', to: '/activities', icon: 'i-lucide-activity', description: 'Verify completed Activities against chain state and save Progress.' },
]
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="FINSCRYPTO Labs"
      eyebrow="Standalone build"
      description="Risk modules for FINS3647/5547, built on the course platform's stack and conventions and tested locally before they move onto the platform."
    />

    <div class="grid gap-4 md:grid-cols-3">
      <NuxtLink v-for="link in links" :key="link.to" :to="link.to">
        <UCard class="h-full border border-white/10 bg-slate-950/70 transition-colors hover:border-primary/40">
          <UIcon :name="link.icon" class="size-6 text-primary" />
          <h2 class="mt-3 text-lg font-semibold text-white">{{ link.title }}</h2>
          <p class="mt-1 text-sm text-gray-400">{{ link.description }}</p>
        </UCard>
      </NuxtLink>
    </div>

    <UCard class="border border-white/10 bg-slate-950/70">
      <h2 class="font-semibold text-white">Lures</h2>
      <p class="mt-1 text-sm text-gray-400">
        Students reach these from a link in class, never from navigation:
        <NuxtLink to="/labs/airdrop-claim" class="text-primary underline underline-offset-4">round 1</NuxtLink>
        and
        <NuxtLink to="/labs/verify-wallet" class="text-primary underline underline-offset-4">round 2</NuxtLink>.
      </p>
    </UCard>
  </div>
</template>
