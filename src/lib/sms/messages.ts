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
