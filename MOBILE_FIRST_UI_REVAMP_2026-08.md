# DriveLink Mobile-First UI Structure Revamp

## Purpose

DriveLink should feel clear to a first-time renter on an ordinary phone,
while still being fast enough for a Rental Page owner dealing with a customer
at a roadside handover. Mobile is the main product. Desktop is the wider,
more spacious version of the same flows, not the design starting point.

This document is the working structure for the next UI rebuild. It is based
on the current route map, booking lifecycle, staff permissions, and the
problems already found in the platform audit.

## The People We Are Designing For

### 1. First-time local renter

Usually young, price-sensitive, may have rented only through Facebook or
WhatsApp, and may be nervous about deposits, scams, and what happens if the
car is damaged. They need plain language, a visible next step, and proof that
the listing and handover are real.

### 2. Visitor or diaspora renter

Often uses a phone while planning a trip. May not understand Sri Lankan
licence rules, the difference between private and hire insurance, local
deposit customs, or whether self-drive is realistic. They need an early,
calm choice between self-drive and with-driver before being asked for details.

### 3. Private host

May run one car alongside another job. They need a short checklist rather
than an "admin system": create a page, list a car, answer a request, record
pickup, record return. They may have weak digital confidence and often use
WhatsApp as their main work tool.

### 4. Small rental-business owner or manager

Needs a mobile task list during the day and a desktop overview when planning.
They care about waiting requests, cars due out or back, missed messages,
availability, and exceptions. They should not have to interpret charts before
seeing a customer who needs an answer.

### 5. Invited Rental Page staff member

May have permission for only bookings, handovers, fleet, or support. Their
screen must say what they can do and hide work they cannot do. A staff member
should never have to discover a missing permission by pressing a button after
entering private customer information.

### 6. DriveLink reviewer or admin

Works across sensitive evidence, reports, disputes, listings, and support.
Their experience needs a clear priority order, durable case notes, and
unmistakable separation between a quick status check and a decision that
affects a user.

### 7. Enterprise partner (future integration mode)

An established operator does not need a second full operating system. Its
DriveLink surface should be a distribution inbox: availability, booking
handoff, accept, decline, alternative offer, and fulfilment confirmation.
Do not place this complexity in the private-host UI.

## Product Language Rules

1. Use one familiar word per idea. Say "Rental Page" only when it means the
   provider's public business space. On a vehicle page, say "host" or
   "rental business" because that is what a renter understands.
2. Every money statement must answer three things in one place: who is paid,
   what it is for, and whether DriveLink holds it. Current launch wording is:
   "Booking confirmation fee: Rs. 0. Pay your rental amount and deposit
   directly to the host or rental business. DriveLink does not hold deposits."
3. Do not call a booking a "payment" or a "confirmed rental" until the
   correct workflow point. Use the current status plus one plain explanation.
4. Avoid legal or insurance certainty that DriveLink cannot provide. Use
   "check", "declare", "record", and "the host checks the original" rather
   than "approved", "covered", or "guaranteed" unless that is genuinely true.
5. Keep all permanent product labels in English for now, but make the
   explanation under a complex action available in English, Sinhala, and
   Tamil. Full interface translation should happen only after a deliberate
   content and support review, not through a half-translated mix of screens.

## The Mobile Navigation Model

### Marketplace and personal account

Use a persistent, thumb-reachable bottom bar on **all** mobile browsers and
the Android wrapper. The old app-only bar left ordinary mobile web users with
the menu button for routine work; that is now corrected.

| Person | Main tabs | More sheet |
| --- | --- | --- |
| Visitor | Browse, Guides, Log in | Home, Pricing |
| Renter | Browse, Bookings, You | Home, Pricing, Guides |
| Page owner or staff | Browse, Page, You | Home, Pricing, Guides |

The header keeps the brand and low-frequency navigation. It is not the only
way to reach a booking, account, or page on a phone. The footer has extra
bottom space so the fixed bar does not cover its final links.

### Rental Page workspace

Use a different bottom bar inside the work area: Home, Bookings, Fleet, More.
The Page switcher remains at the top, because it changes the whole work
context. "More" contains Analytics, Support, Account, and Settings only when
the current staff role is allowed to use them.

### Admin workspace

Use Home, Cases, Listings, More. Home is a triage queue, not a vanity
dashboard. Counts are useful only when they lead directly to the next action.

