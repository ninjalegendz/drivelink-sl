# DriveLink Bug, Risk, and Blueprint Gap Audit

**Audit date:** 2026-07-12  
**Workspace:** DriveLink live-code repository  
**Reference specifications:** founder blueprint and “Executing the Blueprint (Rental Pages Architecture)” plan

## Executive verdict

DriveLink is **not launch-ready in its current form**. A substantial amount of UI and schema exists, but implementation presence is being mistaken for enforceable behavior. The most serious problems are below the visible UI: broad Row Level Security (RLS) policies let normal users change protected columns directly, several trust records are mutable by the people they are meant to hold accountable, and multiple public/private data boundaries do not match the product's promises.

The previous estimate that the blueprint was “roughly 65% built” is too optimistic if completion means a secure, end-to-end, production-usable workflow. A more useful assessment is:

| Area | Approximate state | Assessment |
|---|---:|---|
| Rental Pages foundation | 55% | Multi-page rows and a switcher exist, but the account role model, page cap, public page experience, verification, and cross-page notifications remain incomplete. |
| Booking lifecycle | 60% | Many states and screens exist, but transitions, availability, free-launch activation, terms, cancellation, and completion are internally inconsistent. |
| Trust and evidence | 35% | Inspections, agreements, incidents, and consent have UI/schema, but are optional, mutable, incomplete, or bypassable. |
| Security and authorization | 20% | Several P0/P1 RLS and storage issues invalidate admin review, verification, evidence integrity, and privacy claims. |
| Admin operations | 40% | Core screens exist, but blacklist approval, error handling, audit reliability, invoices, and metrics have broken paths. |
| Blueprint-complete product | 35-45% | Major launch promises such as mandatory inspections, page-only reviews, evidence packs, verified vehicles, tourist permits, structured completion math, and legal document storage are absent or partial. |

This audit found **more than 120 distinct defects and gaps**. The first release gate should be the authorization model, not UI polish. Building more workflows on the current broad-update policies would create more records that cannot be trusted as evidence.

## Method and limitations

The audit covered route and component inventory, all SQL migrations, RLS policies and grants, server APIs, storage/R2 paths, service worker behavior, cron scheduling, primary renter/page/admin journeys, platform copy, responsive public screens, and build/tooling configuration.

Two anonymous REST permission probes were used with zero-row/metadata-safe requests. They confirmed that sensitive `profiles` and `vehicles` columns are queryable anonymously without retrieving or publishing user values. Destructive exploits such as self-promoting a test user to admin were **not** executed; those findings are proven from the active policy definitions and application trust model.

The public desktop and mobile surfaces were visually checked and were generally polished, with no major overlap found in the sampled screens. Authenticated end-to-end testing still needs two clean test accounts and a preview database after the security fixes.

## Severity definitions

- **P0 - Critical:** account takeover, privilege escalation, sensitive-data exposure, evidence destruction/forgery, or a control that fundamentally cannot be trusted.
- **P1 - High:** likely financial, legal, safety, privacy, or core-booking failure; launch blocker.
- **P2 - Medium:** material UX, business-rule, admin, or blueprint mismatch that causes confusion or operational work.
- **P3 - Low:** polish, consistency, accessibility, or maintainability issue with limited immediate harm.

## Release blockers at a glance

| ID | Severity | Blocker |
|---|---|---|
| SEC-001 | P0 | Any authenticated user can update their own `role` to `admin`. |
| SEC-002 | P0 | Users can self-verify KYC, clear blacklist/freeze flags, and alter ratings through direct profile updates. |
| SEC-003 | P0 | Page owners can self-verify/unblock pages; vehicle owners can approve and feature their own listings. |
| SEC-004 | P0 | Booking parties can rewrite protected booking columns, including status, price, parties, dates, and evidence stamps. |
| SEC-005 | P0 | Either party can rewrite inspection evidence after submission. |
| SEC-006 | P0 | Sensitive profile and vehicle fields are exposed through overly broad public SELECT policies. |
| SEC-007 | P0 | The PWA service worker can cache private KYC/licence documents after logout. |
| SEC-008 | P0 | Direct document URLs bypass the watermark and access log; arbitrary uploaded content can be served inline on the app origin. |
| TRUST-001 | P1 | Mandatory pickup/return inspections are not mandatory and can be bypassed. |
| TRUST-002 | P1 | The licence orphan sweeper can delete every stored driving-licence image. |
| BOOK-001 | P1 | Booking transition APIs do not enforce the current state and can create impossible jumps. |
| BOOK-002 | P1 | Free bookings become `active` immediately on acceptance, potentially weeks before pickup. |
| BOOK-003 | P1 | Renter booking detail can auto-complete an active rental without return evidence. |
| ADMIN-001 | P1 | Blacklist reports cannot be read by the admin UI, and approval matches NIC against `nic_url` instead of `nic_number`. |
| MONEY-001 | P1 | A real-looking hardcoded bank account is used as a fallback if settings fail. |
| OPS-001 | P1 | Trust cron jobs are scheduled daily instead of every 15 minutes and may not deploy with the main app. |

---

# 1. Security, authorization, and data integrity

## SEC-001 - Self-promotion to administrator

**Severity:** P0  
**Evidence:** `supabase/migrations/001_initial_schema.sql:370-371`; admin layouts and APIs trust `profiles.role`.

The “Users can update their own profile” policy limits the row by `auth.uid() = id` but does not limit columns. Supabase's authenticated role retains UPDATE access to the table.

**Scenario:** A normal renter sends a direct PostgREST PATCH for their own profile with `{ "role": "admin" }`, reloads `/admin`, and gains access to service-role-backed admin actions.

**Required fix:** Revoke direct profile UPDATE, expose narrowly scoped RPCs/API routes for editable fields, add column-level grants, and move admin authorization to an immutable server-side claim or separate membership table. Add negative permission tests.

## SEC-002 - Self-verification and self-unblocking

**Severity:** P0  
**Evidence:** Same broad profile UPDATE policy as SEC-001.

A user can directly alter `kyc_status`, `phone_verified`, `is_blacklisted`, `blacklist_reason`, `booking_frozen`, `reliability_pct`, `rating_avg`, OTP counters/hashes, and deletion state.

**Scenario:** A blacklisted renter creates or logs into an account, PATCHes `kyc_status="verified"`, `is_blacklisted=false`, and `booking_frozen=false`, then submits a booking that the API treats as verified and eligible.

**Required fix:** Make verification, moderation, reliability, OTP, and lifecycle columns server-only. Separate public profile data from protected account state.

## SEC-003 - Page and listing moderation can be bypassed

**Severity:** P0  
**Evidence:** `supabase/migrations/001_initial_schema.sql:380-391` grants owners broad `FOR ALL` access to their page and vehicle rows.

Page owners can directly set `is_verified=true`, `is_blocked=false`, reliability/strike values, and business verification fields. Vehicle owners can set `status="available"`, `is_featured=true`, `verified_vehicle=true`, badges, and other admin-owned fields.

**Scenario:** A fake vehicle is created as `pending_review`; its owner immediately changes it to `available` and marks it featured/verified without an admin ever seeing it.

**Required fix:** Split owner-editable and moderator-owned columns into separate tables or RPCs; revoke direct UPDATE and enforce allowed-field schemas server-side.

## SEC-004 - Booking rows are fully mutable by booking parties

**Severity:** P0  
**Evidence:** `supabase/migrations/001_initial_schema.sql:400-411` uses row predicates but no column restrictions.

The renter and page UPDATE policies authorize a row based on its current ownership/status, then permit all columns to be changed. Protected fields include `vehicle_id`, `agency_id`, `renter_id`, dates, prices, fees, status, document consent, return/completion timestamps, deposit acknowledgements, and cancellation attribution.

**Scenario:** A renter changes the dates and `subtotal_lkr` after acceptance, or a page changes `renter_id`/evidence fields before a dispute. API validation is irrelevant because direct Supabase calls bypass the APIs.

**Required fix:** Remove client UPDATE grants from `bookings`; make every transition and acknowledgement an atomic security-definer function or server API with current-state and field-level checks.

## SEC-005 - Inspection evidence can be rewritten by either party

**Severity:** P0  
**Evidence:** `supabase/migrations/051_trust_core.sql:198-207` explicitly lets both parties UPDATE the inspection row while relying on APIs to constrain columns.

RLS does not know which component made the request. Direct PostgREST calls let the renter replace page-submitted photos/odometer/fuel/plate data, while the page can clear or rewrite the renter's acknowledgement/dispute note.

**Scenario:** After damage is reported, the page replaces return photos; alternatively, the renter changes the odometer and removes the dispute note. The resulting record cannot serve as independent evidence.

**Required fix:** Use append-only submissions and separate acknowledgement rows. Deny UPDATE except trusted server functions that write one party's dedicated columns and preserve prior revisions.

## SEC-006 - Anonymous exposure of sensitive profile and vehicle data

**Severity:** P0  
**Evidence:** `supabase/migrations/001_initial_schema.sql:373-374` allows public profile SELECT; vehicle policy allows every non-`unlisted` row. Anonymous REST probes returned HTTP 200 for sensitive-column queries.

The profile policy is row-wide, not a “basic fields” projection. Depending on grants/schema state it exposes phone, email, address, KYC status/URLs, blacklist fields, OTP metadata, NIC number, licence URLs, and account state. Vehicle rows expose plate, VIN, engine number, document metadata, and pending-review listings.

**Scenario:** A scraper enumerates public profile/contact/identity metadata or queries every pending vehicle's registration identifiers without using the app UI.

**Required fix:** Create explicit public views with only approved columns, revoke table SELECT from `anon`, restrict public vehicles to approved/available rows, and add regression probes in CI.

## SEC-007 - Authenticated bulk scraping of Rental Page contacts

**Severity:** P1  
**Evidence:** `supabase/migrations/013_lock_agency_contact.sql:27` grants authenticated users full SELECT on `agencies`; public row policy remains broad.

The anonymous-column fix does not protect against any logged-in scraper. Private phone, email, address, business registration data, internal metrics, and flags can be queried in bulk.

**Scenario:** A newly created account exports every page's WhatsApp number and email for spam or off-platform solicitation.

