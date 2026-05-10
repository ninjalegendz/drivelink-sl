"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value:        string;
  onChange:     (value: string) => void;
  options:      readonly SelectOption[];
  placeholder?: string;
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
 * can't be styled — this component renders a fully styled list ourselves.
 *
 * Mouse + keyboard (Escape, ArrowUp/Down, Enter) supported. For form-submit
 * scenarios pass `name` so the value is sent like a native field.
 */
export function Select({
  value, onChange, options, placeholder = "Select…", name, required, disabled, className = "",
}: Props) {
  const [open, setOpen]               = useState(false);
  const [highlight, setHighlight]     = useState<number>(-1);
  const wrapperRef                    = useRef<HTMLDivElement>(null);
  const triggerRef                    = useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value);

  // Click outside → close
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

  // When opening, highlight the currently selected option
  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setHighlight(idx >= 0 ? idx : 0);
    }
  }, [open, options, value]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;

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
        className={`w-full pl-4 pr-10 py-2.5 bg-slate-800 border rounded-xl text-sm text-left flex items-center justify-between transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          open ? "border-amber-500" : "border-slate-700 hover:border-slate-600"
        } focus:outline-none focus:border-amber-500`}
      >
        <span className={selected ? "text-white" : "text-slate-500"}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto py-1"
        >
          {options.map((opt, i) => {
            const isSelected    = opt.value === value;
            const isHighlighted = i === highlight;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className={`px-4 py-2 text-sm flex items-center justify-between cursor-pointer transition-colors ${
                  isHighlighted ? "bg-slate-700/70" : ""
                } ${
                  isSelected ? "text-amber-400" : "text-white"
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check size={14} className="text-amber-400" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
