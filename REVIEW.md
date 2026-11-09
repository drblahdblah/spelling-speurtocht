# Architecture, code and security review

Reviewed 5 November 2026 using the requested `architecture-python-platform-review`,
`code-review` and `security-review` skills. This is a self-review of the new
project plus automated checks and interactive browser verification.

## Architecture map and assumptions

```text
Parent launches Python process
  └─ 127.0.0.1:8765, read-only HTTP asset server
       └─ Browser: local HTML / CSS / JavaScript / SVG / curriculum JSON
            └─ localStorage: aggregate scores and missed exercise IDs
```

The intended user is one learner (a child with a parent, or an adult), in one browser tab/profile, on one
computer. The interface assumes the child can read short Dutch sentences. It
does not require an age, name, account, database, Docker, or internet connection.
No availability SLA or recovery requirement was requested. The parent restarts
the process if needed; browser progress has no backup and can be reset or lost
when browser storage is cleared. Scores are for encouragement, not assessment.

Python owns asset delivery and the launch boundary. The browser owns questions,
answers and progress. The JSON word bank keeps explicit, reviewable inflections
and sentence templates separate from interaction logic. No runtime dependencies
or package installation are needed. This keeps the requested single-command
launch small and makes the offline boundary inspectable.

## Review conclusions

No unresolved blocking correctness, architecture or security findings were
identified within this scope. This conclusion is limited by the checks below;
it is not a claim of comprehensive security certification or a formal language
curriculum review.

Issues corrected during implementation and review:

- The server uses an asset allowlist rather than exposing the project directory.
  Source, tests, documentation, parent folders and encoded traversal paths are
  inaccessible through HTTP.
- Host validation restricts requests to the printed local origin or localhost
  with the same port. There are no server write endpoints or permissive CORS
  headers. Only the loopback interface is bound.
- Repeated answer clicks/keys cannot score the same question twice. Keyboard
  shortcuts pause while a modal is open; repeated keydown events are ignored.
- Invalid or unavailable browser storage produces a notice and permits practice.
  Saved numeric counters and exercise IDs are validated; unknown IDs are removed.
- Missed-word retries retain the original question type. Mixed rounds use each
  verb at most once, so one form does not immediately reveal its partner.
- Corrected the exercise-tile CSS selector after the full-page screenshot exposed
  a wrapping `de / te` label: the fieldset legend affected child numbering.
- Checked sentence auxiliaries, including `Ik ben naar school gefietst` and
  `Het vliegtuig is geland`.

## Security boundary

HTTP paths and headers are untrusted. Paths select from eight fixed asset routes;
they are never appended to a filesystem directory. Local browser storage is also
untrusted: numeric values are bounded and missed IDs validated against the word
bank. Curriculum text is rendered with text nodes/textContent, not HTML parsing.

The application has no credentials, authentication, personal-data inputs, external
requests, filesystem writes through HTTP, or server-side score persistence.
Response headers restrict scripts, styles, images and connections to this origin,
disable framing, block content-type sniffing and suppress referrers. No browsing
or answer history is written to server request logs. The browser still makes
local HTTP requests for the files, including fetches of `words.json` and
`strong-words.json` and `nouns.json`.

Anyone who already controls the computer/browser profile can inspect or change
game scores. The included HTTP server is intended for this local-only game,
not public hosting. Browser extensions, browser updates and operating-system
network traffic are outside the application's offline guarantee.

## Initial d/t version verification

- `python3 -m unittest discover -s tests -v`: **10 tests passed**. Covers each
  asset, security headers, HEAD/query behavior, loopback binding, foreign Host
  rejection, disallowed files/traversal, unsupported POST, complete curriculum
  templates, d/t suffix selection, known tricky forms, level coverage, and
  absence of remote resource URLs in application assets.
- `python3 -m compileall -q server.py tests`: passed on Python 3.8.2.
- `zsh -n Start.command`: passed; executable permission verified.
- Started the actual server and loaded it in the in-app browser. Completed a
  participle round with one intentional mistake: **9/10, 90 points**, first-round
  and five-in-a-row badges. Retried the missed word in a one-question round.
