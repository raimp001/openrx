# OpenRx Engineering Prompt

> Full-stack audit of OpenRx — a Next.js 14 healthcare platform with 12 AI agents, USDC payments, and clinical workflows. This prompt describes every known issue across security, UX, performance, and architecture, organized by priority. Use it to systematically fix the platform.

---

## Phase 1: Critical Security (fix before any public traffic)

### 1.1 — Payment system allows forged records and cross-wallet attacks

**Files:** `lib/payments-ledger.ts:531`, `app/api/payments/intent/route.ts`, `app/api/payments/verify/route.ts`

**Problems:**
- `verifyAndRecordPaymentInFileStore` auto-creates a payment record with `amount: "0.01"` when a `txHash` has no matching intent. Anyone with a valid on-chain tx hash can forge a payment record in the ledger.
- Neither `/api/payments/intent` nor `/api/payments/verify` cross-checks `body.walletAddress` against `auth.session.walletAddress`. A patient can create intents or verify payments against another patient's wallet.

**Fix:**
1. In `payments-ledger.ts:531` — remove the ad-hoc record creation. Return an error when no matching intent is found.
2. In both `intent/route.ts` and `verify/route.ts` — after calling `requireAuth`, assert `body.walletAddress.toLowerCase() === auth.session.walletAddress.toLowerCase()`. Return 403 if they differ.

### 1.2 — Cross-patient data access via patientId enumeration

**File:** `app/api/screening/assess/route.ts:525`

**Problem:** The GET handler accepts a `patientId` query param and loads that patient's full snapshot without verifying the requester owns that patient ID. Any authenticated user can enumerate patient IDs and read other patients' medical data.

**Fix:** After resolving the patient, assert `patient.user.walletAddress === auth.session.walletAddress` or that the session has an admin/staff role. Return 403 otherwise.

### 1.3 — CSP allows unsafe-inline and unsafe-eval

**File:** `middleware.ts:14-15`

**Problem:** The Content Security Policy permits `'unsafe-inline'` and `'unsafe-eval'` for `script-src`, completely neutralizing XSS protection. In a healthcare app handling PHI and wallet addresses, this is a material risk.

**Fix:** Remove both directives. Replace inline scripts with nonce-based CSP (`'nonce-...'`) or `'strict-dynamic'`. Audit all inline `<script>` tags and `eval` usage in the frontend.

### 1.4 — Screening intake endpoint has no authentication

**File:** `app/api/screening/intake/route.ts`

**Problem:** No `requireAuth` call. The endpoint accepts free-form medical narratives and returns structured intake data. It is fully public.

**Fix:** Add `requireAuth` at the top of the handler.

### 1.5 — CORS allows localhost in production

**File:** `middleware.ts:25-29`

**Problem:** `http://localhost:3000` is unconditionally in `ALLOWED_ORIGINS`. An attacker running a local page can make credentialed cross-origin requests to the production API.

**Fix:** Gate localhost origins on `process.env.NODE_ENV !== "production"`.

---

## Phase 2: Critical UX Bugs (things that break for real users right now)

### 2.1 — Reveal animations can make entire homepage sections invisible

**File:** `app/page.tsx` (CSS in `globals.css:88-91`)

**Problem:** `.reveal` elements start at `opacity: 0; transform: translateY(16px)`. If `useScrollReveal` fails to attach the IntersectionObserver (SSR hydration race, old browser, JS error), sections never become visible. No fallback.

**Fix:** Add a CSS fallback: `.reveal { opacity: 1; transform: none; }` as the default, and only apply the hidden state via a `.js-loaded .reveal` class added by the hook. Or use `@supports` with `animation-timeline` as the progressive enhancement gate.

### 2.2 — Dashboard shows "complete your profile" before data finishes loading

**File:** `app/(app)/dashboard/page.tsx:248-263`

**Problem:** Render order is: disconnected check → no-data check → loading spinner. A connected user with data sees the "complete your care profile" prompt flash on every page load until the snapshot resolves.

