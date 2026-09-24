<script setup lang="ts">
import { LAB_CHAIN_ID } from '~/utils/chains'

/**
 * Round-1 lure for the Approval & Drain Lab.
 *
 * Ethics, restated where the damage would happen:
 * - Sepolia only. FINS is a valueless classroom token; course AUD is refunded exactly.
 *   Native Sepolia ETH is never approved, received or swept and remains available for gas.
 * - The FINS course allocation, future exchange listing and cash-out promise are fictional
 *   teaching pretexts. This page is only for a supervised FINS3647/FINS5547 class exercise.
 * - The wallet prompt stays honest: it asks for unlimited spending permission, in plain terms.
 *   Only the page around it lies. That gap is the lesson.
 * - The debrief opens automatically within 60 seconds of signing.
 * - The footer carries a real opt-out.
 */
definePageMeta({ layout: false })
useHead({ title: 'FINS Student Genesis Airdrop | Claim 500 FINS' })

const DEBRIEF_AFTER_MS = 60_000

const { isConnected, labConfigured, pendingAction, actionError, approveRound1Lure, claimLure } = useApprovalLab()
const { address, connect } = useWallet()
const config = useRuntimeConfig()

const platformUrl = String(config.public.platformUrl).replace(/\/$/, '')
const platformLinks = [
  { label: 'Home', href: `${platformUrl}/` },
  { label: 'Activities', href: `${platformUrl}/activities` },
  { label: 'DApps', href: `${platformUrl}/dapps`, current: true },
  { label: 'Faucet', href: '/faucet' },
  { label: 'Resources', href: `${platformUrl}/resources` },
]

const shortAddress = computed(() => {
  if (!address.value) return ''
  return `${address.value.slice(0, 6)}...${address.value.slice(-4)}`
})

const step = shallowRef<'idle' | 'approving' | 'claiming' | 'done'>('idle')
const waited = shallowRef(0)
const remaining = shallowRef('47:12')
const deadline = Date.now() + (47 * 60 + 12) * 1_000

let countdown: ReturnType<typeof setInterval> | undefined
let waitTicker: ReturnType<typeof setInterval> | undefined
let debriefTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  // Fake urgency. Every real lure has one.
  countdown = setInterval(() => {
    const ms = Math.max(0, deadline - Date.now())
    remaining.value = `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1_000)).padStart(2, '0')}`
  }, 1_000)
})

onBeforeUnmount(() => {
  clearInterval(countdown)
  clearInterval(waitTicker)
  clearTimeout(debriefTimer)
})

async function claim() {
  // Record attendance before any approval so a partial/rejected flow is still recoverable.
  step.value = 'claiming'
  if (!await claimLure()) {
    step.value = 'idle'
    return
  }
  step.value = 'approving'
  if (!await approveRound1Lure()) {
    // Refusing is the right answer. The debrief shows how to close any partial approval.
    await navigateTo('/labs/approval-debrief')
    return
  }
  step.value = 'done'
  waitTicker = setInterval(() => { waited.value += 1 }, 1_000)
  debriefTimer = setTimeout(() => navigateTo('/labs/approval-debrief'), DEBRIEF_AFTER_MS)
}

const testimonials = [
  { text: 'My FINS3647 allocation was confirmed straight away. Holding mine for launch.', who: 'FINS3647 student' },
  { text: '500 FINS for being in the course — easiest early allocation I’ve claimed.', who: 'FINS5547 student' },
  { text: 'Claimed before the exchange launch. I’m ready for the first FINS market.', who: 'FINS student' },
]
</script>

