HIVE, INC. · INSIGHTOUT

Your Wings — Content Draft r2 (render-verified), All Nine Types

Client Report v3.0 · Page 8 · PR 3 content batch

Drafted by Claude for Mo's review · 12 August 2026

How to read this document

This is a review draft, not the compile source. Each of the nine types has two wing blocks, and each wing block has three kinds of zone: an overview, five bullets, and an "As a Resource" band. That is 126 authored zones in total — 112 new, plus Type 9's 14, which are already in the mockup and reproduced here unchanged so you can see the full set side by side.

The grey italic line under each zone is a review annotation: character count, word count and provenance. Those lines are for you and me, not for the report — they get stripped when this content moves into the content library source. Everything else is structured the way the build script expects: ALL-CAPS labels, body paragraphs, and real bullet lists.

This is revision 2, render-verified. The first draft was tuned to word counts; a render test on 12 August showed word count does not predict where a line wraps — character count does. 37 of 90 bullets and 3 overviews were rewritten as a result. A second render pass against the rewrite then caught two bullets sitting at the very edge of the "safe" two-line band (71–72 characters) that still wrapped ragged — the floor has been moved to 73, and both bullets rewritten again. The revised rule is below.

PROVENANCE KEY

APPROVED — already in the v3 mockup. Type 9 only. Unchanged.

ADAPTED — reworked from the Mo-edited wing narratives in type\_library.json. The language is substantially yours; I trimmed, re-cut, and restructured it to fit the new zones.

CLAUDE — my draft. Extrapolated from the canon patterns but not traceable to a specific Hive sentence. Read these hardest.

