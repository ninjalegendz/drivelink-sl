import type { SupabaseClient } from "@supabase/supabase-js";
import { hashOtp } from "@/lib/sms/otp";

export type OtpChallengePurpose = "login" | "phone_verify" | "signup";

export type OtpChallengeIssueResult = {
  ok: boolean;
  reason?: "cooldown";
  wait_sec?: number;
  next_cooldown_sec?: number;
};

export type OtpChallengeVerifyResult = {
  ok: boolean;
  reason?: "no_challenge" | "expired" | "already_used" | "too_many_attempts" | "invalid_code";
  attempts_left?: number;
};

export function otpChallengeSubject(kind: "profile" | "signup" | "page", id: string): string {
  return `${kind}:${id}`;
}

function otpChallengeSalt(subject: string, purpose: OtpChallengePurpose): string {
  return `otp-v1:${purpose}:${subject}`;
}

export async function issueOtpChallenge(
  service: SupabaseClient,
  subject: string,
  purpose: OtpChallengePurpose,
  code: string,
): Promise<{ result: OtpChallengeIssueResult; codeHash: string }> {
  const codeHash = await hashOtp(code, otpChallengeSalt(subject, purpose));
  const { data, error } = await service.rpc("issue_otp_challenge", {
    p_subject_key: subject,
    p_purpose: purpose,
    p_code_hash: codeHash,
  });
  if (error) throw new Error(error.message);
  return { result: data as OtpChallengeIssueResult, codeHash };
}

export async function verifyOtpChallenge(
  service: SupabaseClient,
  subject: string,
  purpose: OtpChallengePurpose,
  code: string,
): Promise<OtpChallengeVerifyResult> {
  const candidateHash = await hashOtp(code, otpChallengeSalt(subject, purpose));
  const { data, error } = await service.rpc("verify_otp_challenge", {
    p_subject_key: subject,
    p_purpose: purpose,
    p_candidate_hash: candidateHash,
  });
  if (error) throw new Error(error.message);
  return data as OtpChallengeVerifyResult;
}

// Called only after a delivery provider reports that it could not send the
// current code. Matching the exact hash prevents an older failed request from
// deleting a newer one.
export async function discardUndeliveredOtpChallenge(
  service: SupabaseClient,
  subject: string,
  purpose: OtpChallengePurpose,
  codeHash: string,
): Promise<void> {
  const { error } = await service
    .from("otp_challenges")
    .delete()
    .eq("subject_key", subject)
    .eq("purpose", purpose)
    .eq("code_hash", codeHash);
  if (error) console.error("[otp challenge] discard", error);
}

export function otpVerificationError(result: OtpChallengeVerifyResult): { error: string; status: number } {
  if (result.reason === "no_challenge") return { error: "Request a code first.", status: 400 };
  if (result.reason === "expired") return { error: "Code expired. Request a new one.", status: 400 };
  if (result.reason === "already_used") return { error: "That code was already used. Request a new one.", status: 400 };
  if (result.reason === "too_many_attempts") return { error: "Too many failed attempts. Request a new code.", status: 429 };
  if (result.reason === "invalid_code") {
    const remaining = result.attempts_left ?? 0;
    return {
      error: remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`
        : "Incorrect code. Request a new one.",
      status: 400,
    };
  }
  return { error: "Code expired or invalid. Request a new one.", status: 400 };
}
