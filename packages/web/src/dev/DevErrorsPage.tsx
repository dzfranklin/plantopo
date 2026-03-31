import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { authClient } from "@/auth/auth-client";
import { authKeys } from "@/auth/queryKeys";
import { Button } from "@/components/ui/button";

export default function DevErrorPage() {
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
