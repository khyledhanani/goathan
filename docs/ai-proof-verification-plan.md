# AI Proof Verification — Engineering Plan

Use cheap vision-LLM inference to score every uploaded proof photo against the task definition. Output: a confidence score + one-line reasoning, displayed as a small badge on the receipt and stored for later analysis. Aggressive cost engineering throughout: no fixed-fee infrastructure, no monthly minimums, free tier first.

This document is structured for engineering review (à la `push-notifications-plan.md`).

---

## 1. Goals & non-goals

### Goals
- For every verified completion, get a vision-model verdict: *does this photo plausibly show the user completing this task?*
- Surface the verdict to humans as a soft signal, never as an automated revoke.
- **Cost scales linearly with usage; zero fixed-fee infrastructure.** No always-on inference servers, no monthly minimums.
- **Free at small scale** (single-digit friend groups). Pennies at 10× scale. Single-digit dollars at 100× scale.
- Privacy: photos go to one vetted third party with a "no training" data policy. EXIF already stripped at upload time.
- Resilience: API failures don't break the user's flow. Verification is a side effect, not a gate.

### Non-goals
- Replace Call Cap. The social policing layer stays load-bearing.
- Automated revocation. AI confidence too unreliable to be a verdict on its own; humans still decide.
- Real-time verification before verify-complete. Verification runs async after `attachProof`.
- Adversarial fraud detection. We're not trying to catch professional cheaters — just the lazy "post a random photo" cases.
- Multi-modal beyond images. Videos out of scope for v1.
- OCR-only pipelines. Modern vision APIs handle OCR inline.

---

## 2. What "verification" means per task type

Each task has a `name`, `description`, and `proof` type (PHOTO / SCREENSHOT / VIDEO). The AI evaluates whether the uploaded image *plausibly evidences* completion of that specific task.

| Task example | What good evidence looks like | Easy/hard for vision LLM |
|---|---|---|
| Make your bed | Made bed visible, blanket smooth | Easy |
| Workout or gym | Gym equipment, weights, mid-exercise scene | Easy |
| Morning sunlight | Outdoor scene with daylight | Easy-ish (timestamp ambiguous) |
| 10k steps | Screenshot of step counter with ≥10k visible | OCR — easy for top providers |
| Protein 1g per lb | Screenshot of food-log app with daily total | OCR + interpretation |
| Read or journal | Open book, handwritten page | Easy |
| Seven hours sleep | Screenshot of sleep tracker | OCR |
| Mobility or stretch | Person stretching, yoga mat | Easy |
| Home-cooked meal | Plate of home food, kitchen context | Easy |
| PR or weight target | Person on scale, lift video frame, log entry | Hard — most ambiguous |

The model produces a three-bucket verdict:

- **PASSED** — high confidence the image shows what it claims (≥0.7)
- **INCONCLUSIVE** — ambiguous; could be either way (0.3–0.7)
- **FAILED** — high confidence the image doesn't match (<0.3) or is a clear placeholder

Plus an optional `flags` array — short tags like `reused_photo_suspected`, `screenshot_of_screen`, `low_quality`, `time_mismatch_possible`.

---

## 3. Provider selection & cost analysis

### Free tier options (preferred default)

**Google Gemini 2.5 Flash** (recommended)
- Free tier: **1,500 requests/day** on the Generative Language API. No credit card.
- Paid tier: ~$0.10/M input image tokens; per image ~$0.00005–0.0002 depending on resolution.
- Data policy: paid tier API requests not used for training; free tier *may* be used unless on AI Studio with the right account setting. **Important caveat — verify before launch.**
- JSON-mode native. Good at structured output.

**Cloudflare Workers AI** (`@cf/meta/llama-3.2-11b-vision-instruct`)
- Free tier: 10k neurons/day on Workers, vision is ~1 neuron per inference. Effectively free for our scale.
- Smaller model — quality below Gemini/GPT-4o, but adequate for "is this plausibly a gym."
- Requires Cloudflare account but no card.

### Paid-but-cheap fallback

