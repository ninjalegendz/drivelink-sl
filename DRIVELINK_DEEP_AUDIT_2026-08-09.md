# DriveLink Deep Platform Audit

**Audit date:** 9 August 2026  
**Platform checked:** `drivelink.lk` and the DriveLink source code in this workspace  
**Audience for this report:** Founder and non-technical decision-makers  
**Status:** Final audit report

---

## 1. Plain-English verdict

DriveLink is not an empty idea or a mock-up. A meaningful amount has been built: accounts, identity checks, Rental Pages, vehicle listings, availability, booking requests, agreements, inspections, messages, document sharing, reports, admin screens, notifications, and a mobile wrapper all exist in some form.

However, the platform is **not ready for a wide public launch yet**.

The main problem is not simply that some planned features are missing. The bigger problem is that several important journeys look complete on the screen but do not hold together safely from beginning to end. In some places the screen promises more than the system actually checks. In other places one side can finish a booking before the other side has agreed with the return, deposit, or charges. Some identity documents can also be stored or viewed in ways that are weaker than the privacy wording suggests.

There are four immediate conclusions:

1. **Public discovery is currently broken in important places.** The home page says there are no vehicles while the search page shows 17. Direct vehicle links return a "not found" page. Several Google-focused rental pages also show zero cars even when matching cars exist.
2. **The trust story is stronger than the trust controls.** DriveLink uses words such as "verified," "fully covered," "every view logged," and "tourist-ready" more confidently than the actual checks support.
3. **The rental journey can reach unsafe endings.** A provider can start or complete a rental without all the renter confirmations the screens appear to require. Charges, deposits, disputes, and the 72-hour claim rule do not yet form one consistent process.
4. **The product still contains three different business models.** The founder's final decision is a small fixed renter confirmation fee later, but the code, dashboards, Terms, and database still contain owner success fees, Rs. 200 charges, invoices, bank slips, payouts, and other old ideas.

This report records **160 findings: 64 Stop-before-launch, 81 High, and 15 Medium**. That does not mean 160 separate software projects are needed. Many have the same root cause. For example, one proper booking state machine fixes several inspection, completion, dispute, and notification findings together. The repair plan groups them into practical work packages.

### Launch recommendation

Do not spend heavily on public advertising and do not onboard a large enterprise fleet until the "Stop before launch" items in this report are corrected and retested with two real accounts.

A small, supervised pilot can still be useful after the most serious privacy, booking-state, listing-link, agreement, inspection, and payment-copy problems are fixed. During that pilot, DriveLink staff should watch every booking closely.

---

## 2. What was checked

This was a broad product audit, not just a code check.

The review covered:

- The live public website on desktop and mobile-sized screens.
- Home, search, vehicle, Rental Page, pricing, sign-up, login, FAQ, legal, safety, and guide pages.
- The renter journey from searching through booking, verification, agreement, pickup, return, charges, dispute, and review.
- The provider journey from creating a page through listing, approval, booking management, inspections, team access, reporting, and account deletion.
- Admin review, booking intervention, reporting, fees, and support tools.
- Database rules that decide who can see or change information.
- Identity documents, licence images, consent, watermarks, access history, and evidence packs.
- SMS, email, WhatsApp, and in-app message behaviour.
- Background jobs for reminders, late returns, expiry, and automatic completion.
- Build health, automated tests, software packages, mobile app settings, and security headers.
- The original Rental Pages blueprint, the updated Casons/enterprise idea, and the final payment decision.
- The different people DriveLink is trying to serve, including people with low digital confidence or limited English.
- A comparison of the first customer journey shown by ROFI and RentnRide.

The production build and TypeScript check completed successfully. The normal lint command does not currently run as a proper automatic check. The existing end-to-end test script was not run because it is configured in a way that can write to the connected Supabase database and appears out of date. That is itself recorded as a testing risk below.

This is not a legal opinion or a formal criminal-style penetration test. Insurance, privacy, contract, foreign-licence, police-reporting, and consumer-payment wording still need review by a Sri Lankan lawyer and the relevant providers.

---

## 3. The one product truth DriveLink should use everywhere

The following should become the single, approved explanation of how money works:

> **Listings are always free. DriveLink's booking confirmation fee is Rs. 0 during launch. When it is introduced later, it will be a small, clearly shown fixed fee paid by the renter to confirm the booking. The rental charge and refundable deposit are paid directly to the Rental Page, not held by DriveLink. Optional listing boosts may be added later and will always be clearly labelled.**

This means:

- No listing fee, now or later.
- No provider commission or provider success fee under the current decision.
- No DriveLink invoice based on completed bookings.
- No "Rs. 200 per completed booking" debt for a provider.
- No platform handling of rental money or deposits at launch.
- No confirmation payment screen while the confirmation fee is Rs. 0.
- Later, when a gateway and registered business are ready, the renter pays only a separate fixed confirmation fee to DriveLink.
- A future boost buys extra visibility only. It must be marked "Sponsored" and must never make an unsafe or poorly verified vehicle look more trustworthy.

### Correct future booking flow

**During the free launch:**

1. Renter sends a booking request.
2. Provider accepts.
3. The booking becomes confirmed immediately.
4. Rental and deposit arrangements stay between renter and provider.

**After the fixed fee is introduced:**

1. Renter sends a booking request.
2. Provider accepts.
3. DriveLink shows the exact fixed confirmation fee and its refund rule.
4. Renter pays that fee through the approved gateway.
5. The booking becomes confirmed only after successful payment.
6. Rental and deposit still go directly to the provider.

The fee must be saved inside that booking so a later price change cannot alter an older booking.

---

## 4. Who the product is really serving

The same screen will not work equally well for every audience. These are the main groups DriveLink needs to design for.

| Audience | Likely digital confidence | What they need most | Present mismatch |
|---|---:|---|---|
| First-time local renter, roughly 18-22 | Medium with apps, low rental knowledge | Simple explanations, total expected cost, age and licence rules before effort | The site assumes they understand deposits, hire insurance, excess, IDP, mileage caps, and agreement language. Eligibility is not properly checked before booking. |
| Repeat local renter | Medium to high, often WhatsApp-first | Fast search, trusted availability, clear total, quick provider reply | Search and direct links are unreliable; WhatsApp can bypass the structured booking record. |
| Foreign tourist | High digital confidence, low Sri Lankan rule knowledge | Permit guidance, currency clarity, airport/delivery details, insurance truth, emergency help | Permit handling is one self-declared tick box. Fixed USD conversion is unexplained. "Tourist-ready" overpromises. |
| Sri Lankan living abroad booking for family | High | Separate payer, driver, and traveller details | DriveLink assumes the account holder is the renter, driver, document owner, and payer. |
| Family/group booking with chauffeur | Mixed | Passenger count, luggage, itinerary, waiting time, driver costs, tolls, night charges | The form largely prices a chauffeured trip like a plain daily self-drive rental. |
| Private owner with one vehicle | Low to medium, often phone-first | Very guided setup, safety, simple handover, clear legal limits | The dashboard is large and English-only. It asks the owner to understand many states and records. |
| Small rental company | Mixed; owner may be digital, staff may not be | Branch/staff roles, fleet work queues, quick WhatsApp/SMS operations | All staff get broad access. There are no branch, finance, dispatcher, inspector, or listing roles. |
| Large enterprise fleet | High at management level; operational staff use existing systems | Integration, category inventory, alternatives, branches, driver assignment | DriveLink still expects exact vehicles and its own dashboard. The Casons-style integration layer is not built. |
| Chauffeur, mechanic, recovery operator | Mixed | A clear assigned job, location, contact, status, evidence, payment responsibility | These people are mentioned in the strategy but do not have a proper platform role or workflow. |
| DriveLink admin/support team | Medium to high | One truthful queue, deadlines, evidence, actions, audit trail | Important work is split across thin pages. Several actions are manual, silent, or capable of creating inconsistent results. |
| Person with low vision, motor difficulty, or keyboard-only use | Mixed | Readable text, strong contrast, focus, proper dialogs, screen-reader labels | Small text, weak focus treatment, and incomplete modal behaviour create avoidable barriers. |
| Police, insurer, lawyer, or dispute reviewer | Professional but unfamiliar with DriveLink | Complete, chronological, tamper-resistant evidence | The current evidence pack leaves out several important records and is not a permanently stored final package. |

### Language reality

DriveLink is currently English-only. There is no Sinhala/Tamil language system in the code. This is not a small translation task: legal consent, insurance warnings, pickup checks, damage disagreement, and late-return instructions must be understood, not merely displayed.

For launch, the minimum sensible approach is:

- Plain English everywhere, with technical words immediately explained.
- Sinhala and Tamil for the safety-critical steps first: account help, booking summary, payment truth, document consent, agreement summary, pickup/return checks, damage dispute, and emergency instructions.
- Keep the legal English version available, but show a short plain-language summary before acceptance.
- Do not use unexplained terms such as "P Number," "excess," "recognition permit," "settlement," "ledger," or "RLS" in customer-facing text.

---

## 5. What the main journeys feel like today

### Journey A: A young first-time renter

An 18-year-old finds a car, does not understand why the deposit is separate, and assumes "verified" means DriveLink has checked everything. They upload ID and licence photos, then request a vehicle whose listing says the driver must be 23 with two years of licence experience. The server does not actually calculate or block either requirement because date of birth and licence-start date are not stored. The owner may accept the booking, leaving both people to discover the problem later.

**Needed:** Ask eligibility questions before sensitive uploads, explain each cost in simple words, and enforce the same age/licence rules shown on the listing.

### Journey B: A tourist arriving at the airport

The tourist sees "tourist-ready," an approximate USD price, and airport pickup. They may understand this as legal readiness, a transfer service, and a current exchange rate. The permit flow only asks them to declare that they have a permit; it does not record whether this is an IDP, AA endorsement, DMT permit, or none. Airport pickup also does not collect flight number, terminal, passengers, luggage, or arrival delay details.

**Needed:** Separate legal guidance, delivery, and transfer services. Show the exchange-rate basis. Collect the correct permit type and airport trip information.

### Journey C: A private owner listing one car

The owner can create a page and a basic listing, but some copy says documents are required while other copy says they are optional. The owner is told uploaded documents can earn a "Verified Vehicle" status, but the expected verified flag does not appear to be awarded by any live workflow. After approval, the owner can change the plate, photos, insurance type, price, and terms and those changes go live immediately without another review.

**Needed:** One staged-verification explanation, a real path to each badge, and re-review when trust-sensitive information changes.

### Journey D: A small company with several staff

The owner adds an employee by email. Access is granted immediately, with no invitation acceptance, no expiry, and no proof that the email owner agreed. A staff member can see broad customer and operational data. There are no limited roles for someone who should only inspect cars or answer bookings.

**Needed:** Invitations, acceptance, expiry, audit history, and role-based access.

### Journey E: A large company such as Casons

The company would need to maintain exact vehicles and calendars in DriveLink, then use a dashboard that does not understand branches, category stock, drivers, corporate accounts, or alternative offers. Lists also stop after fixed limits, so a fleet can silently disappear from a view.

**Needed:** Do not promise enterprise readiness. First run discovery and a controlled handoff pilot. Then build generic feeds, webhooks, category inventory, branches, and role controls based on real requirements.

### Journey F: Pickup and return

The provider records pickup details. The interface suggests the renter confirms them, but the rental can be started without that confirmation. At return, the provider can record the vehicle and complete the booking before the renter has accepted or disputed the return condition. Once marked completed, the renter may see the button but the system can reject their response because the booking is no longer "active."

**Needed:** A strict two-sided sequence with a clear timeout and admin exception. Completion must wait for the required return, deposit, charge, and dispute checks.

### Journey G: A damage disagreement

The provider can add broad charges, including an open "other" charge, without required proof and without the promised claim deadlines. The renter can accept everything or open a general dispute, but cannot reject one specific item. The evidence pack does not include all charges, messages, consent history, incident records, deposit confirmations, or the final resolution.

**Needed:** Item-by-item response, evidence requirements, deadlines by charge type, a dedicated admin case, and a complete final evidence file.

### Journey H: A renter sharing identity documents

The renter sees a consent control and expects access to be tied to one booking, watermarked, and logged every time. In reality, the server can allow a page to view the renter's KYC documents because of another active consented booking between the same renter and page. Direct image requests are not necessarily logged. Some file types are served without a burned-in watermark, and the service worker can cache identity-image URLs on the device.

**Needed:** Booking-specific access links, a log on every file response, strict supported formats, no raw fallback, no sensitive caching, and a clear staff-viewer identity.

### Journey I: A user trying to become a provider

A logged-in user opens Pricing and presses "Create Rental Page." The link sends them to sign-up again even though they already have an account. Elsewhere the footer uses the correct page-creation link. The `intent=provider` address does not produce a true provider setup route after sign-up.

**Needed:** Every provider call-to-action must detect login state and lead to the same page-creation journey.

### Journey J: A support-heavy incident

Messaging stops being useful just when post-return questions are most likely. Contact panels disappear in some completed/disputed states. Chat has no attachments, caps history, and allows contact details before acceptance, weakening the contact-unlock idea. Background reminders can also send a provider to the renter's version of a booking page.

**Needed:** Keep a controlled post-rental case channel open until deposit, charges, and disputes close; add safe attachments and correct role-aware links.

### What ROFI and RentnRide reveal

