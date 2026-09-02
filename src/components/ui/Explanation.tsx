"use client";

import { useState } from "react";
import { Languages } from "lucide-react";
import { EXPLANATIONS, EXPLANATION_LANGUAGES, type ExplanationKey, type ExplanationLanguage } from "@/lib/i18n/explanations";

// Shows one money-or-liability explanation, with Sinhala and Tamil one tap
// away. The language buttons carry their own script rather than "SI"/"TA", so
// a reader recognises their language without having to read English first.
//
// The choice is per-block and not persisted: these appear at decision points,
// and a person may well want the English wording and the Sinhala wording of
// the same paragraph side by side rather than a global setting.

interface Props {
  explanation: ExplanationKey;
  /** Optional heading above the text. */
  title?: string;
  className?: string;
}

export function Explanation({ explanation, title, className = "" }: Props) {
  const [language, setLanguage] = useState<ExplanationLanguage>("en");

  return (
    <div className={`rounded-lg border border-line-soft bg-slate-50 p-3.5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title
          ? <p className="text-sm font-semibold text-slate-900">{title}</p>
          : <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500"><Languages size={14} aria-hidden="true" /> Also in</span>}

        <div className="flex gap-1" role="group" aria-label="Explanation language">
          {EXPLANATION_LANGUAGES.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              onClick={() => setLanguage(code)}
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

      <p
        lang={language}
        className="mt-2 text-sm leading-6 text-slate-700"
      >
        {EXPLANATIONS[language][explanation]}
      </p>
    </div>
  );
}
