// Phone numbers for display. Stored numbers are E.164 digits with no spaces
// ("+94771234567"), which is exact but hard to read aloud or copy by eye.
// Sri Lankan numbers get the local grouping people write them in; anything
// else keeps its country code apart and is otherwise left as stored, since a
// wrong grouping is worse than none. Never use this for tel: links; those
// keep the raw number.

export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (/\s/.test(trimmed)) return trimmed; // already written for people
  const digits = trimmed.replace(/[^\d+]/g, "");
  const lk = digits.match(/^\+?94(\d{2})(\d{3})(\d{4})$/);
  if (lk) return `+94 ${lk[1]} ${lk[2]} ${lk[3]}`;
  const local = digits.match(/^0(\d{2})(\d{3})(\d{4})$/);
  if (local) return `0${local[1]} ${local[2]} ${local[3]}`;
  return trimmed;
}
