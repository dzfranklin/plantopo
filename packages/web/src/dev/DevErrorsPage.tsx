import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/auth/auth-client";
import { authKeys } from "@/auth/queryKeys";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/usePageTitle";

export default function DevErrorPage() {
  usePageTitle("dev:Errors");

  const [enableListSessionsQuery, setEnableListSessionsQuery] = useState(false);

  const listSessionsQuery = useQuery({
    queryKey: authKeys.sessions(),
    queryFn: async () => {
      const { data, error } = await authClient.listSessions();
      if (error) throw error;
      return data;
    },
    enabled: enableListSessionsQuery,
  });

  return (
    <div className="p-8">
      <ul>
        <li>
          <Button
            onClick={() =>
              toast.error("This is a test error toast!", {
                description: "You can put more info here if needed.",
                duration: 1000 * 60,
              })
            }>
            Show error toast
          </Button>
        </li>
        <li>
          <Button onClick={() => setEnableListSessionsQuery(true)}>
            Make better-auth request requiring auth (listSessions)
          </Button>
          {listSessionsQuery.data && "GOT DATA"}
          {listSessionsQuery.error &&
            "GOT ERROR: " + JSON.stringify(listSessionsQuery.error)}
        </li>
      </ul>
    </div>
  );
}
