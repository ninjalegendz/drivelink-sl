"use client";

import { useState } from "react";
import { presetIcon } from "@/data/vehicle-presets";
import { resolveRule } from "@/data/rule-translations";
import { EXPLANATION_LANGUAGES, type ExplanationLanguage } from "@/lib/i18n/explanations";

// House rules decide what a renter is charged for, so they are the listing text
// most worth reading in your own language.
//
// The twelve standard rules translate. Anything a host typed themselves cannot,
// and is labelled as their own words rather than left to look translated. That
// distinction is the whole point: a renter who sees Sinhala rules should be able
// to trust that every Sinhala line means what it says.

export function HouseRules({ rules }: { rules: string[] }) {
  const [language, setLanguage] = useState<ExplanationLanguage>("en");
  if (rules.length === 0) return null;

  const resolved = rules.map((rule) => resolveRule(rule, language));
  const hostWritten = resolved.filter((r) => !r.standard).length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-800">Handover requirements</h3>
        <div className="flex gap-1" role="group" aria-label="Rules language">
          {EXPLANATION_LANGUAGES.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              onClick={() => setLanguage(code)}
              aria-pressed={language === code}
              className={`min-h-8 rounded-md px-2 text-xs font-medium transition-colors ${
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

      <ul className="space-y-2">
        {resolved.map((rule, index) => {
          const RuleIcon = presetIcon(rules[index]);
          return (
            <li key={index} className="flex gap-2 text-xs leading-relaxed text-slate-600">
              <RuleIcon className="mt-0.5 w-3.5 h-3.5 shrink-0 text-blue-500" />
              <span lang={rule.standard ? language : undefined}>
                {rule.text}
                {!rule.standard && language !== "en" && (
                  <span className="ml-1 text-slate-400">(host&apos;s own words)</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {hostWritten > 0 && language !== "en" && (
        <p className="text-xs leading-5 text-slate-500">
          {hostWritten === 1 ? "One rule was" : `${hostWritten} rules were`} written by the host and
          {hostWritten === 1 ? " is" : " are"} shown in their original wording. Ask them if anything is unclear.
        </p>
      )}
    </div>
  );
}
