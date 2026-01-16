import { createBrowserClient } from "@supabase/ssr";

type HeaderMap = Record<string, string>;

export function createClient(headers?: HeaderMap) {
  const safeHeaders: HeaderMap = headers
    ? Object.fromEntries(
        Object.entries(headers).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        )
      )
    : {};

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      global: {
        headers: safeHeaders,
      },
    }
  );
}
