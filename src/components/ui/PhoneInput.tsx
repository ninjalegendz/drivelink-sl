"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
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
 *
 * The country picker is a fully styled searchable dropdown (same pattern as
 * ui/Select — a native <select>'s open panel is OS-rendered and unstylable,
 * and it wouldn't apply the self-hosted flag font either).
 */
export function PhoneInput({
  value, onChange, placeholder, required, autoFocus, disabled, id,
}: PhoneInputProps) {
  const [iso, setIso]           = useState<string>(() => splitValue(value).iso);
  const [national, setNational] = useState<string>(() => splitValue(value).national);
  const [touched, setTouched]   = useState(false);

  const [open, setOpen]           = useState(false);
  const [query, setQuery]         = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchRef  = useRef<HTMLInputElement>(null);
  const listRef    = useRef<HTMLUListElement>(null);

  const country = findCountry(iso);
  const rule    = phoneRuleFor(iso);
  // Show a format error only once the user has interacted and typed
  // something that doesn't fit the selected country's format.
  const showError = touched && national.length > 0 && !isValidNationalNumber(iso, significantOf(national));

  // Filter by name, ISO code, or dial code ("sri", "LK" and "94" all work).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_CODES;
    const qDigits = q.replace(/\D/g, "");
    return COUNTRY_CODES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso.toLowerCase() === q ||
        (qDigits.length > 0 && c.dial.startsWith(qDigits)),
    );
  }, [query]);

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

  // Click outside → close.
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Opening: clear the search, focus it, highlight the current country.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    const idx = COUNTRY_CODES.findIndex((c) => c.iso === iso);
    setHighlight(idx >= 0 ? idx : 0);
    setTimeout(() => searchRef.current?.focus(), 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the highlighted row scrolled into view.
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[highlight]?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  function selectCountry(c: CountryCode) {
    setIso(c.iso);
    onChange(compose(c.dial, national));
    setOpen(false);
  }

  function handlePanelKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) selectCountry(filtered[highlight]);
    }
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
    // Key handling lives on the wrapper so Escape/arrows work as soon as the
    // panel opens, even before focus lands in the search box.
    <div ref={wrapperRef} className="relative" onKeyDown={handlePanelKeyDown}>
      <div
        className={`w-full flex items-stretch bg-slate-100 border rounded-xl ${
          showError ? "border-red-400 focus-within:border-red-500" : "border-slate-200 focus-within:border-blue-500"
        } ${disabled ? "opacity-60" : ""}`}
      >
        {/* Country trigger. Flags use the self-hosted Twemoji font (.flag)
            so they render on Windows too. */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Country code: ${country.name} +${country.dial}`}
          className="shrink-0 flex items-center gap-1 pl-3 pr-2 py-2.5 text-sm text-slate-900 border-r border-slate-200 rounded-l-xl hover:bg-slate-200/60 transition-colors disabled:cursor-not-allowed"
        >
          <span className="flag">{country.flag}</span>
          <span>+{country.dial}</span>
          <ChevronDown size={12} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

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
          className="flex-1 min-w-0 px-3 py-2.5 bg-transparent text-slate-900 placeholder-slate-400 text-sm rounded-r-xl focus:outline-none disabled:cursor-not-allowed"
        />
      </div>

      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-72 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
              placeholder="Search country or code…"
              className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
            />
          </div>

          <ul ref={listRef} role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-sm text-slate-400">No country found</li>
            )}
            {filtered.map((c, i) => {
              const isSelected    = c.iso === iso;
              const isHighlighted = i === highlight;
              return (
                <li
                  key={c.iso}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => selectCountry(c)}
                  className={`px-3 py-2 text-sm flex items-center gap-2 cursor-pointer transition-colors ${
                    isHighlighted ? "bg-slate-100" : ""
                  } ${isSelected ? "text-blue-600 font-medium" : "text-slate-700"}`}
                >
                  <span className="flag shrink-0">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className={`shrink-0 text-xs ${isSelected ? "text-blue-500" : "text-slate-400"}`}>+{c.dial}</span>
                  {isSelected && <Check size={14} className="text-blue-600 shrink-0" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {showError && (
        <p className="text-red-500 text-xs mt-1">
          Enter a valid {country.name} number{rule.example ? ` (e.g. ${rule.example})` : ""}.
        </p>
      )}
    </div>
  );
}
