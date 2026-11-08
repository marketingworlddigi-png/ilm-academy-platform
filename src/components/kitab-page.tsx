// A page of a classical kitab drawn in CSS: the matn (base text) framed in the centre, the sharh and hashiya (commentary) as
// lines in the margins, a vermilion marginal number, and a gold back leaf. The verse is Quran 96:1, the first revelation.
// The margin lines are deliberately abstract: no invented scholarly text.
const LINES = ["w-full", "w-[88%]", "w-full", "w-[72%]", "w-[94%]", "w-[60%]", "w-full", "w-[82%]", "w-[68%]"];

function Margin({ side }: { side: "start" | "end" }) {
  return (
    <div aria-hidden="true" className="flex flex-col justify-center gap-[7px]">
      {LINES.map((w, i) => <span key={i} className={`h-[3px] rounded-full bg-ink/15 ${w} ${side === "end" ? "ms-auto" : ""}`} />)}
    </div>
  );
}

export function KitabPage() {
  return (
    <figure className="relative mx-auto w-full max-w-[25rem]">
      <div aria-hidden="true" className="drift absolute -inset-10 rounded-full bg-gold/20 blur-3xl" />
      <div aria-hidden="true" className="absolute inset-0 translate-x-3.5 translate-y-3.5 rotate-[3deg] rounded-[6px] bg-gold/35" />
      <div aria-hidden="true" className="absolute inset-0 -translate-x-2 translate-y-2 rotate-[-4deg] rounded-[6px] bg-white/10" />
      <div className="float-y"><div className="settle relative rounded-[6px] bg-sheet p-3 text-ink shadow-[0_40px_70px_-25px_rgba(0,0,0,0.6)]">
        <div aria-hidden="true" className="border border-gold-deep/70 p-1.5">
          <div className="border-2 border-double border-gold-deep/60 px-3 pb-3 pt-4">
            <p lang="ar" dir="rtl" className="arabic-title text-center text-lg text-gold-deep">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
            <div className="ornament mt-1 mb-4"><span /></div>
            <div className="grid grid-cols-[1fr_1.9fr_1fr] gap-3">
              <Margin side="start" />
              <div className="relative flex min-h-[15rem] flex-col items-center justify-center border-y border-gold-deep/60 py-5 text-center">
                <span className="absolute -start-1 top-2 font-display text-sm text-vermilion">٣</span>
                <p lang="ar" dir="rtl" className="arabic-title text-[2.1rem] leading-[1.75] text-primary-dark">اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ</p>
                <span className="mt-1 text-xl text-vermilion" aria-hidden="true">۝</span>
              </div>
              <Margin side="end" />
            </div>
            <div className="mt-4 flex items-center justify-between text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-gold-deep">
              <span>Matn</span>
              <span className="font-display text-base normal-case tracking-normal text-vermilion">Sūrat al-ʿAlaq · 96:1</span>
              <span>Sharh</span>
            </div>
          </div>
        </div>
        {/* gold ribbon bookmark */}
        <span aria-hidden="true" className="absolute -top-1 end-8 h-12 w-4 bg-vermilion [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)]" />
      </div>
      </div>
      <span aria-hidden="true" className="float-y-b absolute -start-6 top-24 hidden items-center gap-2 rounded-full border border-gold/40 bg-primary-dark/80 px-3 py-1.5 text-xs font-semibold text-gold backdrop-blur sm:flex"><i className="h-1.5 w-1.5 rounded-full bg-gold" />Hashiya</span>
      <span aria-hidden="true" className="float-y absolute -end-8 top-[46%] hidden items-center gap-2 rounded-full border border-gold/40 bg-primary-dark/80 px-3 py-1.5 text-xs font-semibold text-gold backdrop-blur sm:flex"><i className="h-1.5 w-1.5 rounded-full bg-gold" />Sharh</span>
      <figcaption className="mt-7 text-center text-sm text-white/70">Matn in the centre, sharh in the margins: the way every kitab is laid out.</figcaption>
    </figure>
  );
}