**Required fix:** Use a public page view and a booking-gated contact RPC; do not grant authenticated users raw table SELECT.

## SEC-008 - Document viewer claims are bypassable

**Severity:** P0  
**Evidence:** `src/app/api/docs/[...key]/route.ts`; `src/app/(dashboard)/dashboard/bookings/[id]/documents/page.tsx:103-112`.

The visible page adds a CSS watermark and logs on page render, but the underlying `/api/docs/kyc/...` response returns the original unwatermarked file. Opening/copying the image URL bypasses both the watermark and `document_access_log`.

**Scenario:** A page owner opens DevTools, copies the image request URL, saves the raw NIC, and revisits it repeatedly. The renter sees only the original viewer-page log entry.

**Required fix:** Serve a server-rendered watermarked derivative per booking, log each authorized object response atomically, add `Content-Disposition`, and never expose the original to page owners.

## SEC-009 - Private KYC documents can persist in service-worker cache

**Severity:** P0  
**Evidence:** `public/sw.js:52-77` caches same-origin image responses; private documents use same-origin `.jpg/.png` URLs.

The service worker's cache-first image rule can cache authenticated `/api/docs/...jpg` responses even though the route sends `Cache-Control: private, no-store`. Cache Storage survives logout and is not cleared.

**Scenario:** A page owner views a renter's licence on a shared device, signs out, and the cached response remains retrievable offline or by the next session.

**Required fix:** Explicitly exclude `/api/docs`, `/api/`, and authenticated/private paths; honor `no-store`; version/clear old caches immediately; test logout/offline behavior.

## SEC-010 - Stored same-origin script execution through document uploads

**Severity:** P0  
**Evidence:** `src/app/api/storage/sign/route.ts:37-66`; `src/app/api/docs/[...key]/route.ts:79-83`.

The signer trusts client-provided MIME type/extension. The private proxy serves the stored `Content-Type` inline on the DriveLink origin without `X-Content-Type-Options: nosniff` or a safe attachment disposition.

**Scenario:** An attacker uploads HTML or active SVG as a “licence,” then gets an owner/admin to open its raw URL. Script runs in the app origin and can act with that user's session.

**Required fix:** Strict MIME/extension allowlist, magic-byte validation after upload, forced safe image conversion, `nosniff`, sandboxed/attachment delivery, and malware scanning for PDFs.

## SEC-011 - Upload size and quota controls are advisory

**Severity:** P1  
**Evidence:** storage signing accepts requested metadata and produces a PUT URL without hard content-length enforcement or per-user quota.

**Scenario:** Any authenticated user repeatedly signs URLs and uploads large/arbitrary objects, causing storage cost or denial of service.

**Required fix:** Bind signed requests to a maximum length, verify object size/type before accepting references, rate limit signing, cap account storage, and delete rejected objects.

## SEC-012 - Vehicle availability sabotage across Rental Pages

**Severity:** P1  
**Evidence:** `supabase/migrations/033_vehicle_availability.sql:38-44` checks that `agency_id` belongs to the caller but does not ensure `vehicle_id` belongs to that same page.

**Scenario:** A competitor copies a public vehicle UUID and inserts a month-long `vehicle_blocks` row using their own page ID. Search and booking APIs hide/reject the victim's vehicle.

**Required fix:** Add a composite ownership constraint/check in a server function and remove direct inserts. RLS must verify `vehicles.id = vehicle_id AND vehicles.agency_id = agency_id`.

## SEC-013 - Internal availability reasons are public

**Severity:** P2  
**Evidence:** `supabase/migrations/033_vehicle_availability.sql:33-35` permits public SELECT of full `vehicle_blocks` rows.

**Scenario:** The page writes “engine failure after crash” or “owner overseas” as an internal reason; any visitor can query it despite UI only showing dates.

**Required fix:** Publish a date-only view and keep `reason` owner/admin-only.

## SEC-014 - Review subject is not constrained to the counterparty

**Severity:** P1  
**Evidence:** review INSERT policy in `supabase/migrations/001_initial_schema.sql:421-432` verifies booking participation but not `reviewee_id`.

**Scenario:** A party to one completed booking reviews themselves, an unrelated user, or an admin. The rating trigger recalculates that arbitrary profile's public rating.

**Required fix:** Enforce reviewer/reviewee pair from booking parties and move reviews to `rental_page_id` per blueprint. Add DB constraints for dimensions and comment length.

## SEC-015 - Activity log is forgeable

**Severity:** P0  
**Evidence:** `supabase/migrations/035_activity_events_insert_policy.sql:15` allows authenticated inserts with `WITH CHECK (true)`.

**Scenario:** A renter inserts an event claiming `actor_role="admin"` and “dispute resolved” or “document verified.” Admin timelines now contain fabricated evidence.

**Required fix:** Revoke INSERT from authenticated users; service-role/server function only; derive actor and role server-side; make events append-only.

## SEC-016 - Support-role impersonation and thread deletion

**Severity:** P1  
**Evidence:** `supabase/migrations/019_agency_signup_and_support.sql:66-82` does not bind `sender_role` to the actual user role, and page owners have broad thread management.

**Scenario:** A page owner inserts a support message labeled `admin`, making the UI show it as “DriveLink Support,” or deletes/manipulates the support thread and unread state.

**Required fix:** Derive sender role on the server; use insert-only messages; restrict thread changes to dedicated read-cursor functions; prohibit owner DELETE.

## SEC-017 - Completed booking chats are writable through RLS

**Severity:** P1  
**Evidence:** `supabase/migrations/054_booking_messages.sql:37-47` checks party membership but not booking status.

**Scenario:** The UI is read-only after completion, but a party inserts new messages directly, backfilling threats or purported agreements after a dispute begins.

**Required fix:** Enforce allowed statuses in RLS/server function and preserve a cryptographically/auditably closed transcript.

## SEC-018 - Legacy public KYC bucket risk

**Severity:** P1  
**Evidence:** the initial storage migration creates a public KYC bucket; no clear migration converts/removes all legacy objects.

**Scenario:** Old NIC/selfie uploads remain accessible by public object URL even though new code uses private R2.

**Required fix:** Inventory production buckets, migrate objects, rotate URLs, make the bucket private, and delete obsolete policies.

## SEC-019 - Active-page upload race

**Severity:** P2  
**Evidence:** upload signing derives the vehicle-document path from the active-page cookie.

**Scenario:** An owner starts an upload in Page A, switches to Page B in another tab, then completes the first form. The object is rooted under the wrong page and later fails authorization/sweeping.

**Required fix:** Bind uploads to an explicit page ID validated against ownership and issue a short-lived upload transaction token.

## SEC-020 - Phone verification does not survive phone edits safely

**Severity:** P1  
**Evidence:** profile fields are directly editable; changing `phone` does not reliably reset/reverify `phone_verified`.

**Scenario:** A verified user replaces their phone with a third party's number; the UI still displays it as verified and notifications/contact go to the new number.

**Required fix:** Phone changes require an OTP challenge to the new number and atomic update of phone plus verification timestamp.

---

# 2. Authentication and account management

## AUTH-001 - Logged-in Pricing CTA sends the user back to signup

**Severity:** P1  
**Evidence:** `src/app/(marketplace)/pricing/page.tsx:93`, home `page.tsx:40`, and `src/components/layout/NavbarShell.tsx:108,199` hardcode `/signup?intent=provider`.

**Scenario:** A logged-in renter opens Pricing, presses “List your vehicle,” and sees the signup form again instead of creating a Rental Page.

**Required fix:** Make the CTA session-aware: authenticated users go to `/account/pages/new`; guests go to signup with a validated continuation URL.

## AUTH-002 - Signup ignores provider intent

**Severity:** P2  
**Evidence:** `/signup?intent=provider` is generated in several places, but signup does not consume the intent or continue into page creation.

**Scenario:** A guest presses “List your vehicle,” creates an account, lands on generic Home, and must discover Rental Pages manually.

**Required fix:** Preserve a safe internal `next=/account/pages/new` through OTP/signup and display context-appropriate completion copy.

## AUTH-003 - OTP delivery can fail open in production

**Severity:** P0  
**Evidence:** `src/lib/sms/textlk.ts:33`; login/signup send-code routes return `devCode` when `devOnly` is true.

If TextLK credentials are missing, SMS reports a successful dev-only result and the unauthenticated API returns the six-digit OTP. There is no hard production environment guard.

**Scenario:** A deployment loses one environment variable; anyone requesting a code receives the valid code in JSON and can take over enumerated phone accounts.

**Required fix:** Fail closed outside explicit local development, never return OTPs in deployed environments, and make startup/deployment validation require notification credentials.

## AUTH-004 - Weak OTP storage plus public profile exposure

**Severity:** P0  
**Evidence:** `src/lib/sms/otp.ts` hashes a six-digit OTP with plain SHA-256; profile policy exposes the row broadly.

**Scenario:** If the hash column is exposed, all one million OTP possibilities can be tested offline quickly before expiry.

**Required fix:** Keep OTP state in a private table, use keyed HMAC/pepper, revoke all client reads, and use strict rate/attempt limits.

## AUTH-005 - Delivery cascade reports false success

**Severity:** P1  
**Evidence:** email/SMS helpers return `{ok:false}` but callers often do not inspect `.ok`; dev-only SMS is treated as delivered and stops fallback.

**Scenario:** SMS is misconfigured and email fails, but booking/verification UI says the notification was sent. No later channel is attempted.

**Required fix:** Normalize provider results, only mark delivered on confirmed success, continue cascade on dev-only/failure, and expose operational alerts.

## AUTH-006 - Email shown as editable/usable when it is not

**Severity:** P2  
**Evidence:** signup says email can be added later; Account Details renders a disabled field. Agreement acceptance updates `profiles.email`, not `auth.users.email`.

**Scenario:** A phone-only user adds an email while signing, then tries email login or expects verification; authentication still uses the internal placeholder address.

**Required fix:** Implement verified email change through Supabase Auth and keep profile/auth email synchronized transactionally.

## AUTH-007 - Internal placeholder email leaks into Account UI

**Severity:** P2  
**Evidence:** account renders `user.email`; phone-only auth uses `digits@phone.drivelink.invalid`.

