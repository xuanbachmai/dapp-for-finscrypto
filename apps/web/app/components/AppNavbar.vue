<script setup lang="ts">
const route = useRoute()
const drawerOpen = ref(false)

const navLinks = [
  { label: 'Home', to: '/', icon: 'i-lucide-home' },
  { label: 'Activities', to: '/activities', icon: 'i-lucide-activity' },
  { label: 'Approvals', to: '/tools/approvals', icon: 'i-lucide-shield-check' },
  { label: 'Approval Lab', to: '/labs/approval-debrief', icon: 'i-lucide-flask-conical' },
]

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}
</script>

<template>
  <nav class="fixed top-0 left-0 right-0 z-50 border-b border-gray-800 bg-gray-950/80 backdrop-blur-md">
    <div class="mx-auto grid h-16 max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4">
      <NuxtLink to="/" class="text-lg font-bold tracking-tight">
        FINSCRYPTO
      </NuxtLink>

      <div class="hidden items-center justify-self-center gap-1 md:flex">
        <NuxtLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          :class="isActive(link.to) ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-white hover:bg-gray-800'"
        >
          {{ link.label }}
        </NuxtLink>
      </div>

      <div class="flex items-center justify-end gap-2 md:min-w-[22rem]">
        <ClientOnly>
          <WalletConnect />

          <template #fallback>
            <div class="flex items-center gap-2">
              <div class="hidden h-9 w-28 animate-pulse rounded-xl border border-white/10 bg-white/5 md:block" aria-hidden="true" />
              <div class="hidden h-9 w-32 animate-pulse rounded-xl border border-white/10 bg-white/5 md:block" aria-hidden="true" />
              <div class="h-10 w-36 animate-pulse rounded-xl border border-white/10 bg-white/5 md:hidden" aria-hidden="true" />
            </div>
          </template>
        </ClientOnly>

        <UButton
          class="md:hidden"
          variant="ghost"
          icon="i-lucide-menu"
          aria-label="Menu"
          @click="() => { drawerOpen = true }"
        />
      </div>
    </div>

    <USlideover v-model:open="drawerOpen" side="right">
      <template #body>
        <div class="flex flex-col gap-1 p-4">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors"
            :class="isActive(link.to) ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-white hover:bg-gray-800'"
            @click="drawerOpen = false"
          >
            <UIcon :name="link.icon" class="size-5" />
            {{ link.label }}
          </NuxtLink>
        </div>
      </template>
    </USlideover>
  </nav>
</template>
