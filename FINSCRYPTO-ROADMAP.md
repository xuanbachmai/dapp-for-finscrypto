# FINSCRYPTO — Build Roadmap: Real-Life Utility & Risk Modules

Draft spec for extending finscrypto.xyz (FINS3647 / FINS5547, UNSW).
Written to be handed to Claude Code as a working brief. Each module is
self-contained: build them in any order, but the shared infra in §2 comes first.

Status: REVISED — v0.2, build-ready. Edits to Mike's v0.1 are marked **[rev]**
with a one-line rationale, so nothing changes silently.
Last updated: 2026-09-09

---

## 0. Current state (audit)

**Navigation:** Home · Activities · DApps · Faucet · Resources
**Scale:** 12 live DApps, 17 on-chain activities, 10 teaching weeks
**Networks:** Sepolia, Base, Base Sepolia, FINSCRYPTO (course chain)
**Student flow:** install MetaMask → connect wallet → register UNSW student ID →
complete DApp interaction → verify on-chain → activity marked complete

### Existing DApp catalogue

| Wk | DApp | Category | Network |
|----|------|----------|---------|
| 3 | Wave | Wallet interaction | Sepolia |
| 3 | LottoPollo | Lottery | Sepolia |
| 4 | Pixel Art Studio | NFT / ERC-1155 | Sepolia |
| 4 | Uniswap (hosted) | DEX | Sepolia / Base |
| 5 | Coin Flip Casino | Betting | Sepolia |
| 5 | FINSCRYPTO AMM | DEX | FINSCRYPTO |
| 5 | FINSCRYPTO CLOB | DEX / order book | FINSCRYPTO |
| 7 | Superbridge | Bridge | Base Sepolia |
| 7 | Aave (hosted) | Lending | Base / Base Sepolia |
| 7 | Memes Market | Speculation | FINSCRYPTO |
| 8 | Prediction Market | Prediction | FINSCRYPTO |
| 9 | Gnosis Safe | Multisig | Sepolia / Base Sepolia |

### Gap analysis

Two structural gaps drive this whole roadmap.

**Gap 1 — Speculation-heavy, utility-light.**
Four of twelve DApps are gambling or speculation (LottoPollo, Coin Flip, Memes
Market, Prediction Market). Nothing in the course shows crypto doing a job a
normal person would pay for. Students leave able to click through DeFi without
a single answer to "why does this exist outside a classroom?"

**Gap 2 — No consequence.**
Every current activity is upside-only or toy-stakes. There is no liquidation,
no approval drain, no impermanent loss, no depeg, no sandwich. For a finance
cohort this is backwards: **risk is the subject**, and risk is the one thing the
platform never makes them feel.

Everything below closes one or both gaps.

---

## 1. Design principles for new modules

1. **Consequence is the lesson.** If a module can't make a student lose
   something, it teaches less than it should. Losses are testnet — make them real
   inside the sandbox.
2. **Always end with a real-world anchor.** Every module closes with a compare
   step: what does the TradFi equivalent cost / take / risk? A module with no
   anchor is a mechanics demo, not education.
3. **No coding required to complete.** Existing course promise. Keep it.
   Reading a contract is fine; writing one is optional/bonus.
4. **On-chain verifiable completion.** Every activity must be provable from
   chain state alone — no self-attestation, no screenshot uploads.
5. **Instructor-controllable.** Anything time-sensitive (price crash,
   depeg, MEV bot) needs an admin switch so it can be triggered live in class.
6. **Reuse the FINSCRYPTO chain** for anything requiring instructor control or
   free/fast blocks. Use Sepolia/Base only where realism matters (real Aave,
   real bridge, real USDC).

---

## 2. Shared infrastructure (build first)

### 2.1 `ScoreRegistry` — scored completions **[rev]**

Current model appears to be binary (0/1 complete). Several new modules need a
**score**, not a boolean (P&L, survival, time-to-revoke).

*Was: extend `ActivityRegistry` with a score field. Changed because that forces
a migration — or an upgradeability answer — on a contract already holding 17
live activities and a semester of student records, before we have shipped a
single new module.*

Deploy a **sidecar** instead. `ScoreRegistry` owns the score; the existing
`ActivityRegistry` keeps owning the boolean. Nothing migrates, nothing on the
live site changes.

