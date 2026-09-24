"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, MessageCircle, Send, X } from "lucide-react";
import { createClient, realtimeReady } from "@/lib/supabase/client";

export interface BookingMessage {
  id:         string;
  booking_id: string;
  sender_id:  string;
  body:       string;
  created_at: string;
}

const DEFAULT_CLOSED_NOTE = "This conversation is closed. The booking is complete.";

interface ChatProps {
  bookingId:        string;
  currentUserId:    string;
  side:             "renter" | "page";
  counterpartyName: string;
  initialMessages:  BookingMessage[];
  /** Booking completed/cancelled - the thread stays readable but sends are off. */
  readOnly:         boolean;
  closedNote?:      string;
  /** Height/layout for the host container (card vs modal). */
  className?:       string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-LK", { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" });
}

function mergeById(prev: BookingMessage[], incoming: BookingMessage[]): BookingMessage[] {
  const byId = new Map(prev.map((m) => [m.id, m]));
  let added = false;
  for (const m of incoming) {
    if (!byId.has(m.id)) { byId.set(m.id, m); added = true; }
  }
  if (!added) return prev;
  return [...byId.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

/**
 * Booking-scoped chat between the renter and the Rental Page (migration 054).
 * Same realtime shape as SupportChat: await realtimeReady() so the channel
 * JOIN carries the access_token (otherwise it registers as anon and apply_rls
 * silently drops every postgres_changes event), then append INSERTs for this
 * booking. The mount GET doubles as mark-read (advances the caller's cursor
 * server-side) and as a reconcile pass for anything realtime missed.
 */
export function BookingChat({
  bookingId,
  currentUserId,
  side,
  counterpartyName,
  initialMessages,
  readOnly,
  closedNote,
  className = "h-80",
}: ChatProps) {
  const [messages, setMessages] = useState<BookingMessage[]>(initialMessages);
  const [hydrated, setHydrated] = useState(initialMessages.length > 0);
  const [draft,    setDraft]    = useState("");
  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // How many messages the other party has sent. The mark-read effect keys on
  // this so the cursor advances when THEY write while the chat is open, but
  // not on our own sends (POST already stamps the sender's cursor).
  const theirCount = messages.reduce((n, m) => n + (m.sender_id === currentUserId ? 0 : 1), 0);

  // Mark this side read on mount (and when new counterparty messages land),
  // merging the server's list so a modal opened with no initial rows hydrates.
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/bookings/${bookingId}/messages`)
      .then((res) => (res.ok ? (res.json() as Promise<{ messages?: BookingMessage[] }>) : null))
      .then((payload) => {
        if (cancelled) return;
        if (payload?.messages) setMessages((prev) => mergeById(prev, payload.messages!));
        setHydrated(true);
      })
      .catch(() => { if (!cancelled) setHydrated(true); });
    return () => { cancelled = true; };
  }, [bookingId, theirCount]);

  // Realtime: append INSERTs on this booking's thread. realtimeReady() is the
  // project-critical step - subscribe before the token is seeded and RLS
  // drops every event without an error.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void realtimeReady().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`booking-msgs-${bookingId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "booking_messages", filter: `booking_id=eq.${bookingId}` },
          (payload) => {
            const incoming = payload.new as BookingMessage;
            setMessages((prev) => mergeById(prev, [incoming]));
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [bookingId]);

  // Stick to the bottom on new messages.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || body.length > 2000 || sending) return;

    setSending(true); setError(null);
    const res = await fetch(`/api/bookings/${bookingId}/messages`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ body }),
    });
    const payload = (await res.json().catch(() => ({}))) as { message?: BookingMessage; error?: string };
    setSending(false);

    if (!res.ok || !payload.message) {
      setError(payload.error ?? "Couldn't send. Try again.");
      return;
    }

    // Optimistic append (the realtime channel may also fire, dedup'd by id).
    setMessages((prev) => mergeById(prev, [payload.message!]));
    setDraft("");
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-900/[0.04]">
        {!hydrated && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center text-sm text-slate-500">
            <MessageCircle size={32} strokeWidth={1.5} className="mb-2 text-slate-400" />
            <p>No messages yet.</p>
            <p className="mt-1 text-xs text-slate-400">
              {side === "renter"
                ? `Ask ${counterpartyName} about pick-up, the vehicle, or your dates.`
                : `Message ${counterpartyName} about this booking.`}
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%]">
                  {!mine && (
                    <p className="mb-0.5 text-xs text-slate-500">{counterpartyName}</p>
                  )}
                  <div className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-snug ${
                    mine
                      ? "rounded-br-md bg-blue-600 text-white"
                      : "rounded-bl-md bg-white text-slate-900 ring-1 ring-slate-900/[0.06]"
                  }`}>
                    {m.body}
                  </div>
                  <p className={`mt-1 text-xs text-slate-400 ${mine ? "text-right" : ""}`}>
                    {formatTime(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer / closed line, sticky at the bottom of the chat card */}
      {readOnly ? (
        <p className="pt-3 text-center text-xs text-slate-500">
          {closedNote ?? DEFAULT_CLOSED_NOTE}
        </p>
      ) : (
        <form onSubmit={send} className="pt-3">
          {error && <p className="mb-2 text-xs text-rose-600">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(e as unknown as React.FormEvent);
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Type a message…"
              className="max-h-32 min-h-11 flex-1 resize-none rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-950 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              aria-label="Send"
              className="spring-press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {sending
                ? <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                : <Send size={16} aria-hidden="true" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Enter to send · Shift+Enter for new line · Messages stay on the booking record
          </p>
        </form>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Renter placement: a collapsed "Messages" card on the booking page.
// ------------------------------------------------------------------

interface CardProps {
  bookingId:        string;
  currentUserId:    string;
  counterpartyName: string;
  initialMessages:  BookingMessage[];
  /** Server-computed: page-side messages newer than renter_msgs_read_at. */
  unreadCount:      number;
  readOnly:         boolean;
  closedNote?:      string;
}

export function BookingMessagesCard({
  bookingId,
  currentUserId,
  counterpartyName,
  initialMessages,
  unreadCount,
  readOnly,
  closedNote,
}: CardProps) {
  const [open,       setOpen]       = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  // Opening mounts the chat, whose GET stamps the cursor server-side; clear
  // the badge locally at the same moment so it doesn't linger until refresh.
  const showBadge = unreadCount > 0 && !everOpened;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setEverOpened(true); }}
        className="spring-hover flex w-full items-center justify-between gap-3 rounded-2xl bg-surface p-4 text-left shadow-xs ring-1 ring-slate-900/[0.06] transition-colors hover:ring-blue-200 sm:p-5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600">
            <MessageCircle size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">Messages</span>
            <span className="mt-0.5 block truncate text-xs text-slate-500">
              Chat with {counterpartyName} about this booking
            </span>
          </span>
        </span>
        {showBadge ? (
          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-bold text-white">
            {unreadCount}
          </span>
        ) : (
          <ChevronDown size={16} className="shrink-0 text-slate-400" />
        )}
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-surface p-4 shadow-xs ring-1 ring-slate-900/[0.06] sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <MessageCircle size={14} className="text-blue-600" /> Messages
          <span className="text-xs font-normal text-slate-400">· {counterpartyName}</span>
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Collapse messages"
        >
          <ChevronUp size={16} />
        </button>
      </div>
      <BookingChat
        bookingId={bookingId}
        currentUserId={currentUserId}
        side="renter"
        counterpartyName={counterpartyName}
        initialMessages={initialMessages}
        readOnly={readOnly}
        closedNote={closedNote}
        className="h-80"
      />
    </div>
  );
}

// ------------------------------------------------------------------
// Page placement: a "Message renter" row action opening the chat in a
// modal.
// ------------------------------------------------------------------

interface MessageRenterProps {
  bookingId:     string;
  currentUserId: string;
  renterName:    string;
  /** Renter messages newer than page_msgs_read_at (from the list embed). */
  hasUnread:     boolean;
  readOnly:      boolean;
  closedNote?:   string;
}

export function MessageRenterButton({
  bookingId,
  currentUserId,
  renterName,
  hasUnread,
  readOnly,
  closedNote,
}: MessageRenterProps) {
  const [open,       setOpen]       = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const showDot = hasUnread && !everOpened;

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setEverOpened(true); }}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
      >
        <MessageCircle size={12} /> Message renter
        {showDot && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-blue-600"
            title="New messages from the renter"
            aria-label="Unread messages"
          />
        )}
      </button>
      {open && (
        <MessageRenterModal
          bookingId={bookingId}
          currentUserId={currentUserId}
          renterName={renterName}
          readOnly={readOnly}
          closedNote={closedNote}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function MessageRenterModal({
  bookingId,
  currentUserId,
  renterName,
  readOnly,
  closedNote,
  onClose,
}: {
  bookingId:     string;
  currentUserId: string;
  renterName:    string;
  readOnly:      boolean;
  closedNote?:   string;
  onClose:       () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="animate-scale-in w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/[0.06]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <MessageCircle size={16} className="text-blue-600" /> Messages
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {renterName} · Booking {bookingId.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {/* Messages load lazily via the chat's mount GET (also marks read). */}
        <BookingChat
          bookingId={bookingId}
          currentUserId={currentUserId}
          side="page"
          counterpartyName={renterName}
          initialMessages={[]}
          readOnly={readOnly}
          closedNote={closedNote}
          className="h-[55vh] max-h-[28rem]"
        />
      </div>
    </div>
  );
}
