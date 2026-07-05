import { CarLoader } from "@/components/ui/CarLoader";

// Loads inside the dashboard shell, sidebar stays put.
export default function Loading() {
  return <CarLoader className="min-h-[60vh]" />;
}
