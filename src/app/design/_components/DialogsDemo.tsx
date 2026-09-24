"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BottomSheet } from "@/components/ui/BottomSheet";

export function DialogsDemo() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="danger" onClick={() => setConfirmOpen(true)}>Open confirm dialog</Button>
      <Button variant="secondary" onClick={() => setSheetOpen(true)}>Open bottom sheet</Button>

      <ConfirmDialog
        open={confirmOpen}
        title="Reject this listing?"
        consequence="The host is notified and can resubmit once the issue is fixed. This does not affect their account."
        confirmLabel="Reject listing"
        busy={busy}
        onConfirm={() => {
          setBusy(true);
          window.setTimeout(() => {
            setBusy(false);
            setConfirmOpen(false);
          }, 700);
        }}
        onCancel={() => setConfirmOpen(false)}
      />

      {sheetOpen && (
        <BottomSheet title="Filter vehicles" closeLabel="Close filters" onClose={() => setSheetOpen(false)}>
          <div className="p-5 text-sm leading-6 text-slate-600">
            This is a BottomSheet. It slides up from the bottom edge on a phone, where the thumb already is, and
            scales in centred on desktop, where a bottom sheet would be a long way from the pointer.
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
