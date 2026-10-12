# Myriad Eye Engine — `.FC` Flowchart Format v1

> This document fixes **how a flowchart file (`.FC`) is written**, so that any AI writes it, and any tool reads it, in the same shape.
> **Why a flowchart comes first** (the rule) is in Common doc 6-1; **how to write it** (the format) is here.
> Korean version: `Myriad_Eye_Engine_FC형식_v1.md`

---

## 0. Read this first — how to hand it to an AI

An AI reads **only what it is given**. Telling it the name of this document may not be enough for it to follow.

- Hand over the whole document, or paste **the "paste-in summary" (10 lines) from section 6** together with your request.
- The request that the Flowchart App builds already contains this summary.
- AIs given the same summary write the same shape. How exactly each AI follows it can differ (under observation). The app reads slightly-off formats leniently and reports, rather than drops, any line it cannot read.

---

## 1. The file

- The extension is **`.FC`** (FlowChart; uppercase preferred, lowercase allowed). Example: `moon-car.FC`
- The content is **plain text (UTF-8)**. **Never save it as `.md`.** (Only documents that *explain* the format, like this one, are `.md`; the flowchart file itself is `.FC`.)
- When showing it in chat, put it all in **one code block**. Do not substitute pictures (box-drawing characters, drawn lines) or tables — text arrows are enough, and tools can read them.

## 2. Structure — four parts

Write each header on **its own line as `[name]`**. The order below is recommended.

| Header | Contents | Korean header |
|---|---|---|
| `[Anchor]` | one or two sentences: what the program does and where it ends | `[닻]` |
| `[Flow]` | box numbers, arrows, branches | `[흐름]` |
| `[Boxes]` | per box: input, process, output, on failure, trap | `[칸별]` |
| `[Change log]` | date, version, what changed, user suggestions | `[변경 이력]` |

## 3. [Flow] — how to write a box

**One box per line.** The form is `number name -> next number`

```
1 Start: prepare the screen and the car -> 2
2 Read key input -> 3
```

- The **number** is an integer. Put it before the name, then one space.
- The **start** is the **first line** of `[Flow]`.
- The **end** is written `end` (Korean `끝`). Example: `6 Show game over -> end`
- A **branch** follows the question with `yes-> number | no-> number`. Two or more branches are allowed, and the labels (`yes`, `no`, or any word) are free.

```
4 Did the car hit an obstacle? yes-> 6 | no-> 5
```

- A **loop (going back)** just points to an earlier number: `5 Draw the screen -> 2`
- Numbers need not follow the flow order. The arrows decide the flow.

## 4. [Boxes] — what is inside a box

Under the box number and name, write indented lines. You need not write them for every box, but **always for branch boxes and risky boxes.**

```
4 Collision check
    input: car and obstacle coordinates
    process: compute whether the two rectangles overlap
    output: yes/no
    on failure: do not skip the check; log and stop
    trap: reference point (center vs corner)
```

- Items: `input` · `process` · `output` · `on failure` · `trap` (Korean `입력` · `처리` · `출력` · `실패 시` · `함정`)
- **trap** is the situation-judgment check — what is easy to misread or misbuild in this box.
- Boxes that share content can be grouped as a range: `10~11 Read the reply`
- It can also be written on one line: `4 Collision check | input: … | process: … | output: …`

## 5. Numbering rules (the most important part)

1. Write the **whole program.** Do not draw only part of it for a small fix.
2. **Never renumber a box once it is set.** Code comments and the tool's change comparison rely on the numbers.
3. To **add** a box, use a **new number** (largest number used so far + 1). Even when inserting in the middle, do not shift later numbers — only fix the arrows.
4. Even if you **delete** a box, **never reuse its number.**
5. In code, **comment the box number**: `// box 7`, `# box 7`.
6. When logic changes, **fix the flowchart (that box) first**, add one line to `[Change log]`, then fix the code.
7. Show the fixed flowchart **in full again** (not only the changed boxes).

## 6. Paste-in summary (10 lines)

When asking an AI, paste this block as is. (It is the same one the Flowchart App puts in its request.)

```
[.FC flowchart format v1] extension .FC, plain UTF-8 text, never .md. In chat, put it all in one code block.
[Anchor] one or two sentences on what the program does
[Flow] one box per line:  number name -> next number   (first line = start; end = "end")
       branch:  number question? yes-> number | no-> number
[Boxes] under "number name", indented lines:  input: / process: / output: / on failure: / trap:
[Change log] date version what changed / user suggestions
Rules: write the whole program. Never renumber a box once set (additions get new numbers; never reuse a deleted number).
       No -> or | inside box names; use "?" only in branch boxes. In code, comment the box number, e.g. "// box 7".
       When logic changes, fix the flowchart first, note it in [Change log], then show the whole flowchart again.
```

## 7. Do not (shapes tools cannot read)

- Put `->`, `→` or `|` inside a box name (they are taken as arrows or branches)
- Use `?` in a box name that is not a branch
- Boxes without numbers, or one box split over several lines
- Draw with box characters, or write it as a table
- Show only some boxes, or renumber

> A one-line arrow chain (`1 Input → 2 Compute → 3 Output`) is read by the app but not recommended: it cannot express branches or loops once the boxes grow.

## 8. Example

Same content as the file `Myriad_Eye_Engine_FC_Example.FC` (Korean text). English version:

```
[Anchor]
Moon-car game: move the car by key input and avoid obstacles. (Scope: one round, no score saving)

[Flow]
1 Start: prepare the screen and the car -> 2
2 Read key input -> 3
3 Update the car position -> 4
4 Did the car hit an obstacle? yes-> 6 | no-> 5
5 Draw the screen -> 2
6 Show game over -> end

[Boxes]
4 Collision check
    input: car and obstacle coordinates
    process: compute whether the two rectangles overlap
    output: yes/no
    on failure: do not skip the check; log and stop
    trap: reference point (center vs corner)

[Change log]
2026-10-11 v1 written / user suggestions: (none)
```

## 9. Relationship to tools

- The **Flowchart App** (a separate project) reads this format, draws it, and colors the changed boxes. It was built **on** this format; if the format changes, this document's version goes up.
- The **honesty checker** only looks for traces of a flowchart in coding replies. It cannot judge whether the format is right or the content complete.

## 10. Versions

| Version | Date | Content |
|---|---|---|
| v1 | 2026-10-11 | First format. Fixed on the syntax the Flowchart App P1 reads |

> The format is **still being refined through use.** When it changes, raise the version and update the app's reading tests together.