**Scenario:** A phone-only user sees an alarming fake email in Account Details and cannot change it.

**Required fix:** Recognize placeholder domains and render “No email added,” with a working add/verify flow.

## AUTH-008 - Email verification nudge is misleading

**Severity:** P2  
**Evidence:** account copy says “We've sent a link” on view; there is no resend action.

**Scenario:** The original email expired or went to spam; the user revisits Account and is told another link was sent, but no send occurs.

**Required fix:** Add resend with rate limits and status/error feedback; change copy to reflect actual state.

## AUTH-009 - Didit session creation is replayable and webhook ordering is unsafe

**Severity:** P1  
**Evidence:** session route lacks strong idempotency/rate limiting; webhook does not require the incoming session to match the current profile session.

**Scenario:** Repeated clicks create billable sessions. Later, an old rejected/unknown webhook arrives after a successful new session and downgrades the account to rejected/pending.

**Required fix:** One active session per user, event-id idempotency, session binding, monotonic state transitions, and alerting on unknown statuses.

## AUTH-010 - KYC update errors are ignored

**Severity:** P1  
**Evidence:** `src/lib/account/kyc-apply.ts:59` awaits update without checking the returned error.

**Scenario:** Didit reports success, webhook returns success, but the profile stays unverified; neither user nor admin knows the write failed.

**Required fix:** Check and propagate DB errors, retry idempotently, and retain webhook processing status.

## AUTH-011 - NIC blacklist matching is format-sensitive

**Severity:** P1  
**Evidence:** `kyc-apply.ts` compares exact stored NIC text.

**Scenario:** `901234567V`, `901234567 v`, or a hyphen/space variant is treated as a different identity and does not inherit the blacklist.

**Required fix:** Canonicalize by document type before storage/comparison and enforce a normalized unique/search column.

## AUTH-012 - Account existence is enumerable

**Severity:** P2  
**Evidence:** login/signup APIs return distinct “account exists/does not exist” behavior.

**Scenario:** An attacker uploads a list of Sri Lankan phone numbers and identifies DriveLink users for phishing or SIM-swap targeting.

**Required fix:** Use neutral responses where possible, aggressive rate/device limits, CAPTCHA after thresholds, and monitoring.

## AUTH-013 - “Never verify again” copy overpromises

**Severity:** P3  
**Scenario:** Session expiry, security revocation, cookie clearing, or a new browser prompts login again after the app promised otherwise.

**Required fix:** Say “stay signed in on this device until you sign out or the session expires.”

## AUTH-014 - Password settings copy exists in a passwordless product

**Severity:** P2  
**Evidence:** account/settings copy references updating a password, but no password workflow exists.

**Scenario:** A user thinks they have a password they should rotate and searches for a control that is absent.

**Required fix:** Remove password language or intentionally add password authentication; do not present both models accidentally.

## AUTH-015 - No session/device security controls

**Severity:** P2  
**Scenario:** A page owner's phone/session is stolen; there is no login activity, revoke-all-sessions, or 2FA control to protect fleet, documents, and bookings.

**Required fix:** Although deferred in the blueprint, add session revocation and login activity before real sensitive documents are used; prioritize 2FA for admins/page owners.

---

# 3. Rental Pages architecture

## PAGE-001 - “Unlimited Rental Pages” is implemented as a cap of five

**Severity:** P1  
**Evidence:** page creation UI says “up to 5” at `src/app/(marketplace)/account/pages/new/page.tsx:51`; server logic enforces the cap.

**Scenario:** A fleet operator with six branches cannot model the sixth page, directly contradicting the central product philosophy and Pricing's growth language.

**Required fix:** Remove the arbitrary cap or state a documented operational limit everywhere. Add abuse controls that do not redefine the product.

## PAGE-002 - Personal account and Rental Page are still mutually exclusive roles

**Severity:** P1  
**Evidence:** navigation/layout logic branches on one `profiles.role` (`renter` versus `agency_owner`).

**Scenario:** After a renter creates a page, their role changes and personal My Bookings/document-sharing navigation disappears, even though the blueprint says one identity can rent and operate pages.

**Required fix:** Keep account identity role-neutral; model admin separately and derive page capabilities from ownership/membership.

## PAGE-003 - Page switching changes shell, but not all background context

**Severity:** P2  
**Evidence:** realtime booking notifier and support unread badge subscribe only to the active page.

**Scenario:** An owner manages Pages A and B while viewing A. A booking/message reaches B, but no in-app notification appears until the owner switches.

**Required fix:** Subscribe/query across all owned pages and label notifications with the destination page.

## PAGE-004 - Page switch failures are hidden

**Severity:** P2  
**Evidence:** `PageSwitcher` and Rental Page list route/refresh after switch request without reliably handling a failed response.

**Scenario:** Cookie update fails; UI navigates to Dashboard but queries the old page, making the owner believe records crossed pages or disappeared.

**Required fix:** Await and validate the switch response, show an error, retain current context, and include active-page identity visibly in operational screens.

## PAGE-005 - No page lifecycle or team ownership model

**Severity:** P2  
**Scenario:** A business closes a branch, sells it, or needs staff to manage bookings. It cannot deactivate, transfer, or delegate the page without sharing the owner's personal account.

**Required fix:** Add page status, soft deletion, ownership transfer with confirmation, and scoped staff roles before onboarding agencies.

## PAGE-006 - Business verification is largely cosmetic

**Severity:** P1  
**Evidence:** registration number is optional, certificate upload is absent, and admin approval UI does not surface the required business evidence.

**Scenario:** A user selects Business, provides no registration certificate, and can still be approved or self-verify through SEC-003.

**Required fix:** Add certificate storage/review, legal entity fields, expiry/re-review, and block verification until required evidence passes.

## PAGE-007 - Admin can approve a page whose owner KYC is incomplete

**Severity:** P1  
**Evidence:** admin UI warns but leaves approval action enabled.

**Scenario:** An unverified identity creates a page that receives a verified badge, weakening the core trust claim.

**Required fix:** Enforce owner KYC at DB/API level, not as a warning.

## PAGE-008 - Public Rental Page profile is missing

**Severity:** P1  
**Scenario:** A renter clicks the page name expecting fleet, reviews, business identity, hours, and trust signals, but there is no real public page destination; reviews remain tied to the owner's profile.

**Required fix:** Build a canonical `/pages/[slug]` surface and make vehicles/reviews/search link to it.

## PAGE-009 - Logo, cover, certificate, and page contact fields are incomplete

**Severity:** P2  
**Evidence:** schema has some columns, but creation/settings do not provide a complete upload and review workflow.

**Scenario:** A legitimate business cannot present the profile promised in the blueprint, while a thin page can look equally trusted.

**Required fix:** Finish page media, legal/business fields, contact verification, hours, and moderation states.

## PAGE-010 - Blocked/unverified pages can still surface vehicles

**Severity:** P1  
**Evidence:** public vehicle/search paths do not consistently filter `agencies.is_blocked`/deleted/verification state; blocking only unlists currently available vehicles.

**Scenario:** Admin blocks a page with a pending vehicle; the vehicle is later approved or owner self-unblocks it and the listing reappears.

**Required fix:** Centralize a public-listing predicate that requires live, nonblocked page plus approved vehicle. Apply it to every RPC/detail/SEO route and invalidate caches.

## PAGE-011 - “Agency,” “host,” “provider,” and “Rental Page” coexist

**Severity:** P2  
**Evidence:** renter booking pages, admin tables, support, notification settings, and vehicle details still display “agency/host/provider.”

**Scenario:** A personal owner sees “registered agency,” while a renter sees four labels for the same counterparty and cannot tell who the legal contracting party is.

**Required fix:** Define a terminology matrix: public “Rental Page,” legal “Owner/Rental Business,” internal table names may remain legacy. Run a copy sweep after workflow changes.

## PAGE-012 - Page contact numbers are not verified

**Severity:** P1  
**Scenario:** A page enters a mistyped or third-party WhatsApp number; booking documents and renter contact unlock to the wrong person.

**Required fix:** OTP-verify page phone/WhatsApp independently and display verification state.

---

# 4. Booking, availability, and pricing

## BOOK-001 - State machine validates target, not current transition

**Severity:** P1  
**Evidence:** booking transition endpoints accept a target status without consistently asserting `current -> target`; zero-row updates can still trigger success/notifications.

**Scenario:** A stale page jumps a cancelled booking to completed, or sends “confirmed” notifications although the conditional update matched nothing.

**Required fix:** One transactional transition function must lock the row, verify actor/current/target, update once, write audit event, and return the new row.

## BOOK-002 - Free acceptance starts the rental immediately

**Severity:** P1  
**Evidence:** `src/app/api/bookings/transition/route.ts:67-77` maps confirm to `active` when booking fee is zero.

**Scenario:** A page accepts a December booking in July; Dashboard labels the car on-road, document access becomes mid-rental, return controls appear, and overdue/completion logic can operate months early.

**Required fix:** `confirmed` must mean accepted/reserved regardless of fee. Activate only at pickup after agreement and pickup inspection gates.

## BOOK-003 - Renter page auto-completes without return evidence

**Severity:** P1  
**Evidence:** `src/app/(marketplace)/bookings/[id]/page.tsx:139-160` performs a completion backstop after end plus 24 hours.

**Scenario:** The vehicle is genuinely missing; the renter opens the booking and causes it to become completed before the page files the non-return report.

**Required fix:** Never mutate lifecycle from a read page. Overdue rentals remain active/critical until page/admin closure with evidence.

## BOOK-004 - Renter can report return before pickup

**Severity:** P1  
**Evidence:** return route checks only `status === active`; free acceptance can make it active immediately.

**Scenario:** Renter presses “vehicle returned” weeks before handover, creating false evidence and enabling later completion.

**Required fix:** Require pickup inspection/activation and server time at or after pickup; permit corrections only through audited admin resolution.

## BOOK-005 - Owner can complete without return, time, or inspection gates

**Severity:** P1  
**Scenario:** Page clicks “complete anyway” before pickup/end or without renter return acknowledgement. Reviews, fees, and evidence retention proceed as if rental occurred.

