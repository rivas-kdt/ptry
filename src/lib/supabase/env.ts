function required(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

// Accessed as literal `process.env.X` so Next.js can inline them into client bundles.
export const supabaseUrl = () =>
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

export const supabasePublishableKey = () =>
  required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

/** Server-only key. Used to cache Mapbox Search hits into `destinations` / `places`. */
export const supabaseSecretKey = () => required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