## Screen-by-Screen Structure

### Browse and search (`/`, `/vehicles`, `/rent/...`, `/sri-lanka/...`)

**New structure:**

1. Start with the travel choice: Self-drive, With driver, Airport pickup.
2. Show location and dates immediately below it.
3. Keep filters in a bottom sheet with a visible active-filter count.
4. Put the three decision facts on every result card: daily price, provider
   type, and service/insurance signal. Do not make people open cards just to
   learn whether it has a driver or hire insurance.
5. Explain why a listing is unavailable or cannot be requested in the same
   place as its action button.

**Problems this removes:** oversized desktop filter controls on a phone,
unclear comparison between private hosts and businesses, and discovery of a
self-drive restriction only after a renter has already chosen a car.

### Vehicle detail (`/vehicles/[slug]`)

**New structure:**

1. Compact photo gallery and title.
2. A single "Before you request" block: total starting price, direct payment
   model, deposit amount, rental mode, and required licence/age rule.
3. A sticky mobile action bar: "Choose dates" before a request can be sent.
4. Expandable groups: What's included, important fees, rules, handover,
   provider, and reviews. The sections must state a summary even when closed.
5. A short self-drive warning only on self-drive listings, with a link to the
   related video and guide. With-driver listings must not show this warning.

**Copy correction:** "Send booking inquiry" sounds informal and may suggest
the person is not entering the booking flow. Use "Request this vehicle" and
show the exact next state underneath: "The host will review your dates."

### Request, account verification, and booking (`/bookings/...`, `/account`)

**New structure:**

1. Present request fields as a short stepper with a progress label, not a
   dense form. Dates and trip type first; identity requirements second; notes
   last.
2. When sign-in or verification is needed, preserve the chosen vehicle and
   dates, then return the renter to the exact unfinished step.
3. Make the booking screen a single timeline, not a collection of cards:
   Requested -> accepted -> documents shared -> agreement -> pickup -> return
   -> completed.
4. Each timeline state gets one dominant action, one deadline if relevant,
   and a plain "What happens next" line.
5. The account page is "You": identity, licence, bookings, Rental Pages,
   document history, and support. It should no longer look like a profile
   page with operational work bolted beneath it.

### Agreement, document sharing, pickup, return, and claims

**New structure:**

1. Place the agreement, consent record, inspection photos, and money record
   in the same booking timeline. People should not need to decide which
   separate screen owns a dispute.
2. Pickup and return use a one-handed checklist: vehicle plate, odometer,
   fuel, four sides, interior, existing damage, confirmation. Show photo
   quality and the number of required photos before Continue is enabled.
3. The return screen compares matching pickup and return views side by side
   on desktop and as a swipeable pair on mobile.
4. A damage claim starts from the return record. It must name the evidence,
   claimed amount, response deadline, and the fact that DriveLink records the
   issue rather than holding the money.
5. A "need help now" link appears during pickup, return, accident, and
   overdue states, opening the correct protocol or support thread.

### Create Rental Page and list vehicle (`/account/pages/new`, `/dashboard/vehicles/new`)

**New structure:**

1. "Create your Rental Page" is a short 3-step flow: public name and city,
   provider type and contact, then review.
2. The vehicle wizard becomes five named screens: Basics, Photos, How people
   can rent it, Rules and price, Review. Only show fields relevant to the
   selected rental mode.
3. Each field has an example, a reason when it is required, and a safe
   default for common rules. Do not make a first-time host invent a late-fee
   policy from an empty text box.
4. Basic versus Verified Vehicle status is shown as a simple readiness list:
   "Can be reviewed now" and "Add later for the verified badge."
5. After submission, land on a listing status screen with the review state
   and a single next task, not an empty dashboard.

### Rental Page home, bookings, fleet, and staff access (`/dashboard/...`)

**New structure:**

1. Replace the generic overview with "Today": requests waiting, handovers
   today, cars due back, messages, and urgent cases. Each item opens the
   exact work screen.
2. Keep secondary metrics below the task list. A solo owner should never see
   an empty analytics card ahead of a booking that needs a reply.
3. Bookings use status chips as filters and a vertical timeline within each
   booking. Avoid wide tables on phones.
4. Fleet uses vehicle cards, availability indicators, and clear statuses.
   A status must describe the result (Live, In review, Maintenance) instead
   of an internal word such as "unlisted" without explanation.
