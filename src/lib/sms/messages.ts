// SMS message templates. Plain ASCII, single-segment-friendly (≤160 chars
// where possible). Anything multi-segment gets split + billed by text.lk
// per 153-char chunk in concatenated mode.

interface AgencyPingArgs {
  bookingId:    string;
  renterName:   string;
  vehicleName:  string;
  startDate:    string;
  endDate:      string;
  totalDays:    number;
  appUrl:       string;
}

// Sent to the agency the moment a renter requests a vehicle. The agency
// confirms by clicking through to the dashboard, not by replying.
export function buildAgencyPingMessage({
  bookingId,
  renterName,
  vehicleName,
  startDate,
  endDate,
  totalDays,
  appUrl,
}: AgencyPingArgs): string {
  const ref  = bookingId.slice(0, 8).toUpperCase();
  const days = `${totalDays}d`;
  return (
    `DriveLink: new booking ${ref}. ${vehicleName}, ` +
    `${startDate} to ${endDate} (${days}). Renter: ${renterName}. ` +
    `Confirm or decline: ${appUrl}/dashboard/bookings`
  );
}

interface RenterTransitionArgs {
  bookingId:   string;
  vehicleName: string;
  agencyName:  string;
  appUrl:      string;
}

// Sent to the renter once the agency (or admin acting for them) accepts
// the booking. The renter now has 12h to upload a payment slip.
export function buildRenterConfirmedMessage({
  bookingId,
  vehicleName,
  agencyName,
  appUrl,
}: RenterTransitionArgs): string {
  const ref = bookingId.slice(0, 8).toUpperCase();
  return (
    `DriveLink: ${agencyName} confirmed your booking ${ref} for the ${vehicleName}. ` +
    `Transfer Rs. 500 and upload the slip within 12h to lock it in: ${appUrl}/bookings/${bookingId}`
  );
}

// Sent to the renter when the agency declines. No payment was taken.
export function buildRenterDeclinedMessage({
  bookingId,
  vehicleName,
  agencyName,
  appUrl,
}: RenterTransitionArgs): string {
  const ref = bookingId.slice(0, 8).toUpperCase();
  return (
    `DriveLink: ${agencyName} could not fulfil booking ${ref} (${vehicleName}). ` +
    `No payment taken — try a different vehicle: ${appUrl}/vehicles`
  );
}

// Sent to the renter when an agency or admin cancels their booking
// (e.g. payment window expired, agency emergency).
export function buildRenterCancelledMessage({
  bookingId,
  vehicleName,
  appUrl,
}: RenterTransitionArgs): string {
  const ref = bookingId.slice(0, 8).toUpperCase();
  return (
    `DriveLink: your booking ${ref} for the ${vehicleName} was cancelled. ` +
    `See details: ${appUrl}/bookings/${bookingId}`
  );
}
