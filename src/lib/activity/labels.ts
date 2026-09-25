// Plain-English wording for activity_events, shared by the admin Dev log.
//
// event_type is a dotted code ("booking.confirmed", "vehicle.price_changed").
// The first part is the category the Dev log filters on; the whole code maps
// to a short verb phrase that reads after the actor's name ("Nimal confirmed a
// booking"). Unknown codes still render, humanised, so a new event written by
// a future migration shows up immediately rather than disappearing.

export type DevLogCategory =
  | "booking" | "vehicle" | "page" | "team" | "account" | "identity" | "review" | "admin" | "blacklist";

export const DEV_LOG_CATEGORIES: { value: DevLogCategory; label: string }[] = [
  { value: "booking",   label: "Bookings" },
  { value: "vehicle",   label: "Listings" },
  { value: "page",      label: "Rental Pages" },
  { value: "team",      label: "Teams" },
  { value: "account",   label: "Accounts" },
  { value: "identity",  label: "Identity" },
  { value: "review",    label: "Reviews" },
  { value: "admin",     label: "Admin actions" },
  { value: "blacklist", label: "Reports" },
];

export const DEV_LOG_ROLES = [
  { value: "admin",        label: "Admins" },
  { value: "agency_owner", label: "Owners" },
  { value: "renter",       label: "Renters" },
  { value: "system",       label: "System" },
] as const;

export const DEV_LOG_RANGES = [
  { value: "24h", label: "24 hours", ms: 24 * 3600_000 },
  { value: "7d",  label: "7 days",   ms: 7 * 24 * 3600_000 },
  { value: "30d", label: "30 days",  ms: 30 * 24 * 3600_000 },
] as const;

export type Tone = "neutral" | "positive" | "attention" | "risk";