**Required fix:** Enforce end time, activation, return inspection, and renter return/override reason server-side. Admin override must be explicit and audited.

## BOOK-006 - Pending requests contradict the “owner chooses” model

**Severity:** P1  
**Evidence:** booking/search treats `pending_confirmation` as an exclusive date conflict.

**Scenario:** First low-quality renter requests a popular car and blocks every other renter for up to 48 hours, so the page never sees competing requests to choose from.

**Required fix:** Decide one model. If requests stack, only confirmed/payment/active blocks dates; show conflict risk and atomically decline losers on confirmation. If exclusive holds are intended, state hold duration clearly.

## BOOK-007 - Free confirmation does not auto-decline overlapping requests

**Severity:** P1  
**Evidence:** DB overlap trigger reacts to `confirmed`; free flow jumps directly to `active`.

**Scenario:** Multiple pending requests survive after one is accepted, then receive confusing later responses or conflicts.

**Required fix:** Make confirmation state universal and run loser-decline logic in the same transaction.

## BOOK-008 - Stale pending requests expire only when another request arrives

**Severity:** P2  
**Evidence:** stale cleanup is embedded in booking creation, not scheduled.

**Scenario:** No second renter tries the vehicle, so a month-old unanswered request remains pending in both dashboards forever.

**Required fix:** Scheduled expiry with notifications and idempotent audit events.

## BOOK-009 - Detail-page availability is false for unrelated users

**Severity:** P1  
**Evidence:** vehicle detail queries bookings through party-only booking RLS; anonymous/other renters cannot see occupied ranges.

**Scenario:** Calendar shows dates as available, user completes the form, and API finally rejects “already booked.”

**Required fix:** Expose a privacy-safe availability RPC returning only blocked ranges, used consistently by detail, modal, search, and API.

## BOOK-010 - Date overlap semantics disagree

**Severity:** P1  
**Evidence:** search RPC uses inclusive date overlap; API/DB use time-aware half-open ranges; vehicle blocks use another combination.

**Scenario:** A rental ends at 10:00 and the next starts at 10:00. API permits it, but search hides the vehicle; block end dates likewise differ by screen.

**Required fix:** Adopt `[start, end)` everywhere and document whether maintenance end date is available or unavailable.

## BOOK-011 - No per-booking rental mode

**Severity:** P1  
**Evidence:** booking captures neither self-drive nor chauffeur selection; licence gate only catches self-drive-only vehicles.

**Scenario:** A vehicle offers both modes. An unlicensed renter intends self-drive, but API assumes they may want a driver and accepts the request.

**Required fix:** Required mode selection, snapshot mode/driver pricing, enforce licence/tourist permit rules for self-drive.

## BOOK-012 - Listing terms are not enforced by booking

**Severity:** P1  
**Evidence:** booking ignores min/max duration, weekly rate, delivery, included km, extra km, driver charges, minimum age, and structured rules.

**Scenario:** Page sets minimum seven days and a weekly discount; renter books two days at daily pricing and the page must reject manually.

**Required fix:** Central authoritative quote/eligibility function used for preview, create, agreement, and completion.

## BOOK-013 - Terms can change after request (bait-and-switch risk)

**Severity:** P1  
**Evidence:** agreement snapshot is created at confirmation from the live vehicle row, not the request-time terms.

**Scenario:** Renter requests when deposit is Rs 25,000; page edits it to Rs 100,000 before acceptance; generated agreement contains the new amount.

**Required fix:** Snapshot offer/terms/price at request. Any change requires a clearly presented amendment accepted by both parties.

## BOOK-014 - Weekly pricing is display-only

**Severity:** P2  
**Scenario:** Listing advertises Rs 35,000/week versus Rs 6,000/day, but a seven-day booking quotes Rs 42,000.

**Required fix:** Define deterministic daily/weekly/monthly optimization and test boundaries (7, 14, 28, 30, 31 days).

## BOOK-015 - Late billing rules can double-charge

**Severity:** P1  
**Evidence:** strict 24-hour blocks can add a day for a later return time; agreement adds hourly late fees and then a full day after six hours “in addition.”

**Scenario:** A renter is 6h15 late and is charged an extra rental day plus six/seven hourly fees, while the quote may already have added a day based on end time.

**Required fix:** One mutually exclusive late-fee ladder with grace period, cap, examples, and completion calculation.

## BOOK-016 - Platform maximum duration can be exceeded by time math

**Severity:** P2  
**Evidence:** DB date constraint is <=365 days while billable-day ceiling can become 366 due to times; API lacks a direct billable-day max check.

**Scenario:** Dates are 365 calendar days apart with a later return time; generated total/quote becomes 366 days.

**Required fix:** Validate the same time-aware billable duration in API and DB.

## BOOK-017 - Sri Lanka/browser timezone handling is inconsistent

**Severity:** P2  
**Scenario:** Tourist device remains on Europe/US time; local date inputs and “today” differ from server's Colombo interpretation, affecting minimum pickup and cancellation cutoff.

**Required fix:** Label timezone, use `Asia/Colombo` helpers everywhere, and avoid UTC-derived “today” for Sri Lankan operations.

## BOOK-018 - Owner cancellation cutoff can be wrong by 5.5 hours

**Severity:** P1  
**Evidence:** naive `start_at` parsing is used in server/client cancellation checks.

**Scenario:** A page can cancel after the promised cutoff or is blocked too early depending on runtime timezone.

**Required fix:** Store/compare timestamptz anchored to Colombo and test deployment runtime timezone.

## BOOK-019 - Page cancellation penalties are inconsistent

**Severity:** P1  
**Evidence:** cancellation triggers historically penalize renter reliability; page strikes use non-atomic read-modify-write; no visible recent-cancellation marker/ranking demotion.

**Scenario:** Page cancels the day before pickup, renter's reliability falls, and future renters see no warning about the page.

**Required fix:** Actor-specific cancellation events and atomic counters; owner reliability/ranking rules with decay and public factual marker.

## BOOK-020 - Payment-pending renter lacks an expected cancel action

**Severity:** P2  
**Scenario:** Renter cannot or will not pay the lock-in fee and has no visible way to release the booking, even though policy/state logic permits cancellation.

**Required fix:** Add cancel with clear consequences and owner notification, or explicitly disable it server-side and explain support path.

## BOOK-021 - Payment expiry “self-heal” is unsafe

**Severity:** P1  
**Scenario:** Renter opens an expired page; client locally shows cancelled even if DB update failed, owner is not notified, `cancelled_by` is missing, and renter reliability may be penalized.

**Required fix:** Server cron/transaction only, system attribution, update-result check, both-party notification.

## BOOK-022 - Payment slip PDFs render as broken images

**Severity:** P2  
**Scenario:** Renter uploads a valid PDF receipt; Next Image attempts to display it as an image and the preview is broken.

**Required fix:** MIME-aware PDF viewer/download control with safe headers and upload validation.

## BOOK-023 - Slip approval/rejection can revive stale bookings

**Severity:** P1  
**Scenario:** Admin leaves a slip page open, booking is cancelled elsewhere, then approval updates it back to active because there is no current-status guard. Rejection says renter was notified but sends nothing.

**Required fix:** Transactional status guard, checked errors, audit and actual notification; immutable slip revisions.

## BOOK-024 - Search ranks only within each pagination page

**Severity:** P2  
**Scenario:** A highly verified/relevant vehicle on DB page two can never outrank a weak vehicle on page one. Result count displays only loaded page size.

**Required fix:** Apply full ranking in SQL before limit/offset and return total count/cursor.

## BOOK-025 - Search errors look like “no vehicles”

**Severity:** P2  
**Scenario:** Network/RPC failure empties results and removes useful retry state, convincing users there is no inventory.

**Required fix:** Distinct loading/error/empty states, retry, telemetry, and stable previous results.

## BOOK-026 - Search filter/cache abuse and stale moderation

**Severity:** P2  
**Scenario:** Arbitrary query combinations create unbounded cache keys/query work; an unlisted or blocked vehicle remains visible for the cache TTL because moderation does not invalidate tags.

**Required fix:** Validate/normalize filters, rate limit, use bounded cache keys, and invalidate listing/search caches on moderation.

## BOOK-027 - Prominent pre-booking WhatsApp bypasses the trust funnel

**Severity:** P2  
**Scenario:** Renter presses WhatsApp, agrees off-platform, and never creates a booking, agreement, inspection, message record, fee event, or review.

**Required fix:** Make in-app request/message primary; reveal direct contact only at the blueprint-defined stage, with emergency/support exceptions.

---

# 5. Money, fees, and analytics

## MONEY-001 - Hardcoded bank account fallback can misdirect money

**Severity:** P1  
**Evidence:** payment UI falls back to `Commercial Bank / 8001234567` when settings are missing.

**Scenario:** Production settings query fails and a renter transfers the platform fee to an unintended real-looking account.

**Required fix:** Fail closed with “payment temporarily unavailable”; never ship realistic fallback financial details.

## MONEY-002 - Free-launch flags can disagree

**Severity:** P1  
**Evidence:** public copy uses `NEXT_PUBLIC_FREE_LAUNCH`; booking API uses DB `platform_settings.booking_fee_lkr`.

**Scenario:** Pricing says no fee while checkout charges one, or Pricing announces fees while API charges zero.

**Required fix:** One server-owned monetization configuration returned to both UI and API, with effective dates and audit history.

## MONEY-003 - Completion stamps Rs 200 page fee during free launch

**Severity:** P1  
**Evidence:** `supabase/migrations/025_hybrid_payment_model.sql:34` sets `agency_fee_lkr := 200` on completed bookings.

**Scenario:** Pricing promises commission-free launch, but page dashboard/invoices show money owed after the first completion and deletion may be blocked for unpaid fees.

**Required fix:** Replace hardcoded trigger with versioned fee policy and free-booking counter; zero means zero across dashboard, invoice, deletion, and analytics.

## MONEY-004 - “First five free” success pricing is not implemented

**Severity:** P1  
**Scenario:** The plan markets five free completed bookings per page, but there is no reliable page counter/effective fee policy and current trigger charges every completion.

