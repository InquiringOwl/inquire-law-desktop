/* LESSON TEMPLATE (Inquire Law): the Concept · Intermediate · Formal block lesson from Inquire 1.19.0, with every text
   replaced by [placeholder] text. It is the format reference every Law lesson is built from; it holds no Law content.
   Page shape, voice and field names: docs/subjects/LAYERS.md and docs/subjects/LESSON-TEMPLATE.js.
   Lab: web/labs/template.js (exposes set, plus, play; publishes n, runs, result). */

window.ARITH = window.ARITH || {};

ARITH["lesson-template"] = {
  title: "Lesson Template",
  short: "[One line: what the learner can do after this lesson.]",
  grade: "[Course · e.g. 1L Contracts]",
  hours: 2,
  voice: "plain",
  eyebrow: "[Area] · [subtopic]",
  hero: `<span class="m">[Hero line: <span class="c1"><i>n</i></span>, <span class="c2">[key idea]</span>]</span>`,
  lede: `[Formal lede] One or two precise sentences that state the rule or doctrine this lesson teaches.`,
  plain: `<p>[Plain summary] A short, plain-language explanation of the <b>key idea</b>, used by study notes.</p>`,
  formal: `<p>[Formal statement] The rule written with standard terminology, with its source (case, statute or restatement section).</p>
<div class="display">[Boxed definition] <b>Term</b>: the exact statement of the rule, with each element named.</div>`,
  legend: [
    { c: "c1", sym: `<i>n</i>`, name: "[Key 1]", desc: "[What the amber marks in the model stand for, in plain words.]" },
    { c: "c2", sym: `+1`, name: "[Key 2]", desc: "[What the second colour in the model stands for.]" },
    { c: "c5", sym: `▶`, name: "[Key 3]", desc: "[What running the model shows.]" }
  ],
  steps: { title: "[How to … : the method in steps]", items: [
    `[Step 1] The first thing to do, in plain words.`,
    `[Step 2] The next thing to do.`,
    `[Step 3] How to check the work.`,
    `[Step 4] How to state the answer.`
  ] },
  example: {
    prompt: `[The one situation of this lesson, carried through all three tabs.] A row holds 3 items. One more is added. How many are there now?`,
    lines: [
      { math: `<span class="c1"><i>n</i></span> = 3`, note: "[Set up the situation.]" },
      { math: `3 + 1 = 4`, note: "[Apply the rule.]" },
      { math: `<span class="c1"><i>n</i></span> = 4`, note: "[State the result.]" }
    ],
    answer: `[One-sentence answer.] There are <span class="m c1">4</span> items.`
  },
  why: `<p>[Why it matters] Where this idea is used and what goes wrong without it.</p>`,
  careers: [
    { role: "[Role 1]", use: "[How someone in this job uses the idea.]" },
    { role: "[Role 2]", use: "[How someone in this job uses the idea.]" },
    { role: "[Role 3]", use: "[How someone in this job uses the idea.]" }
  ],
  life: [
    "[Everyday situation 1]",
    "[Everyday situation 2]",
    "[Everyday situation 3]",
    "[Everyday situation 4]"
  ],
  fields: [
    { name: "[Related field 1]", use: "[How that field uses this idea.]" },
    { name: "[Related field 2]", use: "[How that field uses this idea.]" }
  ],

  layers: {
    nudge: "Not yet. [This lesson's usual slip, in one short sentence.]",

    concept: {
      lede: `[Concept lede] The question this lesson answers, in one or two plain sentences.`,
      heading: "What is [the idea]?",
      question: { text: "[The question]?", sub: `[One or two sentences that point at the model above and say what to watch.]`,
        figure: { sym: `<i>n</i>`, value: "3", cap: "[what the live number means]", echo: "n" } },
      ideasTitle: "Three ideas, all in the model",
      objects: ["item", "items"],
      walk: { title: "Work it together: [the situation]",
        lead: `One situation, step by step. Try each question before you show the next line.`,
        prompt: `[The situation, with its numbers.] A row holds 3 items. One more is added. How many items are there now?`,
        demo: { kind: "dots", slots: 6, frames: [{ lit: 3 }, { lit: 4, next: true }, { lit: 4, big: 4 }], alt: "[Full-sentence description of the picture:] three items, then one more is added, then the total 4 lifts out." },
        lines: [
          { math: `<span class="c1"><i>n</i></span> = 3`, note: `[Line 1: set up the situation.]`, frame: 0 },
          { math: `3 + 1`, note: `[Line 2: do the step.]`, frame: 1 },
          { math: `<span class="c1"><i>n</i></span> = 4`, note: `[Line 3: the answer, and why it holds.]`, frame: 2 }
        ],
        predict: [null,
          { ask: `[Predict question with a typed answer] How many items after one more is added?`, parts: [{ label: "items", ans: 4 }], hint: `[A hint that nudges without giving it away.]` },
          { ask: `[Predict question with choices] Which is the total?`, choices: [
            { t: "[The right choice] 4", ok: true },
            { t: "[A tempting wrong choice] 3", why: "[Why this choice is wrong.]" }
          ], hint: `[A hint.]` }],
        answer: `[One-sentence answer.] There are <span class="m c1">4</span> items.` },
      ideas: [
        { c: "c1", title: "[Idea 1, six words or fewer]", term: "[real term]", text: `[Twenty-five words or fewer, plain words, pointing at the model.]`,
          demo: { kind: "dots", slots: 5, lit: 3, sweep: true, alt: "[Full-sentence description of the storyboard.]" }, try: { label: "[Try it: set the model to 5]", lab: "set:5" } },
        { c: "c2", title: "[Idea 2]", term: "[real term]", text: `[Twenty-five words or fewer.]`,
          demo: { kind: "dots", slots: 6, grow: [3, 4], alt: "[Full-sentence description of the storyboard.]" }, try: { label: "[Try it: press +1]", lab: "plus" } },
        { c: "c5", title: "[Idea 3]", term: "[real term]", text: `[Twenty-five words or fewer.]`,
          demo: { kind: "dots", slots: 5, lit: 5, sweep: true, big: true, alt: "[Full-sentence description of the storyboard.]" }, try: { label: "[Try it: run the model]", lab: "play" } }
      ],
      timelineTitle: "[History heading]",
      timelineLead: `[One sentence tying the history to something in the model.]`,
      timeline: [
        { when: "[Date 1]", what: `[What happened, verified, with its source below.]` },
        { when: "[Date 2]", what: `[What happened.]` },
        { when: "[Date 3]", what: `[What happened.]` }
      ],
      history: `<p><b>The problem.</b> [What people needed to solve.]</p>
<p><b>The solution.</b> [How the rule or doctrine answered it.]</p>
<p><b>What it changed.</b> [What it changed, tied back to the model.]</p>`,
      sources: [
        { title: "[Source title (publisher)]", url: "https://example.com/" }
      ],
      matters: { title: "Why [the idea] matters", text: `<p>[Serif lead sentence with a <b>key phrase</b>.]</p><ul class="why-chips"><li>[Fact 1]</li><li>[Fact 2]</li><li>[Fact 3]</li></ul><p>[Closing sentence.]</p>` },
      stakes: { title: "Where [the idea] goes wrong", lead: `[One sentence: the classic trap.]`, items: [
        { role: "[Setting 1]", text: `[What goes wrong there.]` },
        { role: "[Setting 2]", text: `[What goes wrong there.]` },
        { role: "[Setting 3]", text: `[What goes wrong there.]` }
      ], try: { label: "[Try it: set the model to 0]", lab: "set:0" } },
      examplesTitle: "Where you will meet it",
      examples: [
        { role: "[Role 1]", figure: "[Headline 1]", scene: `[A real scene with real numbers.]`, takeaway: "[One-line takeaway.]" },
        { role: "[Role 2]", figure: "[Headline 2]", scene: `[A real scene with real numbers.]`, takeaway: "[One-line takeaway.]" },
        { role: "[Role 3]", figure: "[Headline 3]", scene: `[A real scene with real numbers.]`, takeaway: "[One-line takeaway.]" }
      ]
    },

    build: {
      lede: `[Intermediate lede] The routine for applying the idea, in one sentence.`,
      task: { text: "[The task: an instruction.]", sub: `[One or two sentences: the same moves work every time; try each in the model.]`,
        figure: { sym: `<i>n</i>`, value: "3", cap: "in the model", echo: "n" },
        jump: [{ label: "The method", to: "b-method" }, { label: "Everyday tasks", to: "b-tasks" }] },
      keysTitle: "What the model shows",
      intro: `<p>[How to read the model: what each colour and control means.]</p>`,
      keyTry: [{ label: "[Set the model to 6]", lab: "set:6" }, { label: "[Press +1]", lab: "plus" }, null],
      objects: ["item", "items"],
      goalsIntro: `Two of the steps have a move for you to make in the model. Make the move, then press <b>Check my move</b>. A move also ticks itself off as soon as the model shows it.`,
      stepWhy: [
        `[Why step 1 works.]`,
        `[Why step 2 works.]`,
        `[Why step 3 works.]`,
        `[Why step 4 works.]`
      ],
      stepTry: [{ label: "[Set the model to 2]", lab: "set:2" }, null, null, null],
      stepGoal: [null,
        { key: "n", eq: 9, text: `[Your move:] Make the model show 9.`, after: `[What the model shows once the move is made.]`, notYet: `Not yet. [What is still missing.]` },
        { key: "runs", min: 1, text: `[Your move:] Press <b>Run</b> and let it finish.`, after: `[What the run showed.]`, notYet: `Not yet. Press <b>Run</b> in the model.` },
        null],
      matters: { title: "Why a Method Beats a Guess", text: `<p>[Serif lead with a <b>key phrase</b>.]</p><ul class="why-chips"><li>[Fact 1]</li><li>[Fact 2]</li></ul><p>[Closing sentence.]</p>` },
      bridge: `<p>[Link the worked situation to everyday tasks below.]</p>`,
      tasksTitle: "Everyday tasks: solve them",
      tasks: [
        { task: "[Everyday situation 1]", check: { q: `[Problem 1] A row holds 2 items and 3 more are added. How many items?`, parts: [{ label: "items", ans: 5 }], hint: `[Hint.]` }, figure: "[5 items]",
          demo: { kind: "dots", slots: 6, grow: [2, 5], alt: "[Full-sentence description of the picture.]" },
          lines: [{ math: `2 + 3`, note: "[First line of the worked solution.]" }, { math: `= 5`, note: "[Answer line.]" }],
          predict: [null, { ask: `[Predict the answer line.] What is 2 + 3?`, parts: [{ label: "2 + 3", ans: 5 }], hint: `[Hint.]` }],
          link: `[Ties back to a step or the worked situation.]` },
        { task: "[Everyday situation 2]", check: { q: `[Problem 2] A row of 6 items loses 1. How many items are left?`, parts: [{ label: "items", ans: 5 }], hint: `[Hint.]` }, figure: "[5 left]",
          lines: [{ math: `6 − 1 = 5`, note: "[Worked line.]" }],
          link: `[Ties back to a step.]` },
        { task: "[Everyday situation 3]", check: { q: `[Problem 3] Three rows of 2 items each. How many items?`, parts: [{ label: "items", ans: 6 }], hint: `[Hint.]` }, figure: "[6 items]",
          lines: [{ math: `2 + 2 + 2 = 6`, note: "[Worked line.]" }],
          link: `[Ties back to a step.]` },
        { task: "[Everyday situation 4]", check: { q: `[Problem 4] A row holds 9 items and 1 more is added. How many items?`, parts: [{ label: "items", ans: 10 }], hint: `[Hint.]` }, figure: "[10 items]",
          lines: [{ math: `9 + 1 = 10`, note: "[Worked line.]" }],
          link: `[Ties back to a step.]` }
      ]
    },

    formal: {
      question: { text: "[The precise question this lesson answers]?", sub: `[One or two sentences: the textbook words for the same ideas, and how to write it out.]`,
        figure: { sym: `<i>n</i>`, value: "3", cap: "[formal name of the live value]", echo: "n" },
        jump: [{ label: "Vocabulary", to: "f-vocab" }, { label: "Where it goes wrong", to: "f-mist" }, { label: "Writing it out", to: "f-setup" }, { label: "Practice", to: "f-prac" }] },
      vocabTitle: "From your words to the textbook's",
      vocabIntro: `<p>Each card is an idea you already used in the Concept and Intermediate tabs, with its proper name and its exact meaning.</p>`,
      vocab: [
        { c: "c1", sym: `<i>n</i>`, term: "[Term 1]", def: `[Exact definition, with its source.]`, was: "[the everyday name from the Concept tab]" },
        { c: "c2", sym: `+1`, term: "[Term 2]", def: `[Exact definition.]`, was: "[the everyday name]" },
        { c: "c5", sym: `▶`, term: "[Term 3]", def: `[Exact definition.]`, was: "[the everyday name]" },
        { c: "c1", sym: `§`, term: "[Term 4]", def: `[Exact definition.]`, was: "[the everyday name]" }
      ],
      matters: { title: "Why the exact words matter", text: `<p>[One case where a single word changes the outcome.]</p>` },
      mistakesTitle: "Where formal answers go wrong",
      mistakesLead: `[One sentence: the most common kind of formal mistake.]`,
      setupIntro: `<p>[The situation from the Concept tab, written the way a textbook would.]</p>`,
      setup: { title: "Writing a [kind of] problem", items: [
        { say: `<b>[Step 1: name what is given.]</b> [Explanation.]`, math: `<span class="m"><i>n</i> = 3</span>` },
        { say: `<b>[Step 2: state the rule.]</b> [Explanation.]`, math: `<span class="m"><i>n</i> + 1</span>` },
        { say: `<b>[Step 3: apply the rule.]</b> [Explanation.]`, math: `<span class="m">3 + 1 = 4</span>` },
        { say: `<b>[Step 4: state the conclusion.]</b> [Explanation.]`, math: `<span class="m"><span class="c1">4</span></span> &nbsp;→ [Conclusion sentence.]` }
      ] },
      practiceTip: `Type your answer and press Check. [How to work it the formal way.] Stuck? Each one has a hint.`,
      practiceDone: "All 5 solved. [What the learner can now do the formal way.]",
      checks: [
        { hint: `[Hint 1]`, parts: [{ label: "answer", ans: 4 }] },
        { hint: `[Hint 2]`, parts: [{ label: "answer", ans: 5 }] },
        { hint: `[Hint 3]`, parts: [{ label: "answer", ans: 6 }] },
        { hint: `[Hint 4]`, parts: [{ label: "answer", ans: 7 }] },
        { hint: `[Hint 5]`, parts: [{ label: "answer", ans: 8 }] }
      ]
    }
  },

  prereqWhy: {},
  unlocksWhy: {},
  beyond: [
    { field: "[Later field]", why: "[How this lesson is used there.]" }
  ],
  mistakes: [
    { wrong: `[Mistake 1, the classic trap.]`, fix: `[Correction 1.]` },
    { wrong: `[Mistake 2.]`, fix: `[Correction 2.]` },
    { wrong: `[Mistake 3.]`, fix: `[Correction 3.]` }
  ],
  practice: [
    { ctx: "[Context 1]", q: `[Practice question 1.] What is 3 + 1?`, a: `[Worked answer 1.] <span class="m">3 + 1 = 4</span>. The answer is <b>4</b>.` },
    { ctx: "[Context 2]", q: `[Practice question 2.] What is 4 + 1?`, a: `[Worked answer 2.] <span class="m">4 + 1 = 5</span>. The answer is <b>5</b>.` },
    { ctx: "[Context 3]", q: `[Practice question 3.] What is 5 + 1?`, a: `[Worked answer 3.] <span class="m">5 + 1 = 6</span>. The answer is <b>6</b>.` },
    { ctx: "[Context 4]", q: `[Practice question 4.] What is 6 + 1?`, a: `[Worked answer 4.] <span class="m">6 + 1 = 7</span>. The answer is <b>7</b>.` },
    { ctx: "[Context 5]", q: `[Practice question 5.] What is 7 + 1?`, a: `[Worked answer 5.] <span class="m">7 + 1 = 8</span>. The answer is <b>8</b>.` }
  ],
  origin: `[Origin: where the rule comes from, verified and sourced.]`
};
