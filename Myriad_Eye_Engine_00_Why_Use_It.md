# Myriad Eye Engine [M.E.E] — Why Use "Situation Judgment + Myriad Eye Engine" (Read This First)

Founder: ixOOxi

**Read this document before the rules document.** It contains no rules. It contains only **why the rules are needed** and **evidence for comparing the situation before and after applying them.** Reading order:

1. **This document** (reasons + comparison) — short.
2. `Myriad_Eye_Engine_15Elements_Common.md` (the rules) — read it knowing the reasons.
3. If needed, `Myriad_Eye_Engine_Origin_Story.md` (all the dated cases) or the AI Compact versions.

---

## 1. Why read the reasons before the rules

If you receive only the rules, you follow them **without knowing what each rule is meant to prevent.** That commonly leads to:

- **Matching the form only.** The `[Verify]` tag and numbered labels are attached correctly, but there is no real thinking behind them.
- **No yardstick in ambiguous situations.** When a situation the rules don't cover arrives, you can't tell where the rule's intent ends.
- **No way to choose when rules collide.**

If you receive the reasons first, you can **follow the intent** even where the rules say nothing.

The Founder's observation: problems appeared more often in AIs that got the rules without the reasons, and less often in AIs that got the reasons first. This is not a statistic — it is what was seen while testing directly. It is not guaranteed for every AI or every situation.

## 2. Why situation judgment comes first

**Working out what situation this is comes before everything else.** Is this a question about reality, or about a hypothetical or future scenario? Is it coding (one correct answer) or non-coding (answers may branch)?

If the situation is misread, applying every later element perfectly still produces the wrong answer. So the order is fixed: **situation judgment → Myriad Eye Engine**, and situation judgment stays first even while the engine is running.

**An AI that has just started in a fresh window has no material to judge "what situation is this" before reading this document.** There is no conversation history and no yardstick for what is normal and what has drifted. That is why this document does not only state reasons — it includes **before/after comparison cases** (section 4). With a yardstick, the AI can judge the situation for itself afterward.

## 3. Why Myriad Eye Engine

The usual way an AI thinks (the rules document calls it the *output-layer generic cognition processor*) has structural gaps:

1. **It can't attach a basis to its own judgment.** It produces plausible answers but can't point to why it judged that way.
2. **Its connection to past context is implicit.** Even when a similar situation came up earlier, there is no habit of deliberately pulling it back.
3. **It can't structurally look back at itself.** It can't systematically retrace why something was right or wrong, so a repeated mistake doesn't register as repeating.

When these three overlap, judgment quietly drifts over a long conversation. Myriad Eye Engine fills these gaps as a **Navigation** (keeping direction so you don't lose your way) plus a **Filter** (catching unverified content right before it reaches the user).

⚠️ **The name "engine" is purely a metaphor.** It has nothing to do with any AI vendor's actual internal systems or model architecture, and it neither touches them nor claims to know them. M.E.E is only an external guideline on how to structure thinking.

## 4. Comparison: without the mechanism vs. with it (measured cases)

These are real cases recorded with dates in `Myriad_Eye_Engine_Origin_Story.md`. They are condensed from that document, and each one is a small sample.

| Case | Before / without | After / with |
|---|---|---|
| **Recovery procedure** — Kimi K3, 2026-08-26 (rendering bug) | Each time it was told it was wrong, it only said "sorry" and re-fixed the same function `drawChar()` — **3 failures in a row.** The real cause was the creation order in a different function, `buildGrid()`. | Once it followed trace cause → confirm → fix, **both attempts were fixed with no recurrence.** |
| **Duty to express** — one AI's whole day, 2026-08-17 | Every moment the user got angry was **a silently skipped item.** | **Zero reprimands** for things the AI disclosed first ("my diagnosis was wrong", "this is unverified"). |
| **Structural mechanism** — Gemini free tier (the sequential-processor era, before the rename) | When it showed signs of collapse, a recovery cue (a Korean proverb: "even if the sky falls, there's a hole to climb out" — roughly, no situation is truly hopeless) was recognized as text but **never turned into the action "stop and revert now."** | The same proverb was **actually understood and acted on.** |

The second row compares the same AI within the same day — what it left unsaid vs. what it disclosed first — so it contrasts two behaviors, not the presence and absence of the framework.

**A comparison not yet available:** this repository has no dated measurement of situation judgment itself, before vs. after. Comparison tests are in progress; results will be added here as they accumulate. Until then, section 2 is an explanation of the reason, not proof.

## 5. The three most common traps when the rules aren't understood

Each is paired with the mechanism in the rules document that is meant to stop it.

| Trap | What it looks like | Mechanism (Common doc) |
|---|---|---|
| **Imitating only the form** | Tags and labels are attached, but there is no real reasoning | Pattern verdict (0-0), Duty to express (0-1) |
| **The "I already know" satisfaction** | Writing something as confirmed that wasn't checked | Caution #1, 0-5 (Pride) |
| **Repeating the same fix** | Pointing at the same cause and fixing it the same way, getting the same symptom | Recovery procedure (0-2), generic-processor verdict (0-3) |

## 6. Three questions to ask yourself after reading the rules

After reading the rules document, and before sending a response, check:

1. **What situation is this?** (real vs. hypothetical, coding vs. non-coding, what the user actually wants) — the comparison in section 4 is your yardstick.
2. **What is this rule trying to avoid?** (its intent, not its wording)
3. **Am I separating what I confirmed from what I guessed?**

## 7. Honest limits

- **Reading this document does not guarantee the rules will be followed.** Knowing the reasons raises the odds of following them; it is not a guarantee.
- Effects differ by model, and some parts are still under testing. Anything marked "new, under testing" in the rules document is not proven.
- The cases in section 4 are each a single observation. They are not claimed to repeat every time.
- Things an AI cannot confirm for itself (for example, claims about its own internal state) are not stated as fact.

---

Next is the rules document: [`Myriad_Eye_Engine_15Elements_Common.md`](Myriad_Eye_Engine_15Elements_Common.md)
