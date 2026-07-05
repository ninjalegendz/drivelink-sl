import { CarLoader } from "@/components/ui/CarLoader";

// Global route-loading fallback (initial loads + auth pages).
export default function Loading() {
  return <CarLoader className="min-h-screen" />;
}