```solidity
struct Result {
  int256  score;       // signed: losses are negative and that's the point
  uint64  completedAt;
  bytes32 evidence;    // tx hash / position id / commitment
}

mapping(address => mapping(uint16 => Result)) public results;

function record(address student, uint16 activityId, int256 score, bytes32 evidence)
  external onlyVerifier;
function scoreOf(address student, uint16 activityId) external view returns (int256);
```

- `verify(activityId)` stays the student-facing entry point, unchanged.
- Each module ships a verifier contract holding the `onlyVerifier` role. It
  writes the boolean to the old registry and the score here.
- Emit `ActivityScored(student, activityId, score, evidence)`.
- Cost: leaderboard and activity pages do two reads instead of one. Cheap, and
  it buys us never touching live student records.

### 2.2 `CourseOracle` — instructor-controlled price feed
Single contract, `onlyOwner` (multisig of teaching staff), used by the
liquidation lab, IL lab, depeg sim, perps.

```
setPrice(bytes32 asset, uint256 price)     // manual
setPrices(bytes32[] assets, uint256[] px)  // batch, for scripted crashes
scheduleCrash(bytes32 asset, uint256 toPrice, uint64 overSeconds)  // linear ramp
latestAnswer(bytes32 asset) returns (uint256, uint64 updatedAt)
```
`scheduleCrash` **interpolates on read** **[rev]** — it stores
`(startPx, endPx, startTs, endTs)`, and `latestAnswer` computes the ramp from
`block.timestamp`. No keeper, no bot, no cron. The crash cannot be allowed to
stall halfway because a script died: it runs live, in a lecture theatre, with
the room watching.

Chainlink-compatible read interface (`latestRoundData`) so the code students
read looks like production code.

**Instructor console:** `/admin` route, wallet-gated. Slider + "crash" button,
live chart of the feed, list of positions currently at risk. This is the single
highest-leverage piece of UI in the whole roadmap — it turns a lab into a
lecture-theatre event.

### 2.3 Progress layer
- XP per activity, streaks, cohort leaderboard.
- **Rank by survival and max drawdown, not raw return**, wherever a P&L exists.
  **[rev]** *Was: risk-adjusted return. Changed because a Sharpe ratio over one
  session's handful of trades is noise, and a finance cohort will say so out
  loud — which costs you the credibility the framing was meant to buy.* Rank on
  what is measurable at n≈6: did the position survive the crash, and how deep
  did it go. Show a Sharpe alongside if you want, labelled illustrative.
- Make the finance framing explicit and unavoidable either way.
- Anonymised by default (student picks a handle); staff view shows student IDs.

### 2.4 `TxExplainer` widget
Paste a tx hash → plain-English decode (calldata, token transfers, gas,
value flow). Currently the Resources page sends students to ChatGPT with
prompts; bring it in-app so it's one click from every activity page.
Server-side: decode via ABI registry + LLM fallback for unknown selectors.
Cache by hash.

---

## 3. Module specs

### TIER 1 — build these three first

---

### M1. Approval & Drain Lab  🔴 highest priority

**Gap closed:** consequence, and the single most common way real people lose money.

**Why this matters more than anything else here:** infinite-approval drains and
signature phishing are how retail actually gets robbed. No lecture substitutes
for having it happen to you. One hour of this is worth more than the rest of
week 3 combined.

**Student flow**
1. Arrive at `GreatAirdropClaim` — a deliberately convincing claim site you host
   (fake countdown, fake TVL, fake testimonials, near-miss domain on a subroute).
2. Connect wallet, click "Claim 5,000 AUD".
3. MetaMask asks for `approve(spender, type(uint256).max)` on their AUD balance.
   Most will sign it. (Prompt is honest — the *site* is what lies. Never
   fabricate a real brand; use an invented token/protocol name.)
4. Nothing arrives. 30 seconds later the drainer contract sweeps their AUD.
5. Redirect to the debrief: annotated screenshot of the exact prompt they signed,
   the calldata decoded field by field, and the drain tx on Etherscan.
6. **Recovery task:** open the Approvals Dashboard, find every outstanding
   approval on their wallet, revoke them all.

