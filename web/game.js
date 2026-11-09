"use strict";

(() => {
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = "spelling-speurtocht.v1";
  const blankProgress = () => ({ xp: 0, rounds: 0, correct: 0, best: 0, missed: [] });
  let progress = blankProgress();
  let questions = [];
  let activeChoices = [];
  let queue = [];
  let index = 0;
  let answered = false;
  let points = 0;
  let streak = 0;
  let correct = 0;
  let mistakes = [];
  let view = "home";
  let beforeBadges = [];
  let storageWorks = true;
  let mode = "article";

  function notice(message) {
    $("notice").textContent = message;
    $("notice").hidden = false;
  }

  function readProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return;
      const data = JSON.parse(raw);
      if (!data || !["xp", "rounds", "correct", "best"].every(key =>
        Number.isSafeInteger(data[key]) && data[key] >= 0 && data[key] <= 1000000000) ||
        !Array.isArray(data.missed) || data.missed.length > 1000 ||
        !data.missed.every(id => typeof id === "string" && id.length < 100)) {
        throw new Error("Invalid progress");
      }
      progress = { xp: data.xp, rounds: data.rounds, correct: data.correct,
        best: data.best, missed: [...new Set(data.missed)] };
    } catch {
      notice("Je bewaarde voortgang kon niet worden gelezen. Je kunt gewoon oefenen; deze ronde begint opnieuw.");
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      storageWorks = false;
      notice("Deze browser kan je voortgang niet bewaren. Je kunt wel spelen, maar na het sluiten ben je de nieuwe punten kwijt.");
    }
  }

  function earnedBadges() {
    return [progress.rounds >= 1, progress.best >= 5, progress.correct >= 50];
  }

  function updateHome() {
    $("total-xp").textContent = progress.xp;
    $("total-rounds").textContent = progress.rounds;
    $("best-streak").textContent = progress.best;
    ["badge-first", "badge-streak", "badge-expert"].forEach((id, i) => {
      const earned = earnedBadges()[i];
      $(id).classList.toggle("earned", earned);
      $(id).title = earned ? "Verdiend!" : "Nog te ontdekken";
      $(id).setAttribute("aria-label", $(id).textContent.trim() + (earned ? ": verdiend" : ": nog te ontdekken"));
    });
    $("journey-note").textContent = progress.missed.length
      ? "Lastige woorden komen in je volgende tocht weer terug."
      : progress.rounds ? "Klaar voor een nieuwe ontdekking?" : "Jouw eerste avontuur begint met één woord.";
  }

  function showView(nextView) {
    view = nextView;
    ["home", "play", "results"].forEach(id => { $(id).hidden = id !== view; });
    updateHome();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function shuffled(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function identity(q) {
    return q.type === "article" ? "noun:" + q.word.noun : "verb:" + q.word.verb;
  }

  function startRound(retryItems) {
    mode = document.querySelector('input[name="mode"]:checked').value;
    const level = $("level").value;
    const pool = questions.filter(q => (mode === "mixed" || q.type === mode) &&
      (level === "all" || q.word.level === level));
    const missedSet = new Set(progress.missed);
    // Give previous mistakes priority, then fill with a fresh, shuffled selection.
    // Use each verb only once per mixed round to avoid revealing the next answer.
    let ordered = retryItems || [
      ...shuffled(pool.filter(q => missedSet.has(q.id))),
      ...shuffled(pool.filter(q => !missedSet.has(q.id)))
    ];
    if (!retryItems) {
      const starters = [];
      // Balanced whole-word rounds prevent guessing from the selected rule.
      if (["past-word", "participle-word"].includes(mode)) {
        starters.push(...shuffled([
          ...ordered.filter(q => q.word.ending).slice(0, 5),
          ...ordered.filter(q => !q.word.ending).slice(0, 5)
        ]));
      } else if (mode === "article") {
        starters.push(...shuffled([
          ...ordered.filter(q => q.word.article === "de").slice(0, 5),
          ...ordered.filter(q => q.word.article === "het").slice(0, 5)
        ]));
      }
      const groups = mode === "mixed" ? [
        q => q.type === "participle", q => q.type === "past", q => q.type === "article",
        q => q.type === "past-word" && q.word.ending,
        q => q.type === "past-word" && !q.word.ending,
        q => q.type === "participle-word" && q.word.ending,
        q => q.type === "participle-word" && !q.word.ending
      ] : [];
      for (const matches of shuffled(groups)) {
        const question = ordered.find(q => matches(q) &&
          !starters.some(item => identity(item) === identity(q)));
        if (question) starters.push(question);
      }
      ordered = [...starters, ...ordered];
    }
    const seen = new Set();
    queue = ordered.filter(q => {
      if (seen.has(identity(q))) return false;
      seen.add(identity(q));
      return true;
    }).slice(0, 10);
    if (!queue.length) {
      notice("Geen woorden gevonden. Kies een andere route.");
      return;
    }
    index = 0; points = 0; streak = 0; correct = 0; mistakes = [];
    beforeBadges = earnedBadges();
    showView("play");
    renderQuestion();
  }

  function current() { return queue[index]; }

  function ending(q) {
    return q.word.ending + (["past", "past-word"].includes(q.type) ? "e" : "");
  }

  function target(q) {
    if (q.type === "article") return q.word.article;
    return q.word[q.type.replace("-word", "")];
  }

  function answerText(q) {
    return q.type === "article" ? `${q.word.article} ${q.word.noun}` : target(q);
  }

  function typeLabel(q) {
    if (q.type === "article") return "lidwoord";
    return q.type.startsWith("past") ? "verleden tijd" : "voltooid deelwoord";
  }

  function renderSentence(q, reveal) {
    const fullWord = target(q);
    const sentenceType = q.type.replace("-word", "");
    const [before, after] = q.type === "article" ? ["", " " + q.word.noun] :
      q.word[sentenceType + "Sentence"].split("{word}");
    const wordSpan = document.createElement("span");
    wordSpan.className = "word-gap";
    // A d/t already in the stem is not doubled in a participle (gewacht, geantwoord).
    // Whole-word questions hide the complete form, including any sound change.
    const wholeWord = q.type.endsWith("-word") || q.type === "article";
    const size = wholeWord ? fullWord.length : q.type === "past" ? 2 : 1;
    wordSpan.append(document.createTextNode(fullWord.slice(0, -size)));
    const gap = document.createElement("span");
    gap.className = reveal ? "filled" : "blank";
    gap.textContent = reveal ? fullWord.slice(-size) : q.type === "past" ? "…e" : "…";
    if (!reveal) gap.setAttribute("aria-label", q.type === "article" ? "kies de of het" : wholeWord ? "kies het hele woord" :
      "kies " + (q.type === "past" ? "de of te" : "d of t"));
    wordSpan.append(gap);
    $("sentence").replaceChildren(document.createTextNode(before), wordSpan, document.createTextNode(after));
  }

  function renderQuestion() {
    answered = false;
    const q = current();
    const wholeWord = q.type.endsWith("-word");
    const numbered = wholeWord || q.type === "article";
    $("question-type").textContent = q.type === "article" ? "LIDWOORDEN · DE OF HET" : wholeWord ?
      typeLabel(q).toUpperCase() + " · KIES HET WOORD" :
      q.type === "past" ? "VERLEDEN TIJD · -DE OF -TE" : "VOLTOOID DEELWOORD · -D OF -T";
    $("play-title").textContent = q.type === "article" ? "Is het de of het?" : wholeWord ? "Welk woord past hier?" : "Welke uitgang past hier?";
    $("prompt-label").textContent = q.type === "article" ? "Woord: " : "Hele werkwoord: ";
    $("verb").textContent = q.word.noun || q.word.verb;
    $("question-count").textContent = `Vraag ${index + 1} van ${queue.length}`;
    $("progress").max = queue.length;
    $("progress").value = index;
    $("round-points").textContent = `${points} punten`;
    $("round-streak").textContent = streak ? `${streak} op een rij!` : "Een frisse start!";
    $("feedback").hidden = true;
    $("hint").hidden = true;
    $("hint-toggle").hidden = false;
    $("hint-toggle").setAttribute("aria-expanded", "false");
    let values;
    if (q.type === "article") values = ["de", "het"];
    else if (wholeWord) {
      const word = q.word;
      const swapped = target(q).slice(0, -1) + (word.ending === "d" ? "t" : "d");
      const distractors = word.ending ? q.type === "past-word" ?
        [word.past.slice(0, -2) + (word.ending === "d" ? "te" : "de"), word.participle] :
        [swapped, word.past] : q.type === "past-word" ? word.distractors : word.participleDistractors;
      values = shuffled([target(q), ...distractors]);
    }
    activeChoices = numbered
      ? values.map((value, i) => ({ value, label: value, key: String(i + 1) }))
      : ["d", "t"].map(letter => ({ value: letter, label: letter + (q.type === "past" ? "e" : ""), key: letter }));
    $("answers").classList.toggle("word-answers", numbered);
    $("answers").setAttribute("aria-label", q.type === "article" ? "Kies het juiste lidwoord" : wholeWord ? "Kies het juiste woord" : "Kies de juiste uitgang");
    $("answers").replaceChildren(...activeChoices.map(choice => {
      const button = document.createElement("button");
      button.textContent = choice.label;
      button.id = "answer-" + choice.key;
      button.className = "answer-button";
      button.setAttribute("aria-label", "Kies " + choice.label);
      button.setAttribute("aria-keyshortcuts", choice.key.toUpperCase());
      if (numbered) {
        const key = document.createElement("small");
        key.className = "choice-key";
        key.textContent = choice.key;
        key.setAttribute("aria-hidden", "true");
        button.append(key);
      }
      button.addEventListener("click", () => answer(choice.value));
      return button;
    }));
    $("keyboard-note").textContent = q.type === "article" ? "Tip: kies met 1 voor de of 2 voor het. Ga verder met Enter." : wholeWord
      ? "Tip: kies met de toetsen 1, 2 of 3. Ga verder met Enter."
      : "Tip: kies met de toetsen D of T. Ga verder met Enter.";
    renderSentence(q, false);
    $("play-title").focus({ preventScroll: true });
  }

  function clue(q, full) {
    const word = q.word;
    if (q.type === "article") {
      if (!full) return word.rule === "diminutive" ? "Dit is een verkleinwoord in het enkelvoud. Welk lidwoord hoort bij zo’n klein woord?" :
        word.rule === "plural" ? "Dit woord staat in het meervoud. Welk lidwoord gebruik je bij meer dan één?" : word.hint;
      const rule = word.rule === "diminutive" ? "Een verkleinwoord in het enkelvoud krijgt het." :
        word.rule === "plural" ? "Bij een meervoud gebruik je de, ook bij verkleinwoorden." :
        "Leer het lidwoord samen met het woord. Er is geen vaste regel die voor alle zelfstandige naamwoorden werkt.";
      return `Je zegt: ${answerText(q)}. ${rule}`;
    }
    if (!word.ending) {
      if (q.type === "participle-word") {
        if (!full) return `Denk aan het rijtje: ${word.verb} → ${word.past} → … . Je zoekt het voltooid deelwoord van een sterk werkwoord.`;
        return `Het rijtje is ${word.verb} → ${word.past} → ${word.participle}. ` +
          `In deze zin hoort het voltooid deelwoord: ${word.participle}. Leer dit rijtje door te oefenen; gebruik hier niet ’t kofschip.`;
      }
      if (!full) return `Zeg: ‘Vandaag ${word.present} ik. Gisteren … ik.’ De klank ${word.presentSound} verandert in ${word.pastSound}. Welk woord past daarbij?`;
      return `Nu: ik ${word.present}. Toen: ik ${word.past}. De klank ${word.presentSound} verandert in ${word.pastSound}. ` +
        "Dit is een sterk werkwoord. Je leert de verleden tijd door het rijtje te oefenen. Gebruik hier niet ’t kofschip of zomaar -de of -te.";
    }
    const raw = word.verb.slice(0, -2);
    const inShip = word.ending === "t";
    let text = `Haal -en weg: ${word.verb} → ${raw}. Kijk naar ${word.sound === "ch" ? "de ch" : "de laatste letter: " + word.sound}. `;
    if (!full) return text + "Staat die in t, k, f, s, ch, p of x?";
    text += `${word.sound === "ch" ? "Ch staat" : "De " + word.sound + " staat"} ${inShip ? "wel" : "niet"} in ’t kofschip${word.sound === "x" ? " + x" : ""}. Dus kies je -${ending(q)}.`;
    if (word.sound === "v" || word.sound === "z") {
      text += ` Let op: gebruik de ${word.sound} van ${word.verb}, ook al schrijf je bij ‘ik’ een ${word.sound === "v" ? "f" : "s"}.`;
    }
    if (["past", "past-word"].includes(q.type) && /(dd|tt)e$/.test(word.past)) {
      text += ` De ik-vorm eindigt al op ${word.ending}. Die blijft staan: ${word.past.slice(0, -2)} + ${ending(q)} = ${word.past}.`;
    }
    if (["participle", "participle-word"].includes(q.type) && /(dd|tt)e$/.test(word.past)) {
      text += " Er komt geen dubbele d of t aan het einde van het voltooid deelwoord.";
    }
    return text;
  }

  function answer(value) {
    if (view !== "play" || answered || !activeChoices.some(choice => choice.value === value)) return;
    answered = true;
    const q = current();
    const correctValue = q.type.endsWith("-word") || q.type === "article" ? target(q) : q.word.ending;
    const right = value === correctValue;
    activeChoices.forEach(choice => {
      const button = $("answer-" + choice.key);
      button.disabled = true;
      button.classList.toggle("correct", choice.value === correctValue);
      button.classList.toggle("incorrect", !right && choice.value === value);
    });
    if (right) {
      correct++; streak++; points += 10;
      progress.xp += 10; progress.correct++;
      progress.best = Math.max(progress.best, streak);
      progress.missed = progress.missed.filter(id => id !== q.id);
    } else {
      streak = 0;
      mistakes.push(q);
      if (!progress.missed.includes(q.id)) progress.missed.push(q.id);
    }
    saveProgress();
    renderSentence(q, true);
    $("progress").value = index + 1;
    $("round-points").textContent = `${points} punten`;
    $("round-streak").textContent = streak ? `${streak} op een rij!` : "Het volgende woord is een nieuwe kans.";
    $("hint-toggle").hidden = true;
    $("hint").hidden = true;
    $("feedback").classList.toggle("needs-practice", !right);
    $("feedback-title").textContent = right ? "Goed ontdekt! +10 punten" : `Bijna! Je schrijft ‘${answerText(q)}’.`;
    $("feedback-text").textContent = clue(q, true);
    $("word-family").textContent = q.type === "article" ? `Onthoud samen: ${answerText(q)}.` :
      `${q.word.verb} → ${q.word.past} → ${q.word.participle}`;
    $("next").textContent = index === queue.length - 1 ? "Bekijk je ontdekkingen →" : "Volgende woord →";
    $("feedback").hidden = false;
    $("next").focus({ preventScroll: true });
  }

  function finishRound() {
    progress.rounds++;
    saveProgress();
    showView("results");
    $("results-title").textContent = correct === queue.length ? "Alles goed ontdekt!" : "Goed geoefend, speurder!";
    $("results-message").textContent = correct === queue.length
      ? "Een hele tocht vol goede antwoorden. Daar mag je trots op zijn!"
      : "Elk woord dat je oefent, helpt je verder. Lastige woorden proberen we gewoon nog eens.";
    $("result-correct").textContent = `${correct} / ${queue.length}`;
    $("result-points").textContent = `+${points}`;
    const names = ["Eerste tocht", "5 op een rij", "50 goed"];
    const newlyEarned = earnedBadges().map((earned, i) => earned && !beforeBadges[i] ? names[i] : null).filter(Boolean);
    $("new-badges").hidden = !newlyEarned.length;
    $("new-badges").textContent = "Nieuwe badge: " + newlyEarned.join(" · ");
    $("review-list").hidden = !mistakes.length;
    $("retry").hidden = !mistakes.length;
    $("again").hidden = !!mistakes.length;
    $("missed-words").replaceChildren(...mistakes.map(q => {
      const item = document.createElement("li");
      item.textContent = `${q.type === "article" ? answerText(q) : q.word.verb + " → " + target(q)} · ${typeLabel(q)}`;
      return item;
    }));
    $("results-title").focus({ preventScroll: true });
  }

  function openDialog(id) { $(id).showModal(); }
  $("help-open").addEventListener("click", () => openDialog("help-dialog"));
  $("rule-open").addEventListener("click", () => openDialog("help-dialog"));
  $("settings-open").addEventListener("click", () => {
    $("reset-confirm").hidden = true;
    $("reset").hidden = false;
    openDialog("settings-dialog");
  });
  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => $(button.dataset.close).close());
  });
  $("start").addEventListener("click", () => startRound());
  $("again").addEventListener("click", () => startRound());
  $("retry").addEventListener("click", () => startRound([...mistakes]));
  $("leave").addEventListener("click", goHome);
  $("home-button").addEventListener("click", goHome);
  function goHome() {
    showView("home");
    $("start").focus({ preventScroll: true });
  }
  $("next").addEventListener("click", () => {
    if (!answered || view !== "play") return;
    index++;
    if (index === queue.length) finishRound();
    else renderQuestion();
  });
  $("hint-toggle").addEventListener("click", () => {
    $("hint").hidden = !$("hint").hidden;
    $("hint-toggle").setAttribute("aria-expanded", String(!$("hint").hidden));
    $("hint").textContent = clue(current(), false);
  });
  $("reset").addEventListener("click", () => {
    $("reset").hidden = true; $("reset-confirm").hidden = false; $("reset-no").focus();
  });
  $("reset-no").addEventListener("click", () => {
    $("reset-confirm").hidden = true; $("reset").hidden = false; $("reset").focus();
  });
  $("reset-yes").addEventListener("click", () => {
    progress = blankProgress();
    saveProgress();
    $("settings-dialog").close();
    goHome();
  });
  document.addEventListener("keydown", event => {
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || view !== "play" ||
      document.querySelector("dialog[open]")) return;
    const key = event.key.toLowerCase();
    const choice = activeChoices.find(item => item.key === key);
    if (!answered && choice) {
      event.preventDefault(); answer(choice.value);
    } else if (answered && event.key === "Enter") {
      event.preventDefault(); $("next").click();
    }
  });

  async function init() {
    readProgress();
    updateHome();
    try {
      const [words, strongWords, nouns] = await Promise.all(["/words.json", "/strong-words.json", "/nouns.json"].map(async path => {
        const response = await fetch(path, { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load words");
        return response.json();
      }));
      questions = [
        ...words.flatMap(word => ["participle", "past"].map(type => ({ id: `${word.verb}:${type}`, type, word }))),
        ...words.map(word => ({ id: `${word.verb}:past-word`, type: "past-word", word })),
        ...strongWords.map(word => ({ id: `${word.verb}:strong`, type: "past-word", word })),
        ...[...words, ...strongWords].map(word => ({ id: `${word.verb}:participle-word`, type: "participle-word", word })),
        ...nouns.map(word => ({ id: `noun:${word.noun}:article`, type: "article", word }))
      ];
      const validIds = new Set(questions.map(q => q.id));
      progress.missed = progress.missed.filter(id => validIds.has(id));
      // Probe storage even before the first answer so blocked storage is visible.
      saveProgress();
      if (storageWorks) updateHome();
      $("start").disabled = false;
      $("start").textContent = "Start de speurtocht →";
    } catch {
      notice("De woorden konden niet worden geladen. Start het spel met Start.command of python3 server.py en vernieuw de pagina.");
      $("start").textContent = "Vernieuw de pagina";
    }
  }
  init();
})();
