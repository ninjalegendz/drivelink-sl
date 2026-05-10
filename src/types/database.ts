export type InsuranceType = "private" | "hire";
export type FuelPolicy = "full_to_full" | "same_to_same";
export type VehicleStatus = "available" | "rented" | "maintenance" | "unlisted" | "pending_review";
export type BookingStatus =
  | "requested"
  | "pending_confirmation"
  | "confirmed"
  | "payment_pending"
  | "active"
  | "completed"
  | "declined"
  | "cancelled"
  | "disputed";
export type KycStatus = "unverified" | "pending" | "verified" | "rejected";
export type UserRole = "renter" | "agency_owner" | "admin";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          full_name: string;
          phone: string;
          phone_verified: boolean;
          kyc_status: KycStatus;
          nic_url: string | null;
          selfie_url: string | null;
          is_blacklisted: boolean;
          blacklist_reason: string | null;
          rating_avg: number | null;
          rating_count: number;
          reliability_pct: number | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          full_name: string;
          phone: string;
          phone_verified?: boolean;
          kyc_status?: KycStatus;
          nic_url?: string | null;
          selfie_url?: string | null;
          is_blacklisted?: boolean;
          blacklist_reason?: string | null;
          rating_avg?: number | null;
          rating_count?: number;
          reliability_pct?: number | null;
          avatar_url?: string | null;
        };
        Update: {
          role?: UserRole;
          full_name?: string;
          phone?: string;
          phone_verified?: boolean;
          kyc_status?: KycStatus;
          nic_url?: string | null;
          selfie_url?: string | null;
          is_blacklisted?: boolean;
          blacklist_reason?: string | null;
          rating_avg?: number | null;
          rating_count?: number;
          reliability_pct?: number | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      agencies: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          address: string | null;
          city: string;
          whatsapp_number: string;
          is_verified: boolean;
          is_blocked: boolean;
          cancellation_count: number;
          confirmed_count: number;
          strike_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          description?: string | null;
          address?: string | null;
          city: string;
          whatsapp_number: string;
          is_verified?: boolean;
          is_blocked?: boolean;
          cancellation_count?: number;
          confirmed_count?: number;
          strike_count?: number;
        };
        Update: {
          owner_id?: string;
          name?: string;
          description?: string | null;
          address?: string | null;
          city?: string;
          whatsapp_number?: string;
          is_verified?: boolean;
          is_blocked?: boolean;
          cancellation_count?: number;
          confirmed_count?: number;
          strike_count?: number;
        };
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          agency_id: string;
          make: string;
          model: string;
          year: number;
          color: string | null;
          plate_number: string | null;
          insurance_type: InsuranceType;
          fuel_policy: FuelPolicy;
          daily_rate_lkr: number;
          monthly_rate_lkr: number | null;
          deposit_lkr: number;
          seats: number;
          transmission: string;
          features: string[] | null;
          description: string | null;
          status: VehicleStatus;
          city: string;
          slug: string;
          photos: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agency_id: string;
          make: string;
          model: string;
          year: number;
          color?: string | null;
          plate_number?: string | null;
          insurance_type: InsuranceType;
          fuel_policy?: FuelPolicy;
          daily_rate_lkr: number;
          monthly_rate_lkr?: number | null;
          deposit_lkr?: number;
          seats?: number;
          transmission?: string;
          features?: string[] | null;
          description?: string | null;
          status?: VehicleStatus;
          city: string;
          slug: string;
          photos?: string[] | null;
        };
        Update: {
          agency_id?: string;
          make?: string;
          model?: string;
          year?: number;
          color?: string | null;
          plate_number?: string | null;
          insurance_type?: InsuranceType;
          fuel_policy?: FuelPolicy;
          daily_rate_lkr?: number;
          monthly_rate_lkr?: number | null;
          deposit_lkr?: number;
          seats?: number;
          transmission?: string;
          features?: string[] | null;
          description?: string | null;
          status?: VehicleStatus;
          city?: string;
          slug?: string;
          photos?: string[] | null;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          vehicle_id: string;
          agency_id: string;
          renter_id: string;
          status: BookingStatus;
          start_date: string;
          end_date: string;
          total_days: number;
          daily_rate_lkr: number;
          subtotal_lkr: number;
          booking_fee_lkr: number;
          slip_url: string | null;
          slip_verified_at: string | null;
          ocr_amount_lkr: number | null;
          ocr_date: string | null;
          agency_phone: string | null;
          confirmed_at: string | null;
          payment_received_at: string | null;
          activated_at: string | null;
          completed_at: string | null;
          declined_at: string | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
          dispute_reason: string | null;
          damage_reported: boolean;
          damage_notes: string | null;
          damage_photo_urls: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          agency_id: string;
          renter_id: string;
          status?: BookingStatus;
          start_date: string;
          end_date: string;
          daily_rate_lkr: number;
          subtotal_lkr?: number;
          booking_fee_lkr?: number;
          slip_url?: string | null;
          slip_verified_at?: string | null;
          ocr_amount_lkr?: number | null;
          ocr_date?: string | null;
          agency_phone?: string | null;
          confirmed_at?: string | null;
          payment_received_at?: string | null;
          activated_at?: string | null;
          completed_at?: string | null;
          declined_at?: string | null;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
          dispute_reason?: string | null;
          damage_reported?: boolean;
          damage_notes?: string | null;
          damage_photo_urls?: string[] | null;
        };
        Update: {
          status?: BookingStatus;
          slip_url?: string | null;
          slip_verified_at?: string | null;
          ocr_amount_lkr?: number | null;
          ocr_date?: string | null;
          agency_phone?: string | null;
          confirmed_at?: string | null;
          payment_received_at?: string | null;
          activated_at?: string | null;
          completed_at?: string | null;
          declined_at?: string | null;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
          dispute_reason?: string | null;
          damage_reported?: boolean;
          damage_notes?: string | null;
          damage_photo_urls?: string[] | null;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          booking_id: string;
          reviewer_id: string;
          reviewee_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          reviewer_id: string;
          reviewee_id: string;
          rating: number;
          comment?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      wallet_transactions: {
        Row: {
          id: string;
          user_id: string;
          amount_lkr: number;
          type: string;
          booking_id: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount_lkr: number;
          type: string;
          booking_id?: string | null;
          description?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      agency_penalties: {
        Row: {
          id: string;
          agency_id: string;
          booking_id: string;
          amount_lkr: number;
          reason: string;
          waived: boolean;
          waive_proof_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          agency_id: string;
          booking_id: string;
          amount_lkr?: number;
          reason: string;
          waived?: boolean;
          waive_proof_url?: string | null;
        };
        Update: {
          amount_lkr?: number;
          reason?: string;
          waived?: boolean;
          waive_proof_url?: string | null;
        };
        Relationships: [];
      };
      blacklist_reports: {
        Row: {
          id: string;
          reported_nic: string;
          reported_by: string;
          booking_id: string;
          reason: string;
          approved: boolean | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reported_nic: string;
          reported_by: string;
          booking_id: string;
          reason: string;
          approved?: boolean | null;
          reviewed_at?: string | null;
        };
        Update: {
          approved?: boolean | null;
          reviewed_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      wallet_balances: {
        Row: {
          user_id: string;
          balance_lkr: number;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      insurance_type: InsuranceType;
      fuel_policy: FuelPolicy;
      vehicle_status: VehicleStatus;
      booking_status: BookingStatus;
      kyc_status: KycStatus;
      user_role: UserRole;
    };
    CompositeTypes: Record<string, never>;
  };
};
