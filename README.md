# Spelling Speurtocht

A small, entirely offline Dutch spelling game. Children and adults can practise at their own
pace, with ten questions per round, hints, explanations, points and three badges.
The interface and example sentences are in Dutch.

## Start

**On macOS:** double-click `Start.command` in Finder. It starts the local
server and opens your default browser. Keep its Terminal window open while
playing. Press **Ctrl+C** in that window to stop it.

**From a terminal in the project folder:**

```sh
python3 server.py
```

To download the public source first:

```sh
git clone https://github.com/drblahdblah/spelling-speurtocht.git
cd spelling-speurtocht
python3 server.py
```

Requires Python **3.8 or later** and a current Safari, Chrome, Edge or Firefox.
There are **no packages to install**, build steps, accounts, online fonts,
analytics, APIs or remote resources. No internet connection is needed to run or
play. Install Python separately if it is not already available on your computer.

The default address is **http://127.0.0.1:8765/**. If that port is already busy,
use `python3 server.py --port 8766`. Use `--no-browser` to start without opening
a browser. The server listens only on this computer's IPv4 loopback interface.

## Play

Choose a test and a word set (**Rustig beginnen**, **Extra uitdaging**, or
**Alle woorden**), then start a ten-question round.

| Test | What you practise |
| --- | --- |
| **De of het** | Choose an article for a noun, such as `het boek` or `de tafel`. |
| **Verleden tijd** | Choose the complete past-tense word. Each round has five regular and five strong verbs, such as `speelde` and `liep`. |
| **Voltooid deelwoord** | Choose the complete past participle. Each round has five regular and five strong verbs, such as `gespeeld` and `gelopen`. |
| **Alles door elkaar** | All five question formats, with both verb classes in the whole-word formats. A word appears at most once in a round. |
| **Alleen d of t** | Focused regular-verb participle endings, such as `gewerk…`. |
| **Alleen de of te** | Focused regular-verb past-tense endings, such as `werk…`. |

Click an answer, or use the displayed shortcuts: **1/2** for de/het, **1/2/3**
for whole words, **D/T** for ending drills. Press **Enter** after reading feedback
to continue. Shortcuts pause while help or settings is open.

- There is no timer; hints do not cost points.
- A correct answer earns 10 points. An incorrect answer shows the correct spelling
  and explains why. Missed words can be retried at the end and receive priority
  in future rounds of the matching type and difficulty.
- Article rounds contain five de and five het answers in random order. Whole-word
  verb rounds contain five regular and five strong verbs in random order. Retry
  rounds contain only mistakes, so can be shorter and do not enforce this balance.
- Completed rounds include retries. Points reward practice, including answering a
  word correctly again. The best streak is within a single round.
- Badges: finish a round; get five correct in a row; answer 50 questions correctly.

## Teaching scope

There are **71 verbs**, **60 noun forms**, and **284 exercises**:

- 41 regular verbs: two focused ending exercises and two whole-word exercises each.
- 30 strong verbs: complete singular past-tense and past-participle exercises each.
- 60 nouns: one de/het exercise each, split between easier everyday words and
  harder vocabulary, singular diminutives and plurals.

The whole-word verb tests require recognising whether a regular ending or a strong
form belongs in the sentence. Their question labels do not reveal the verb class.
Hints can explain the relevant rule; feedback shows the correct sentence and word
family. The original **De klank verandert** mode is now the broader **Verleden tijd**
test, with both classes. Its existing missed-word IDs are preserved.

The regular bank includes v/f and z/s changes (`leven`, `reizen`), doubled d/t in
past forms (`antwoordde`, `wachtte`), participles without an added `ge-` (`betaald`,
`ontmoet`), and x (`gefixt`). ’t Kofschip uses the infinitive without `-en`, rather
than only the ik-form: `leven → lev` uses v to choose d, giving `leefde` and `geleefd`.
This mnemonic applies to the regular past forms tested here, not to strong verbs.

Strong forms, example sentences and their incorrect alternatives are explicit
curriculum records, not output from a general-purpose conjugator. Regular
alternatives contrast the checked correct form with an incorrect d/t ending or a
form from another tense. Feedback displays only the correct completed sentence.

For articles, the help teaches learning the noun and article together, because
there is no rule that predicts every noun's article. It distinguishes **singular
diminutives with het** (`het tafeltje`) from **plurals with de**, including plural
diminutives (`de tafeltjes`). Ambiguous dual-article nouns are excluded from this
starter bank. Hints describe the noun or a useful grammatical category; feedback
reinforces the complete article+noun pair.

Present-tense d/t/dt, plural past-tense verb forms and a complete irregular-verb
or vocabulary curriculum remain outside the scope of this game.

Teaching references (documentation links only; never loaded by the game):

- [Onze Taal: ’t kofschip](https://onzetaal.nl/taalloket/t-kofschip)
- [Onze Taal: strong verbs](https://onzetaal.nl/taalloket/sterke-werkwoorden)
- [Onze Taal: de/het guidance and common het words](https://onzetaal.nl/taalloket/de-het-algemene-regels)

**Updating a running game:** stop its Terminal server with **Ctrl+C**, launch
`Start.command` again, and refresh the browser. This loads the new `nouns.json`
route. Keep the same address/port and browser profile to retain existing progress.
The saved-data key and all previous exercise IDs are unchanged.

## Progress and privacy

Points, round count, best streak, correct-answer count, and IDs of missed
exercises are kept in browser `localStorage` under `spelling-speurtocht.v1`.
The app asks for no names, ages, accounts or other personal details. It does not
record a detailed answer history or send progress to the server.

Use the **same browser profile and exact address/port** each time. `localhost`
and `127.0.0.1` have separate browser storage, as do different ports. Clearing
browser data removes progress; private browsing may discard it. If storage is
unavailable, a notice explains that new progress will not persist, and the game
still works for that visit. Incomplete rounds keep already-earned points but
do not count as completed rounds. Refreshing abandons the current round.

Use settings to reset progress, with a second confirmation. This basic version
is intended for **one learner, one browser tab**; it has no separate profiles,
progress export or concurrent-tab synchronization.

## Files and verification

`server.py` serves files from `web/` through only eight explicitly allowed public routes.
`web/game.js` owns game state and browser storage; `web/words.json` owns the
weak-verb curriculum, `web/strong-words.json` owns the strong-verb curriculum,
and `web/nouns.json` owns the article+noun curriculum;
`web/style.css` and `web/index.html` own the interface. No database,
container or cloud service is required. The parent controls launching/stopping
the server; anyone with access to this browser profile can see or reset scores.

Run the focused HTTP, privacy-boundary and curriculum checks with:

```sh
python3 -m unittest discover -s tests -v
```

See `REVIEW.md` for architecture, code and security review scope and validation.


## License and provenance

Released under the **MIT License**; see [LICENSE](LICENSE). This permits use,
modification and redistribution, including commercial use, with the license and
copyright notices retained. It does not require derivative projects to be open
source. The software is provided without warranty.

The implementation, SVG boat/icon artwork, exercise sentences and explanations
were created for this project with AI assistance and reviewed locally. No stock
images, third-party characters, web fonts, audio, or third-party library code are
bundled. The curriculum uses common Dutch language facts and project-written
examples. External teaching references are links for checking rules; their pages,
worksheets, branding and artwork are not redistributed or covered by this license.
See [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md) for the asset inventory, naming
review and limits of the publication check.

This is an independent learning project by [drblahdblah](https://github.com/drblahdblah),
not an official product of or affiliated with any referenced language organisation.
The descriptive title is not presented as a registered or exclusive trademark.
