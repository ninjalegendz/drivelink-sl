"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, MessageCircle, Send, X } from "lucide-react";
import { createClient, realtimeReady } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export interface BookingMessage {
  id:         string;
  booking_id: string;
  sender_id:  string;
  body:       string;
  created_at: string;
}

const DEFAULT_CLOSED_NOTE = "This conversation is closed — the booking is complete.";

interface ChatProps {
  bookingId:        string;
  currentUserId:    string;
  side:             "renter" | "page";
  counterpartyName: string;
  initialMessages:  BookingMessage[];
  /** Booking completed/cancelled — the thread stays readable but sends are off. */
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
  // project-critical step — subscribe before the token is seeded and RLS
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50 border border-slate-100 rounded-xl">
        {!hydrated && messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">
            Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-sm px-4">
            <MessageCircle size={32} strokeWidth={1.5} className="mb-2 text-slate-400" />
            <p>No messages yet.</p>
            <p className="text-xs text-slate-400 mt-1">
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
                    <p className="text-[10px] text-slate-500 mb-0.5">{counterpartyName}</p>
                  )}
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-snug whitespace-pre-wrap break-words ${
                    mine
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-white text-slate-900 border border-slate-200 rounded-bl-md"
                  }`}>
                    {m.body}
                  </div>
                  <p className={`text-[10px] mt-0.5 text-slate-400 ${mine ? "text-right" : ""}`}>
                    {formatTime(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer / closed line */}
      {readOnly ? (
        <p className="text-slate-500 text-xs text-center pt-3">
          {closedNote ?? DEFAULT_CLOSED_NOTE}
        </p>
      ) : (
        <form onSubmit={send} className="pt-3">
          {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
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
              className="flex-1 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500 resize-none max-h-32"
            />
            <Button type="submit" loading={sending} disabled={!draft.trim()}>
              <Send size={14} />
            </Button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
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
        className="w-full bg-white rounded-2xl border border-slate-100 p-4 mb-4 flex items-center justify-between gap-3 text-left hover:border-blue-300 transition-colors"
      >
        <span className="flex items-center gap-3 min-w-0">
          <MessageCircle size={16} className="text-blue-600 shrink-0" />
          <span className="min-w-0">
            <span className="block text-slate-900 font-semibold text-sm">Messages</span>
            <span className="block text-slate-500 text-xs mt-0.5 truncate">
              Chat with {counterpartyName} about this booking
            </span>
          </span>
        </span>
        {showBadge ? (
          <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        ) : (
          <ChevronDown size={16} className="text-slate-400 shrink-0" />
        )}
      </button>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-slate-900 font-semibold text-sm inline-flex items-center gap-1.5">
          <MessageCircle size={14} className="text-blue-600" /> Messages
          <span className="text-slate-400 font-normal text-xs">· {counterpartyName}</span>
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-slate-400 hover:text-slate-700"
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
// modal, same idiom as ReportProblemButton / InspectionModal.
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
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 transition-colors"
      >
        <MessageCircle size={12} /> Message renter
        {showDot && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-blue-600"
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
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card rounded-3xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-slate-900 font-semibold flex items-center gap-2">
              <MessageCircle size={16} className="text-blue-600" /> Messages
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">
              {renterName} · Booking {bookingId.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900" aria-label="Close">
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