**Possible future extensions:**
- `Permit2` / EIP-2612 gasless signature — no gas, no popup weight, same drain.
- `setApprovalForAll` on their Pixel Art NFTs.
- Blind `eth_sign` of an opaque hash.

**Contracts** (Sepolia)
- `LureToken` / `FakeAirdrop.sol` — the claim front, emits `ClaimAttempted`.
- `Drainer.sol` — `sweep(address[] victims, address token)`, `onlyOwner`,
  auto-refunds after debrief so nobody is actually down testnet funds.
- No new registry contract needed; verification reads `Approval` events.

**Frontend**
- `/labs/airdrop-claim` — the lure. Isolated layout, no FINSCRYPTO chrome.
- `/labs/approval-debrief` — post-mortem, calldata decoded, links to explorer.
- `/tools/approvals` — **permanent tool, not just a lab page.** Lists every
  ERC-20 `Approval` and ERC-721/1155 `ApprovalForAll` for the connected wallet,
  across all four networks, with one-click revoke. Students will keep using this
  after the course. Ship it as a headline item under Resources.

**Verification** **[rev]**
Complete when, for the student's registered wallet:
- the first-round drainer recorded a successful token drain, AND
- current allowance to every lab spender is 0 (they revoked), AND
- the student confirmed recovery on-chain, AND
- every token owed by the lab has been returned.

Score = seconds between drain tx and first revoke tx (lower is better).

**Ethics guardrails** — non-negotiable
- Testnet only. Never mainnet. Never real value.
- Brief students in advance that the course contains simulated attacks; no
  specific warning about which week.
- Debrief fires automatically within 60s — nobody stews.
- Invented brand names only. Never impersonate a real protocol or exchange.
- Opt-out path for any student who wants one, with an equivalent written task.

**Effort:** ~1 weekend. **Placement:** Week 3, right after Wave.

---

### M2. Liquidation Lab

**Gap closed:** consequence + the finance concept they'll actually be examined on.

Aave is already in the course, but nobody gets liquidated, so nobody learns what
a health factor *is*. This module is Aave with the safety rail removed and an
instructor holding the price lever.

**Student flow**
1. Supply collateral (mAUD) into `CourseLendingPool` on FINSCRYPTO chain.
2. Borrow mUSD against it. UI shows health factor live, updating with the oracle.
3. Students choose their own leverage — the UI shows liquidation price and lets
   them loop (supply → borrow → swap → supply) if they want to be brave.
4. **In class:** instructor triggers a 30% crash over 5 minutes via `/admin`.
5. Health factors cross 1.0. Positions become liquidatable.
6. **Other students are the liquidators.** A `Liquidate` tab lists underwater
   positions; first caller repays debt and seizes collateral + 8% bonus.
7. Debrief screen: who got liquidated, who profited, total bonus paid, and the
   same event mapped onto a real 2022 incident.

**Contracts** (FINSCRYPTO chain)
- `CourseLendingPool.sol` — supply / withdraw / borrow / repay / liquidate.
  LTV 75%, liquidation threshold 80%, bonus 8%, close factor 50%.
  Reads `CourseOracle`. Interest: simple linear utilisation curve, kept legible
  because students will be asked to read this contract.
- `MockCollateral` (mAUD) + `MockDebt` (mUSD) ERC-20s, mintable from Faucet.

**Frontend**
- `/dapps/lending` — supply/borrow panel, health factor gauge, liquidation price,
  a chart of oracle price vs. their liquidation line.
- `/dapps/lending/liquidate` — sorted table of underwater positions, profit
  preview per liquidation, one-click execute. Refresh on block.
- Health factor gauge must be **large and colour-coded**. The visceral part is
  watching it fall.

**Liquidation race UX** **[rev]**
Forty students hitting "liquidate" on the same position yields one winner and
thirty-nine failed transactions — which teaches the wrong lesson (that the
platform is broken) instead of the right one. Mitigate:
- Simulate before send (`eth_call`) and grey out positions already taken, so a
  student sees "beaten to it, by 1.2s" rather than a raw MetaMask failure.
- Short per-position cooldown (~15s) after each partial liquidation, so the 50%
  close factor actually spreads down the queue instead of clearing in two blocks.