- Reloaded the page and verified saved points, completed rounds and best streak.
- Completed the harder simple-past route: **10/10, 100 points**, including
  `antwoordde`, `zette`, `redde`, `brandde`, `wachtte`, `proefde` and `reisde`.
- Completed a mixed beginner round: **10/10, 100 points**, both question types,
  with no repeated verbs. Tested both mouse and D/T/Enter keyboard controls.
- Opened hints and the rule dialog during play; verified D does not submit an
  answer while the modal is open. Escape closes the modal.
- Verified reset displays a separate confirmation and its cancel action preserves
  progress. Final deletion was not needed for QA.
- Inspected desktop and 390px mobile screenshots; verified document width matches
  the viewport at 390px and 320px (no horizontal page overflow).
- Browser console: no errors or warnings observed during these interactions.

## Limits and useful next verification

The interactive checks used the available in-app browser. Safari/Firefox and
launching by double-click in Finder were not separately exercised. The launcher
was syntax-checked and made executable; its underlying Python server was run.
Storage denial/corruption paths were inspected in code, not forced through browser
settings. The 50-correct badge threshold was reviewed but not reached in UI QA.
The initial source and tests covered 82 exercises; UI QA sampled them across routes.

The next useful check is a short session with the child: whether the Dutch wording
and difficulty match his reading level, and whether he can explain the rule after
answering. The game deliberately excludes present-tense d/t/dt. A Dutch teacher
could review vocabulary and sentence level before a wider
classroom use. No broader platform components are needed for the requested use.

## Extension: sound-changing strong verbs

The extension adds 30 explicit singular simple-past exercises under **De klank
verandert**, using the existing ten-question round, score, badge and retry flows.
The complete word is hidden until answered. Three shuffled whole-word choices
replace the two ending buttons for these questions; keys 1/2/3 correspond to the
visible order. D/T remain scoped to ending questions. Hints describe a sound
change; feedback displays the correct sentence and word family. The help now
distinguishes strong verbs from weak verbs and avoids applying ’t kofschip to
strong-verb questions. A full mixed round includes all three types.

The only server change is one public allowlisted curriculum asset. The data
remains local, text rendering uses textContent/text nodes, and score writes keep
the existing single-answer guard. The storage key and legacy exercise IDs remain
unchanged; strong exercises add `verb:strong` IDs. Existing progress therefore
requires no migration. Already-running Python processes must be restarted to
load the additional route.

Review found no unresolved blocking correctness or security issues in this
extension's scope. Main regression checks cover changing between whole-word and
ending questions, randomized choices and matching keyboard keys, storing/retrying
the right question type, and keeping old progress compatible. This remains a
self-review, not an independent review or a formal curriculum certification.

Current automated validation: **13 tests passed**, including the original HTTP,
curriculum and offline-asset checks, plus checked strong-form pairs, unambiguous
choices, complete sentences, distinct sound cues and ten-question capacity for
both difficulty levels. Forms were checked against Genootschap Onze Taal's
strong-verb reference. The bank contains 71 verbs and 112 exercises in total.

Interactive extension checks in the in-app browser:

- Easier strong-verb round: 9/10 and 90 points after one intentional mistake.
  All three numbered keys worked. The missed word retained its whole-word format
  in a one-question retry; points, rounds and streak persisted after reload.
- Harder strong-verb round: 10/10 and 100 points, including `schreef`, `bleef`,
  `sneed`, `vergat` and `sprak`.
- Mixed round: 10/10 and 100 points, with all three question types and no repeated
  verbs. Ending choices and whole-word choices changed correctly between questions.
- The strong-verb help opened during play; key 1 did not submit an answer while
  the modal was open. Escape closed it and preserved the unanswered question.
- Confirmed D/T still work in the original ending modes. Inspected the three-word
  layout at 390px and 320px. Whole words cannot wrap inside answer buttons; the
  buttons move to another row when necessary. No horizontal page overflow.

The game on the parent's original port was left running during QA. The updated
server was tested on a separate loopback port. Cross-browser and Finder launch
limits from the original review still apply. At that stage, the strong mode tested
singular simple-past forms and displayed participles as a memory aid. The November
9 extension below adds participle questions and regular forms to whole-word tests.

