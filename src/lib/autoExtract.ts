// Fires the extract-graph edge function in the background after every Nth
// signal (check-in or chat message). Uses localStorage as a tiny counter so
// we don't spam the AI gateway on every tiny action.
import { supabase } from "@/integrations/supabase/client";

const KEY = "lovable.autoExtract.counter";
const EVERY_N = 3;

export function bumpAutoExtract() {
  try {
    const n = Number(localStorage.getItem(KEY) || "0") + 1;
    localStorage.setItem(KEY, String(n));
    if (n % EVERY_N !== 0) return;

    // fire-and-forget — don't block UI
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-graph`;
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => {
        // silent — this is best-effort
      });
    })();
  } catch {
    // localStorage may be unavailable (private mode) — silently skip
  }
}
