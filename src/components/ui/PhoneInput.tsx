"use client";

import { useEffect, useState } from "react";
import { COUNTRY_CODES, matchDialCode, phoneRuleFor, isValidNationalNumber, type CountryCode } from "@/data/country-codes";
import { digitsOnly } from "@/lib/auth/phone-format";

const DEFAULT_COUNTRY: CountryCode = COUNTRY_CODES[0]; // Sri Lanka, pinned first
const MAX_NATIONAL_DIGITS = 14;

interface PhoneInputProps {
  value: string;                      // E.164, raw, or ""
  onChange: (e164: string) => void;   // always emits "+<dial><national>" (or "" when empty)
  placeholder?: string;               // overrides the per-country example placeholder
  required?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  id?: string;
}

function findCountry(iso: string): CountryCode {
  return COUNTRY_CODES.find((c) => c.iso === iso) ?? DEFAULT_COUNTRY;
}

/** Split any of "+CC...", a bare SL-local number, or "" into { iso, national }. */
function splitValue(value: string): { iso: string; national: string } {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return { iso: DEFAULT_COUNTRY.iso, national: "" };

  if (trimmed.startsWith("+")) {
    const match = matchDialCode(trimmed);
    const digits = digitsOnly(trimmed);
    if (match) return { iso: match.iso, national: digits.slice(match.dial.length) };
    return { iso: DEFAULT_COUNTRY.iso, national: digits };
  }

  // Bare input, assume Sri Lankan local/national and strip the trunk "0".
  const digits = digitsOnly(trimmed);
  return { iso: DEFAULT_COUNTRY.iso, national: digits.startsWith("0") ? digits.slice(1) : digits };
}

/** The national significant number: what the user typed minus any trunk "0". */
function significantOf(national: string): string {
  return national.replace(/^0+/, "");
}

/** Strip the trunk "0" and prefix the dial code. "" when empty. */
function compose(dial: string, national: string): string {
  const significant = significantOf(national);
  if (!significant) return "";
  return `+${dial}${significant}`;
}

/**
 * Reusable country-code + national-number phone input. Always emits E.164
 * via onChange, letting users pick a country instead of typing "+44 ...".
 */
export function PhoneInput({
  value, onChange, placeholder, required, autoFocus, disabled, id,
}: PhoneInputProps) {
  const [iso, setIso]           = useState<string>(() => splitValue(value).iso);
  const [national, setNational] = useState<string>(() => splitValue(value).national);
  const [touched, setTouched]   = useState(false);

  const country = findCountry(iso);
  const rule    = phoneRuleFor(iso);
  // Show a format error only once the user has interacted and typed
  // something that doesn't fit the selected country's format.
  const showError = touched && national.length > 0 && !isValidNationalNumber(iso, significantOf(national));

  // Re-sync if the parent resets/changes `value` to something we didn't
  // just emit ourselves (e.g. a form reset after submit).
  useEffect(() => {
    const currentEmit = compose(country.dial, national);
    if (value === currentEmit) return;
    const next = splitValue(value);
    setIso(next.iso);
    setNational(next.national);
    // Intentionally only re-derive from external `value` changes, not our
    // own iso/national state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleCountryChange(nextIso: string) {
    setIso(nextIso);
    const nextCountry = findCountry(nextIso);
    onChange(compose(nextCountry.dial, national));
  }

  function handleNationalChange(raw: string) {
    // Nice-touch: pasting a full "+CC..." number re-splits it.
    const trimmed = raw.trim();
    if (trimmed.startsWith("+")) {
      const match = matchDialCode(trimmed);
      if (match) {
        const digits = digitsOnly(trimmed).slice(match.dial.length, match.dial.length + MAX_NATIONAL_DIGITS);
        setIso(match.iso);
        setNational(digits);
        onChange(compose(match.dial, digits));
        return;
      }
    }

    const digits = digitsOnly(raw).slice(0, MAX_NATIONAL_DIGITS);
    setNational(digits);
    onChange(compose(country.dial, digits));
  }

  return (
    <div>
      <div
        className={`w-full flex items-stretch bg-slate-100 border rounded-xl overflow-hidden ${
          showError ? "border-red-400 focus-within:border-red-500" : "border-slate-200 focus-within:border-blue-500"
        } ${disabled ? "opacity-60" : ""}`}
      >
        {/* Country select: a decorative compact label sits on top, the real
            <select> is invisible but absolutely covers it, so it still opens
            the native (fully labelled) option list on click/tap. The flag
            glyph uses the self-hosted Twemoji flags font (.flag) so it renders
            on Windows too, where flag emoji otherwise show as "LK"/"SZ". */}
        <div className="relative shrink-0 max-w-[104px] border-r border-slate-200">
          <div aria-hidden className="flex items-center gap-1 pl-3 pr-2 py-2.5 text-sm text-slate-900 truncate">
            <span className="flag">{country.flag}</span>
            <span className="truncate">+{country.dial}</span>
          </div>
          <select
            aria-label="Country code"
            value={iso}
            disabled={disabled}
            onChange={(e) => handleCountryChange(e.target.value)}
            className="flag absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          >
            {COUNTRY_CODES.map((c) => (
              <option key={c.iso} value={c.iso} className="flag">
                {c.flag} {c.name} (+{c.dial})
              </option>
            ))}
          </select>
        </div>

        <input
          id={id}
          type="tel"
          inputMode="tel"
          value={national}
          onChange={(e) => handleNationalChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder ?? rule.example ?? "Phone number"}
          required={required}
          autoFocus={autoFocus}
          disabled={disabled}
          autoComplete="tel-national"
          className="flex-1 min-w-0 px-3 py-2.5 bg-transparent text-slate-900 placeholder-slate-400 text-sm focus:outline-none disabled:cursor-not-allowed"
        />
      </div>
      {showError && (
        <p className="text-red-500 text-xs mt-1">
          Enter a valid {country.name} number{rule.example ? ` (e.g. ${rule.example})` : ""}.
        </p>
      )}
    </div>
  );
}