**Required fix:** Decide whether this recommendation is product spec, announce it consistently, and implement an auditable per-page billing ledger.

## MONEY-005 - Direct-payment completion math is missing

**Severity:** P1  
**Scenario:** Extra kilometres, fuel difference, late fees, cleaning, damage, delivery, driver allowances, and deposit return are discussed but no authoritative final statement records what each party agreed/paid.

**Required fix:** Structured charge ledger with evidence, two-sided acknowledgements, dispute status, and a final non-custodial settlement summary.

## MONEY-006 - Analytics misclassify free bookings

**Severity:** P2  
**Scenario:** Funnel defines “paid” by slip presence, so completed zero-fee bookings produce zero paid conversions. Revenue assumes booking fees on completed rows were collected.

**Required fix:** Model `fee_required`, `fee_paid`, and direct rental payment separately; calculate conversion from lifecycle events.

## MONEY-007 - Admin metrics use hardcoded fee labels

**Severity:** P2  
**Scenario:** Admin changes configured booking fee, but dashboards still label Rs 500/Rs 200 assumptions, leading to wrong operational decisions.

**Required fix:** Derive all labels and calculations from the same fee-policy version stored on each booking.

## MONEY-008 - “Invoices” are not invoices

**Severity:** P2  
**Scenario:** Admin sees per-booking collected toggles but there is no invoice number, period, PDF, issue date, legal entity, payment, email, or credit note.

**Required fix:** Rename to fee ledger until real invoicing exists, or implement actual invoice artifacts.

## MONEY-009 - Invalid invoice month can crash the page

**Severity:** P2  
**Scenario:** `/admin/invoices?month=abc` produces an invalid Date and server error.

**Required fix:** Strict query parsing with a safe current-month fallback and 400 for malformed API requests.

---

# 6. Trust core: documents, inspections, agreements, claims, and reviews

## TRUST-001 - Inspections are optional despite being the flagship mandatory control

**Severity:** P1  
**Evidence:** page can complete without a return inspection after a browser confirm; no hard pickup gate exists.

**Scenario:** Vehicle is handed over and returned with no structured evidence, then a deposit dispute occurs. DriveLink's strongest advertised protection is absent.

**Required fix:** Activation requires page pickup inspection plus renter acknowledgement/difference flow; completion requires mirrored return inspection, with explicit admin emergency override.

## TRUST-002 - Driving-licence orphan sweeper deletes valid files

**Severity:** P1  
**Evidence:** `src/lib/storage/sweep.ts:29-36` collects only `nic_url` and `selfie_url`, omitting `license_front_url`/`license_back_url`.

**Scenario:** Daily sweep marks all licence images as unreferenced and deletes them. Profile URLs remain non-null, so booking gate passes while owner sees 404 documents.

**Required fix:** Include all reference columns, use a storage-reference table, dry-run/report before deletion, and verify existence during booking eligibility.

## TRUST-003 - Required inspection photo set is not enforced

**Severity:** P1  
**Scenario:** Page uploads four arbitrary images instead of front/rear/left/right/interior/dashboard/odometer/fuel/damage slots; evidence lacks the exact angle needed later.

**Required fix:** Typed slots with minimum resolution/timestamp, required pickup/return set, and immutable per-slot metadata.

## TRUST-004 - Inspection photo ownership is weak

**Severity:** P1  
**Scenario:** A submitter references an R2 URL belonging to another booking/user because API checks storage shape but not upload transaction ownership.

**Required fix:** Bind signed upload keys to booking, phase, slot, uploader, and expiry; validate all before submission.

## TRUST-005 - Legacy handover-photo route can overwrite evidence

**Severity:** P1  
**Scenario:** Either party replaces pickup/return arrays after completion or submits empty arrays through the old route, conflicting with structured inspections.

**Required fix:** Remove/disable legacy writes after migration and backfill into one append-only evidence model.

## TRUST-006 - Agreement snapshot creation is asynchronous and can fail silently

**Severity:** P1  
**Scenario:** Page accepts; response returns; renter opens Agreement before background snapshot exists. The background write fails and booking proceeds without any agreement or retry signal.

**Required fix:** Create and validate snapshot inside the acceptance transaction before confirming the booking; add idempotent retry/health queue.

## TRUST-007 - Agreement is not a durable signed document

**Severity:** P1  
**Scenario:** Parties check a box on a web rendering, but no immutable PDF/file hash/email attachment exists in Booking Documents. Later template code changes or DB mutation undermine evidence.

**Required fix:** Generate versioned PDF, hash and timestamp it, store immutable acceptance records, email both parties, and expose permanent booking documents.

## TRUST-008 - Agreement acceptance identity/meta is incomplete

**Severity:** P1  
**Scenario:** A session holder clicks accept; there is no OTP reconfirmation, reliable IP/context, Didit reference, verified email binding, or strong device/session evidence.

**Required fix:** At minimum capture authenticated user, agreement hash, timestamp, IP/user agent/session ID; consider OTP for high-risk agreements.

## TRUST-009 - Agreement does not identify the legal owner adequately

**Severity:** P1  
**Scenario:** Contract names “Kasun's Cars” with a WhatsApp number but omits the personal owner's legal name/address or business legal entity/registration. Police/court cannot easily identify the contracting owner.

**Required fix:** Lawyer-approved party identity schema and immutable legal entity snapshot.

## TRUST-010 - Agreement omits core booking facts

**Severity:** P1  
**Scenario:** Contract lacks selected self-drive/chauffeur mode, delivery/pickup location, tourist permit declaration, VIN/engine number, and sometimes plate. A vehicle substitution dispute cannot be resolved cleanly.

**Required fix:** Include all identity, mode, location, permit, vehicle, price, and terms snapshots.

## TRUST-011 - Agreement contains unenforced promises

**Severity:** P1  
**Evidence:** clauses promise deposit hold limits, second estimates, 30-day fine windows, and dispute behavior without matching timers/workflows.

**Scenario:** Renter relies on a seven-day deposit-return rule, but the platform has no deadline enforcement or escalation.

**Required fix:** Remove clauses the product cannot operate, or implement timers, notices, evidence and escalation before publishing them. Obtain Sri Lankan lawyer review.

## TRUST-012 - Insurance liability language exceeds the plan's safe posture

**Severity:** P1  
**Scenario:** Private-insurance listing agreement says the renter may owe full repair/replacement/loss-of-use, while plan says DriveLink only displays a warning and does not certify coverage. Loss-of-hire cap is absent.

**Required fix:** Lawyer-review liability language; show insurance facts and owner/renter duties without making unbounded or misleading platform determinations.

## TRUST-013 - Consent is not freely revocable in pre-rental states

**Severity:** P1  
**Evidence:** consent DELETE route allows revocation only while `active`, not `confirmed`/`payment_pending`.

**Scenario:** Renter grants consent after acceptance, changes their mind before pickup, but cannot revoke while the owner can still view documents.

**Required fix:** Permit revocation until a narrowly justified legal/evidence retention point; clearly separate access revocation from record retention.

## TRUST-014 - “Currently sharing” includes closed bookings

**Severity:** P2  
**Evidence:** Account Documents filters only non-null consent, not viewable booking status; consent is not cleared on closure.

**Scenario:** Completed/cancelled booking shows a green “Sharing” badge although viewer route says access ended.

**Required fix:** Derive current access from consent plus status/window and display historical grant/revoke/end timestamps separately.

## TRUST-015 - Access log records page render, not actual document delivery

**Severity:** P1  
**Scenario:** Viewer page logs all available documents even if images fail/load below fold; raw image fetches are unlogged. The history is both over- and under-inclusive.

**Required fix:** Log each successful authorized document response with viewer, page, booking, document version, purpose, and request metadata.

## TRUST-016 - Damage claim/dispute flow is generic and non-transactional

**Severity:** P1  
**Scenario:** Incident insert succeeds but booking status update fails, leaving an orphan open claim; renter has no structured accept/dispute-estimate flow or 72-hour claim window.

**Required fix:** Transactional claim creation, structured estimate/evidence/response states, post-return deadline, and completion-charge integration.

## TRUST-017 - Admin resolution leaves some incidents open

**Severity:** P1  
**Scenario:** Booking is resolved/completed while incidents in `awaiting_response` or `escalated` remain unresolved because update targets only `open` rows.

**Required fix:** Define incident-to-booking closure rules and update all relevant statuses atomically.

## TRUST-018 - Reviews remain personal-profile reviews

**Severity:** P1  
**Evidence:** renter booking page passes `agency.owner_id` as `revieweeId`; page can still review renter publicly.

**Scenario:** Owner operates two unrelated Rental Pages; one page's bad review affects the person's rating on both, and renters themselves receive public ratings contrary to blueprint.

**Required fix:** New page-review table/dimensions; migrate renter-to-page reviews; retire public renter reviews and preserve only internal reliability/history.

## TRUST-019 - Verified Vehicle tier is not operational

**Severity:** P1  
**Scenario:** New wizard omits several identity/expiry fields, docs are optional, `verified_vehicle` is not set through a complete review, and search gives no verified weighting/filter.

**Required fix:** Define checklist and evidence state, admin review, badge expiry, public filter, and ranking signal. “Verified” must be earned and revocable.

## TRUST-020 - New listing can be photo-less

**Severity:** P1  
**Scenario:** Owner submits no photos or some uploads fail; wizard silently continues and creates a pending listing without the blueprint's seven basic images.

**Required fix:** Required typed photo slots, upload retry/progress, block submit on failure, and server-side completeness check before review.

## TRUST-021 - Vehicle-document save errors are hidden

**Severity:** P2  
**Scenario:** Vehicle row is created but document upsert fails; owner sees success and admin later sees missing evidence without knowing an error occurred.

**Required fix:** Transaction/job status and explicit partial-failure recovery.

## TRUST-022 - Tourist permit workflow is absent

**Severity:** P1  
**Scenario:** Foreign renter books self-drive with no IDP/AA/DMT permit declaration; owner receives no handover reminder to inspect original documents.

**Required fix:** Nationality/permit declaration, guidance-not-advice content, page-visible answer, and mandatory original-document inspection checkbox.

## TRUST-023 - Insurance search/filter and expiry controls are absent

