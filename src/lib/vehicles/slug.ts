export function buildVehicleSlug(make: string, model: string, city: string, year: number): string {
  return [make, model, city, year]
    .join("-")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

// Parses a URL segment like "wagon-r-colombo" into { model, city }
export function parseRentQuery(query: string): { model: string; city: string } | null {
  const parts = query.split("-");
  if (parts.length < 2) return null;

  // Try to match the last part as a city (cities can be multi-word so check last 1-2 parts)
  // We keep it simple: last segment = city, everything before = model
  const city = parts[parts.length - 1];
  const model = parts.slice(0, -1).join(" ");

  return { model, city };
}

export function buildRentPath(model: string, city: string): string {
  return `/rent/${[model, city].join("-").toLowerCase().replace(/\s+/g, "-")}`;
}