**Fix:** Move the `if (loading)` check before the `if (!hasData)` check.

### 2.3 — Onboarding age always defaults to 40; DOB never collected

**File:** `app/(app)/onboarding/page.tsx:491-496`

**Problem:** The screening recommendations step uses `age` which defaults to 40 with a swallowed error. The onboarding flow never asks for date of birth. Every user gets age-40 screening recommendations regardless of actual age.

**Fix:** Either add a DOB collection step to onboarding, or derive age from the patient profile's `date_of_birth` field (which exists in the schema). Remove the empty `catch {}`.

### 2.4 — Onboarding dentist search silently skips without searching

**File:** `app/(app)/onboarding/page.tsx:400-403`

**Problem:** The `dentist-search` step says "Noted" to whatever the user types and immediately advances to pharmacy. The agent promised to find dentists but never does.

**Fix:** Either implement the search (similar to the provider search pattern) or remove the dentist step from the flow and set expectations correctly.

### 2.5 — Sidebar localStorage in useState causes React hydration mismatch

**File:** `components/layout/sidebar.tsx:85-93`

**Problem:** `useState` initializer reads `localStorage` inline. Server renders `{}`, client may render saved state. This causes a hydration mismatch warning and potential UI glitches.

**Fix:** Initialize with `useState({})` and load from localStorage in a `useEffect`.

### 2.6 — Hamburger button overlaps page content on mobile

**Files:** `components/layout/sidebar.tsx:301-307`, `app/(app)/layout.tsx:39`

**Problem:** The hamburger is `fixed left-4 top-4 z-50` but `<main>` has only `pt-6`. Page headings render behind the hamburger on mobile. There is no left/top padding compensation.

**Fix:** Add `pt-16 lg:pt-6` (or similar) to `<main>` to push mobile content below the hamburger.

---

## Phase 3: Performance and Bundle Size

### 3.1 — Heavy libraries not code-split

**Files:** `package.json`, various page imports

**Problem:** These libraries are in production dependencies and not dynamically imported:
- `mermaid@^11.12.3` (~500 KB minified)
- `reactflow@^11.11.4` (~200 KB)
- `recharts@^3.7.0` (~90 KB)
- `jspdf@^4.2.1` + `html-to-image@^1.11.13` (PDF export, canvas-dependent)

**Fix:** Use `next/dynamic` with `{ ssr: false }` at each call site:
```tsx
const MermaidChart = dynamic(() => import("@/components/mermaid-chart"), { ssr: false })
const ReactFlowCanvas = dynamic(() => import("@/components/flow-canvas"), { ssr: false })
```
For Recharts in vitals page, dynamically import the chart components. For jsPDF/html-to-image, import only on button click (not at module level).

### 3.2 — `force-dynamic` on app layout blocks all static optimization

**File:** `app/(app)/layout.tsx:5`

**Problem:** `export const dynamic = "force-dynamic"` forces every route to be server-rendered dynamically on every request, solely to check `getDatabaseHealth()`. This blocks partial pre-rendering, ISR, and edge caching.

**Fix:** Move the database health check to a lightweight client-side poll or a cached server function with a short TTL. Remove `force-dynamic` from the layout.

### 3.3 — No `optimizePackageImports` for Lucide

**File:** `next.config.js`

**Problem:** Lucide React icons are imported individually across 28+ pages but Next.js doesn't have `experimental.optimizePackageImports` configured, so tree-shaking may not work optimally.

**Fix:** Add to `next.config.js`:
```js
experimental: {
  optimizePackageImports: ["lucide-react", "@coinbase/onchainkit"],
}
```

### 3.4 — Missing `remotePatterns` for external images

**File:** `next.config.js:11-13`

**Problem:** No `remotePatterns` or `domains` in the image config. Any `<Image src="https://...">` with an external URL will throw a runtime error.

**Fix:** Add `remotePatterns` for any known external image sources (e.g., AI-generated prompt images from the care directory API).

