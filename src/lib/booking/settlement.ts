// Shared final-settlement math (BUILD 3 / MONEY-005). One authoritative
// statement both the owner and renter see: the rental (already agreed/paid),
// itemised extra charges from the ledger, and the security deposit - netted to
// a single "renter still owes" / "owner refunds" figure. Deposit is part of the
// statement so a future platform-mediated payment reads the same structure.

export const CHARGE_KINDS = [
  "extra_km", "fuel", "late", "cleaning", "damage", "delivery", "driver", "toll", "other",
] as const;
export type ChargeKind = (typeof CHARGE_KINDS)[number];

export const CHARGE_KIND_LABELS: Record<ChargeKind, string> = {
  extra_km: "Extra kilometres",
  fuel:     "Fuel difference",
  late:     "Late return",
  cleaning: "Cleaning",
  damage:   "Damage",
  delivery: "Delivery",
  driver:   "Driver allowance",
  toll:     "Tolls / fines",
  other:    "Other",
};

export interface ChargeLine {
  id: string;
  kind: ChargeKind;
  label: string | null;
  amount_lkr: number;
}

export interface SettlementInput {
  rentalSubtotalLkr: number;
  depositHeldLkr:    number;  // deposit actually held (0 if none was taken)
  charges:           ChargeLine[];
}

export interface Settlement {
  rentalSubtotalLkr: number;
  chargesTotalLkr:   number;
  depositHeldLkr:    number;
  /** Positive = renter still owes; negative = owner refunds; 0 = square. */
  netLkr:            number;
  charges:           ChargeLine[];
}

/**
 * The ledger is the single settlement source of truth: net = extra charges - 
 * deposit held. The rental itself is paid directly at pickup, so it's shown for
 * context but not re-charged. Owner refunds when net < 0, collects the balance
 * when net > 0. Deposit is part of the statement so a future platform-mediated
 * payment can read the same figure without a redesign.
 */
export function computeSettlement(input: SettlementInput): Settlement {
  const chargesTotalLkr = input.charges.reduce((sum, c) => sum + (c.amount_lkr || 0), 0);
  const netLkr = chargesTotalLkr - input.depositHeldLkr;
  return {
    rentalSubtotalLkr: input.rentalSubtotalLkr,
    chargesTotalLkr,
    depositHeldLkr: input.depositHeldLkr,
    netLkr,
    charges: input.charges,
  };
}