- Live "recently liquidated by" feed. Losing the race is a fine lesson, but only
  if the student can see who won, how fast, and for how much.

**Verification**
Complete when the student has either (a) an open borrow position that survived
the crash with HF > 1, or (b) executed ≥1 successful liquidation.
Score = end-of-session equity vs. starting equity.

**Real-world anchor:** compare to a margin call on a CFD account and to the
May 2021 / June 2022 DeFi liquidation cascades. Ask: who is the liquidator in
TradFi, and why does DeFi have to pay a bounty for the same job?

**Effort:** ~1–2 weekends (the pool contract is the bulk). **Placement:** Week 7,
immediately after the existing Aave activity.

---

### M3. Remittance Lab — crypto vs. the real world

**Gap closed:** utility. This is the module that answers "why does this exist".

Perfect for a Vietnam/Australia cohort: the AUD→VND corridor is one of the most
expensive retail remittance routes in the world, and most students have family
who use it.

**Student flow**
1. Pair up. Student A sends USDC on Base to Student B's wallet.
2. Log automatically from the tx: amount sent, gas paid, amount received,
   seconds to finality, effective fee in bps.
3. Student manually prices the *same* transfer three other ways — bank wire,
   Wise, Western Union / a VN remittance operator — recording fee, FX spread vs.
   mid-market, and stated delivery time. (Screenshots into a form; the FX spread
   is the part they'll get wrong the first time, which is the point.)
4. Platform generates a comparison card: four rails, all-in cost in bps, time,
   counterparty risk, reversibility.
5. **Written reflection, 300 words, and this is where the honesty lives:**
   where does crypto actually lose? On/off-ramp spread, KYC friction, the
   recipient needing a wallet, no recourse on error, regulatory status in VN.
   Mark down any answer that says crypto wins outright.

**Contracts**
None needed on the send leg — real USDC on Base. Optionally a
`RemittanceLog.sol` that records `(sender, recipient, amount, timestamp)` so
verification is a single event read rather than a tx-hash lookup.

**Frontend**
- `/labs/remittance` — send panel (USDC on Base), auto-populated crypto row.
- Comparison form for the three TradFi rails, with an FX-spread calculator
  (they enter the quoted rate, it fetches mid-market and computes the hidden fee).
- Shareable comparison card as the output artefact.

**Verification**
Complete when: a USDC transfer between two registered course wallets exists on
Base, AND all three TradFi rows are submitted, AND the reflection is submitted.
(Reflection is staff-graded — the only non-automated element in the roadmap,
and worth the exception.)

**Cost note — the blocker is the ramp, not the $5** **[rev]**
Real Base mainnet USDC is ~$2–5 per student. But if the course funds their
wallets, students skip the on-ramp entirely — and on/off-ramp spread plus KYC
friction is exactly the honest half this module exists to surface. The money is
not the constraint; the missing step is.
- **If funding centrally:** keep mainnet, but step 3 must also make them *price*
  the ramp they didn't have to use (quote a real AUD→USDC on-ramp, spread
  included) and add it to the crypto row. Otherwise the comparison card flatters
  crypto by omission — the precise failure mode principle 2 exists to prevent.
- **If budget is tight:** Base Sepolia with mainnet gas quoted alongside costs
  nothing and, given the above, loses less than it first appears.

**Effort:** ~1 weekend, mostly frontend. **Placement:** Week 2 or 3 — early,
because it frames everything after it.

---

### TIER 2 — strong adds

---

### M4. Impermanent Loss Lab
**Gap:** finance concept, high exam relevance, cheap to build on existing AMM.

Students LP into the existing FINSCRYPTO AMM, instructor moves the price via
`CourseOracle`-driven arbitrage bot, dashboard shows three lines live:
**LP position value · HODL value · fees earned**. IL is the gap, and they watch
it open.
- Extend the AMM UI with a position page: entry price, current price, IL in %
  and absolute, fee APR, break-even price move.
- Bonus task for the strong students: derive the 2√(k)/(1+k) IL formula and
  check it against their own numbers.
- Anchor: compare to writing a covered strangle. LPing *is* short volatility.
**Effort:** ~3–4 days. **Placement:** Week 5, extending the AMM activity.

---

### M5. Gas & MEV Lab
**Gap:** explains a whole class of real losses students will otherwise never see.

