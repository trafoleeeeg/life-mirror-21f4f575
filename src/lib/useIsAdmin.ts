// Хук проверки роли admin через security-definer функцию has_role.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    let cancel = false;
    setLoading(true);
    supabase
      .rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data }) => {
        if (!cancel) {
          setIsAdmin(Boolean(data));
          setLoading(false);
        }
      });
    return () => {
      cancel = true;
    };
  }, [user]);

  return { isAdmin, loading };
}
