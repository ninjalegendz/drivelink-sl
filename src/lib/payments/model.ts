/**
 * Current commercial model. Changing a monetary value here is not enough to
 * collect money: the database intentionally rejects nonzero launch fees until
 * a payment-gateway migration and its checkout flow are deployed together.
 */
export const LAUNCH_BOOKING_CONFIRMATION_FEE_LKR = 0 as const;

export const PAYMENT_MODEL = {
  listingFeeLkr: 0,
  providerCommissionPercent: 0,
  bookingConfirmationFeeLkr: LAUNCH_BOOKING_CONFIRMATION_FEE_LKR,
  rentalAndDepositPaidDirectlyToProvider: true,
} as const;
