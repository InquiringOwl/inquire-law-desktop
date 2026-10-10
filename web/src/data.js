/* ============ Tree + field data (Inquire Law) ============
   Content-free shell cloned from Inquire 1.19.0. The only charted subject is "Lesson Template", a format reference
   with [placeholder] text. Real Law subjects are listed below as locked (not yet charted). */
window.DB = window.DB || {};

/* Where the app lands when a route names no subject/field (was "mathematics"/"arithmetic" in Inquire). */
DB.defaultSubject = "lesson-template";
DB.defaultField = "template-field";

/* Skill trees, one per charted field. col = tier column, row = lane.
   pre may name topics in another field (drawn in that field; listed on the topic page). planned: true = drawn dashed. */
DB.trees = {};
DB.trees["template-field"] = {
  eras: [
    { name: "[Era 1]", from: 0, to: 0 },
    { name: "[Era 2]", from: 1, to: 1 }
  ],
  nodes: [
    { id: "lesson-template", col: 0, row: 2, icon: "◇", chips: ["[a]", "[b]"], pre: [] }
  ],
  planned: [
    { id: "template-next", label: "[Planned lesson]", col: 1, row: 2, icon: "◆", chips: ["[c]"], pre: ["lesson-template"] }
  ]
};

/* Fields (sidebar + field map). status: "charted" (tree built) or "planned". subject = the subject id. */
DB.fields = {
  "template-field": { name: "Template Field", subject: "lesson-template", icon: "◇", level: "[Course level · e.g. 1L, first semester]", col: 0, row: 1, pre: [], status: "charted",
    blurb: "[Placeholder] A field is one course. Its tree lists the lessons in the order a student meets them.",
    topics: [] },
  "template-planned": { name: "Planned Field", subject: "lesson-template", icon: "◆", level: "[Course level]", col: 1, row: 1, pre: ["template-field"], status: "planned",
    blurb: "[Placeholder] A planned field shows its topic list until its tree is charted.",
    topics: ["[Topic 1]", "[Topic 2]", "[Topic 3]"] }
};

/* Dictionary subjects, grouped the way law schools group the curriculum.
   group: see DB.subjectGroups (accent = the group colour everywhere). status "open" = has a field map. */
DB.subjectGroups = [
  { id: "foundations", name: "1L Foundations", line: "The first-year required courses", accent: "cyan" },
  { id: "core", name: "Upper-Level Core", line: "Bar-tested and commonly required upper-level courses", accent: "magenta" },
  { id: "practice", name: "Practice & Perspectives", line: "Skills, electives and the study of law itself", accent: "lime" },
  { id: "reference", name: "Format Reference", line: "Blank formats to build every subject from", accent: "" }
];
const LOCKED = "Not yet charted";
DB.subjects = [
  { id: "contracts", group: "foundations", name: "Contracts", glyph: "✎", status: "locked", note: LOCKED },
  { id: "torts", group: "foundations", name: "Torts", glyph: "⚠", status: "locked", note: LOCKED },
  { id: "civil-procedure", group: "foundations", name: "Civil Procedure", glyph: "§", status: "locked", note: LOCKED },
  { id: "criminal-law", group: "foundations", name: "Criminal Law", glyph: "⊘", status: "locked", note: LOCKED },
  { id: "constitutional-law", group: "foundations", name: "Constitutional Law", glyph: "⚖", status: "locked", note: LOCKED },
  { id: "property", group: "foundations", name: "Property", glyph: "⌂", status: "locked", note: LOCKED },
  { id: "legal-writing", group: "foundations", name: "Legal Research & Writing", glyph: "¶", status: "locked", note: LOCKED },
  { id: "evidence", group: "core", name: "Evidence", glyph: "⌕", status: "locked", note: LOCKED },
  { id: "criminal-procedure", group: "core", name: "Criminal Procedure", glyph: "⊗", status: "locked", note: LOCKED },
  { id: "professional-responsibility", group: "core", name: "Professional Responsibility", glyph: "✓", status: "locked", note: LOCKED },
  { id: "business-associations", group: "core", name: "Business Associations", glyph: "⊞", status: "locked", note: LOCKED },
  { id: "wills-trusts-estates", group: "core", name: "Wills, Trusts & Estates", glyph: "✦", status: "locked", note: LOCKED },
  { id: "federal-income-tax", group: "core", name: "Federal Income Tax", glyph: "%", status: "locked", note: LOCKED },
  { id: "administrative-law", group: "core", name: "Administrative Law", glyph: "⚙", status: "locked", note: LOCKED },
  { id: "family-law", group: "core", name: "Family Law", glyph: "⚭", status: "locked", note: LOCKED },
  { id: "commercial-law", group: "core", name: "Commercial Law (UCC)", glyph: "⇄", status: "locked", note: LOCKED },
  { id: "conflict-of-laws", group: "core", name: "Conflict of Laws", glyph: "⇋", status: "locked", note: LOCKED },
  { id: "trial-advocacy", group: "practice", name: "Trial Advocacy", glyph: "⚑", status: "locked", note: LOCKED },
  { id: "negotiation-adr", group: "practice", name: "Negotiation & ADR", glyph: "⇌", status: "locked", note: LOCKED },
  { id: "international-law", group: "practice", name: "International Law", glyph: "◍", status: "locked", note: LOCKED },
  { id: "intellectual-property", group: "practice", name: "Intellectual Property", glyph: "©", status: "locked", note: LOCKED },
  { id: "environmental-law", group: "practice", name: "Environmental Law", glyph: "❦", status: "locked", note: LOCKED },
  { id: "jurisprudence", group: "practice", name: "Jurisprudence", glyph: "Φ", status: "locked", note: LOCKED },
  { id: "legal-history", group: "practice", name: "Legal History", glyph: "⌛", status: "locked", note: LOCKED },
  { id: "lesson-template", group: "reference", name: "Lesson Template", glyph: "◇", status: "open", note: "Format reference · placeholder text only" }
];

