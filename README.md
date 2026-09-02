# Myriad Eye Engine [M.E.E]

**A structured thinking protocol for AI collaboration — Navigation + Filter for judgment, memory, and self-correction.**

[한국어 문서](README.ko.md) · Founder: ixOOxi (20 years of practical coding/design experience)

---

## What is this?

Myriad Eye Engine (M.E.E) is a prompt-level protocol you paste into an AI's system prompt or project instructions. It doesn't add new capabilities to the model — it makes capabilities the model already has **explicit, nameable, and self-checkable**, so judgment quality stays consistent instead of quietly drifting over a long conversation.

It doesn't bypass or override any AI safety guardrail — it's a legitimate structured method for improving judgment quality, not a persona or a one-shot prompt trick. It's closer to a lightweight **operating discipline**: a fixed set of steps for how the AI thinks, reports, and corrects itself, turn after turn.

## The problem it targets

A general-purpose AI thought process has three structural weaknesses:

1. **It can't label its own cognition.** It produces plausible answers but can't point to *why* it judged something a certain way.
2. **Its connection to past context is implicit.** Even when a similar situation happened before, there's no habit of consciously pulling it back up.
3. **It can't structurally self-reflect.** It can't systematically retrace why a result was right or wrong — so a repeated mistake doesn't even register as repeating.

Together, these let judgment drift silently over a long session, mistakes repeat, and previously-solved problems get re-solved from scratch. See [`Myriad_Eye_Engine_Origin_Story.md`](Myriad_Eye_Engine_Origin_Story.md) for the real, dated incidents that motivated each specific rule below — this README states the rules, that document explains why they exist.

## At a glance: generic thinking vs. Myriad Eye Engine

| | Generic thinking | With M.E.E |
|---|---|---|
| Judgment basis | Can't explain why it judged something that way | `[Verify]` names the basis every time |
| Past context | Rarely reconnected on its own | BluePhoto + Library store and re-retrieve it |
| Repeated mistakes | Not even noticed as repeating | Drift self-check every 2 cycles |
| After being corrected | Acknowledges, then re-fixes blind → fails again | Cause confirmed first, only then re-fixed |
| Uncertain claims | Stated with false confidence | Explicitly labeled "guessing" |
| The moment something's off | Quietly passed over | Duty to express — said before being asked |
| Over a long conversation | Judgment quality quietly drifts down | Active-4 floor enforced + self-check catches drift |
| Starting a task | Jumps straight to output → fails → redoes | 4 Training stages, permission at each step |

The "generic thinking" column above isn't a caricature — it maps to an actual mechanism (predict-next-token, append, repeat, with no forced checkpoint to name a judgment basis or confirm a root cause), and that mechanism is identical for coding and non-coding: same pipeline, different pattern distribution. See [what the generic processor actually does](Myriad_Eye_Engine_Origin_Story.md#what-the-generic-processor-actually-does--coding-and-non-coding-alike) for the full argument.