### 3.5 — Vitals page chart computations not memoized

**File:** `app/(app)/vitals/page.tsx:96-148`

**Problem:** `filteredVitals`, `bpReadings`, `glucoseReadings`, `chartData`, and all averages are plain variable assignments, not `useMemo`. If `useLiveSnapshot` polls, all chart math runs on every tick.

**Fix:** Wrap in `useMemo([vitals, range])`.

---

## Phase 4: Data Layer and API Correctness

### 4.1 — Patient snapshot errors return 200 with empty data

**File:** `app/api/live/patient-snapshot/route.ts:16-19`

**Problem:** Exceptions return `NextResponse.json(createEmptyLiveSnapshot(...))` with HTTP 200. The client checks `!response.ok` and never sees the error. Patient silently sees blank data.

**Fix:** Return 500 on exceptions. Reserve 200 for genuinely successful empty snapshots.

### 4.2 — No `Cache-Control: no-store` on PHI responses

**File:** `app/api/live/patient-snapshot/route.ts`

**Problem:** No cache headers. Intermediate proxies may cache PHI responses.

**Fix:** Add `Cache-Control: no-store, private` header to all patient data responses.

### 4.3 — In-memory conversation store breaks across serverless instances

**File:** `lib/ai-engine.ts:55-76`

**Problem:** The `conversations` Map is module-level. In multi-instance serverless, each cold instance starts empty. No TTL — old sessions never expire.

**Fix:** For production, persist to Redis or database. At minimum, add a per-session `lastAccessedAt` timestamp and evict sessions idle > 30 minutes.

### 4.4 — No timeout on Anthropic API calls

**File:** `lib/ai-engine.ts:238-258`

**Problem:** OpenAI calls have `timeout: 20000` but Claude calls have none. Extended-thinking can take 30-60s. A hung response holds a serverless function indefinitely.

**Fix:** Pass `{ timeout: 60000 }` as a request option, or use `Promise.race` with `AbortController`.

### 4.5 — Anonymous cache key conflates missing wallet with failed lookup

**File:** `lib/ai-engine.ts:94-105`

**Problem:** All wallet-less requests share cache key `"__anonymous__"`. A failed wallet lookup falls to the same key, potentially serving wrong context to other anonymous users within 30s TTL.

**Fix:** Don't cache failed lookups. Use a unique nonce for genuinely anonymous requests instead of a shared key.

### 4.6 — Orchestrator stores raw PHI in non-patient-scoped task descriptions

**File:** `lib/openclaw/orchestrator.ts:428-442`

**Problem:** `userMessage.slice(0, 200)` (containing symptoms, medications) is embedded in task descriptions visible via `/api/openclaw/orchestrator`.

**Fix:** Use session-reference IDs in task descriptions. Store message content only in patient-scoped conversation memory.

### 4.7 — LLM router silently swallows all errors

**File:** `lib/openclaw/router.ts:66-68`

**Problem:** `catch {}` swallows auth failures, rate limits, network errors. Falls back to keyword routing with no logging. Ops cannot distinguish intentional fallback from broken API key.

**Fix:** Log the error. Return `usedFallback: boolean` in the result for monitoring.

### 4.8 — Wallet address inputs never validated

**Files:** `app/api/openclaw/chat/route.ts:16`, `app/api/live/patient-snapshot/route.ts:11`

**Problem:** `walletAddress` from request body/query is used without format validation. Malformed values pollute cache keys or cause unexpected DB queries.

**Fix:** Validate with `/^0x[a-fA-F0-9]{40}$/` at each API boundary. Return 400 if invalid.

---

## Phase 5: UX Polish (medium severity)

### 5.1 — Chat: quick prompts fill input but don't auto-send

**File:** `app/(app)/chat/page.tsx:115-119`

**Problem:** Tapping a quick prompt button fills the text box. User must manually press Enter. This contradicts the standard quick-reply chip pattern.

