"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Headphones, Building2, User } from "lucide-react";
import { createClient, realtimeReady } from "@/lib/supabase/client";

export interface SupportMessage {
  id:           string;
  thread_id:    string;
  sender_id:    string;
  sender_role:  "admin" | "agency_owner" | "renter";
  body:         string;
  created_at:   string;
}

interface Props {
  threadId:     string;
  initial:      SupportMessage[];
  currentRole:  "admin" | "agency_owner" | "renter";
  currentUserId: string;
  // The audience opening the chat. We mark THEIR has_unread flag false on mount.
  audience:     "admin" | "agency" | "renter";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-LK", { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" });
}

export function SupportChat({ threadId, initial, currentRole, currentUserId, audience }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<SupportMessage[]>(initial);
  const [draft,    setDraft]    = useState("");
  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mark this side as read on mount, and again whenever new messages arrive
  // from the other side while the chat is open.
  useEffect(() => {
    const supabase = createClient();
    const update = audience === "admin"
      ? { has_unread_admin: false }
      : audience === "renter"
        ? { has_unread_renter: false }
        : { has_unread_agency: false };
    supabase.from("support_threads").update(update).eq("id", threadId).then(() => {
      // Refresh the layout so unread badges in the sidebar update
      router.refresh();
    });
  }, [threadId, audience, messages.length, router]);

  // Realtime subscription, append rows that arrive after we mounted.
  // Auth is bootstrapped by createClient(); we await realtimeReady() so
  // the JOIN carries the access_token (otherwise channel registers as
  // anon and apply_rls drops every event).
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void realtimeReady().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`support-${threadId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "support_messages", filter: `thread_id=eq.${threadId}` },
          (payload) => {
            const incoming = payload.new as SupportMessage;
            setMessages((prev) => {
              if (prev.some((m) => m.id === incoming.id)) return prev;
              return [...prev, incoming];
            });
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [threadId]);

  // Stick to the bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || body.length > 4000) return;

    setSending(true); setError(null);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("support_messages")
      .insert({
        thread_id:   threadId,
        sender_id:   currentUserId,
        sender_role: currentRole,
        body,
      })
      .select("*")
      .single();
    setSending(false);

    if (insertError || !data) {
      setError(insertError?.message ?? "Couldn't send. Try again.");
      return;
    }

    // Optimistic append (the realtime channel may also fire, dedup'd by id)
    setMessages((prev) => prev.some((m) => m.id === (data as SupportMessage).id) ? prev : [...prev, data as SupportMessage]);
    setDraft("");
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[400px] flex-col overflow-hidden rounded-2xl bg-surface shadow-xs ring-1 ring-slate-900/[0.06]">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-slate-500">
            <Headphones size={32} strokeWidth={1.5} className="mb-2 text-slate-400" />
            <p>{audience === "admin" ? "No messages yet." : "Tell us how we can help."}</p>
            <p className="mt-1 text-xs text-slate-400">
              {audience === "admin" ? "Wait for the Rental Page to start the thread." : "An admin will respond as soon as possible."}
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%]">
                  {!mine && (
                    <p className="mb-0.5 inline-flex items-center gap-1 text-xs text-slate-500">
                      {m.sender_role === "admin"
                        ? <><Headphones size={10} /> DriveLink Support</>
                        : m.sender_role === "renter"
                          ? <><User size={10} /> Renter</>
                          : <><Building2 size={10} /> Rental Page</>}
                    </p>
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

      {/* Input, sticky at the bottom of the chat card */}
      <form onSubmit={send} className="border-t border-slate-100 bg-surface p-3">
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
            maxLength={4000}
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
        <p className="mt-1 text-xs text-slate-400">Enter to send · Shift+Enter for new line</p>
      </form>
    </div>
  );
}
