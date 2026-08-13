# Em dashes for editorial review

**For:** Mo
**From:** Claude Code, via the punctuation-normalization pass
**Source:** `app/content/content_library.json` at `cd9a946` (before this branch's changes)

CD Brief §3 asks for colons, periods or plain conjunctions instead of em dashes. That is an
**editorial** instruction, not a mechanical one: which replacement is right depends on the
sentence. A script applied to all of them would produce a lot of slightly-wrong prose.

So the punctuation PR fixed only the cases where exactly one replacement works — an em dash
sitting immediately before *and*, *but*, *or* or *not*, which always becomes a comma. **12 of
those were changed automatically.** Everything below needs a human decision and is untouched.

## What is NOT in this list, and why

- **~473 em dashes** in fields PR 3, PR 4 and PR 6 will rewrite from scratch (type patterns,
  subtype narratives, communication/conflict, strengths, challenges, lines, wings). Fixing
  punctuation in copy that is about to be replaced would put the same string in front of you
  twice. They will be handled as part of authoring.
- **`type_N.comparison`** — the one family that reaches the coach report. Left alone so this
  pass could not disturb the coach baseline.
- **`static.primer.scan_heading`** ("The Nine Enneagram Types — Scan Each One") — it renders
  on the v3 *What Is the Enneagram?* page that was signed off on 12 August. It is in the
  Heading separator section below rather than being changed silently.

## How to use this

Each entry gives the field path, the sentence, and the options that preserve meaning. Where
more than one option works, that is a real choice rather than an omission.


---

## Paired aside (7)

**Options:**
- Commas on both sides — but check first: if the aside already contains commas, this reads as a list.
- Parentheses on both sides — always safe, slightly more formal.
- Recast the sentence so the aside is not needed.

1. `type_8.practices.bullets[1]`
   > Eights often use anger to cover softer feelings — hurt, fear, disappointment — that are harder to access.

2. `type_8.practices.bullets[4]`
   > Be open to the possibility that someone else's perspective — especially when it contradicts yours — might contain a truth worth hearing.

3. `type_8.center.bullets[1]`
   > The gut-sense that something is off — or right — is often accurate.

4. `type_8.center.off_center[3]`
   > That noticing — even briefly — is what changes the dynamic.

5. `type_1.center.off_center[2]`
   > Notice the should in real time — “I should…,” “they should…” — and ask whether it's serving you.

6. `type_5.practices.bullets[0]`
   > Naming an emotion as it happens — even silently — reconnects the head and the heart.

7. `type_7.practices.bullets[2]`
   > Committing to one thing fully — and finishing it — delivers a satisfaction that options never do.


---

## Definition / appositive (11)

**Options:**
- A colon, when what follows expands or defines what precedes it.
- A comma, when what follows is a loose addition rather than a definition.

1. `static.lines_primer`
   > Your stress point is the type your energy moves toward under pressure — often showing up as uncharacteristic behavior.

2. `static.wings_using`
   > You don’t need to pick one permanently — just observe where the texture is coming from right now.

3. `static.instinct_primer`
   > Alongside your core type, you have a dominant instinct — one of three innate drives that shape where your survival energy goes first.

4. `type_8.center.off_center[1]`
   > Slow the body down — a breath, a walk, a moment of stillness.

5. `type_8.comparison.focus`
   > Power dynamics — who has it, who's misusing it, whether things are fair and direct.

6. `type_9.center.off_center[2]`
   > Notice numbing in real time — the second helping, the extra episode, the easy yes.

7. `type_1.comparison.core_motivation`
   > To be good, right, and beyond reproach — improving the self and the world toward an inner standard.

8. `type_2.comparison.core_motivation`
   > To be loved and needed — earning connection by giving and meeting others' needs.

9. `type_6.center.bullets[2]`
   > Presence, for you, means finding inner authority — trusting your own ground rather than scanning for external certainty.

10. `type_6.comparison.core_motivation`
   > To be safe, secure, and prepared — managing anxiety by anticipating threat and finding what's reliable.

11. `type_7.comparison.core_motivation`
   > To be happy, free, and satisfied — pursuing possibility and pleasure while avoiding pain and limitation.


---

## Clause joiner (11)

**Options:**
- A period, splitting into two sentences.
- A semicolon, keeping them linked.
- A colon, if the second clause explains the first.

1. `static.welcome.callout`
   > If something in here resonates deeply, wonderful — that’s the recognition we’re going for.

2. `type_8.practices.bullets[0]`
   > A breath or a count to ten isn't weakness — it's choosing the response instead of running on it.

3. `type_8.center.bullets[0]`
   > As a Body Center type, your gut is your primary instrument — it registers threat, injustice, and opportunity before your thinking mind catches up.

4. `type_8.center.bullets[3]`
   > The goal isn't to stop leading with the gut — it's to stay in contact with it consciously, rather than letting it drive on autopilot.

5. `type_2.practices.bullets[0]`
   > “I need…” is not weakness — it's the honesty that lets others actually love you.

6. `type_2.center.off_center[2]`
   > Notice the moment you reshape yourself to fit a relationship — that's the pattern, gently visible.

7. `type_3.center.off_center[2]`
   > Notice when you're adapting the self to win approval — that's the pattern, gently visible.

8. `type_4.center.off_center[2]`
   > Notice when a passing mood is hardening into an identity — that's the pattern, gently visible.

9. `type_5.center.off_center[2]`
   > Notice the reflex to compartmentalize and conserve — that's the pattern, gently visible.

10. `type_6.center.off_center[2]`
   > Notice the search for outside certainty — that's the pattern, gently visible.

11. `type_7.center.off_center[2]`
   > Notice the reframe and the pivot in real time — that's the pattern, gently visible.


---

## Mixed (14)

**Options:**
- No single rule fits — please read in context.

1. `static.wings_using`
   > They’re dynamic — the texture of your type shifts with context, stress, and growth.

2. `static.instinct_definitions[0].body`
   > SP energy goes toward securing what you need — physically, materially, and in terms of personal wellbeing.

3. `static.instinct_definitions[2].body`
   > SX energy goes toward chemistry, magnetism, and the quality of individual bonds — what makes a person or experience come alive.

4. `type_9.practices.bullets[4]`
   > Your presence is felt whether or not you assert — choosing to show up directly is a gift, not a disruption.

5. `type_9.center.bullets[3]`
   > The goal isn't to become forceful; it's to stop disappearing — to take up the space that's already yours.

6. `type_1.center.bullets[2]`
   > Presence, for you, means loosening the grip — letting the body relax out of its habitual tension.

7. `type_3.comparison.core_motivation`
   > To be successful, admired, and seen as a winner — worth earned through accomplishment.

8. `type_4.practices.bullets[1]`
   > The pull toward the absent is strong — deliberately turning toward what's already here rebalances it.

9. `type_4.comparison.core_motivation`
   > To be authentic, deeply understood, and significant — embracing the full depth of feeling.

10. `type_5.center.bullets[0]`
   > As a Head Center type, you process the world through the mind — thinking, analyzing, anticipating.

11. `type_5.comparison.core_motivation`
   > To be capable, self-sufficient, and unintruded upon — protecting limited inner resources.

12. `type_6.practices.bullets[1]`
   > Make a small decision and stand by it without seeking outside reassurance — the muscle strengthens with use.

13. `type_6.center.bullets[0]`
   > As a Head Center type, you process the world through the mind — anticipating, scanning, planning.

14. `type_7.center.bullets[0]`
   > As a Head Center type, you process the world through the mind — planning, imagining, anticipating what's next.


---

## Heading separator (10)

**Options:**
- A colon: “Coming Back to Center: The Body Knows First”.
- A line break, if the layout gives the subtitle its own line.

1. `static.primer.scan_heading`
   > The Nine Enneagram Types — Scan Each One

2. `type_8.center.subhead`
   > Coming Back to Center — The Body Knows First

3. `type_9.center.subhead`
   > Coming Back to Center — Coming Back Into Your Own Body

4. `type_1.center.subhead`
   > Coming Back to Center — Releasing the Grip

5. `type_2.center.subhead`
   > Coming Back to Center — Coming Home to Yourself

6. `type_3.center.subhead`
   > Coming Back to Center — Finding the Self Beneath the Image

7. `type_4.center.subhead`
   > Coming Back to Center — Coming Back to What's Here

8. `type_5.center.subhead`
   > Coming Back to Center — Coming Back Into the World

9. `type_6.center.subhead`
   > Coming Back to Center — Finding Solid Ground Within

10. `type_7.center.subhead`
   > Coming Back to Center — Coming Down Into the Present


---

**Total awaiting a decision: 53.**
