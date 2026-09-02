import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { tutorialBySlug, tutorialForAudience, type TutorialAudience } from "@/data/tutorials";
import { TutorialWatchButton } from "@/components/tutorials/TutorialWatchButton";

interface Props {
  audience: TutorialAudience;
  tutorialSlug?: string;
  className?: string;
}

export function TutorialCallout({ audience, tutorialSlug, className = "" }: Props) {
  const tutorial = tutorialSlug
    ? tutorialBySlug(tutorialSlug) ?? tutorialForAudience(audience)
    : tutorialForAudience(audience);

  return (
    <aside className={`border-y border-blue-100 bg-blue-50 px-4 py-3 ${className}`} aria-label="Tutorial">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <PlayCircle size={22} className="shrink-0 text-blue-700" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{tutorial.shortTitle}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{tutorial.description}</p>
        </div>
        {tutorial.youtubeUrl ? (
          <TutorialWatchButton
            slug={tutorial.slug}
            title={tutorial.title}
            shortTitle={tutorial.shortTitle}
            description={tutorial.description}
            duration={tutorial.duration}
            youtubeUrl={tutorial.youtubeUrl}
          />
        ) : (
          <Link
            href={`/academy#${tutorial.slug}`}
            className="shrink-0 text-sm font-semibold text-blue-700 hover:text-blue-900"
          >
            Guide
          </Link>
        )}
      </div>
    </aside>
  );
}
