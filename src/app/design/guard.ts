import { notFound } from "next/navigation";

/**
 * Stops a /design preview page before it renders anything in a production
 * build. The layout's own check is not enough on its own: Next renders a
 * layout and its page in parallel, so the page's sample content was still
 * serialised into the response underneath the 404. Every preview page calls
 * this first.
 */
export function guardDesignPreview(): void {
  if (process.env.NODE_ENV === "production") notFound();
}