Run a sandwich bot against the FINSCRYPTO AMM (instructor-controlled, on by
default during the activity).
- Round 1: student swaps with 5% slippage tolerance → gets sandwiched, sees the
  bot's two txs bracketing theirs in the block, and the exact value extracted.
- Round 2: 0.1% slippage → tx reverts. Lesson: there is no free setting.
- Round 3: private mempool / commit-reveal route → protected.
- Dashboard showing total value extracted from the cohort, per student.
- Anchor: payment for order flow, and front-running in equities. Ask whether
  MEV is more or less visible than its TradFi equivalent.
**Effort:** ~1 weekend (bot + block explorer view). **Placement:** Week 5–6.

---

### M6. Oracle Manipulation Lab
**Gap:** roughly half of real DeFi exploits, currently invisible in the course.

Two versions of the same lending market: one reads a TWAP/Chainlink-style feed,
one reads spot price from a thin AMM pool.
- Students flash-borrow (or just get given a large balance), skew the thin pool,
  borrow against the inflated collateral price, and walk away with the pool.
- Then repeat against the TWAP version and watch it fail.
- Anchor: Mango Markets, Cream, Harvest. Ask what an "oracle" is in TradFi and
  who manipulates *those* (LIBOR).
**Effort:** ~1 weekend. **Placement:** Week 7–8. Pairs naturally with M2.

---

### M7. DAO Governance
**Gap:** completely absent, and it's the corporate-governance bridge.

Full loop: delegate → propose → vote → timelock → execute, using a real
governance stack (OpenZeppelin Governor) on FINSCRYPTO chain.
- **Make the vote real:** the proposal decides something that actually happens —
  which DApp gets built next semester, or how a small course treasury is spent.
  A fake vote teaches nothing; a real one teaches everything.
- Show the ugly parts: whale dominance, 4% quorum failures, delegation apathy,
  a timelock that gives the multisig veto power in practice.
- Anchor: shareholder voting, proxy advisors, and why turnout is low in both.
**Effort:** ~1 weekend (mostly wiring OZ Governor + a Tally-style UI).
**Placement:** Week 9, alongside Gnosis Safe.

---

### M8. Crypto Tax & Cost Basis Report
**Gap:** utility, and almost nobody teaches it. Every one of these students will
need this within two years.

Export the student's entire semester of on-chain activity → compute realised and
unrealised P&L under FIFO, and separately under the ATO's actual CGT treatment →
generate a filing-shaped report.
- Classify every tx: acquisition, disposal, swap (a CGT event in AU — this
  surprises people), airdrop income, staking income, gas as a cost base adjustment.
- Show FIFO vs. specific-identification side by side and let them see the
  tax bill change.
- Output: a downloadable PDF/CSV they keep.
- Anchor: they've just built a reconciliation engine. That's an audit skill.
**Effort:** ~1 weekend for the engine, more if you chase edge cases.
**Placement:** Week 10 — a natural capstone.

---

### M9. On-Chain Forensics + Sybil Detection
**Gap:** skills, and it ties directly to the wallet-clustering work.

Two halves:
- **Forensics:** given a tx hash from a real incident, trace fund flow through
  hops and mixers in the explorer, write a 300-word post-mortem naming the
  vulnerability class.
- **Sybil:** run a fake airdrop with a points system. Students will farm it with
  multiple wallets — encourage it. Then run wallet clustering over the cohort and
  publish, in class, who got filtered and on what evidence (funding graph,
  timing correlation, gas-price fingerprints, common approval patterns).
  Students who farmed get to argue against their own detection.
- Anchor: AML transaction monitoring, KYC, and false-positive cost.
**Effort:** ~1–2 weekends. Reuses existing clustering work.
**Placement:** Week 8.

---

### M10. RWA / Tokenised T-Bill
**Gap:** utility, and the most career-relevant trend for this cohort.

Mint a token backed by a "T-bill", accrue coupons on a schedule, redeem at
maturity. Show the NAV/price relationship and what happens when secondary price
diverges from NAV.
- Include the uncomfortable part: the token is only as good as the custodian
  attestation. Where is the trust actually placed?