**OpenAI GPT-4o-mini, `detail: "low"`**
- ~85 input tokens per image regardless of resolution.
- Pricing: $0.15/M input tokens, $0.60/M output. Per image ~$0.00001.
- 100,000 verifications = $1.
- Data policy: not used for training (API tier, default since 2023).
- JSON-mode native.

### Quality-first (not the cost play)

**Anthropic Claude Haiku 4.5**
- ~$1/M input tokens, $5/M output.
- Per image ~$0.0008–0.0015 depending on resolution.
- Best vision reasoning of the three.
- Data policy: never trained on API data.
- Would consider for high-stakes verifications later; overkill for v1.

### Recommended stack

**Primary:** Gemini 2.5 Flash on the free tier. Free up to 1,500/day.

**Fallback (when Gemini rate-limits or errors):** GPT-4o-mini, low detail.

Both are wired via the same provider-agnostic action; switching is a config flag.

**Hard rule for v1: do NOT use Claude as the default.** Cost differential is 100×+ for marginal quality gain on this task.

### Cost curve

Assume per-verification cost: $0 within free tier, $0.00001 with GPT-4o-mini low.

| Active daily users | Verifications / day (5 per user) | Monthly | Free-tier covers? | Paid cost |
|---|---|---|---|---|
| 10 | 50 | 1,500 | Yes | **$0.00** |
| 100 | 500 | 15,000 | Yes | **$0.00** |
| 300 | 1,500 | 45,000 | Right at ceiling | **$0.00** |
| 1,000 | 5,000 | 150,000 | 1,500/day covered, 3,500/day overflow | **~$1.05/month** |
| 10,000 | 50,000 | 1.5M | 45k covered, 1.455M overflow | **~$14.55/month** |

For your actual scale (handful of friend groups), this is unconditionally free for the foreseeable future.

### Important: Gemini free-tier data caveat

Google's free-tier API has historically used inputs for service improvement *unless* on a paid tier or specific account configuration. As of late 2025 they've tightened this — verify in the AI Studio dashboard before launch and document the setting. If we can't get a clean no-training guarantee on free tier, fall back to:
1. Gemini paid tier at $0.0001/image (still very cheap), or
2. GPT-4o-mini low detail (cheapest with clear no-training default)

This is the *one* place the "free" story gets footnotes. Track the setting in env or docs.

---

## 4. Architecture

```
attachProof mutation
   │
   ├── patches completion.verifiedAt + proofStorageId         (existing)
   └── scheduler.runAfter(0, internal.aiVerify.checkProof, ...)
                                                                │
                                                                ▼
                                          ┌────────────────────────────────────┐
                                          │  internal action (Node runtime)    │
                                          │                                    │
                                          │  1. claim proofVerifications row   │
                                          │  2. fetch image bytes from storage │
                                          │  3. (optionally) resize / re-encode│
                                          │  4. call vision API (Gemini)       │
                                          │  5. parse JSON verdict             │
                                          │  6. complete row + cost ledger     │
                                          │  7. (optional) enqueue notification│
                                          │     if FAILED + high confidence    │
                                          └────────────────────────────────────┘
```

Same invariants as push notifications:

- The action runs as a side effect of the mutation. Mutation commits regardless.
- One `proofVerifications` row per `completionId`. Idempotent — re-running the action with a completed row is a no-op.
- Failure of the AI call doesn't block the user's verify flow.
- All cost-tracking fields stored per call for analytics.

---

## 5. Schema

```ts
proofVerifications: defineTable({
  completionId: v.id("completions"),
  status: v.union(
    v.literal("PENDING"),
    v.literal("PASSED"),
    v.literal("INCONCLUSIVE"),
    v.literal("FAILED"),
    v.literal("ERROR"),
  ),
  confidence: v.optional(v.number()),        // 0.0 - 1.0
  reasoning: v.optional(v.string()),         // one short sentence
  flags: v.optional(v.array(v.string())),    // short tags

  // Provider / model trace
  provider: v.string(),                      // "gemini" | "openai" | "cloudflare"
  model: v.string(),                         // e.g. "gemini-2.5-flash"

  // Cost tracking (cheap to store, valuable to have)
  inputTokens: v.optional(v.number()),
  outputTokens: v.optional(v.number()),
  estimatedCostUsd: v.optional(v.number()),  // best-effort, never trusted
  durationMs: v.optional(v.number()),

  errorMessage: v.optional(v.string()),

  startedAt: v.optional(v.number()),         // soft claim — stale > 60s allowed to retry
  completedAt: v.optional(v.number()),       // final re-entry gate (mirrors push pattern)
  createdAt: v.number(),
})
  .index("by_completion", ["completionId"])
  .index("by_status_created", ["status", "createdAt"]);
```