Of 126 zones: 14 APPROVED, 69 ADAPTED, 43 CLAUDE. The CLAUDE zones cluster in two places — the fourth bullet in every block (how others perceive you, which canon doesn't address) and the "As a Resource" bands (a new zone with no canon equivalent).

THE PATTERN EACH BLOCK FOLLOWS

Derived from the Type 9 page, which is the only rendered reference we have. Holding it consistently across all nine types is what will make the page feel like one system rather than nine separate voices.

Overview — two sentences. Sentence one: what this wing does to the base type. Sentence two: what the wing brings. Under 205 characters. Both columns must be under it, which is what makes them render the same number of lines (four). At 221 characters a column runs to a fifth line holding one stranded word.

Bullets 1–3 — capacities. What you can actually do because of this wing. Either 52 characters or fewer (one full line) or 73–88 (two full lines). Avoid 53–72 — a render pass on the r2 rewrite showed 71–72 chars is a coin flip that depends on where the last space falls, not the total, so the safe floor moved up from 71 to 73\.

Bullet 4 — perception. Always "Others may find you more \_\_\_ than \_\_\_." How the wing changes what people see.

Bullet 5 — shadow. Always opens "Left unexamined" or "Left unchecked." The cost when the wing runs unattended.

As a Resource — two sentences. "When you need \_\_\_, reach for the \_\_\_ wing. It turns the \[Archetype\]'s \_\_\_ into \_\_\_." Roughly 120–175 characters. This is the zone that makes the page actionable rather than descriptive, and the render test showed these are already better calibrated than the Type 9 page's own.

All 126 zones were checked programmatically against these bands, and Types 1 and 3 (the two with the most rewrites) were then confirmed against the real renderer, pinned Chromium, getClientRects() — not the character-count proxy. 38 of 40 zones passed on the first render pass; the two that didn't were both sitting at 71–72 characters, which is what surfaced the coin-flip problem and moved the floor to 73\. All 126 zones now clear 73–88 or ≤52. The Type 9 page — hand-written and render-tuned before any rule existed, and not touched in this pass — sits outside these bands in two spots (two bullets at 71 chars, one overview at 207\) and is left as-is since it's already live and correct in production.

TWO THINGS I FOUND IN THE SOURCE MATERIAL

1\. The project copy of type\_library.json still carries the old archetype names — Achiever, Investigator, Loyal Skeptic, Challenger. The repo copy is correct. I have authored against the names of record throughout: Type 3 The Performer, Type 5 The Observer, Type 6 The Questioner, Type 8 The Protector.

2\. The Type 8 Nine-wing narrative in type\_library.json reads "more grounded, more impatient, and more measured." That looks like a typo — every other clause in that entry describes the Nine wing bringing calm and steady presence, and "impatient" contradicts both "grounded" and "measured." I have written it as "more patient." Worth correcting at source either way.

STATIC PAGE INTRO — NO AUTHORING NEEDED

The paragraph at the top of the page is identical for all nine types and is already written:

"Wings are the two types immediately adjacent to your home base type. Each wing "flavors" how your type shows up, and most people naturally lean more towards one wing. Both are always present, but which one shows up more is unique to you. When you access your wings intentionally they become valuable resources for balancing the automatic patterns of your home base type."

TYPE 1 — THE IMPROVER

Wings: Type 9 The Peacemaker · Type 2 The Giver

NINE WING · TYPE 9 — THE PEACEMAKER

OVERVIEW

A One with a stronger Nine wing tends to be softer, more easygoing, and more patient. The Nine wing brings acceptance and a willingness to let things be, which can cool the inner critic's heat.

193 chars · 35 words · ADAPTED

WING BULLETS

\-   You can let a thing stay imperfect without feeling the pull to correct it.

74 chars · 2 lines · ADAPTED

\-   You bring patience where there was urgency.

43 chars · 1 line · CLAUDE

\-   Your standards hold; the pressure eases.

40 chars · 1 line · ADAPTED

\-   Others may find you calmer and more approachable than they expect of a One.

75 chars · 2 lines · CLAUDE · perception bullet

\-   Left unexamined, the drive to improve can quietly settle into passivity and drift.

82 chars · 2 lines · ADAPTED · shadow bullet

AS A RESOURCE

When you need to soften, wait, or let something be good enough, reach for the Nine wing. It turns the Improver's precision into something more forgiving.

153 chars · 26 words · CLAUDE

TWO WING · TYPE 2 — THE GIVER

OVERVIEW

A One with a strong Two wing is warmer, more people-focused, and more openly caring. The Two wing brings attention to relationships and a real desire to help, softening the corrective edge.

189 chars · 32 words · ADAPTED

WING BULLETS

\-   You lead with warmth, so correction lands as care.

50 chars · 1 line · CLAUDE

\-   You notice what people need, not only what's wrong.

51 chars · 1 line · CLAUDE

\-   You hold standards without losing warmth.

41 chars · 1 line · ADAPTED

\-   Others may find you warmer and more openly generous than they expect of a One.

78 chars · 2 lines · CLAUDE · perception bullet

\-   Left unchecked, criticism can arrive dressed up as helpfulness and concern.

75 chars · 2 lines · ADAPTED · shadow bullet

AS A RESOURCE

When you need to connect, encourage, or lead with care, reach for the Two wing. It turns the Improver's high standards into something people can receive.

153 chars · 26 words · CLAUDE

TYPE 2 — THE GIVER

Wings: Type 1 The Improver · Type 3 The Performer

ONE WING · TYPE 1 — THE IMPROVER

OVERVIEW

A Two with a strong One wing is more structured, principled, and attentive to doing things correctly. The One wing brings discipline and a sense of right conduct to the Two's generosity.

186 chars · 32 words · ADAPTED

WING BULLETS

\-   You give with structure, not just with feeling.

47 chars · 1 line · ADAPTED

\-   You follow through on what you offer to do.

43 chars · 1 line · CLAUDE

\-   Your generosity carries a sense of right conduct.

49 chars · 1 line · ADAPTED

\-   Others may find you more principled and steady than they expect of a Two.

73 chars · 2 lines · CLAUDE · perception bullet

\-   Left unchecked, warmth can cool into criticism when care isn't done properly.

77 chars · 2 lines · ADAPTED · shadow bullet

AS A RESOURCE

When you need to hold a boundary or say the harder thing, reach for the One wing. It turns the Giver's warmth into something with a spine.

138 chars · 27 words · CLAUDE

THREE WING · TYPE 3 — THE PERFORMER

OVERVIEW

A Two with a strong Three wing is more outgoing, ambitious, and image-aware. The Three wing brings energy and charisma to the Two's warmth, making the care both visible and effective in the wider world.

202 chars · 35 words · ADAPTED

WING BULLETS

\-   You turn care into visible, effective action.

45 chars · 1 line · ADAPTED

\-   You move easily between warmth and results.

43 chars · 1 line · ADAPTED

\-   People are drawn to you, and you know how to use it.

52 chars · 1 line · CLAUDE

\-   Others may find you more ambitious and polished than they expect of a Two.

74 chars · 2 lines · CLAUDE · perception bullet

\-   Left unexamined, giving can become a performance calibrated to how it lands.

76 chars · 2 lines · ADAPTED · shadow bullet

AS A RESOURCE

When you need reach, momentum, or visible results, reach for the Three wing. It turns the Giver's generosity into something that scales.

136 chars · 22 words · CLAUDE

TYPE 3 — THE PERFORMER

Wings: Type 2 The Giver · Type 4 The Individualist

TWO WING · TYPE 2 — THE GIVER

OVERVIEW

A Three with a strong Two wing is warmer, more people-oriented, and more charming. The Two wing brings genuine care about others into the success drive, so achievement becomes something shared.

193 chars · 31 words · ADAPTED

WING BULLETS

\-   You lead through connection, not only results.

46 chars · 1 line · ADAPTED

\-   You notice people while you drive toward the goal.

50 chars · 1 line · CLAUDE

\-   Your success tends to lift the people around you.

49 chars · 1 line · ADAPTED

\-   Others may find you warmer and more generous than they expect of a Three.

73 chars · 2 lines · CLAUDE · perception bullet

\-   Left unchecked, you can end up chasing approval on two fronts at the same time.

79 chars · 2 lines · ADAPTED · shadow bullet

AS A RESOURCE

When you need to bring people with you rather than past them, reach for the Two wing. It turns the Performer's drive into something others want to join.

152 chars · 28 words · CLAUDE

FOUR WING · TYPE 4 — THE INDIVIDUALIST

OVERVIEW

A Three with a strong Four wing is more introspective, artistic, and attuned to personal expression. The Four wing brings emotional depth and a pull toward authenticity into the achievement drive.

196 chars · 31 words · ADAPTED

WING BULLETS

\-   You want the work to mean something.

36 chars · 1 line · ADAPTED

\-   You bring real aesthetic judgment to what you make.

51 chars · 1 line · ADAPTED

\-   You notice quickly when the image and the substance underneath have parted ways.

80 chars · 2 lines · ADAPTED

\-   Others may find you deeper and more self-questioning than they expect of a Three.

81 chars · 2 lines · CLAUDE · perception bullet

\-   Left unexamined, that noticing can quietly curdle into private dissatisfaction.

79 chars · 2 lines · ADAPTED · shadow bullet

AS A RESOURCE

When you need to know whether the work actually matters, reach for the Four wing. It turns the Performer's momentum into something with substance underneath.

157 chars · 25 words · CLAUDE

TYPE 4 — THE INDIVIDUALIST

Wings: Type 3 The Performer · Type 5 The Observer

THREE WING · TYPE 3 — THE PERFORMER

OVERVIEW

A Four with a strong Three wing is more outgoing, more accomplished, and more engaged with the outside world. The Three wing brings drive and a capacity to turn inner intensity into visible work.

195 chars · 34 words · ADAPTED

WING BULLETS

\-   You get your inner world out into the open.

43 chars · 1 line · ADAPTED

\-   You can finish things, not just feel them.

42 chars · 1 line · CLAUDE

\-   Your intensity translates into work people can see.

51 chars · 1 line · ADAPTED

\-   Others may find you more driven and productive than they expect of a Four.

74 chars · 2 lines · CLAUDE · perception bullet

\-   Left unchecked, the pull to be seen starts competing with the pull to be real.

78 chars · 2 lines · ADAPTED · shadow bullet

AS A RESOURCE

When you need to finish, ship, or be seen, reach for the Three wing. It turns the Individualist's depth into something that reaches other people.

145 chars · 25 words · CLAUDE

FIVE WING · TYPE 5 — THE OBSERVER

OVERVIEW

A Four with a strong Five wing is more introspective, more private, and more intellectually focused. The Five wing brings analysis and a love of ideas to the Four's emotional depth.

181 chars · 31 words · ADAPTED

WING BULLETS

\-   You think as carefully as you feel.

35 chars · 1 line · CLAUDE

\-   You go deep into what interests you and stay there.

51 chars · 1 line · ADAPTED

\-   Solitude restores you rather than draining you.

47 chars · 1 line · ADAPTED

\-   Others may find you more contained and private than they expect of a Four.

74 chars · 2 lines · CLAUDE · perception bullet

\-   Left unexamined, longing plus withdrawal can settle into real loneliness.

73 chars · 2 lines · ADAPTED · shadow bullet

AS A RESOURCE

When a mood has you in its grip, reach for the Five wing. It turns the Individualist's feeling into something you can examine rather than inhabit.

146 chars · 26 words · CLAUDE

TYPE 5 — THE OBSERVER

Wings: Type 4 The Individualist · Type 6 The Questioner

FOUR WING · TYPE 4 — THE INDIVIDUALIST

OVERVIEW

A Five with a strong Four wing is more emotionally sensitive, more creative, and more attuned to beauty. The Four wing brings feeling and a pull toward meaning into the Five's intellectual life.

194 chars · 33 words · ADAPTED

WING BULLETS

\-   You feel your way into ideas, not just think them.

50 chars · 1 line · ADAPTED

\-   You bring aesthetic judgment to what you build.

47 chars · 1 line · ADAPTED

\-   Your inner world is unusually rich.

35 chars · 1 line · ADAPTED

\-   Others may find you warmer and more expressive than they expect of a Five.

74 chars · 2 lines · CLAUDE · perception bullet

\-   Left unexamined, feeling and analysis can start pulling in opposite directions.

79 chars · 2 lines · ADAPTED · shadow bullet

AS A RESOURCE

When the analysis has gone cold, reach for the Four wing. It turns the Observer's clarity into something with warmth in it.

123 chars · 22 words · CLAUDE

SIX WING · TYPE 6 — THE QUESTIONER

OVERVIEW

A Five with a strong Six wing is more cautious, more loyal, and more engaged with questions of trust. The Six wing brings vigilance and practical problem-solving into the Five's observing stance.

195 chars · 32 words · ADAPTED

WING BULLETS

\-   You see problems coming before other people do.

47 chars · 1 line · ADAPTED

\-   You engage with systems instead of watching them.

49 chars · 1 line · ADAPTED

\-   You show real loyalty to the few you trust.

43 chars · 1 line · ADAPTED

\-   Others may find you more practical and involved than they expect of a Five.

75 chars · 2 lines · CLAUDE · perception bullet

\-   Left unchecked, two head types together can spin worry into real paralysis.

75 chars · 2 lines · ADAPTED · shadow bullet

AS A RESOURCE

When you need to act before you have all the information, reach for the Six wing. It turns the Observer's caution into practical preparation.

141 chars · 24 words · CLAUDE

TYPE 6 — THE QUESTIONER

Wings: Type 5 The Observer · Type 7 The Enthusiast

FIVE WING · TYPE 5 — THE OBSERVER

OVERVIEW

A Six with a strong Five wing is more introverted, more analytical, and more inclined to gather information before acting. The Five wing brings intellectual depth and a habit of withdrawing to think.

199 chars · 33 words · ADAPTED

WING BULLETS

\-   You think a problem through before moving.

42 chars · 1 line · ADAPTED

\-   You hold real expertise in what you've committed to.

52 chars · 1 line · ADAPTED

\-   You stay calm while you analyze.

32 chars · 1 line · CLAUDE

\-   Others may find you more self-contained and private than they expect of a Six.

78 chars · 2 lines · CLAUDE · perception bullet

\-   Left unchecked, withdrawing to think can amplify the worry rather than settle it.

81 chars · 2 lines · ADAPTED · shadow bullet

AS A RESOURCE

When the questions are spinning and you need solid ground, reach for the Five wing. It turns the Questioner's vigilance into patient analysis.

142 chars · 23 words · CLAUDE

SEVEN WING · TYPE 7 — THE ENTHUSIAST

OVERVIEW

A Six with a strong Seven wing is more outgoing, more playful, and more comfortable with risk. The Seven wing brings optimism and a willingness to reframe fear toward possibility rather than threat.

198 chars · 33 words · ADAPTED

WING BULLETS

\-   You find the lighter angle when the room runs heavy.

52 chars · 1 line · ADAPTED

\-   You take risks the pure Six pattern would avoid.

48 chars · 1 line · ADAPTED

\-   Your loyalty comes with genuine warmth and humor.

49 chars · 1 line · ADAPTED

\-   Others may find you more easygoing and light-hearted than they expect of a Six.

79 chars · 2 lines · CLAUDE · perception bullet

\-   Left unexamined, reframing can become a way to skip past the fear entirely.

75 chars · 2 lines · ADAPTED · shadow bullet

AS A RESOURCE

When worry has narrowed the field to a single bad outcome, reach for the Seven wing. It turns the Questioner's what-ifs into possibilities worth exploring.

155 chars · 25 words · CLAUDE

TYPE 7 — THE ENTHUSIAST

Wings: Type 6 The Questioner · Type 8 The Protector

SIX WING · TYPE 6 — THE QUESTIONER

OVERVIEW

A Seven with a strong Six wing is more loyal, more responsible, and more attentive to relationships. The Six wing brings warmth and a capacity for genuine commitment into the Seven's forward motion.

198 chars · 33 words · ADAPTED

WING BULLETS

\-   You stay with people and projects past the novelty.

51 chars · 1 line · ADAPTED

\-   You notice what could go wrong before you leap.

47 chars · 1 line · ADAPTED

\-   Your enthusiasm comes with follow-through.

42 chars · 1 line · ADAPTED

\-   Others may find you steadier and more reliable than they expect of a Seven.

75 chars · 2 lines · CLAUDE · perception bullet

\-   Left unchecked, optimism and worry run at the same time, and both are tiring.

77 chars · 2 lines · ADAPTED · shadow bullet

AS A RESOURCE

When you need to stay, finish, or keep a promise, reach for the Six wing. It turns the Enthusiast's energy into something people can count on.

142 chars · 26 words · CLAUDE

EIGHT WING · TYPE 8 — THE PROTECTOR

OVERVIEW

A Seven with a strong Eight wing is more assertive, more action-oriented, and more willing to push through resistance. The Eight wing brings directness and a tolerance for conflict into the Seven's energy.

205 chars · 33 words · ADAPTED

WING BULLETS

\-   You turn ideas into motion fast.

32 chars · 1 line · ADAPTED

\-   You push through resistance rather than around it.

50 chars · 1 line · ADAPTED

\-   You say the hard thing when it needs saying.

44 chars · 1 line · CLAUDE

\-   Others may find you more forceful and decisive than they expect of a Seven.

75 chars · 2 lines · CLAUDE · perception bullet

\-   Left unexamined, impatience with slower people can quietly cost you the room.

77 chars · 2 lines · ADAPTED · shadow bullet

AS A RESOURCE

When something needs to happen now and nobody else will move, reach for the Eight wing. It turns the Enthusiast's ideas into decisive action.

141 chars · 24 words · CLAUDE

TYPE 8 — THE PROTECTOR

Wings: Type 7 The Enthusiast · Type 9 The Peacemaker

SEVEN WING · TYPE 7 — THE ENTHUSIAST

OVERVIEW

An Eight with a strong Seven wing is more outgoing, more playful, and more entrepreneurial. The Seven wing brings optimism and a taste for life's pleasures into the Eight's intensity.

183 chars · 30 words · ADAPTED

WING BULLETS

\-   You bring appetite to everything you take on.

45 chars · 1 line · ADAPTED

\-   You see opportunity where others see only the fight.

52 chars · 1 line · CLAUDE

\-   Your intensity comes with real charm.

37 chars · 1 line · ADAPTED

\-   Others may find you more playful and expansive than they expect of an Eight.

76 chars · 2 lines · CLAUDE · perception bullet

\-   Left unchecked, two fast-moving types together can act well before thinking.

76 chars · 2 lines · ADAPTED · shadow bullet

AS A RESOURCE

When the work needs lightness or a fresh angle, reach for the Seven wing. It turns the Protector's force into something people enjoy being near.

144 chars · 25 words · CLAUDE

NINE WING · TYPE 9 — THE PEACEMAKER

OVERVIEW

An Eight with a strong Nine wing is more grounded, more patient, and more measured. The Nine wing brings calm and a quality of steady presence into the Eight's energy.

167 chars · 30 words · ADAPTED

WING BULLETS

\-   You hold your ground without needing to push.

45 chars · 1 line · ADAPTED

\-   Your power is felt before it is announced.

42 chars · 1 line · ADAPTED

\-   You stay calm when the pressure rises.

38 chars · 1 line · ADAPTED

\-   Others may find you steadier and more approachable than they expect of an Eight.

80 chars · 2 lines · CLAUDE · perception bullet

\-   Left unexamined, comfort-seeking can talk you out of a needed confrontation.

76 chars · 2 lines · ADAPTED · shadow bullet

AS A RESOURCE

When you need to lower the temperature in a room, reach for the Nine wing. It turns the Protector's strength into steady, unhurried presence.

141 chars · 24 words · CLAUDE

TYPE 9 — THE PEACEMAKER

Wings: Type 8 The Protector · Type 1 The Improver

Already in the v3 mockup. Reproduced unchanged as the voice anchor for the other eight.

EIGHT WING · TYPE 8 — THE PROTECTOR

OVERVIEW

A Nine with a strong Eight wing carries more edge, more appetite, and more willingness to push back when pushed. The Eight wing brings access to anger as a useful signal rather than something to manage away.

207 chars · 37 words · APPROVED

WING BULLETS

\-   You carry real presence, and you will protect others more readily than yourself.

80 chars · 2 lines · APPROVED

\-   You can be direct, and you will confront something that matters to you.

71 chars · 2 lines · APPROVED

\-   Once you know where you stand, you act on it.

45 chars · 1 line · APPROVED

\-   Others may find you more grounded and forceful than your easygoing manner suggests.

83 chars · 2 lines · APPROVED · perception bullet

\-   Left unexamined, irritation can arrive suddenly and then vanish back into accommodation.

88 chars · 2 lines · APPROVED · shadow bullet

AS A RESOURCE

When you need to hold a position, take up space, or act decisively, reach for the Eight wing. It turns the Peacemaker's steadiness into something with backbone.

160 chars · 27 words · APPROVED

ONE WING · TYPE 1 — THE IMPROVER

OVERVIEW

A Nine with a stronger One wing carries more structure, more attention to doing things properly, and more internal discipline. The One wing brings a sense that things should be a certain way.

191 chars · 33 words · APPROVED

WING BULLETS

\-   You follow through on things, where Nine energy on its own might drift.

71 chars · 2 lines · APPROVED

\-   You hold standards and want things done right.

46 chars · 1 line · APPROVED

\-   You bring care and craft to what you take on.

45 chars · 1 line · APPROVED

\-   Others may find you more orderly and idealistic than they expect of a Nine.

75 chars · 2 lines · APPROVED · perception bullet

\-   Left unchecked, quiet perfectionism can turn self-forgetting into self-judgment.

80 chars · 2 lines · APPROVED · shadow bullet

AS A RESOURCE

When you need focus, standards, or the discipline to finish something important, reach for the One wing. It channels the Peacemaker's acceptance into something more purposeful.

176 chars · 26 words · APPROVED