## Extension: articles and broader verb tests (9 November 2026)

Added a curated article bank with 60 noun forms, balanced by de/het in both word
sets. Feedback repeats the article+noun pair. Grammatical hints distinguish
singular diminutives (het) from plurals (de), including plural diminutives; they
do not imply a universal noun-gender rule. Dual-article nouns are excluded from
this initial bank. Guidance was checked against Onze Taal's de/het explanation
and common het-word list.

The old strong-only past mode becomes **Verleden tijd**, with five regular and
five strong verbs per full round. Added **Voltooid deelwoord** whole-word practice
with the same balance. Question labels give the tense, not the verb class; hints
and feedback teach the relevant rule. The focused regular d/t and de/te drills
remain available. Mixed rounds include article questions, both ending drills,
and regular/strong examples of both whole-word formats, with no repeated verb or
noun. Retries retain their original type and can be shorter.

The curriculum now has 71 verbs, 60 noun forms and 284 exercise records. Strong
participles use explicit sentence templates and incorrect alternatives. Regular
choices vary the suffix of the known form or use a form from the other tense;
correct conjugations are not inferred. Article answers use numeric keys 1/2;
whole-word verbs use 1/2/3; focused endings use D/T. All answer types share the
single-answer guard, scoring, retry handling, and modal keyboard guard.

The storage key and previous IDs remain unchanged, including `verb:strong` for
the former strong-only past questions. New regular full-past, full-participle and
article questions receive distinct IDs. Existing scores and misses need no
migration. A namespaced identity distinguishes nouns from verbs when selecting a
round. The server change is one additional public allowlisted JSON route. Text
continues to render as text nodes, and there are no new external requests,
dependencies, server writes, or personal-data fields.

No unresolved blocking correctness, architecture or security findings were
identified in the extension self-review. Scope remains a local single-profile,
single-tab learning game. The source is not a complete Dutch grammar or dictionary.

Validation performed for this extension:

- **18 automated tests passed** with `python3 -m unittest discover -s tests -v`.
  Added article-pair checks, singular/plural diminutive boundaries, balanced word
  sets, complete strong-participle templates and unambiguous verb alternatives.
  Existing HTTP, traversal, Host, header and offline checks still pass, including
  delivery of the new noun asset.
- The updated browser loaded 320 pre-existing points, four rounds and its prior
  badges/streak without resetting them. An article round with one intentional
  mistake scored 9/10, +90; its one-word retry retained article choices. Reload
  confirmed 420 points and six rounds.
- The article round contained five de and five het nouns. Feedback correctly
  distinguished `het jongetje`/`het kopje` from `de stoeltjes`/`de kinderen`.
- Harder whole-word past round: 10/10, +100, exactly five regular and five strong
  verbs. Examples included `antwoordde`, `leefde`, `reisde`, `sprak` and `schreef`.
  The 50-correct badge was reached and displayed.
- Easier whole-word participle round: 9/10, +90 after one deliberate miss, again
  exactly five regular and five strong verbs. The incorrect `geëet` was not
  accepted for `gegeten`; the retry kept the participle question rather than
  switching to simple past. Samples included `gelopen`, `gezeten`, `gedanst`
  and `gekookt`.
- A full mixed round scored 10/10, +100; assertions confirmed all five formats,
  regular and strong examples in both whole-word formats, and ten distinct words.
  Numeric and D/T keyboard shortcuts were exercised between formats.
- The expanded help displayed article rules and regular/strong contrasts. Pressing
  1 while help was open did not answer the underlying article question; Escape
  closed help with the question still unanswered.
- Checked 390px and 320px question layouts and 320px mode selection, with page
  scrollWidth equal to viewport width. Long answer words remain whole; buttons
  wrap to the next row. Browser console had no warnings or errors. A second answer
  key after a correct response left the question's score at 10 points.

Browser QA used a separate local port, leaving the existing server untouched.
Restarting an older server is necessary to enable the new noun route. The original
cross-browser, Finder-launch, concurrent-tab and storage-failure verification
limits still apply. Plural verb forms and broader vocabulary remain outside scope.
