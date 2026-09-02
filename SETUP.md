# Setup Guide — Myriad Eye Engine [M.E.E]

[한국어 가이드](SETUP.ko.md)

This guide assumes zero technical background. If you can copy text and paste it into a text box, you can do this.

---

## Step 1 — Pick a document

You're going to copy the *entire contents* of one file and paste it somewhere in an AI app. Which file depends on how much "space" that AI app gives you for instructions.

| If you're using... | Use this file |
|---|---|
| A paid plan with a large context window (Claude Projects, ChatGPT Plus custom GPT, Gemini Advanced) | [`Myriad_Eye_Engine_15Elements_Common.md`](Myriad_Eye_Engine_15Elements_Common.md) |
| A free plan, or a tool that limits how many characters you can paste into instructions | [`Myriad_Eye_Engine_15Elements_AI_Compact.md`](Myriad_Eye_Engine_15Elements_AI_Compact.md) |
| A very strict free tier, or you got an error saying your instructions are too long | [`Myriad_Eye_Engine_15Elements_AI_Compact_1500char.md`](Myriad_Eye_Engine_15Elements_AI_Compact_1500char.md) |

Not sure? Start with the Compact version. You can always switch later.

Open the file on GitHub, click into it, select all the text, and copy it (Ctrl+A, then Ctrl+C — or Cmd+A / Cmd+C on Mac).

## Step 2 — Find where to paste it

Every AI app calls this box something slightly different, but it's always a place meant for standing instructions that apply to every conversation — not the regular chat box.

- **Claude (claude.ai)** → Create a **Project**, then paste into "Project instructions."
- **ChatGPT** → Settings → Personalization → **Custom Instructions** ("What would you like ChatGPT to know about you?" / "How would you like ChatGPT to respond?" — paste it into the second box).
- **Gemini** → Create a **Gem**, and paste it into the Gem's instructions field.
- **GenSpark / Verdent / similar tools** → Look for "System Prompt," "Persona," or "Instructions" in the app's settings — it's usually in a settings gear icon or a project-creation screen.

**Using something else** — Perplexity, DeepSeek, GLM (Zhipu), Mistral, Meta AI, or anything not listed above? The platforms above are just the ones this project has actually tested. Every serious AI product has *some* equivalent of this — the field is sometimes called "System Prompt," "Custom Instructions," "Persona," "Character Settings," or just "Instructions." Search that manufacturer's own official help pages for one of those terms (e.g., "DeepSeek system prompt," "Perplexity custom instructions") to find where it lives in their specific interface — this guide can't list every product, but the concept is the same everywhere: a place for standing instructions, separate from the regular chat box.

**Excluded: Microsoft Copilot.** Not supported — two separate problems were confirmed by testing: (1) Copilot has no persistent instructions field to paste this into in the first place, and (2) even pasted as a first message, Copilot refused to operate under the protocol. Either failure alone would be enough to exclude it; both were present.

If your tool truly has no such field (some very simple chat widgets don't), paste it as the **first message** of a new conversation instead, then wait for the AI to acknowledge it before asking your real question.

## Step 3 — Paste and save

Paste the entire file contents into that box, exactly as-is. Don't summarize it, don't translate it, don't edit it down further — the compact/1500-char versions are already as short as they can safely go. Save/apply the settings.

## Step 4 — Check that it's working

Start a new conversation and ask anything that requires actual judgment (not just "hello"). On its first substantive answer, the AI should:

- Start with something like `[Verify] AI: <company name>/<model name>` (e.g., `[Verify] AI: Google/Gemini 2.5 Pro`)
- Followed by lines like `[Confirmed] Confirmed: .../Guessed: ...`, `[Repetition] N times`, `[9-ELEM] Applied: ①③⑤/Not applied: ...`

If you see that, it's working. If you don't see it at all, try Step 5.

## Step 5 — If it's not working

- **Nothing like `[Verify]` appears at all.** Some AIs need a nudge on the very first message. Try opening with something like: *"Please follow the instructions I gave you exactly, starting now."*
- **It worked for a few messages, then stopped.** This is expected on long conversations, especially on free-tier models — see the Origin Story document's notes on "drift." Paste a short reminder back in, or use the [honesty-checker tool](honesty-checker-tool/) below to catch it early.
- **The AI says it can't do this / refuses.** This protocol doesn't ask an AI to bypass any safety rule, so a flat refusal usually means the instructions field wasn't actually saved, or you pasted into the wrong box (a one-time message instead of a persistent settings field). Double-check Step 2.

## Step 6 (optional) — Use the honesty-checker tool

If you want a second opinion on whether an AI's `[Verify]` output looks legitimate (not just present, but *consistent*), copy the AI's response and paste it into the tool in [`honesty-checker-tool/`](honesty-checker-tool/) — open the `.html` file in any browser, no installation needed. A Chrome extension version is also included for one-click capture while you're on the AI's site.

## Frequently asked questions

**Do I need to do this every single conversation?**
Only once per AI app, if that app has a persistent instructions field (Project instructions, Custom Instructions, a Gem, etc.) — it then applies automatically to every new conversation in that project/Gem. If your tool has no such field, yes, you'd need to paste it at the start of each new chat.

**Will this make the AI slower or worse at normal tasks?**
It adds some length to what the AI has to read before your actual message, which costs a small amount of processing overhead — this is exactly why the compact and 1500-char versions exist, to keep that cost low for tighter setups. It does not restrict what the AI can help with.

**Can I edit the rules to fit my own preferences?**
Yes — nothing stops you from adapting it. Just know that the version-controlled files in this repo are the ones that get updated and fixed going forward; a personally-edited copy won't automatically get those updates.

**Which AI works best with this?**
It's designed to be model-agnostic (see the Origin Story for why), and has been used across Claude, Gemini, GPT, GenSpark, and Verdent in practice. Results can vary by model — if one doesn't seem to hold the rules well, try the fuller Common document instead of the compact one, since more explicit detail sometimes helps weaker or smaller models follow through.
