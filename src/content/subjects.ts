// Editorial content for the ten core Darse Nizami subjects. Titles and authors are the standard, widely documented ones;
// which text is read in which year differs by board and school, so each page says "commonly studied" rather than fixing a syllabus.

export type SubjectText = { name: string; ar?: string; by?: string; note: string };
export type SubjectFaq = { q: string; a: string };

export type SubjectDoc = {
  slug: string;
  ar: string;
  ur: string;
  en: string;
  field: string; // one-line description of the discipline
  stage: string; // when it is usually met in the eight-year course
  overview: string[];
  learn: string[];
  texts: SubjectText[];
  method: Array<{ t: string; d: string }>;
  pitfalls: string[];
  pairs: string[]; // slugs of related subjects
  faq: SubjectFaq[];
};

export const SUBJECTS: SubjectDoc[] = [
  {
    slug: "nahw", ar: "النحو", ur: "نحو", en: "Nahw", field: "Arabic syntax: how words combine and why endings change.",
    stage: "Years 1 to 5, in graded steps",
    overview: [
      "Nahw is the grammar of Arabic sentences. It explains why a word ends in a damma, fatha or kasra, which word governs which, and how a sentence is built from subject, predicate, object and the particles that connect them. Almost every later subject in Darse Nizami is read in Arabic, so nahw is the key that opens the others.",
      "The discipline is taught in layers. A student first memorises the parts of speech and the main i'rab rules from a short primer, then reads progressively denser texts in which the rules are argued, qualified and illustrated. By the time a student reaches the advanced commentaries they are no longer learning rules; they are learning to read how grammarians reason.",
    ],
    learn: [
      "The three kinds of word: ism (noun), fi'l (verb) and harf (particle), and how to tell them apart.",
      "I'rab and bina: which words change their endings, which never do, and what causes the change.",
      "The nominal sentence (mubtada and khabar) and the verbal sentence (fi'l, fa'il, maf'ul).",
      "The governing words (awamil) and the grammatical cases they require.",
      "Apposition, annexation (idafa), adjectives, conjunction and emphasis.",
      "How to parse a line of the Quran or Hadith word by word, and justify each ending.",
    ],
    texts: [
      { name: "Al-Ajrumiyyah", ar: "الآجرومية", by: "Ibn Ajurrum", note: "The short primer many students meet first. Compact, clear and designed to be memorised." },
      { name: "Mi'at Amil", ar: "مائة عامل", by: "Abd al-Qahir al-Jurjani", note: "Organises the whole subject around one hundred governing words, usually studied with a commentary." },
      { name: "Hidayat al-Nahw", ar: "هداية النحو", by: "Athir al-Din al-Abhari", note: "A middle text that sets out the rules with worked examples." },
      { name: "Al-Kafiyah", ar: "الكافية", by: "Ibn al-Hajib", note: "A dense classical text; read with its commentaries it trains the student to follow grammatical argument." },
      { name: "Sharh Ibn Aqil", ar: "شرح ابن عقيل", by: "Ibn Aqil, on the Alfiyyah of Ibn Malik", note: "The verse grammar of Ibn Malik with a clear explanation, widely used at the advanced end." },
    ],
    method: [
      { t: "Memorise the primer exactly", d: "In the early texts, wording matters. Learn the definitions as written, then test yourself by writing them from memory." },
      { t: "Parse every day", d: "Take five lines of any Arabic text each day and name the role and ending of each word. Grammar becomes reflex only through repetition." },
      { t: "Link each rule to a verse", d: "A rule you can attach to an ayah or a hadith is a rule you will not forget. Keep a notebook of rule, example, source." },
      { t: "Study sarf in parallel", d: "Half of the mistakes in nahw are really mistakes in word-forms. Reading the two together removes most of them." },
    ],
    pitfalls: [
      "Learning rules as a list of exceptions instead of asking what principle each exception serves.",
      "Skipping the early definitions because they feel too simple, then losing the thread in the Kafiyah.",
      "Reading only the commentary and never the base text it is explaining.",
    ],
    pairs: ["sarf", "balaghah", "mantiq"],
    faq: [
      { q: "Should I start with nahw or sarf?", a: "Most madrasas begin with both at once: sarf for word-forms and nahw for sentence structure. If you must choose, begin with the basics of sarf for a few weeks, because every nahw rule assumes you can recognise a verb form or a noun pattern." },
      { q: "How long does nahw take?", a: "Within the eight-year course nahw runs through the first five years in stages. A dedicated adult student can cover the primer and a middle text in one to two years, but fluency comes from continued reading, not from finishing a book." },
      { q: "Do I need to know Arabic before starting?", a: "No. The primers are written for beginners and start with the three kinds of word. Learning a few hundred common words alongside makes the examples easier to follow." },
    ],
  },
  {
    slug: "sarf", ar: "الصرف", ur: "صرف", en: "Sarf", field: "Arabic morphology: how roots become verbs, nouns and patterns.",
    stage: "Years 1 to 3, revisited later",
    overview: [
      "Sarf is the study of word-forms. Arabic builds almost all its vocabulary from three-letter roots poured into fixed patterns, so knowing the patterns lets you read the meaning of words you have never seen. Where nahw asks how a word behaves in a sentence, sarf asks how the word itself is made.",
      "It is the most memorisation-heavy of the early subjects. Students learn the conjugation tables (gardan) for every verb form, the patterns of the derived nouns, and the rules by which weak letters change. It rewards slow, daily practice more than long weekly sessions.",
    ],
    learn: [
      "The root and the pattern (wazn), and how to extract each from a word.",
      "The ten derived verb forms and the shade of meaning each adds.",
      "Conjugation of the past, present, imperative and prohibition across all persons.",
      "The active and passive participles, nouns of place, time, instrument and the verbal noun.",
      "The weak roots: how hamza, waw and ya change, drop or swap in different forms.",
      "Singular, dual and plural, including the broken plural patterns.",
    ],
    texts: [
      { name: "Mizan al-Sarf", ar: "میزان الصرف", note: "A graded primer that introduces the six categories of the verb and their tables." },
      { name: "Ilm al-Sigha", ar: "علم الصیغہ", by: "Inayat Ahmad Kakorwi", note: "A widely used text covering the verb forms, weak roots and derived nouns in order." },
      { name: "Al-Shafiyah", ar: "الشافية", by: "Ibn al-Hajib", note: "A concise, advanced treatment of morphology, read with commentary." },
      { name: "Marah al-Arwah", ar: "مراح الأرواح", note: "A classical text on the rules of word-forms, typically studied after the primers." },
    ],
    method: [
      { t: "Chant the tables aloud", d: "Sarf tables are meant to be recited. Sound and rhythm fix the order of the forms faster than silent reading." },
      { t: "Conjugate a new verb every day", d: "Pick any verb from your reading and write out its full table from memory, then check it." },
      { t: "Keep a one-page chart of weak-letter rules", d: "Rules for hollow, defective and assimilated roots are the most forgotten. A single page, reviewed weekly, prevents that." },
      { t: "Read the Quran with the root in mind", d: "As you recite, name the root and form of any verb you meet. It turns recitation into daily practice." },
    ],
    pitfalls: [
      "Memorising tables without ever applying them to a real sentence.",
      "Treating each weak-root rule as separate rather than seeing the small set of principles behind them.",
      "Moving on before the early tables are automatic; every later text assumes them.",
    ],
    pairs: ["nahw", "balaghah", "tafsir"],
    faq: [
      { q: "Is sarf harder than nahw?", a: "Most students find it more demanding on memory and less demanding on argument. It is a fixed system with few exceptions once the weak-letter principles are understood." },
      { q: "How do I stop forgetting tables?", a: "Short daily recitation beats long occasional sessions. Reciting the same table for a week, then returning to it weekly, usually makes it permanent." },
      { q: "Can I learn sarf without a teacher?", a: "You can learn the tables alone, but a teacher is valuable for pronunciation and for correcting the habits that creep in when you self-check." },
    ],
  },
  {
    slug: "mantiq", ar: "المنطق", ur: "منطق", en: "Mantiq", field: "Logic: how definitions and arguments are built and tested.",
    stage: "Years 3 to 5",
    overview: [
      "Mantiq, classical logic, trains the mind to define terms precisely and to reason from premises to a conclusion without slipping. It is not studied for its own sake: its tools of definition, division and syllogism are used throughout fiqh, usul, kalam and the commentaries students will read in later years.",
      "A student who has studied mantiq reads differently. They notice when a term is used in two senses, when a conclusion does not follow, and when a definition is too wide or too narrow. These are the habits that make advanced commentaries readable.",
    ],
    learn: [
      "The five universals (genus, species, differentia, property, general accident) and what each tells you about a thing.",
      "Definition: what makes one complete, and what makes one too broad or too narrow.",
      "Propositions: their kinds, their quantity and quality, and how they are converted and contradicted.",
      "The syllogism: its figures, its valid forms and how to test a given argument.",
      "Fallacies, and how to name the step at which an argument fails.",
    ],
    texts: [
      { name: "Isaghuji", ar: "ایساغوجی", by: "Athir al-Din al-Abhari", note: "A short introduction to the five universals, the first logic text most students read." },
      { name: "Tahdhib al-Mantiq", ar: "تهذيب المنطق", by: "Sa'd al-Din al-Taftazani", note: "A compact summary of the whole discipline, studied with a commentary." },
      { name: "Sharh Tahdhib", ar: "شرح التهذيب", note: "The commentary on the Tahdhib, which explains and extends its arguments." },
      { name: "Qutbi", ar: "قطبی", by: "Qutb al-Din al-Razi", note: "A commentary on the Shamsiyyah that carries the student into the full classical treatment." },
    ],
    method: [
      { t: "Work through examples on paper", d: "Logic is learned by doing. For each rule, write three examples of your own, then check them against the text." },
      { t: "Define before you argue", d: "Whenever you study a fiqh or usul passage, stop and ask what each key term means in that passage. That is mantiq in practice." },
      { t: "Draw the relations", d: "Diagrams of how universals relate, and of how propositions oppose one another, make the rules visible." },
    ],
    pitfalls: [
      "Memorising the names of the figures without being able to test a real argument.",
      "Studying mantiq as an isolated subject and never using it on the texts that follow.",
    ],
    pairs: ["usul-al-fiqh", "aqidah", "balaghah"],
    faq: [
      { q: "Why do madrasas teach logic?", a: "Because the later disciplines argue in its terms. Definitions in fiqh and the proofs in kalam use its tools directly, so a student who skips it reads those texts with less precision." },
      { q: "Is mantiq the same as modern logic?", a: "It covers much of the same ground as traditional Aristotelian logic. It is narrower than modern formal logic and is taught as a tool for reading and argument, not as mathematics." },
    ],
  },
  {
    slug: "balaghah", ar: "البلاغة", ur: "بلاغت", en: "Balaghah", field: "Rhetoric: the art of saying the right thing, the right way.",
    stage: "Years 4 to 6",
    overview: [
      "Balaghah studies how meaning is shaped by expression: why one word order is stronger than another, when a metaphor works, and what a speaker gains by being brief or full. It is the discipline through which students begin to appreciate the Quran's style, not just its rulings.",
      "It is traditionally divided into three sciences: ma'ani (how a sentence fits its situation), bayan (figures such as simile, metaphor and metonymy) and badi' (embellishment). Each trains a different kind of attention to the text.",
    ],
    learn: [
      "Ma'ani: statement and request, emphasis, definite and indefinite, fronting and delaying, brevity and elaboration.",
      "Bayan: simile, metaphor and metonymy, and how to tell them apart.",
      "Badi': verbal and conceptual embellishments such as antithesis and paronomasia.",
      "How to explain why a particular phrase in the Quran or in poetry is chosen over its alternatives.",
    ],
    texts: [
      { name: "Al-Balaghah al-Wadihah", ar: "البلاغة الواضحة", by: "Ali al-Jarim and Mustafa Amin", note: "A clear modern textbook that introduces the three sciences with many examples." },
      { name: "Talkhis al-Miftah", ar: "تلخيص المفتاح", by: "al-Qazwini", note: "The classical summary of the field, studied with commentary." },
      { name: "Mukhtasar al-Ma'ani", ar: "مختصر المعاني", by: "al-Taftazani", note: "A major commentary on the Talkhis, central at the advanced stage." },
    ],
    method: [
      { t: "Collect examples from the Quran", d: "For every figure you learn, find a Quranic example and write the reason the wording is exactly as it is." },
      { t: "Compare alternatives", d: "Take a phrase and try rewording it. Seeing what is lost makes the rule concrete." },
      { t: "Read poetry aloud", d: "Rhythm and imagery are easiest to feel when heard. Even a few lines a day sharpens the ear." },
    ],
    pitfalls: [
      "Labelling figures without asking what each one does for the meaning.",
      "Starting balaghah before nahw is secure; most examples assume you can parse the sentence.",
    ],
    pairs: ["nahw", "tafsir", "sarf"],
    faq: [
      { q: "Do I need balaghah to understand the Quran?", a: "You can understand the plain sense without it, but balaghah is how scholars explain the force of the wording, and it is central to reading tafsir at depth." },
    ],
  },
  {
    slug: "fiqh", ar: "الفقه", ur: "فقہ", en: "Fiqh", field: "Islamic law: worship, dealings and conduct, with their evidence.",
    stage: "Every year, from the first",
    overview: [
      "Fiqh is the knowledge of the practical rulings of the Shari'ah, derived from their sources. In Pakistani madrasas it is taught according to the Hanafi school, beginning with purification and prayer and widening through the years to transactions, family law, inheritance and the rules of the state.",
      "Because it is studied in every year, fiqh is the thread that runs through the whole course. Early texts give the rulings in short form; later texts add the evidence, the differences between scholars and the reasoning behind each position.",
    ],
    learn: [
      "Purification, prayer, fasting, zakat and hajj in detail, with the conditions and what invalidates each.",
      "Contracts and transactions: sale, lease, partnership, loans, pledge and agency.",
      "Marriage, divorce, custody and maintenance.",
      "Inheritance and bequests, which connects directly to the science of faraid.",
      "Crimes and punishments, judgeship and the rules of testimony.",
      "How a ruling is traced from its evidence to its conclusion.",
    ],
    texts: [
      { name: "Mukhtasar al-Quduri", ar: "مختصر القدوري", by: "Abu al-Husayn al-Quduri", note: "The classic short Hanafi manual, covering worship and dealings in terse form." },
      { name: "Kanz al-Daqa'iq", ar: "كنز الدقائق", by: "Abu al-Barakat al-Nasafi", note: "A concise, widely studied text that supports memorisation of the Hanafi position." },
      { name: "Sharh al-Wiqayah", ar: "شرح الوقاية", by: "Ubaydullah ibn Mas'ud al-Mahbubi (Sadr al-Shari'a)", note: "A fuller exposition with reasons, read in the middle years." },
      { name: "Al-Hidayah", ar: "الهداية", by: "Burhan al-Din al-Marghinani", note: "The most celebrated Hanafi text, which gives the evidence and discusses the opinions of other scholars." },
    ],
    method: [
      { t: "Learn the ruling, then the reason", d: "On first reading, fix the ruling. On the second, ask for the evidence and the principle behind it." },
      { t: "Work cases", d: "Take real situations and decide them from the text. Fiqh is a skill of application." },
      { t: "Keep the technical terms exact", d: "Words such as fard, wajib, sunnah and makruh have precise meanings. Collect them in a glossary." },
    ],
    pitfalls: [
      "Memorising rulings without the conditions that limit them.",
      "Treating an early short text as the whole of the school's position.",
      "Using study of a ruling as a substitute for asking a qualified mufti about your own case.",
    ],
    pairs: ["usul-al-fiqh", "faraid", "hadith"],
    faq: [
      { q: "Which school of fiqh is taught?", a: "The Pakistani Darse Nizami boards teach Hanafi fiqh as the base, with other schools introduced where the advanced texts discuss differences." },
      { q: "Can studying fiqh online replace asking a mufti?", a: "No. Study teaches you the reasoning of the school. For a ruling on your own case, ask a qualified mufti." },
    ],
  },
  {
    slug: "usul-al-fiqh", ar: "أصول الفقه", ur: "اصول فقہ", en: "Usul al-Fiqh", field: "The principles by which rulings are derived from their sources.",
    stage: "Years 5 to 7",
    overview: [
      "If fiqh is the set of rulings, usul al-fiqh is the method that produces them. It studies the sources, the Quran, Sunnah, consensus and analogy, and the rules of language and reasoning by which a jurist reads a command, a prohibition, a general statement or a restriction.",
      "The subject draws on everything learned before it: nahw to read the wording, mantiq to define and argue, and balaghah to see the shade of expression. It is where those earlier disciplines are put to work.",
    ],
    learn: [
      "The sources of law and their ranking.",
      "Commands and prohibitions: what each implies and when it is read otherwise.",
      "General and specific wording, absolute and restricted, and how one limits the other.",
      "Clear and unclear texts, and the levels of clarity.",
      "Abrogation, and how apparent conflicts between texts are resolved.",
      "Analogy (qiyas): its pillars, conditions and the grounds on which it can be challenged.",
    ],
    texts: [
      { name: "Usul al-Shashi", ar: "أصول الشاشي", note: "A short Hanafi text attributed to Nizam al-Din al-Shashi, often the first usul text students read." },
      { name: "Nur al-Anwar", ar: "نور الأنوار", by: "Mulla Jiwan", note: "A commentary on the Manar, read in the middle years." },
      { name: "Al-Husami", ar: "الحسامي", by: "Husam al-Din al-Akhsikati", note: "A compact classical text on the Hanafi principles." },
      { name: "Musallam al-Thubut", ar: "مسلم الثبوت", by: "Muhibbullah al-Bihari", note: "A comprehensive advanced work for the final stage." },
    ],
    method: [
      { t: "Pair each principle with a ruling", d: "Whenever the text states a principle, find one fiqh ruling it explains. That is how the two subjects reinforce each other." },
      { t: "Learn the definitions verbatim", d: "Usul is built from precise definitions. Slight changes in wording change the principle." },
      { t: "Argue both sides", d: "When the text records a disagreement, state each side's reasoning in your own words." },
    ],
    pitfalls: [
      "Reading usul before fiqh has given you enough rulings to see it at work.",
      "Treating the definitions as vocabulary rather than as the argument itself.",
    ],
    pairs: ["fiqh", "mantiq", "nahw"],
    faq: [
      { q: "Why is usul studied after fiqh begins?", a: "Fiqh gives you the rulings first so that when usul explains how they were derived, you have concrete cases to test the principles on." },
    ],
  },
  {
    slug: "hadith", ar: "الحديث", ur: "حدیث", en: "Hadith", field: "The sayings and actions of the Prophet, and the science of their transmission.",
    stage: "Years 3 to 8, culminating in the final year",
    overview: [
      "Hadith is studied in two ways: reading the collections themselves, and learning the science that evaluates how each report was transmitted. The first gives the content; the second gives the ability to judge it.",
      "The course builds toward the final year, often called Dawra-e-Hadith, in which students read the six canonical collections under a teacher, with commentary and with the opinions of the jurists on each report.",
    ],
    learn: [
      "How a hadith is structured: its chain (isnad) and text (matn).",
      "The classes of report by strength and the terms scholars use for them.",
      "The biographies of narrators and how they are assessed.",
      "The major collections, their arrangement and the conditions their compilers set.",
      "How the jurists derive rulings from reports, and how they reconcile reports that seem to differ.",
    ],
    texts: [
      { name: "Mishkat al-Masabih", ar: "مشكاة المصابيح", by: "Wali al-Din al-Tabrizi", note: "A selection arranged by topic from the major collections, read in the middle years." },
      { name: "Nukhbat al-Fikar", ar: "نخبة الفكر", by: "Ibn Hajar al-Asqalani", note: "A short, rigorous text on the terminology of the science of hadith." },
      { name: "Sahih al-Bukhari and Sahih Muslim", ar: "الصحيحان", note: "The two most trusted collections, read in the final year." },
      { name: "Jami al-Tirmidhi, Sunan Abi Dawud, al-Nasa'i and Ibn Majah", ar: "السنن", note: "The remaining four of the six canonical books, each with its own method." },
    ],
    method: [
      { t: "Learn the terminology first", d: "The grading terms are a language. Fix them early so every later discussion of a report is readable." },
      { t: "Read with the chain", d: "Do not skip the isnad. Even a basic familiarity with the narrators shows you why a report is accepted." },
      { t: "Memorise key reports with their topic", d: "A short list of reports on each major ruling, memorised, gives you a base for fiqh and usul." },
    ],
    pitfalls: [
      "Quoting a report without checking its grading or its context.",
      "Reading the text without the commentary that explains the jurists' use of it.",
    ],
    pairs: ["fiqh", "usul-al-fiqh", "tafsir"],
    faq: [
      { q: "What is Dawra-e-Hadith?", a: "It is the final year of the course, in which students read the six canonical collections. Completing it is traditionally what marks the end of the Darse Nizami." },
      { q: "Can I study the science of hadith without Arabic?", a: "Translations help you meet the content, but the terminology and the commentary are Arabic, so a working command of the language is what makes the science open to you." },
    ],
  },
  {
    slug: "tafsir", ar: "التفسير", ur: "تفسیر", en: "Tafsir", field: "Commentary on the Quran: its words, context and meanings.",
    stage: "Years 5 to 8",
    overview: [
      "Tafsir is the explanation of the Quran. A mufassir looks at the wording, the reasons for revelation, the connection between verses, the rulings they imply and the interpretations passed down from the earliest generations.",
      "In the course, students begin with a short, readable commentary and then move to fuller works, learning at each stage how the commentators handle language, narration and rulings.",
    ],
    learn: [
      "How the Quran is explained by the Quran, by the Sunnah, by the Companions and by the language.",
      "The reasons for revelation and how they inform the reading.",
      "The meanings of rare words and their grammar.",
      "How commentators draw rulings from verses and handle apparent differences.",
      "The sciences of the Quran: its compilation, abrogation, the clear and the ambiguous.",
    ],
    texts: [
      { name: "Tafsir al-Jalalayn", ar: "تفسير الجلالين", by: "Jalal al-Din al-Mahalli and Jalal al-Din al-Suyuti", note: "A brief, readable commentary used as the first complete tafsir." },
      { name: "Anwar al-Tanzil (Tafsir al-Baydawi)", ar: "أنوار التنزيل", by: "al-Baydawi", note: "A concise commentary dense in grammar and rhetoric, read at the advanced stage." },
      { name: "Madarik al-Tanzil", ar: "مدارك التنزيل", by: "Abu al-Barakat al-Nasafi", note: "A balanced commentary used in the Hanafi tradition." },
      { name: "Al-Fawz al-Kabir", ar: "الفوز الكبير", by: "Shah Waliullah al-Dihlawi", note: "A short treatise on the principles of tafsir." },
    ],
    method: [
      { t: "Read the ayah, then the gloss", d: "Look at the verse by itself first and form a question. Then read the commentary to see how it answers." },
      { t: "Track the reason for revelation", d: "Write down any narration of context beside the verse. It often resolves what looked unclear." },
      { t: "Revise with the Arabic", d: "Return to the Arabic text each time. Translation is a help, not a replacement." },
    ],
    pitfalls: [
      "Using a single opinion from a commentary as if it were the agreed meaning.",
      "Reading tafsir before enough nahw to follow the grammatical points.",
    ],
    pairs: ["hadith", "balaghah", "nahw"],
    faq: [
      { q: "Is it enough to read an Urdu translation?", a: "A translation conveys the sense, but tafsir works on the Arabic wording, so a student of the discipline needs the language to follow it." },
    ],
  },
  {
    slug: "aqidah", ar: "العقيدة", ur: "عقائد", en: "Aqidah", field: "Creed: what Muslims believe, and the proofs for it.",
    stage: "Years 4 to 8",
    overview: [
      "Aqidah sets out the beliefs of Islam: God, the prophets, the revealed books, the angels, the last day and what has been decreed. In the Darse Nizami it is taught from the classical texts of the Sunni creed, with the arguments that support each belief.",
      "The advanced treatment, called kalam, draws on logic and philosophy to answer objections. Students who have studied mantiq find that these texts open up considerably.",
    ],
    learn: [
      "The attributes of God and the proofs that establish them.",
      "Prophethood, and how the truthfulness of a prophet is known.",
      "Revelation, the angels and the unseen.",
      "The life after death, the Resurrection and the reckoning.",
      "Fate and human choice, and how the scholars understood the relationship between them.",
    ],
    texts: [
      { name: "Aqa'id al-Nasafi", ar: "عقائد النسفي", by: "Najm al-Din al-Nasafi", note: "A short statement of the Sunni creed that students memorise and study with commentary." },
      { name: "Sharh al-Aqa'id al-Nasafiyyah", ar: "شرح العقائد النسفية", by: "Sa'd al-Din al-Taftazani", note: "The standard commentary on the Aqa'id, which gives the arguments for each point." },
      { name: "Al-Aqidah al-Tahawiyyah", ar: "العقيدة الطحاوية", by: "Abu Ja'far al-Tahawi", note: "A short, early statement of the creed as held by the Hanafi scholars." },
    ],
    method: [
      { t: "Learn the statement, then the proof", d: "Memorise each point as stated, then study the argument offered for it." },
      { t: "Separate the certain from the debated", d: "Texts distinguish what is agreed from what scholars differ on. Mark the difference in your notes." },
    ],
    pitfalls: [
      "Treating questions of belief as only a matter of memorised answers, without the proofs.",
      "Reading the advanced kalam texts before mantiq is secure.",
    ],
    pairs: ["mantiq", "tafsir", "hadith"],
    faq: [
      { q: "Is aqidah studied differently from the other subjects?", a: "Its texts are shorter, but they are read slowly with commentary because each sentence carries a doctrine and its proof." },
    ],
  },
  {
    slug: "faraid", ar: "الفرائض", ur: "فرائض", en: "Faraid", field: "The law of inheritance, worked as an exact calculation.",
    stage: "Years 6 to 8",
    overview: [
      "Faraid is the Islamic law of inheritance. The Quran fixes the shares of heirs, and faraid is the discipline of working out, for a real family, who inherits, how much, and what happens when the shares do not add up to a whole.",
      "It is the one subject in the course that is closer to mathematics than to reading: a worked example is either right or wrong. For that reason it is satisfying to learn and, once learned, immediately useful.",
    ],
    learn: [
      "The categories of heirs and their fixed shares.",
      "Residuary heirs and the order in which they inherit.",
      "Exclusion: when one heir blocks another.",
      "Reduction and return: what to do when the fixed shares exceed or fall short of the estate.",
      "Special cases and how the classical jurists resolved them.",
      "How to present a full calculation, step by step.",
    ],
    texts: [
      { name: "Al-Sirajiyyah", ar: "السراجية", by: "Siraj al-Din al-Sajawandi", note: "The standard short text on inheritance in the Hanafi tradition." },
      { name: "Al-Sharifiyyah", ar: "الشريفية", by: "al-Sayyid al-Sharif al-Jurjani", note: "The best known commentary on the Sirajiyyah, which explains the reasoning behind each rule." },
    ],
    method: [
      { t: "Solve many cases", d: "The rules are few; skill comes from working a large number of cases until the pattern is familiar." },
      { t: "Draw the family tree", d: "Start every problem with a diagram of the deceased and the living relatives. Most errors begin by missing an heir." },
      { t: "Check the total", d: "Always add the shares at the end. If they do not sum correctly, you have missed a rule." },
    ],
    pitfalls: [
      "Learning the shares without learning the order of exclusion.",
      "Treating the calculation as a sum and forgetting the conditions that decide who inherits at all.",
    ],
    pairs: ["fiqh", "usul-al-fiqh", "hadith"],
    faq: [
      { q: "Is faraid only for scholars?", a: "No. Any Muslim who handles an estate benefits from understanding it. A student who finishes the text can work out the shares for a family, though a mufti should confirm a real case." },
    ],
  },
];

export const subjectBySlug = (slug: string) => SUBJECTS.find((s) => s.slug === slug);
