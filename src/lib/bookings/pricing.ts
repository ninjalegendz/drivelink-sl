// Booking subtotal calculation, shared between the API and the booking form.
// One full month = 30 days. If the agency hasn't set a monthly rate, every
// day is charged at daily_rate.

export const DAYS_PER_MONTH = 30;

export interface PriceBreakdown {
  fullMonths:    number;
  remainingDays: number;
  monthsCost:    number;
  daysCost:      number;
  subtotal:      number;
}

export function calcBookingPrice(
  days:           number,
  dailyRateLkr:   number,
  monthlyRateLkr: number | null | undefined,
): PriceBreakdown {
  if (days <= 0) {
    return { fullMonths: 0, remainingDays: 0, monthsCost: 0, daysCost: 0, subtotal: 0 };
  }

  if (monthlyRateLkr && days >= DAYS_PER_MONTH) {
    const fullMonths    = Math.floor(days / DAYS_PER_MONTH);
    const remainingDays = days - fullMonths * DAYS_PER_MONTH;
    const monthsCost    = fullMonths * monthlyRateLkr;
    const daysCost      = remainingDays * dailyRateLkr;
    return { fullMonths, remainingDays, monthsCost, daysCost, subtotal: monthsCost + daysCost };
  }

  const daysCost = days * dailyRateLkr;
  return { fullMonths: 0, remainingDays: days, monthsCost: 0, daysCost, subtotal: daysCost };
}
