"use client";

import { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value:        string;
  onChange:     (value: string) => void;
  options:      readonly SelectOption[];
  placeholder?: string;
  /** Field name, used as the mobile sheet's heading. Falls back to the placeholder. */
  label?:       string;
  /** If set, renders a hidden input so the value is submitted with parent <form>. */
  name?:        string;
  /** Marks the underlying hidden input as required so the browser blocks empty submits. */
  required?:    boolean;
  /** Disable the trigger entirely. */
  disabled?:    boolean;
  className?:   string;
}

/**
 * A theme-matched dropdown. Native <select> opens an OS-rendered panel that
 * can't be styled, this component renders a fully styled list ourselves.
 *
 * Mouse + keyboard (Escape, ArrowUp/Down, Enter) supported. For form-submit
 * scenarios pass `name` so the value is sent like a native field.
 */
export function Select({
  value, onChange, options, placeholder = "Select…", label, name, required, disabled, className = "",
}: Props) {
  const [open, setOpen]               = useState(false);
  const [highlight, setHighlight]     = useState<number>(-1);
  const [mobileSheet, setMobileSheet] = useState(false);
  const [query, setQuery]             = useState("");
  const wrapperRef                    = useRef<HTMLDivElement>(null);
  const triggerRef                    = useRef<HTMLButtonElement>(null);
  const mobileListRef                 = useRef<HTMLDivElement>(null);
  const mobileOptionRefs              = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId                     = useId();

  const selected = options.find((o) => o.value === value);

  // Long lists (the 31 Sri Lankan cities) used to render as a 3-column grid on
  // mobile, which cut "Anuradhapura" and "Nuwara Eliya" in half at 360px. One
  // readable column plus a filter box handles length without shrinking labels.
  const searchable = options.length >= 12;
  const trimmedQuery = query.trim().toLowerCase();
  const visibleOptions = trimmedQuery
    ? options.filter((o) => o.label.toLowerCase().includes(trimmedQuery))
    : options;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setMobileSheet(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  // Click outside → close. Desktop only: the mobile sheet is portalled onto
  // document.body, so it is no longer inside wrapperRef and this handler would
  // fire on mousedown *inside* the sheet, closing it before an option's click
  // could land. The sheet has its own backdrop for dismissal.
  useEffect(() => {
    if (!open || mobileSheet) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, mobileSheet]);

  // Each opening starts from an unfiltered list.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // When opening, highlight the currently selected option
  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setHighlight(idx >= 0 ? idx : 0);
      if (mobileSheet && idx >= 0) {
        const timer = window.setTimeout(() => {
          const list = mobileListRef.current;
          const option = mobileOptionRefs.current[idx];
          if (list && option) {
            list.scrollTop = Math.max(0, option.offsetTop - (list.clientHeight - option.clientHeight) / 2);
          }
        }, 80);
        return () => window.clearTimeout(timer);
      }
    }
  }, [mobileSheet, open, options, value]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (mobileSheet && open && e.target !== triggerRef.current) return;

    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight >= 0 && highlight < options.length) {
        onChange(options[highlight].value);
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      {name && (
        <input
          type="hidden"
          name={name}
          value={value}
          required={required}
          // Hidden input value is what gets submitted; the visible UI is the trigger.
          readOnly
        />
      )}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && highlight >= 0 ? `${listboxId}-${highlight}` : undefined}
        className={`w-full min-h-11 pl-4 pr-10 py-2.5 bg-white border rounded-xl text-base text-left flex items-center justify-between transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          open ? "border-blue-500" : "border-slate-200 hover:border-slate-300"
        } focus:border-blue-500`}
      >
        <span className={selected ? "text-slate-900" : "text-slate-400"}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && !mobileSheet && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto py-1"
        >
          {options.map((opt, i) => {
            const isSelected    = opt.value === value;
            const isHighlighted = i === highlight;
            return (
              <li
                key={opt.value}
                id={`${listboxId}-${i}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className={`px-4 py-2 text-sm flex items-center justify-between cursor-pointer transition-colors ${
                  isHighlighted ? "bg-slate-100" : ""
                } ${
                  isSelected ? "text-blue-600 font-medium" : "text-slate-700"
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check size={14} className="text-blue-600" />}
              </li>
            );
          })}
        </ul>
      )}

      {open && mobileSheet && (
        <BottomSheet title={label ?? placeholder} closeLabel="Close options" onClose={() => setOpen(false)}>
          {searchable && (
            <div className="border-b border-slate-200 p-3">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to filter"
                aria-label={`Filter ${(label ?? placeholder).toLowerCase()}`}
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-base text-slate-950 placeholder:text-slate-400 focus:border-blue-500"
              />
            </div>
          )}
          <div
            ref={mobileListRef}
            id={listboxId}
            role="listbox"
            className="max-h-[62dvh] space-y-1 overflow-y-auto p-2 pb-[max(.75rem,env(safe-area-inset-bottom))]"
          >
            {visibleOptions.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-slate-500">No match for &ldquo;{query.trim()}&rdquo;.</p>
            )}
            {visibleOptions.map((opt, i) => {
              const isSelected = opt.value === value;
              return (
                <button
                  ref={(node) => { mobileOptionRefs.current[i] = node; }}
                  key={opt.value}
                  id={`${listboxId}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => { onChange(opt.value); setOpen(false); triggerRef.current?.focus(); }}
                  className={`flex min-h-11 w-full items-center justify-between rounded-md px-3 text-left text-base ${isSelected ? "bg-blue-600 font-semibold text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
                >
                  <span>{opt.label}</span>{isSelected && <Check size={16} />}
                </button>
              );
            })}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
