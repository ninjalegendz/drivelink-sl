# DriveLink Scenario Audit Fix Register

**Audit date:** 13 August 2026  
**Purpose:** Record flaws found while tracing complete user scenarios for the accompanying handbook.  
**Language:** Plain English for the founder and operating team.  
**Technical status:** Implemented and verified locally and on production. Exact release evidence is recorded at the end.

---

## 1. How to read this register

Each item answers five questions:

1. What real-life situation exposed the flaw?
2. What could have happened to a renter, Rental Page, or DriveLink?
3. Why did the old structure allow it?
4. What changed?
5. Which independent barrier now stops a repeat?

The word **barrier** means a control that still works even if someone skips the normal screen. DriveLink uses five kinds:

| Barrier | Plain meaning |
|---|---|
| Screen | The normal page explains or blocks the action before submission. |
| Server | The receiving DriveLink service checks the request again. |
| Database | The final data store rejects an impossible or forbidden result. |
| Private storage | Sensitive files are not exposed as ordinary public links. |
| Human review | A DriveLink admin must inspect evidence before a high-impact decision. |

---

## 2. Fixes found by the full scenario trace

### SCN-001 - The retired selfie upload could still be called

**Scenario:** A user or an old app build sends NIC and selfie files to the former `/api/account/kyc` route instead of using Didit.

**Old failure:** DriveLink could create a second, weaker identity path that did not match the current consent, liveness, webhook, and document-capture process.

**Reason:** The old route and its upload prefix remained reachable after the product moved to Didit.

**Fix:** The old route now returns `410 Gone`, the dead form was removed, and browser-signed uploads can no longer request the `kyc` prefix. Didit's trusted server flow can still store approved identity evidence.

**Barriers now:** Server, storage allow-list, current account UI.

**Example now:** An old Android build tries the former upload. It receives a clear retired-flow response and cannot create a private KYC object through the browser signer.

---

### SCN-002 - A valid Didit v3 approval could be misread

**Scenario:** Didit sends an approved v3 decision with identity results in `id_verifications[]`.

**Old failure:** DriveLink expected older singular fields in some paths and could fail to capture the approved identity document or correctly finish verification.

**Reason:** Didit v3 uses plural result arrays. The older parser did not cover every official payload shape.

**Fix:** One shared parser now handles v3 plural arrays, the webhook validates signatures and timestamps, and the sync path re-fetches the canonical decision when needed.

**Barriers now:** Signed webhook, replay window, canonical API reconciliation, shared parser.

