import { createBrowserClient } from "@supabase/ssr";

type HeaderMap = Record<string, string | undefined>;

export function createClient(headers?: HeaderMap) {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      global: {
        headers: headers ?? {},
      },
    }
  );
}
