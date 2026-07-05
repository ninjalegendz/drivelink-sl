import { CarLoader } from "@/components/ui/CarLoader";

// Loads inside the marketplace shell, navbar + footer stay put.
export default function Loading() {
  return <CarLoader className="min-h-[60vh]" />;
}
