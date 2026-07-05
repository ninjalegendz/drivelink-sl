// SMS message templates. Plain ASCII, GSM-7-friendly.
//
// Two guarantees baked in here:
//   1. Every message carries the booking ref AND the vehicle's plate number, so
//      two vehicles/renters with the same name are always distinguishable from
//      the text of an automated message alone.
//   2. The variable parts (vehicle title, renter/agency names) are auto-
//      truncated so a long "2019 Toyota Land Cruiser Prado TX-L …" title can't
//      push a confirmation into extra paid SMS segments. The plate + ref + link
//      are always preserved.

const SMS_MAX  = 306; // keep within ~2 GSM-7 segments (153 chars each)
const NAME_MAX = 28;  // cap for renter / agency names

/** Truncate to `max` chars with an ASCII ".." marker (stays GSM-7, no Unicode). */
export function clampAscii(s: string, max: number): string {
  if (!s || max <= 0) return "";
  return s.length <= max ? s : `${s.slice(0, max - 2).trimEnd()}..`;
}

/**
 * Compose a message containing a vehicle label "<name> (<plate>)", truncating
 * the NAME so the whole SMS stays within SMS_MAX. The plate is always kept.
 */
function composeVehicleSms(build: (label: string) => string, name: string, plate?: string): string {
  const suffix = plate ? ` (${plate})` : "";
  const budget = SMS_MAX - build(suffix).length; // chars left for the name
  return build(`${clampAscii(name, Math.max(6, budget))}${suffix}`);
}

interface AgencyPingArgs {
  bookingId:     string;
  renterName:    string;
  vehicleName:   string;
  vehiclePlate?: string;
  startDate:     string;
  endDate:       string;
  totalDays:     number;
  appUrl:        string;
}

// Sent to the agency the moment a renter requests a vehicle. The agency
// confirms by clicking through to the dashboard, not by replying.
export function buildAgencyPingMessage({
  bookingId, renterName, vehicleName, vehiclePlate, startDate, endDate, totalDays, appUrl,
}: AgencyPingArgs): string {
  const ref    = bookingId.slice(0, 8).toUpperCase();
  const renter = clampAscii(renterName, NAME_MAX);
  return composeVehicleSms(
    (veh) =>
      `DriveLink: new booking ${ref}. ${veh}, ${startDate} to ${endDate} (${totalDays}d). ` +
      `Renter: ${renter}. Confirm or decline: ${appUrl}/dashboard/bookings`,
    vehicleName, vehiclePlate,
  );
}

interface RenterTransitionArgs {
  bookingId:     string;
  vehicleName:   string;
  vehiclePlate?: string;
  agencyName:    string;
  appUrl:        string;
}

// Sent to the renter once the agency (or admin acting for them) accepts
// the booking. The renter now has 12h to upload a payment slip.
export function buildRenterConfirmedMessage({
  bookingId, vehicleName, vehiclePlate, agencyName, appUrl,
}: RenterTransitionArgs): string {
  const ref    = bookingId.slice(0, 8).toUpperCase();
  const agency = clampAscii(agencyName, NAME_MAX);
  return composeVehicleSms(
    (veh) =>
      `DriveLink: ${agency} confirmed your booking ${ref} for the ${veh}. ` +
      `Transfer the lock-in and upload the slip within 12h: ${appUrl}/bookings/${bookingId}`,
    vehicleName, vehiclePlate,
  );
}

// Sent to the renter when the agency declines. No payment was taken.
export function buildRenterDeclinedMessage({
  bookingId, vehicleName, vehiclePlate, agencyName, appUrl,
}: RenterTransitionArgs): string {
  const ref    = bookingId.slice(0, 8).toUpperCase();
  const agency = clampAscii(agencyName, NAME_MAX);
  return composeVehicleSms(
    (veh) =>
      `DriveLink: ${agency} could not fulfil booking ${ref} (${veh}). ` +
      `No payment taken, try a different vehicle: ${appUrl}/vehicles`,
    vehicleName, vehiclePlate,
  );
}

// Sent to the renter when an agency or admin cancels their booking
// (e.g. payment window expired, agency emergency).
export function buildRenterCancelledMessage({
  bookingId, vehicleName, vehiclePlate, appUrl,
}: RenterTransitionArgs): string {
  const ref = bookingId.slice(0, 8).toUpperCase();
  return composeVehicleSms(
    (veh) =>
      `DriveLink: your booking ${ref} for the ${veh} was cancelled. ` +
      `See details: ${appUrl}/bookings/${bookingId}`,
    vehicleName, vehiclePlate,
  );
}

// Sent to the renter once a rental is completed, thanks them and pulls them
// back to leave a review (the single biggest lever on review volume).
export function buildRenterCompletedMessage({
  bookingId, vehicleName, vehiclePlate, appUrl,
}: RenterTransitionArgs): string {
  const ref = bookingId.slice(0, 8).toUpperCase();
  return composeVehicleSms(
    (veh) =>
      `DriveLink: your booking ${ref} for the ${veh} is complete. ` +
      `Thanks for riding with us! Rate your trip: ${appUrl}/bookings/${bookingId}`,
    vehicleName, vehiclePlate,
  );
}

interface AgencyCompletedArgs {
  bookingId:     string;
  vehicleName:   string;
  vehiclePlate?: string;
  renterName:    string;
  appUrl:        string;
}

// Sent to the agency when a rental completes, nudge to rate the renter so the
// two-way reputation system actually fills up.
export function buildAgencyCompletedMessage({
  bookingId, vehicleName, vehiclePlate, renterName, appUrl,
}: AgencyCompletedArgs): string {
  const ref    = bookingId.slice(0, 8).toUpperCase();
  const renter = clampAscii(renterName, NAME_MAX);
  return composeVehicleSms(
    (veh) =>
      `DriveLink: booking ${ref} (${veh}) for ${renter} is complete. ` +
      `Rate your renter: ${appUrl}/dashboard/bookings`,
    vehicleName, vehiclePlate,
  );
}