- Anchor: BUIDL, Ondo, and money market funds. Ask what tokenisation actually
  improves — settlement, or just the wrapper.
**Effort:** ~4–5 days. **Placement:** Week 6 or 10.

---

### M11. Perps & Funding Rate
**Gap:** derivatives — the part of crypto with the most real volume and the
closest mapping to their degree.

Long/short with leverage on FINSCRYPTO chain, funding paid every 8 minutes
(compressed from 8 hours) so students feel it inside one session.
- Show the funding rate driving price convergence to index.
- Combine with M2's liquidation engine — same machinery, different wrapper.
- Anchor: futures basis, contango/backwardation, cost of carry.
**Effort:** ~1–2 weekends. **Placement:** Week 8.

---

### M12. Stablecoin CDP + Depeg Simulation
**Gap:** the mechanism behind the single most-taught crypto failure.

Mint a course stablecoin against collateral, then instructor breaks it:
crash collateral, watch the peg go, watch the liquidation spiral, see whether
the backstop mechanism holds.
- Run it twice: once overcollateralised (Dai-style), once algorithmic
  (Terra-style). One survives. They should be able to say why before you tell them.
**Effort:** ~1 weekend if M2's engine exists. **Placement:** Week 6.

---

### M13. Account Abstraction Wallet
**Gap:** the "it gets better" ending.

Passkey login, no seed phrase, sponsored gas, batched transactions, social
recovery. Let them onboard a *non-crypto friend* in under 60 seconds as the
completion criterion.
- Deliberately place this **last**. After ten weeks of seed phrases, network
  switching and gas errors, the contrast is the lesson.
- Anchor: ask what UX debt crypto is carrying and why it took a decade to fix.
**Effort:** ~1 weekend using an existing AA SDK. **Placement:** Week 10.

---

### M14. Soulbound Course Credential
**Gap:** utility — a real artefact they keep.

On course completion, mint a non-transferable ERC-721 (or ERC-5192) carrying
their score, cohort, and a metadata pointer to their activity record.
- Verifiable by anyone with the contract address — a credential, not a PDF.
- Public verifier page: paste a wallet, see what they completed.
- Make it good-looking. They will put it on LinkedIn, and that's free marketing
  for the course.
**Effort:** ~3 days. **Placement:** Week 10 capstone.

---

## 4. Platform-level additions

| Item | Why | Effort |
|------|-----|--------|
| `/tools/approvals` revoke dashboard | Genuinely useful beyond the course; ship standalone | 2–3 days |
| Tx explainer widget (§2.4) | Kills the ChatGPT round-trip | 3 days |
| XP / streaks / cohort leaderboard | Retention layer over rails that already exist | 3–4 days |
| Trading competition week | Fixed starting balance, ranked by Sharpe not return | 4 days |
| Incident case library | Terra, FTX, Curve, Bybit — each with an on-chain artefact to inspect | ongoing |
| Instructor `/admin` console | Prerequisite for M2, M4, M5, M6, M12 | 4–5 days |
| Mobile / WalletConnect support | Students will try on phones regardless | 3 days |

---

## 5. Suggested build order

**Phase 1 — ship the highest-value module first (2–3 weeks)** **[rev]**
*Was: oracle + admin console + scored registry, with M1 in phase 2. Changed
because M1 needs none of that infrastructure and M3 needs none at all. Building
the oracle first delays the module this document itself calls "worth more than
the rest of week 3 combined" by three weeks — and delays its ethics paperwork,
which is the real long pole, by the same three weeks.*
1. `/tools/approvals` dashboard — standalone value, and M1's recovery step
2. `ScoreRegistry` (§2.1) — small, unblocks scoring everywhere downstream
3. M1 Approval & Drain Lab
4. M3 Remittance Lab — no contracts on the critical path

**Phase 2 — instructor control + leverage (3–4 weeks)**
5. `CourseOracle` + `/admin` console (§2.2)
6. M2 Liquidation Lab

**Phase 3 — depth (4–6 weeks)**
7. M4 Impermanent Loss (cheap, reuses AMM)
8. M5 Gas & MEV
9. M6 Oracle Manipulation
10. M7 DAO Governance

**Phase 4 — capstone (3–4 weeks)**
11. M8 Tax Report
12. M9 Forensics + Sybil
13. M14 Soulbound Credential
14. M13 Account Abstraction