**Evidence source:** [Didit webhook documentation](https://docs.didit.me/integration/webhooks) and [Didit retrieve-session documentation](https://docs.didit.me/sessions-api/retrieve-session).

---

### SCN-003 - A verified person could have no shareable identity image

**Scenario:** A renter completed Didit verification before DriveLink started saving the approved ID image into its own private document store.

**Old failure:** The person looked verified but could not grant the booking-specific document access that the Rental Page needs after acceptance.

**Fix:** Approved Didit evidence is captured privately for new verifications, and a controlled backfill script repairs eligible older verified profiles.

**Barriers now:** Private storage, signed Didit fetch, server-only write, document viewer authorization.

---

### SCN-004 - A blocked, deleted, unverified, or owner-ineligible Rental Page could retain document access

**Scenario:** A page had valid booking consent, then DriveLink suspended it or the owner's identity/account became ineligible because of a trust concern.

**Old failure:** The owner or a staff member might still open the renter's identity or licence documents because the access check only looked at booking consent and page membership.

**Fix:** Document access now also requires the Rental Page to be verified, not blocked or deleted, and backed by a currently eligible identity-verified owner. Staff still need their separate document permission. A normal voluntary pause continues to allow existing booking work; it blocks new public business rather than abandoning a rental already in progress.

**Barriers now:** Server authorization, private object proxy, burned-in watermark, access audit.

**Example now:** A suspended page opens an old document URL. It receives `404`, and the denied attempt is available for audit rather than revealing whether the object exists.

---

### SCN-005 - Account recovery could revive a page that DriveLink had suspended or deleted

**Scenario:** A page was already blocked by an admin. Later, its owner deleted and recovered their personal account.

**Old failure:** The generic restore process could clear the earlier page block or restore a page deleted by DriveLink moderation.

**Reason:** The page row did not remember why it was deleted or whether it was blocked before account deletion.

**Fix:** Pages now remember `deletion_source` and `blocked_before_deletion`. Account recovery restores only pages hidden by that account deletion, preserves an earlier suspension, and never restores an admin-deleted page.

**Barriers now:** Database history, server recovery service, recovery verification tests.

---

### SCN-006 - A stale profile role could hide real deletion blockers

**Scenario:** A user owned a Rental Page with an unresolved rental but their old profile role still said `renter`.

**Old failure:** Account deletion could check the role label instead of the actual page ownership and miss an open booking or dispute.

**Fix:** The deletion check now looks for pages the person actually owns, regardless of the old role label.

**Barriers now:** Server ownership query, unresolved-booking and case checks, fresh OTP reauthentication.

---

### SCN-007 - Account-recovery copy promised more than the system restored

**Scenario:** A user deleted an account, then recovered it within 30 days expecting every identity file to return.

**Old failure:** Some screens and email copy implied a full restoration even though sensitive identity files are deliberately removed immediately and are not restored.

**Fix:** Account, privacy, deletion, recovery, and email copy now say exactly what returns and what does not. The system also explains that limited phone and identity identifiers may remain for fraud prevention.

**Barriers now:** Consistent UI copy, recovery implementation, deletion verification suite.

---

### SCN-008 - Public descriptions could be used as free broker lead boards

**Scenario:** A provider writes `WhatsApp 077 123 4567` or an outside booking link in the Rental Page name, page description, business hours, vehicle description, listing rules, or review.

**Old failure:** Visitors could bypass the booking record, consent boundary, evidence trail, and later confirmation-fee model.

**Fix:** Public forms warn immediately, the page-creation server checks again, and database triggers reject phone numbers, emails, web links, and common social handles in all protected public text.

**Barriers now:** Screen, server, database.

**Example now:** A provider changes the description through a direct database request instead of the normal form. The database still refuses it.

**Known limit:** No automated detector can understand every creative spelling. Admin moderation and user reports remain necessary.

---

### SCN-009 - Pre-confirmation chat could bypass contact unlock

**Scenario:** A renter sends their number in the first booking message before the Rental Page accepts.

**Old failure:** Both parties could move the deal off-platform while the booking was still only a request.

**Fix:** Normal questions about dates, luggage, vehicle condition, or terms remain allowed. Phone numbers, emails, outside links, and social handles are blocked until the booking is confirmed. The check exists in both the message API and a database trigger.

**Barriers now:** Server, database, message error shown to the sender.

**Example now:** `Can it fit two suitcases?` succeeds. `Call me on 077 123 4567` is rejected before confirmation. The same number is allowed after confirmation for handover coordination.

---

### SCN-010 - The chat looked open for 30 days but the database closed it immediately

**Scenario:** Ten days after return, a Rental Page receives an official toll notice and tries to message the renter.

**Old failure:** The booking page showed a writable composer for 30 days, the API mentioned a 72-hour window, and the database policy rejected every message as soon as the booking became completed.

**Fix:** All three layers now use one 30-day post-return records window. Damage claims still have their separate 72-hour deadline. Declined and cancelled threads remain closed.

**Barriers now:** Matching screen, server, and database time rules.

**Verified scenarios:** Message allowed immediately after completion; message allowed during the records window; message rejected after day 30.

---

### SCN-011 - Listings promised an additional driver without a verification workflow

**Scenario:** A listing said `Second driver allowed`, but DriveLink had no place to name that person, review their licence, collect consent, or bind them to the agreement.

**Old failure:** A second person could drive while every trust record still named only the account holder.

**Fix:** Launch self-drive bookings are now limited to the verified account holder. The listing form no longer offers the unsupported toggle, every current listing is reset to one renter-driver, and a database constraint blocks direct attempts to turn it back on.

**Barriers now:** Listing UI, booking explanation, agreement template, database constraint.

**Future requirement:** An additional-driver feature must have its own account or verified identity, licence review, booking consent, acceptance, and agreement signature.

---

### SCN-012 - A dual-mode vehicle could generate the wrong agreement

**Scenario:** A vehicle offered self-drive and with-driver. The renter selected with-driver.

**Old failure:** The agreement builder looked at what the vehicle offered, not what this booking selected. It could add self-drive age and licence duties to the passenger.

**Fix:** Agreement template `v3` snapshots the booking's actual rental mode and renders mode-specific terms. Old signed snapshots are not silently changed.

**Barriers now:** Immutable agreement snapshot, mode-specific renderer, automated agreement scenarios.

---

### SCN-013 - Hire-insurance wording sounded like a coverage guarantee

**Scenario:** A renter read the agreement and believed `hire insured` meant the insurer had already accepted every driver and capped all liability at the excess.

**Old failure:** The wording was stronger than DriveLink's evidence and stronger than any platform should state without the actual policy and insurer decision.

**Fix:** The agreement now says the Rental Page declared hire insurance, while cover, excess, exclusions, driver conditions, and claim decisions remain subject to the policy and insurer. DriveLink does not certify coverage or decide liability.

**Barriers now:** Agreement copy, listing badge explanation, public FAQ and trust copy.

**Remaining action:** A Sri Lankan lawyer and insurance professional must approve the final agreement language before unsupervised scale.

---

### SCN-014 - With-driver agreements assigned self-drive duties and omitted driver charges from the PDF

**Scenario:** A passenger booked with a supplied driver, then read clauses making them responsible for wrong fuel, self-drive mileage, late vehicle return, and every traffic fine. The downloaded PDF did not show the per-kilometre, toll, or overnight-driver terms that appeared on screen.

**Old failure:** One agreement layout was reused for two legally and operationally different services.

**Fix:** With-driver template `v3` now:

- excludes self-drive licence, fuel, mileage, and late-return duties;
- says the Rental Page is responsible for its supplied driver's eligibility and operation;
- does not automatically charge the passenger for the driver's traffic offence;
- labels the daily amount as a base amount when extras apply;
- includes per-kilometre, toll, and driver-overnight terms in both screen and PDF;
- says unlisted route, waiting, parking, meal, night-work, or accommodation extras are not automatic.

**Barriers now:** Agreement snapshot, screen renderer, PDF renderer, automated self-drive/with-driver comparison test.

**Known limit:** The booking form still does not collect a full chauffeur itinerary, flight, passenger, luggage, waiting-time, or driver-assignment plan. That service must remain a controlled basic offering until the dedicated workflow is built.

---

### SCN-015 - Airport handover was treated as a rental mode

**Scenario:** An owner turned off both self-drive and with-driver but left airport handover on.

**Old failure:** The listing could claim a fulfilment option without saying who drives the vehicle.

**Fix:** Every listing must offer self-drive, with-driver, or both. Airport handover is an extra fulfilment option only. The screen and database enforce the same rule.

---

### SCN-016 - A confirmed booking could be started after its return time

**Scenario:** Staff forgot a booking and pressed `Start rental` a day after the scheduled return.

**Old failure:** The record could become active for a rental that never began, harming availability, evidence, and no-show handling.

**Fix:** The database refuses a start after the scheduled end. Staff must use the no-show or cancellation path instead.

---

### SCN-017 - A blank late-fee field created an invented charge

**Scenario:** An owner left the hourly late fee blank. The system calculated one-eighth of the daily rate anyway.

**Old failure:** The agreement and charge ledger could create money the listing never disclosed.

**Fix:** Blank means no automatic late fee. Any proposed amount needs a written reason plus renter acceptance or DriveLink case review. Listed hourly fees are capped at one daily rate.

---

### SCN-018 - Document-consent copy and revocation behavior disagreed

**Scenario:** A renter granted access after confirmation, then wanted to revoke it before pickup.

**Old failure:** One screen suggested consent could be revoked while another path behaved as though it were permanent.

**Fix:** Consent can be granted and revoked while the booking is confirmed or active. Access ends when consent is revoked or when the eligible booking relationship ends; the event history remains as evidence.

---

### SCN-019 - Reviews could rate a person instead of the Rental Page

**Scenario:** A renter reviewed an owner personally, or a Rental Page published a star rating about a renter.

**Old failure:** The result contradicted the product rule that public reputation belongs to the Rental Page while renter reliability remains private and evidence-based.

**Fix:** Renter reviews update the Rental Page rating. Page-to-renter public star reviews are blocked. Page staff use reports and booking outcomes instead.

**Barriers now:** Review policy, rating trigger, admin interface, lifecycle verification.

---

### SCN-020 - A page could be public or bookable while its trust state was invalid

**Scenario:** An unverified, blocked, paused, or deleted Rental Page still had an `available` vehicle row.

**Old failure:** Search or a copied direct link could expose or accept a booking for a page that should not be operating.

**Fix:** Public search and direct vehicle lookup require both an available listing and a verified, active, unblocked, undeleted Rental Page. Booking creation checks the live vehicle and page state again.

**Barriers now:** Public query, server booking validation, database public-search function.

---

### SCN-021 - Booking cancellation used fragile browser pop-ups

**Scenario:** A mobile user pressed cancel and received a tiny browser confirmation or prompt with unclear consequences.

**Old failure:** Native pop-ups varied by device, were hard to read, and could not clearly explain strikes, no-show consequences, or an optional reason.

**Fix:** Renter cancellation, page cancellation, and no-show actions now use mobile bottom sheets with stable buttons, explicit consequences, and readable reason fields.

**Barrier now:** Clear mobile confirmation before a high-impact action.

---

### SCN-022 - Public trust labels overpromised what DriveLink checked

**Scenario:** A visitor interpreted `Verified Owner`, `Documents Checked`, `Tourist Friendly`, or `Airport Pickup` as a full legal, service, or insurance guarantee.

**Fix:** Labels now say `Owner identity checked`, `Vehicle documents reviewed`, `Traveller assistance`, and `Airport handover`. Explanations state the exact observed fact and what still needs confirmation.

**Related fixes:** Generic `every vehicle verified`, `professional driver`, guaranteed support, and guaranteed notification wording was removed from public and transactional copy.

---

### SCN-023 - Listing decisions and owner cancellations lacked a dependable consequence trail

**Scenario:** A provider cancelled just before pickup or an admin rejected a listing without the right notice reaching the provider.

**Fix:** Listing moderation writes an in-app outcome notice. Late page cancellation and handover no-show behavior use an atomic strike process so simultaneous requests cannot double-count or skip a penalty.

**Barriers now:** Database transaction, notification outbox, admin record.

---

### SCN-024 - Notification copy implied guaranteed delivery

**Scenario:** A user did not receive an SMS but assumed the booking had not changed because the page promised an SMS.

**Fix:** Booking pages are now described as the source of truth. SMS, WhatsApp, and email are helpful alerts that can fail, arrive late, or be disabled.

**Barrier now:** In-app status remains authoritative; notification attempts and failures are logged for operations.

---

### SCN-025 - Privacy copy misstated staff document access

**Scenario:** A renter believed any page staff member could see their licence after consent, or believed no staff could.

**Fix:** Privacy copy now matches the access rule: the page owner may view during eligible booking consent, and staff need both the right work role and a separate document-view permission. Every allowed or denied file request is logged.

---

### SCN-026 - Rental Page deletion could fail while clearing its phone

**Scenario:** An owner or admin deletes a Rental Page that still has a required WhatsApp number.

**Old failure:** The deletion sequence tried to erase the number while an older database rule still required a valid live-page phone. The write could fail and leave the page present, while multi-step cleanup made it difficult to know which records had changed.

**Fix:** A deleted/paused page may have no phone, but a live page may not. One database operation now checks open bookings, scrubs contact and business fields, hides the page, unlists vehicles, removes staff, and cancels pending invitations/transfers together.

**Example now:** If one open disputed booking blocks deletion, none of those changes are committed. The owner does not end up with a visible account but a half-deleted page.

---

### SCN-027 - Changing a page phone could leave old trust attached

**Scenario:** A page replaces its verified number with a typo, an employee's number, or a number it does not control.

**Old failure:** The new number could inherit the old verification appearance while published vehicles remained live.

**Fix:** Any number change clears the old page-phone verification and OTP, pauses the page, and unlists its available vehicles. Resume requires a fresh OTP to the new number.

**Barriers now:** Database trigger, activation check, page settings flow, listing-publication check.

---

### SCN-028 - Full evidence packs were configured in code but unavailable in production

**Scenario:** An owner receives admin approval for a critical no-return case and requests the police-ready full pack.

**Old failure:** The app and private export worker did not share the required secret, so the queue could not be started even though the feature appeared complete.

**Fix:** The same private credential is now configured on both deployed services. The authenticated return-recovery test produced a real private ZIP containing the PDF/evidence output. The value is not stored in code or this report.

**Barriers now:** Owner/admin authorization, critical-case requirement, private worker authentication, temporary private storage, seven-day availability, export audit.

---

### SCN-029 - Account deletion left too much private identity state and could split across pages

**Scenario:** A verified owner with several Rental Pages deletes the account.

**Old failure:** Identity images were removed, but address, `verified` identity state, date of birth, and driving-licence review metadata could remain. Pages were deleted one at a time, so a later page failure could leave an account partly deleted.

**Fix:** One database transaction now checks every renter/page booking blocker, scrubs every live owned page, disconnects analytics identity links, clears address and identity/licence state, resets verification, and marks the profile deleted. A failure rolls the entire operation back.

**Example now:** A four-page owner with one unresolved dispute receives a refusal and all four pages/account remain unchanged. Once blockers are resolved, all pages and profile privacy fields change together.

---

### SCN-030 - Recovery could reuse trust evidence that had been permanently deleted

**Scenario:** An owner restores an account within 30 days and tries to resume an old personal or verified-business page.

**Old failure:** The page could retain an old verification flag even though the owner's identity evidence and the business certificate had been erased during deletion.

**Fix:** A restored page stays paused. The owner must redo identity verification, restore page details, and verify the page phone. A business page loses business verification and must submit current evidence for a new review.

**Barrier now:** Atomic recovery state, owner-eligibility check, page activation check, business verification reset.

---

### SCN-031 - Any signed-in account could bulk-read Rental Page contacts

**Scenario:** A person creates a throwaway account, skips the DriveLink screens, and asks Supabase directly for every active page's WhatsApp number, email, address, registration data, and internal flags.

**Old failure:** A broad signed-in column grant overlapped an old policy that treated every page row as public. The visual contact gate did not protect this direct database path.

**Fix:** Public browsing now uses an anonymous, public-column-only path. A signed-in database identity can read a page row only when it owns/staffs that page or is an admin. Confirmed-booking contact is returned through a server query pinned to that renter and booking.

**Verified example:** A random authenticated identity queried all Rental Pages and received zero rows; anonymous access could read public names but received a permission error for `whatsapp_number`.

---

### SCN-032 - A page could keep trading after its owner lost eligibility

**Scenario:** An admin rejects the owner's identity or blacklists/deletes the owner while the page still has available vehicles and waiting requests.

**Old failure:** Page visibility depended mainly on the page's own flags. Owner trust could change without pausing inventory, and staff could try to confirm a request already waiting.

**Fix:** Owner ineligibility automatically pauses every owned page and unlists available vehicles. Public page/search, booking creation, document access, page resume, and pending-to-confirmed transition each check the current owner/page state again.

**Example now:** A stale staff tab submits `Confirm` after the owner becomes ineligible. The server stops before preparing the agreement; a direct database transition is independently rejected.

---

### SCN-033 - A retired browser booking policy remained as misleading database debris

**Scenario:** A future migration accidentally grants booking writes back to signed-in browsers while an old `Renter can create a booking` policy still exists.

**Important correction:** This was **not an active booking-insertion vulnerability**. Migration 059 already revoked browser booking writes, and direct insertion was denied when checked.

**Hardening:** The stale policy was removed and insert/update/delete privileges were explicitly revoked again. A regression check now proves the browser role cannot write booking rows or regain that retired policy.

---

### SCN-034 - Tightening page privacy briefly broke anonymous vehicle reading

**Scenario:** A signed-out visitor opens Search after the Rental Page contact-table lockdown.

**Failure found during verification:** One older vehicle-management rule still checked private Rental Page columns directly. After those columns were correctly hidden from public database access, that dependency could make the whole anonymous vehicle query fail with `permission denied` instead of simply returning safe listings.

**Fix:** The database now asks a narrow protected yes/no function whether the current user may manage that page's fleet. Public vehicle reads no longer need permission to inspect private page columns.

**Example now:** A signed-out visitor can read an eligible vehicle and its safe storefront fields. The same visitor still cannot request the page phone, email, address or internal flags.

---

### SCN-035 - A renter's page name could disappear during background refresh

**Scenario:** A renter opens **My Bookings**, leaves the tab open for 20 seconds, or returns to it later.

**Failure found during final trace:** The first screen load correctly used a protected server read, but the background poll still joined Rental Page records directly from the browser. The stricter contact boundary could turn that joined page into `null`, making the page name disappear from otherwise valid booking cards.

**Fix:** The refresh now calls an authenticated DriveLink endpoint. The endpoint derives the renter from the signed-in session, returns only that renter's bookings, and exposes only the Rental Page name rather than the page's private contact record.

**Verified example:** A phone-sized renter list kept all five test page names, the background refresh returned exactly that renter's five bookings, and the response contained no WhatsApp field. This is now part of the 47-check booking UI suite.

---

### SCN-036 - A listing could reach handover without a recorded plate

**Scenario:** A renter books a Basic listing. At pickup, DriveLink asks both sides to confirm that the arriving plate matches the booking, but the listing never stored a plate.

**Old failure:** Four of the 20 vehicle rows examined at discovery had no plate; three were marked available before the wider page-phone barrier hid them. The promised bait-and-switch check could therefore become impossible at the exact handover moment.

**Fix:** Plate is required in both listing screens. It remains private from public search, but publication, direct booking and booking confirmation independently require it. Incomplete legacy rows were unlisted for correction rather than given invented plates.

**Barriers now:** Listing screen, publication server, booking server, database publication rule, handover plate confirmation.

---

### SCN-037 - Basic listings had no recorded right-to-list declaration

**Scenario:** A broker, employee, family member or fleet operator lists a vehicle that is not registered in their own name.

**Old failure:** Terms generally said the provider needed the right to list, but the listing record did not say whether the page claimed registered ownership or somebody else's authority. There was no declaring account or timestamp for admin to inspect later.

**Fix:** A Rental Page owner or manager must choose `registered owner` or `authorised operator` and confirm the declaration. DriveLink stores who declared it, when, and which declaration wording applied. An authorised-operator statement is still self-declared, so admin may request written proof.

**Important limit:** Software records a statement; it cannot make a lie true. Registration comparison, written authority, reports, handover evidence and human review remain necessary.

---

### SCN-038 - An admin-rejected listing could use the ordinary Relist path

**Scenario:** Admin rejects a listing for a fake identity, misleading photos or missing authority. The owner opens Fleet and uses the same control intended for a voluntarily unlisted, previously approved vehicle.

**Old failure:** Both states used `unlisted`, so the relist action did not distinguish an owner pause from an unresolved admin rejection.

**Fix:** A listing with a rejection reason cannot be relisted. The fleet screen directs the owner to fix the reason and resubmit; the server repeats that rule if somebody calls it directly.

**Barriers now:** Fleet screen, status endpoint, publication-readiness database rule, new admin review.

---

### SCN-039 - A signed-in stranger could ask for raw vehicle inventory rows

**Scenario:** A scraper creates a free account and asks Supabase directly for plates, VINs, engine numbers, rejection notes or other raw vehicle columns instead of using DriveLink search.

**Old failure:** Public UI/API results were already shaped safely, but the old authenticated table permission remained broader than the public marketplace contract.

**Fix:** Public browsing uses the safe anonymous search result. A signed-in database identity sees a raw vehicle row only when it owns/staffs that Rental Page or is an admin. Confirmed-booking facts still come through the booking server.

**Verified example:** An unrelated signed-in account received no raw vehicle rows while anonymous search continued to return only safe public fields.

---

### SCN-040 - A direct booking call could bypass page-phone verification

**Scenario:** A hidden legacy listing URL or crafted request targets a page that is identity-approved but has never proved control of its current operating phone.

**Old failure:** Search hid the page, but the booking endpoint checked page verification/blocking without repeating the newer page-phone OTP rule.

**Fix:** Booking creation now requires the page's current phone verification timestamp. The later request-to-confirmed transition also checks current page eligibility, so an old waiting request cannot slip through after trust changes.

**Barriers now:** Search, booking server, database confirmation rule, page activation rule.

---

### SCN-041 - Basic, Verified Vehicle and insurance wording were easy to overread

**Scenario:** A first-time renter sees a normal listing and assumes DriveLink checked ownership documents, insurance coverage and mechanical condition.

**Old failure:** Verified listings had a badge, while ordinary listings had no equally visible name or explanation. `Hire Insurance` also sounded like a promise rather than a provider statement.

**Fix:** Every non-verified public listing is labelled `Basic listing` with a short limit statement. Verified Vehicle names the three reviewed document types. Insurance labels now say `declared`, and neither state promises claim acceptance or mechanical condition.

---

### SCN-042 - Plate punctuation and staff roles could weaken the new authority barrier

**Scenario A:** The same plate is entered once as `CAA-1234` and again as `CAA 1234`.  
**Scenario B:** A fleet employee preparing photos declares that the page owns a vehicle without the owner knowing.

**Failure found while reviewing the first fix:** The first duplicate check ignored only extra spaces, and every fleet editor could reach the new declaration fields.

**Fix:** Plate identity now ignores spaces and punctuation when checking duplicates. Fleet editors can save complete private drafts, but only the page owner or a Manager may make/change the right-to-list declaration. A direct employee database update is also refused.

**Verified example:** A punctuation variant was rejected, while a fleet editor successfully saved a private draft, failed to declare authority, and remained unable to handle bookings.

---

### SCN-043 - A passing production test could leave a fake public vehicle behind

**Scenario:** The staff-permission verification creates a temporary page, vehicle and booking, all assertions pass, then cleanup tries to delete the parent page before its booking and vehicle.

**Old failure:** The page deletion quietly failed because child records still existed. The script reported success while its temporary vehicle appeared in public search and polluted inventory/analytics.

**Fix:** The leaked test vehicle/page and four retained test accounts were removed. Cleanup now deletes booking, vehicle, page, related audit events and test accounts in dependency order, collects every cleanup error and fails the run instead of hiding it.

**Verified example:** The staff suite passed again and public search returned zero eligible inventory immediately afterward.

---

### SCN-044 - Live database changes were not recorded by the project migration command

**Scenario:** A future developer sees repository migration `120` or `121`, cannot find it in the standard history table, and replays it against production or assumes another environment is current when it is not.

**Old failure:** The direct SQL runner applied files but never wrote a DriveLink migration record. The handbook's earlier phrase `deployed and recorded` was therefore too strong.

**Fix:** Production now has an explicit verified DriveLink baseline through migration `121`. The migration runner refuses to replay anything at or below that baseline. Every future migration must use the numbered filename format and is executed and checksum-recorded in the same database transaction. Editing an already applied file causes a hard failure.

**Barriers now:** Baseline record, version check, SHA-256 checksum, one transaction, private migration table.

---

## 3. Corrected audit false positive

### COR-001 - An unverified storefront's HTTP 200 was not a data leak

One automated probe initially treated an HTTP `200` from an unverified Rental Page URL as exposure. Next.js had streamed its branded not-found boundary as a soft 404. The hidden page name/details were absent and `noindex` was present.

**Correction:** This is a search/HTTP-semantics concern, not private-data exposure. The test now checks the meaningful guarantees: no hidden page data and no indexing. Metadata resolves the not-found state as early as the framework permits; no duplicate middleware was added merely to manufacture a different status code.

### COR-002 - The broken account-deletion screen was a stale local test server

One local browser run showed the deletion page without styling or working controls after a production build had replaced assets while the old development server was still running. The screenshot itself showed that the browser had failed to load the page's current CSS and JavaScript; it did not show a defect in the deletion workflow.

**Correction:** The complete account-deletion test was repeated against the deployed platform and passed all 11 checks, including the confirmation screen, authorization rules and deletion result. Local browser tests must restart their development server after a production build so they do not mix old pages with newly generated assets.

---

## 4. Verification completed for these fixes

| Check | Result |
|---|---|
| TypeScript application check | Passed |
| Migration 113 public-contact guards, rollback compile | Passed |
| Migration 114 post-return chat policy, rollback compile | Passed |
| Migration 115 one verified renter-driver, rollback compile | Passed |
| Migration 116 atomic page deletion and activation | Passed locally and on production |
| Migration 117 atomic account deletion and booking write lock | Passed locally and on production |
| Migration 118 owner trust and signed-in contact boundary | Passed locally and on production |
| Migration 119 public vehicle policy dependency | Passed on production |
| Migration 120 vehicle identity, authority and private-inventory boundary | Compiled, deployed and passed production scenarios |
| Migration 121 authority roles and punctuation-free plate identity | Compiled, deployed and passed production scenarios |
| DriveLink migration ledger | Verified baseline through 121 recorded; old replay refused |
| Complete booking lifecycle and abuse scenarios | 48 of 48 checks passed, including browser-write denial, raw-vehicle denial and owner-eligibility shutdown |
| Account deletion, recovery and responsive UI | 11 of 11 checks passed |
| Production public-contact boundary | 8 of 8 checks passed, including unrelated signed-in page/contact/raw-vehicle scraping denial |
| Booking and case screens on desktop/mobile | 47 of 47 checks passed, including protected renter-list refresh |
| Private document delivery, watermark, audit and cleanup | 31 of 31 checks passed |
| Critical return recovery and private full evidence pack | 26 of 26 production checks passed |
| Claims and direct-payment settlement | 53 of 53 checks passed |
| Live fleet-staff capability path | 10 of 10 checks passed, including private draft and denied authority declaration |
| Staff invitations | 12 of 12 checks passed |
| Page ownership transfer | 13 of 13 checks passed |
| Self-drive eligibility | 10 of 10 deployed route checks passed; pure eligibility scenario suite also passed |
| Public listing trust | 20 of 20 production checks passed |
| Traffic analytics privacy and reporting | 5 of 5 checks passed |
| Security headers, private health and monitor | 9 of 9, 3 of 3 and 3 of 3 production checks passed |
| Agreement mode comparison | Self-drive, with-driver, insurance wording, and charge-duty checks passed |
| Data kept by test runs | None; database scenario tests run inside a rollback-only transaction |

---

## 5. Important limits that are not being disguised as fixes

These are not broken promises inside the current supported workflow because the handbook now labels them as unsupported or controlled-pilot only. They still matter before broader expansion.

| Limit | Current safe position | Proper future solution |
|---|---|---|
| Additional renter-driver | Not allowed; verified account holder only | Separate identity, licence, consent, and signature for each driver |
| Booking for another self-drive driver | Not supported | Separate booker, payer, renter, and driver roles |
| Full chauffeur operation | Basic with-driver booking only | Itinerary, passengers, luggage, flight, waiting, driver assignment, overtime, meals and accommodation |
| Enterprise fleet integration | Not built | Generic API, feeds, webhooks, category inventory and booking handoff after partner discovery |
| Branch management | Not built | Branch entities, staff scope, stock and reporting |
| Roadside service network | No platform-wide guarantee | Contracted neutral dispatch network with coverage, prices and service levels |
| Online rental/deposit custody | DriveLink does not hold these funds | Regulated payment design, gateway, refunds, reconciliation and dispute policy |
| Listing boosts | Not active | Clearly labelled sponsored ranking that never changes trust badges |
| Sinhala/Tamil product UI | English UI today | Human-reviewed safety-critical translations first, then full localization |
| Private role-video secrecy | The app hides operational guides by role; public YouTube links remain shareable | Private authenticated video hosting if confidentiality is required |
| Legal approval | Engineering copy is cautious, not legal approval | Sri Lankan lawyer, insurer and data-protection review |

---

## 6. Release status

This section is intentionally updated only after migrations, the full release suite, production deployment, and production probes complete.

**Current status:** The supported launch workflows documented here are deployed. Database migrations through **121** are live, with a verified DriveLink baseline through 121 recorded. The final application is Cloudflare Worker version `3ba72af9-d470-4a9d-a6dc-7f75ac8e46e4`; cron is `2ac056bb-d9e3-40a0-b786-f7130fbe4420`; operations monitor is `fa60ab13-cfdd-48bd-8d5e-05d9a4dca924`.

The final production pass completed successfully: all **47 booking UI**, **20 listing-trust**, **8 public-contact**, **10 fleet-role**, **10 self-drive**, **31 private-document**, **26 return/recovery export**, **11 account-deletion**, **9 security-header**, **3 private-health**, and **3 operations-monitor** checks passed against the live services. The 48-step booking lifecycle, 53-step claims ledger, launch-payment, analytics, invitation, unlimited-page and ownership-transfer suites also passed. Release lint, type check and the 98-route production build passed.

**Current inventory warning:** Public inventory is intentionally zero. The database has 17 legacy/demo vehicle rows across seven pages; all 17 need a real right-to-list declaration, one also needs a plate, and all seven pages need page-specific phone OTP verification. Real owners must correct and resubmit intended launch stock; test/demo stock must remain private or be removed. This is a marketing-readiness blocker, not a reason to invent declarations or phone verification.

**What remains outside software completion:** real owner phone verification and inventory cleanup, a two-person real-device pilot, and Sri Lankan legal/insurance/data-protection review. Those are required launch gates, not hidden coding defects.
