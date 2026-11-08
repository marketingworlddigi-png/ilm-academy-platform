// Shared copy for the Darse Nizami overview, the FAQ and the how-it-works page.

export type Stage = {
  n: string;
  years: string;
  title: string;
  ur: string;
  summary: string;
  focus: string[];
  subjects: string[]; // subject slugs
  milestone: string;
};

export const STAGES: Stage[] = [
  {
    n: "I", years: "Years 1 and 2", title: "Foundations of the language", ur: "بنیادیں",
    summary: "The student learns to read Arabic as a system. Sarf tables are memorised, the first nahw primer is learned and basic fiqh gives the study of worship its practical anchor.",
    focus: ["Memorise the core sarf tables and the parts of speech.", "Read short sentences and name the role of each word.", "Learn the rulings of purification and prayer."],
    subjects: ["sarf", "nahw", "fiqh"],
    milestone: "You can conjugate any regular verb and parse a simple sentence.",
  },
  {
    n: "II", years: "Years 3 and 4", title: "Building the toolkit", ur: "اوزار",
    summary: "Grammar deepens into the governing words and the formal arguments of the classical texts. Logic is introduced so that definitions and proofs can be followed.",
    focus: ["Study a middle nahw text and begin the Kafiyah.", "Begin mantiq with the five universals.", "Cover the Hanafi manuals on worship and dealings.", "Meet the first hadith selections."],
    subjects: ["nahw", "mantiq", "fiqh", "hadith"],
    milestone: "You can follow a grammatical argument and define terms precisely.",
  },
  {
    n: "III", years: "Years 5 and 6", title: "Reasoning from the sources", ur: "استدلال",
    summary: "With the language secure, the student turns to how rulings are derived. Rhetoric is introduced to appreciate the Quran's style, and tafsir begins with a complete commentary.",
    focus: ["Study usul al-fiqh to see how jurists read the sources.", "Begin balaghah and the sciences of expression.", "Read a first complete tafsir.", "Study the fuller fiqh texts that give evidence."],
    subjects: ["usul-al-fiqh", "balaghah", "tafsir", "fiqh"],
    milestone: "You can trace a ruling from its evidence to its conclusion.",
  },
  {
    n: "IV", years: "Years 7 and 8", title: "The great texts", ur: "اعلیٰ کتب",
    summary: "The final stage is reading the primary collections and the advanced works. Inheritance law is worked as a calculation and the creed is studied with its proofs.",
    focus: ["Read the six canonical collections of hadith.", "Study the advanced commentaries on tafsir and creed.", "Learn the law of inheritance and solve full cases.", "Revise the whole course."],
    subjects: ["hadith", "tafsir", "aqidah", "faraid"],
    milestone: "You can read the primary sources directly and explain their use.",
  },
];

export type Faq = { q: string; a: string };
export type FaqGroup = { id: string; title: string; items: Faq[] };

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: "syllabus", title: "About the syllabus",
    items: [
      { q: "What is the Darse Nizami?", a: "It is the eight-year course of Islamic sciences taught in madrasas across South Asia. It combines Arabic language, logic, jurisprudence, hadith, tafsir and creed, and is traditionally completed by reading the six canonical hadith collections in the final year." },
      { q: "Which boards does Ilm Academy follow?", a: "The library is organised by board. At present it follows the Kanz-ul-Madaris and Tanzeem-ul-Madaris syllabus, arranged darja by darja. More boards can be added as their syllabi are prepared." },
      { q: "Do you teach every year of the course?", a: "The structure of all eight years is in the library, but not every year has books and courses yet. Years without content are marked 'Syllabus coming soon' rather than left blank." },
      { q: "Is the syllabus the same in every madrasa?", a: "The shape is the same, but the exact texts differ between boards and schools. Our pages describe what is commonly studied; check your own board or teacher for the precise books." },
    ],
  },
  {
    id: "books", title: "Books and permissions",
    items: [
      { q: "Are the books free?", a: "Some are free with an account and some are marked Premium. The access level is shown on every book." },
      { q: "How do you decide which books to publish?", a: "A book is published only if a licence or publisher permission is recorded for it. If we cannot show the permission, we do not publish the book." },
      { q: "Can I download a book?", a: "Books are read in the browser reader. What a reader may do with a title is set by the permission on record for it." },
      { q: "Why is a book I want missing?", a: "Usually because no distribution permission has been recorded for it yet. We would rather list fewer books than publish one we cannot show the permission for." },
    ],
  },
  {
    id: "courses", title: "Courses and learning",
    items: [
      { q: "How do the courses work?", a: "A course is a set of lessons from an academy, each with a video or reading, notes, a quiz and sometimes an assignment. You can follow your progress from the learning page." },
      { q: "Can I ask questions?", a: "Yes. Each lesson has a place for questions and answers, and you can keep personal notes beside the lesson." },
      { q: "Is there a certificate?", a: "Courses can issue a certificate of completion. It records that you finished that course; it is not a board qualification or an ijazah." },
      { q: "Can I study at my own pace?", a: "Yes. Lessons are available once you enrol, and you can return to them whenever you wish." },
    ],
  },
  {
    id: "payments", title: "Plans and payments",
    items: [
      { q: "What does Premium include?", a: "Premium unlocks the books and notes marked Premium for as long as your plan lasts. Free books remain free." },
      { q: "How do I pay?", a: "By bank transfer, JazzCash or Easypaisa. After paying you upload your proof of payment and we verify it." },
      { q: "How long does verification take?", a: "Each payment is checked by a person, so it is not instant. Your payments page shows its status." },
      { q: "What if my payment is rejected?", a: "The page tells you why, and you can submit corrected proof." },
    ],
  },
  {
    id: "academies", title: "For teachers and academies",
    items: [
      { q: "Can my academy teach on the platform?", a: "Yes. You can register your academy, publish courses and manage lessons, quizzes and assignments." },
      { q: "Do academies need approval?", a: "Yes. A new academy is submitted for review and can publish courses once it is approved." },
      { q: "Who owns the course content?", a: "Academies publish their own lessons. For books, the permission on record controls what may be shared." },
    ],
  },
  {
    id: "account", title: "Your account",
    items: [
      { q: "Do I need an account to browse?", a: "No. The library and course pages can be browsed without one. You need an account to read, enrol, take notes or buy a plan." },
      { q: "Which languages does the site support?", a: "The site can be switched between English, Urdu and Arabic. The interface follows your choice; translations of the longer editorial pages are still being prepared, so those are in English for now." },
    ],
  },
];

export const HOW_STEPS: Array<{ n: string; title: string; text: string; points: string[] }> = [
  { n: "1", title: "Pick your board and darja", text: "Start in the library. Choose the board whose syllabus you follow and the darja you are in. Each year lists its subjects.", points: ["Boards are listed with the years they cover.", "A darja without content yet is marked, not hidden."] },
  { n: "2", title: "Find the books for each subject", text: "Open a subject to see the books and notes filed under it. Every book shows its access level and, where available, its cover and author.", points: ["Free titles open once you have an account.", "Premium titles unlock with a plan."] },
  { n: "3", title: "Study with a course", text: "Courses from academies follow the books lesson by lesson. Each lesson has notes, a quiz and a place to ask questions.", points: ["Progress is saved as you go.", "Notes and questions stay with the lesson."] },
  { n: "4", title: "Practise and complete", text: "Quizzes check understanding and assignments give a teacher something to review. Completing a course can earn a certificate.", points: ["A certificate records completion of that course.", "Its code can be verified by anyone."] },
];
