/** Unwrap a supabase functions.invoke failure into the function's real
 * message — a non-2xx throws a generic FunctionsHttpError; the useful text
 * ("No Meta access token configured…") is in the response body, reachable
 * via error.context. Every browser invoke() call should surface errors
 * through this. */
// deno-lint-ignore-file no-explicit-any
export async function invokeErrorText(data: any, error: unknown): Promise<string> {
  let text: string | null = (data?.error as string | undefined) ?? null;
  if (!text && error && typeof error === 'object' && 'context' in error) {
    try {
      text = (await ((error as { context: Response }).context).json())?.error ?? null;
    } catch {
      /* body not JSON — fall through */
    }
  }
  return text ?? (error as Error | null)?.message ?? 'Request failed';
}