M10 (RWA), M11 (Perps), M12 (Depeg) slot in wherever the syllabus has room —
each is independent.

---

## 6. Revised week map (proposed)

| Week | Theme | Existing | New |
|------|-------|----------|-----|
| 2–3 | Wallets, keys, first tx | Wave, LottoPollo | **M3 Remittance**, **M1 Approval Lab** |
| 4 | Tokens & NFTs | Pixel Art, Uniswap | — |
| 5 | Market structure | AMM, CLOB, Coin Flip | **M4 IL Lab**, **M5 MEV Lab** |
| 6 | Stablecoins & RWA | — | **M12 Depeg**, **M10 RWA** |
| 7 | Credit & leverage | Aave, Superbridge, Memes | **M2 Liquidation Lab**, **M6 Oracle** |
| 8 | Derivatives & data | Prediction Market | **M11 Perps**, **M9 Forensics** |
| 9 | Governance & custody | Gnosis Safe | **M7 DAO** |
| 10 | Consequences & the future | — | **M8 Tax**, **M13 AA**, **M14 Credential** |

---

**[rev]** Week 8 carried three new modules — more than any other week — while M6
Oracle Manipulation reads, on its own spec, as pairing with M2. Moved M6 to week
7 alongside the liquidation lab, which is where it wants to be anyway: same
lending machinery, opposite failure mode.

---

## 7. Open questions for Mike

**Resolved in v0.2** **[rev]**

- [x] ~~Is `ActivityRegistry` upgradeable, or does adding scores mean a
      migration?~~ **Moot.** §2.1 is now a `ScoreRegistry` sidecar; the live
      registry is never touched.
- [x] ~~Does the existing repo use Foundry or Hardhat?~~ **Hardhat.** Foundry is
      not installed on the build machine and Hardhat installs from npm with no
      extra toolchain. Solidity ^0.8.20 with standard OZ imports either way, so
      this stays reversible if the live repo says otherwise.
- [x] ~~Frontend stack confirmation~~ **Nuxt 3 + Vue + Nuxt UI + wagmi/viem +
      TypeScript**, implemented as a separately deployable dapp that uses the
      Ethereum Sepolia and existing FINSCRYPTO platform conventions. Route paths above hold.

**Still open — Mike**

- [ ] Budget for Base mainnet in M3 — real USDC, or Base Sepolia with quoted
      mainnet costs? See the revised M3 cost note: the on-ramp question decides
      what step 3 asks for, and matters more than the dollar figure.
- [ ] Ethics sign-off path for M1 — does the simulated-phishing lab need formal
      approval from the school? Assume yes; start the paperwork early. **Now the
      long pole**, since M1 moved into phase 1.
- [ ] Who else has admin keys on `CourseOracle`? Should be a Safe, not an EOA.
- [ ] Which of M10/M11/M12 actually fits the current syllabus? All three is
      probably too much for one semester.
- [ ] **New:** does the live `ActivityRegistry` let a third-party verifier
      contract mark completion, or does it only accept calls from a fixed owner?
      Decides whether the sidecar writes both sides atomically or needs a
      staff-run relayer. Blocks nothing in phase 1; blocks integration.

---

## 8. Notes for Claude Code

When implementing any module from this file:

- Read the existing DApp implementations first and **match their patterns** —
  the verification flow, the wallet-connect wrapper, the activity-page layout.
  Consistency matters more than novelty here. **[rev]** The risk lab is a
  separate dapp; its contracts use Sepolia while it keeps the FINSCRYPTO wallet setup,
  student records and activity-verification shapes. Use public Sepolia ETH faucets. Keep those
  integration seams explicit and environment-driven.
- Every new contract needs a matching entry in `/resources` (address + explorer
  link) — students are told to verify everything, so make it verifiable.
- Every new activity needs: a DApp page, an activity entry with steps, a
  verification function, and a Resources entry. Missing any one breaks the flow.
- Contracts students are asked to *read* should be written for readability over
  gas efficiency, with comments aimed at someone who has never seen Solidity.
- Test the unhappy paths hardest: wrong network, insufficient gas, rejected
  signature, stale oracle. That's where students will actually end up.
