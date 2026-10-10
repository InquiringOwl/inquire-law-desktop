/* ============ Glossary (shared by every subject) ============
   Entries live in web/glossary/<subject>.js as DB.addGlossary("<subject>", [ … ]). One entry = one subject's sense block
   for one headword; the glossary page groups blocks by headword. Spec: web/GLOSSARY-SPEC.md. Checked by tools/validate.js. */
(function(){
const DB = window.DB;
DB.glossary = DB.glossary || [];
DB.addGlossary = (subject, entries) => entries.forEach(e => DB.glossary.push(Object.assign({ subject }, e)));
/* Group colours: the stripe and chip border that mark a sense block's subject group. Not content colours. */
DB.glossaryGroupColour = { foundations: "var(--g-stem)", core: "var(--g-hum)", practice: "var(--g-soc)", reference: "var(--line-2)" };   // --g-stem/-hum/-soc = cyan/magenta/lime (names kept from Inquire)
/* IPA symbols allowed in `ipa` (General American, broad; see the spec), plus / ˈ ˌ . and space. */
DB.ipaKey = "p b t d k ɡ f v θ ð s z ʃ ʒ h tʃ dʒ m n ŋ l r j w ʔ ɾ i ɪ eɪ ɛ æ ɑ ɔ oʊ ʊ u ʌ ə ɝ ɚ aɪ aʊ ɔɪ";
DB.glossaryRegister = { formal: "Formal", neutral: "Neutral", informal: "Informal", technical: "Technical" };
})();
