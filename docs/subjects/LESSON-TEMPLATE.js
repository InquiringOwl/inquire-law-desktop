/* LESSON TEMPLATE: a block lesson (Concept · Intermediate · Formal), in page order.
   Copy into web/content/<field>/<id>.js and fill every field. The brief is docs/subjects/LAYERS.md; the finished
   reference page is web/content/template-field/lesson-template.js. Not loaded by the app (docs/ is never built).

   Voice:  [5G] = Concept/Intermediate voice: 5th-grade reading level, adult tone, sentences under ~15 words, "you" + a verb,
                  no "just/simply/easy/obviously", no exclamation marks, praise, "Let's" or emoji.
           [COL] = Formal voice: law-school precision, standard terms and citations (cases, statutes, Restatements, model rules).
   Markup: backtick strings are HTML; math in <span class="m">…</span>, lab colours with class c1–c5 (= the lab's keys);
           never `${` inside a backtick string. Plain "…" strings are escaped text (no tags).
   Lab:    chips {label, lab: "cmd:arg,cmd"} use ONLY commands your lab exposes; `echo` and goal `key`s use ONLY values it
           publishes (table in LAYERS.md → "Your lab"). Storyboards: LAYERS.md → "Storyboards".
   Checks: answers a learner types are checked by the page itself (parts[].ans); validate.js checks each ans appears in its worked answer. */

window.ARITH = window.ARITH || {};