Field invariants:

- One row per `completionId`. Enforced by an existence check at the top of the action.
- `startedAt` / `completedAt` mirror the dispatch pattern from `notifications` — claim-with-timeout, then complete. Stale claim (>60s, no completion) is retryable.
- `confidence` and `reasoning` populated only on `PASSED` / `INCONCLUSIVE` / `FAILED`. On `ERROR`, `errorMessage` is set.
- `flags` is short (≤4 tags); model is prompted to return at most a few.

### Optional sidecar (Phase 2): image-hash dedup

```ts
proofImageHashes: defineTable({
  hash: v.string(),                          // sha-256 of the upload bytes
  firstCompletionId: v.id("completions"),    // who uploaded it first
  taskName: v.string(),                      // for dedupe across tasks
  createdAt: v.number(),
})
  .index("by_hash", ["hash"]);
```

If the same image hash is uploaded again — even for the same task — that's almost certainly a reused photo. Flag it. Cost: one extra index lookup; no extra API call.

---

## 6. Trigger flow

### In `attachProof` mutation

Append after the existing `await ctx.db.patch(completion._id, { proofStorageId, verifiedAt: now })`:

```ts
await ctx.scheduler.runAfter(0, internal.aiVerifyAction.checkProof, {
  completionId,
});
```

### In `internal.aiVerifyAction.checkProof` (Node runtime)

```ts
export const checkProof = internalAction({
  args: { completionId: v.id("completions") },
  handler: async (ctx, { completionId }) => {
    // 1. existence check + claim
    const claim = await ctx.runMutation(
      internal.aiVerify.claim,
      { completionId },
    );
    if (!claim.ok) return;

    try {
      // 2. fetch context
      const ctx2 = await ctx.runQuery(internal.aiVerify.getContext, {
        completionId,
      });
      if (!ctx2) {
        await ctx.runMutation(internal.aiVerify.recordError, {
          completionId,
          error: "context not found",
        });
        return;
      }
      if (!ctx2.proofUrl) {
        await ctx.runMutation(internal.aiVerify.recordError, {
          completionId,
          error: "proof url missing",
        });
        return;
      }
      if (ctx2.revokedAt) {
        // Receipt was revoked before AI got to it — don't burn an API call
        await ctx.runMutation(internal.aiVerify.recordError, {
          completionId,
          error: "revoked before verification",
        });
        return;
      }

      // 3. fetch image bytes
      const resp = await fetch(ctx2.proofUrl);
      if (!resp.ok) throw new Error(`image fetch ${resp.status}`);
      const imageBytes = new Uint8Array(await resp.arrayBuffer());

      // 4. call vision provider (Gemini first, fallback if rate-limited)
      const t0 = Date.now();
      const result = await callVisionProvider(imageBytes, ctx2);

      // 5. write verdict
      await ctx.runMutation(internal.aiVerify.complete, {
        completionId,
        status: result.status,
        confidence: result.confidence,
        reasoning: result.reasoning,
        flags: result.flags,
        provider: result.provider,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        estimatedCostUsd: result.estimatedCostUsd,
        durationMs: Date.now() - t0,
      });
    } catch (err) {
      await ctx.runMutation(internal.aiVerify.recordError, {
        completionId,
        error: String(err).slice(0, 200),
      });
    }
  },
});
```

`callVisionProvider` is the provider-agnostic dispatcher:

