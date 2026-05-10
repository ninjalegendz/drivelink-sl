"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

interface Props {
  bookingId:   string;
  revieweeId:  string;
  agencyName:  string;
}

export function ReviewForm({ bookingId, revieweeId, agencyName }: Props) {
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

    startTransition(() => router.refresh());
  }

  const display = hover || rating;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <p className="text-slate-400 text-xs mb-2">How was {agencyName}?</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className={`transition-transform hover:scale-110 ${
                n <= display ? "text-amber-400" : "text-slate-700"
              }`}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
            >
              <Star size={28} fill={n <= display ? "currentColor" : "transparent"} />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-slate-400 text-xs mb-1 block">
          Comment <span className="text-slate-600">(optional)</span>
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="What did you like or wish was better?"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 resize-none"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <Button type="submit" loading={loading} size="md">
        Submit review
      </Button>
    </form>
  );
}
