// Long-form study guides. General advice for students of the classical sciences; nothing here depends on a particular board.

export type GuideSection = {
  id: string;
  h: string;
  p?: string[];
  list?: string[];
  ordered?: boolean;
  callout?: { title: string; text: string };
};

export type Guide = {
  slug: string;
  title: string;
  dek: string;
  category: string;
  minutes: number;
  intro: string;
  sections: GuideSection[];
  related: string[]; // subject slugs
};

export const GUIDES: Guide[] = [
  {
    slug: "how-to-read-a-kitab",
    title: "How to read a kitab: matn, sharh and hashiya",
    dek: "A classical Arabic book is a conversation across centuries. Here is how its layers are arranged and how to read them in the right order.",
    category: "Method", minutes: 9,
    intro: "Open a classical text and you rarely find a single voice. A short base text sits at the centre of the page, a commentary runs around it, and a second commentary on the commentary fills the margins. Students who do not know this layout often feel lost on the first day. Once you see how it is built, the page becomes a map.",
    sections: [
      {
        id: "layers", h: "The three layers of the page",
        p: [
          "The matn is the base text: the original, concise statement of the author, written to be memorised. It is deliberately brief. A good matn says a great deal in few words, and leaves much unsaid for the teacher to open.",
          "The sharh is a commentary on the matn. It quotes a phrase from the base text and then explains it, supplies the reason, gives examples or resolves a difficulty. In many printed editions the matn is set in a frame or in bold, and the sharh follows in plain type.",
          "The hashiya is a gloss on the sharh. It is written by a later scholar who found a point in the commentary worth clarifying, correcting or extending. You will usually meet it in the margins or at the foot of the page.",
        ],
        callout: { title: "Why the layers exist", text: "Each generation of scholars added to the book rather than replacing it. The layout preserves that history: you can see who said what, and when." },
      },
      {
        id: "order", h: "The right order to read",
        p: ["Read in the order of the layers, not the order of the page. This is the single most useful habit a beginner can build."],
        list: [
          "First read a short passage of the matn on its own and try to understand it without help.",
          "Then read the sharh for that passage and see how it explains each phrase.",
          "Only then, when the sharh is clear, look at the hashiya for the finer points.",
          "Finally return to the matn and read it again. It should now feel full instead of cryptic.",
        ],
        ordered: true,
      },
      {
        id: "memorise", h: "Memorise the matn, understand the sharh",
        p: [
          "In the traditional method the matn is memorised, because it is the fixed point to which all the commentary refers. The commentary is understood, not memorised. If you can recite the matn and explain a given line of it, you have the book.",
          "Do not memorise a whole matn before you understand it. Work in sections of a page or two: learn the section, understand it with the teacher, then revise it before adding the next.",
        ],
      },
      {
        id: "marks", h: "Reading the signs on the page",
        p: [
          "Classical books use a small set of conventions. A phrase introduced by the commentator's name is his own comment. A phrase beginning with the word for 'he said' (qala) marks the matn being quoted. A phrase such as 'it may be said' introduces an objection that the author will then answer.",
          "Keep a short list of these conventions at the front of your notebook. Within a month you will read them without thinking.",
        ],
      },
      {
        id: "notes", h: "How to take notes on a kitab",
        p: ["Notes work best when they follow the structure of the book."],
        list: [
          "Write the matn phrase on the right and the explanation on the left, in your own words.",
          "Mark every objection and its answer. These are the places where understanding happens.",
          "Record questions you cannot answer and take them to your teacher, rather than guessing.",
          "Revise your notes weekly, and cross out anything that later turned out to be wrong.",
        ],
      },
      {
        id: "mistakes", h: "Common mistakes",
        list: [
          "Reading only the sharh and never the matn. The commentary exists to serve the base text.",
          "Treating a hashiya's objection as the final word. Often the next scholar answered it.",
          "Rushing to finish the book. The aim is understanding, and one book understood is worth ten skimmed.",
        ],
      },
    ],
    related: ["nahw", "fiqh", "usul-al-fiqh"],
  },
  {
    slug: "learning-nahw-and-sarf-together",
    title: "Learning nahw and sarf together without drowning",
    dek: "The two foundation subjects are taught side by side. A practical plan for balancing them in your first two years.",
    category: "Foundations", minutes: 8,
    intro: "Almost every student begins nahw and sarf in the same term, and almost every student feels overwhelmed in the first month. The two subjects support each other, but only if you give each its own kind of attention. This guide sets out how to divide your week so neither falls behind.",
    sections: [
      {
        id: "different", h: "Two subjects, two kinds of work",
        p: [
          "Sarf is a subject of memory and repetition. You are learning tables and patterns, and the way to learn them is to say them aloud, daily, in small amounts.",
          "Nahw is a subject of understanding and application. You are learning why a word ends as it does. The way to learn it is to read real sentences and explain each word.",
          "If you treat both as memorisation you will forget nahw; if you treat both as understanding you will never fix the sarf tables. Give each the kind of work it needs.",
        ],
      },
      {
        id: "week", h: "A weekly plan",
        p: ["This pattern suits a student with about an hour a day outside class."],
        list: [
          "Fifteen minutes of sarf recitation every day: one table from memory, aloud.",
          "Twenty minutes of nahw reading: five lines parsed word by word, in writing.",
          "Fifteen minutes of revision: the previous day's tables and rules.",
          "Ten minutes of vocabulary: ten new Arabic words with their roots.",
          "On the weekend, one longer session to catch up and to test yourself on the week.",
        ],
        ordered: true,
      },
      {
        id: "order", h: "What to learn first",
        p: [
          "In the first month, learn the three kinds of word and the basic past and present tenses. Everything else rests on these.",
          "Resist the urge to rush ahead to the interesting parts. The student who knows the early definitions perfectly will move faster through the middle texts than the student who half-knows everything.",
        ],
        callout: { title: "The two-week test", text: "At the end of every two weeks, take one verse of the Quran and write down the root, form and role of each word in it. If you can do this without help, you are ready for the next stage." },
      },
      {
        id: "stuck", h: "When you get stuck",
        p: ["Everyone gets stuck. Most of the time the cause is one of three things."],
        list: [
          "A forgotten sarf rule. Go back to the table and recite it.",
          "A definition you have half-learned. Return to the text and read it again slowly.",
          "A word you cannot identify. Look it up, find its root, and add it to your vocabulary list.",
        ],
      },
      {
        id: "longer", h: "Looking ahead",
        p: [
          "Over the first two years your speed will rise sharply. A text that took a week at the start will take a day. This is normal and it comes from the daily practice, not from talent.",
          "Keep the daily habit even when the work feels easy. The students who do are the ones who read the advanced texts with confidence.",
        ],
      },
    ],
    related: ["nahw", "sarf", "balaghah"],
  },
  {
    slug: "choosing-an-online-madrasa-course",
    title: "How to choose an online madrasa course",
    dek: "A checklist for judging a course before you pay: teacher, syllabus, method, books and what the certificate really means.",
    category: "Choosing a course", minutes: 8,
    intro: "Online study has opened the classical sciences to students who cannot move to a city or leave work. It has also produced courses of very different quality. Before you enrol, ask the questions below. A good course will answer all of them plainly.",
    sections: [
      {
        id: "teacher", h: "Who is teaching, and who taught them?",
        p: [
          "In the classical sciences, the chain of teachers matters. A good course tells you who the teacher is, where they studied, and under whom. Look for a named teacher with a recorded training, not an anonymous brand.",
          "Ask whether the teacher is available for questions. A recorded lecture without any way to ask is a lecture, not teaching.",
        ],
      },
      {
        id: "syllabus", h: "Does the syllabus name its books?",
        p: ["A serious course states which texts it teaches and in what order."],
        list: [
          "The course should name the matn it is based on, and the commentary it uses.",
          "It should say how much of the book is covered and how many lessons that takes.",
          "It should say which board or tradition the syllabus follows, if any.",
        ],
      },
      {
        id: "method", h: "How is the course taught?",
        p: ["Recorded video suits revision. Live lessons suit learning something new. The best courses combine both and add practice."],
        list: [
          "Is there a place to ask questions, and do they get answered?",
          "Are there exercises or quizzes that test understanding?",
          "Is there feedback on written work?",
          "Can you replay lessons and download the notes?",
        ],
      },
      {
        id: "books", h: "Where do the books come from?",
        p: [
          "Many classical and modern books are under copyright. A responsible provider uses books it has permission to share, and says so. Be cautious of a course that distributes scanned copies of in-copyright books without any statement of permission.",
        ],
        callout: { title: "A quick test", text: "Ask: where can I see the permission for the books you give me? A good provider can answer at once." },
      },
      {
        id: "certificate", h: "What does the certificate mean?",
        p: [
          "A certificate from a course usually records that you completed that course. It is not the same as a board qualification, and it is not an ijazah, which is a personal licence from a teacher to transmit a text.",
          "That does not make it worthless. It is a fair record of your study. Just be clear about what it is, and do not describe it as more than it is.",
        ],
      },
      {
        id: "price", h: "Price and refunds",
        p: [
          "Check what is free before you pay. A course that lets you try a lesson first is confident in its teaching. Ask how payment works, what happens if you stop, and whether there is a clear policy on refunds.",
        ],
      },
    ],
    related: ["nahw", "fiqh", "hadith"],
  },
  {
    slug: "a-weekly-timetable-for-part-time-students",
    title: "A weekly study timetable for part-time students",
    dek: "How to make steady progress in the classical sciences while working or studying elsewhere, with a sample week you can adapt.",
    category: "Study habits", minutes: 7,
    intro: "Most online students are not full-time. They work, raise families or attend school, and fit the classical sciences into the margins. The good news is that this works: the tradition itself was built on daily, modest portions. What matters is rhythm, not hours.",
    sections: [
      {
        id: "rhythm", h: "Rhythm beats volume",
        p: [
          "Forty minutes every day is worth more than five hours on Sunday. Memory depends on spaced repetition, and a daily habit gives you that without any special effort.",
          "Choose a fixed time and place. Many students find the hour after the dawn prayer best, since the mind is clear and the house is quiet. Others prefer after the night prayer. The best time is the one you will keep.",
        ],
      },
      {
        id: "sample", h: "A sample week",
        p: ["This plan assumes about six hours a week across two or three subjects."],
        list: [
          "Monday: new lesson in the main subject, followed by notes.",
          "Tuesday: revise Monday's lesson and memorise the new portion of the matn.",
          "Wednesday: new lesson in the second subject.",
          "Thursday: revision of Wednesday, plus written exercises.",
          "Friday: light revision and a quiz on the week.",
          "Saturday: a longer session on the hardest topic of the week.",
          "Sunday: rest, or a short recitation of what has been memorised.",
        ],
      },
      {
        id: "revision", h: "Build revision into the week",
        p: [
          "Revision is not an extra; it is half the work. Each lesson should be revised the next day, again after a week, and again after a month. A simple notebook that records the date of each lesson makes this easy to track.",
        ],
        callout: { title: "The one-page rule", text: "At the end of each topic, summarise it on one page. Reviewing a page takes five minutes and keeps the whole topic alive." },
      },
      {
        id: "setbacks", h: "When life interrupts",
        p: [
          "You will miss days. The rule is simple: never miss two in a row. A short ten-minute session on a bad day keeps the thread unbroken, and the next day is easier.",
          "If you fall behind by a week or more, do not try to catch up everything. Go back to the last topic you understood, revise it, and continue from there.",
        ],
      },
      {
        id: "goals", h: "Set small, visible goals",
        list: [
          "A page of the matn memorised per week.",
          "One chapter of the commentary understood per fortnight.",
          "One written summary per month, checked by a teacher.",
        ],
      },
    ],
    related: ["sarf", "nahw", "fiqh"],
  },
  {
    slug: "memorising-and-revising-classical-texts",
    title: "Memorising and revising classical texts",
    dek: "The traditional method of learning a matn by heart, with the habits that make it last for years rather than weeks.",
    category: "Study habits", minutes: 8,
    intro: "For centuries students learned a text by heart before they studied it deeply. The practice survives because it works: a memorised matn is always with you, in the street and in the exam hall, and it gives your understanding something firm to hold. Memorisation is a skill, and like any skill it has a method.",
    sections: [
      {
        id: "why", h: "Why memorise at all?",
        p: [
          "A memorised text becomes a framework. When you meet a new example, you recognise which rule it belongs to. When you read a commentary, you know instantly which phrase of the base text it is explaining.",
          "Memorisation also trains attention. The student who has memorised a hundred lines of grammar reads slowly and carefully in a way that carries over to every other subject.",
        ],
      },
      {
        id: "method", h: "The method",
        p: ["Work in small, fixed portions."],
        list: [
          "Understand the portion first. Never memorise what you cannot explain.",
          "Read it aloud slowly, five times, following the text.",
          "Cover the page and recite what you can. Check, and mark what you missed.",
          "Repeat only the missed parts until the portion is complete.",
          "Recite the whole portion once more before you stop.",
        ],
        ordered: true,
      },
      {
        id: "revise", h: "Revising what you have learned",
        p: [
          "New memorisation is easy compared to keeping the old. Every portion you have learned needs to be recited again. A common plan is to recite the new portion every day for a week, the previous week's portions twice, and everything older once a week.",
          "When you recite, do it aloud. Reciting silently feels the same but it tests you much less.",
        ],
        callout: { title: "Revise before you add", text: "Always recite what you already know before learning something new. Students who skip this find, after a year, that they have forgotten half of what they learned." },
      },
      {
        id: "tools", h: "Tools that help",
        list: [
          "A small notebook with the date each portion was learned and last revised.",
          "A study partner who listens to you recite and corrects you.",
          "A recording of yourself, to listen to while walking or travelling.",
        ],
      },
      {
        id: "limits", h: "What memorisation cannot do",
        p: [
          "Memorising a text gives you its words. It does not give you its meaning. The goal is always to move from the words to the understanding, and then to apply it. A student who has memorised a book and cannot use it has done only half the work.",
        ],
      },
    ],
    related: ["sarf", "nahw", "mantiq"],
  },
  {
    slug: "what-a-certificate-and-an-ijazah-mean",
    title: "Completion certificate, board qualification, ijazah: what each one means",
    dek: "Three different documents are often confused. Knowing the difference protects you from over-claiming and from being misled.",
    category: "Choosing a course", minutes: 6,
    intro: "Students and parents often ask whether a certificate from an online course is 'recognised'. The honest answer depends on which kind of document it is. There are three, and they do different jobs.",
    sections: [
      {
        id: "completion", h: "A completion certificate",
        p: [
          "A completion certificate records that you finished a particular course with a particular teacher or academy. It tells a reader what you studied and when. Its weight depends on the reputation of the teacher and the academy that issued it.",
          "It is a good record of study and a useful addition to a portfolio. It does not, by itself, qualify you for a post that requires a board credential.",
        ],
      },
      {
        id: "board", h: "A board qualification",
        p: [
          "A board qualification, such as a degree or sanad from a madrasa board, is awarded after the board's own examination. It is recognised according to the rules of that board and, in some cases, of the state. Some boards are recognised as equivalent to university degrees for certain purposes.",
          "To obtain one, you normally register with the board and sit its examination. A course, online or otherwise, can prepare you for that examination, but it does not replace it.",
        ],
        callout: { title: "Check with the board", text: "If you need a qualification for employment or study, ask the relevant board directly what it requires and what it recognises." },
      },
      {
        id: "ijazah", h: "An ijazah",
        p: [
          "An ijazah is a licence from a teacher permitting you to transmit a text or a science, and it lists the chain of teachers back to the author. It is a personal grant, not an institutional certificate.",
          "It is given when the teacher is satisfied that you have read the text properly and can teach it. An online course cannot grant one unless the teacher gives it personally.",
        ],
      },
      {
        id: "claims", h: "How to describe what you hold",
        list: [
          "Say 'I completed the course on Mizan al-Sarf with Academy X', not 'I am a certified scholar'.",
          "Name the board when you hold one of its qualifications.",
          "Name the teacher when you hold an ijazah, and give the text it covers.",
        ],
      },
    ],
    related: ["hadith", "fiqh", "tafsir"],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);