```ts
async function callVisionProvider(
  imageBytes: Uint8Array,
  task: TaskContext,
): Promise<VerifyResult> {
  const provider = process.env.AI_VERIFY_PROVIDER ?? "gemini";
  switch (provider) {
    case "gemini": return callGemini(imageBytes, task);
    case "openai": return callOpenAi(imageBytes, task);
    case "cloudflare": return callCloudflare(imageBytes, task);
    default: throw new Error(`unknown provider ${provider}`);
  }
}
```

Phase 1 ships Gemini only. The dispatcher and switch land in Phase 2.

---

## 7. Prompt design

Tight, low-token, JSON-output. Both Gemini and GPT-4o-mini support JSON-mode natively — use it.

### System / instruction

```
You are evaluating a fitness/habit accountability photo for an app called Receipts.
Members upload a proof image and you decide whether it plausibly shows them
completing the claimed task.

You are a soft signal, not a judge. Be charitable but not gullible.
Common red flags: stock-image look, screenshot of a screenshot, generic
landscape with no relevant subject, the same photo reused across tasks.

Respond with strict JSON matching this schema:
{
  "match": boolean,
  "confidence": number,         // 0.0 to 1.0
  "reasoning": string,          // one short sentence
  "flags": string[]             // optional short tags, max 4
}
```

### Per-call user prompt

```
Task: {taskName}
{taskDescription ? `Description: ${taskDescription}` : ""}
Proof type expected: {proofType}    (PHOTO | SCREENSHOT | VIDEO)

Image attached.
```

Token budget:
- System: ~120 tokens
- User: ~30 tokens
- Image (Gemini Flash): ~258 tokens for 768×768 (typical resize target)
- Output: ~80 tokens
- **Total: ~490 tokens per call.**

At Gemini paid rates ($0.10/M input, $0.40/M output), this is ~$0.00007/call. Free tier covers it.

### Output parsing

JSON-mode guarantees parseable output. We still validate:

- `match` is boolean
- `confidence` is finite, clipped to [0, 1]
- `reasoning` is string, truncated to 200 chars
- `flags` is array of strings, each ≤32 chars, max 4 entries

Map to status:

```
confidence >= 0.7 && match     → PASSED
confidence >= 0.7 && !match    → FAILED
otherwise                      → INCONCLUSIVE
```

---

## 8. Image preprocessing (cost lever)

Vision tokens scale with resolution. Cheap and easy win: resize before sending.

### Client side (preferred — saves bandwidth too)

Already have `lib/upload.ts` that re-encodes via `createImageBitmap` for EXIF normalization. Add a `maxDim` param:

```ts
const MAX_PROOF_DIM = 1024;
const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
const scale = Math.min(1, MAX_PROOF_DIM / Math.max(bitmap.width, bitmap.height));
const w = Math.round(bitmap.width * scale);
const h = Math.round(bitmap.height * scale);
// draw to canvas of size (w, h), export JPEG quality 0.85
```

This caps storage size, mobile upload bandwidth, AND vision token cost in one pass.

### Server side (defensive backstop)

In the AI action, if the fetched image is > 800 KB or > 1024px, downscale before sending. Uses `Sharp` (Node runtime, ~5MB cold-start cost) or skip if hot. Phase 2.

For Phase 1: trust the client. We control the upload pipeline.

---

## 9. UI integration

### Receipt cards (feed, activity, profile grid)

Small inline badge near the points line:

- **AI ✓** in muted green — `PASSED`
- **AI ⚠** in amber — `INCONCLUSIVE` or has flags
- **AI ✗** in brick — `FAILED`
- **AI …** in fog — `PENDING` (verification in flight)
- nothing — `ERROR` or row pre-dates the feature

Tap badge → small popover with:
- Confidence (e.g. "82% confident")
- Reasoning sentence
- Flags if any

### Settings (`/settings` → notifications card or new "AI" section)

- Show count of your own verifications (PASSED / INCONCLUSIVE / FAILED).
- Disclosure text: "Photos are sent to {provider name} for verification. They do not train on this data."
- No per-user opt-out for v1 — verification is part of the proof system. If asked, add later.

### What AI does NOT do in v1

- Trigger a notification on `FAILED`
- Auto-call-cap
- Auto-revoke

