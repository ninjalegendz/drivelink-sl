import { guardDesignPreview } from "@/app/design/guard";
import { NavbarShell } from "@/components/layout/NavbarShell";
import { Footer } from "@/components/layout/Footer";
import { AccountDocumentsView } from "@/components/account/AccountDocumentsView";
import { DEMO_PROFILE } from "@/lib/demo/account";
import { DEMO_DOCUMENTS_SHARING, DEMO_DOCUMENTS_EXPORTS, DEMO_DOCUMENTS_LOG } from "@/lib/demo/account-more";

export const metadata = { title: "Design preview: document sharing history" };

// Renders the real AccountDocumentsView with sample data. See
// src/app/design/layout.tsx: this whole area 404s in production.
export default function DesignAccountDocumentsPage() {
  guardDesignPreview();
  return (
    <div className="min-h-screen">
      <NavbarShell isAdmin={false} ownsPages={false} signedIn name={DEMO_PROFILE.full_name} avatarUrl={null} />
      <div className="py-8">
        <AccountDocumentsView
          sharing={DEMO_DOCUMENTS_SHARING}
          exports={DEMO_DOCUMENTS_EXPORTS}
          log={DEMO_DOCUMENTS_LOG}
          totalRows={DEMO_DOCUMENTS_LOG.length}
          page={1}
          totalPages={1}
          hasError={false}
        />
      </div>
      <Footer />
    </div>
  );
}