const PHRASES: Record<string, { phrase: string; tone?: Tone }> = {
  // Bookings
  "booking.created":                   { phrase: "sent a booking request" },
  "booking.pending_confirmation":      { phrase: "sent a booking request" },
  "booking.confirmed":                 { phrase: "confirmed a booking", tone: "positive" },
  "booking.declined":                  { phrase: "declined a booking", tone: "attention" },
  "booking.cancelled":                 { phrase: "cancelled a booking", tone: "attention" },
  "booking.cancelled_by_renter":       { phrase: "cancelled their booking", tone: "attention" },
  "booking.expired":                   { phrase: "let a booking request expire", tone: "attention" },
  "booking.active":                    { phrase: "started a rental (vehicle handed over)", tone: "positive" },
  "booking.completed":                 { phrase: "completed a rental", tone: "positive" },
  "booking.disputed":                  { phrase: "opened a dispute on a booking", tone: "risk" },
  "booking.dispute_resolved_by_admin": { phrase: "resolved a booking dispute", tone: "positive" },
  // Listings
  "vehicle.created":          { phrase: "created a listing" },
  "vehicle.pending_review":   { phrase: "sent a listing for review" },
  "vehicle.available":        { phrase: "put a listing live", tone: "positive" },
  "vehicle.unlisted":         { phrase: "took a listing offline", tone: "attention" },
  "vehicle.maintenance":      { phrase: "marked a vehicle as in maintenance" },
  "vehicle.rented":           { phrase: "marked a vehicle as rented" },
  "vehicle.price_changed":    { phrase: "changed a listing's price" },
  "vehicle.featured":         { phrase: "featured a listing", tone: "positive" },
  "vehicle.unfeatured":       { phrase: "removed a listing from featured" },
  "vehicle.verified":         { phrase: "marked a listing as Verified Vehicle", tone: "positive" },
  "vehicle.unverified":       { phrase: "removed a listing's Verified Vehicle badge", tone: "attention" },
  "vehicle.paused":           { phrase: "paused a listing", tone: "attention" },
  "vehicle.resumed":          { phrase: "resumed a listing" },
  "vehicle.photos_changed":   { phrase: "changed a listing's photos" },
  "vehicle.plate_changed":    { phrase: "changed a listing's plate number" },
  // Rental Pages
  "page.created":             { phrase: "created a Rental Page", tone: "positive" },
  "page.renamed":             { phrase: "renamed a Rental Page" },
  "page.verified":            { phrase: "verified a Rental Page", tone: "positive" },
  "page.unverified":          { phrase: "removed a Rental Page's verification", tone: "attention" },
  "page.whatsapp_verified":   { phrase: "verified a Rental Page's WhatsApp number", tone: "positive" },
  "page.deactivated":         { phrase: "paused a Rental Page", tone: "attention" },
  "page.reactivated":         { phrase: "reactivated a Rental Page", tone: "positive" },
  "page.blocked":             { phrase: "blocked a Rental Page", tone: "risk" },
  "page.unblocked":           { phrase: "unblocked a Rental Page" },
  "page.transferred":         { phrase: "transferred a Rental Page to a new owner" },
  "page.auto_approve_on":     { phrase: "turned on automatic listing approval for a Rental Page" },
  "page.auto_approve_off":    { phrase: "turned off automatic listing approval for a Rental Page" },
  "page.deleted":             { phrase: "deleted a Rental Page", tone: "risk" },
  // Teams
  "team.member_added":            { phrase: "added a team member to a Rental Page" },
  "team.member_removed":          { phrase: "removed a team member from a Rental Page", tone: "attention" },
  "team.role_changed":            { phrase: "changed a team member's role" },
  "team.document_access_granted": { phrase: "gave a team member access to renter documents", tone: "attention" },
  "team.document_access_revoked": { phrase: "removed a team member's access to renter documents" },
  // Accounts and identity
  "account.created":           { phrase: "created an account", tone: "positive" },
  "account.phone_verified":    { phrase: "verified their phone number", tone: "positive" },
  "account.email_verified":    { phrase: "verified their email address", tone: "positive" },
  "account.role_changed":      { phrase: "had their account role changed" },
  "account.blacklisted":       { phrase: "blacklisted an account", tone: "risk" },
  "account.unblacklisted":     { phrase: "removed an account from the blacklist" },
  "account.bookings_frozen":   { phrase: "froze an account's bookings", tone: "risk" },
  "account.bookings_unfrozen": { phrase: "unfroze an account's bookings" },
  "account.deleted":           { phrase: "deleted an account", tone: "risk" },
  "identity.pending":          { phrase: "submitted an identity check" },
  "identity.verified":         { phrase: "approved an identity check", tone: "positive" },
  "identity.rejected":         { phrase: "rejected an identity check", tone: "risk" },
  "identity.unverified":       { phrase: "reset an identity check", tone: "attention" },
  "identity.licence_approved": { phrase: "approved a driving licence", tone: "positive" },
  "identity.licence_rejected": { phrase: "rejected a driving licence", tone: "risk" },
  "identity.licence_pending":  { phrase: "submitted a driving licence for review" },
  // Reviews
  "review.posted":            { phrase: "reviewed a Rental Page" },
  // Admin tools (written by the app with logEvent)
  "admin.user_edited":                { phrase: "edited an account" },
  "admin.user_deleted":               { phrase: "deleted an account", tone: "risk" },
  "admin.agency_edited":              { phrase: "edited a Rental Page" },
  "admin.agency_deleted":             { phrase: "deleted a Rental Page", tone: "risk" },
  "admin.rating_adjusted":            { phrase: "adjusted a rating", tone: "attention" },
  "admin.vehicle_moderated":          { phrase: "moderated a listing" },
  "admin.report_dismissed":           { phrase: "dismissed a report" },
  "admin.blacklist_report_approved":  { phrase: "upheld a report and blacklisted the account", tone: "risk" },
  "admin.blacklist_report_dismissed": { phrase: "dismissed a blacklist report" },
  "blacklist.report_filed":           { phrase: "filed a report against a renter", tone: "attention" },
};

export function eventCategory(type: string): string {
  return type.split(".")[0] ?? type;
}

export function eventPhrase(type: string): { phrase: string; tone: Tone } {
  const known = PHRASES[type];
  if (known) return { phrase: known.phrase, tone: known.tone ?? "neutral" };
  // A code this file does not know yet still reads as words.
  const [, ...rest] = type.split(".");
  const words = (rest.join(" ") || type).replace(/_/g, " ");
  return { phrase: `${eventCategory(type)}: ${words}`, tone: "neutral" };
}

export function actorRoleLabel(role: string | null | undefined): string {
  switch (role) {
    case "admin": return "Admin";
    case "agency_owner": return "Owner";
    case "renter": return "Renter";
    default: return "System";
  }
}

/** Metadata keys worth showing, in a readable form. Anything else is shown raw. */
export const META_LABELS: Record<string, string> = {
  name: "Name",
  from: "From",
  to: "To",
  from_status: "From",
  to_status: "To",
  reason: "Reason",
  resolution_note: "Resolution note",
  daily_from: "Daily price before",
  daily_to: "Daily price after",
  deposit_from: "Deposit before",
  deposit_to: "Deposit after",
  from_count: "Photos before",
  to_count: "Photos after",
  role: "Role",
  rating: "Rating",
  page_type: "Page type",
  city: "City",
  source: "Source",
  start_date: "Pick-up",
  end_date: "Return",
  days: "Days",
  vehicle_id: "Vehicle",
  from_owner: "Previous owner",
  to_owner: "New owner",
  status: "Status",
};
