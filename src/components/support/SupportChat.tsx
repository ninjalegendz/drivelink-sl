"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Headphones, Building2 } from "lucide-react";
import { createClient, realtimeReady } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export interface SupportMessage {
  id:           string;
  thread_id:    string;
  sender_id:    string;
  sender_role:  "admin" | "agency_owner";
  body:         string;
  created_at:   string;
}

interface Props {
  threadId:     string;
  initial:      SupportMessage[];
  currentRole:  "admin" | "agency_owner";
  currentUserId: string;
  // The audience opening the chat. We mark THEIR has_unread flag false on mount.
  audience:     "admin" | "agency";
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
    <div className="flex flex-col h-[calc(100vh-12rem)] min-h-[400px] bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-sm">
            <Headphones size={32} strokeWidth={1.5} className="mb-2 text-slate-400" />
            <p>{audience === "admin" ? "No messages yet." : "Tell us how we can help."}</p>
            <p className="text-xs text-slate-400 mt-1">
              {audience === "admin" ? "Wait for the agency to start the thread." : "An admin will respond as soon as possible."}
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            const isAdmin = m.sender_role === "admin";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%]">
                  {!mine && (
                    <p className="text-[10px] text-slate-500 mb-0.5 inline-flex items-center gap-1">
                      {isAdmin
                        ? <><Headphones size={10} /> DriveLink Support</>
                        : <><Building2 size={10} /> Agency</>}
                    </p>
                  )}
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-snug whitespace-pre-wrap break-words ${
                    mine
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-slate-100 text-slate-100 rounded-bl-md"
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

      {/* Input */}
      <form onSubmit={send} className="border-t border-slate-100 p-3 bg-white/80">
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
            maxLength={4000}
            placeholder="Type a message…"
            className="flex-1 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500 resize-none max-h-32"
          />
          <Button type="submit" loading={sending} disabled={!draft.trim()}>
            <Send size={14} />
          </Button>
        </div>
        <p className="text-[10px] text-slate-400 mt-1">Enter to send · Shift+Enter for new line</p>
      </form>
    </div>
  );
}