5. For staff, use the role name and a short capability sentence at the top:
   for example, "Handover agent: you can record inspections and message
   renters." Hide forbidden controls instead of showing disabled buttons.
6. Surface the right video on the page: owners see the end-to-end rental
   guide; staff see the role and privacy guide.

### Admin (`/admin/...`)

**New structure:**

1. Home is an action queue ordered by urgency and due date: safety/overdue,
   disputes, identity/listing decisions, support.
2. Cases, reports, support, and affected booking information need one shared
   case drawer or timeline so admins do not copy context between screens.
3. Decision pages require a reason, evidence links, and a user-facing
   explanation preview before confirmation.
4. Admin-only terms such as blacklist, evidence, and appeal need a short
   plain-language note so a new team member understands the consequence.
5. Desktop can add a second inspection pane; mobile keeps one task at a time.

### Enterprise distribution (future)

Do not add this to the current host dashboard. When introduced, use a separate
Partner area with category inventory, availability feed health, booking
handoff, accept/decline/alternative offer, and a fulfilment log. No double
entry of fleet maintenance, driver schedules, or accounting records.

## Visual and Interaction Rules

1. Design first at 360px wide, then test 390px and 430px. Desktop is checked
   after phone flow and copy are settled.
2. Keep primary actions at least 44px high and in the lower half of a form
   when a person is expected to tap them repeatedly.
3. One main action per screen. A destructive or high-risk action needs a
   clear consequence and a confirmation step.
4. Never require hover, a colour alone, or a tiny icon to understand status.
5. Use cards for actual repeated records, not to wrap every page section.
6. Use the existing blue, slate, green, amber, and red signals consistently:
   blue for action, green for complete, amber for attention, red for a real
   risk or blocked state. Do not invent a new colour meaning on each screen.
7. Use Poppins with a restrained type scale. Booking references and plate
   numbers use tabular figures but stay readable rather than looking like
   developer IDs.
8. Support Sinhala and Tamil in videos, help text, and critical explanations
   before promising a full translated interface. Check text length on narrow
   screens before release.
9. Forms save progress locally where safe and explain failures in ordinary
   language with a retry action.

## Video and Help Placement

| Moment | Guide shown | Placement |
| --- | --- | --- |
| Home and account | Rent your first vehicle | After the main explanation / account welcome |
| Self-drive listing | Self-drive in Sri Lanka | Beside the request area |
| New Rental Page | Create a Rental Page and list a vehicle | Footer, Academy, and page creation flow |
| Rental Page home | Run a rental from request to return | Under the Page header for an owner |
| Rental Page home for a staff member | Work safely as Rental Page staff | Under the Page header for staff |
| Admin home | Review and resolve as a DriveLink admin | Under the action summary |

Videos have English narration and English, Sinhala, and Tamil subtitles. The
Academy page is the durable library; contextual links are the practical
shortcut at the moment of need.

## Delivery Order

### Phase 0: navigation and guidance

- Make the marketplace bottom bar available in all mobile browsers.
- Add mobile-safe footer spacing.
- Add DriveLink Academy and contextual guide links.
- Produce and upload the six video packages.

### Phase 1: renter confidence flow

- Rebuild search, vehicle detail, request, and booking timeline around the
  renter's next decision.
- Test with a first-time renter, a visitor, and a low-confidence phone user.

### Phase 2: handover and claims flow

- Rebuild pickup/return checklist and the comparison/claim journey.
- Test in poor mobile connection conditions and with one hand.

### Phase 3: host and staff workspace

- Replace dashboard-first layout with Today-first task list.
- Rebuild listing flow and role-aware staff views.

### Phase 4: admin decision workspace

- Consolidate triage, evidence, decision reasons, and user communication.

### Phase 5: enterprise distribution design

- Design separately with a real partner. Do not assume Casons or another
  enterprise operator's software or fleet workflow.

## Definition of Done for Every Rebuilt Flow

1. A new user can say what the screen is for within five seconds.
2. The next step is visible without scrolling through unrelated information.
3. At 360px width, no button, label, or status is cut off or depends on hover.
4. A user receives an understandable explanation if something is unavailable,
   missing, declined, or requires verification.
5. The same workflow has been checked for renter, owner, relevant staff role,
   and admin privacy boundaries.
6. The short help video and relevant written guide are reachable from the
   exact step where confusion is likely.