The purpose of looking at [ROFI](https://www.rofi.lk/) and [RentnRide](https://www.rentnride.lk/) is not to copy their wording or assume every claim they make is true. It is to notice what a normal customer expects to understand immediately.

| First-journey question | ROFI | RentnRide | DriveLink lesson |
|---|---|---|---|
| What service do I need? | Puts rental/service choice early | Exposes vehicle type and rental mode early | Ask self-drive, chauffeur, transfer, delivery, and long-term needs before showing irrelevant fields. |
| Where and when? | Location plus dates/times are central; also mentions flexible dates/nearby | Location and date controls are prominent | DriveLink should make location, time, turnaround, delivery, and availability one reliable search journey. |
| What can I actually rent? | Moves users toward matching supply | Shows inventory directly and has working vehicle-focused journeys | DriveLink's direct vehicle pages must work before more SEO/ads. |
| Tourist help | Surfaces permit support more visibly | Makes the basic booking path easy to recognise | DriveLink can win by giving accurate permit/insurance guidance, not by using broad "tourist-ready" wording. |
| Currency and price | Currency is visible | Price/inventory are front-and-centre | DriveLink should show a trustworthy total and explain any LKR/USD estimate. |
| What happens next? | Support and app confidence are visible | Describes booking, payment, and pickup as a simple sequence | DriveLink needs a short truthful progress explanation: request, provider acceptance, confirmation fee (currently Rs. 0), agreement, pickup. |

DriveLink's opportunity is deeper trust and evidence, but that value currently appears after a visitor has already fought through broken links, unclear totals, and strong claims. The basic shopping journey must first become at least as obvious as the competitors' journeys. Then DriveLink can differentiate with consent, agreements, inspections, page accountability, and evidence.

---

## 6. Detailed findings

### Seriousness labels

- **STOP:** Fix before taking normal public bookings. It can expose sensitive data, create a false contract or charge, break a core journey, or seriously mislead a user.
- **HIGH:** Fix before a wide launch. It can cause lost bookings, disputes, fraud, or major support load.
- **MEDIUM:** Important usability, trust, operating, or growth problem.
- **LOW:** Polish or a future-readiness issue, but still worth recording.

### A. Public website, search, and trust

#### DL-001 - Home page and search page disagree about whether cars exist

**Level:** STOP  
**Who:** Every new visitor  
**Problem:** The live home page can say no vehicles are available while `/vehicles` shows 17. The home page uses a different data path and hides the data error as an empty result.  
**Example:** A visitor lands from an advertisement, sees no stock, and leaves without opening search.  
**Required correction:** Repair the public data permission, show a real error to monitoring instead of pretending the list is empty, and test home/search counts together on every release.

#### DL-002 - Direct vehicle links return a styled 404

**Level:** STOP  
**Who:** Renters, providers sharing links, Google, social media  
**Problem:** Tested vehicle cards open in a same-page pop-up, but the actual direct vehicle addresses return "not found." The site map still sends those broken addresses to search engines.  
**Example:** An owner shares their Toyota link through WhatsApp. The customer sees a 404 and assumes the listing was removed or the platform is fake.  
**Required correction:** Fix the database fields available to public vehicle pages, stop hiding query errors as 404, and automatically test every published vehicle URL.

#### DL-003 - Google-focused rental pages show zero matching cars

**Level:** HIGH  
**Who:** People arriving from Google  
**Problem:** Pages such as self-drive Sri Lanka and Toyota Colombo can show no inventory even while matching live listings exist. They use the same broken broad vehicle query.  
**Example:** Google sends a tourist to "self-drive car rental Sri Lanka," where DriveLink tells them there are zero verified options.  
**Required correction:** Use one tested public search service for home, SEO pages, vehicle details, and search. Do not maintain separate fragile queries.

#### DL-004 - The sitemap advertises broken and empty pages

**Level:** HIGH  
**Who:** Google and future organic visitors  
**Problem:** The sitemap contains direct vehicle links that currently fail and curated pages that appear empty. Public Rental Pages are omitted. It also has a fixed ceiling that will not cover a large catalogue.  
**Example:** Google repeatedly crawls 404 vehicle pages while a useful provider page is never submitted.  
**Required correction:** Only include accessible published pages, include provider pages, paginate large sitemaps, and run an automated link check before deployment.

#### DL-005 - Search errors are presented as "no cars"

**Level:** HIGH  
**Who:** Renters and support staff  
**Problem:** Several search paths catch a technical failure and return an empty list. Users cannot tell the difference between "nothing matches" and "DriveLink is broken."  
**Example:** A temporary database permission problem makes Colombo look sold out. No alarm explains the lost demand.  
**Required correction:** Show a retry message to the user, record the failure for staff, and keep true zero-result wording only for successful searches.

#### DL-006 - Ranking is not truly global

**Level:** MEDIUM  
**Who:** Renters and providers  
**Problem:** Search first takes one database page and then ranks only those results. A better vehicle on a later page can never outrank a weaker vehicle on page one. The home page similarly takes a small group of recent listings before ranking.  
**Example:** An older, well-reviewed, hire-insured car stays invisible behind newer weak listings.  
**Required correction:** Rank before pagination in one server-side search, with transparent priorities.

#### DL-007 - "Hire insurance only" can be lost on Load more

**Level:** HIGH  
**Who:** Safety-conscious renters  
**Problem:** The first search request can apply the insurance choice, but the load-more request does not carry every filter. Later results can include private-insurance vehicles.  
**Example:** A tourist deliberately selects hire-insured cars, scrolls further, and books a private-insurance car without noticing.  
**Required correction:** Keep all filters in one shareable search state and test each filter across pagination.

#### DL-008 - Search dates accept confusing or invalid combinations

**Level:** HIGH  
**Who:** Renters and providers  
**Problem:** A same-day start/end can appear searchable even though booking later rejects it. String-shaped but impossible dates may also fall into a generic empty result. "Today" can be wrong around Sri Lankan midnight because UTC is used.  
**Example:** A user searches 10 August to 10 August, chooses a car, then is blocked only at the final form.  
**Required correction:** Use Sri Lanka time for local rules, validate real calendar dates once, and use the same date rules in search and booking.

#### DL-009 - Availability may disagree at date boundaries

**Level:** HIGH  
**Who:** Renters and fleet staff  
**Problem:** Calendar blocking and timed booking rules do not consistently explain whether the return date/time is inclusive. This can create false conflicts or risky back-to-back rentals.  
**Example:** One car returns at 10:00 and a second renter expects pickup at 10:00, leaving no cleaning or inspection time.  
**Required correction:** Define pickup/return timestamps precisely, add configurable turnaround time, and test boundary cases.

#### DL-010 - The modal and real vehicle page are two different experiences

**Level:** HIGH  
**Who:** Renters, keyboard users, link sharers  
**Problem:** Clicking a card opens a modal without changing the browser address. Opening the same vehicle in a new tab uses a separate page, which currently fails and contains different details.  
**Example:** A renter reads insurance information in the modal, refreshes, and returns to the search page rather than the car.  
**Required correction:** Give every vehicle one canonical page/address and let the modal use the same data and content.

#### DL-011 - "Verified" is used as a broad marketing promise

**Level:** STOP  
**Who:** All renters  
**Problem:** Phrases such as "Sri Lanka's Verified Rental Network," "Verified cars," "Every listing is document-checked," and "tourist-ready" imply a stronger and more consistent check than exists. Basic listings can have optional documents and private insurance.  
**Example:** A renter assumes DriveLink confirmed ownership, insurance cover, and legal rental use when only some listing information was reviewed.  
**Required correction:** Define every badge in public language, show exactly what was checked and when, and remove blanket claims.

#### DL-012 - Demo-looking content is not labelled as demo

**Level:** HIGH  
**Who:** Prospective renters and partners  
**Problem:** The live catalogue includes unusual or questionable-looking stock and highly polished reviews with repeated patterns. A "Koenigsegg Agers RS" listing also appears to misspell Agera. If these are examples or seeded data, the site does not say so.  
**Example:** A serious partner sees a rare supercar offered self-drive with private insurance and questions the whole verification system.  
**Required correction:** Remove test data from production or label a closed demonstration environment. Verify every public listing and review is genuine.

#### DL-013 - Review wording and grammar weaken credibility

**Level:** MEDIUM  
**Who:** All public visitors  
**Problem:** The live interface can show "1 reviews" and calls reviews "verified" without clearly explaining the qualification. Public rating signals also come from more than one old/new review model.  
**Example:** A single unproven review is presented with a trust-heavy label.  
**Required correction:** Use correct singular/plural wording and define "completed DriveLink booking" rather than vague "verified review."

#### DL-014 - Person-level ratings still influence public ranking

**Level:** STOP  
**Who:** Renters and people previously reviewed as renters  
**Problem:** The blueprint says public reviews belong to Rental Pages only. Search ranking still reads an owner/person rating field, and old owner-to-renter review records and profile rating totals remain broadly readable.  
**Example:** A private person's old renter reliability feedback silently affects how their public listing ranks.  
**Required correction:** Separate private renter-risk notes from public page reviews in both data access and ranking. Close public access to private-side reviews.

#### DL-015 - Public Rental Pages lack important safety and service facts

**Level:** HIGH  
**Who:** Renters comparing a private host with a company  
**Problem:** Pages do not clearly expose verified service capabilities such as roadside hours, carrier recovery, replacement vehicle, airport operations, branch, or chauffeur availability. There is no obvious report-page action.  
**Example:** A renter assumes a one-car host has the same breakdown backup as a large company because both use similar presentation.  
**Required correction:** Add evidence-backed provider/service badges, explanations, and a report action. Never imply equal service.

#### DL-016 - Public fleet/review lists silently stop

**Level:** MEDIUM  
**Who:** Larger providers and their customers  
**Problem:** A provider page only loads a limited number of vehicles and reviews but can present that subset as the page's fleet.  
**Example:** A company has 60 cars, but its public page appears to have 24 with no "more" control.  
**Required correction:** Show true counts and paginate or filter the complete public catalogue.

#### DL-017 - Airport pickup is treated like an airport transfer

**Level:** HIGH  
**Who:** Tourists and chauffeur customers  
**Problem:** Copy and links blur delivery of a rental car to the airport with a booked transport service from the airport. Those are different products, costs, and responsibilities.  
**Example:** A family expects a driver waiting with a name board but has only requested that a self-drive car be deliverable.  
**Required correction:** Separate "vehicle delivery," "airport transfer," and "chauffeur rental," with the right trip details for each.

#### DL-018 - Approximate USD prices have no trustworthy basis

**Level:** MEDIUM  
**Who:** Foreign visitors  
**Problem:** USD estimates use a fixed conversion setting without showing rate, date, source, or that final payment is in LKR to the provider.  
**Example:** The exchange rate moves, and a tourist accuses the provider of changing the advertised price.  
**Required correction:** State "approximate," show the rate/date, and say which currency the provider will actually accept.

### B. Accounts, sign-up, identity, and audience fit

#### DL-019 - Logged-in "Create Rental Page" sends the user to sign-up

**Level:** HIGH  
**Who:** Existing renters who want to list  
**Problem:** Pricing and other provider calls-to-action use a sign-up link even when the user is signed in. The footer uses a different, correct route.  
**Example:** The founder's observed case: login, open Pricing, press Create Rental Page, and get asked to create an account again.  
**Required correction:** Use one login-aware destination everywhere and add a test for every provider CTA.

#### DL-020 - Provider intent disappears after sign-up

**Level:** HIGH  
**Who:** New providers  
**Problem:** `/signup?intent=provider` uses the same general sign-up journey and normally ends at the account area. It does not reliably continue into Rental Page creation.  
**Example:** An owner comes from "List your vehicle," verifies OTP, then wonders where listing went.  
**Required correction:** Preserve intent through OTP and send the user directly into the correct guided setup.

#### DL-021 - Login reveals whether an account exists

**Level:** HIGH  
**Who:** All account holders  
**Problem:** Different responses can reveal whether a phone/email is registered. Email login also searches a limited number of authentication users, and phone matching relies on the final nine digits.  
**Example:** Someone tests a person's phone number and learns they use DriveLink; two international numbers with the same ending may be confused.  
**Required correction:** Normalise full international numbers, use direct indexed identity lookup, and return the same neutral message for registered and unregistered identifiers.

#### DL-022 - Email has two different meanings of "verified"

**Level:** HIGH  
**Who:** Users and support staff  
**Problem:** An authentication email may be marked confirmed at account creation while the visible profile still says email is unverified. An email entered during agreement signing can update the profile without proving ownership.  
**Example:** Staff trust "confirmed" in one screen while the user never clicked an email link.  
**Required correction:** Use one email-verification state and never replace the account email from a signature form without a verification step.

#### DL-023 - One-time-code protection can be bypassed by parallel attempts

**Level:** STOP  
**Who:** Account holders and SMS budget  
**Problem:** Cooldowns and attempt limits exist, but important counters are read and then updated separately. Several simultaneous requests can see the same old value. There is also no strong shared IP/device/global rate limit.  
**Example:** An attacker sends many requests at once, increasing guessing attempts or SMS costs beyond the intended limit.  
**Required correction:** Make each attempt/resend counter update indivisible and add IP/device/phone-wide limits and alerts.

#### DL-024 - The system can say an SMS/email was sent when it failed

**Level:** STOP  
**Who:** Everyone waiting for OTPs, agreements, or notices  
**Problem:** The email helper can return "failed" without throwing an error. Several callers only look for thrown errors and therefore record delivery as successful.  
**Example:** A renter sees "Agreement emailed" while email is not configured or the provider rejected it.  
**Required correction:** Check the real success result for every channel, show a truthful status, retry safely, and give support a failed-delivery queue.

#### DL-025 - Sign-up privacy copy is too absolute

**Level:** HIGH  
**Who:** New users  
**Problem:** Sign-up says contact details have no sharing/no marketing in broad terms, while booking consent, providers, notification services, and other vendors require some sharing.  
**Example:** A user later sees their details made available to an accepted provider and feels the original promise was broken.  
**Required correction:** Say exactly what is shared, with whom, at what booking stage, and for what purpose.

#### DL-026 - Booking asks for sensitive verification before checking basic eligibility

**Level:** HIGH  
**Who:** Young renters and ineligible drivers  
**Problem:** A person can upload identity/licence material before DriveLink checks listing age, licence-years, rental mode, or permit eligibility.  
**Example:** An 18-year-old uploads documents for a 23+ vehicle and only learns later that the rental cannot proceed.  
**Required correction:** Ask non-sensitive eligibility questions first and block impossible requests early.

#### DL-027 - Listing age and licence requirements are not enforced

**Level:** STOP  
**Who:** Renters, providers, insurers  
**Problem:** The listing and agreement can show minimum age and driving experience, but the account does not store enough verified information to calculate them and the booking route does not enforce them.  
**Example:** A newly licensed 18-year-old requests a vehicle requiring age 23 and two years' experience.  
**Required correction:** Collect and verify date of birth and original licence issue date, then enforce the exact published rule before request submission.

#### DL-028 - Licence verification is only photo presence

**Level:** STOP  
**Who:** Providers and road users  
**Problem:** Uploading two image files can satisfy the licence gate. There is no Didit licence result or required admin validation of licence number, class, name, expiry, or image authenticity.  
**Example:** A person uploads unrelated images and appears ready to request self-drive.  
**Required correction:** Add a real licence-review status, display what was checked, block self-drive until passed, and recheck expiry.

#### DL-029 - Foreign-driver status and permits depend on self-declaration

**Level:** STOP  
**Who:** Tourists, providers, police/insurer stakeholders  
**Problem:** The renter can tick or untick "foreign" and give only a broad yes/no permit answer. The system does not record permit type or require the handover person to confirm the original permit/licence was inspected.  
**Example:** A tourist chooses "not foreign," bypasses the permit question, and arrives with only a foreign licence.  
**Required correction:** Derive nationality/residency carefully, record IDP/AA/DMT/none, show lawyer-approved guidance, and require original-document handover confirmation.

#### DL-030 - Permit guidance may be legally overbroad

**Level:** HIGH  
**Who:** Foreign drivers  
**Problem:** Current guidance can read as though every foreign visitor needs one local recognition permit. Sri Lanka's Motor Traffic law includes recognition conditions for qualifying 1968 Vienna Convention international permits.  
**Example:** A visitor with a qualifying IDP is told an absolute rule that may not apply in the way stated.  
**Required correction:** Obtain Sri Lankan legal review and use conditional, information-not-advice wording. Source: [Sri Lanka Motor Traffic Act material](https://www.dmt.gov.lk/images/PDF/Downloads/act_no_08of2009_en.pdf).

#### DL-031 - There is no Sinhala or Tamil product experience

**Level:** HIGH  
**Who:** Local renters, owners, drivers, handover staff  
**Problem:** All key workflows are English-only and there is no translation structure. Safety and contract steps use rental/legal vocabulary that many otherwise capable users may not understand.  
**Example:** A handover worker taps confirmation without understanding the difference between existing wear and new damage.  
**Required correction:** Build a proper language system and prioritise safety-critical Sinhala/Tamil content; do not rely only on browser translation.

#### DL-032 - One account is assumed to be renter, driver, and payer

**Level:** HIGH  
**Who:** Diaspora families, companies, family groups  
**Problem:** The system does not clearly support "I am paying, another person is driving" or multiple approved drivers.  
**Example:** A Sri Lankan abroad books a car for a parent, but the wrong person's KYC and licence become attached to the contract.  
**Required correction:** Separate booker, payer, lead renter, approved driver(s), and passengers, with consent for each person.

### C. Rental Pages, listings, staff, and moderation

#### DL-033 - "Unlimited Rental Pages" is actually limited to five

**Level:** HIGH  
**Who:** Multi-brand providers and the blueprint  
**Problem:** The blueprint says one person can create unlimited pages. Current rules cap ownership at five.  
**Example:** A business with separate Colombo, Kandy, chauffeur, and premium brands reaches the limit unexpectedly.  
**Required correction:** Either change the public promise or replace the fixed cap with a sensible anti-abuse/approval rule.

#### DL-034 - Team access is granted without invitation acceptance

**Level:** STOP  
**Who:** Rental businesses and customers whose data staff can see  
**Problem:** Adding an email can create access immediately. There is no invitation confirmation, expiry, or clear audit history. The target can be an unsuitable or inactive account.  
**Example:** A mistyped email gives a stranger access to bookings and documents.  
**Required correction:** Send a time-limited invitation, require acceptance and appropriate account checks, notify the owner, and record grant/removal events.

#### DL-035 - All staff are too powerful

**Level:** STOP  
**Who:** Providers and renters  
**Problem:** There are no separate roles for booking desk, inspector, listing editor, finance, dispatcher, or branch staff. Broad staff access includes sensitive customer and operational information.  
**Example:** A photographer added to update listings can view renter identity documents.  
**Required correction:** Add least-access roles and booking/document-specific permission. Default staff should not see KYC documents.

#### DL-036 - Page transfer is immediate and weakly protected

**Level:** STOP  
**Who:** Page owners and all past renters on that page  
**Problem:** Ownership can be moved without recipient acceptance, OTP re-check, notice, or enough checks for disputes, frozen accounts, fees, deleted accounts, and receiving limits. Some follow-up access changes are best-effort.  
**Example:** A compromised owner session transfers a page and its customer history to another account.  
**Required correction:** Add re-authentication, two-sided acceptance, cooling-off, notifications, full eligibility checks, and one all-or-nothing database operation.

#### DL-037 - Page setup copy still describes old commissions and statements

**Level:** HIGH  
**Who:** New providers  
**Problem:** The creation journey mentions commission/statement ideas that contradict the final free-listing and renter-confirmation-fee model. It can also label a phone as WhatsApp while saying SMS will arrive there.  
**Example:** A private owner thinks completed rentals will create a monthly bill.  
**Required correction:** Rewrite setup around the final payment truth and label each communication channel accurately.

#### DL-038 - "Business verified" does not require strong business proof

**Level:** STOP  
**Who:** Renters choosing companies  
**Problem:** Business certificate upload can be optional, and the admin can verify a page without proof being structurally required. A personal page can also become verified mainly from owner KYC.  
**Example:** A page appears to be a verified rental business even though no registration certificate was accepted.  
**Required correction:** Split "identity checked," "phone checked," and "registered business checked" into separate badges with required evidence and review dates.

#### DL-039 - Page phone verification is not required before listing

**Level:** HIGH  
**Who:** Renters and support  
**Problem:** A provider can progress without a verified public business contact. Although changing the number now resets verification, listing readiness does not consistently require the check.  
**Example:** A booking is accepted, but the displayed provider number is wrong or unreachable.  
**Required correction:** Require a verified operational contact before first publication/acceptance and reverify on change.

#### DL-040 - Vehicle verification appears to have no complete awarding path

**Level:** STOP  
**Who:** Owners and renters  
**Problem:** Listing copy promises an earned "Verified Vehicle" tier and ranking benefit, and ranking expects a verified flag, but the reviewed workflow does not clearly set that status. A manual "Documents Checked" badge is a separate mechanism.  
**Example:** An owner uploads everything and waits for a badge that never arrives.  
**Required correction:** Define one verification state machine, required documents, expiry, reviewer, badge text, and ranking effect.

#### DL-041 - Trust-sensitive listing edits go live without re-review

**Level:** STOP  
**Who:** Renters  
**Problem:** After approval, a provider can change vehicle identity, plate, photos, insurance, price, and terms without sending the listing back to review.  
**Example:** A legitimate approved Toyota is changed into another vehicle or private insurance is relabelled hire insurance.  
**Required correction:** Immediately hold or mark changed trust fields as pending review, keep a visible change history, and preserve the booked terms for existing requests.

#### DL-042 - Publication approval does not enforce the promises around documents

**Level:** STOP  
**Who:** Renters and admins  
**Problem:** Admin approval does not structurally require the claimed document level, page contact readiness, or business proof. Human memory is expected to connect several screens.  
**Example:** An admin approves a convincing photo set but misses missing insurance evidence.  
**Required correction:** Give admin a mandatory checklist whose requirements match the exact badge being granted.

#### DL-043 - Insurance expiry exists in data but not in the real workflow

**Level:** STOP  
**Who:** Self-drive renters and providers  
**Problem:** Expiry fields and "valid insurance" filtering exist, but listing/admin forms do not reliably collect or maintain those dates. A missing expiry can be treated as valid.  
**Example:** A years-old insurance image still allows a vehicle into the hire-insured filter.  
**Required correction:** Require insurer, policy type, policy number (protected), expiry, and reviewed evidence for any insurance badge. Automatically remove/mark the badge on expiry.

#### DL-044 - "Fully covered if anything goes wrong" is unsafe

**Level:** STOP  
**Who:** Renters and providers  
**Problem:** Hire-insurance copy can sound like complete coverage, while policies commonly have excesses, exclusions, named-driver rules, use restrictions, and claim conditions. The agreement itself limits liability in another place.  
**Example:** A renter has a crash and expects zero personal cost because the page said fully covered.  
**Required correction:** Replace guarantees with "provider states this vehicle has hire/rental cover; ask to see policy terms." Show excess and key exclusions where verified.

#### DL-045 - Private-insurance warning is easy to miss

**Level:** STOP  
**Who:** Self-drive renters  
**Problem:** The clearest warning is on the full vehicle page, which currently 404s, and is not equally strong in the card/modal/booking confirmation.  
**Example:** A renter books from the modal and never sees that a private policy may reject rental use.  
**Required correction:** Show the warning before request and agreement acceptance on every path; require an explicit acknowledgement.

#### DL-046 - Page pause and vehicle status can disagree

**Level:** HIGH  
**Who:** Renters and providers  
**Problem:** A staff member can change a vehicle status while its page is paused. Search does not independently require an active page, so a car may appear searchable but fail when booked. Unblocking or unverifying a page also does not consistently restore/remove every vehicle.  
**Example:** A user finds an apparently available car from a paused provider and gets rejected at checkout.  
**Required correction:** Make page state a required part of public search and booking, and update all child listings in one reliable operation.

#### DL-047 - Public booking checks do not fully match public search checks

**Level:** HIGH  
**Who:** Renters  
**Problem:** Booking checks page deactivation but not every blocked, deleted, verified, and publication condition. Search relies on status data staying perfectly in sync.  
**Example:** A data-sync failure leaves a vehicle visible even though the page should not transact.  
**Required correction:** Use one shared eligibility decision for listing, detail, search, and booking.

#### DL-048 - Pending/rejected listing privacy may be too broad for signed-in users

**Level:** HIGH  
**Who:** Providers and moderators  
**Problem:** The direct vehicle-page policy appears capable of allowing more authenticated users than just the owner/admin to preview non-public listings if they know the address.  
**Example:** A renter receives a guessed pending slug and sees unapproved content.  
**Required correction:** Explicitly restrict non-public previews to page owner/authorised staff/admin.

#### DL-049 - Admin wording still says "Agencies"

**Level:** MEDIUM  
**Who:** DriveLink staff  
**Problem:** Internal labels such as Agencies/Live agencies keep the old account model alive, increasing mistakes and making support language differ from customer language.  
**Example:** Support tells a host to open their agency when the screen says Rental Page.  
**Required correction:** Complete the terminology migration in data labels, admin, emails, guides, and scripts.

### D. Booking, quotes, and money

#### DL-050 - The booking form does not collect enough information

**Level:** HIGH  
**Who:** Renters and providers  
**Problem:** It lacks practical fields for purpose/notes, passengers, luggage, exact pickup/drop address, flight details, itinerary, or special requirements. FAQ tells users to put flight details in request notes even though that field is absent.  
**Example:** A van arrives too small for five passengers and six suitcases.  
**Required correction:** Change the form by rental mode and collect only the details needed for a real quote and handover.

#### DL-051 - Weekly rate is displayed but not used in booking price

**Level:** STOP  
**Who:** Renters and providers  
**Problem:** A vehicle can advertise/snapshot a weekly price, but the booking calculator does not apply it.  
**Example:** A 14-day renter expects two weekly rates but receives 14 daily charges.  
**Required correction:** Define daily/weekly/monthly price selection and use the same calculator in cards, form, agreement, provider view, and evidence pack.

#### DL-052 - Delivery cost is not in the quote

**Level:** STOP  
**Who:** Renters requesting delivery  
**Problem:** A listing can show delivery and a fee, but the booking request does not collect destination or consistently include delivery in the total.  
**Example:** A renter confirms a displayed subtotal and later learns airport delivery costs extra.  
**Required correction:** Collect location, calculate/confirm the delivery fee, and show whether it is one-way or return.

#### DL-053 - Chauffeur pricing is incomplete

**Level:** STOP  
**Who:** With-driver customers  
**Problem:** Daily price does not reliably include kilometres, driver bata, overtime, overnight stay, tolls, parking, waiting, night/airport charges, or itinerary.  
**Example:** A tourist sees Rs. X per day but pays much more after a long route and driver overnight stay.  
**Required correction:** Create a separate chauffeur quote model with inclusions, route assumptions, and "final quote must be accepted" before confirmation.

#### DL-054 - The platform invents a late fee in one display path

**Level:** STOP  
**Who:** Renters  
**Problem:** The full detail page can show a fallback late fee even when the provider did not enter one.  
**Example:** The agreement and provider expectation differ from the listing because the website calculated a default.  
**Required correction:** Never invent a contractual charge. Require a chosen standard term or show "not specified; must be agreed before confirmation."

#### DL-055 - "Cancel for a full refund" appears where no payment was taken

**Level:** HIGH  
**Who:** Guest/new renters  
**Problem:** Early booking copy speaks of a refund even during a zero-fee, direct-payment model.  
**Example:** A user believes DriveLink has their money and contacts support for a refund.  
**Required correction:** Say "No DriveLink fee has been charged" and explain provider-side rental/deposit cancellation separately.

#### DL-056 - "Verify and confirm booking" actually only sends a request

**Level:** HIGH  
**Who:** New renters  
**Problem:** The call-to-action can make a user believe the vehicle is confirmed. The real flow includes OTP, KYC, licence, provider acceptance, and possibly future confirmation payment.  
**Example:** A traveller stops searching after sending the request and later learns it was never accepted.  
**Required correction:** Use "Send booking request" until provider acceptance and show the steps before asking for documents.

#### DL-057 - Free-launch configuration has two separate sources of truth

**Level:** STOP  
**Who:** Renters and finance/admin  
**Problem:** Environment configuration and a database booking-fee setting can disagree. Different screens or routes may then think the launch fee is both zero and non-zero.  
**Example:** Pricing says free while a booking enters a payment-pending path.  
**Required correction:** Use one versioned fee setting read by every surface, with a deployment safety check.

#### DL-058 - The database still creates a Rs. 200 provider fee

**Level:** STOP  
**Who:** Providers and DriveLink accounting  
**Problem:** An old database trigger stamps a Rs. 200 agency fee on completed bookings. This directly contradicts the final renter-only fixed confirmation fee.  
**Example:** A provider completes ten free-launch rentals and the dashboard says they owe Rs. 2,000.  
**Required correction:** Remove/neutralise the old trigger through a reviewed migration and decide how to clear any existing false balances.

**Re-verification correction (9 August 2026):** Production no longer had this trigger and no provider had a balance. The historical migration, nonzero booking default, and matching UI still made this a replay/reactivation risk. Migration 084 now removes that risk explicitly. See Fix 3 in the remediation log.

#### DL-059 - Provider dashboard still calculates money owed to DriveLink

**Level:** STOP  
**Who:** Providers  
**Problem:** Analytics says completed bookings multiplied by Rs. 200 equals what the provider owes, with monthly bank-transfer language.  
**Example:** A founding host sees an unexpected debt despite the promise of free listing and no provider commission.  
**Required correction:** Remove provider fee/outstanding/invoice UI and replace it with booking performance only.

#### DL-060 - Old invoices, slips, bank details, and "payouts" remain

**Level:** HIGH  
**Who:** Admin, support, providers  
**Problem:** Manual fee collection tools, invoices, platform bank information, slip review, and payout wording remain active or visible. Account deletion can even be affected by owner fees.  
**Example:** Staff accidentally ask a provider for an obsolete bank payment.  
**Required correction:** Retire the full owner-fee system, not only the public number. Keep rental/deposit tracking clearly separate from DriveLink revenue.

#### DL-061 - Pricing and Terms promise a different future model

**Level:** HIGH  
**Who:** Providers and renters  
**Problem:** Some copy says no fees, some says launch-only zero, and some promises a per-page success fee after free bookings. None matches the final small fixed renter confirmation fee.  
**Example:** A provider signs up under one promise and later cites the Terms against a different charge.  
**Required correction:** Approve one payment policy and replace every old statement in product, legal pages, database settings, emails, and admin.

#### DL-062 - Future confirmation fee lacks a complete policy

**Level:** HIGH  
**Who:** Future paying renters  
**Problem:** There is no final answer for refund after provider cancellation, expiry, duplicate payment, chargeback, no-show, partial change, or platform failure.  
**Example:** A provider accepts, the renter pays the fee, and then the provider cancels.  
**Required correction:** Define and build a short, fair refund table before turning the fee on. Store receipts and gateway references.

#### DL-063 - Boosts could quietly damage trust ranking

**Level:** HIGH  
**Who:** Renters and honest providers  
**Problem:** Future "power-ups" are not yet governed. If paid position is mixed into verification or safety ranking, users may mistake payment for quality.  
**Example:** A private-insurance basic car appears above a hire-insured verified car because its owner paid.  
**Required correction:** Label sponsorship, keep safety filters/rules above commercial ranking, and publish a plain ranking explanation.

### E. Agreements, documents, privacy, and legal promises

#### DL-064 - Document consent is not tightly tied to one booking file request

**Level:** STOP  
**Who:** Renters sharing NIC/passport/licence material  
**Problem:** The document route can authorise a page because any suitable consented active booking exists between that renter and page, rather than binding the file request to the exact booking named to the renter.  
**Example:** A page has two bookings with the same renter and uses consent from one context to access documents in another.  
**Required correction:** Every view URL must include and validate the exact booking, document, page, renter, consent status, purpose, and staff permission.

#### DL-065 - "Every document view is logged" is not true

**Level:** STOP  
**Who:** Renters  
**Problem:** The visible page writes a log, but a direct call to the protected image route is not necessarily recorded. Refreshing/saving the file can bypass the claimed history.  
**Example:** A staff member opens the raw image address several times; the renter sees only one viewer event.  
**Required correction:** Write the access log inside the server route before every successful file response, including viewer account, page, booking, document, time, and result.

#### DL-066 - Some identity documents are served without a burned-in watermark

**Level:** STOP  
**Who:** Renters  
**Problem:** Server watermarking supports a narrow group of images. PDF, GIF, HEIC, and some WebP/failure cases can fall back to the original file.  
**Example:** A staff member views a PDF identity document and saves a clean, unwatermarked copy.  
**Required correction:** Accept only formats that can be safely rendered, convert them server-side, and fail closed. Never send the original when watermarking fails.

#### DL-067 - The watermark does not contain all promised trace details

**Level:** HIGH  
**Who:** Renters and investigators  
**Problem:** The visual overlay and server watermark contain different information. The raw server response may not include booking ID and Rental Page name as promised.  
**Example:** A leaked file names a viewer and date but cannot be clearly tied to the authorised booking purpose.  
**Required correction:** Burn the same booking ID, page, named staff viewer, view time, and "for this booking only" text into every rendered page/image.

#### DL-068 - Identity images can be cached by the installed web app

**Level:** STOP  
**Who:** Renters and anyone sharing a device  
**Problem:** The service worker caches same-origin image-looking addresses. Protected document URLs can end in `.jpg`, so they may be stored despite "no-store" response intentions.  
**Example:** A staff member views a licence on a shared phone; the image remains available from browser/app storage later.  
**Required correction:** Explicitly exclude all `/api/docs/` and sensitive booking evidence from service-worker caching, clear old caches, and test offline behaviour.

#### DL-069 - Android backups can preserve sensitive app data

**Level:** HIGH  
**Who:** Android users  
**Problem:** The Android app permits backups. WebView cookies/cache or other data may be copied through device backup systems.  
**Example:** A device backup transfers session or cached sensitive data to another device/account.  
**Required correction:** Disable backup for sensitive app data and review Android network/cache/session settings.

#### DL-070 - "In-app only" is not the same as "cannot be downloaded"

**Level:** HIGH  
**Who:** Renters  
**Problem:** Hiding a download button does not prevent browser save, screenshots, network capture, or a direct protected URL.  
**Example:** A page staff member saves the displayed image using browser tools.  
**Required correction:** Use honest deterrence wording: controlled access, watermark, expiry, and audit. Do not promise technical impossibility.

#### DL-071 - Sharing history is incomplete and loses staff identity

**Level:** HIGH  
**Who:** Renters  
**Problem:** The history can show only the page rather than the specific staff viewer, is capped, and lacks pagination/export.  
**Example:** Five employees viewed an NIC, but the renter only sees the company name.  
**Required correction:** Show named/identified staff role, exact document, booking, time, and outcome; paginate and retain according to a clear policy.

#### DL-072 - All page staff can reach documents

**Level:** STOP  
**Who:** Renters and providers  
**Problem:** Broad staff permissions make KYC/licence access available to people who may only need listing or inspection duties.  
**Example:** A social-media employee can view customer NIC images.  
**Required correction:** Restrict documents to approved booking/verification roles, require a reason per view, and give owners a permission report.

#### DL-073 - Sensitive uploads trust the claimed size/type too much

**Level:** STOP  
**Who:** Platform security/cost and document subjects  
**Problem:** Pre-signed uploads validate declared metadata before upload but do not reliably enforce actual bytes and format at storage time. Orphan uploads can also accumulate.  
**Example:** A malicious client claims a small JPEG, uploads a very large or different file, and consumes storage or processing memory.  
**Required correction:** Validate object size and true file signature after upload, quarantine until passed, limit per user/booking, and clean abandoned objects.

#### DL-074 - Some booking evidence uses long-lived public storage links

**Level:** STOP  
**Who:** Renters and providers  
**Problem:** Inspection photos, slips, and incident evidence can be stored behind difficult-to-guess but publicly retrievable URLs. If a link leaks, the file may remain available.  
**Example:** A forwarded inspection link is opened months later by someone outside the booking.  
**Required correction:** Move sensitive evidence to private storage and serve it through short-lived, permission-checked routes.

#### DL-075 - Evidence ZIP creation can fail on large real bookings

**Level:** HIGH  
**Who:** Owners during a no-return emergency  
**Problem:** The evidence pack is assembled in memory. Many large inspection/incident photos can exceed a server worker's memory or time limit exactly when the owner urgently needs it.  
**Example:** A 500MB evidence set fails while the provider is at a police station.  
**Required correction:** Stream files, limit/compress uploads, create packs asynchronously, and keep a tested smaller police summary.

#### DL-076 - The evidence pack is missing key evidence

**Level:** STOP  
**Who:** Owner, renter, admin, police/insurer  
**Problem:** It can omit incidents, charges, settlement responses, deposit confirmations, consent/view history, return acknowledgement, admin resolution, and some messages because of caps.  
**Example:** A dispute pack shows the agreement but not the charge the renter rejected or the admin outcome.  
**Required correction:** Define a complete evidence manifest and include chronological hashes/records for every material event.

#### DL-077 - Evidence access is too broad and PII-heavy

**Level:** STOP  
**Who:** Renters  
**Problem:** All page staff can potentially download a pack containing full phone, email, and NIC information at broad booking stages.  
**Example:** A casual staff account exports full renter identity long after it is operationally needed.  
**Required correction:** Limit role/stage, require a reason, log downloads, mask by default, and require elevated approval for a police-ready full version.

#### DL-078 - Agreement acceptance is weaker than the copy suggests

**Level:** HIGH  
**Who:** Both contract parties  
**Problem:** Signing is largely a checkbox in an authenticated session plus time/device information. OTP reconfirmation is not required; staff identity can appear as a generic owner acceptance.  
**Example:** A shared office login accepts a contract, but the final PDF does not clearly name the individual authorised signer.  
**Required correction:** Reconfirm identity for signing, record legal name/role, require provider signer authority, and show exactly what evidence supports the signature.

#### DL-079 - Agreement creation can fail while confirmation still succeeds

**Level:** STOP  
**Who:** Both parties  
**Problem:** If the agreement snapshot fails, the booking flow can log the error and continue. This contradicts the promise that the confirmed terms are safely stored.  
**Example:** A provider accepts, the booking is confirmed, but there is no frozen agreement to sign.  
**Required correction:** Confirmation must fail safely or enter a visible repair state until the immutable snapshot exists.

#### DL-080 - Agreement does not always know which rental mode was selected

**Level:** STOP  
**Who:** Self-drive and chauffeur customers  
**Problem:** If a vehicle supports both modes, the generated terms can include inappropriate clauses from both because the selected mode is not consistently reflected.  
**Example:** A chauffeur booking receives self-drive licence/liability terms.  
**Required correction:** Store selected mode in the request and generate mode-specific schedules and price terms.

#### DL-081 - Agreement contains unearned assumptions and contradictions

**Level:** STOP  
**Who:** Both parties  
**Problem:** It can default to travel anywhere in Sri Lanka, describe hire-insurance protection too strongly, use a 30-day fines rule beside a 72-hour dispute system, and say DriveLink will report to police when the product only alerts the owner.  
**Example:** One side relies on an automatically invented permission or deadline.  
**Required correction:** Generate only explicitly agreed facts and make every deadline/action match the working platform.

#### DL-082 - Agreement misses important real-world parties and facts

**Level:** HIGH  
**Who:** Businesses, chauffeur customers, insurers  
**Problem:** It does not consistently capture provider legal identity/registration, exact handover/return location, assigned driver, insurer/policy/excess, or itinerary.  
**Example:** An airport chauffeur dispute has no agreed route, waiting rule, or named driver.  
**Required correction:** Use a mode-aware agreement schedule and require these facts before signing.

#### DL-083 - PDFs are generated later instead of preserving one final signed artifact

**Level:** HIGH  
**Who:** Both parties and dispute reviewers  
**Problem:** The system stores a terms snapshot/hash, but the downloadable PDF is rendered on demand. A future template change could make an old booking's visual document look different.  
**Example:** A 2026 booking downloaded in 2027 uses a redesigned template.  
**Required correction:** Store the final signed PDF and its hash at signing completion; later downloads must return that exact file.

#### DL-084 - Platform Terms acceptance is not versioned

**Level:** HIGH  
**Who:** All users  
**Problem:** There is no strong record that a user accepted a specific version of DriveLink's Terms/Privacy wording after major changes.  
**Example:** A payment or privacy dispute cannot show which version the user saw.  
**Required correction:** Version legal texts and record user, version, time, locale, and acceptance evidence.

#### DL-085 - Account deletion promises and behaviour disagree

**Level:** STOP  
**Who:** Anyone deleting an account  
**Problem:** Screens/Terms mention irreversible deletion in places and a 30-day restoration window elsewhere. Code can retain phone, NIC, KYC references, or documents differently from the promise. Active-booking and legal-retention language also conflicts.  
**Example:** A user expects documents to remain recoverable for 30 days but they are immediately removed, while identity fields they expected deleted remain.  
**Required correction:** Choose one reviewed deletion/retention policy, list every retained category and reason, make the operation reliable, and show the same truth everywhere.

#### DL-086 - Account deletion and transfer lack strong re-authentication

**Level:** STOP  
**Who:** All users/page owners  
**Problem:** High-impact account actions do not consistently require a fresh OTP/password-equivalent check. Several deletion steps are also separate operations whose failures can be ignored.  
**Example:** A stolen logged-in device deletes an account or transfers a business page.  
**Required correction:** Require fresh verification and make each destructive workflow all-or-nothing with a recovery audit.

#### DL-087 - Privacy policy describes systems that are not implemented or no longer accurate

**Level:** HIGH  
**Who:** All users  
**Problem:** Retention jobs, access-log periods, analytics statements, and email-provider references do not consistently match the code. The legal pages predate major July/August changes.  
**Example:** The policy says Google handles an email purpose while the platform uses Resend.  
**Required correction:** Create a data inventory from the real system, update the policy, and assign a recurring owner for legal-copy changes.

#### DL-088 - PDPA timing wording needs current legal review

**Level:** HIGH  
**Who:** DriveLink as data controller  
**Problem:** Sri Lanka's 2025 amendment changed commencement to dates appointed by the Minister/Gazette, so old fixed-date assumptions can be wrong.  
**Example:** A policy states the wrong legal commencement position.  
**Required correction:** Have counsel verify current Gazette status and obligations. Sources: [Parliament Act page](https://www.parliament.lk/en/business-of-parliament/act-details/G6384) and [2025 amendment PDF](https://www.parliament.lk/uploads/acts/gbills/english/6384.pdf).

### F. Pickup, return, charges, disputes, and emergency handling

#### DL-089 - Rental can start before both agreements are accepted

**Level:** STOP  
**Who:** Renter and provider  
**Problem:** The provider can move a confirmed booking into active state without a hard requirement that both sides completed the agreement.  
**Example:** The car leaves before the renter has accepted the damage/deposit terms.  
**Required correction:** Block start until the required signed agreement, consent, verified original documents, and pickup inspection are complete, with an audited admin exception only.

#### DL-090 - Pickup renter acknowledgement is not truly mandatory

**Level:** STOP  
**Who:** Renters and providers  
**Problem:** The provider can submit pickup evidence and start the booking without the renter's "correct" or "difference" response.  
**Example:** The owner photographs existing damage poorly, starts the rental, and later treats it as new.  
**Required correction:** Require two-sided acknowledgement or a clearly timed refusal/no-response escalation before vehicle release.

#### DL-091 - Return can be completed before renter acknowledgement

**Level:** STOP  
**Who:** Renters  
**Problem:** The provider can submit return evidence and complete the booking. Once completed, the renter's acknowledgement API can reject the action because it only accepts active bookings.  
**Example:** The renter taps "Report difference" after completion and gets blocked by the status change.  
**Required correction:** Add a `return_pending_confirmation` stage and permit a defined response window before completion.

#### DL-092 - Provider can effectively complete its own version of the return

**Level:** STOP  
**Who:** Both parties  
**Problem:** Completion does not require renter return confirmation, charge response, deposit status, or agreement on differences.  
**Example:** A provider marks the booking done with a partial deposit return while the renter has not seen the calculation.  
**Required correction:** Define a completion checklist and separate "vehicle physically returned" from "booking financially/case closed."

#### DL-093 - Automatic completion can close an unresolved booking

**Level:** STOP  
**Who:** Both parties  
**Problem:** A background job can auto-complete after end time plus 24 hours when a return inspection exists, without requiring renter acknowledgement, settlement, deposit return, or checking the right dispute timing.  
**Example:** A disagreement is still being discussed when the system closes the rental automatically.  
**Required correction:** Auto-complete only clean, fully acknowledged cases; otherwise move to an action-required queue.

#### DL-094 - Renter can accept charges at the wrong booking stage

**Level:** STOP  
**Who:** Renters and providers  
**Problem:** The settlement endpoint does not properly restrict booking status, so a direct request can accept settlement even on a pending booking.  
**Example:** A malicious or accidental call stamps acceptance before the rental occurs.  
**Required correction:** Restrict settlement to the exact post-return state and validate every related charge/deposit record.

#### DL-095 - Providers can add broad charges without enough limits or proof

**Level:** STOP  
**Who:** Renters  
**Problem:** Charges can be very large, include an open "other" type, have optional labels, and do not require evidence or enforce the advertised late/cleaning/loss-of-hire rules.  
**Example:** A provider adds an unexplained Rs. 500,000 "other" charge after completion.  
**Required correction:** Use allowed charge types, contract caps/formulas, evidence, time limits, and admin review for exceptional amounts.

#### DL-096 - Renter cannot respond to individual charges

**Level:** HIGH  
**Who:** Renters  
**Problem:** The renter can accept the overall settlement or open a general dispute, but cannot accept extra kilometres and reject cleaning, for example.  
**Example:** Two correct charges and one wrong charge force a dispute over everything.  
**Required correction:** Add item-by-item accept/reject/comment and calculate only the agreed remainder.

#### DL-097 - No reliable record that extras were actually paid

**Level:** HIGH  
**Who:** Both parties  
**Problem:** Charges are recorded but there is no robust two-sided confirmation that money was paid/received/refunded, separate from accepting the calculation.  
**Example:** Renter accepts Rs. 3,000 in extras, pays cash, and the provider later says it was unpaid.  
**Required correction:** Record method, amount, payer confirmation, receiver confirmation, time, and receipt evidence.

#### DL-098 - Deposit return is not required before closure

**Level:** STOP  
**Who:** Renters  
**Problem:** Deposit timestamps/fields exist, but completion can happen without full/partial return confirmation and reason.  
**Example:** Booking becomes completed while Rs. 50,000 deposit remains unresolved.  
**Required correction:** Keep the case open until both sides confirm deposit outcome or an admin dispute is created.

#### DL-099 - Claim deadlines contradict each other and are not enforced

**Level:** STOP  
**Who:** Both parties  
**Problem:** The plan mentions 72 hours after completion for damage and 30 days for fines/tolls. Product routes allow charges outside those clear rules, while the agreement uses mixed deadlines.  
**Example:** A cleaning claim appears weeks later or a traffic fine cannot be raised within its promised window.  
**Required correction:** Create deadlines by claim type, show countdowns, and block or escalate late claims.

#### DL-100 - Dispute creation can leave half-finished records

**Level:** STOP  
**Who:** Both parties and admin  
**Problem:** Creating the incident and changing the booking status are separate actions. A failure between them can leave an orphan incident or a disputed booking with no case. Duplicate retries are also possible.  
**Example:** The renter presses twice after a timeout and creates two open dispute records.  
**Required correction:** Make dispute creation one database operation and allow only one active case unless admin deliberately separates issues.

#### DL-101 - Admin dispute handling is too thin

**Level:** STOP  
**Who:** Admin, renter, provider  
**Problem:** Admin can see some incident text in booking views, but there is no complete case inbox with evidence preview, assigned owner, deadlines, party responses, decision reasons, and separate outcomes for charges/deposit/account actions.  
**Example:** A support person resolves status but forgets to decide the deposit and blacklist report.  
**Required correction:** Build a proper case workspace and a decision checklist.

#### DL-102 - Admin can force impossible booking state changes

**Level:** STOP  
**Who:** Everyone in an affected booking  
**Problem:** The admin API is not as strict as the normal state machine. A direct request can move a booking between states that should be impossible. Some updates and audit records are separate and can disagree.  
**Example:** A pending booking is forced to completed without the required history.  
**Required correction:** Use one central state machine for renter, provider, automation, and admin, with named emergency actions and required reasons.

#### DL-103 - Normal booking transitions can race and send wrong notices

**Level:** STOP  
**Who:** Multiple renters requesting one car  
**Problem:** A conditional update does not always verify that it actually changed a row before continuing. Competing actions can report success or send notifications based on a transition that lost the race.  
**Example:** Two staff accept/reject near the same time and the renter receives a confirmation that does not match the final state.  
**Required correction:** Verify the updated row/state, make transition + side effects reliable, and make notifications repeat-safe.

#### DL-104 - "24-hour critical" does not prove the renter is unreachable

**Level:** HIGH  
**Who:** Renters and providers  
**Problem:** Critical late status is driven mainly by elapsed time/no return record, not a documented sequence of contact attempts and "unreachable" evidence.  
**Example:** A provider verbally agrees to a one-day extension but forgets to update DriveLink; the renter is frozen as critical.  
**Required correction:** Build extensions, contact-attempt records, grace rules, and an admin check before severe account action.

#### DL-105 - Late-return copy promises a fee cap the system does not create

**Level:** HIGH  
**Who:** Both parties  
**Problem:** Notices describe late-fee behaviour, but automation does not reliably calculate and add the contractual amount.  
**Example:** The renter is warned of a capped fee, while the provider later enters a different manual number.  
**Required correction:** Calculate from the frozen terms, show both parties, and require acknowledgement/dispute.

#### DL-106 - Critical notice does not deliver the promised police-ready pack

**Level:** HIGH  
**Who:** Owner in a no-return case  
**Problem:** The urgent notice links mainly to an agreement/booking instead of a complete ready evidence pack, and the pack itself is incomplete.  
**Example:** At 2 a.m., an owner follows the alert but still has to collect files manually.  
**Required correction:** Generate a resilient emergency summary and a full pack, with clear "contact police yourself" wording rather than promising DriveLink will report.

#### DL-107 - Accident guide asks for fields/workflows that do not exist

**Level:** HIGH  
**Who:** People in a stressful incident  
**Problem:** Guidance asks for a police report number and certain evidence but the incident form does not provide matching fields. It also makes broad assumptions about replacement cars, towing, refunds, and insurance excess.  
**Example:** A private host cannot provide a replacement vehicle despite the guide suggesting that outcome.  
**Required correction:** Match the form to the guide and qualify every provider-dependent service.

#### DL-108 - Accident guidance may collect unnecessary third-party ID

**Level:** HIGH  
**Who:** Other drivers and DriveLink's privacy responsibility  
**Problem:** The guide can encourage photos of other people's licences. That creates extra sensitive data without a clearly designed consent, access, or retention process.  
**Example:** An unrelated driver's licence is uploaded into a booking chat/evidence record.  
**Required correction:** Ask for legally necessary accident particulars only, mask where possible, and obtain lawyer/insurer guidance.

#### DL-109 - Renter blacklist report lacks fair notice and appeal

**Level:** STOP  
**Who:** Reported renters  
**Problem:** A page can submit a serious report after a booking, with a thin category structure. The renter is deliberately not notified and has no working appeal flow, although the blueprint promises notification and appeal.  
**Example:** A renter's next booking is blocked by an approved allegation they never saw.  
**Required correction:** Use factual categories/evidence, conflict checks, notice, response, appeal, expiry/review rules, and careful legal wording.

#### DL-110 - Too many staff can submit a high-impact renter report

**Level:** HIGH  
**Who:** Renters and page owners  
**Problem:** Broad page staff access can file a report that may affect a person across the platform.  
**Example:** A temporary employee retaliates after an argument.  
**Required correction:** Restrict reports to authorised managers/compliance staff and show page owner/admin accountability.

### G. Messaging, notifications, admin operations, and technical quality

#### DL-111 - Chat can bypass the contact-information gate

**Level:** HIGH  
**Who:** Renters, providers, DriveLink safety/support  
**Problem:** Booking messages are open while a request is pending and users can type phone numbers or off-platform instructions even though contact details are meant to unlock only after acceptance.  
**Example:** A provider asks the renter to book directly on WhatsApp, removing the DriveLink evidence trail.  
**Required correction:** Decide the real policy. If pre-acceptance chat stays, detect/warn about contact sharing and keep meaningful conversation records.

#### DL-112 - Chat closes too early

**Level:** STOP  
**Who:** Both parties after return  
**Problem:** Messaging becomes read-only at completion even though deposit return, fines, damage, and claims may still be open. Contact panels also disappear in some completed/disputed views.  
**Example:** The provider adds a charge after completion, but the renter cannot discuss it in the booking thread.  
**Required correction:** Close chat only when the entire case is closed; preserve a controlled claim channel for the defined windows.

#### DL-113 - Chat has no attachments and incomplete history

**Level:** HIGH  
**Who:** People handling changes/incidents  
**Problem:** Users cannot attach supporting files in chat, and history is capped without pagination. Different views/evidence exports use different caps.  
**Example:** A provider cannot attach an invoice for a tyre replacement, and older agreement messages vanish from the visible thread.  
**Required correction:** Add safe, private attachments and complete paginated/exportable history.

#### DL-114 - WhatsApp support can become an off-system booking shortcut

**Level:** HIGH  
**Who:** DriveLink operations and users  
**Problem:** "Ask WhatsApp" goes to DriveLink support and can pull the user out of structured search/request fields. Important facts then live on a staff phone rather than the booking.  
**Example:** Flight changes are agreed in WhatsApp but never appear in the contract or handover record.  
**Required correction:** Use WhatsApp as assisted input that staff can attach to the correct booking, not as an undocumented parallel system.

#### DL-115 - Some notifications link to the wrong side of the product

**Level:** HIGH  
**Who:** Provider staff  
**Problem:** Automated reminders can use the renter booking address even when sent to a provider. Alerts also go to a page number rather than the correct assigned staff member.  
**Example:** A provider opens a nudge and lands on an inaccessible/wrong booking view.  
**Required correction:** Generate role-aware links and introduce assignment/escalation rules for page staff.

#### DL-116 - Pending requests are omitted from some unread-message reminders

**Level:** MEDIUM  
**Who:** Renters and providers  
**Problem:** Messaging is available during pending state, but the unread nudge job does not cover it consistently.  
**Example:** A provider asks a pre-acceptance question and the renter never gets the follow-up reminder.  
**Required correction:** Align message availability, notification states, and closure rules.

#### DL-117 - Support sender labels can be wrong for page staff

**Level:** HIGH  
**Who:** Admin support  
**Problem:** A team member whose personal profile is a renter can send page support messages that are labelled as a renter rather than page staff.  
**Example:** Admin treats an operational request as a consumer complaint.  
**Required correction:** Derive sender role from the thread/page membership context, not only the person's base profile role.

#### DL-118 - Admin lists silently stop after fixed limits

**Level:** HIGH  
**Who:** Admin and enterprise providers  
**Problem:** Bookings, reports, messages, pages, or evidence use fixed limits such as 50/100/200/500/1000 without proper pagination. Older records can disappear from day-to-day tools.  
**Example:** The 101st urgent record does not appear in the admin list.  
**Required correction:** Add pagination, filters, totals, and export on every operating queue.

#### DL-119 - Background jobs are not deployed by the normal main deploy command

**Level:** STOP  
**Who:** Everyone relying on expiry, late, nudge, and completion automation  
**Problem:** The Cloudflare cron worker exists separately, while the standard deploy command only deploys the main worker. A stale Vercel cron file also remains.  
**Example:** The website is updated but late-return/expiry automation is still old or absent.  
**Required correction:** Make one release command deploy and verify both app and cron, and remove obsolete platform configuration.

#### DL-120 - There is no reliable release monitoring for critical workflows

**Level:** STOP  
**Who:** Founder/support and all users  
**Problem:** Failures are often logged or swallowed, but there is no clear error monitoring and alerting for bookings, agreement snapshots, document views, notification delivery, or cron health.  
**Example:** Vehicle links fail publicly while search still works, and no alert identifies the revenue loss.  
**Required correction:** Add central error tracking, business-event checks, cron heartbeats, and alerts with no sensitive content.

#### DL-121 - The normal lint quality check is broken

**Level:** HIGH  
**Who:** Development/release quality  
**Problem:** `npm run lint` invokes a removed/outdated Next command and prompts interactively instead of producing a repeatable pass/fail result.  
**Example:** A release is called "tested" even though no automatic lint check ran.  
**Required correction:** Configure ESLint directly and run lint, type-check, tests, and build in one non-interactive release pipeline.

#### DL-122 - Existing end-to-end tests are stale and unsafe to run

**Level:** STOP  
**Who:** Production data and release confidence  
**Problem:** The test script can use a privileged database key against the configured Supabase environment, creates/modifies records, uses unrealistic tiny photos, and expects an older booking state flow.  
**Example:** A developer runs "tests" and accidentally writes test bookings into production.  
**Required correction:** Create a separate test project/database, safe fixtures, cleanup, and current journey tests. Refuse to run against production.

#### DL-123 - There are no automatic permission/privacy tests

**Level:** STOP  
**Who:** Every renter/provider  
**Problem:** The riskiest promise is that one page cannot see another page's bookings or documents, yet there is no strong automated negative test suite for that.  
**Example:** A future database change broadens access and the build still passes.  
**Required correction:** Test owner A/page A/page B/staff/renter/admin access to every sensitive object, including direct URLs.

#### DL-124 - No automatic accessibility checks exist

**Level:** HIGH  
**Who:** Disabled users and mobile/keyboard users  
**Problem:** No release test catches missing dialog labels, weak contrast, tiny text, lost focus, or keyboard traps.  
**Example:** A keyboard user opens the vehicle modal but focus remains behind it.  
**Required correction:** Add axe/Playwright checks plus manual keyboard and screen-reader journey tests.

#### DL-125 - Dialogs and mobile sheets are not complete accessible dialogs

**Level:** HIGH  
**Who:** Keyboard and screen-reader users  
**Problem:** Important modals lack consistent dialog role, `aria-modal`, focus trapping, return focus, and escape behaviour.  
**Example:** A screen reader reads page content behind the open booking form.  
**Required correction:** Use one tested accessible dialog/sheet component everywhere.

#### DL-126 - Small text and colour-only focus make important steps hard to read

**Level:** HIGH  
**Who:** Older/low-vision users and bright-outdoor mobile use  
**Problem:** Many labels are around 10-12 pixels, muted, and inputs sometimes remove the normal outline for a subtle border colour.  
**Example:** A user at roadside pickup cannot easily read the fuel/damage confirmation.  
**Required correction:** Raise minimum text/contrast and use strong visible focus independent of colour alone.

#### DL-127 - Time selection overwhelms users

**Level:** MEDIUM  
**Who:** Mobile renters  
**Problem:** Pickup/return uses long lists of half-hour entries, producing roughly 48 choices per control.  
**Example:** A renter scrolls a long menu twice just to choose a normal morning time.  
**Required correction:** Use a compact time picker with provider opening hours, common suggestions, and keyboard-friendly entry.

#### DL-128 - Global web security headers are missing

**Level:** STOP  
**Who:** All web users  
**Problem:** Live responses lack important browser protections such as a Content Security Policy, strict HTTPS policy, referrer policy, permissions policy, and frame protection. The response also exposes the framework name.  
**Example:** A future injected script or hostile framing has fewer browser barriers than it should.  
**Required correction:** Add and test a restrictive header policy that still permits required Didit/payment/media providers.

#### DL-129 - Production software packages have known serious advisories

**Level:** STOP  
**Who:** Platform security/stability  
**Problem:** The production dependency audit reported one critical and five high-risk packages, including the installed Next version and packages used in build/image/archive paths. Available fixes were reported.  
**Example:** A published framework flaw remains reachable after an upstream patch is available.  
**Required correction:** Update in a controlled branch, rebuild/retest, and make dependency audit part of releases.

#### DL-130 - Multiple lockfiles make builds choose the wrong workspace root

**Level:** MEDIUM  
**Who:** Developers and deployment reliability  
**Problem:** Next warns that it selected `H:\Projects` as workspace root because it found multiple lockfiles.  
**Example:** Tracing or deployment includes/excludes unexpected files and behaves differently on another machine.  
**Required correction:** Define the correct root explicitly and remove/relocate unrelated lockfile ambiguity where safe.

#### DL-131 - The home "self-drive" shortcut does not really filter self-drive

**Level:** HIGH  
**Who:** Renters  
**Problem:** The shortcut mainly selects the car vehicle type, not the self-drive rental mode. Cars that are not available for self-drive can enter the result.  
**Example:** A renter clicks self-drive and opens a chauffeur-only car.  
**Required correction:** Make every shortcut apply the exact rental mode and show the active choice clearly.

#### DL-132 - The insurance filter expects users to understand rental insurance

**Level:** HIGH  
**Who:** First-time renters and tourists  
**Problem:** "Hire insurance only" is a small control using industry language. It does not quickly explain why it matters or what the badge does not guarantee.  
**Example:** An 18-year-old leaves it off because "hire" sounds like a chauffeur option.  
**Required correction:** Rename it in plain language, add a short explanation, and keep the stronger warning before request.

#### DL-133 - Important operating screens are visually dense

**Level:** MEDIUM  
**Who:** Private hosts and small-business staff  
**Problem:** The product uses many boxed sections, status chips, small labels, and similarly weighted actions. A low-confidence owner must study the whole screen to know the next safe action.  
**Example:** At pickup, a host sees several panels but is unsure whether to sign, photograph, confirm documents, or start first.  
**Required correction:** Put one clear "next required action" at the top, group secondary records below, and use a simple booking timeline.

#### DL-134 - Booking states are product language, not customer language

**Level:** HIGH  
**Who:** Renters, hosts, and support  
**Problem:** Terms such as pending, confirmed, active, completed, disputed, settlement, and payment pending do not always explain who must act next or whether the vehicle is reserved.  
**Example:** A renter sees "confirmed" but does not know whether the agreement, fee, or pickup checks are still outstanding.  
**Required correction:** Pair every status with a plain sentence: "Waiting for the Rental Page," "Reserved - sign before pickup," or "Vehicle returned - deposit still open."

#### DL-135 - There is no saved/shortlist journey

**Level:** MEDIUM  
**Who:** Renters comparing several cars  
**Problem:** Saved vehicles are planned but not built as a complete feature. There is also no strong recently viewed recovery after the modal closes.  
**Example:** A renter compares five cars over two days and must rediscover each listing.  
**Required correction:** Add a private shortlist and recent history after core booking safety is fixed.

#### DL-136 - "Nearby" is a promise without a location-aware product

**Level:** MEDIUM  
**Who:** Mobile renters and tourists  
**Problem:** DriveLink does not have a complete geolocation/radius journey for genuinely nearby vehicles, pickup branches, or delivery distance.  
**Example:** A visitor in Negombo sees "Colombo" cars without knowing actual distance or delivery cost.  
**Required correction:** Use explicit pickup areas first; later add opt-in distance search with accurate delivery rules.

### H. Casons opportunity and enterprise reality

#### DL-137 - No enterprise provider mode exists

**Level:** HIGH  
**Who:** Casons and other large fleets  
**Problem:** Pages are personal or business; there is no enterprise integration mode with a limited DriveLink operational footprint.  
**Example:** A 500-car provider is asked to behave like a five-car host.  
**Required correction:** Treat enterprise as a capability/integration contract, not only a marketing badge.

#### DL-138 - No integration layer exists

**Level:** HIGH  
**Who:** Enterprise fleets  
**Problem:** There are no provider API keys, webhooks, signed feeds, CSV import/export workflow, iCal, availability feeds, or booking handoff contract.  
**Example:** Casons must re-enter every accepted booking into its ERP.  
**Required correction:** Discover their actual system first, then build the smallest generic handoff/feed needed by the pilot.

#### DL-139 - Category inventory is not supported

**Level:** HIGH  
**Who:** Large fleets  
**Problem:** DriveLink books exact vehicles with individual calendars. It cannot sell "Toyota Axio or similar, quantity 8" and assign the exact plate later.  
**Example:** A company maintains 40 near-identical car calendars instead of one category pool.  
**Required correction:** Add category product, quantity-by-time, substitution rules, and final vehicle assignment.

#### DL-140 - No alternative-offer workflow exists

**Level:** HIGH  
**Who:** Renters and fleet desks  
**Problem:** Providers can accept or reject but cannot formally offer a different category, exact car, price, or time for renter approval.  
**Example:** The requested Axio is unavailable but a Prius is available; the discussion moves off-platform.  
**Required correction:** Add a versioned alternative quote that the renter can accept or decline.

#### DL-141 - Branch and staff operations are missing

**Level:** HIGH  
**Who:** Medium/large providers  
**Problem:** There are no branch inventories, operating hours, branch contacts, branch roles, or branch-specific pickup/return.  
**Example:** A Colombo booking appears to Kandy staff with no ownership assignment.  
**Required correction:** Add branches only after pilot discovery confirms the required model.

#### DL-142 - Drivers are a listing option, not an operational resource

**Level:** HIGH  
**Who:** Chauffeur businesses/customers  
**Problem:** There is no driver profile, licence/employment check, schedule, assignment, replacement, duty hours, trip status, or driver contact control.  
**Example:** Two confirmed bookings are assigned to the same driver manually.  
**Required correction:** Build driver operations or clearly position DriveLink as request handoff only.

#### DL-143 - Corporate rental workflows are absent

**Level:** MEDIUM  
**Who:** Enterprise customers/providers  
**Problem:** No company account, authorised bookers, cost centre, purchase order, monthly billing, approved drivers, or contract rates exist.  
**Example:** An office administrator cannot book for an employee under a company agreement.  
**Required correction:** Keep this out of launch claims and discover requirements with real corporate users.

#### DL-144 - Roadside/recovery services have no neutral platform model

**Level:** HIGH  
**Who:** Renters, private hosts, service providers  
**Problem:** The strategy mentions mechanics, carrier trucks, recovery, and replacements, but there is no service-provider account, dispatch, coverage, quote, SLA, or data-sharing control.  
**Example:** A competing rental company may not want incident/customer data automatically sent to Casons.  
**Required correction:** Start with explicit contracted handoff and consent; later build a neutral multi-partner dispatch network.

#### DL-145 - Service badges are not backed by service agreements

**Level:** HIGH  
**Who:** Renters  
**Problem:** Future labels such as 24/7 assistance, carrier recovery, replacement vehicle, or DriveLink Assured need proof, geography, hours, price, and an accountable fulfiller.  
**Example:** A private owner ticks "replacement available" but cannot deliver one on a Poya-day night.  
**Required correction:** Define evidence, renewal, limitations, and enforcement before showing each badge.

#### DL-146 - "Professional/English-speaking driver" can be unverified copy

**Level:** HIGH  
**Who:** Tourists  
**Problem:** Chauffeur marketing can imply driver qualities that DriveLink does not currently check.  
**Example:** A traveller chooses the service expecting English fluency and professional credentials.  
**Required correction:** Use provider-declared wording until individual driver checks/attributes exist.

#### DL-147 - DriveLink should not redesign around one unconfirmed partner

**Level:** MEDIUM  
**Who:** The company's strategy  
**Problem:** Building a deep Casons-specific system before Zakir confirms a real problem risks months of unused work and dependency on a competitor.  
**Example:** DriveLink builds a custom API only to learn Casons prefers email handoff or will not share availability.  
**Required correction:** Advice meeting, product demo, one problem, small pilot, then generic integration based on evidence.

#### DL-148 - Concentration controls are not represented in the product

**Level:** MEDIUM  
**Who:** DriveLink business continuity  
**Problem:** There are no operating measures for inventory share, partner dependency, feed failure, or replacement supply if one anchor provider leaves.  
**Example:** Most bookable stock disappears when one feed is paused.  
**Required correction:** Track provider concentration and continue independent small-provider onboarding.

### I. Additional cross-flow gaps

#### DL-149 - Owner cancellation strikes are not a complete working system

**Level:** HIGH  
**Who:** Renters  
**Problem:** The blueprint calls for penalties and a recent-cancellation signal when a provider cancels late or does not appear. No dependable end-to-end strike, appeal, expiry, and ranking process was confirmed.  
**Example:** A page cancels the day before travel several times but looks as reliable as a page that never cancels.  
**Required correction:** Define fault, notice period, evidence, emergencies, appeal, expiry, public wording, and ranking effect before adding automatic punishment.

#### DL-150 - Page deletion checks can overlook disputed rentals

**Level:** STOP  
**Who:** Renters, providers, and admin  
**Problem:** One page-deletion safety check focuses on active bookings but does not include disputed state. A page with an unresolved case may therefore be treated as safe to delete.  
**Example:** A provider tries to delete its page while a renter is disputing damage and deposit return.  
**Required correction:** Block deletion/transfer while any booking, claim, charge, deposit, report, or legal hold remains open.

#### DL-151 - Required inspection photos are not proof that the photos are genuine

**Level:** HIGH  
**Who:** Both rental parties  
**Problem:** The system can require image slots but does not prove the image is current, belongs to the listed vehicle, shows the required angle, or is not an old screenshot.  
**Example:** A provider uploads yesterday's clean-car photos for today's damaged pickup.  
**Required correction:** Add guided live capture where practical, visible booking/time watermark, plate prompt, quality checks, and a renter difference path. Do not market this as fraud-proof.

#### DL-152 - A provider can start the rental too early

**Level:** HIGH  
**Who:** Renters and availability planning  
**Problem:** The start action can be allowed around 24 hours before the planned pickup. That is a large window and can make availability, reminders, agreement timing, and insurance records inaccurate.  
**Example:** Staff starts tomorrow's booking today simply to clear a dashboard task.  
**Required correction:** Use a short configurable handover window and require an explicit corrected pickup time if plans changed.

#### DL-153 - Consent revocation rules differ between the screen and server

**Level:** HIGH  
**Who:** Renters  
**Problem:** The screen only offers revoke during the active rental, while the server accepts revocation in additional earlier booking states. The user can be denied a control the system actually supports.  
**Example:** A renter consented after acceptance, changed their mind before pickup, but cannot find a revoke button.  
**Required correction:** Display revoke whenever legally/operationally allowed and explain what already-accessed records cannot be recalled.

#### DL-154 - Disputed status can hide the inspection response that caused the dispute

**Level:** STOP  
**Who:** Renters  
**Problem:** Some inspection review panels are shown only for active/completed bookings. Moving into disputed state can hide the very accept/report-difference action needed to record the renter's position.  
**Example:** The renter opens a dispute over return damage, then can no longer acknowledge the return photos in the normal panel.  
**Required correction:** Make actions depend on the open task, not a broad status label; preserve inspection response in disputed state.

#### DL-155 - Competing booking notifications can duplicate or name the wrong outcome

**Level:** HIGH  
**Who:** Renters requesting the same dates  
**Problem:** When one request wins, other requests are found and notified through time-based follow-up logic. Retries/races can duplicate notices or describe a decline that does not match the final record.  
**Example:** A renter receives both "still pending" and "declined because another booking was accepted."  
**Required correction:** Create one recorded outcome event per affected booking and send repeat-safe notifications from that event.

#### DL-156 - The dispute wording can improperly delay urgent outside help

**Level:** STOP  
**Who:** Both parties in accidents, theft, or threats  
**Problem:** Agreement/guide wording around mediation before police action can be read as requiring DriveLink's process first. Urgent crimes, safety issues, and insurer reporting must not wait for platform mediation.  
**Example:** An owner delays contacting police about a missing vehicle because the agreement says to resolve through DriveLink first.  
**Required correction:** Clearly preserve immediate police, emergency, insurer, and legal rights; have a Sri Lankan lawyer approve the wording.

#### DL-157 - Wear-and-damage rules are educational text, not enforced terms

**Level:** HIGH  
**Who:** Renters and providers  
**Problem:** The wear guide describes cleaning, refuelling, loss-of-hire, estimate, and other limits, but the charge system does not calculate or enforce them.  
**Example:** The guide says one cap while a provider enters a larger open "other" charge.  
**Required correction:** Convert each promised rule into a structured term and charge check, or remove the number from the promise.

#### DL-158 - General reporting is not yet the promised platform-wide system

**Level:** HIGH  
**Who:** Renters, providers, and admin  
**Problem:** Some listing/renter reporting exists, but accounts, pages, listings, categories, evidence, status, notification, and appeal do not form one consistent system. Public Rental Pages also lack an obvious report action.  
**Example:** A renter sees misleading business credentials but can only report an individual vehicle or contact support manually.  
**Required correction:** Build one factual report flow with target type, category, evidence, safety urgency, status, response, and appeal.

#### DL-159 - Important account-security controls are still deferred

**Level:** HIGH  
**Who:** Page owners and staff with customer data  
**Problem:** There is no mature two-step sign-in option, login activity view, session/device management, or blocked-user control. These are more important once accounts can access NIC/licence files and transfer pages.  
**Example:** A former employee keeps a session on a personal phone and the owner cannot see or revoke that device.  
**Required correction:** Add session visibility/revocation and stronger authentication before scaling team/document access.

#### DL-160 - Expired OTP and temporary security records lack a proven cleanup job

**Level:** MEDIUM  
**Who:** Platform privacy/operations  
**Problem:** Records may stop working after expiry but no dependable recurring deletion/retention process was confirmed for all temporary authentication material.  
**Example:** Old OTP request metadata accumulates long after it is useful.  
**Required correction:** Set a documented retention period, delete on schedule, monitor the job, and include it in the Privacy Policy.

---

## 7. Blueprint and Casons plan: built, partial, or missing

| Capability | Current reality | Meaning |
|---|---|---|
| One personal account | **Mostly built** | Universal account exists, but provider intent and CTAs are inconsistent. |
| Unlimited Rental Pages | **Contradicted** | Multi-page exists, capped at five. |
| Personal and business pages | **Built, weak proof** | Both exist; verification meaning needs tightening. |
| Page switching | **Built** | Needs broader scenario/usability testing. |
| Page reviews only | **Partial** | Public page reviews exist, but person-level rating data still affects public behaviour and old renter reviews remain exposed. |
| Staged vehicle verification | **Partial** | Basic listing/admin review exists; Verified Vehicle completion path/expiry is not dependable. |
| Secure consent-based documents | **Partial, unsafe gaps** | Consent/viewer exists; exact-booking binding, logging, file handling, staff access, caching, and claims are not sufficient. |
| Mandatory pickup and return | **Partial** | Forms exist; two-sided acknowledgement and completion gating are broken. |
| Digital agreement | **Partial** | Snapshot/PDF/signatures exist; mode, required facts, immutable artifact, and state gating need work. |
| Booking Documents | **Partial** | Several documents are assembled, but privacy/storage/evidence completeness are weak. |
| Damage claims and disputes | **Partial** | Incident/status paths exist; dedicated case handling, deadlines, evidence, and settlement links are incomplete. |
| Direct rental/deposit payment | **Partial and contradicted by old fees** | Some UI follows direct payment, but owner fees/invoices/slips remain. |
| Fixed renter confirmation fee later | **Not cleanly implemented** | Old booking-fee settings exist, but policy/state/refunds/source of truth are unfinished. |
| In-app booking messages | **Built, incomplete** | Text chat exists; lifecycle, attachments, history, and contact-gate issues remain. |
| Tourist permit declaration | **Partial** | A self-declared boolean exists; permit type/verification/handover check do not. |
| Insurance badge/filter | **Partial, high-risk wording** | Type/filter exist; expiry, proof, pagination, and copy need correction. |
| Late-return ladder | **Partial** | Reminders/critical logic exist; extensions, unreachable proof, charges, and evidence pack do not form the promised ladder. |
| Owner cancellation strikes | **Missing or not complete** | No reliable visible strike/ranking system was confirmed end to end. |
| Terms Engine | **Partial** | Structured fields exist; enforcement, defaults, claim windows, and quote/agreement consistency are incomplete. |
| Reporting + appeal | **Partial** | Reports/admin action exist; renter notice and appeal are missing. |
| Saved vehicles | **Missing** | Not present as a complete journey. |
| Enterprise provider mode | **Missing** | No integration-only operating mode. |
| Category inventory | **Missing** | Exact vehicle model only. |
| API/feed/webhook/CSV handoff | **Missing** | Enterprise provider integration layer is not built. |
| Branches and granular staff roles | **Missing** | Broad team access only. |
| Driver assignment | **Missing** | Chauffeur option is not driver operations. |
| Roadside/recovery network | **Missing** | Strategy only; no neutral dispatch/service model. |
| Sinhala/Tamil | **Missing** | English-only product. |
| Strong automated permission/journey tests | **Missing** | Existing test approach is stale and potentially dangerous. |

---

## 8. Things that do not make sense together

These contradictions should be treated as product bugs, not "just wording." People make decisions based on them.

| Claim or screen A | Conflicting reality or screen B | Result |
|---|---|---|
| "Listings/free platform fee" | Provider dashboard and database create Rs. 200 completed-booking debt | Provider trust and accounting risk |
| Future page success fee | Founder's final renter fixed confirmation fee | No clear commercial contract |
| "Create Rental Page" for logged-in user | Goes to sign-up | Broken conversion |
| "Every listing document-checked" | Basic documents are optional | False trust impression |
| "Verified Vehicle" reward | No clear awarding path | Provider confusion and false badge architecture |
| "Fully covered" | Insurance can have excess/exclusions; private cover may reject rental | Financial/legal danger |
| "Every view logged" | Direct file responses are not necessarily logged | Privacy promise broken |
| "In-app only" | Files can be saved/screenshot/cached | False security expectation |
| Renter must confirm inspections | Provider can start/complete without it | Dispute evidence weakened |
| 72-hour damage window | Charges can be added more broadly; fines say 30 days | No enforceable deadline truth |
| Chat closes at completion | Claims/deposit can remain open after completion | Parties lose their case channel |
| "One account, unlimited pages" | Five-page cap | Blueprint mismatch |
| "Page reviews only" | Person rating data remains public/in ranking | Privacy/product contradiction |
| FAQ says add flight details to notes | Booking form has no notes | Impossible instruction |
| "Tourist-ready" | Permit only self-declared; insurance wording/expiry weak | Overclaim |
| "No marketing/no sharing" | Contact and vendors are used for booking/notifications | Consent confusion |
| Terms say irreversible deletion | Product offers restoration period | Legal/data mismatch |
| Terms require documents before listing | Basic staged listing says optional | Onboarding contradiction |
| "No unlisted charges" | Provider can add broad "other" charge | Consumer dispute risk |
| Platform will report to police | Code alerts/provides material; owner must report | Dangerous emergency expectation |
| Accident guide implies replacement/towing outcomes | Private hosts may offer neither | Service overpromise |

---

## 9. Priority repair plan

### Stage 0 - Stop normal launch until these are fixed

1. Fix home, direct vehicle links, SEO inventory pages, and sitemap truth.
2. Remove the Rs. 200 provider fee trigger, dashboards, invoices, slips, bank-payment wording, and deletion blocks tied to old provider fees.
3. Publish the one approved payment explanation and make one fee setting the source of truth.
4. Correct document authorisation, per-response logging, watermark fail-closed behaviour, service-worker caching, staff permissions, private evidence storage, and Android backup.
5. Prevent starting before agreement/pickup confirmation and prevent completion before return/deposit/charge/dispute closure.
6. Restrict settlement/charges to the correct stage; add proof, caps, deadlines, and item-level renter response.
7. Make booking/dispute/admin transitions all-or-nothing and race-safe.
8. Add true licence validation and enforce age/licence experience/foreign permit rules.
9. Remove unsafe "verified," "fully covered," "tourist-ready," "every view logged," and "DriveLink will report" claims until supported.
10. Add global security headers, update vulnerable packages, and create safe release monitoring.
11. Replace unsafe production-connected tests with an isolated test environment and permission tests.
12. Ensure the cron worker deploys and reports health with every release.

### Stage 1 - Before a supervised public pilot

1. Make provider sign-up intent and all Create Rental Page buttons consistent.
2. Complete a real Verified Vehicle path with expiry and re-review after trust-sensitive edits.
3. Fix quote totals for weekly, monthly, delivery, chauffeur, late, mileage, fuel, and deposit terms.
4. Add mode-specific booking details: flight, addresses, passengers, luggage, itinerary, notes.
5. Create a dedicated dispute case screen and complete evidence pack.
6. Keep messages/contact available through post-return resolution; add safe attachments and history.
7. Add staff invitations and limited roles.
8. Make account transfer/deletion require fresh verification and reliable all-or-nothing processing.
9. Add Sinhala/Tamil summaries for all safety-critical steps.
10. Clean production demo data and confirm every live listing/review.
11. Add accessible dialogs, readable text, focus, and mobile/keyboard tests.
12. Update Privacy, Terms, insurance, accident, permit, refund, and retention wording after legal review.

### Stage 2 - Pilot learning and product fit

1. Run a two-account end-to-end booking using real-sized but non-sensitive test documents.
2. Run at least one private-host self-drive case, one small-business case, one chauffeur case, and one tourist case.
3. Test clean return, late return, damage dispute, partial deposit return, provider cancellation, renter cancellation, and failed notification.
4. Observe low-digital-fluency users in Sinhala/Tamil/English; do not coach them until they get stuck.
5. Measure request-to-provider-reply, acceptance, no-show, cancellation, off-platform leakage, and support time.
6. Meet Zakir/Casons for discovery and choose one controlled handoff problem; do not build a full enterprise ERP.

### Stage 3 - After repeatable small-provider bookings

1. Build generic enterprise category inventory and alternative offers if the pilot proves demand.
2. Add signed webhooks/feed/API or simple email/WhatsApp handoff based on partner reality.
3. Add branches, roles, driver assignment, and corporate accounts only from confirmed workflows.
4. Create a neutral roadside/recovery provider model with consent and service-level contracts.
5. Turn on the fixed renter confirmation fee only after company registration, gateway approval, receipts, refunds, support, accounting, and failure tests are ready.
6. Add optional labelled boosts after inventory is large enough for discovery competition to exist.

---

## 10. Acceptance scenarios before calling the platform launch-ready

Each scenario must be tested on desktop and a normal Android-sized screen. Where relevant, repeat in English, Sinhala, and Tamil.

### Public discovery

- Home count, search count, SEO count, provider fleet count, and admin publication state agree.
- Every live vehicle opens by click, new tab, refresh, WhatsApp share, and Google-style direct address.
- Every sitemap address returns the intended public content.
- A database failure shows a retry state and triggers an alert, not "no cars."
- Filters remain applied through Load more and shared links.

### Account and provider creation

- Logged-out List Vehicle preserves provider intent through OTP into page creation.
- Logged-in Create Rental Page never opens sign-up.
- Duplicate/international phone-number cases cannot collide.
- OTP parallel requests do not exceed limits.
- Failed email/SMS is shown as failed and retried/escalated truthfully.

### Listing and verification

- Basic listing can publish only with the exact Basic claim.
- Verified Vehicle cannot appear until all required evidence passes.
- Expired insurance removes the related badge/filter eligibility.
- Changing plate, vehicle identity, photos, insurance, or critical terms causes re-review.
- Paused/blocked/unverified/deleted pages cannot appear or accept bookings.

### Booking and quote

- Daily, weekly, monthly, delivery, chauffeur, mileage, late, fuel, deposit, and taxes/fees total correctly.
- Same-day, invalid-date, midnight, overlapping, and turnaround cases behave consistently.
- Age, licence years, licence expiry/class, foreign status, and permit type are enforced before sensitive upload/request.
- Booker, payer, renter, and driver can be correctly distinguished.
- Provider alternative offer creates a new renter-approved quote, not a hidden edit.

### Payment truth

- With fee set to Rs. 0, provider acceptance confirms immediately and no payment screen appears.
- No provider fee, invoice, outstanding amount, bank slip, payout, or Rs. 200 balance is created.
- With a test future fee, acceptance waits for gateway success and the fixed amount is frozen.
- Provider cancellation, renter cancellation, expiry, duplicate payment, failed payment, refund, and chargeback all have tested outcomes.
- Rental/deposit money is never described as held by DriveLink.

### Documents and agreement

- Page B cannot see Page A's renter documents, even if the same owner/staff knows the URL.
- One booking's consent cannot authorise another booking.
- Every successful and denied file request is logged with the real staff viewer.
- PDF/WebP/HEIC/unsupported files never fall back to a clean original.
- Sensitive files are unavailable offline and absent from service-worker/mobile backups.
- Both sides sign the correct mode-specific immutable agreement before pickup.
- Failed snapshot/PDF/email produces a visible recovery state, never silent success.

### Pickup, active rental, and return

- Car cannot start until required agreement, document, original-licence/permit, plate, photo, odometer, fuel, and renter acknowledgement checks pass.
- Renter can report a pickup difference before start.
- Extension changes price/time/availability only after both sides accept.
- Return stays pending until renter accepts or disputes, or a clear timed admin rule applies.
- Completion cannot hide an open deposit, charge, message, claim, or dispute.

### Dispute and emergency

- Each charge has formula/evidence/deadline and can be accepted or rejected separately.
- Payment/return of deposit and extras has two-sided proof.
- Only one active dispute is created on retry/double-click.
- Admin sees every fact in one chronological case and must decide all open items.
- Evidence pack works with many real-sized files and includes agreement, inspections, messages, incidents, charges, consent, views, deposit, decisions, and hashes.
- No-return critical action requires real overdue/unreachable/extension checks and produces correct owner guidance.
- A reported renter receives fair notice and can respond/appeal before lasting platform consequences, subject to lawyer-approved urgent-safety exceptions.

### Enterprise pilot

- A partner can accept, reject, or offer an alternative without double-entering its fleet.
- Category quantity cannot be overbooked.
- Exact assigned vehicle and driver are recorded before handover.
- Competitor-sensitive incident/customer data is not shared with a roadside partner without authority and consent.
- Feed failure removes/stales inventory safely and alerts both organisations.

---

## 11. Recommended product wording

These are examples for clarity, not final lawyer-approved text.

### Home trust line

**Avoid:** "Every car is verified and fully covered."  
**Prefer:** "See what DriveLink checked on each listing. Vehicle identity, business status, insurance evidence, and service support are shown as separate badges."

### Basic listing

> "Basic listing: DriveLink reviewed the listing content and account. Vehicle ownership and hire-insurance documents may not have been verified. Check the badges and agreement before booking."

### Insurance

> "The provider states this vehicle has insurance for rental/hire use. Insurance can include excess, exclusions, driver rules, and claim conditions. Ask to see the relevant policy details before driving. DriveLink does not provide or guarantee insurance cover."

### Private insurance

> "Warning: This vehicle is marked as privately insured. A private policy may not cover paid self-drive rental use. Do not assume a crash claim will be accepted. Confirm suitable cover with the provider/insurer before booking."

### Booking request

> "This sends a request; it does not reserve the vehicle yet. The Rental Page must accept. DriveLink will show when the booking becomes confirmed."

### Document sharing

> "After you consent, authorised staff from this Rental Page may view the selected documents for this booking. DriveLink adds a traceable watermark and records server access. Screenshots cannot be completely prevented. You can see access history and revoke future access while the purpose remains open, subject to legal record-retention rules."

### Payment

> "Listings are always free. DriveLink's booking confirmation fee is Rs. 0 during launch. Rental charges and deposits are paid directly to the Rental Page. DriveLink does not hold that money."

### Emergency evidence

> "DriveLink can organise the booking records into an evidence pack. The provider remains responsible for contacting the police, insurer, and legal adviser. DriveLink does not promise that an authority will accept the pack or decide the matter in either party's favour."

---

## 12. Evidence and code areas reviewed

This section is included so a developer can find the relevant areas without making the main report technical.

- Public search/detail/site map: `src/app/(marketplace)/vehicles`, `src/components/vehicles`, `src/lib/vehicles/search.ts`, `src/app/sitemap.ts`, public search migrations.
- Accounts/OTP/deletion: account/auth API routes, `src/app/api/account/delete/route.ts`, account pages and notification helpers.
- Pages/team/transfer: `src/app/api/pages`, `src/app/(dashboard)`, migration `081_agency_members.sql` and related page rules.
- Listing documents/moderation: vehicle create/edit/admin routes, migrations `040_vehicle_documents.sql`, `050_vehicle_terms_engine.sql`, `058_lock_vehicle_columns.sql`.
- Bookings/pricing/states: `src/app/api/bookings`, `src/lib/bookings/pricing.ts`, `src/lib/booking/state-machine.ts`, booking components.
- Agreement/evidence: `src/lib/booking/agreement-*`, `src/lib/booking/evidence-pack.ts`, agreement/evidence API routes.
- Consent/documents: `src/app/api/docs`, booking consent route, `src/components/documents/WatermarkedImage.tsx`, account document history.
- Inspections/charges/disputes: inspection, settlement, charge, dispute, returned, transition, report-renter routes and components; migrations `068_charge_ledger.sql` onward.
- Messaging/support/notifications: booking message routes/components, support pages, notification cascade helpers, migrations `054_booking_messages.sql`, `079_renter_support.sql`.
- Background/mobile: cron routes/worker/deploy scripts, `public/sw.js`, `android/app/src/main/AndroidManifest.xml`, stale deployment configuration.
- Payments: migration `025` completed-booking fee trigger, fee/platform settings, dashboard analytics, admin fee/invoice/slip screens, pricing and Terms.
- Quality/security: `package.json`, build/type-check/lint scripts, end-to-end scripts, live response headers, dependency audit.

---

## 13. Final decision summary

DriveLink's strongest defensible idea is not "we have cars" and not a broad "verified marketplace" slogan. Other rental sites can show inventory and collect a request.

The stronger position is:

> **DriveLink makes the risky parts of a Sri Lankan rental clear and recordable: who the parties are, what was promised, what documents were consented to, what the car looked like at pickup and return, what money stayed direct between the parties, and what evidence exists if something goes wrong.**

That position will be credible only when the system refuses to skip those steps and the copy describes exactly what was checked.

The Casons opportunity is valuable as access to real operating knowledge, a possible controlled pilot, and perhaps a future distribution/service partnership. It is not yet a reason to call DriveLink enterprise-ready or to design the entire platform around one company.

The immediate goal should be narrower and stronger:

1. Make one private-host and one small-company booking work truthfully from search to fully closed return.
2. Protect identity documents and evidence as carefully as the marketing promises.
3. Remove every trace of the old provider-fee model.
4. Explain rental, insurance, deposits, permits, and responsibilities in language an 18-year-old first-time renter can understand.
5. Only then expand into enterprise feeds, roadside partners, paid confirmation fees, and boosts.

---

## 14. Relationship to the earlier July audit

The July bug-and-gap report was used as a baseline, but findings were not copied blindly. Several older items have been improved, including parts of page pausing, phone re-verification, page-based reviews, booking messages, agreement hashing, terms fields, and charge records. This report focuses on what is still observable in the current code/live platform, what has regressed, and what the newer Rental Pages/Casons/payment decisions add.

The existence of a screen or database column was not counted as "finished." A feature was treated as complete only when its normal path, failure path, permissions, wording, reminders, evidence, and end state made sense together.

---

## 15. Remediation log

This section records fixes only after they have been reproduced, corrected, deployed, and checked again on `drivelink.lk`.

### Fix 1 - Public vehicle discovery and direct links - deployed 9 August 2026

**Audit findings addressed:** DL-001, DL-002, DL-003. The broken/empty-page part of DL-004 is also resolved; sitemap scaling and Rental Page inclusion remain open.

**Re-verification before editing:**

- Homepage said no vehicles were listed.
- `/vehicles` showed 17 vehicles.
- The Toyota Aqua direct address returned 404.
- The self-drive Sri Lanka page showed zero options.
- Toyota Colombo showed no vehicles.
- A broad anonymous vehicle-table request failed with database error `42501`, while an explicit safe-column request succeeded.

**Confirmed cause:** Several public pages asked Supabase for every vehicle column. A later private moderation column was intentionally not available to anonymous users, so Supabase rejected the whole request. The screens hid that error as an empty list or 404.

**Additional serious issue found during repair:** The working public search function returned every database vehicle column through a privileged function. Its public JSON therefore contained fields named VIN, engine number, rejection reason, and page-pause time. The sampled VIN/engine values were empty, but the fields must never have been exposed. Anonymous users could also directly request real plate numbers because plate number was in the old public column grant.

**Correction deployed:**

- Home, curated Sri Lanka pages, and model/city pages now use the same working public search service.
- Direct vehicle pages use an explicit public field list instead of "all columns."
- The database search function now has a fixed public return shape. Future private columns are not automatically exposed.
- VIN, engine number, rejection reason, and pause metadata are absent from public search responses.
- Public search returns a blank plate value; direct anonymous plate-number table requests are denied.
- A repeatable `npm run verify:public-vehicles` check now tests this privacy and inventory contract.

**Production proof after deployment:**

- Homepage: six featured vehicles displayed.
- Toyota Aqua direct page: opened successfully with photos, terms, provider, reviews, and booking form.
- Self-drive Sri Lanka page: nine matching options displayed.
- Toyota Colombo page: four matching vehicles displayed.
- Public vehicle verifier: passed.
- Direct anonymous plate request: denied with `42501`.

**Status:** Fixed and deployed. Signed-in access to owner-only vehicle fields will receive a separate permission audit before being marked safe.

### Fix 2 - Search failures and insurance pagination - deployed 9 August 2026

**Audit findings addressed:** DL-005 and DL-007.

**Re-verification before editing:**

- The shared search function read only the returned data and ignored Supabase's error value. A failed search therefore became an empty array.
- Rental Page hydration also ignored its error value.
- The Load more component caught a failed request, silently removed the Load more control, and showed no retry message.
- The first-page search passed `insurance=hire`, but the parameters given to Load more omitted `insurance`.

**Correction deployed:**

- Database search and Rental Page lookup errors now fail explicitly instead of pretending there are no vehicles.
- A real missing vehicle still produces 404, while an unexpected database failure produces an application error rather than a false "listing removed" message.
- Load more checks HTTP success and shows a clear retry action when the request fails.
- Load more keeps the active insurance filter.
- The production verifier checks that a hire-insurance API search contains no private-insurance vehicle.

**Production proof after deployment:**

- Normal public vehicle verification passed.
- The live `insurance=hire` search displayed 15 vehicles.
- All 15 visible results were labelled Hire Insurance; no Private (P-Number) result appeared.
- The filter remained visibly selected.

**Status:** Fixed and deployed. A forced browser-network-failure test should be added to the future isolated end-to-end suite so the retry screen is exercised automatically.

### Fix 3 - Final launch payment model and retired fee machinery - deployed 9 August 2026

**Audit findings addressed:** DL-019, DL-057, DL-059, DL-060, and DL-061. DL-058 is corrected below because its original statement about the live database was inaccurate. DL-062 remains deliberately open because a paid confirmation fee must not launch before its gateway and refund rules exist.

**Re-verification before editing:**

- Production contained 15 bookings: 13 completed, one confirmed, and one waiting for provider confirmation.
- Every one of those bookings had a Rs. 0 DriveLink booking fee.
- Every one had a Rs. 0 provider fee, no provider fee had been marked collected, and no booking was in payment review.
- Production had no active `trg_booking_completed_fee` trigger and no `on_booking_completed_set_fee` function.
- The booking table still had an unsafe Rs. 500 default from the historical payment migration.
- The provider analytics screen still said providers owed Rs. 200 per completed booking.
- Provider account deletion still checked for unpaid DriveLink fees.
- Admin still contained provider invoices, a bank-slip queue, platform bank details, a fee switch, and manual collection actions.
- The renter booking page still contained a hidden bank-transfer, payment-expiry, and slip-upload journey that could be revived by changing one setting.
- Pricing and Terms still promised a future provider success fee, contradicting the founder's final renter-only fixed confirmation fee.
- The platform bank-account settings table was readable to anonymous and ordinary signed-in visitors because it belonged to the old manual-transfer journey.

**Important correction to the original audit:**

DL-058 said the live database still created a Rs. 200 provider fee. That was not true at the time of the repair. The old migration file still defined that trigger, and the UI behaved as if provider debt existed, but the production trigger had already been removed and no provider had a balance. The correct finding was a serious replay/default/UI risk, not an active production charge. No provider balance needed to be erased.

**Correction deployed:**

- The database default for new booking confirmation fees is now Rs. 0.
- Three database rules reject any nonzero launch booking fee, provider fee, or provider-fee collection timestamp.
- The old provider-fee trigger/function are explicitly removed by a new migration so a fresh or replayed environment cannot inherit the Rs. 200 charge.
- Booking creation snapshots Rs. 0 from a versioned code constant. An admin cannot turn on payment collection from a settings screen.
- The manual renter bank-transfer, slip upload, 12-hour payment cancellation, admin slip review, provider invoice, and fee-collected actions are retired. Their old API addresses return HTTP 410 and cannot change a booking.
- Provider analytics now shows rental value paid directly to the provider and clearly states that DriveLink charges the Rental Page Rs. 0.
- Admin analytics now reports a Rs. 0 confirmation fee and distinguishes provider rental value from DriveLink revenue.
- Provider deletion no longer checks or invents DriveLink fee debt.
- Pricing, Home, vehicle pages, booking forms, FAQ, Terms, Privacy, footer, support, SMS, and search-page wording now use one explanation: listing is free, provider commission is zero, the launch confirmation fee is Rs. 0, and rental/deposit money goes directly to the provider.
- After a gateway exists, the only planned platform charge described in the product is a separately shown small fixed renter booking confirmation fee.
- Anonymous and ordinary signed-in users can no longer read DriveLink platform bank details.
- Pricing and Home now send a signed-in user to `/account/pages/new`; signed-out visitors still go through signup.
- A repeatable `npm run verify:launch-payments` production check now verifies database rules, balances, privacy, live pricing copy, and retired endpoints.

**Production proof after deployment:**

- Current booking fee setting: Rs. 0.
- Nonzero renter booking fees: zero.
- Nonzero provider fees or collection records: zero.
- Bookings in legacy payment review: zero.
- Booking fee database default: 0.
- Old provider fee trigger: absent.
- All three launch fee constraints: present and active.
- Anonymous platform-settings access: denied.
- Anonymous and ordinary-user access to platform bank account number: denied.
- Live Pricing page: states "Launch booking confirmation fee: Rs. 0," listing free, no provider commission, direct rental payment, and the future fixed renter fee model.
- Live signed-in Pricing request: "Create a Rental Page" points to `/account/pages/new`, not signup. The temporary production test account was removed immediately after verification.
- Live Home page: shows inventory and the new launch-fee wording.
- All four retired payment/provider-fee endpoints: HTTP 410.
- Production build, TypeScript check, public vehicle privacy verifier, and launch payment verifier: passed.
- Cloudflare production version: `4a6d6f74-d859-4b77-9de9-7ca25c381b28`.

**Status:** Payment-model contradiction fixed and deployed. Future paid confirmation remains intentionally disabled. Before it can be enabled, DriveLink still needs business registration, a payment gateway, displayed checkout consent, receipts, and the refund/duplicate/chargeback/provider-cancellation policy in DL-062. The separate provider-intent continuation after OTP in DL-020 also remains open.

### Fix 4 - Booking-scoped identity documents and evidence storage - deployed 10 August 2026

**Audit findings addressed:** DL-064, DL-065, DL-066, DL-067, DL-068, DL-069, DL-070, DL-071, DL-072, DL-073, and DL-074. DL-072 is resolved for identity-document access; a broader set of staff roles is still open. DL-034, invitation acceptance, remains open and was not marked fixed.

**Re-verification before editing:**

- A Rental Page could use consent from one active booking to request the same renter's files through another booking context.
- The server returned the file before the screen wrote its view log. Opening the protected address directly could therefore leave no record.
- When watermarking failed or the file type was unsupported, the server could fall back to the clean original.
- The old visible overlay did not permanently contain the booking, Rental Page, named viewer, role, and time inside the image pixels.
- The installed web app treated `.jpg` document addresses like ordinary cacheable pictures.
- Android allowed app-data backup.
- The product said documents were view-only or not downloadable even though screenshots, another camera, and browser tools can never be completely prevented.
- Renter history showed a generic Rental Page manager instead of the person who opened the file, loaded an unbounded list, and did not clearly separate successful and blocked requests.
- Every staff member inherited identity-document access from general page access.
- Upload signing trusted the browser's file name, claimed type, and claimed size before giving back a usable storage address.
- New inspection and dispute photos were placed under long-lived public links.

**Correction deployed:**

- Identity-file requests now name one exact booking, one exact document, and one stated reason. The server checks that booking's renter, Rental Page, stage, consent, stored file, and viewer permission together.
- Owners can view documents. Staff are blocked by default and need a separate `Renter documents` permission controlled by the page owner. Permission changes are recorded.
- The viewer must choose a real reason before any file is requested. The screen also shows the renter, page, vehicle, booking reference, and rental dates so the scope is difficult to misunderstand.
- Each protected image can be opened at natural size in a full-screen, scrollable inspection view and closed with the familiar close control or Escape key.
- JPEG and PNG identity files are decoded on the server and returned as a fresh PNG with the booking reference, Rental Page, named viewer, role, UTC time, and `THIS BOOKING ONLY` burned into the pixels three times.
- A clean original is never returned to a Rental Page or admin when rendering or logging fails. The request fails closed.
- Every successfully served external identity image is logged before the bytes are returned. Attributable blocked attempts are also logged with the reason. If the log write fails, the file is withheld.
- Responses disable browser/CDN caching, block content sniffing and indexing, use same-origin protection, and sandbox documents that a browser can render.
- The renter history is now a newest-first, 25-row-per-page ledger with the actual viewer name and role, document, page, booking, purpose, time, and `Viewed` or `Blocked` outcome.
- Consent wording now names who may view which files and says honestly that screenshots or photographs cannot be fully prevented.
- New uploads first enter a private quarantine location. The server reads the real bytes, checks the signature, type, size, owner/booking path, and supported format, then promotes the file. A false PNG containing script text was rejected and deleted in testing.
- New booking inspection/dispute photos are private and tied to their exact booking. Production had no old booking-evidence URLs requiring a data move.
- The service worker never caches protected documents, agreements, or evidence packs and deletes its old image cache during the v6 upgrade.
- Android backup and device-transfer extraction are disabled for files, databases, preferences, and external app data.
- The provider document screen, renter history, consent panel, and team-permission controls were rebuilt around the real tasks and their empty, denied, ended, loading, failure, and success states.
- A self-cleaning `npm run verify:document-security` walkthrough creates temporary renter, owner, staff, outsider, page, vehicle, bookings, PNG/JPEG files, and logs, verifies the complete permission matrix, takes desktop/mobile screenshots, and removes everything afterward.

**Additional issues found during repair:**

- The first server-side image library made the Cloudflare Worker exceed the free-plan 3 MiB deployment limit. It was replaced with a compact pure-JavaScript JPEG/PNG renderer without weakening the burned-in watermark or fail-closed rules.
- The Next.js/OpenNext/Capacitor and Cloudflare toolchain was on patch releases with known advisories. Production dependencies were updated and now report zero known vulnerabilities. One moderate advisory remains in Capacitor's development-only iOS project generator because its proposed fix would be a conflicting downgrade; it does not ship in the website or Android app.
- Next.js was tracing from the wrong parent folder because another lockfile existed above DriveLink. The tracing root is now pinned to this project.

**Production proof after deployment:**

- Migration 085 is active, including separate staff document permission, permission-change history, named access logs, purpose, outcome, and denial reason.
- Local document-security walkthrough: 26 passed, 0 failed.
- Live `drivelink.lk` document-security walkthrough: 30 passed, 0 failed, including the enlarged inspection view and proof that all temporary database, authentication, and private-storage fixtures were removed.
- The production test covered a valid PNG, a real JPEG licence image, a disguised invalid image, exact-booking consent, consent borrowing rejection, owner access, staff denial, owner permission grant, outsider denial, direct-address logging, raster watermark bytes, no-cache headers, renter history, service-worker exclusion, and Android backup settings.
- Desktop provider view and mobile renter history were visually checked for readable hierarchy, text fit, responsive layout, and clear access states.
- TypeScript, the 91-route production build, OpenNext Cloudflare bundle, Android manifest build, repository whitespace check, public-vehicle privacy verifier, and launch-payment verifier passed.
- Production dependency audit: zero known runtime vulnerabilities.
- Cloudflare production version: `85d6df48-89ef-4e3e-92d6-0c50ef96cdee`.

**Status:** Fixed and deployed for booking-scoped identity-document access, secure new uploads, and new booking evidence. Team invitation acceptance (DL-034), finer non-document staff roles, and any future document export remain separate work and must be re-verified before implementation.

### Fix 5 - Safe vehicle handover, return closure, disputes, and scheduled jobs - deployed 10 August 2026

**Audit findings addressed:** DL-089, DL-090, DL-091, DL-092, DL-093, DL-094, DL-098, DL-100, DL-102, DL-112, and DL-119 are fixed for the current launch workflow. DL-095, DL-097, DL-103, and DL-120 are partly fixed as explained below. DL-096, DL-099, DL-101, DL-104, DL-105, and DL-106 remain open for the next claims and late-return phase.

**Re-verification before editing:**

- A Rental Page could start a rental after its pickup inspection without proving that both sides had signed, the renter had agreed with the pickup record, the original licence had been checked, or both sides had confirmed the deposit.
- The renter was only allowed to approve the pickup inspection after the rental became active. This made the intended safe order impossible: the provider had to start first, then ask the renter to approve what had already happened.
- A provider could complete an active booking after saving a return inspection even when the renter had not marked the vehicle returned, approved the return condition, confirmed the deposit outcome, or accepted the final balance.
- The scheduled job could automatically complete an active booking 24 hours after return time when only a return inspection existed. An unresolved difference could therefore be closed without both sides agreeing.
- The renter could accept a final settlement at unsuitable stages. Providers could also add or change extra charges after the rental was completed or disputed.
- Opening a dispute wrote the incident and booking status separately. If one write failed, DriveLink could show a disputed booking without a case, or a case without a disputed booking. Two simultaneous requests could also create duplicate open cases.
- Admin controls offered state changes that did not reflect a real rental journey, and an admin resolution could update the booking, incident, and activity history separately.
- Booking chat became read-only immediately after completion even though the stated claim period continued afterward.
- The normal deployment command published the main website but did not publish the small Cloudflare scheduled worker. There was also no database heartbeat proving that a job had recently run successfully.

**Correction deployed:**

- Starting a rental is now one protected action. It is refused until both sides sign the same agreement, the provider saves a complete pickup record, the number plate matches, the original licence/permit is checked for self-drive, the renter approves the pickup condition, and both sides confirm any security deposit.
- The renter can review and accept the pickup record while the booking is still confirmed, before the keys are handed over.
- Completing a rental is also one protected action. It is refused until the renter marks the vehicle returned, both sides agree with the return record, every open DriveLink case is resolved, both sides confirm the deposit return when a deposit was held, and the renter accepts the final settlement.
- The scheduled job no longer completes bookings. It only marks overdue stages, sends the existing reminders, counts rentals still awaiting closure, and performs its maintenance work.
- Settlement can only be accepted during return close-out. The charge list locks immediately afterward. Extra charges can only be prepared after return evidence exists, while the rental is still active, before settlement, and while no dispute is open.
- Inspection acceptance, deposit acknowledgements, dispute opening, dispute resolution, charge changes, settlement acceptance, and lifecycle changes now happen as indivisible database actions. A failure leaves the whole action unchanged instead of saving half of it.
- Only one unresolved dispute can exist for a booking. An admin can close a disputed booking as completed or cancelled only with a written resolution; the open case and booking close together.
- Admin controls no longer offer impossible active-rental jumps. Provider and admin actions use the same protected lifecycle rules.
- Booking chat remains available through the 72-hour post-completion claim window instead of closing the instant the booking completes.
- The provider and renter booking screens now show plain-language pickup and return checklists, steps remaining, the one next action, and a clear reason when Start, Complete, or Accept settlement is unavailable. The design was checked at 390-pixel phone width and 1440-pixel desktop width.
- New-renter cards no longer say the meaningless phrase `N/A reliable`, and the renter no longer sees a duplicate generic progress tracker after confirmation.
- Repeated inspection-photo URLs no longer create duplicate screen identities that can omit a thumbnail or trigger a browser error.
- The production service worker no longer runs during local development, preventing false offline-cache warnings and stale local screens.
- One release command now publishes both the main website and the separate scheduled worker. The scheduled job records start time, success time, error state, and useful counts in a private heartbeat record.

**Scenario examples after the correction:**

- **Unsigned agreement:** A provider presses Start rental while the renter has not signed. Nothing changes, and the screen explains that both sides must sign first.
- **Pickup disagreement:** The provider records a scratch-free pickup, but the renter reports a scratch. The booking becomes disputed instead of active, and the keys should not be handed over until the case is resolved.
- **Deposit mismatch:** The provider records receiving Rs. 25,000, but the renter has not confirmed paying it. Start remains locked.
- **Incomplete return:** The vehicle is physically back, but the renter has not reviewed the return photos. The booking remains active and awaiting closure; the scheduled job cannot silently mark it complete.
- **Last-minute extra fee:** A provider adds a fuel charge after return evidence. Once the renter accepts the settlement, the provider cannot add another charge or alter the balance.
- **Two dispute clicks:** Two requests arrive almost together. The first creates one case and changes the booking to disputed; the second is refused, so support does not receive duplicate cases.
- **Admin resolution:** An admin cannot simply jump an active rental to an unrelated status. For a disputed rental, the admin must write the resolution, and the case and booking close together.
- **Post-completion question:** A renter notices a problem the day after completion. The booking chat is still available within the 72-hour claim window.

**Production proof after deployment:**

- Database migration 086 is active.
- Lifecycle database walkthrough: 23 passed. It covered permissions, both signatures, pickup evidence, original licence check, renter approval, deposit confirmation, start, return, settlement, charge locking, completion, duplicate requests, dispute opening, duplicate-dispute prevention, and admin resolution. Its temporary data was rolled back.
- Production authenticated UI walkthrough: 17 passed. Provider desktop, provider phone, renter pickup phone, and renter return desktop screens had no browser errors or horizontal overflow; unavailable actions stayed locked for the correct reasons. Temporary users, Rental Page, vehicle, bookings, inspections, agreement, and charge were removed.
- Production cron safety walkthrough: seven passed. An unauthenticated call received 401, the authorised call succeeded, no booking status changed, and a current successful heartbeat was stored.
- Production booking totals remained unchanged after the cron run: 13 completed, one confirmed, and one pending confirmation.
- Public vehicle privacy, launch payment, and live document-security checks passed; document security completed 30 checks with no failures and removed every temporary record, user, and private file.
- Production Worker size: 2,991.63 KiB compressed, approximately 80 KiB below Cloudflare's 3 MiB free-plan limit. No paid Cloudflare upgrade or heavy runtime package was added.
- Main Cloudflare version: `cab5d00d-4fde-499a-a1f0-216e1ac0b220`.
- Scheduled-worker version: `cc00c9ca-107e-4f9a-9167-9b658d6ec3bc`.

**Still open:**

- The charge list is now stage-safe and race-safe, but DL-095 and DL-096 still need contract-based fee caps, required evidence, and item-by-item renter accept/dispute controls.
- Deposit and final-balance acknowledgements now block closure, but DL-097 still needs full two-sided payment method, receipt, payer, receiver, amount, and time evidence for every extra payment.
- The current product uses a 72-hour post-completion window in these workflows, but DL-099 still needs one written deadline table by claim type, visible countdowns, and enforced late-claim escalation across every page and legal document.
- DL-101 still needs a complete admin case workspace with evidence comparison and a decision checklist.
- Booking state changes are protected and atomic, but DL-103 still needs a durable notification queue so a successful state change cannot lose an SMS/email or send it twice during a retry.
- DL-104, DL-105, and DL-106 still need recorded contact attempts, extensions and grace rules, late-fee calculation from frozen terms, and the full police-ready critical evidence pack.
- Heartbeats prove that the scheduled job ran, but DL-120 remains partly open until an external monitor alerts a human when the heartbeat becomes late or a production walkthrough fails.

**Status:** The unsafe handover, premature completion, automatic closure, duplicate-dispute, impossible-admin-transition, immediate-chat-closure, and missing-cron-deployment problems are fixed and deployed. The deeper claims ledger, payment proof, late-return evidence, admin case desk, durable notification delivery, and external alerting remain deliberately open and must be re-verified before their next fixes.

### Fix 6 - Evidence-backed return charges, claim decisions, and direct-payment proof - deployed 10 August 2026

**Audit findings addressed:** DL-095, DL-096, DL-097, DL-099, and DL-101 are fixed for the launch workflow. This phase also fixed an additional deposit-calculation error and a missing payment path for admin-approved claims discovered during implementation. DL-103, DL-104, DL-105, DL-106, and DL-120 remain open.

**Re-verification before editing:**

- A provider could type broad return charges, including damage and an open `other` amount, without proving how the signed agreement allowed the amount.
- Fuel and cleaning charges did not require a receipt or return photo. Extra-kilometre and late amounts were not calculated from the two inspections, booked return time, grace period, daily rate, or signed limits.
- The renter had one all-or-nothing settlement action. They could not accept the kilometre item while disputing only the fuel item.
- The final balance subtracted the full original deposit even after most of that deposit had already been returned. Example: Rs. 25,000 held, Rs. 23,000 returned, and Rs. 2,000 in valid charges could still produce the wrong amount.
- A typed deposit-return amount had no required return method. A bank transfer did not require a receipt.
- Remaining money after return had no separate sender and receiver confirmation. One person could effectively state that payment was complete for both sides.
- The product used a generic 72-hour message even though signed terms allow traffic-fine and toll notices for 30 days.
- Rejecting one return item did not create a complete item-linked case. The party responses, evidence, interrupted booking stage, assigned reviewer, and money decision were not presented together.
- Admin could close a dispute with one note, but there was no required evidence/agreement/response/money checklist or per-item amount decision.
- A deeper problem appeared during the repair: approving a damage, fine, toll, lost-item, or deposit claim did not create any payment record. A valid late fine could therefore be "approved" in words and then disappear from the money trail.

**Correction deployed:**

- Providers can directly propose only four return items: extra kilometres, fuel difference, late return, and cleaning.
- Extra kilometres are limited by pickup and return odometers, booked days, included kilometres, and the signed per-kilometre rate.
- Late return uses the scheduled return time, actual return time, a two-hour grace period, the signed hourly rate, and a one-day rental-rate cap.
- Fuel and cleaning use the signed cap and require a useful explanation plus evidence. Fuel is refused when the return inspection does not show a lower level.
- Damage, fines, tolls, lost items, and other uncertain amounts cannot be slipped into the ordinary return list. They use the DriveLink case process with evidence, a filed amount, party responses, and an admin decision.
- The renter answers every proposed return item separately. Accepting one item does not accept another. Disputing one item opens one linked case and pauses the booking.
- The final calculation now uses only the part of the deposit that was actually kept. A returned deposit is never subtracted twice.
- Deposit return records name cash, bank transfer, or another method. Bank transfer requires a receipt. The renter separately confirms the amount actually received.
- After the renter agrees with every item and the deposit movement, any remaining direct payment has two steps: the sender records the method/reference/evidence, then the receiver confirms receipt.
- A zero balance cannot create a fake payment. A person cannot confirm receiving their own payment.
- Ordinary post-return reports close after 72 hours. Rental Page fine and toll notices use the signed 30-day window. Expired claims are refused by both screen logic and database rules.
- The party case panel shows the case reference, exact disputed item, claimed amount, deadline, original evidence, both dated responses, reviewer state, written decision, and any approved payment.
- The admin Cases workspace has a scan-friendly queue and one decision desk containing booking, renter, Rental Page, agreement signatures, pickup/return evidence, money record, responses, item decisions, assignment, and four mandatory review checks.
- The admin can approve, reduce, or waive each disputed return item. A separately filed money claim has its own approve/waive amount decision.
- An approved damage, fine, toll, lost-item, or deposit claim creates a separate case payment. This avoids changing an already completed rental back to "active" when a fine arrives later.
- Case payments support cash, bank transfer, another method, or an agreed deposit offset. The sender and receiver confirm independently, and bank transfer requires a receipt.
- An active rental cannot complete while an approved case payment is still one-sided. A late claim on an already completed rental keeps the rental completed and shows the separate case-payment follow-up.
- Admin can no longer use the old booking-status shortcut to resolve disputes. Disputed bookings must go through the Cases workspace.
- The screens use `Return item dispute` instead of the unhelpful category name `Something else` when a case belongs to one rejected return item.

**Additional issues found and corrected during visual testing:**

- Before the renter confirmed a recorded Rs. 23,000 deposit return, the preview treated the return as Rs. 0 and falsely said the Rental Page still owed Rs. 25,000. It now previews the recorded Rs. 23,000, labels it as awaiting renter confirmation, and still blocks final acceptance.
- During an item dispute, the balance looked final even though the disputed item was excluded. It is now labelled `Provisional balance (reviewed item excluded)`.
- The disabled settlement message told the renter to answer an item that was already waiting for DriveLink. It now says DriveLink must decide the reviewed item first.
- A late case payment could appear above the old words `No further payment`, creating a contradiction. The original ledger now says `No further booking close-out payment`, clearly separating it from a later case payment.
- Migration 087 was not fully safe to rerun after the new inspection function already existed. Its repeated-run path is now verified in a rollback transaction.

**Scenario examples after the correction:**

- **Inflated kilometre claim:** Pickup is 50,000 km, return is 50,100 km, the booking includes 50 km, and the signed extra rate is Rs. 100/km. The supported maximum is Rs. 5,000. A Rs. 5,001 proposal is refused.
- **Unsupported fuel claim:** The provider types Rs. 1,500 but attaches no receipt or return photo. The item is refused before the renter sees it.
- **One disputed item:** The renter accepts Rs. 5,000 of extra kilometres but disputes only a Rs. 1,500 fuel item. The kilometre decision remains accepted, the fuel item enters review, and the rest of the booking pauses.
- **Reduced admin decision:** Admin reviews the receipt and fuel-gauge evidence, reduces the fuel item to Rs. 1,000, records why, and restores the booking to the exact active-return stage it interrupted.
- **Correct deposit maths:** Rs. 25,000 was held, Rs. 23,000 was returned, and Rs. 2,000 of cleaning was accepted. The retained Rs. 2,000 covers the charge, leaving Rs. 0 due.
- **Remaining cash payment:** The renter owes Rs. 1,500 after the deposit. The renter records cash paid at return. The provider must press `I received Rs. 1,500` before completion.
- **Bank transfer:** The sending side selects bank transfer without a receipt. The record is refused until proof is attached.
- **Late fine:** Four days after a completed rental, the Rental Page files an official Rs. 2,500 notice. Admin approves Rs. 2,000. The rental stays completed; a separate renter-to-page Rs. 2,000 case payment appears for two-sided confirmation.
- **Expired claim:** An ordinary breakdown report four days after completion is refused because its 72-hour period has closed. A fine notice is still allowed until day 30.
- **Wrong actor:** The Rental Page tries to record the renter's approved fine payment, or the renter tries to confirm receiving their own payment. Both actions are refused.

**Production proof after deployment:**

- Database migrations 087 and 088 are active.
- Claims and settlement rollback walkthrough: 53 passed. No fixture data was kept.
- Full booking lifecycle rollback walkthrough: 29 passed. No fixture data was kept.
- Authenticated browser walkthrough: 41 passed across provider desktop/phone, renter pickup/return/payment/case/late-fine screens, and admin case desk desktop/phone. There were no browser errors or horizontal overflow, and all temporary users and records were removed.
- Document security: 30 passed and removed its temporary users, records, and files.
- Launch payment model: passed after deployment; listing remains free, provider commission remains Rs. 0, and the launch renter confirmation fee remains Rs. 0.
- Production cron safety: seven passed after deployment, with no booking status changed and a fresh successful heartbeat stored.
- Public vehicle privacy verifier passed.
- TypeScript and the 92-page production build passed.
- Worker size: 3,029.49 KiB compressed, approximately 42.5 KiB below Cloudflare's 3 MiB free-plan limit. No paid Cloudflare plan or new runtime dependency was added.
- Unauthenticated case-payment API request returned 401. Unauthenticated admin Cases request redirected to login.
- Main Cloudflare version: `e8518a56-9846-42e1-a7f9-b7b8ad046b7b`.
- Scheduled-worker version: `5db99989-7e80-4b56-8cd4-4fa8ecabfd44`.

**Still open:**

- DL-103 still needs a durable notification outbox. Database decisions are safe, but an SMS/email provider failure after the decision can still lose or duplicate a notification.
- DL-104, DL-105, and DL-106 still need the complete late-return ladder: recorded contact attempts, extension requests and approvals, escalating owner/renter guidance, account freeze rules, and the police-ready evidence pack with all newly added case and payment records.
- The evidence pack itself still needs the broader completeness and large-file work described in DL-069 and DL-076 before it can be called police-ready for a complex case.
- DL-120 still needs an external monitor that alerts a human when the cron heartbeat, production checks, or notification queue become unhealthy.
- The Worker is now close to the free-plan size ceiling. The next phase must keep avoiding heavy server packages and should remove dead shipped code before adding another large feature.

**Status:** Fixed and deployed for contract-limited return charges, item-by-item renter decisions, correct deposit maths, two-sided direct-payment proof, exact 72-hour/30-day claim periods, admin case review, and approved post-completion claim payments. The next verified phase should focus on late return, extensions, contact attempts, the complete evidence pack, durable notifications, and external monitoring.

### Fix 7 - Late-return recovery, controlled evidence exports, and retryable notices - deployed 10 August 2026

**Audit findings addressed:** DL-104, DL-105, and DL-106 are fixed for the current launch workflow. DL-076 and DL-077 are fixed for the records and permissions currently supported by DriveLink. DL-075 is reduced but not fully closed because the full ZIP is still created during one web request. DL-103 is partly fixed: late-return notices now have durable, repeat-safe records, while several older booking-transition notices still use the previous direct-send method. DL-120 remains open because a heartbeat is not the same as an outside service alerting a human.

**Re-verification before editing:**

- DriveLink automatically froze a renter roughly 24 hours after the booked return time. It did not first check for an agreed extension, require a call and written contact attempt, or ask an independent admin to review the facts.
- The urgent wording could imply criminal conduct or tell a provider to prepare for police action from the clock alone. A late return is serious, but time by itself does not prove theft, fraud, or that the renter is unreachable.
- There was no proper extension agreement. A renter and provider could agree on WhatsApp, while DriveLink continued using the old return time and treated the booking as overdue.
- Late-return messages described an hourly fee and a daily cap, but the system did not reliably create that exact amount. The provider could later type a different number.
- The evidence download was a broad GET link. It did not require the person to state a reason, did not record each export, and allowed wider staff access than the identity-document rules.
- The old ZIP omitted important records such as extension discussions, contact attempts, critical-review decisions, itemised charges, case payments, document-view history, and a file-by-file integrity list.
- The old ZIP read every selected image and assembled everything in memory without a practical size limit. A photo-heavy booking could fail when the provider most needed a usable record.
- Late reminders were sent directly during the scheduled job. A temporary SMS, WhatsApp, or email failure had no durable retry record. Two workers could also try to deliver the same event.

**Correction deployed:**

- A booking now has one effective return deadline. It is the accepted extension time when an extension exists; otherwise it is the original signed return time. The renter, Rental Page, admin, fee calculator, and scheduled job all use that same deadline.
- The renter can ask for a later time and give a reason. The renter does not invent the price. The Rental Page replies with the exact proposed return time and exact additional rental amount. Only the renter can accept that offer.
- Sending an extension offer does not silently move the deadline. The deadline changes only when the renter accepts. The accepted amount is recorded as a separate agreed extension item.
- Only one unanswered extension request can be open at a time, and a new return time cannot be backdated or extended by more than 30 days.
- A late-return review cannot be requested until the vehicle is more than 24 hours beyond the effective deadline and the Rental Page has recorded at least one call attempt and one written attempt. The attempts must be at least 15 minutes apart.
- A Rental Page can request review but cannot approve its own request. A DriveLink admin must inspect the deadline, extension state, and contact records. The renter's ability to make new bookings is paused only after admin approval.
- An unanswered extension offer blocks critical approval. This prevents a provider from offering more time and then asking DriveLink to punish the renter before the renter answers.
- The scheduled job no longer freezes, accuses, or declares a renter critical from elapsed time alone. At two hours it sends neutral overdue guidance. At 24 hours it prompts the evidence-and-review process.
- The late fee is created only after a return is recorded. It uses the accepted effective deadline, a two-hour grace period, the hourly amount in the signed agreement, and a maximum of one daily rental rate. Repeating the calculation cannot create a duplicate item.
- Recovery notices are written to a notification outbox before delivery. A failed send remains available for retry. Each event has one unique key, and workers atomically claim records so two overlapping scheduled runs cannot both deliver the same attempt.
- The owner dashboard, renter booking page, and admin booking page now show the same return timeline and role-specific next action. Phone and desktop layouts were checked for overflow and readable action order.
- Evidence export is now a deliberate POST action with a meaningful reason. Every successful summary or full export records who exported it, their role, the booking, the reason, type, time, and file size.
- The normal summary masks sensitive identity details. Page staff cannot export it unless the page owner separately granted the existing renter-document permission.
- A full identity pack is limited to the Rental Page owner or DriveLink admin. It is refused until the booking is disputed or an admin has confirmed a critical no-return review. Ordinary staff cannot download the full pack even when they can view booking documents.
- The full ZIP now contains an independent case-summary PDF, agreement PDF, structured booking records, extensions, contact attempts, the overdue review, inspections, return items, cases and responses, settlement and case payments, document-access history, messages, and activity history where records exist.
- A manifest lists each included file with a SHA-256 fingerprint. It also states which photos were omitted because of limits, so the recipient is not misled into believing a partial pack is complete.
- Full-pack photos are bounded to 30 files, 5 MB per file, and 15 MB total. The smaller summary remains available separately when a photo-heavy ZIP cannot include every image.
- Renters can see evidence exports in their document-sharing history, including the named exporter, export type, reason, and time.
- The legal and urgent copy now says DriveLink organises records and that the provider remains responsible for contacting police, insurer, and legal advisers. It does not promise that an authority will accept the pack or decide the matter in one side's favour.

**Scenario examples after the correction:**

- **Agreed extra day:** The renter needs one more day. They request the time in DriveLink. The Rental Page offers the extra day for Rs. 8,000. The old deadline stays active until the renter accepts; after acceptance, every screen and late calculation uses the new deadline.
- **Provider tries to approve its own offer:** The Rental Page sends an extension price and immediately tries to accept it on the renter's behalf. DriveLink refuses the action.
- **Late but reachable renter:** The vehicle is 25 hours late, but the renter answered on WhatsApp and an extension offer is waiting. The Rental Page cannot turn that into an approved critical case without resolving the extension and supplying the required contact record.
- **No contact proof:** The provider says the renter is unreachable but has only recorded one phone call. DriveLink refuses the critical-review request until a separate written attempt is recorded at the required time gap.
- **Independent decision:** The provider records both attempts and asks for review. The renter is not automatically frozen. Admin checks the timeline and either approves with a written reason or rejects it.
- **Correct late amount:** The accepted return time is 6:00 p.m., the vehicle is recorded back at 10:30 p.m., the grace period is two hours, and the signed rate is Rs. 1,000 per hour. DriveLink proposes the supported amount from 8:00 p.m. onward and never exceeds one daily rate.
- **Ordinary staff member:** A staff account that handles listings tries to export renter records. It is refused. After the owner grants the separate document permission, the staff member can request a masked summary but still cannot obtain the full identity ZIP.
- **Full pack too early:** The page owner requests all identity and evidence files for an ordinary active booking. DriveLink refuses it. The same request becomes available only after a dispute or an admin-approved critical review, and the reason is logged.
- **Large photo set:** A booking has more than 30 large photos. DriveLink produces the bounded records pack, lists omitted files in the manifest, and keeps the smaller summary available instead of silently claiming every photo was included.
- **Temporary notification failure:** WhatsApp is unavailable when an overdue reminder is created. The booking decision remains saved, the notice remains in the outbox, and a later scheduled run retries it without creating a second event.

**Additional production bug found and corrected during regression testing:**

- The admin Cases screen formatted dates using whichever locale rules existed on the Cloudflare server and in the browser. The two results could differ, causing a React hydration error, flicker, and potentially unstable controls.
- Case dates now use one deterministic Sri Lanka time format. The server also calculates the overdue label once and sends that result to the browser instead of both sides reading the current clock independently.
- After this correction, the admin case desk passed on desktop and 390-pixel phone layouts with no browser errors or horizontal overflow.

**Production proof after deployment:**

- Database migrations 089 and 090 are active.
- Return-recovery database walkthrough: 19 passed, including extension ownership, contact requirements, admin-only approval, late-fee maths, repeat safety, and simultaneous notification claims. All data was rolled back.
- Authenticated recovery and evidence walkthrough: 21 passed against production across renter, staff, owner, outsider, and admin roles. It opened the generated PDF and ZIP, checked required files, verified every manifest hash, checked export history, and removed every temporary user and record.
- Full booking UI walkthrough: 41 passed after the admin hydration correction. Provider, renter, and admin desktop/phone screens had no browser errors or horizontal overflow.
- Claims and settlement walkthrough: 53 passed. Booking lifecycle walkthrough: 29 passed. Both used rollback transactions and kept no fixture data.
- Document security: 30 passed against production and removed every temporary user, record, and private file.
- Launch payment checks passed: listing remains free, provider commission remains Rs. 0, and the renter confirmation fee remains Rs. 0 until DriveLink has the legal business and payment-gateway setup to enable it.
- Public vehicle privacy passed. The production cron safety walkthrough passed seven checks and did not change any booking lifecycle status.
- TypeScript and the 92-page Cloudflare production build passed.
- Worker size: 3,045.23 KiB compressed, approximately 26.8 KiB below Cloudflare's 3 MiB free-plan limit. No paid Cloudflare plan or new heavy runtime dependency was added.
- Main Cloudflare version: `27f8e59f-a295-4055-bfaf-08469a025efe`.
- Scheduled-worker version: `e8fe9f36-40dc-4e71-8c35-0c4ec7d153ae`.

**Still open:**

- DL-075 is safer but not fully solved. The full ZIP is still assembled during one request and therefore intentionally omits photos above its tested limits. A later high-volume version should create large packs asynchronously in storage, without making an owner keep a browser request open.
- DL-103 is only partly closed. Recovery and overdue notices use the durable outbox, but several older accept, reject, cancellation, and lifecycle notices still send directly and should be moved to the same pattern.
- Delivery is repeat-safe inside DriveLink, but no external notification provider offers perfect exactly-once delivery. If a provider accepts a message and the network fails before DriveLink records success, a retry can theoretically deliver it twice. Copy must remain understandable when repeated.
- DL-120 remains open. The private heartbeat and failure counts help diagnosis, but an independent uptime/error service must still alert a human when the website, cron heartbeat, or notification queue becomes unhealthy.
- The Worker has only about 26.8 KiB of free-plan space left. The next code-heavy phase must first remove dead shipped server code or split suitable work into the existing small companion Worker. A normal feature should not be allowed to force an accidental paid-plan dependency.

**Status:** Fixed and deployed for extension agreements, contact-backed late-return escalation, admin-only severe account action, signed late-fee calculation, bounded evidence exports, export privacy/history, and retryable recovery notices. The remaining work is the larger-pack architecture, migration of older notices to the outbox, and independent operational alerting.

### Fix 8 - Transaction-safe booking notices, truthful delivery, free-plan space, and deletion recovery - deployed 10 August 2026

**Audit findings addressed:** DL-024, DL-103, DL-116, and DL-155 are fixed for the paths described below. DL-115 is reduced: reminder links now go to the correct side of DriveLink, but assigning different alerts to booking staff, inspectors, dispatchers, and managers still depends on the future staff-role system. DL-085 is reduced: the account screen and recovery-email behaviour now agree, but the wider legal retention policy still needs review. DL-075 and DL-120 remain open.

**Re-verification before editing:**

- A booking could be saved successfully and then lose its SMS, WhatsApp, or email because the old route tried to send only after the database decision. A Worker restart in that gap could leave the other party unaware.
- Retrying an old request could repeat a message. In particular, competing booking requests were discovered through a fragile `last 60 seconds` search instead of one recorded outcome for each affected booking.
- Several routes changed a booking and sent the message as separate work. The database did not hold one durable fact saying `this exact outcome still needs delivery`.
- The renter-cancellation route used a conditional update but did not check whether any row actually changed. Two nearly simultaneous actions could therefore let the losing request return success.
- A provider's unread-message reminder linked to the renter-only booking address. Pending-request conversations were excluded even though chat was available, and completed bookings were excluded while their controlled claim conversation was still open.
- The email sender returns `ok: false` when Resend rejects a message. The general notification and OTP cascades ignored that result and could report `delivered by email` anyway.
- The account-deletion screen said deletion was both permanent and recoverable. It promised a recovery email to phone-only accounts, and a failed recovery email did not stop an email-backed account from being scrubbed.
- The PDF bundle embedded Poppins through a large font parser. That single choice consumed most of the remaining Cloudflare free-plan allowance even though the documents did not require a custom embedded font.

**Correction deployed:**

- Booking requests, confirmation, decline, automatic competing-request decline, cancellation, completion, document consent, fully signed agreements, inspections, cases, extension decisions, and overdue stages now create a notification record inside the same database transaction as the event.
- If the database decision rolls back, its notice rolls back. If the decision commits, the notice cannot disappear merely because an SMS or email company is temporarily unavailable.
- Routes now only wake the delivery worker. The renter or provider does not wait for Text.lk, WhatsApp, or Resend before their action finishes.
- Each event has one unique key. Repeating the same database action cannot create a second notification record.
- Delivery workers atomically claim records. Two overlapping scheduled runs cannot work on the same attempt at the same time.
- A failed notice is retried with increasing waits. After five failed attempts it becomes `dead`, stops retrying forever, records when it stopped, and remains countable for support instead of silently looping or disappearing.
- The scheduled-job heartbeat now includes delivered, newly failed, and permanently failed notice counts. A database index keeps the permanent-failure count inexpensive as history grows.
- Phone messages are kept within 306 characters, approximately two normal SMS parts. A normal DriveLink action link is preserved at the end, while email retains the full explanation.
- Page notices use the Rental Page number first and fall back to the owner's account phone when the page number is blank. Booking-request dates are written as readable Sri Lanka dates rather than raw database timestamps.
- Signed agreements deliberately create separate phone and email records for both parties. A successful SMS therefore does not prevent the durable signed-copy email from being attempted.
- Renter cancellation now proves that the expected booking row changed. If another action won the race, it returns `refresh and try again` rather than a false success.
- Unread-message reminders now include pending requests and completed bookings whose 30-day controlled conversation is still open. Provider reminders open the provider dashboard; renter reminders open the renter booking.
- Concurrent overdue jobs only count a stage when their guarded update actually changed the row. The operational count no longer exaggerates work when two cron runs overlap.
- Resend rejection is now treated as failure by ordinary notices and OTP fallbacks. Login and verification endpoints no longer tell someone to check an email that the provider rejected.
- Email-backed account deletion sends the 30-day recovery link before changing the profile. If Resend rejects it, deletion stops and the screen says nothing was deleted.
- A phone-only account now sees a specific permanent-deletion warning. The screen no longer promises an email link that cannot exist. Loading, safety-check failure, blockers, recoverable deletion, permanent deletion, send failure, and success have distinct behaviour.
- Generated DriveLink PDFs now use PDF-standard Helvetica and Helvetica Bold. The website keeps its normal Poppins styling; only downloaded record files changed internally. The large custom-font parser and fontkit dependency were removed.

**Scenario examples after the correction:**

- **Provider confirms, SMS provider is down:** Confirmation and its notice record commit together. Delivery fails, remains in the queue, and the next scheduled run tries again. The booking does not revert.
- **Two staff click opposite actions:** The database accepts one valid outcome. The losing action is refused, and only the final recorded outcome owns a notification key.
- **One car, three requests:** Confirming one request automatically declines the two overlapping requests. Each losing booking receives its own exact decline event without a time-window search.
- **Worker restarts after confirmation:** The durable notice remains pending in the database. The next worker can deliver it because the event was not stored only in process memory.
- **Two cron workers overlap:** One worker claims the notice. The other receives no claim for that same event and cannot deliver the same attempt concurrently.
- **All channels remain unavailable:** After five attempts the notice moves to the permanent-failure queue. Support can see the count; the scheduler does not spend money retrying forever.
- **Very long vehicle/page name:** The phone message is shortened before delivery, keeps the booking action link, and the email keeps the complete text.
- **Rental Page has a blank WhatsApp field:** DriveLink uses the owner's account phone rather than creating an undeliverable page notice.
- **Provider receives a chat reminder:** The link opens `/dashboard/bookings`, not the renter-only `/bookings/{id}` page.
- **Question before acceptance:** A pending-request message can now receive the same unread reminder as a confirmed booking.
- **Question after return:** A completed booking can still receive reminders while its controlled 30-day claim conversation remains open; reminders stop after that window.
- **Resend replies HTTP 500:** DriveLink records failure and retries or shows a send error. It no longer labels the rejected email as delivered.
- **Email-backed user deletes an account:** DriveLink first obtains an accepted recovery email response. If that fails, the name, login, documents, and profile remain unchanged.
- **Phone-only user deletes an account:** The modal says there is no email recovery and labels the final action `Delete permanently`.

**Additional issues found and corrected during repair:**

- The first owner-phone fallback test attempted to set a required Rental Page phone to `null`. The real schema allows a blank legacy/import value, not null. The production function now treats both surrounding whitespace and a blank string as missing and falls back correctly.
- The first visual deletion test showed the permanent branch for an email-backed user. The preview used a privacy-limited user client that could not read the protected email field. It now uses an authenticated server check scoped to that exact user.
- The deletion preview previously treated a failed safety-check request as `no blockers`, which could enable the dangerous action during an outage. A preview failure now disables deletion and says the account has not changed.
- The evidence PDF test previously checked only the first four `%PDF` bytes. It now parses the masked summary, case summary, and agreement, checks that each has pages, and supports keeping temporary files for rendered inspection.
- The generated summary, case record, and two-page agreement were rendered to images after the font change. Text, headings, line wrapping, margins, and page transitions remained readable with no clipping or blank page.

**Production proof after deployment:**

- Database migration 091 is active.
- Transactional notification rollback walkthrough: 23 passed. It covered safe migration reruns, transaction rollback, confirmation, competing declines, deduplication, agreement phone/email records, inspections, consent, cases, extensions, overdue stages, cancellation, owner-phone fallback, readable dates, SMS length, no in-transaction delivery, and permanent-failure handling. No fixture data was kept.
- Notification cascade walkthrough: four passed. Resend rejection was refused for ordinary messages and OTP email fallback; an accepted Resend response was recognised for both.
- Account-deletion walkthrough: four passed against production. A rejected recovery email left the profile unchanged, an accepted email allowed the scrub, and recoverable desktop/permanent mobile states rendered with no horizontal overflow. Temporary users were removed.
- Authenticated return-recovery, evidence, UI, and PDF walkthrough: 23 passed against production. It used contactless fixtures so no fake phone or email delivery was attempted, and removed all temporary users and records.
- Booking lifecycle: 29 passed. Claims and settlement: 53 passed. Late-return recovery: 19 passed. All used rollback transactions and retained no fixture data.
- Production cron safety: seven passed after the final release. The endpoint rejected unauthorised access, changed no booking status, returned the new notification health fields, and wrote a current successful heartbeat.
- Launch payment verification passed after the final release: listing is free, provider commission is Rs. 0, and the launch renter confirmation fee is Rs. 0. Old slip, fee-collection, and admin fee-switch routes remain retired.
- Public vehicle privacy passed. TypeScript, repository whitespace validation, the 92-page Next.js build, and the OpenNext Cloudflare build passed.
- Final Worker size: 2,657.81 KiB compressed, approximately 414.19 KiB below the 3 MiB free-plan limit. The previous release had only about 26.8 KiB free, so this phase recovered roughly 387 KiB without buying a Cloudflare plan.
- Runtime dependency audit: zero known vulnerabilities. The remaining development-only audit findings are in Capacitor's iOS project-generation chain and are not shipped in the website or Android runtime.
- Main Cloudflare version: `ddd72a68-2798-4d36-8dc0-6455657510e5`.
- Scheduled-worker version: `43fa78ff-7802-4364-9f9f-47c950cf356b`.

**Still open:**

- DL-120 remains open. Internal heartbeats and dead-notice counts help support diagnose a problem, but an independent service still needs to alert a human when the website, cron, or queue becomes unhealthy.
- No third-party message provider can guarantee perfect exactly-once delivery. If a provider accepts a message but the network fails before DriveLink records success, a retry can theoretically produce a duplicate. Messages remain understandable if repeated.
- DL-115 still needs booking assignment and staff-specific escalation after least-access staff roles exist. For now, provider notices use the Rental Page contact/owner fallback and the correct provider screen.
- DL-085 and DL-086 still need one lawyer-reviewed retention table, fresh re-authentication before deletion, and a single all-or-nothing deletion operation for every database/storage step. This phase fixed the recovery truth and fail-before-scrub email gate, not those wider legal/security decisions.
- DL-075 still needs asynchronous large-pack generation if DriveLink later supports evidence sets above the current bounded export.
- Ordinary return-item proposals, payment confirmations, and case responses have strong in-app state but do not yet all have their own external SMS/email event. That should be designed as a separate notification-coverage phase so users are not flooded and costs remain deliberate.

**Status:** Fixed and deployed for transaction-bound booking outcomes, competing-request notices, retry/dead-letter handling, truthful email delivery, role-aware message reminders, free-plan bundle headroom, and honest account-deletion recovery states. External alerting, staff-specific routing, wider deletion atomicity/re-authentication, and deliberate notification coverage for every money/case sub-event remain open.

### Fix 9 - Return, direct-payment, and case-action notices - deployed 11 August 2026

**Audit findings addressed:** The notification-coverage gap noted at the end of Fix 8 is fixed for the important actions that require the other person to do something. This closes the missing external prompt for return-item proposals, return-item acceptance, recorded vehicle return, final-settlement acceptance, direct-payment records and confirmations, case replies, and case-payment records and confirmations. DL-115 remains reduced rather than closed because notices still go to the Rental Page contact/owner, not a named staff member.

**Re-verification before editing:**

- A Rental Page could add a documented return item, such as cleaning or fuel, and the renter would see it only by reopening DriveLink. Missing the screen meant missing the chance to accept or challenge it.
- A renter could accept an item or accept the final settlement, but the Rental Page had no reliable external prompt to continue the close-out or check for a direct payment.
- When one person recorded a cash or bank-transfer payment, the other person had no immediate prompt to independently confirm it. This left an important two-sided record waiting silently inside the booking.
- A reply or evidence update in a DriveLink case also had no external prompt. A young or occasional renter especially could reasonably assume the case was waiting on DriveLink, while the other party was actually waiting for their response.
- The same gap existed for an admin-decided case payment: the paying party needed a clear instruction, and the receiving party needed a clear, cautious confirmation request.

**Correction deployed:**

- Database migration 092 writes every new notice in the same transaction as the return, money, or case action. A successful action cannot lose its notification record because a message provider is temporarily unavailable.
- A renter receives a short, plain-language prompt when a Rental Page proposes a return item. It gives the amount, says to review, accept, or dispute it, and opens the correct renter booking screen. The full email also names the item and repeats that DriveLink has not collected the money.
- The Rental Page receives an action prompt when the renter accepts an item or records that the vehicle was returned. The return prompt tells the page to inspect and record the return; it does not imply that the vehicle condition or money issue is settled.
- When the renter accepts the final settlement, the Rental Page receives the exact next step: receive a positive balance, send a negative balance, or complete final checks when no balance remains. The wording explicitly says that money moves directly between the parties, not through DriveLink.
- Recording a final direct payment prompts the receiving party to confirm only after they actually receive it. Confirmation then prompts the sending party that the other side recorded receipt. Method and reference stay in the booking/email record rather than being copied into the SMS.
- A new case reply prompts only the other party. The phone message does not reproduce the case text or evidence; it asks them to open DriveLink. This avoids putting sensitive dispute details into a lock-screen notification.
- An admin-created case payment tells the paying party to review and record the direct payment. Once recorded, the receiver gets the same cautious confirmation prompt; once confirmed, the payer receives a receipt prompt.
- Every event has a unique key, so a repeated button press or unrelated update cannot make a duplicate notice. The existing retry, dead-letter, and phone/email fallback rules continue to apply.
- The seven affected booking routes now wake the existing outbox only after their database action succeeds. A slow or failed SMS, WhatsApp, or email provider cannot block the return, payment record, or case response.

**Scenario examples after the correction:**

- **Cleaning item after return:** A Rental Page proposes Rs. 1,200 for documented interior cleaning. The renter receives a message saying a return item is ready to review. They can open the booking, see the evidence, then accept or dispute it instead of learning about it days later.
- **Vehicle handed back:** A renter marks the vehicle returned. The Rental Page receives a prompt to check the vehicle and record the return inspection. It does not say the car was automatically accepted back in good condition.
- **Cash owed to the Rental Page:** The renter accepts the final settlement with Rs. 2,000 still due. The page is told that payment is due directly to it. After the renter records a cash handover, the page receives a separate `confirm only after received` prompt.
- **Refund owed to the renter:** The final settlement shows Rs. 3,000 due back to the renter. The page receives a prompt to send and then record the direct payment. The renter receives the independent confirmation step only after the page records it.
- **Case response:** A provider uploads a written explanation and receipt in an open case. The renter receives a neutral prompt that a response was added, without exposing the explanation on their phone lock screen.
- **Fine decided after completion:** An admin approves Rs. 2,000 from a post-return fine. The renter receives the direct-payment instruction, the page receives a confirmation request after the renter records it, and the renter receives a receipt notice after confirmation.

**Production proof after deployment:**

- Database migration 092 is active.
- Transactional notification walkthrough: 34 passed against production. It reran migrations safely and covered rollback, deduplication, return-item proposal/acceptance, vehicle return, settlement acceptance, direct-payment record/confirmation, case reply, case-payment action/record/confirmation, lifecycle outcomes, inspections, consent, extensions, overdue stages, SMS length, contact fallback, and dead-letter behaviour. The transaction was rolled back, so no fixture data remained.
- Claims and settlement walkthrough: 53 passed. Booking lifecycle walkthrough: 29 passed. Both confirmed that the new notice triggers did not loosen money, evidence, completion, or case rules.
- Production cron safety: seven passed. The authorised scheduled run changed no booking lifecycle status and recorded a current heartbeat with notification health counts.
- Launch payment verification still passed: listing fee, provider commission, and the renter confirmation fee remain Rs. 0 at launch. DriveLink still does not collect rental or settlement money.
- TypeScript, whitespace validation, the Cloudflare build, and runtime dependency audit passed. The deployed main Worker is 2,660.25 KiB compressed, about 412 KiB below the 3 MiB free-plan limit.
- Main Cloudflare version: `e17fda87-7df6-4af8-8886-b612428a065b`.
- Scheduled-worker version: `4f702b0c-befc-4655-96ba-5b4624d4c694`.

**Still open:**

- Deposit received/returned information already requires a renter inspection review and acknowledgement. It does not yet have its own separate money-specific message, deliberately avoiding two nearly identical messages for one inspection. Revisit this only if real support data shows people are overlooking it.
- DL-115 still needs assignment and staff-role routing. A page with several staff members still receives these notices through its page contact/owner fallback rather than the exact inspector, cashier, or manager.
- DL-120 remains open: an independent monitoring service must alert a human when the site, scheduled worker, or message queue becomes unhealthy.
- No message provider can guarantee perfect exactly-once delivery after it accepts a message. The notices are written so a rare retry is understandable rather than misleading.

**Status:** Fixed and deployed for the important return, direct-money, and case-response hand-offs. The platform remains direct-payment only: DriveLink records what each side says happened and requires the other side to confirm; it does not hold, send, or guarantee the money.

### Fix 10 - Operations monitor and human alerting - deployed 11 August 2026

**Audit finding addressed:** DL-120 is reduced substantially. Before this fix, DriveLink could write a private heartbeat but no one was automatically told when the website, the scheduled booking job, or the message queue stopped working. The new monitor is separate from the main website code and sends an email to `support@drivelink.lk` when an important operational check fails. It does not make a claim of complete independence: both the website and this monitor still run on Cloudflare.

**Re-verification before editing:**

- The scheduled booking job wrote a heartbeat, but a missing or stale heartbeat could sit unnoticed until a person manually opened an admin or database screen.
- Permanently failed SMS, WhatsApp, and email notices were countable, but no human was warned when the count became non-zero.
- A normal website health page must not reveal database failures, job names, keys, or provider detail to strangers. An attacker should not be able to use monitoring as a map of the platform's weak points.

**Correction deployed:**

- A private website health route checks three practical launch signals: the frequent booking job is recent, the daily booking job is recent, and the message queue has no permanently failed notices.
- The route returns a deliberately small `healthy/unhealthy` answer. It needs the private scheduled-job secret and returns `404` to everyone else, so it does not expose database or provider details publicly.
- A small companion Cloudflare Worker runs every five minutes. It calls that private health route and saves only a small state record in Cloudflare KV.
- It sends an immediate email when a new failure appears, repeats the same unresolved failure at most once every six hours, and sends one recovery email after an alert has been sent. This prevents an outage from becoming a five-minute email flood.
- The monitor is only about 5.59 KiB before gzip compression and uses approximately 288 KV writes per day. That stays inside the Cloudflare free plan's 1,000 KV writes per day. The platform now uses three scheduled triggers in total, below the free-plan maximum of five.
- The monitor has its own protected internal test endpoint. It was used after deployment to prove that the real monitor could reach the real health check and write its live state.

**Scenario examples after the correction:**

- **Booking scheduler stops:** If the frequent booking job has not reported for 45 minutes, the monitor emails support. When the job begins reporting again, support receives one recovery email.
- **Queue has a dead notice:** If repeated delivery attempts permanently fail for any notification, the health check becomes unhealthy and support is alerted instead of the failed record remaining invisible in the queue.
- **The same outage continues overnight:** Support receives the first alert at once and then no more than one reminder every six hours, rather than hundreds of duplicate emails.
- **A stranger visits the health address:** They receive `404`, not a list of job names, message failures, database errors, email settings, or internal URLs.

**Production proof after deployment:**

- Monitor rule tests: seven passed, including new-failure alerting, repeat throttling, recovery handling, and retry after Resend rejects an alert.
- Private health-route checks: three passed against production, including anonymous `404`, authorised health output, and absence of sensitive detail.
- Production monitor checks: three passed. The protected live run reached the website health route, returned healthy, did not send a false alert, and wrote `operations-monitor-state` in the real KV namespace.
- The current monitor state confirms a successful live run. No test alert was sent because the platform was healthy.
- The main Worker was initially deployed as `88b71e19-0c14-4ebb-93a3-dddad910b4ea`; the later self-drive release below carries the same monitor support forward. The monitor's current version is `500766f4-8dbb-4f8a-a99a-f770a1ea2b76`.

**Still open:**

- This is a separate Worker, not a separate company or cloud provider. A Cloudflare-wide outage, account problem, or regional routing problem could affect both DriveLink and its monitor. A future independent monitor should live outside Cloudflare and watch the public customer journey from another network.
- DL-115 remains open: the alert goes to the central support address. It does not yet assign failures to a named operations, support, payments, or booking person.

**Status:** Fixed for practical launch-time alerting of website health, booking scheduler freshness, and dead notifications. Not fully independent of Cloudflare.

### Fix 11 - Reviewed self-drive eligibility and foreign-permit record - deployed 11 August 2026

**Audit findings addressed:** DL-027, DL-028, and DL-029 are fixed for the current manual-review launch workflow. Before this fix, two uploaded image files were enough to pass the self-drive check, vehicle minimum-age and driving-experience rules were only words on a listing, and a foreign visitor could tick an unchecked promise about a permit. The platform now records, reviews, and enforces these items before allowing a self-drive request.

**Re-verification before editing:**

- A renter could upload any two JPG or PNG files as a licence. There was no licence-specific review state, no reviewer queue, no rejection reason, and no reviewer action screen.
- The `minimum age` and `minimum licence years` values were already saved against vehicles but the booking route never compared them with a real date of birth or licence issue date.
- A renter could claim to be a local licence holder even when they were not. Conversely, a foreign visitor could tick a broad promise that they would obtain a permit later. Neither choice recorded the actual document the Rental Page should inspect.
- The old database permission allowed a signed-in renter to replace the file links on an already-approved licence directly. That could leave the old `approved` state next to completely different files.
- The provider's pickup screen correctly asked for an original-licence check, but did not show the declared foreign-document type. This made the final real-world check less clear than it needed to be.

**Correction deployed:**

- The renter account now asks for both licence images, date of birth, first licence issue date, expiry date, and whether the licence was issued in Sri Lanka or another country.
- Submitting or replacing a licence always changes its state to `Under review`. The renter cannot approve it themselves. Their account explains whether it is not submitted, under review, approved, or needs correction, and it shows the reviewer's correction note where relevant.
- The admin renter screen now has a dedicated `Licence reviews` queue. A reviewer sees the private front/back images and the three stated dates, can approve a complete current licence, or send a clear reason for rejection.
- Approval/rejection is recorded with the reviewer and time. The renter receives the result through the existing retryable notification system when they have a usable contact method.
- The old browser permission to directly replace approved licence image links has been removed. The only normal update path is the server review submission, which resets the state to `Under review`.
- A self-drive request now needs an approved, complete, unexpired licence. The booking route calculates the renter's age and licence experience on the actual pickup date, then compares those numbers with that vehicle's stated minimums. This happens on the server, so changing the web page or calling the endpoint directly cannot skip it.
- For a reviewed foreign licence, the renter must record which original document they expect to show at handover: an International Driving Permit, AA Ceylon endorsement, DMT airport permit, or `none`. Choosing `none` blocks self-drive and points the renter toward a with-driver option where one exists.
- The wording deliberately says DriveLink records the renter's declaration; it does not say DriveLink has given legal advice, confirmed that the document is valid, or certified insurance or driving permission.
- A successful booking stores only an eligibility snapshot: the jurisdiction, age in years at pickup, licence years at pickup, review time, and foreign-document declaration. It does not copy the renter's date of birth into the booking.
- The Rental Page sees the declared foreign-document type in its booking view. At pickup, it must still physically inspect the original driving licence and any required permit before handover. Software cannot inspect an original document across the counter.

**Scenario examples after the correction:**

- **Random image upload:** A renter uploads a photo of a card and a selfie as their licence. The account says `Under review`; self-drive is blocked until an admin checks the real document and approves it.
- **A 20-year-old selects a 23+ vehicle:** Even with a reviewed licence, the server refuses the self-drive request because the renter will not be 23 on the pickup date.
- **Recently licensed driver:** The listing needs two years of driving experience. A renter whose first issue date is eleven months before pickup is refused even if they are older than the minimum age.
- **Expired licence:** A licence that expires before the chosen pickup date cannot be used. The renter sees a clear request to upload a current licence for review.
- **Foreign licence, no document:** A foreign-licence renter chooses `None of these yet`. DriveLink refuses self-drive and does not create a half-complete request for the Rental Page.
- **Foreign licence with a declaration:** The renter chooses `AA Ceylon endorsement`. The page sees that exact declaration and still checks the original document during pickup; DriveLink does not promise it is legally sufficient.
- **Approved renter tries to silently swap images:** The old direct database write is refused. Replacing a licence through the account screen returns the whole submission to `Under review`.

**Production proof after deployment:**

- Database migration 093 is active.
- Self-drive eligibility checks: eleven passed. They covered unreviewed, expired, impossible-date, under-age, insufficient-experience, foreign-with-no-document, allowed foreign declaration, allowed local licence, required database columns, removal of the old direct image-write permission, and refusal of an invented permit type. The database portion ran in a rolled-back transaction.
- A self-cleaning production route test created isolated non-deliverable test accounts and used real website sessions. Ten checks passed: unreviewed licence blocked, admin approval works, the renter sees status without document URLs, impossible dates blocked, minimum age blocked, minimum experience blocked, foreign permit missing blocked, eligible local booking accepted, and the stored booking contains the safe eligibility snapshot.
- TypeScript and the Cloudflare production build passed. No extra paid service, payment gateway, or Cloudflare plan was added.
- Current main Worker version: `6ed73956-fde0-4a1f-b39f-400d5a8901a6`.
- Current scheduled-worker version: `56f65102-189d-4d52-b5a9-7f9da992cbd3`.
- Current operations-monitor version: `500766f4-8dbb-4f8a-a99a-f770a1ea2b76`.

**Still open:**

- Licence review is manual at launch. DriveLink needs a clear internal service target so a renter is not left at `Under review` with no expectation of when they can self-drive.
- Didit driving-licence automation has not been confirmed for Sri Lanka. Do not claim automatic licence verification until that provider flow has been tested with real acceptable documents and a lawyer/compliance review.
- The foreign-document options are a record of what the renter plans to show, not a legal rules engine. Sri Lankan visitor-driving requirements, insurer conditions, and document names must be checked with a qualified local adviser before public marketing copy says more.
- The handover checkbox records what the Rental Page says it inspected. It cannot prove that a person examined an original document carefully or that a third party would accept it later.
- Expiry is checked when a booking is requested, but DriveLink does not yet send an advance reminder before a reviewed licence expires. That is a useful future trust and retention improvement.

**Status:** Fixed and deployed for manual licence review, server-enforced vehicle age/experience rules, foreign-document declarations, safe booking snapshots, and the final provider handover check. The remaining work is review operations, legal validation, and future automation, not an open bypass in the current self-drive booking path.

### Fix 12 - Durable full evidence packs without holding the owner's browser - deployed 11 August 2026

**Audit findings addressed:** DL-075 is fixed for the bounded full-pack workflow, and DL-076 is materially improved. Before this change, the server had to read photos, generate PDFs, compress the ZIP, and send the whole archive before the owner's browser request could finish. That was a poor fit for an urgent critical-return case, especially on a slow mobile connection. It also meant that some later case evidence, such as charge receipts and case-payment proof, was not included in the full pack.

**Re-verification before editing:**

- The existing full-pack button really did run the whole ZIP build during one web request. It read up to 30 photos and 15 MB of files into memory before returning anything to the owner.
- The normal DriveLink Cloudflare Worker is kept on the Free plan. Cloudflare's current Free limit is only 10 ms of CPU per request, so moving that ZIP work into another scheduled Cloudflare Worker would have sounded like a fix but would not have been capable of reliably completing it.
- The existing Supabase project already provides Edge Functions on its Free plan. Its documented limits are a 150-second wall-clock period and 2 seconds of CPU. The pack's strict 30-file, 5 MB-per-file, 15 MB-total budget makes it a practical existing no-new-bill worker for the mostly network-bound file reads and uncompressed ZIP creation.
- A full pack is more sensitive than an ordinary booking summary. It must never get a public link, be available to normal page staff, or remain as a forgotten identity-bearing file forever.

**Correction deployed:**

- When an authorised page owner or DriveLink admin asks for a full pack, DriveLink now records the reason immediately and says `Preparing the full pack`. The browser does not wait while files are read and compressed.
- A durable queue row is created before work starts. The private Supabase worker claims one row at a time, and the existing 15-minute DriveLink scheduler also wakes it. If the first nudge is interrupted, the queued request is still there for the scheduled worker.
- A stalled preparation can be safely claimed again after 20 minutes. A pack receives at most three attempts; after that it is marked failed instead of silently looping forever. A failed pack is now also an operations-monitor alert condition.
- The completed ZIP is stored only in the existing private R2 bucket. It can be downloaded only through the normal signed-in DriveLink route after the same owner/admin permission and case rules are checked again. It is not an R2 public address and is never shown to the renter as a downloadable identity file.
- The full pack remains available for seven days, then the private worker removes the stored ZIP and marks that prepared copy expired. The request/history record remains, but the sensitive temporary copy does not.
- Page staff who have specific document permission can still obtain the masked one-page booking summary where allowed. They cannot queue, inspect the status of, or download the full identity-bearing ZIP. The normal case gate remains: an owner cannot queue a full pack until the booking is disputed or DriveLink has confirmed a critical return review.
- The owner-facing panel now uses clear states: `Preparing`, `Your full pack is ready`, `Download ready full pack`, `Prepare a new pack`, and an understandable expiry explanation. The renter's document-sharing history now also says whether a full pack is preparing, ready, failed, or removed after the seven-day privacy period.
- The pack manifest is now version 2. In addition to the agreement, case summary, booking timeline, messages, inspections, charges, cases, payment records, document-access history, and notification delivery record, it includes bounded evidence attached to charges, cases, case replies, settlement payments, and case-payment records. It reports any omitted file and why.
- Raw NIC, selfie, and driving-licence image files remain deliberately excluded from the downloadable archive. The case summary includes the limited identity details already present in the former full pack; this change does not turn the archive into an unrestricted copy of a renter's identity documents.

**Scenario examples after the correction:**

- **Owner on a slow phone during a critical no-return case:** They choose `Prepare full pack`, see that the request was accepted, and can leave the screen. DriveLink's private worker continues the bounded preparation. When they return, the same panel offers one clear download button rather than forcing them to keep a browser request open.
- **First worker call is interrupted:** The full-pack request is already recorded in the database. The scheduled worker sees it and starts it on its next run instead of losing the request because the original web tab or connection disappeared.
- **Worker stalls while reading a damaged evidence file:** The row is not permanently locked. After 20 minutes it can be claimed again. If it cannot complete after three attempts, support receives an operations alert and the owner sees a clear failure state instead of a spinner that never ends.
- **Document-authorised page staff:** A staff member can download the masked summary where their permission allows it. They cannot retrieve the full critical-case ZIP just because they work for that Rental Page.
- **Renter checks their history:** The renter can see that a named booking record export was requested and whether the full pack is still being prepared or was prepared temporarily. They cannot download the owner/admin identity pack.
- **Charge receipt added after return:** The archive now includes its bounded supporting evidence alongside the item record, instead of including only inspection photographs and leaving a reviewer to chase a separate file later.
- **One week later:** The temporary full ZIP is removed from private storage. A fresh pack can be prepared under the same permission and case rules if it is still needed.

**Production proof after deployment:**

- Database migration 094 is active.
- The queue verification ran six rollback-only checks against the live database: immediate summaries retain their old downloaded history state, one full pack is claimed atomically, a concurrent worker cannot claim it again, a stale preparation recovers, and a pack stops after its third failed attempt.
- The private `evidence-export-worker` Supabase Edge Function is deployed with its R2 credentials and its shared internal key stored as platform secrets, not in the repository or browser code.
- A 26-step authenticated production walkthrough created clean temporary accounts and ran a real critical-return case. It proved that outsiders and ordinary staff are refused, explicitly authorised staff receive only the masked PDF, an owner is refused before admin approval, an approved owner queues a pack, the private worker finishes it, the seven-day expiry is set, the owner downloads a real ZIP, both PDFs open, the manifest fingerprints its contents, the renter's history records the export, and all checked desktop/mobile screens have no horizontal overflow. The test removes its database rows and the temporary R2 ZIP afterwards.
- The final visual check confirmed that the critical booking shows the `Full ZIP` option, then a compact ready state with the expiry time, download action, and new-pack action. The ordinary future booking correctly does not offer a full case pack.
- TypeScript, the Cloudflare production build, whitespace check, queue verification, cron-safety check, private operations-health check, and live monitor check all passed after the final deployment.
- Current main Worker version: `8aff74b8-3cfd-424b-95cb-099452c7fa68`.
- Current scheduled-worker version: `0ac50544-bbc2-4ab0-9d8c-22f766f123af`.
- Current operations-monitor version: `8a2417c2-fa77-41db-8b25-6922f7fcef67`.

**Still open:**

- The strict 30-file, 5 MB-per-file, 15 MB-total media limit is intentional protection for the Free-plan worker. The manifest now identifies every excluded file, but a very large or video-heavy case still needs a controlled manual evidence hand-off rather than a promise that every original file will fit in one ZIP.
- Seven days is a privacy-conscious collection period, not a legally reviewed retention rule for every kind of dispute. The long-term retention policy for booking records, inspection files, and authority requests still needs the planned lawyer review.
- The worker is durable enough for the bounded launch pack, but it is not a national-scale case-processing system. If real cases routinely exceed the limits or the worker begins reaching its Free-plan CPU ceiling, DriveLink should move this specific job to a paid/background processing service after measuring actual volume and legal retention needs.
- A `failed` alert tells central support that a pack needs attention. DL-115 remains open: the platform does not yet assign that alert automatically to a named case manager or operations person.

**Status:** Fixed and deployed for a private, queue-backed, retryable, time-limited full evidence pack that does not make an owner hold a web request open. The current output is substantially more complete, but deliberately bounded and not a substitute for a lawyer-approved evidence-retention policy or a limitless legal-document system.

### Fix 13 - Two-sided Rental Page staff invitations - deployed 11 August 2026

**Audit finding addressed:** DL-034 is fixed. Previously, entering an existing DriveLink email address made that person active Rental Page staff immediately. An owner could make a typo, use a shared inbox, or invite someone who had not agreed to the responsibility, and the account would still receive operational access. There was no expiry or reliable history of who granted and removed access.

**Re-verification before editing:**

- The old `Add` action wrote directly into the active staff-membership table. The route did not ask the other person to accept, and access checks treated that row as sufficient permission.
- A new staff member could operate the Rental Page as soon as the owner pressed the button. The existing explicit document permission reduced one privacy risk, but did not solve wrong-person access for bookings, vehicles, messages, and inspections.
- Removal wrote its audit note after removing access as a separate best-effort request. A partial failure could have ended access without leaving the promised history.
- An initially proposed expired-invitation response raised a database error after changing the record. PostgreSQL correctly rolls that whole transaction back, so the expiry would not actually have been retained. This was caught and corrected before the migration was applied.

**Correction deployed:**

- `agency_member_invitations` is separate from active `agency_members`. An invitation has a named DriveLink account, the email used, a seven-day expiry, a status, the inviting owner, and a response time. A pending invitation is not a staff membership and gives no page access.
- Only the Rental Page owner can invite. The database rejects the owner themselves, deleted or blacklisted accounts, existing staff, a duplicate live invitation, and pages that already have 25 active or pending places.
- The invited person sees the invitation under Account. They alone can accept or decline it. A stranger, including the page owner, receives a denial. A cancelled or expired invitation cannot be accepted.
- The invitee starts with no permission to view renter identity documents. That separate sensitive-data permission remains a deliberate owner-only switch after the person is active.
- The owner sees a clear `Waiting for acceptance` state with expiry and a cancel control. The invitee is told in plain language that acceptance grants operational Rental Page access but not renter identity documents.
- Every invitation, acceptance, decline, cancellation, expiry, and removal is written to an access-event history. Staff removal and its history are now one database operation, so they cannot split apart on a partial request failure.
- Existing notification infrastructure sends an email only when the invited account has a verified email; the in-account invitation is always the source of truth. This avoids claiming an external email was delivered when it was not.
- The normal scheduled job expires stale pending invitations. An invitee who opens an already-expired invitation also leaves a durable expired record rather than silently reviving it.

**Scenario examples after the correction:**

- **Mistyped team email:** An owner enters an account they did not mean to invite. That account has no access at all. The owner can cancel the pending invitation before it is accepted.
- **A staff member agrees later:** A booking-desk worker signs in, reads the page name and expiry under Account, then accepts. Only at that point is their active staff row created.
- **Someone forwards a link or guesses an invitation address:** Another signed-in DriveLink account tries to accept. The server rejects it because the invitation belongs to a different account.
- **Old invitation:** A worker comes back after seven days and presses Accept. The invitation stays expired, the owner must make a fresh choice, and the access history records what happened.
- **Urgent offboarding:** An owner removes a departed staff member. Their active access disappears immediately and the same transaction stores who removed whom. The former staff member cannot switch into that Rental Page afterwards.

**Production proof after deployment:**

- Database migration 095 applied successfully.
- Rollback-only database verification: 12 checks passed. It proved a non-owner cannot invite, a pending invite grants no access, only the named account can accept, new staff start without document access, removal and audit history happen together, expired acceptance persists, and scheduled expiry works. The test rolled all fixture data back.
- Deployed route verification: 11 checks passed against `https://drivelink.lk` using three temporary accounts that were deleted afterwards. It covered invitation, no access while pending, stranger denial, acceptance, page switching after acceptance, cancellation, cancelled-invitation denial, removal, immediate loss of access, and the audit event.
- TypeScript, repository whitespace validation, and the Cloudflare build passed before release.
- Main Worker version: `49c48c91-9c00-4f79-81e8-7d99e8993cc5`.
- Scheduled-worker version: `bc693c4b-a733-4cd0-8660-adff36eadd55`.
- Operations-monitor version: `0ec63687-f171-4c6f-a900-12dbcf47ba8b`.

**Still open:**

- DL-035 remains open. Invitation acceptance decides *who* is staff; it does not yet decide the minimum actions each type of staff member can take. The next phase must introduce separate job roles and update both application checks and database policies together.
- DL-036 remains open. Rental Page ownership transfer still needs its own two-sided, re-authenticated, fully atomic process. Staff invitations do not protect a compromised owner session from transferring a whole page.

**Status:** Fixed and deployed for intentional, time-limited staff access with acceptance, expiry, cancellation, immediate offboarding, and a durable history.

### Fix 14 - Unlimited Rental Pages and repaired page creation - deployed 11 August 2026

**Audit finding addressed:** DL-033 is fixed. The stated model is one personal account with unlimited Rental Pages, but the website rejected the sixth live page and the account screen repeated `5 of 5 pages`. During the live regression test, a second hidden issue was also found: page creation could fail for every ordinary user with `Profile not found` because the route tried to read a deliberately private blacklist field through the limited browser-level database connection.

**Re-verification before editing:**

- The page route had a hard-coded `MAX_LIVE_PAGES = 5` check. It was not a business decision shown as a temporary limit; it directly contradicted the blueprint's unlimited-page model.
- The account page hid the `Create Rental Page` action as soon as a person owned five pages, and the creation screen told new providers they could create only five.
- The normal route read `kyc_status`, `is_blacklisted`, and `role` after authenticating the person. `is_blacklisted` is correctly hidden from ordinary browser-level reads. Because database column permissions apply to the whole query, the query returned no usable row and the route incorrectly said `Profile not found`.
- Removing the total limit with no guard would make it easy for a compromised or abusive verified account to create a large burst of fake pages. A genuine multi-brand provider needs a sensible temporary rate limit, not a hidden lifetime ceiling.

**Correction deployed:**

- There is no lifetime count limit on Rental Pages. The account always keeps the create action visible and now explains that separate pages are for genuinely distinct rental brands, locations, or services.
- Page creation is now one protected database action. It locks the owner account, re-checks identity verification and blacklist status, creates the page, and updates the legacy hosting role when needed.
- The database allows up to ten new pages in any rolling 24-hour period. This is an anti-spam brake, not a five-page or inventory ceiling. Older pages never count against it.
- The lock makes the daily guard reliable even when someone opens several tabs or sends requests at the same time. The web route cannot race past the limit by reading an old count and inserting later.
- The ordinary route still authenticates the caller first, then uses the trusted server connection only for the private eligibility read and protected creation action. It no longer asks the browser session to read a private blacklist flag, so genuine verified hosts can create a page again without weakening the column privacy rule.
- The creation database action is callable only by trusted server code, not directly by a browser account.

**Scenario examples after the correction:**

- **Three rental brands, two cities, chauffeur service, and a premium fleet:** One verified owner can create a separate Rental Page for each without unexpectedly being blocked at page number six.
- **A provider grows over time:** An owner who created five pages last year can still add a new, distinct page today. The product no longer treats the old pages as a permanent quota.
- **Accidental burst or compromised account:** A verified account can create the pages it needs, but an attempt to create an eleventh page within 24 hours is refused with a clear try-again-later explanation. It does not turn into an unexplained `5 of 5` ceiling.
- **Normal first-time host:** After identity verification, the real page-creation route reads the host's private eligibility safely on the server and proceeds to create the page instead of incorrectly claiming that their profile does not exist.

**Production proof after deployment:**

- Database migration 096 is active.
- Rollback-only database verification: four checks passed. It proved five older pages do not block a sixth, the eleventh page in one day is rejected by the atomic anti-spam guard, and only trusted server code has creation permission. All fixture changes rolled back.
- Deployed route verification created six Personal Rental Pages for one temporary, verified DriveLink account. All six returned success, including the sixth former failure case; the test then deleted the pages and the account.
- The production check initially exposed the real private-column route bug above. The route was corrected, rebuilt, redeployed, and the full six-page check passed afterwards.
- TypeScript, repository whitespace validation, Cloudflare build, private operations-health checks, and live monitor checks passed.
- Main Worker version: `8aafa6b7-2590-4c1a-ad48-5697d5d1e9a7`.
- Scheduled-worker version: `de441592-9372-4e62-9a3f-cbb8a931efc2`.
- Operations-monitor version: `b60d4aba-b61b-45e4-8e2a-bc099018d61c`.

**Still open:**

- The ten-per-day rate is a launch anti-abuse rule, not a long-term business policy. Review real usage after launch; enterprise creation/import flows may need a deliberate higher-volume approval path rather than silent exemptions.
- DL-035 remains open. Unlimited pages do not solve least-access staff roles inside each page.

**Status:** Fixed and deployed for the blueprint's no-lifetime-limit Rental Page model, with an honest, atomic anti-spam guard and a repaired normal page-creation path.

### Fix 15 - Safe, two-sided Rental Page ownership transfer - deployed 11 August 2026

**Audit finding addressed:** DL-036 is fixed. Previously, a Rental Page could be handed to another account with an immediate, weakly protected change. That was far too much power for one tap on a logged-in device: a page includes listings, booking history, customer conversations, and the ability to manage future rentals.

**Re-verification before editing:**

- There was no recipient decision, waiting period, or final fresh proof from the existing owner before control changed.
- A transfer could leave the previous owner with unintended ongoing staff access, or move a page while live bookings and disputes still needed a clear responsible owner.
- The old route did not give either side a durable, understandable record of the request, cancellation, or completion.

**Correction deployed:**

- Only the current owner can start a transfer, and only to a real, active, identity-verified DriveLink account. The current owner must have a verified phone.
- The receiving account sees the request in Account and must explicitly accept or decline. Until they accept, nothing about ownership or staff access changes.
- Acceptance starts a 24-hour cancellation period. The current owner can cancel during that period; the page still belongs to them throughout it.
- After the waiting period, the current owner must request and enter a new six-digit code sent to their verified phone. The code lasts ten minutes, is rate-limited, and permits only five wrong attempts.
- The final database action checks everything together: both accounts remain eligible, the page is available, the request is still valid, and there are no pending, confirmed, active, or disputed bookings. It then changes the owner and records the completion in one action.
- The former owner is deliberately **not** made staff automatically. If the new owner wants them to help, they must send a separate staff invitation with a chosen job role.
- Requests expire, can be cancelled, and have a dated event history. The existing scheduled job clears expired requests without reviving them.
- The page and Account screens describe the stages in normal language: waiting for the recipient, cancellation period, code confirmation, or cancelled/declined.

**Scenario examples after the correction:**

- **Phone left unlocked:** Somebody with an owner’s open session enters an accomplice’s email. The accomplice still has to accept, the owner has a full day to cancel, and after that a fresh code must arrive at the owner’s verified phone before anything moves.
- **Recipient changes their mind:** They decline from their own Account. The original owner keeps the page; no staff membership is added.
- **Transfer during an active rental:** The page has a vehicle out with a dispute. The final handover is refused until the open booking or case is resolved, rather than making responsibility unclear halfway through.
- **Sale of a small rental business:** The buyer accepts, the seller waits through the cancellation period and confirms the phone code. The page moves as one clear change, while the seller receives no invisible continuing access.

**Production proof after deployment:**

- Database migration 097 is active.
- Rollback-only database verification: 13 checks passed, covering eligibility, recipient-only acceptance, the cooling-off period, code requirements, cancellation, booking protection, expiry, and the clean final ownership handoff.
- A self-cleaning production test using three temporary accounts passed 11 checks. It proved that the recipient can see and accept a request, an unrelated account is denied, ownership does not move early, the current owner can cancel, and cancellation preserves the original owner.
- TypeScript passed. The deployed staff-role release also re-ran the production transfer test successfully.
- Current main Worker version: `711aafcf-a731-48ea-96cf-6a0dac82361e`.

**Still open:**

- This is strong protection for the page transfer itself, but it is not a complete account-security system. Login session visibility, sign-out from other devices, and optional two-step sign-in remain worthwhile before large-scale enterprise use.
- A transfer is blocked for the important live booking states. Legal retention, completed-booking records, and historic tax/accounting handover policy still need lawyer and business-process review.

**Status:** Fixed and deployed for an intentional, recipient-approved, cancellable, phone-confirmed, atomic ownership handoff.

### Fix 16 - Job-specific Rental Page staff access - deployed 11 August 2026

**Audit finding addressed:** DL-035 is fixed. After invitation acceptance was made safe, every accepted staff member could still effectively run the whole Rental Page. That was confusing for owners and excessive for people who only handle vehicles, handovers, or messages.

**Re-verification before editing:**

- The old team model treated a membership as broad operational control. A person asked to update vehicle photos could also reach booking, money, case, and customer-work areas.
- A page owner could not tell a worker’s real limits before sending the invitation, and the invited worker could not see the job they were agreeing to before accepting.
- Some database permissions still used the broad idea of `is a team member`, which could have bypassed a careful screen-level restriction.

**Correction deployed:**

- Owners choose one clear job when inviting staff: `Manager`, `Booking agent`, `Handover agent`, `Fleet editor`, or `Support agent`. New invitations default to the narrower Booking agent role, not full manager access.
- The invite shows the exact role and a simple description before the person accepts. The owner can later change a role, and the change is recorded in the access history.
- The dashboard only shows work that applies to the selected job. For example, a Fleet editor sees fleet work rather than bookings, money, disputes, or reporting.
- The server checks the same job rule before every sensitive action. Hiding a button is not treated as security: calling the web address directly is refused too.
- The database now uses the same named capabilities. A low-access worker can see their own membership row for page switching but cannot read the owner’s team roster or inherit unrelated data through the database.
- Renter identity documents need an additional owner-controlled permission. Only a manager, Booking agent, or Handover agent can even be given that permission; moving a person to Fleet editor or Support agent removes it automatically.
- Existing managers keep their current full operational access, so the change does not unexpectedly block the people already running a page.

**Role examples after the correction:**

- **Fleet editor:** Can add, update, and change the listing state of vehicles. Cannot view a renter’s booking work, accept or decline a rental request, change money records, or see renter identity documents.
- **Booking agent:** Can view and answer booking requests and communicate with renters. Cannot edit the fleet, perform pickup/return handovers, run case/financial actions, or see identity documents unless the owner explicitly enables that separate access.
- **Handover agent:** Can handle the pickup and return inspection work and communicate with the renter. They do not gain money, dispute, fleet-editing, or page-settings control.
- **Support agent:** Can work with page support conversations. They cannot see customer identity documents or use booking, financial, case, or fleet controls.
- **Manager:** Keeps the full operational scope needed to run the page. Only the owner can appoint or change staff roles and sensitive document access.

**Production proof after deployment:**

- Database migration 098 is active.
- Repeatable database verification: 16 checks passed. It covered each role’s allowed and forbidden work, safe document-permission changes, the database roster boundary, manager continuity, and the fact that only trusted server code can create invitations.
- A self-cleaning live test passed eight checks. A temporary owner invited a Fleet editor; the invitee saw the role before accepting, accepted explicitly, could change a vehicle’s listing state, and was refused when trying to accept or decline a rental request. The live database showed that worker only their own membership row.
- The ownership-transfer production test was run again after this release and all 11 checks still passed.
- TypeScript passed. The deployed Workers are main `711aafcf-a731-48ea-96cf-6a0dac82361e`, scheduled worker `8975f3bc-fbcc-47a5-8e1a-7a5b1e96144f`, and operations monitor `711199a1-bf21-4cd4-94ed-e3e09bfbbd5e`.

**Still open:**

- Notices still normally reach the Rental Page contact/owner fallback. They are not yet automatically assigned to the exact booking agent, inspector, cashier, or manager responsible for that job (DL-115).
- Enterprise branch teams, multiple staff assigned to one booking, temporary shift cover, and named approval limits are future operations features. They should be designed from real operator interviews rather than guessed from the current small-team model.

**Status:** Fixed and deployed for clear, least-access staff jobs enforced in the screen, the server, and the database.

### Fix 17 - Browser-level security protections - deployed 11 August 2026

**Audit finding addressed:** DL-128 is fixed. A new live check confirmed the original finding before this change: the public home page exposed the framework name and lacked the basic browser rules that limit hostile framing, accidental cross-site data leakage, plug-ins, and unnecessary hardware access.

**Correction deployed:**

- Every DriveLink application response now sends a Content Security Policy. It permits the site itself, the known Supabase storage/realtime connection, Didit identity verification, DriveLink's current image hosts, and the configured Cloudflare analytics beacon. It does not use a broad `https:` or wildcard-script allowance.
- Browsers are told to remember HTTPS for one year, reject embedding in another website, avoid MIME-type guessing, send only a limited referrer to other sites, and disable unused camera, microphone, location, payment, and USB browser access.
- The Next.js framework banner is disabled, so routine responses no longer advertise the framework version family unnecessarily.
- A small live release check now verifies the required headers and fails if a later configuration change removes them.

**Compatibility check and correction:**

- The first browser test found that the policy correctly blocked Cloudflare's own optional analytics beacon. This was not ignored: the final policy allows exactly `static.cloudflareinsights.com` to load the beacon and `cloudflareinsights.com` to receive its report. No broader script or connection source was added.
- A headless real-browser visit to the production homepage then completed with no content-security-policy errors, no page errors, and the normal public title.

**Scenario examples after the correction:**

- **Hostile framing:** A scam site tries to place DriveLink inside a lookalike frame to collect a renter's login or documents. The browser refuses to frame DriveLink.
- **Future accidental third-party script:** A page change tries to load an unknown script. The browser blocks it unless the source is deliberately reviewed and added to the short policy.
- **Shared booking link:** When a visitor follows a DriveLink link to another site, the browser does not send the full DriveLink path as the referrer.
- **A browser asks for location or microphone unexpectedly:** The policy denies the request. DriveLink's current booking workflow does not need those permissions.

**Production proof after deployment:**

- Eight live header checks passed: content-security policy, hostile-frame/plug-in blocking, the exact permitted services, HTTPS memory, referrer/MIME/frame rules, disabled hardware APIs, and absence of the framework banner.
- A real Playwright browser visit to `https://drivelink.lk/` returned `200`, rendered the normal homepage title, and reported zero console or page errors.
- The current main Worker version is `2c695d85-e8ee-4c52-b432-691ef83816d8`.
- A fresh production dependency audit also reports **zero** known production-package vulnerabilities. DL-129 is therefore re-verified as currently clear, though the audit should remain part of every release.

**Still open:**

- This policy is intentionally compatible with the current providers. Any new payment gateway, map, chat, identity, or analytics service must be added deliberately and tested in a real browser; do not change it to a broad wildcard merely to suppress an error.
- Browser protections reduce risk but do not replace server-side authorisation, database permissions, secure coding review, or a future independent security assessment.

**Status:** Fixed and deployed for practical browser-level protection, with a live guardrail and a zero-error browser check.

### Fix 18 - Truthful booking-request language and full-number phone matching - deployed 11 August 2026

**Audit findings addressed:** DL-055 and DL-056 are fixed in the account-creation booking path. A related unsafe part of DL-021 is also fixed: phone identity lookup no longer relies on just the final nine digits.

**Re-verification before editing:**

- The booking sign-in panel still said `Cancel anytime before the agency confirms, full refund.` That statement was false at launch because DriveLink takes no booking money to refund.
- Its final button said `Verify and confirm booking`, even though the resulting action only sends a request. The Rental Page still has to accept before the vehicle is confirmed.
- Login and duplicate-sign-up checks matched phone records by their last nine digits. Numbers from different countries can share an ending, so the wrong account could be selected or a new account could be refused incorrectly.

**Correction deployed:**

- The booking panel now says, in plain language, that it sends a request, the Rental Page must accept before confirmation, and DriveLink's booking confirmation fee is Rs. 0 at launch.
- The final action now says `Verify and send request`, matching what it actually does.
- Phone identity checks now use the full normalised international number. A small exact fallback supports an old local-format number already stored in the database, but there is no longer a broad ending/suffix search.

**Scenario examples after the correction:**

- **First-time renter:** They can no longer conclude that DriveLink already collected money or that a vehicle is reserved just because they verified their code. They are told the page still needs to accept.
- **Renter changes their mind before acceptance:** They understand they are withdrawing a request, not claiming a refund that never existed.
- **Two numbers with the same end:** A Sri Lankan `+94...` number and a UK `+44...` number that happen to share their final nine digits remain separate. One cannot accidentally open or block the other account.

**Production proof after deployment:**

- Five phone-identifier checks passed, including complete Sri Lankan normalisation, a legacy exact fallback, a foreign number, the same-ending cross-country case, and rejection of a short invalid lookup key.
- TypeScript passed.
- The live public JavaScript bundle contains both corrected booking statements.
- The existing eight live browser-security checks also passed after the release.
- Current main Worker version: `d48fbb8f-636d-4b4f-845d-7d2b72d26a37`.

**Still open:**

- DL-021 is not fully closed: the login and sign-up routes still reveal account state in some direct responses. A proper passwordless account-or-sign-up flow, with neutral external responses and a friendly fallback for a real person, needs to be designed together rather than hiding one message and leaving the other path exposed.
- DL-023 remains open: OTP sending and code-attempt counters need database-level all-or-nothing handling and broader abuse limits. This phone fix removes an identity collision; it does not make OTP rate limiting race-safe.

**Status:** Fixed and deployed for truthful booking/payment language and unambiguous full-number account matching. The broader login-privacy and OTP-abuse work remains deliberately open.

### Fix 19 - Fresh confirmation before account deletion - deployed 11 August 2026

**Audit finding addressed:** The account-deletion part of DL-086 is fixed. Before this change, someone holding an already logged-in phone or browser could type `DELETE` and remove the account. The recovery email was useful after the fact, but it was not proof that the person deleting the account still controlled an outside contact method.

**Correction deployed:**

- Account deletion now needs a fresh six-digit code sent to the account's already verified phone by SMS or WhatsApp. A current browser session by itself is no longer enough.
- The deletion screen explains the sequence in order: send the code, enter the code, then type `DELETE`. The destructive button stays unavailable until both confirmations are complete.
- The code is separate from normal login and verification codes. It expires after ten minutes, allows five wrong attempts, and has a resend pause.
- A successful code creates only a five-minute deletion window. The final deletion route redeems that confirmation once. Repeating the same request, or trying again after the window closes, is refused.
- The important decisions are database actions, not just disabled buttons: ordinary signed-in browser accounts cannot call the issue, verify, or redeem database functions directly.
- The confirmation record is removed during the account scrub, so restoring an account cannot revive an old deletion permission.

**Scenario examples after the correction:**

- **Borrowed or unlocked phone:** Someone can open Account settings and type `DELETE`, but the server refuses. They would also need the fresh code delivered to the account holder's verified phone.
- **Owner decides to delete deliberately:** They send the code, enter it, type `DELETE`, and finish within five minutes. The familiar recovery-email safeguard still runs where a usable email exists.
- **Wrong code attempts:** A stranger tries guesses. Each attempt is counted centrally; after five wrong guesses they must request a new code.
- **Double-click or replay:** One verified code lets one deletion proceed. A repeated final request does not get a second chance to use the same confirmation.

**Production proof after deployment:**

- Database verification: seven rollback-only checks passed. They covered short expiry, resend cooldown, refusal before verification, counted wrong attempts, fresh verification, single-use redemption, and server-only database permissions.
- A self-cleaning production test passed five checks with a disposable account. It confirmed the settings screen shows `Confirm with your phone`, the live route rejects deletion without the code, accepts one known fresh code, permits one deletion and account scrub, then refuses replay.
- TypeScript passed. The existing deletion visual check also passed against production: recovery and no-recovery states rendered without horizontal overflow on desktop and a normal Android-sized screen.
- Current main Worker version: `a53fc090-7d5a-4aa6-86cb-75d08a3f8990`.

**Still open:**

- Rental Page transfer already has its own stronger multi-stage phone confirmation and cancellation period. Account deletion now has a fresh confirmation too, but DriveLink still lacks account-wide session visibility, remote sign-out of individual devices, and optional second-step sign-in (DL-159).
- The deletion/retention policy itself needs a lawyer-reviewed final statement. This change prevents a casual stolen-session deletion; it does not decide what records DriveLink must retain after a legitimate deletion (DL-085, DL-087, and DL-088).

**Status:** Fixed and deployed for fresh, short-lived, single-use confirmation before account deletion.

### Fix 20 - Atomic sign-in and phone codes - deployed 11 August 2026

**Audit finding addressed:** The main part of DL-023 is fixed. Before this change, the normal login, account-creation, and phone-verification code flows checked a resend pause or wrong-code count in the application, then wrote the new value afterwards. Two fast requests could read the same old value before either one saved. That meant two code sends could sometimes both go out, or two correct-code submissions could both look valid for a moment.

**Re-verification before editing:**

- Login code sending, signup code sending, and phone-verification code sending each used the same read-then-write pattern.
- Login, signup, and phone-verification checks each compared a code outside the database, then separately increased the wrong-attempt counter or cleared the code.
- The risk was timing-related, so an ordinary happy-path click test was not enough. The correction needed to handle two requests at exactly the same time.

**Correction deployed:**

- A new private code record now holds each active Login, Signup, or Phone verification code. It stores only the code hash, purpose, timing, resend count, wrong-guess count, and whether the code was already used.
- The database takes a short lock before it sends a code, judges a guess, replaces a code, or marks one used. A second request waits for the first decision, then sees the new reality instead of a stale copy.
- The first resend pause remains 60 seconds; later rapid resends require 120 seconds. Five wrong guesses lock that code until the person asks for a new one. A code still lasts ten minutes and is single-use.
- A replacement code invalidates the previous code in the same database decision. An old code cannot succeed after a resend merely because it was correct a split second earlier.
- If an SMS, WhatsApp, or email provider says it could not deliver the new code, DriveLink removes that just-issued code. The person is not left waiting behind a code they never received.
- The database table and its two decision functions are unavailable to normal browser accounts. Only trusted DriveLink server code can issue or verify these records.
- The old profile and pending-signup columns are still filled or cleared where existing database tooling expects them, but they no longer decide whether a main login, signup, or phone code is accepted.

**Scenario examples after the correction:**

- **Double-tap on Send code:** A renter taps twice because the phone feels slow. One request receives a code; the other sees the resend wait. DriveLink does not quietly create two valid codes.
- **Two tabs open:** A person enters the same correct login code in two browser windows at nearly the same time. One session starts; the other request is told the code was already used.
- **Resend confusion:** A person receives code A, requests a new code, then tries code A after code B arrives. Only code B works. The old message cannot sign them in.
- **Guessing attack:** Someone tries five random codes against a signup. Each wrong attempt is counted in one central record. A sixth attempt is refused even if it arrives from another tab at the same instant.
- **Delivery outage:** The message provider reports a failure. The code is discarded, so the customer can retry rather than being stuck behind a cooldown for a message that never arrived.

**Production proof after deployment:**

- Database migration 100 is active.
- Nine direct database checks passed. They cover private database access, two simultaneous first sends, one winning record, two simultaneous correct-code checks, replacement-code rejection, normal replacement-code use, and the five-wrong-guess lock.
- A self-cleaning production test passed four checks with disposable accounts. The live login route accepted one current code and refused a replay; the live phone route accepted its own code and marked the phone verified; the live signup route accepted its own code and created the expected verified account state. No real SMS or email was sent.
- TypeScript passed after the change.
- Current main Worker version: `68a6c6bd-c78a-4ba3-857d-292e859a7ae7`.

**Still open:**

- The related Rental Page WhatsApp-number verification route is now covered by the same protected challenge pattern in Fix 21 below.
- Rental Page ownership transfer and account deletion deliberately use separate, stricter confirmation flows. They need their own review when the broader session/device work is tackled; they were not silently changed here.
- Login and signup still reveal some account state in their direct responses (DL-021). Removing that safely needs a clear account-or-sign-up experience for real people, not a misleading generic message.
- Wider abuse controls such as IP/device rate limits, suspicious-login alerts, session visibility, and remote sign-out remain separate account-security work (DL-023 and DL-159).

**Status:** Fixed and deployed for race-safe, single-use codes in the main login, signup, and phone-verification flows. Broader account-security work remains explicitly open.

### Fix 21 - Truthful Rental Page phone verification after a number change - deployed 11 August 2026

**Audit finding addressed:** The Rental Page contact-number part of DL-023 is fixed. This was found during the final pass on Fix 20: the page-number verification route still had the older unlimited-guess code handling, and changing a page contact number could leave the old `Number verified` state visible for the replacement number.

**Re-verification before editing:**

- The page-number route stored its code directly on the page row, with no resend pause, no five-guess limit, and no one-time-use database decision.
- The page settings form could change the contact number directly. Nothing automatically removed the prior verification stamp or a code sent to the previous number.
- This was not cosmetic. A renter could see a verified contact signal after the owner had changed the number, and a code intended for the old number could otherwise be relevant to the new number.

**Correction deployed:**

- Rental Page phone verification now uses the same private, locked code system as login, signup, and account phone verification. It has the 10-minute life, single-use rule, 60/120-second resend pauses, and five-wrong-guess limit.
- The page verification screen now shows a resend action and its remaining wait time. A person whose code expires has a clear path forward instead of being stuck on the code-entry view.
- A database rule watches every change to a Rental Page contact number, including a direct browser/database request outside the normal screen. A changed number must be valid international format, clears the old verified stamp, clears old code fields, and removes any active code for the old number.
- The settings form warns before saving that a changed number needs verification again, then confirms that next step after saving.
- Existing older records with unusual number formats are not broken merely by editing some other setting. The format rule activates when the contact number itself is changed, so a page can repair its number deliberately.

**Scenario examples after the correction:**

- **New operations phone:** A small rental business moves booking alerts from the owner’s phone to an office phone. As soon as the new number is saved, the old verification badge disappears and renters no longer receive a misleading trust signal. The page owner verifies the new phone with a fresh code.
- **Old code arrives late:** A code was sent to the previous phone, then the page owner changes the number before entering it. That old code is deleted with the number change and cannot verify the replacement number.
- **Repeated Send taps:** A page owner presses the verification button twice because the screen is slow. One code is issued; the next attempt tells them exactly how long to wait.
- **Direct request outside the form:** A malicious or broken browser request tries to write `not-a-phone` as the public contact number. The database refuses it, even though the normal form would never send that value.

**Production proof after deployment:**

- Database migration 101 is active.
- Three rollback-only database checks passed: the database guard exists, a number change clears the verified stamp and old code, and an invalid direct replacement number is refused.
- The self-cleaning production code-flow test passed five checks. It covers one successful and one replayed login code, account phone verification, Rental Page phone verification, and signup verification. No real SMS or email was sent.
- The existing nine parallel-code database checks, five full-number identity checks, and eight live browser-security checks also passed after this release.
- TypeScript passed.
- Current main Worker version: `858be3ec-4be4-4896-831b-0d64b4a0f028`.

**Still open:**

- Page email is required during new-page creation but the older page-details wording and data model still allow some existing pages to have no email. That is a separate reliability and copy-consistency gap; it needs a measured migration path because existing pages may already rely on the old rule.
- A page Manager can still edit general page details under the existing team model. Whether changing the public contact number should be owner-only needs an explicit operating-policy decision; it was not silently narrowed here.
- Login/signup account discovery, IP/device abuse limits, session visibility, remote sign-out, and optional stronger sign-in protection remain open account-security work (DL-021, DL-023, DL-159).

**Status:** Fixed and deployed for rate-limited, single-use Rental Page phone verification, and for automatically clearing verification whenever the public contact number changes.

### Fix 22 - Public payment wording now says only what is true today - deployed 12 August 2026

**Audit finding addressed:** Public pages mixed the current no-fee arrangement with technical rollout explanations and future-fee discussion. A renter or owner should not have to understand payment-provider setup to understand whether they owe DriveLink money today.

**Re-verification before editing:**

- Pricing, Terms, FAQ, vehicle pages, the home page, and some search/booking wording still used phrases such as `during launch`, `after launch`, or payment-provider roadmap language.
- The Terms page described a future registration and possible later charge. That makes a current promise feel uncertain and turns a plain payment answer into internal business planning.
- The actual current rule was simpler than the surrounding text: listings are free, the booking confirmation fee is Rs. 0, and rental/deposit money is paid directly to the Rental Page.

**Correction deployed:**

- Public pricing, terms, FAQs, booking screens, search pages, landing-page metadata, and footer wording now state the current rule only: the booking confirmation fee is `Rs. 0` and listings are free.
- The public pages explain that rental and deposit money are paid directly to the provider. DriveLink does not collect or hold those funds.
- Internal dashboard/admin wording was aligned so a staff member does not accidentally repeat old public language.
- A repeatable check now searches the public source for roadmap phrases and confirms the Pricing and Terms pages retain the current money boundary.

**Scenario examples after the correction:**

- **First-time renter:** They can see that sending a request costs Rs. 0. They do not need to interpret a paragraph about providers, future fees, or platform registration.
- **Private owner deciding whether to list:** They see a direct answer: listing is free, with no monthly fee or provider commission stated as part of the current offer.
- **Deposit question:** The renter understands that the deposit is a direct arrangement with the Rental Page, not money DriveLink is holding or returning.
- **Search-engine visitor:** A page title or preview no longer repeats temporary-launch language that could become stale or make the business look unfinished.

**Production proof after deployment:**

- Four source checks passed: no public rollout/provider-roadmap wording, the current Rs. 0 booking fee, the direct rental/deposit boundary in Pricing, and the same boundary in Terms.
- Eight live checks passed across the homepage, Pricing, Terms, FAQ, Vehicles, and public rental landing pages. Each returned normally and none contained the retired roadmap phrases.
- TypeScript passed.

**Status:** Fixed and deployed. Public payment copy now describes current behaviour, not internal business sequencing.

### Fix 23 - Private account matching in sign-in, sign-up, and booking - deployed 12 August 2026

**Audit finding addressed:** DL-021 is substantially fixed. Before this change, an outsider could enter a phone number or email and receive a direct answer such as `No DriveLink account uses that...` or `That email is already registered.` The booking pop-up repeated the same distinction. That made it too easy to test whether a particular person used DriveLink.

**Re-verification before editing:**

- The normal sign-in route returned `404` plus an `accountNotFound` marker for an unknown identifier, while a registered person received a different successful response.
- The normal sign-up route returned `409` and named an already-registered phone or email.
- The sign-in tab inside the booking request pop-up read those special markers and automatically switched a person into account creation. That was convenient in one narrow case, but it exposed the same private account fact.
- The two code-entry screens also promised that DriveLink would never ask for a code again, despite normal future sign-ins still using one. The booking pop-up said an email-verification link was already on its way even though that link is sent only after account creation succeeds.

**Correction deployed:**

- A valid sign-in request now receives the same small acknowledgement whether or not an account matches. It does not include a special status, account marker, delivery route, or account-exists message.
- A duplicate sign-up request receives the same acknowledgement as a new sign-up request. It no longer names the matching phone or email in the browser response.
- The sign-in, sign-up, and booking code screens now say: `If a code can be sent to your details, it will arrive shortly.` Each keeps the alternative path visible: people can create an account from sign-in, or sign in from account creation, without retyping their details on the full-page screens.
- Email sign-in now follows the same six-digit-code path rather than showing a separate `email not verified` state that also revealed account information.
- The incorrect future-login and too-early verification-link promises were replaced with accurate, plain-language explanations.
- Two repeatable checks were added: one checks the source for private-account branches and one checks the live site, including a fresh unknown email address.

**Scenario examples after the correction:**

- **Curious outsider:** They enter another person's email on Sign in. The response does not say whether that person has a DriveLink account. They see the same neutral next step as anyone else.
- **Existing renter accidentally chooses Create account:** They are not told that a particular address is registered. The code screen keeps `Already have a DriveLink account? Sign in` visible, and sign-in carries their phone number or email across on the full-page flow.
- **New renter chooses Sign in first:** They are not trapped by an error saying that no account exists. They see `Create an account` immediately on the code screen and can continue there.
- **Guest booking from a vehicle page:** The modal no longer switches tabs based on whether a phone/email exists. It offers the same clear alternative path without disclosing the result of the lookup.
- **Person signing in later:** The screen accurately says a fresh code is used for future sign-ins. It does not promise a passwordless bypass that the product does not provide.

**Production proof after deployment:**

- Eleven source checks passed. They confirm that public account-status markers and duplicate-account messages are absent, all three entry points use neutral wording, both alternative paths remain visible, and the false code/login promises are gone.
- TypeScript and the full production build passed.
- A live request using a new random `@example.invalid` identifier returned only `{"ok":true}` with HTTP 200.
- The live sign-in and sign-up JavaScript, plus Pricing, Terms, FAQ, and Vehicles, passed the combined production privacy/public-copy release check.
- Current main Worker version: `1456fffe-462e-4e5b-a241-dff127af06e8`.

**Still open:**

- This removes the obvious browser messages and status-code differences. It does not claim to defeat every highly technical timing analysis of a message-delivery request. A later dedicated anti-abuse release should add IP/device limits, suspicious-request monitoring, and ideally queue delivery so the request timing itself is less informative.
- The neutral flow adds a small amount of friction: a person who picked the wrong path may need to use the clearly shown alternative link rather than being automatically redirected. This is intentional because privacy is more important than silently revealing someone else's account status.
- Account-wide device/session visibility, remote sign-out, optional stronger sign-in protection, and broader abuse monitoring remain open under DL-023 and DL-159.

**Status:** Fixed and deployed for non-disclosing sign-in/sign-up responses and honest, cross-audience code-screen wording. The deeper traffic-timing and abuse-control work remains explicitly open.

### Fix 24 - Shared connection limit for public account-code requests - deployed 12 August 2026

**Audit finding addressed:** The abuse-control part of DL-023 is improved. The earlier code protection limited resends for one known account, but a script could still cycle through a long list of different email addresses or phone numbers. That could create nuisance messages for real members, add unnecessary database work, and make account probing easier to automate.

**Re-verification before editing:**

- The public Sign in and Create account routes had no connection-level limit at all.
- A sign-in request for an unknown address did not send a message, but it could still be repeated indefinitely. A script could alternate it with registered addresses to make many people receive unwanted login codes.
- Sign-in and sign-up did not share an allowance, so adding a limit to only one screen would have been easy to bypass by switching tabs.

**Correction deployed:**

- Sign in and Create account now share one allowance: up to 12 code-start requests from one connection in 15 minutes.
- The check runs before DriveLink looks up a phone number or email. A blocked response therefore says only that there have been too many code requests from that connection; it does not reveal whether any account exists.
- The database stores a server-keyed one-way fingerprint, not the raw connection address. Old fingerprints are removed in small batches after two days, so the safeguard does not become a long-term connection history.
- The decision is made in one locked database action. Two rapid requests cannot both sneak through because they each saw an old count.
- The normal person-facing message gives an approximate wait and the browser also receives the standard retry time. A person who genuinely taps too often has a clear answer rather than a silent failure.

**Scenario examples after the correction:**

- **Nuisance-code script:** Someone tries dozens of likely customer emails from one internet connection. The first small batch is handled normally; the next request is stopped for the rest of the short window. It cannot keep sending codes merely by changing the email each time.
- **Account probing:** A script alternates Sign in and Create account to discover which names are used. Both screens draw from the same allowance, and the limit happens before the private account check.
- **Repeated accidental taps:** A renter presses Send code twice. The normal per-code pause already handles that. The shared connection limit is a separate backstop for a much larger burst.
- **Shared Wi-Fi:** A group using the same hotel, office, or family connection can collectively make 12 account-start attempts in 15 minutes. That is intentionally generous for ordinary use but may require waiting in an unusually busy shared-network situation. It is a safer temporary trade-off than allowing unlimited message requests.

**Production proof after deployment:**

- Database migration 102 is active.
- Six direct database checks passed: the private table/function exist, browser accounts cannot operate them, one connection is capped, another fingerprint is independent, a new window renews access, and two simultaneous first requests cannot both pass a one-request allowance.
- TypeScript and the complete production build passed.
- A live no-message test sent 12 fresh `@example.invalid` sign-in requests and received the normal neutral response each time. The next request used the **sign-up** route and was stopped with HTTP 429 plus a retry time, proving the shared rule runs before account lookup or message delivery.
- Current main Worker version: `0bb4de5a-f046-43f2-850b-af2e2d4c9dd8`.

**Still open:**

- This is a practical free-plan backstop, not a complete fraud-detection system. It does not yet use device reputation, CAPTCHA, risk scoring, unusual-country alerts, or an abuse-review queue.
- A sophisticated attacker can distribute requests across many connections. Cloudflare edge protections and a later dedicated account-security pass should add broader behavioural controls when real traffic patterns are known.
- The limit does not remove the need for the existing one-account code cooldown, five wrong-code guesses, single-use codes, session visibility, or remote sign-out work.

**Status:** Fixed and deployed for shared, privacy-conscious, race-safe limiting of public account-code starts.

### Fix 25 - Role-scoped guides, listing trust, active-page safety, and honest date search - deployed 12 August 2026

**Audit findings addressed:** DL-008, DL-019, DL-020, DL-040, DL-041, DL-042, DL-046, and DL-047 are further closed for the current launch workflow. This release also connects the six supplied guide videos without exposing operational guides to ordinary visitors.

**Correction deployed:**

- The public Guide page shows only the renter and visitor videos. A signed-in Rental Page owner, accepted staff member, or DriveLink admin receives only the extra operational video that matches their real role. Owner guides are also surfaced inside the owner dashboard, staff guides inside staff work, and the admin guide inside Admin. The public footer no longer advertises the owner walkthrough.
- Rental Page creation intent survives sign-up, so a person who chooses to list a vehicle is taken to create their Rental Page instead of being dropped into a generic account destination.
- A listing change to its vehicle identity, price, insurance, vehicle terms, dates, availability mode, photos, or compliance dates automatically removes its Verified Vehicle mark and sends it back for review. Replacing or deleting its evidence does the same. The normal browser cannot restore the mark directly.
- An administrator can mark a vehicle as Verified Vehicle only after the listing uses hire insurance and registration, insurance, and revenue-licence evidence exists. Public wording explains that this is a document review, not a guarantee of insurance cover or future service.
- A vehicle is public only while its Rental Page is active. Paused, blocked, or deleted pages are filtered from normal public reads and public search. A direct booking request repeats the same check on the server, so a crafted request cannot bypass the browse result.
- Search dates now use the Sri Lanka calendar. The renter must choose a real pick-up date from tomorrow onward and a later return date. Invalid or incomplete date links receive clear guidance rather than an unrelated full-inventory search or a misleading `0 options` result.

**Scenario examples after the correction:**

- **Ordinary visitor:** Opens Guides and receives the two relevant consumer videos. They do not see a video that teaches Rental Page staff or DriveLink administration work.
- **Listing change after approval:** An owner raises the daily price or replaces the insurance image. The vehicle leaves public search until DriveLink reviews the changed information again; it cannot keep the old Verified Vehicle wording.
- **Blocked Rental Page:** A page is blocked while one of its vehicles still says `available`. The vehicle disappears from public search, and a renter who sends a direct booking request receives a refusal rather than creating a booking against a blocked page.
- **Same-day search:** A renter opens a shared link with the same date for pickup and return. The page tells them to choose a later return date instead of pretending every car is unavailable.

**Production proof after deployment:**

- Database migrations 104 and 105 compiled in rollback-only checks and were applied successfully.
- A self-cleaning live trust test passed eight checks: normal owner listing edits and document replacements return a vehicle to review; private insurance is refused for the Verified Vehicle mark; an active page appears in search; a blocked page disappears; and a direct booking request to the blocked page is refused.
- Public search verification now covers incomplete, same-day, impossible, and valid future date ranges, as well as public-field and hire-insurance checks.
- The live public Guide page was checked in the browser. It displayed only the renter and visitor videos with the supplied YouTube URLs, and no owner, staff, or admin guide. The invalid-date page was also checked visually and showed the guidance without `Showing 0 options`.
- TypeScript, lint, the Cloudflare production build, live security-header checks, the launch-payment checks, and the production dependency audit all passed. The current main Worker version is `ff128bc4-738a-4efa-8422-382879b29ee9`.

**Still open:**

- A public or unlisted YouTube URL can be shared outside DriveLink. DriveLink now controls where a video appears inside the product, but YouTube itself is not an authenticated video-permission system. Strict viewer-only access would require private-video identity management or an authenticated DriveLink-hosted player.
- Full Sinhala and Tamil in-product language support, broader account-device security, enterprise/category inventory, external legal review, and other intentionally deferred operating features remain separate product work. They are not presented as complete by this release.

**Status:** Fixed and deployed for role-scoped in-product guide access, reviewed listing-trust changes, active-page public safety, and consistent search-date guidance.

### Fix 26 - Traffic analytics, protected listing photos, embedded guides, and renter controls - deployed 13 August 2026

**Audit findings addressed:** The platform had no dependable first-party view or journey reporting, vehicle photos could be reused without a DriveLink mark, guide videos opened outside the product, the vehicle pop-up close control could scroll out of reach on a phone, booking controls depended on inconsistent device pickers, and several price/trust details could give a renter the wrong impression.

**Re-verification before editing:**

- There was no platform-owned record of a visit moving from browse to a vehicle, booking form, and submitted request. The old owner analytics page counted business records, not website traffic.
- Vehicle uploads were saved as clean public images. A person could download a listing photo and repost it without any visible DriveLink source.
- Guide buttons sent people to YouTube and did not remember where they stopped. The public guide library needed to continue hiding owner, staff, and administrator instructions from ordinary visitors.
- The mobile vehicle pop-up placed its close action inside scrolling content. The WhatsApp action also encouraged people to leave the recorded booking path.
- The booking form used device-dependent date and time inputs. Long time menus were particularly awkward on a small screen.
- Weekly prices existed on listings but were ignored by the booking estimate and agreement. A seven-day renter could therefore see the daily total instead of the listed weekly rate.
- A past Verified Vehicle mark could survive after insurance or the revenue licence expired. The badge needed to describe current reviewed evidence, not an old approval.

**Correction deployed:**

- DriveLink now records privacy-limited first-party traffic: page views, vehicle views, search use, booking-form opens, booking starts, booking submissions, and guide opens. Admin Analytics shows people active in the last five minutes, current signed-in activity, sources, devices, popular paths and vehicles, funnel progress, daily history, and recent anonymous or signed-in journeys.
- Analytics does not save raw connection addresses, complete browser fingerprints, search text, form values, document details, or URL query strings. It honours browser tracking preferences and the Privacy page includes an off switch. Records are kept for 13 months, and the admin data route is not available to ordinary accounts.
- New vehicle photos are decoded, visibly watermarked on the server, and only then moved into public storage. Unsupported or unreadable images fail instead of being published clean. Clean originals are kept under a private backup prefix. All 53 existing photos across 17 listings were backed up and replaced with saved watermarked copies; a second pass found zero unprotected photos.
- The six supplied guides now play in a DriveLink modal using YouTube's privacy-enhanced player. The modal is phone-first, keeps its close action inside the safe area, traps keyboard focus, supports captions and full screen, and remembers a separate playback point for each guide. Public visitors still receive only the renter and visitor guides; extra guides appear only for the matching signed-in role.
- WhatsApp was removed from the vehicle details pop-up, full vehicle booking area, and urgent-booking message. The platform now keeps the booking conversation inside the recorded request. The global support contact remains separate from vehicle booking actions.
- The vehicle pop-up now occupies the real phone height, pins its close button above scrolling content, identifies itself as a dialog, closes with Escape, returns focus to the listing, and keeps keyboard focus inside while open.
- Search and booking now use a DriveLink calendar. Time and option menus use a mobile bottom sheet; long time lists become a compact three-column grid and open around the selected time. The desktop version remains a compact dropdown.
- Booking estimates and agreement breakdowns now use the cheapest exact combination of daily, weekly, and 30-day prices. Driver distance, overnight, and delivery amounts are clearly excluded until the provider confirms the real route or delivery choice. A blank late-return fee no longer invents an automatic daily-rate calculation.
- Verified Vehicle now requires current hire-insurance and revenue-licence dates as well as reviewed documents. Expired records lose the public mark, and the daily maintenance job clears stale approvals automatically.
- Agreement and incident wording no longer claims that a renter always carries full liability, must never move a vehicle in every situation, or cannot seek outside legal or official help during a DriveLink dispute.

**Scenario examples after the correction:**

- **Owner checking demand:** Admin can see that Facebook brought 24 visitors, 10 opened vehicles, four opened a booking form, and one submitted a request. The report does not reveal what anyone typed into a form.
- **Returning video viewer:** A renter closes the first-booking guide at 20 seconds. Opening it later shows `Continue guide` and resumes near that point instead of starting over.
- **Broker copies a photo:** The downloaded public image carries repeated `DRIVELINK.LK` marks and a source footer. Cropping remains possible, but it takes effort and removes useful parts of the vehicle image.
- **Small-screen renter:** The vehicle opens full-screen and the close button is immediately visible at the top. Opening pick-up time centres the current choice in a compact grid rather than forcing a long scroll from midnight.
- **Seven-day rental:** A vehicle listed at Rs. 10,000 per day and Rs. 60,000 per week shows Rs. 60,000 as the base estimate, and the agreement records the same breakdown.
- **Expired insurance:** A listing that was once approved no longer shows Verified Vehicle after its hire-insurance date passes. It must return through review with current evidence.
- **Host wants direct WhatsApp contact:** The vehicle screen does not offer that shortcut. The renter sends a recorded request and later uses booking-scoped communication, preserving the evidence trail.

**Production proof after deployment:**

- The production analytics endpoint returned HTTP 204 and issued its anonymous journey cookie for a same-site event. A foreign origin was refused with HTTP 403, and the admin analytics endpoint refused a signed-out request with HTTP 401.
- Five database analytics checks passed, including private tables, blocked browser access, live/source/device/funnel output, and restricted metadata.
- The watermark and pricing suite passed three checks. The image backfill reported 53 protected photos and then zero remaining unprotected photos.
- Live mobile browser checks confirmed two public guide videos, an in-platform working player, saved playback progress, a visible vehicle close control, watermarked images, and no WhatsApp text inside the vehicle dialog.
- Eight listing-trust checks, thirty document-security checks, nine live security-header checks, the public vehicle-field check, launch-payment checks, public payment-copy checks, TypeScript, lint, the Cloudflare production build, and the production dependency audit all passed.
- Current main Worker version: `4c57f1f4-ad52-4f42-b2da-465afa5ce4bf`.

**Known limits, stated plainly:**

- A visible watermark discourages copying but cannot make screenshots or careful cropping impossible. Stronger deterrence would need per-view personalised marks, which would add image cost and complexity.
- Analytics is designed for useful product decisions, not invasive replay. It does not record every tap, typed value, mouse movement, or screen recording.
- YouTube links can still be shared outside DriveLink. Role controls decide where guides appear inside the platform; YouTube is not a private DriveLink permission system.
- The new calendar and option control cover the renter's important search and booking path plus screens already using the shared control. Dense administrator tools keep their practical native inputs until each workflow is redesigned and tested separately.

**Status:** Fixed, backfilled, verified, and deployed for the launch-critical analytics, photo protection, guide playback, vehicle-dialog, booking-control, pricing, and current-verification gaps.