/* Per-subject field maps: groups of field ids, eras across the map's columns. accent = the subject group's accent. */
DB.subjectMaps = {
  "lesson-template": { name: "Lesson Template", glyph: "◇", accent: "", mapLine: "[One line: the whole path of this subject]",
    mapSub: "[Placeholder] The standard order of study for a subject. Arrows show the usual prerequisites.",
    groups: [{ name: "[Group of fields]", ids: ["template-field", "template-planned"] }],
    eras: [{ name: "[Era of fields]", from: 0, to: 1 }] }
};

/* Main Menu display box: one slide per open subject. art = keys of app/menu/<key>.jpg (lab screenshots, inlined by build-web). */
DB.menuSlides = [
  { sub: "lesson-template", art: ["tpl-1"], kicker: "Format Reference", line: "The blank Concept · Intermediate · Formal lesson every Law subject will be built from.", tags: ["Concept", "Intermediate", "Formal"] }
];

/* ============ Story panels (format kept from Inquire; usable for case excerpts) ============
   Tag set used by story tokens. The current tags are placeholders until a Law tag set is designed. */
/* Parts-of-speech tags used in English story passages. The traditional eight, coloured in five
   groups: naming words (c1), verbs (c2), noun modifiers (c3), adverbs (c4), connectors and exclamations (c5).
   Articles count as adjectives in the traditional eight; they keep their own tag so pages can say "article". */
DB.posTags = {
  n:  { name: "Noun", c: "c1", test: "Fits the frame “the ___” and can usually be made plural or possessive: truth, truths, truth’s. Proper nouns (names) are capitalised." },
  pr: { name: "Pronoun", c: "c1", test: "Stands in for a whole noun phrase. Personal pronouns change form for case: I, me, my." },
  v:  { name: "Verb", c: "c2", test: "Heads the predicate and can be marked for tense: is → was, give → gave. Auxiliaries (be, have, will, would, must) are verbs too." },
  aj: { name: "Adjective", c: "c3", test: "Modifies a noun. Fits “a ___ thing” and “very ___”, and most compare: young, younger, youngest." },
  ar: { name: "Article", c: "c3", test: "a, an, the: mark a noun as indefinite or definite. The traditional eight count articles as adjectives (modern grammars: determiners)." },
  av: { name: "Adverb", c: "c4", test: "Modifies a verb, an adjective, another adverb or a whole clause. Answers how, when, where, how often or how much." },
  p:  { name: "Preposition", c: "c5", test: "Links a noun phrase (its object) to the rest of the sentence: in Tuckahoe, of a wife." },
  cj: { name: "Conjunction", c: "c5", test: "Joins words, phrases or clauses. Coordinating: and, but, or. Subordinating: that, because, although." },
  ij: { name: "Interjection", c: "c5", test: "An exclamation that stands outside the grammar of the sentence: Bah! Oh! Alas!" }
};
/* Story token strings: "word_tag" separated by spaces; bare punctuation; "*" after the tag = italic in
   the source; "#key" after the tag = use notes[key]; "¶" = paragraph break. */
DB.parseStory = tokens => {
  const out = []; let prev = "";
  tokens.trim().split(/\s+/).forEach(t => {
    if (t === "¶") { out.push({ br: true }); prev = "\n"; return; }
    const m = t.match(/^(.*?)_([a-z]+)(\*?)(?:#([a-z0-9]+))?$/);
    const w = (m ? m[1] : t).replace(/~/g, " ");
    const glue = prev === "" || prev === "\n" || /[“—‘(]$/.test(prev) || /^([,.;:!?’”—)]|’[a-z]|n’t)/.test(w);
    out.push({ w, tag: m ? m[2] : null, it: !!(m && m[3]), key: m ? (m[4] || w.toLowerCase().replace(/[’']s$/, "")) : null, glue });
    prev = w;
  });
  return out;
};
DB.storyText = tokens => DB.parseStory(tokens).map(x => x.br ? "\n" : (x.glue ? "" : " ") + x.w).join("");