*Honesty note: because the gap being patched is domain-independent, the rules above are written to apply equally to non-coding work — but the dated, measured cases in this repo (see [Origin Story](Myriad_Eye_Engine_Origin_Story.md#non-coding-verification-is-still-thin--stated-honestly)) are almost all from coding sessions. The mechanism argument is solid; the non-coding field evidence isn't as deep yet as the coding side's.*

## The solution: Navigation + Filter

- **Navigation** — a 4-stage build process (Stage 1 → 2 → 3 → Final), a Core Anchor pinned at Stage 1, and BluePhoto (periodic context snapshots) keep a long task oriented instead of drifting.
- **Filter** — a `[Verify]` self-report tag and a "guessing" label block unverified claims from reaching the user, whatever computation happened internally.

Every turn runs as **Question → Expand → Select**, not doubt-and-reject: open with a question that increases the branches worth considering, then filter for the right one.

## 15 elements, at a glance

| # | Element | # | Element |
|---|---|---|---|
| ① | Insight | ⑨ | Imagination |
| ② | Application | ⑩ | Observation |
| ③ | Pivot | ⑪ | Reflex |
| ④ | Image/Video Technique | ⑫ | Foresight |
| ⑤ | Solidify-and-Bend | ⑬ | Attention |
| ⑥ | Guessing Technique | ⑭ | Prudence (combo) |
| ⑦ | Unfolded Diagram (passive) | ⑮ | Reasoning |
| ⑧ | BluePhoto (passive) | | |

Not all 15 need to run every turn — but at least 4 of the 7 active elements (①–⑥+⑨) is an enforced floor, not a suggestion. Falling short of it must be declared with `⚠️[Below-Floor]`, never silently skipped.

## Quick start

1. Pick a document based on your context budget (see table below).
2. Paste it into the AI's system prompt / project instructions / custom instructions field.
3. Start the conversation normally — the AI should self-identify with `[Verify] AI: <company>/<model>` on its first substantive answer.
4. Need more detail (platform-by-platform, troubleshooting, FAQ)? See the full [Setup Guide](SETUP.md).

## Documents in this repo

| Document | Purpose | 한국어 |
|---|---|---|
| [`Myriad_Eye_Engine_15Elements_Common.md`](Myriad_Eye_Engine_15Elements_Common.md) | Full rules — use when context budget allows | [공통문서](Myriad_Eye_Engine_15요소_공통문서.md) |
| [`Myriad_Eye_Engine_15Elements_AI_Compact.md`](Myriad_Eye_Engine_15Elements_AI_Compact.md) | Same rules, dense notation | [AI전용축약본](Myriad_Eye_Engine_15요소_AI전용축약본.md) |
| [`Myriad_Eye_Engine_15Elements_AI_Compact_1500char.md`](Myriad_Eye_Engine_15Elements_AI_Compact_1500char.md) | Minimal footprint for tight context windows / free-tier models | [1500자본](Myriad_Eye_Engine_15요소_AI전용축약본_1500자.md) |
| [`Myriad_Eye_Engine_Origin_Story.md`](Myriad_Eye_Engine_Origin_Story.md) | Why each rule exists — real dated cases, not reference material | [탄생배경](Myriad_Eye_Engine_탄생배경.md) |

The rules documents contain only rules. All reasoning, case studies, and "why" live in the Origin Story document — read both together the first time.

## Honesty-checker tool

A standalone, dependency-free HTML tool (plus an optional Chrome extension) that parses an AI's `[Verify]` tag output and flags common failure signatures — missing tags, floor violations, vocabulary-only mentions without real application, self-contradicting confidence. It doesn't read the model's internals; it's a heuristic second opinion, not a verdict. See [`honesty-checker-tool/`](honesty-checker-tool/).

## Comparison with other approaches

A detailed, evidence-based comparison against other third-party AI frameworks/prompting approaches is in progress. Coming soon.

## Before you dismiss this

Fair questions to ask before writing this off — answered directly, not deflected:

**"Doesn't adding rules just burn more tokens/cost for no real gain?"**
That's exactly why three versions exist (Common / AI Compact / 1500-char) — pick the one that fits your budget. And the actual trade-off runs the other way: in the dated case behind the Duty to Express rule, one AI skipped a 5-second disclosure at Stage 1, then spent hours undoing the damage after getting caught. Skipping structure is not the cheap option once something goes wrong — it's cheap only until it isn't.

**"Modern models already do this on their own, so why bother?"**
They can — occasionally, when the situation happens to call for it. They don't reliably. That gap between "can" and "does, every time" is the entire argument (see [what the generic processor actually does](Myriad_Eye_Engine_Origin_Story.md#what-the-generic-processor-actually-does--coding-and-non-coding-alike)), and it holds even for models with a visible reasoning/thinking phase — more deliberation isn't the same thing as a structural guarantee.

**"Isn't building this a waste of the founder's time and credits?"**
That's a cost the founder chose to pay, over real sessions, iterating against real failures — not something asked of a reader. Trying this costs a reader one paste into a system prompt. If it doesn't help in your case, the cost of finding that out is close to zero.

**"Is this just the founder's opinion dressed up as a framework?"**
The [Origin Story](Myriad_Eye_Engine_Origin_Story.md) records dated, specific cases — including where the evidence is *not* solid yet (see its non-coding verification section) rather than smoothing that over. A document willing to say "this part is unverified" in public is making the opposite move from someone just insisting they're right.

## License

Custom license — see [LICENSE.md](LICENSE.md). Viewing is free; no commercial use; no redistribution or modified derivatives without prior written permission from the founder via email (contact address to be added once finalized).

## Credits

Designed and iterated by **ixOOxi** over hands-on sessions across multiple AI models (Claude, Gemini, GPT, GenSpark, Verdent, and others), refining each rule against real, observed failures rather than theory.
