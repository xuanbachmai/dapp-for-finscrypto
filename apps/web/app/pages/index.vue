<script setup lang="ts">
useHead({
  title: 'FINSCRYPTO Labs',
})

const links = [
  { title: 'Approvals', to: '/tools/approvals', icon: 'i-lucide-shield-check', description: 'Find and revoke every open token approval on your wallet. A permanent tool, useful long after the course.' },
  { title: 'Approval & Drain Lab', to: '/labs/approval-debrief', icon: 'i-lucide-flask-conical', description: 'Debrief, progress checklist and recovery steps for the simulated drain.' },
  { title: 'Activities', to: '/activities', icon: 'i-lucide-activity', description: 'Verify completed Activities against chain state and save Progress.' },
  { title: 'Sepolia ETH', to: '/faucet', icon: 'i-lucide-droplets', description: 'Get test ETH for transaction fees from a public Sepolia faucet.' },
]
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="FINSCRYPTO Labs"
      eyebrow="Course companion dapp"
      description="A separately deployable risk-learning dapp using Sepolia contracts with the existing FINSCRYPTO student registry and activity-verification conventions."
    />

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
        Students reach the simulated airdrop from a link in class, never from navigation:
        <NuxtLink to="/labs/airdrop-claim" class="text-primary underline underline-offset-4">open the lure</NuxtLink>.
      </p>
    </UCard>
  </div>
</template>