ARITH["<id>"] = {
  // ---- kept from the old page (used by notes, glossary, the learning path; fix only what is wrong) ----
  title: "…", short: "…", grade: "…", hours: 2, voice: "plain",
  eyebrow: "Area · subtopic",
  hero: `…`,                         // one short line of math in the lab's colours
  lede: `…`,                         // [COL] the Formal tab's header lede: 1–2 precise sentences
  plain: `<p>…</p>`,                 // used by study notes; keep, tidy to [5G]
  formal: `<p>…</p><div class="display">…the boxed definition (exactly one .display)…</div>`,   // [COL]
  legend: [{ c: "c1", sym: `…`, name: "…", desc: "…" }],   // 3–5 keys = the lab's colour keys; [5G] desc
  steps: { title: "How to …", items: [`…`] },               // 3–6 steps, [5G]
  example: { prompt: `…`, lines: [{ math: `…`, note: "…" }], answer: `…` },   // the one situation (same numbers as the walk)
  why: `<p>…</p>`, careers: [{ role: "…", use: "…" }], life: ["…"], fields: [{ name: "…", use: "…" }],

  layers: {
    nudge: "Not yet. …this lesson's usual slip…",           // first "Not yet." in every checker on the page

    concept: {
      lede: `…`,                                             // [5G] the question this topic answers, 1–2 sentences
      heading: "What is …?",
      question: { text: "…?", sub: `…point at the model above…`,          // 1–4 word question
        figure: { sym: `<i>n</i>`, value: "…", cap: "…", echo: "<published key>" } },
      ideasTitle: "Three ideas, all in the model",
      objects: ["…", "…s"],                                  // every word form of the things counted/measured (violet cue)
      walk: { title: "<Verb> it together: <the situation>",  // the lesson's own verb; "Work it together" if none fits
        lead: `One situation, step by step. Try each question before you show the next line.`,
        prompt: `…the situation, with its numbers…`,
        demo: { kind: "…", alt: "…full sentence…" },        // still picture; each line shows frame `frame`
        lines: [
          { math: `…`, note: `…[5G]…`, frame: 0 },
          { math: `…`, note: `…`, frame: 1 }
          // 4–7 lines: set up → do it → the classic shortcut → why it fails → the fix / the answer
        ],
        predict: [null,                                      // one per line; null = show it at once
          { ask: `…?`, parts: [{ label: "…", ans: 0 }], hint: `…` },
          { ask: `…?`, choices: [{ t: "…", ok: true }, { t: "…", why: "…why this is wrong…" }], hint: `…` }],
        answer: `…one sentence…` },
      ideas: [                                               // 2–4 cards
        { c: "c1", title: "≤ 6 words", term: "the real word", text: `≤ 25 words, [5G]`,
          demo: { kind: "…", alt: "…" }, try: { label: "…verb phrase…", lab: "…" } }
      ],
      timelineTitle: "…", timelineLead: `…tie to the lab…`,
      timeline: [{ when: "About …", what: `…` }],            // 3–5 beats, verified
      history: `<p><b>The problem.</b> …</p>\n<p><b>The solution.</b> …</p>\n<p><b>What it changed.</b> …</p>`,
      sources: [{ title: "…", url: "https://…" }],          // 2–4 pages you opened
      matters: { title: "Why … comes first", text: `<p>…serif lead…<b>key phrase</b>…</p><ul class="why-chips"><li>…</li><li>…</li><li>…</li></ul><p>…</p>` },
      stakes: { title: "Where … goes wrong", lead: `…`, items: [{ role: "…", text: `…` }], try: { label: "…", lab: "…" } },   // 3–4 items
      examplesTitle: "Where you will meet it",
      examples: [{ role: "…", figure: "…headline number…", scene: `…real numbers, <span class="m">…</span>…`, takeaway: "…" }]   // 5–6
    },

    build: {
      lede: `…the routine in one sentence…`,
      task: { text: "…instruction…", sub: `…`, figure: { sym: `…`, value: "…", cap: "in the model", echo: "<key>" },
        jump: [{ label: "The method", to: "b-method" }, { label: "Everyday tasks", to: "b-tasks" }] },
      keysTitle: "What the model shows",
      intro: `<p>…how to read the model…</p>`,
      keyTry: [null],                                        // one per legend key: chip or null
      objects: ["…"],
      goalsIntro: `…how many steps have a move… press <b>Check my move</b>…`,
      stepWhy: [`…`],                                        // same count as steps.items
      stepTry: [null],                                       // chip or null per step (never on a goal step)
      stepGoal: [null, { key: "<published key>", eq: 0, text: `…do this in the model…`, after: `…what it shows…`, notYet: `…what is missing…` }],   // 2–3 goals
      matters: { title: "Why a Method …", text: `<p>…</p><ul class="why-chips"><li>…</li></ul><p>…</p>` },
      bridge: `<p>…link the walk's pattern to daily life…</p>`,
      tasksTitle: "Everyday tasks: solve them",
      tasks: [                                               // 4–5, from `life`
        { task: "…", check: { q: `…`, parts: [{ label: "…", ans: 0 }], hint: `…` }, figure: "…",
          demo: { kind: "…", alt: "…" },
          lines: [{ math: `…`, note: "…" }], predict: [null, { ask: `…`, parts: [{ label: "…", ans: 0 }], hint: `…` }],
          link: `…ties back to a step or the walk…` }
      ]
    },

    formal: {
      question: { text: "…precise question…", sub: `…`, figure: { sym: `…`, value: "…", cap: "…", echo: "<key>" },
        jump: [{ label: "Vocabulary", to: "f-vocab" }, { label: "Where it goes wrong", to: "f-mist" }, { label: "Writing it out", to: "f-setup" }, { label: "Practice", to: "f-prac" }] },
      vocabTitle: "From your words to the textbook's",
      vocabIntro: `<p>Each card is an idea you already used in the Concept and Intermediate tabs, with its proper name and its exact meaning.</p>`,
      vocab: [{ c: "c1", sym: `…`, term: "…", def: `…[COL]…`, was: "…the everyday name…" }],   // 4–8
      matters: { title: "Why the exact words matter", text: `<p>…one case where a word changes the answer…</p>` },
      mistakesTitle: "Where formal answers go wrong", mistakesLead: `…`,
      setupIntro: `<p>The … from the Concept tab, written the way a textbook would.</p>`,
      setup: { title: "Writing a … problem", items: [{ say: `<b>…</b> …`, math: `<span class="m">…</span>` }] },   // 4–6
      practiceTip: `Type your answer and press Check. …`,
      practiceDone: "All 5 solved. You can … the formal way.",
      checks: [{ hint: `…`, parts: [{ label: "…", ans: 0 }] }]   // one per practice item; each ans appears in its `a`
    }
  },

  prereqWhy: {}, unlocksWhy: {}, beyond: [{ field: "…", why: "…" }],
  mistakes: [{ wrong: `…`, fix: `…` }],                     // 3–5, include the classic trap
  practice: [{ ctx: "…", q: `…`, a: `…<b>answer</b>…` }],   // 5; item 5 = "Write an expression … then solve: …"
  origin: `…`
};
