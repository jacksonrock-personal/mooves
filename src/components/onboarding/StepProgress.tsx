// R38 — one step counter, everywhere in onboarding.
//
// The steps used to count three different ways (four dots on profile, "Step 2
// of 3" on free, three FILLED dots meaning "done" on the crew step). Now every
// step carries the same pair: a "Step N of M" eyebrow at the top and a dot row
// with the current step as a pill, just above the CTA.
//
//   Cold path:    profile 1/4 · free 2/4 · crew 3/4 · text alerts 4/4
//   Invited path: profile 1/2 · text alerts 2/2
//
// Text alerts render their own counter (TextAlertsOptIn, R37) from the same
// numbers, passed in as props.
//
// Mockup: mooves-r38-onboarding-refresh.html.

export const COLD_STEPS = 4
export const INVITED_STEPS = 2

export function StepEyebrow({ index, count }: { index: number; count: number }) {
  return (
    <p className="font-sans text-[11.5px] font-bold uppercase tracking-[0.12em] text-purple-500 mb-3">
      Step {index} of {count}
    </p>
  )
}

export function StepDots({ index, count }: { index: number; count: number }) {
  return (
    <div className="flex gap-1.5 justify-center pb-4" aria-hidden="true">
      {Array.from({ length: count }, (_, i) =>
        i + 1 === index ? (
          <span key={i} className="w-[18px] h-1.5 rounded-full bg-purple-500" />
        ) : (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-grey-300" />
        ),
      )}
    </div>
  )
}
