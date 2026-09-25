import Link from "next/link";
import { ArrowLeft, Building2, User } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SupportChat, type SupportMessage } from "@/components/support/SupportChat";

export interface SupportThreadHeader {
  id: string;
  isRenterThread: boolean;
  name: string;
  city: string | null;
  whatsappNumber: string | null;
  isVerifiedPage: boolean;
  renterKycVerified: boolean;
}

export interface SupportThreadViewProps {
  thread: SupportThreadHeader;
  messages: SupportMessage[];
  currentUserId: string;
}

/**
 * The right pane of the support inbox: who this conversation is with, then
 * the conversation itself. SupportChat is rendered as-is (owned elsewhere),
 * just wrapped in the same card language as the rest of the admin area.
 */
export function SupportThreadView({ thread, messages, currentUserId }: SupportThreadViewProps) {
  return (
    <div className="max-w-3xl space-y-4">
      <Link
        href="/admin/support"
        className="-ml-2 inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
      >
        <ArrowLeft size={15} aria-hidden="true" /> Back to all threads
      </Link>

      <Card padding="md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
              {thread.isRenterThread ? <User size={19} aria-hidden="true" /> : <Building2 size={19} aria-hidden="true" />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-900">{thread.name}</p>
                <Badge variant="slate">{thread.isRenterThread ? "Renter" : "Rental Page"}</Badge>
                {!thread.isRenterThread && thread.isVerifiedPage && <Badge variant="green">Verified</Badge>}
                {thread.isRenterThread && thread.renterKycVerified && <Badge variant="green">ID verified</Badge>}
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                {thread.isRenterThread
                  ? "Renter support"
                  : [thread.city, thread.whatsappNumber].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <Link
            href={thread.isRenterThread ? "/admin/users" : "/admin/agencies"}
            className="inline-flex min-h-10 shrink-0 items-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            {thread.isRenterThread ? "View renters" : "View Rental Page"} &rarr;
          </Link>
        </div>
      </Card>

      {/* SupportChat already renders its own rounded, ringed container, so it
          sits directly on the page rather than inside another card. */}
      <SupportChat
        threadId={thread.id}
        initial={messages}
        currentRole="admin"
        currentUserId={currentUserId}
        audience="admin"
      />
    </div>
  );
}