These are interesting Phase 3 ideas but out of scope. AI is a *signal display* in v1.

---

## 10. Failure modes & edge cases

| Scenario | Behavior |
|---|---|
| Vision API down | Action throws; `ERROR` row inserted; receipt still shows normally without badge |
| Vision API rate limit (Gemini 429) | Caught explicitly; Phase 2 fallback to OpenAI; Phase 1 just records error |
| Image fetch from Convex storage fails | Same — `ERROR`, no badge |
| Receipt revoked before AI runs | Action exits early without burning an API call |
| User uploads then immediately removes proof | `removeProof` should also schedule a `proofVerifications.discard` (Phase 2 cleanup) |
| Same image hash uploaded twice | Phase 2 dedup table; v1 has no dedup |
| Model returns malformed JSON | Parser fails; row recorded as `ERROR` with truncated raw output |
| Convex action retry fires twice | Second call sees `completedAt` set → no-op. Mirrors push pattern. |
| Network slow → action exceeds 60s | Action killed; `startedAt` set but `completedAt` not. Next manual replay or scheduled sweep retries. |
| API key missing / misconfigured | All calls fail with explicit error; UI gracefully shows no badge |

### Failure budgets

A receipt with no AI verification (any error path) shows no badge. The product still works. This is the load-bearing safety property — AI is additive, never gating.

---

## 11. Cost controls

Layered defenses against cost surprises:

### 1. Free tier first
Gemini free tier (1,500 RPD) is the default provider. Hard cap.

### 2. Daily cost cap
A simple cron checks total `estimatedCostUsd` over the last 24h. If it exceeds a configured ceiling (e.g. $5), flips a feature flag that skips new verifications. Self-protect.

```ts
// Phase 2:
crons.cron("ai cost watchdog", "*/15 * * * *", internal.aiVerify.costWatchdog, {});
```

### 3. Per-user throttle
Soft cap of ~10 verifications per user per hour. Burst above this skips verification (mark `ERROR` reason `rate_limited`). Prevents a stuck-loop bug from racking up calls.

### 4. Image-hash dedup (Phase 2)
Same hash within 24h → copy previous verdict. No API call.

### 5. Skip revoked
Already covered: if completion was revoked before AI runs, skip.

### 6. Skip dev / test
`AI_VERIFY_ENABLED=true` env flag. Off in dev/local Convex.

---

## 12. Privacy & data flow

### What gets sent to the third party

- Image bytes (already EXIF-stripped at upload time per `lib/upload.ts`)
- Task name + description (plain text, no PII)
- Nothing about the user — no userId, no displayName, no email

### Data retention

- Gemini paid tier: not used for training; retained ≤30 days for abuse review
- GPT-4o-mini (API): not used for training; retained 30 days
- Free-tier Gemini: footnote — must verify the no-training opt-out is set per provider docs at launch time

### Disclosure

Add to onboarding (one line) and `/settings` (longer):

> Proof photos are sent to our AI verification service to score how well they match the task. The service doesn't train on these images and deletes them within 30 days.

### What we don't do

- No facial recognition
- No identity matching across users
- No long-term retention beyond Convex storage
- No third-party data sales

---

## 13. Phased rollout

### Phase 1 (this commit's scope)
- Schema: `proofVerifications` table
- `aiVerify.ts` module (queries / claim / complete / record-error helpers)
- `aiVerifyAction.ts` Node runtime action (Gemini only)
- Hook into `attachProof` mutation
- Receipt badge on feed cards and activity feed
- Tap → reasoning popover
- Env var: `GEMINI_API_KEY`, `AI_VERIFY_ENABLED`
- Cost tracking columns populated

### Phase 2
- Image-hash dedup table
- Daily cost cap watchdog cron
- Per-user throttle
- OpenAI fallback path
- Server-side image resizing as defensive backstop
- Display badge in profile grid + receipt detail

### Phase 3
- AI as automatic capper at very low confidence (`FAILED` + flags include `reused_photo`)
  - Inserts a `challenges` row with a special `challengerKind: "AI"`
  - Counts toward majority? Maybe with a discount weight. Open design question.