<template>
  <div class="min-h-screen bg-c2-paper font-c2-body text-base leading-[1.65] text-c2-ink selection:bg-c2-link selection:text-white lg:text-[15px] lg:leading-6">
    <a href="#airdrop-content" class="c2-button sr-only fixed top-2 left-2 z-50 focus:not-sr-only">Skip to content</a>

    <header>
      <div class="border-b-2 border-c2-ink">
        <div class="mx-auto grid max-w-[1440px] grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 lg:grid-cols-[auto_1fr_auto] lg:px-8 xl:px-16">
          <a :href="`${platformUrl}/`" class="inline-flex min-h-11 items-center whitespace-nowrap font-c2-nav text-[26px] leading-10 text-c2-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-c2-link lg:text-[32px]">
            FINSCRYPTO /
          </a>

          <nav aria-label="Course navigation" class="order-3 col-span-2 flex gap-2 overflow-x-auto border-t border-c2-ink pt-3 font-c2-nav lg:order-none lg:col-span-1 lg:justify-self-center lg:border-0 lg:pt-0">
            <a
              v-for="link in platformLinks"
              :key="link.label"
              :href="link.href"
              class="inline-flex min-h-11 shrink-0 items-center px-1 py-2 text-c2-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-c2-link"
              :class="link.current ? 'bg-c2-ink px-3 text-white no-underline' : ''"
              :aria-current="link.current ? 'page' : undefined"
            >
              {{ link.label }}
            </a>
          </nav>

          <ClientOnly>
            <button v-if="!isConnected" type="button" class="c2-button" @click="() => connect(LAB_CHAIN_ID)">Connect Wallet</button>
            <div v-else class="c2-button flex items-center font-c2-code text-xs" aria-label="Connected wallet">{{ shortAddress }}</div>

            <template #fallback>
              <div class="h-11 w-36 animate-pulse border border-c2-ink bg-c2-surface" aria-hidden="true" />
            </template>
          </ClientOnly>
        </div>
      </div>

      <div class="border-b border-c2-ink bg-c2-surface">
        <div class="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-x-6 gap-y-1 px-5 py-2 font-c2-nav text-[13px] leading-5 lg:px-8 lg:text-sm xl:px-16">
          <span>2026T3 · FINS3647 / FINS5547</span>
          <span>Bitcoin and Decentralized Finance</span>
        </div>
      </div>
    </header>

    <main id="airdrop-content" class="mx-auto max-w-[1440px] px-5 pt-6 pb-16 [overflow-wrap:anywhere] lg:px-8 xl:px-16">
      <header class="border-l-4 border-c2-link pl-4">
        <p class="font-c2-nav text-sm text-c2-muted">DAPPS / STUDENT GENESIS DROP</p>
        <h1 class="mt-1 max-w-[1000px] font-c2-heading text-[42px] leading-[52px] font-extrabold tracking-[-0.025em] lg:text-[44px] lg:leading-[54px]">
          500 FINS Student Airdrop
        </h1>
        <p class="mt-1 max-w-[850px]">
          Students enrolled in FINS3647 or FINS5547 are eligible for the inaugural FINS community allocation.
        </p>
      </header>

      <section class="mt-8 grid gap-8 border-t-2 border-c2-ink pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:gap-12" aria-labelledby="eligibility-title">
        <div>
          <p class="font-c2-nav text-sm text-c2-muted">01 / ELIGIBILITY, ALLOCATION, CLAIM</p>
          <h2 id="eligibility-title" class="mt-2 font-c2-heading text-[28px] leading-9 font-extrabold">Your student allocation is ready.</h2>
          <p class="mt-3 max-w-[780px]">
            Claim 500 FINS before public trading begins. When FINS goes live, the planned CEX and DEX markets will let holders swap their allocation and convert it into real-world value.
          </p>

          <dl class="mt-6 border-y border-c2-ink divide-y divide-c2-ink">
            <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-5 py-3">
              <dt class="text-c2-muted">Eligible courses</dt>
              <dd class="font-bold text-right">FINS3647 / FINS5547</dd>
            </div>
            <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-5 py-3">
              <dt class="text-c2-muted">Student allocation</dt>
              <dd class="font-c2-code text-right font-bold">500 FINS</dd>
            </div>
            <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-5 py-3">
              <dt class="text-c2-muted">Planned trading access</dt>
              <dd class="font-bold text-right">CEX + DEX</dd>
            </div>
            <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-5 py-3">
              <dt class="text-c2-muted">Claim window closes</dt>
              <dd class="font-c2-code text-right font-bold text-c2-action">{{ remaining }}</dd>
            </div>
          </dl>

          <div class="mt-6 border-l-4 border-c2-action bg-[#fffdf5] p-4">
            <p class="font-bold">Trade after launch</p>
            <p class="mt-1 text-sm text-c2-muted">
              Hold your allocation until supported markets open. Exchange access and market value will depend on launch liquidity.
            </p>
          </div>

          <ul class="mt-6 grid gap-2 text-sm sm:grid-cols-3">
            <li><span class="font-c2-nav text-c2-link">01</span> No purchase required</li>
            <li><span class="font-c2-nav text-c2-link">02</span> One claim per wallet</li>
            <li><span class="font-c2-nav text-c2-link">03</span> Early community access</li>
          </ul>
        </div>

        <aside class="border border-c2-ink bg-[#fffdf5] p-4 shadow-[8px_8px_0_#111] sm:p-5" aria-label="500 FINS allocation certificate">
          <svg class="w-full border border-c2-ink bg-[#fff3bd]" viewBox="0 0 420 230" role="img" aria-label="Retro illustration of FINS coins and a graduation cap">
            <rect width="420" height="230" fill="#fff3bd" />
            <path d="M0 184h420v46H0z" fill="#e9efff" />
            <path d="M38 35h74M75 16v55M332 38h53M359 13v51" stroke="#111" stroke-width="3" />
            <path d="m75 16 8 17 18 5-18 5-8 17-8-17-18-5 18-5 8-17Z" fill="#fff" stroke="#111" stroke-width="3" stroke-linejoin="round" />
            <circle cx="164" cy="132" r="61" fill="#ffdf64" stroke="#111" stroke-width="4" />
            <circle cx="164" cy="132" r="44" fill="#fffdf5" stroke="#111" stroke-width="3" stroke-dasharray="5 5" />
            <text x="164" y="153" text-anchor="middle" fill="#143fab" font-family="Shippori Mincho, Georgia, serif" font-size="63" font-weight="800">F</text>
            <circle cx="268" cy="145" r="48" fill="#ffd6dd" stroke="#111" stroke-width="4" />
            <circle cx="268" cy="145" r="34" fill="#fff" stroke="#111" stroke-width="3" />
            <text x="268" y="160" text-anchor="middle" fill="#b71f24" font-family="DotGothic16, monospace" font-size="38">500</text>
            <path d="m213 76 76-35 77 35-77 36-76-36Z" fill="#143fab" stroke="#111" stroke-width="4" stroke-linejoin="round" />
            <path d="M241 91v32c27 21 70 21 96 0V91" fill="#e8f5ed" stroke="#111" stroke-width="4" stroke-linejoin="round" />
            <path d="M366 76v55" stroke="#111" stroke-width="4" />
            <circle cx="366" cy="139" r="8" fill="#b71f24" stroke="#111" stroke-width="3" />
            <path d="m49 153 8 8 15-18M343 180l9 9 17-21" fill="none" stroke="#143fab" stroke-width="4" stroke-linecap="square" />
          </svg>

          <div class="mt-4 flex items-end justify-between gap-4 border-b border-c2-ink pb-3">
            <div>
              <p class="font-c2-nav text-xs text-c2-muted">ALLOCATION CERTIFICATE / 001</p>
              <p class="mt-1 font-c2-heading text-[42px] leading-[48px] font-extrabold">500 <span class="font-c2-nav text-[24px] text-c2-link">FINS</span></p>
            </div>
            <div class="border border-c2-ink bg-[#e8f5ed] px-3 py-2 font-c2-nav text-xs">ELIGIBLE</div>
          </div>

          <ClientOnly>
            <div class="mt-5">
              <button v-if="!isConnected" type="button" class="c2-button c2-button-action w-full" @click="() => connect(LAB_CHAIN_ID)">
                Connect wallet to claim →
              </button>

              <div v-else-if="step === 'done'" aria-live="polite" class="border border-c2-ink bg-[#e8f5ed] p-4">
                <p class="font-bold">Allocation registered ✓</p>
                <p class="mt-1 text-sm">Your 500 FINS is queued for distribution. You can close this page.</p>
                <p class="mt-3 font-c2-code text-xs text-c2-muted">Confirming allocation... {{ waited }}s</p>
              </div>

              <button
                v-else
                type="button"
                class="c2-button c2-button-action w-full"
                :disabled="!labConfigured || step !== 'idle' || pendingAction !== null"
                @click="claim"
              >
                {{ step === 'approving' ? 'Confirm token access in your wallet...' : step === 'claiming' ? 'Registering allocation...' : 'Claim 500 FINS →' }}
              </button>

              <p v-if="actionError && step === 'idle'" role="alert" class="mt-3 border-l-4 border-c2-action pl-3 text-sm text-c2-action">{{ actionError }}</p>
              <p v-if="!labConfigured" class="mt-3 border border-c2-ink bg-[#fff3bd] p-3 text-sm">This classroom lab is awaiting its Sepolia contract deployment.</p>
            </div>

            <template #fallback>
              <div class="mt-5 h-[48px] animate-pulse border border-c2-ink bg-c2-surface" aria-hidden="true" />
            </template>
          </ClientOnly>

          <p class="mt-4 text-xs leading-5 text-c2-muted">
            A one-time wallet verification confirms the address receiving your allocation. Sepolia testnet gas applies.
          </p>
        </aside>
      </section>

      <section class="mt-12 border-t-2 border-c2-ink pt-4" aria-labelledby="student-feed-title">
        <div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p class="font-c2-nav text-sm text-c2-muted">02 / STUDENT FEED</p>
            <h2 id="student-feed-title" class="mt-1 font-c2-heading text-[28px] leading-9 font-extrabold">From the course community</h2>
          </div>
          <p class="font-c2-nav text-xs text-c2-muted">FINS STUDENT GENESIS DISTRIBUTION</p>
        </div>

        <div class="grid border border-c2-ink md:grid-cols-3 md:divide-x md:divide-c2-ink">
          <article v-for="(quote, index) in testimonials" :key="quote.who" class="border-b border-c2-ink p-4 last:border-b-0 md:border-b-0">
            <p class="font-c2-nav text-sm text-c2-link">0{{ index + 1 }}</p>
            <p class="mt-2 text-sm leading-6">“{{ quote.text }}”</p>
            <p class="mt-3 text-xs font-bold text-c2-muted">{{ quote.who }}</p>
          </article>
        </div>
      </section>

      <footer class="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-c2-ink pt-4 text-xs text-c2-muted">
        <p>500 FINS per eligible wallet · FINS3647 / FINS5547 · Distribution before launch</p>
        <NuxtLink to="/labs/approval-debrief" class="c2-link inline-flex min-h-11 items-center">
          Course activity information and opt-out →
        </NuxtLink>
      </footer>
    </main>
  </div>
</template>