**Fix:** Call `handleSend()` directly after setting the input, or submit via a ref.

### 5.2 — Chat: gateway offline but input stays enabled

**File:** `app/(app)/chat/page.tsx:233-236`

**Problem:** When `gatewayStatus === "offline"`, a tiny grey dot is shown. Chat input remains enabled. Messages will fail silently.

**Fix:** Show a banner explaining degraded mode. Optionally disable the send button with a tooltip.

### 5.3 — Chat: Agent Activity panel is permanently empty

**File:** `app/(app)/chat/page.tsx:470-479`

**Problem:** Shows "Send a message to see agents collaborate" forever. No state or effect ever populates it. A feature that never works undermines trust.

**Fix:** Either wire it to real orchestrator session data (from `/api/openclaw/orchestrator`) or remove the panel entirely.

### 5.4 — Chat: raw **bold** markdown rendered literally

**File:** `app/(app)/chat/page.tsx:336`

**Problem:** Agent messages use `whitespace-pre-line` but no markdown rendering. `**bold**` appears literally. The onboarding page strips it, but chat doesn't.

**Fix:** Use a lightweight markdown renderer (e.g., `react-markdown` with minimal plugins) or at minimum strip `**` markers like onboarding does.

### 5.5 — Dashboard: health score shows 100 for empty profiles

**File:** `app/(app)/dashboard/page.tsx:190-193`

**Problem:** `avgAdherence` defaults to 100 when there are 0 prescriptions. A user with no data sees a perfect "Good" health score.

**Fix:** Show "—" or hide the score entirely when `activeRx.length === 0`.

### 5.6 — Dashboard: future appointments shown as "Recent activity"

**File:** `app/(app)/dashboard/page.tsx:227-229`

**Problem:** Upcoming appointments appear in the "Recent activity" feed with "Upcoming" timestamps. Logically incoherent.

**Fix:** Separate upcoming appointments into their own section, or filter them out of the activity feed.

### 5.7 — Dashboard: action rail truncated with no "show more"

**File:** `app/(app)/dashboard/page.tsx:289`

**Problem:** `actionItems.slice(0, 5)` silently drops remaining items with no indicator.

**Fix:** Add a "View all X items" link when `actionItems.length > 5`.

### 5.8 — Onboarding: pharmacy auto-selected without confirmation

**File:** `app/(app)/onboarding/page.tsx:424-427`

**Problem:** Unlike PCP search (which shows 3 options), pharmacy search silently picks the first result.

**Fix:** Show at least 2-3 pharmacy options and let the user confirm.

### 5.9 — Onboarding: medication parser breaks for multi-word frequencies

**File:** `app/(app)/onboarding/page.tsx:456-457`

**Problem:** Splits on whitespace, takes last two tokens as dose and frequency. "metformin 500mg twice a day" parses as `name="metformin 500mg twice a"`, `dose="day"`, `frequency=""`.

**Fix:** Use a more robust parser — match known dose patterns (`/\d+\s*mg/i`) and frequency patterns (`/daily|twice|bid|tid|prn|weekly/i`) with regex, treat remainder as name.

### 5.10 — Mobile: body scrollable behind sidebar overlay

**File:** `components/layout/sidebar.tsx:309-314`

**Problem:** No `overflow-hidden` applied to `body` when mobile sidebar opens. Background scrolls on iOS.

**Fix:** Toggle `document.body.style.overflow = 'hidden'` when mobile sidebar opens/closes.

### 5.11 — Topbar: search keyboard navigation causes full page reload

**File:** `components/layout/topbar.tsx:147`

**Problem:** `window.location.href = item.href` instead of Next.js router. Causes a visible flash.

**Fix:** Use `router.push(item.href)` from `next/navigation`.

### 5.12 — Homepage: hero card hidden on all mobile viewports

**File:** `app/page.tsx:239`

**Problem:** `CareFlowDemo` is `hidden lg:block`. Mobile users see only text with no visual proof of the product.