**Severity:** P1  
**Scenario:** Renter cannot filter hire-insured vehicles; an expired private policy still shows a static insurance label and can be booked.

**Required fix:** Insurance type filter, expiry status, plain-language warnings, admin/doc review, and no “coverage certified” language.

## TRUST-024 - No police-ready late-return evidence pack

**Severity:** P1  
**Scenario:** Vehicle is 24h overdue; page sees a critical state but cannot export agreement, identity, licence, messages, inspections, timeline, and contact history as one stable record.

**Required fix:** Versioned evidence-pack PDF/ZIP generated from immutable artifacts with access logging and legal review.

---

# 7. Admin, reporting, and moderation

## ADMIN-001 - Blacklist review queue is nonfunctional

**Severity:** P1  
**Evidence:** `blacklist_reports` has RLS enabled but no admin SELECT/UPDATE policy; admin page uses the session client, not service role.

**Scenario:** Page files a serious report through the service API; admin Blacklist page remains empty and actions cannot update the report.

**Required fix:** Build authenticated admin APIs/server components with immutable admin authorization and tested policies.

## ADMIN-002 - “Blacklist NIC” updates the wrong column

**Severity:** P1  
**Evidence:** `src/components/admin/BlacklistActions.tsx:26` searches `nic_url ILIKE reportedNic` instead of `nic_number`.

**Scenario:** Admin approves report; badge changes locally if allowed, but no matching renter is blocked because an R2 URL does not contain the NIC.

**Required fix:** Normalize and match `nic_number`, update report/profile atomically, include reviewer/reason/public wording, notify and offer appeal.

## ADMIN-003 - Reporting scope is far short of blueprint

**Severity:** P2  
**Scenario:** User encounters a fake listing/page/account but cannot report it. Only page-to-renter post-booking report exists, with free-text reason and no category/evidence workflow.

**Required fix:** Report targets for account/page/listing/booking/message, structured categories, evidence, duplicate/rate controls, status, notification, and appeal.

## ADMIN-004 - Blacklist process lacks notification and appeal

**Severity:** P1  
**Scenario:** Renter is blocked based on an owner report but receives no factual decision notice or way to appeal, contrary to plan and defamation-safe posture.

**Required fix:** Lawyer-approved notice, evidence summary, appeal intake, reviewer separation, expiry/review policy, and audit log.

## ADMIN-005 - Admin actions frequently ignore database errors

**Severity:** P1  
**Evidence:** Agency verification, blocking, slip actions, blacklist actions, invoice toggles, and some edits await writes without checking errors.

**Scenario:** Network/RLS failure occurs; spinner stops and UI refreshes or closes as if successful, while database remains unchanged.

**Required fix:** Route all privileged actions through typed admin APIs, check affected rows, show persistent success/error, and log only after confirmed commit.

## ADMIN-006 - Admin rating adjustment for pages references a nonexistent field

**Severity:** P2  
**Scenario:** Admin selects agency/page “Rating”; endpoint queries `agencies.rating_avg`, which is not the modeled rating location, causing failure. Profile manual rating is later overwritten by review trigger.

**Required fix:** Remove arbitrary rating edits or create an explicit moderated adjustment ledger applied to page review aggregates.

## ADMIN-007 - Partial auth/profile email edits are hidden

**Severity:** P2  
**Scenario:** Profile update succeeds but Auth email sync fails; API returns 207, modal sets an error and then closes, leaving inconsistent identity state with little operator visibility.

**Required fix:** Transaction-like reconciliation state, do not close on partial failure, and provide repair action.

## ADMIN-008 - Page blocking is incomplete

**Severity:** P1  
**Scenario:** Blocking unlists only currently available vehicles; pending/maintenance records can later return, cached listings remain visible, and broad owner policy permits self-unblock.

**Required fix:** Page status must be an authoritative predicate in every public query; server-only moderation fields and cache purge.

## ADMIN-009 - “Admin-only cancellation reason” is not admin-only

**Severity:** P2  
**Scenario:** UI says the owner's note is internal, but booking parties can read the row/direct API, exposing accusatory or sensitive notes to the renter.

**Required fix:** Separate internal moderation notes from party-visible cancellation reason.

## ADMIN-010 - Admin state transitions can create impossible records

**Severity:** P1  
**Scenario:** Admin uses stale controls to complete a pending/cancelled booking or confirm a disputed one because target validation is not tied to current state.

**Required fix:** Same atomic state-machine function as all other actors, with explicit admin override events.

## ADMIN-011 - Admin counts and queues can silently show zero

**Severity:** P2  
**Scenario:** RLS/query failure is converted to empty arrays/count zero, so admin believes there are no pending listings/reports/incidents.

**Required fix:** Treat operational query failure as an alerting error state, never as an empty queue.

## ADMIN-012 - Audit timeline is not legal-grade evidence

**Severity:** P1  
**Scenario:** Besides SEC-015 forgery, many privileged actions do not write events or write after partial failure; timestamps/actor labels therefore cannot reconstruct a reliable case.

**Required fix:** Append-only server-generated event log written in the same transaction as each protected mutation.

---

# 8. Messaging and notification gaps

## MSG-001 - Incoming support text is visually invisible

**Severity:** P1  
**Evidence:** `src/components/support/SupportChat.tsx:149` uses `bg-slate-100 text-slate-100` for one incoming bubble state.

**Scenario:** Page/admin receives a reply but sees an apparently blank light-grey bubble.

**Required fix:** Use a contrasting text token and add visual regression/contrast tests.

## MSG-002 - Booking chat loses newest messages after 500

**Severity:** P1  
**Evidence:** messages query orders ascending and calls `.limit(500)` at `src/app/api/bookings/[id]/messages/route.ts:135`.

**Scenario:** Long incident thread has 650 messages; reload retrieves the oldest 500 and the latest 150 disappear from the UI.

**Required fix:** Cursor pagination from newest, reverse for display, and transcript export.

## MSG-003 - Contact details are not gated in chat

**Severity:** P1  
**Scenario:** Before acceptance, either party sends phone numbers, WhatsApp links, emails, or bank details, bypassing the contact-unlock and on-platform record strategy.

**Required fix:** Decide policy; if gating is required, detect/redact contact patterns pre-acceptance and explain in context without losing incident content later.

## MSG-004 - New messages have no reliable out-of-app nudge

**Severity:** P1  
**Scenario:** Recipient is offline and does not revisit the app; an extension/incident message goes unseen because no SMS/WhatsApp/email notification is sent.

**Required fix:** Batched unread-message notification cascade with preferences, rate limits, escalation for incidents, and deep links.

## MSG-005 - Support is page-only

**Severity:** P2  
**Scenario:** A renter needs help with KYC/payment/dispute but has no in-app support thread and is pushed to WhatsApp, fragmenting evidence.

**Required fix:** Personal support inbox with booking context and admin triage.

## MSG-006 - Cancellation copy promises a notification that is not sent

**Severity:** P2  
**Evidence:** `CancelBookingButton` says “The agency will be notified,” but the path does not reliably send one.

**Scenario:** Renter cancels, assumes owner knows, owner prepares the vehicle because no notification arrived.

**Required fix:** Send/record actual notification or change copy; display delivery status where operationally important.

---

# 9. UX, navigation, copy, and accessibility

## UX-001 - Public “verified” language overstates reality

**Severity:** P1  
**Scenario:** Home/metadata/SEO says renters, pages, or vehicles are verified while basic listings can lack documents and moderation can be bypassed.

**Required fix:** Use precise labels: “identity verified,” “page reviewed,” “vehicle documents reviewed,” with scope/date and no blanket trust claim.

## UX-002 - Unpublished listings are publicly reachable

**Severity:** P1  
**Scenario:** Someone shares/guesses a pending listing slug and a normal visitor sees an “Admin preview” warning plus sensitive listing information; page may be indexed.

**Required fix:** Admin/owner-only preview route, 404 for public users, `noindex`, and strict approved predicate.

## UX-003 - Booking copy does not match KYC timing

**Severity:** P2  
**Evidence:** API comment/UI describes book-before-ID and verification after request, but booking API rejects every nonverified renter.

**Scenario:** User is told to request first and verify later, fills the flow, then is blocked at submit.

**Required fix:** Choose one funnel and align API, steps, FAQ, SMS, and empty states.

## UX-004 - Contact-unlock copy conflicts with early WhatsApp

**Severity:** P2  
**Scenario:** FAQ says provider number is hidden until confirmation/KYC, but vehicle pages offer direct WhatsApp before booking.

**Required fix:** One contact policy applied to every button and help article.

## UX-005 - Free/direct-payment copy can be false

**Severity:** P1  
**Scenario:** Booking page unconditionally says no payment to DriveLink while DB booking fee can be positive; Pricing says commission-free while Rs 200 completion trigger runs.

**Required fix:** Render copy from the booking's immutable fee policy, not build-time flags.

## UX-006 - FAQ promises nonexistent request notes

**Severity:** P2  
**Scenario:** FAQ tells airport renters to add flight details/special requests, but booking has no notes field.

**Required fix:** Add structured special requests/flight fields or remove guidance.

## UX-007 - FAQ cancellation promise is inaccurate

**Severity:** P2  
**Scenario:** Guest modal says cancel before agency confirms for a full refund, though no payment was taken and cancellation penalties/allowed states do not match consistently.

**Required fix:** State exact stage-specific consequences and avoid “refund” when nothing was collected.

## UX-008 - Listing rejection has no reason/resubmit workflow

**Severity:** P1  
**Scenario:** Admin rejects listing; owner sees status change but no reason, email, correction checklist, or resubmit action despite copy implying feedback.

**Required fix:** Rejection reason codes/detail, notification, editable draft, resubmit, and review history.

## UX-009 - Insurance terminology is confusing

**Severity:** P2  
**Scenario:** “P-number/private/hire insured/verified” labels appear without consistent explanation and can be interpreted as DriveLink certifying claim coverage.

**Required fix:** One plain-language insurance component with tooltip/detail and legal disclaimer.

## UX-010 - Vehicle modal breaks browser navigation expectations

**Severity:** P2  
**Scenario:** Search user opens a vehicle modal, presses browser Back expecting to close it, but URL/history never changed and they leave the page.

