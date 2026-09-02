import { Clock3, PlayCircle } from "lucide-react";
import { TUTORIAL_AUDIENCE_LABELS, tutorialsForAudiences, type TutorialAudience } from "@/data/tutorials";
import { TutorialWatchButton } from "@/components/tutorials/TutorialWatchButton";

interface Props {
  audiences: readonly TutorialAudience[];
}

export function TutorialLibrary({ audiences }: Props) {
  const tutorials = tutorialsForAudiences(audiences);

  return (
    <div className="space-y-10">
      {tutorials.map((tutorial, index) => (
        <article
          key={tutorial.slug}
          id={tutorial.slug}
          className="scroll-mt-24 border-b border-slate-200 pb-10 last:border-b-0"
        >
          <div className={tutorial.youtubeUrl ? "grid gap-5 md:grid-cols-[minmax(0,1fr)_18rem] md:items-start" : undefined}>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-blue-700 text-white">{index + 1}</span>
                {TUTORIAL_AUDIENCE_LABELS[tutorial.audience]}
              </div>
              <h2 className="mt-3 text-xl font-bold text-slate-950">{tutorial.title}</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">{tutorial.description}</p>

              <ol className="mt-5 space-y-2">
                {tutorial.steps.map((step, stepIndex) => (
                  <li key={step} className="flex gap-3 text-sm text-slate-700">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{stepIndex + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {tutorial.youtubeUrl ? (
              <div className="border border-slate-200 bg-slate-950 p-4 text-white md:sticky md:top-24">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1"><Clock3 size={13} /> {tutorial.duration}</span>
                  <span className="inline-flex items-center gap-1"><PlayCircle size={13} /> Video guide</span>
                </div>
                <p className="mt-7 text-base font-semibold">{tutorial.shortTitle}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">Short mobile walkthrough for this step.</p>
                <TutorialWatchButton
                  slug={tutorial.slug}
                  title={tutorial.title}
                  shortTitle={tutorial.shortTitle}
                  description={tutorial.description}
                  duration={tutorial.duration}
                  youtubeUrl={tutorial.youtubeUrl}
                  variant="panel"
                />
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