**Fix:** Show a simplified version of the care flow on mobile (e.g., a horizontal step indicator or a static illustration).

### 5.13 — Homepage: `fill-amber` is not a Tailwind utility

**File:** `app/page.tsx:456`

**Problem:** Star icons use `fill-amber` which doesn't exist. Stars render as outlines.

**Fix:** Use `fill-amber-400` or define `fill-amber` in tailwind config.

---

## Phase 6: Accessibility

### 6.1 — Focus ring border-radius hardcoded to 8px

**File:** `app/globals.css:54-58`

**Problem:** `*:focus-visible { border-radius: 8px }` applies to every element. Round buttons and pills get rectangular focus rings.

**Fix:** Remove the global `border-radius` override. Let each component's own border-radius shape the focus ring, or use `outline-offset` instead.

### 6.2 — Topbar search combobox missing aria-controls and aria-label

**File:** `components/layout/topbar.tsx:173-177`

**Problem:** `role="combobox"` without `aria-controls` pointing to the listbox, and no `aria-label`. Screen readers announce it as an unlabelled combobox.

**Fix:** Add `aria-controls="search-results-listbox"` and `aria-label="Search OpenRx"` to the input. Add `id="search-results-listbox" role="listbox"` to the results container.

### 6.3 — Sidebar collapsible sections missing aria-expanded

**File:** `components/layout/sidebar.tsx:225-234`

**Problem:** Section toggle buttons have no `aria-expanded` attribute.

**Fix:** Add `aria-expanded={!!openSections[section.title]}` to each toggle button.

### 6.4 — Screening page payment input has no label element

**File:** `app/(app)/screening/page.tsx:573`

**Problem:** The "Paste transaction hash" input has only a placeholder, no `<label>`. Fails WCAG 1.3.1.

**Fix:** Add a visually hidden `<label>` or use `aria-label`.

---

## Phase 7: Developer Experience

### 7.1 — No bundle analyzer

**Fix:** Add `@next/bundle-analyzer` to devDependencies. Configure in `next.config.js`.

### 7.2 — ESLint disabled during local builds

**File:** `next.config.js:7-10`

**Problem:** `ignoreDuringBuilds: process.env.CI !== "true"` means local builds skip lint.

**Fix:** Remove the condition or flip it: only skip in CI if you have a separate lint step.

### 7.3 — Sidebar content rendered twice in DOM

**File:** `components/layout/sidebar.tsx:316-328`

**Problem:** `sidebarContent` is rendered into two `<aside>` elements (mobile + desktop), doubling DOM nodes and potentially confusing screen readers.

**Fix:** Use a single `<aside>` with responsive positioning (CSS transform on mobile, static on desktop), or use a portal for the mobile overlay.

### 7.4 — Screening page has 25+ useState calls

**File:** `app/(app)/screening/page.tsx:128-153`

**Problem:** Single component with 25+ state variables. Every state update re-renders the entire page tree.

**Fix:** Split into sub-components: `ScreeningForm`, `PaymentGate`, `ScreeningResults`. Or consolidate into a single `useReducer`.

### 7.5 — Dead CSS classes

**File:** `app/globals.css`

**Problem:** `.nav-active-bar`, `.surface-dark`, `.section-dark`, `.bg-mesh-dark`, `.dot-grid-dark`, `.bg-gradient-hero-dark` are defined but never used.

**Fix:** Remove them, or document them as reserved for an upcoming dark mode feature.

---

## Execution Order

1. **Phase 1** (security) — immediate, before any public traffic
2. **Phase 2** (critical UX) — same sprint, these break real user flows
3. **Phase 4** (API correctness) — same sprint, data integrity issues
4. **Phase 3** (performance) — next sprint, measurable bundle/latency wins
5. **Phase 5** (UX polish) — next sprint, quality-of-life improvements
6. **Phase 6** (accessibility) — parallel with Phase 5
7. **Phase 7** (DX) — ongoing maintenance