**Required fix:** Route/intercepting modal with slug in history, focus restoration, and shareable canonical URL.

## UX-011 - Modal accessibility is incomplete

**Severity:** P2  
**Evidence:** major custom modals/sheets lack consistent `role="dialog"`, `aria-modal`, focus trap, Escape handling, and focus return.

**Scenario:** Keyboard/screen-reader user tabs into content behind Vehicle Detail/Guest Booking/inspection modal and loses context.

**Required fix:** Shared accessible Dialog/Sheet primitive and automated axe/keyboard tests.

## UX-012 - Custom Select and PhoneInput semantics are incomplete

**Severity:** P2  
**Scenario:** Screen reader cannot reliably announce active option/expanded state; hidden required input does not provide expected native validation/focus.

**Required fix:** Use proven accessible combobox/listbox primitives or complete ARIA keyboard/focus implementation.

## UX-013 - Reviews show a false empty state while loading

**Severity:** P3  
**Scenario:** Vehicle modal briefly says “No reviews” before request resolves, then reviews pop in.

**Required fix:** Dedicated skeleton/loading/error/empty states.

## UX-014 - Grammar defect: “1 reviews”

**Severity:** P3  
**Scenario:** A page with one review displays “1 reviews,” reducing polish on a trust signal.

**Required fix:** Shared pluralization helper.

## UX-015 - Licence upload limits disagree

**Severity:** P3  
**Scenario:** UI says 5 MB but upload helper allows 10 MB; behavior differs by file and error appears late.

**Required fix:** One storage constraint source and preflight file validation.

## UX-016 - Licence preview leaks browser memory

**Severity:** P3  
**Scenario:** Re-selecting files creates object URLs during render without revocation; long/mobile sessions accumulate memory.

**Required fix:** Create/revoke object URLs in effects or use controlled preview utility.

## UX-017 - No licence delete/revoke control

**Severity:** P2  
**Scenario:** User uploads the wrong licence or stops using DriveLink and cannot remove/replace access outside full account deletion.

**Required fix:** Replace/delete flow with booking-impact warning and audit.

## UX-018 - Home blueprint modules are missing

**Severity:** P2  
**Scenario:** Nearby, popular Rental Pages, recently viewed, recommendations, notifications, saved vehicles, and a complete You hub are absent/partial.

**Required fix:** Prioritize saved vehicles and page discovery; keep recommendations deferred if clearly removed from launch copy.

## UX-019 - No listing/page/account report controls

**Severity:** P1  
**Scenario:** Renter spots a duplicated/stolen vehicle photo or impersonating page and cannot report it from the object itself.

**Required fix:** Contextual Report action on vehicle/page/profile/message with categories and confirmation/status.

## UX-020 - Visual style is generally sound, but compact operational screens still need device QA

**Severity:** P3  

Sampled public desktop/mobile screens were polished and showed no major overlap. Authenticated dashboard/admin tables, bottom sheets, long Sri Lankan names/addresses, error states, keyboard viewport, and 320px widths have not yet received full screenshot regression coverage.

**Required fix:** Playwright screenshot matrix plus text-overflow and keyboard/focus checks on every primary journey.

---

# 10. Deletion, privacy, and legal contradictions

## PRIV-001 - Account can be deleted during an active dispute

**Severity:** P1  
**Evidence:** deletion blockers omit `disputed` from active statuses.

**Scenario:** Party opens a dispute, deletes account, and scrubs/removes evidence/contact identity while admin is investigating.

**Required fix:** Block deletion for disputes, claims, appeals, overdue rentals, and legal holds; explain retention basis.

## PRIV-002 - Page bookings may be skipped during deletion

**Severity:** P1  
**Evidence:** page checks run only when `profiles.role === agency_owner`.

**Scenario:** Role is stale/changed while user still owns pages; deletion ignores active page bookings and soft-deletes identity mid-rental.

**Required fix:** Always query ownership, independent of role.

## PRIV-003 - Soft deletion reports success after partial failure

**Severity:** P1  
**Evidence:** many storage, DB, page, and Auth operations are best-effort/unchecked.

**Scenario:** Profile is scrubbed but Auth session/email remains, or Auth is scrambled but pages/documents remain. API still returns `{ok:true}`.

**Required fix:** Deletion job with explicit step state, retries, reconciliation, and only final success after required operations complete.

## PRIV-004 - Driving licences are not deleted

**Severity:** P1  
**Evidence:** deletion reads/removes NIC, selfie, avatar but omits `license_front_url` and `license_back_url`.

**Scenario:** User receives confirmation saying identity documents were removed, while licence images remain in storage/profile.

**Required fix:** Include all document types and verify object deletion; respect legal holds separately.

## PRIV-005 - Phone, address, NIC number, and KYC status retention contradicts copy

**Severity:** P1  
**Scenario:** Email says name/contact/identity removed, but phone and NIC number are deliberately preserved and address handling is incomplete.

**Required fix:** Publish accurate retention table by field/purpose/duration; pseudonymize where possible and obtain PDPA/legal review.

## PRIV-006 - Privacy policy says 30 days; implementation uses seven

**Severity:** P1  
**Scenario:** User relies on a 30-day appeal/restoration window, but undelete token expires after seven days and data cleanup behavior differs.

**Required fix:** One policy constant and lawyer-approved wording across UI, email, API, and retention jobs.

## PRIV-007 - Licence retention policy is false

**Severity:** P1  
**Scenario:** Privacy page says licence photos are deleted after booking closure unless disputed, but app stores them on the profile indefinitely (or accidentally deletes them daily through the sweeper).

**Required fix:** Define account verification document versus booking-shared copy, implement retention/deletion schedule, and update policy.

## PRIV-008 - NIC access policy is false

**Severity:** P1  
**Scenario:** Privacy says NIC/selfie images are accessible only to admin during KYC, while consent flow intentionally gives Rental Pages access.

**Required fix:** Rewrite policy to match purpose-limited sharing and implement the promised controls first.

## PRIV-009 - “Not downloadable” is a false promise

**Severity:** P1  
**Scenario:** Browser always receives pixels and raw endpoint is saveable; right-click suppression does not prevent download/screenshots.

**Required fix:** Say “view-only interface with watermarked copies; screenshots cannot be technically prevented,” and eliminate raw-original access.

## PRIV-010 - Restore creates a broken account state

**Severity:** P2  
**Scenario:** Undelete restores profile/page placeholders but not a usable verified Auth email; vehicle listings stay unlisted and there is no guided recovery checklist.

**Required fix:** Transactional restore plan, verified contact recovery, page/listing review state, and user-facing recovery wizard.

## PRIV-011 - Existing sessions may survive deletion

**Severity:** P1  
**Scenario:** Another device retains a valid access token after deletion and may still call broad own-profile UPDATE policies or private endpoints until token expiry.

**Required fix:** Revoke all sessions/tokens before scrubbing and make deleted state a server-side guard on every authenticated request.

## PRIV-012 - Legal agreement needs Sri Lankan counsel before launch

**Severity:** P1  

The current code-generated terms include insurance, replacement value, loss of use, deposits, police reporting, fines, and mediation claims. These are not merely UI copy and may allocate liability beyond DriveLink's “venue, not party” posture.

**Required fix:** Freeze feature rollout until a Sri Lankan lawyer reviews platform T&Cs, privacy/PDPA notice, agreement template, evidence retention, banned securities, insurance wording, and dispute/blacklist procedure.

---

# 11. Operations, PWA, deployment, and quality gates

## OPS-001 - Cron frequency makes safety features late

**Severity:** P1  
**Evidence:** route comments assume ~15 minutes; `vercel.json` and `cron-worker/wrangler.jsonc` schedule `0 3 * * *` daily.

**Scenario:** Two-hour late alert arrives almost a day late; 24-hour critical freeze can occur close to 48 hours late; 12-hour payment expiry can remain for ~36 hours.

**Required fix:** Schedule at intended cadence, use queue/durable scheduler, and monitor last successful run and lag.

## OPS-002 - Main deployment can omit cron worker

**Severity:** P1  
**Evidence:** standard `cf:deploy` does not deploy the separate `cron-worker` project.

**Scenario:** App deploy succeeds, but no overdue/expiry/storage sweep runs in production.

**Required fix:** One release pipeline deploys both and performs a signed health check.

## OPS-003 - Cron jobs are race-prone and can notify falsely

**Severity:** P1  
**Scenario:** Concurrent runs select the same rows, both notify, or an optimistic UPDATE matches zero while processed count/notification still says success.

**Required fix:** Atomic claim/update with `FOR UPDATE SKIP LOCKED` or idempotency keys; notify from committed event rows.

## OPS-004 - PWA installation/offline fallback is broken

**Severity:** P2  
**Evidence:** service worker precaches `/offline`; sampled local route returned 404 while `public/offline.html` exists.

**Scenario:** `cache.addAll` fails during service-worker install, so app is not reliably installable/offline.

**Required fix:** Serve and test the exact precache URL with a 200, then run install/offline automated checks.

## OPS-005 - No migration history/drift system

**Severity:** P1  
**Scenario:** Script applies one supplied SQL file but does not record ordered migration history or verify production drift. Team cannot prove which security fixes are active.

**Required fix:** Supabase migration workflow with version table, CI fresh-database apply, production diff, backups, and rollback/forward-fix playbooks.

## OPS-006 - No automated tests

**Severity:** P1  
**Evidence:** no meaningful test script/suite was found.

**Scenario:** A migration changes one RLS predicate and silently exposes all bookings/documents; build remains green because TypeScript cannot test permissions.

**Required fix:** Start with RLS matrix tests, booking transition table tests, quote/date tests, and two-account Playwright happy/negative paths from Part 7 of the plan.

## OPS-007 - Lint configuration is broken/incompatible

**Severity:** P2  
**Evidence:** lint command enters/fails configuration; `next` 15.x and `eslint-config-next` 16.x are mismatched.

**Scenario:** CI cannot enforce lint and developers treat warnings as tool noise.

**Required fix:** Align Next/ESLint versions, add deterministic `npm run lint`, and run in CI.

## OPS-008 - Multiple lockfiles create build-root ambiguity