- Push notification when YOUR receipt gets AI-flagged
- "Why did AI flag this?" link to a help page

### Phase 4 (only if scale demands)
- Self-hosted small vision model (LLaVA / Llama 3.2 Vision / Moondream) on a serverless GPU
- Only worth it past ~$50/month spend (which we won't hit for a long time)

---

## 14. Open questions for review

1. **Is INCONCLUSIVE the right middle bucket name?** Could be UNCERTAIN, NEEDS_REVIEW, etc. Tag matters for the UI.
2. **Should AI's verdict ever feed into the leaderboard?** v1 says no. If `FAILED` becomes very high precision, could auto-discount points by 50% or treat it as an extra cap.
3. **WEEKLY tasks (e.g. "PR or weight target") — should AI even try?** These often have ambiguous proof. Maybe skip AI for WEEKLY tasks entirely in v1.
4. **What if Gemini free-tier no-training opt-out isn't available?** Fall back to OpenAI by default, accept ~$1/month at scale. Probably the safer launch posture.
5. **Should we let admins customize the prompt per task?** Some groups might define "workout" loosely vs. strictly. Probably overengineering for v1; revisit if asked.
6. **Caching by image hash within a single user — yes/no?** Same user uploads same photo for same task twice (rare): the dedup table saves an API call. Confirms reused-photo behavior. Cheap to add.
7. **How visible is the badge to non-owner viewers?** v1 plan shows it to everyone. Could be owner-only at first while we tune. Owner-only Phase 1, public Phase 2 might be safer rollout.

---

## 15. Estimated effort

| Workstream | Estimate |
|---|---|
| Schema + helpers + claim/complete pattern | 2h |
| Gemini provider client + prompt + JSON parsing | 3h |
| Action wiring + error handling + cost tracking | 2h |
| Hook into `attachProof` mutation | 1h |
| Badge UI on feed cards | 2h |
| Tap-for-reasoning popover | 2h |
| Activity feed badge + profile grid badge | 2h |
| Settings disclosure + opt-out (if scope) | 1h |
| Manual testing across PHOTO/SCREENSHOT/VIDEO tasks | 2h |
| Env vars on Convex (dev + prod) + Vercel | 30m |
| **Total** | **~17h, ≈2 working days** |

---

## Appendix A — Env vars

| Var | Where | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Convex env (dev + prod) | Free at aistudio.google.com |
| `AI_VERIFY_PROVIDER` | Convex env | `"gemini"` for v1; switch to `"openai"` if needed |
| `AI_VERIFY_ENABLED` | Convex env | `"true"` in prod, leave unset in local dev |
| `OPENAI_API_KEY` | Convex env (Phase 2) | Only when fallback is wired |

## Appendix B — Sample provider request (Gemini)

```ts
const url =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

const body = {
  contents: [
    {
      role: "user",
      parts: [
        { text: SYSTEM_PROMPT + "\n\n" + userPrompt },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image,
          },
        },
      ],
    },
  ],
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: {
      type: "object",
      properties: {
        match: { type: "boolean" },
        confidence: { type: "number" },
        reasoning: { type: "string" },
        flags: { type: "array", items: { type: "string" } },
      },
      required: ["match", "confidence", "reasoning"],
    },
    maxOutputTokens: 200,
    temperature: 0.2,
  },
};

const resp = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const json = await resp.json();
const parsed = JSON.parse(json.candidates[0].content.parts[0].text);
```

---

## Appendix C — Cost-tracking math

For ops dashboards. Per Gemini call:

```
estimatedCostUsd =
  (inputTokens / 1_000_000) * INPUT_PRICE_USD_PER_M +
  (outputTokens / 1_000_000) * OUTPUT_PRICE_USD_PER_M
```

Prices (Gemini 2.5 Flash, late 2025 / Q1 2026):
- INPUT: $0.10 per 1M tokens
- OUTPUT: $0.40 per 1M tokens
- Image tokens are billed as input tokens

For free-tier calls, `estimatedCostUsd = 0` regardless. Useful to leave the math in place — flipping to paid is a single env var change.
