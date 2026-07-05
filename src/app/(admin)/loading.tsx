import { CarLoader } from "@/components/ui/CarLoader";

// Loads inside the admin shell, sidebar stays put.
export default function Loading() {
  return <CarLoader className="min-h-[60vh]" />;
}