**Severity:** P2  
**Scenario:** Next picks a parent lockfile/workspace root, causing different dependency resolution or traced deployment files between machines.

**Required fix:** Keep one intended lockfile/root or configure output tracing root explicitly.

## OPS-009 - Dependency vulnerabilities remain

**Severity:** P2  
**Evidence:** audit reported three moderate vulnerabilities during review.

**Scenario:** Known vulnerable transitive code ships in the web/admin surface without a documented risk decision.

**Required fix:** Review `npm audit`, update safely, and add recurring dependency/security checks.

## OPS-010 - Android backups may retain sensitive WebView/session data

**Severity:** P1  
**Evidence:** Android app allows backup.

**Scenario:** Device/cloud backup captures app storage or session-related WebView data containing access to sensitive document surfaces.

**Required fix:** Disable backups or define encrypted data-extraction rules; clear sensitive caches on logout; mobile security review.

## OPS-011 - No release observability for critical workflows

**Severity:** P1  
**Scenario:** Didit webhook, email cascade, agreement snapshot, cron, storage deletion, or admin update fails; only console logs exist and no one is alerted.

**Required fix:** Structured error/event monitoring, queue dashboards, provider delivery metrics, SLOs, and P0 alerts.

## OPS-012 - Hardcoded USD conversion drifts

**Severity:** P3  
**Scenario:** Listing shows USD using a fixed LKR divisor while exchange rates change, creating misleading tourist pricing.

**Required fix:** Remove USD estimate or label rate/date and source it centrally.

---

# 12. Blueprint features still missing or materially incomplete

The following are not duplicates of minor copy differences; they are promised product capabilities without a complete, enforceable path:

| ID | Severity | Missing/incomplete capability | Example scenario |
|---|---|---|---|
| GAP-001 | P1 | Unlimited pages | Sixth branch cannot be created. |
| GAP-002 | P1 | Page-only multidimensional reviews | Review still rates the owner profile and renter publicly. |
| GAP-003 | P1 | Mandatory typed pickup and return inspections | Booking completes with no required evidence set. |
| GAP-004 | P1 | Immutable signed PDF in Booking Documents | Web checkbox exists, no permanent PDF/hash/email artifact. |
| GAP-005 | P1 | Structured damage claim and renter response | Generic incident/dispute lacks estimate acceptance and 72h window. |
| GAP-006 | P1 | Final charge/deposit ledger | Parties cannot record complete extra-km/fuel/late/damage/refund math. |
| GAP-007 | P1 | Server-watermarked, fully audited document access | Raw originals bypass overlay and logs. |
| GAP-008 | P1 | Didit/manual licence verification state | Presence of two URLs is treated as a licence; no approval/expiry. |
| GAP-009 | P1 | Tourist permit declaration and handover verification | Foreign self-drive can proceed with no permit record. |
| GAP-010 | P1 | Insurance filter/expiry and verified weighting | Users cannot find hire-insured inventory reliably. |
| GAP-011 | P1 | Late-return evidence pack | Critical owner action is missing. |
| GAP-012 | P1 | Owner cancellation marker/ranking demotion | Strike fields do not produce promised public/ranking consequences. |
| GAP-013 | P2 | General account/page/listing reporting | Only renter report after certain bookings exists. |
| GAP-014 | P2 | Saved vehicles | Vehicle page promise/action is absent or incomplete. |
| GAP-015 | P2 | Popular Rental Pages/public page discovery | No canonical public page marketplace. |
| GAP-016 | P2 | Nearby/recent/recommended Home modules | Blueprint Home is only partial. |
| GAP-017 | P2 | Extension request workflow | Chat can discuss it, but dates/price/terms cannot be amended safely. |
| GAP-018 | P2 | Breakdown protocol workflow | Generic report exists, but no timed protocol/checklist/service record. |
| GAP-019 | P2 | Booking Documents export | Records are spread across screens/tables, not a durable store/export. |
| GAP-020 | P2 | Business certificate and Verified Business | Page type exists without evidence-complete verification. |
| GAP-021 | P2 | Page team/staff access | Businesses must share one personal login. |
| GAP-022 | P2 | Notification center/preferences | Realtime/toasts and provider toggles do not form the promised user inbox. |
| GAP-023 | P2 | Renter in-app support | Operational conversation is pushed to WhatsApp. |
| GAP-024 | P2 | Wear-vs-damage rubric and linked claim rules | Legal/content promise is not integrated into inspection/claim UI. |
| GAP-025 | P2 | Banned securities enforcement | “No passports/blank cheques” is text, not a report/handover control. |

---

# 13. Contradictions that require product decisions

These cannot be solved by renaming a button; the plan and platform must choose one rule and enforce it everywhere.

1. **Book before KYC vs verified requests only:** the blueprint allows browsing and suggests verification before serious confirmation; code copy says request first; API requires KYC before request.
2. **Multiple pending requests vs exclusive hold:** migration/plan says pages choose among requests; current availability blocks at the first pending request.
3. **Direct payment vs platform lock-in fee:** launch copy says no payment to DriveLink, while fee/slip infrastructure can activate independently.
4. **Commission-free launch vs Rs 200 completion fee:** public promise and DB trigger conflict.
5. **Five free page bookings vs free launch for everyone:** recommendation is presented as pricing direction but current code implements neither cleanly.
6. **Confirmed vs active:** acceptance currently means “rental active” when fee is zero, collapsing reservation and handover.
7. **Strict daily billing vs hourly late ladder:** current rules can charge both.
8. **View-only documents vs downloads logged:** blueprint mentions views/downloads, UI says not downloadable, implementation exposes raw originals.
9. **Consent control vs evidence retention:** renter cannot revoke in pre-rental states and policy does not clearly distinguish future access from retained evidence.
10. **Private insurance display-only warning vs full-liability agreement:** agreement makes stronger legal conclusions than product plan.
11. **One personal identity vs role conversion:** implementation turns renter into agency owner and changes their shell.
12. **Free listing with basic evidence vs required seven photos/admin gate:** current wizard can submit zero photos, while trust messaging implies reviewed inventory.
13. **30-day deletion grace vs seven-day restoration:** policy, UI, and email differ.
14. **Licence retained for future bookings vs deleted after each closed booking:** privacy copy and profile model disagree.
15. **Admin mediation vs “we do not make money judgments”:** damage/deposit resolution needs a clearly limited scope and outcome model.

---

# 14. Recommended remediation order

## Gate 0 - Freeze risky expansion

Do not onboard real KYC documents, take platform fees, or market police-ready evidence until P0 authorization/storage findings are fixed. Preserve a database backup and inventory production RLS/grants/buckets before migrations.

## Gate 1 - Rebuild authorization and evidence boundaries

1. Replace broad table writes with narrowly scoped server functions/APIs.
2. Lock admin role and moderation fields outside user-controlled profile/page rows.
3. Publish explicit safe views for profiles, pages, vehicles, and availability.
4. Make bookings, inspections, agreements, messages, incidents, and audit events append-only/transactional where evidence matters.
5. Fix document delivery, service-worker caching, upload validation, legacy storage, and licence sweeping.
6. Add an RLS permission matrix test suite before applying production migration.

## Gate 2 - Repair the canonical booking journey

1. Define states: requested -> confirmed -> ready_for_pickup -> active -> returned/claim_window -> completed/disputed.
2. Decide KYC timing and request stacking.
3. Implement one quote/eligibility engine and request-time terms snapshot.
4. Make pickup/return inspections and agreement gates mandatory.
5. Implement final charge/deposit ledger and structured claims.
6. Fix cancellation actor attribution, overdue behavior, and cron cadence.

## Gate 3 - Finish Rental Pages and admin operations

1. Remove single-role navigation behavior and page cap contradiction.
2. Finish business evidence, page profiles, staff/lifecycle, page-only reviews, and all-page notifications.
3. Repair blacklist/report queue with notice/appeal.
4. Replace ignored admin errors with transactional APIs and reliable audit events.
5. Align monetization configuration, analytics, and invoice terminology.

## Gate 4 - Copy, legal, accessibility, and launch verification

1. Lawyer review of T&Cs, privacy, agreement, insurance, evidence retention, and blacklist/appeal.
2. Platform-wide terminology and promise audit after behavior is final.
3. Accessible shared dialogs/comboboxes plus keyboard/contrast tests.
4. Execute the blueprint's two-account end-to-end script, multi-page negative tests, and production smoke path.
5. Require build, lint, unit/integration, RLS, migration, accessibility, and screenshot checks in CI.

## Minimum acceptance tests before launch

- Renter cannot read/update another profile, protected own-profile fields, admin role, page verification, or listing moderation fields.
- Page B cannot read/update Page A bookings, evidence, messages, documents, blocks, or metrics.
- Neither booking party can mutate the other's submitted evidence or append messages after closure.
- Raw original KYC/licence object is never delivered to a page owner; every rendered derivative access is logged.
- Logout/offline/cache inspection reveals no sensitive documents.
- A confirmed future booking is not active before gated pickup.
- No completion is possible without required return evidence except explicit audited admin override.
- Quote, agreement, completion ledger, and displayed terms use the same immutable snapshot.
- Back-to-back availability behaves identically in search, detail, API, and DB.
- Free-launch configuration produces zero renter fee, zero page fee, no slip flow, and accurate copy/analytics.
- Blacklist report appears in admin queue, approval blocks normalized NIC, user is notified, and appeal path works.
- Account deletion is blocked by active/disputed/overdue/legal-hold records and removes every promised document after the declared retention period.

## Closing assessment

DriveLink has a useful product shape and a surprisingly broad set of screens, but the code currently treats UI/API conventions as security and evidence controls. They are not. The central launch claim is trust: verified people, reviewed vehicles, consented documents, signed terms, and defensible handover/return evidence. Until those records are private, immutable, correctly timed, and operationally recoverable, adding more polish or marketplace modules increases surface area without completing the product promise.

The best next milestone is therefore not “Phase C polish.” It is a **security and lifecycle stabilization release** that makes one booking between one renter and one Rental Page correct end to end, including negative permission tests. Once that path is trustworthy, the remaining blueprint features become normal product work instead of compounding risk.
