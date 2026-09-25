"use client";

import { useState } from "react";
import { Languages, X } from "lucide-react";
import { EXPLANATIONS, EXPLANATION_LANGUAGES, type ExplanationKey, type ExplanationLanguage } from "@/lib/i18n/explanations";

// Points at a Sinhala or Tamil translation of one money-or-liability
// explanation, one tap away. The language buttons carry their own script
// rather than "SI"/"TA", so a reader recognises their language without
// having to read English first.
//
// Nothing is expanded by default: the paragraph this sits under already
// says the same thing in English, so showing the English translation here
// too would just repeat it. The translation only appears once a language is
// chosen, and collapses again on a second tap of that language or the close
// button, rather than staying open and duplicating the English text above it.

interface Props {
  explanation: ExplanationKey;
  /** Optional heading above the text. */
  title?: string;
  className?: string;
}

// English is deliberately not offered here: it is already the text right
// above this component, so re-showing it would recreate the duplicate this
// component exists to avoid.
const OTHER_LANGUAGES = EXPLANATION_LANGUAGES.filter((l) => l.code !== "en");

export function Explanation({ explanation, title, className = "" }: Props) {
  const [language, setLanguage] = useState<ExplanationLanguage | null>(null);

  function toggle(code: ExplanationLanguage) {
    setLanguage((current) => (current === code ? null : code));
  }

  return (
    <div className={`rounded-lg border border-line-soft bg-slate-50 p-3.5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title
          ? <p className="text-sm font-semibold text-slate-900">{title}</p>
          : <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500"><Languages size={14} aria-hidden="true" /> Read this in</span>}

        <div className="flex gap-1" role="group" aria-label="Read this explanation in another language">
          {OTHER_LANGUAGES.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              onClick={() => toggle(code)}
              aria-pressed={language === code}
              className={`min-h-8 rounded-md px-2.5 text-xs font-medium transition-colors ${
                language === code
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {language && (
        <div className="mt-2.5 flex items-start justify-between gap-2 border-t border-slate-200 pt-2.5">
          <p lang={language} className="text-sm leading-6 text-slate-700">
            {EXPLANATIONS[language][explanation]}
          </p>
          <button
            type="button"
            onClick={() => setLanguage(null)}
            aria-label="Close translation"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
