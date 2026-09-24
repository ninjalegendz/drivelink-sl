"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Input";
import { containsPublicContactDetails, PUBLIC_CONTACT_ERROR } from "@/lib/content/public-contact";

interface Props {
  bookingId:   string;
  revieweeId:  string;
  /** Who's being reviewed, an agency name (renter→agency) or renter name (agency→renter). */
  subjectName: string;
  /** Called after a successful insert (before the page refresh). */
  onSubmitted?: () => void;
}

export function ReviewForm({ bookingId, revieweeId, subjectName, onSubmitted }: Props) {
  const router = useRouter();
  const [rating, setRating]     = useState(0);
  const [hover, setHover]       = useState(0);
  const [comment, setComment]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [, startTransition]     = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (rating === 0) {
      setError("Please pick a star rating.");
      return;
    }
    if (containsPublicContactDetails(comment)) {
      setError(PUBLIC_CONTACT_ERROR);
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You need to be signed in.");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("reviews").insert({
      booking_id:  bookingId,
      reviewer_id: user.id,
      reviewee_id: revieweeId,
      rating,
      comment:     comment.trim() || null,
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    onSubmitted?.();
    startTransition(() => router.refresh());
  }

  const display = hover || rating;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium text-slate-600">How was {subjectName}?</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className={`min-h-11 min-w-11 transition-transform hover:scale-110 ${
                n <= display ? "text-amber-400" : "text-slate-300"
              }`}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
            >
              <Star size={28} fill={n <= display ? "currentColor" : "transparent"} className="mx-auto" />
            </button>
          ))}
        </div>
      </div>

      <Field label="Comment" hint="Optional">
        {(field) => (
          <Textarea
            {...field}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="What did you like or wish was better?"
          />
        )}
      </Field>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <Button type="submit" loading={loading} size="md">
        Submit review
      </Button>
    </form>
  );
}
