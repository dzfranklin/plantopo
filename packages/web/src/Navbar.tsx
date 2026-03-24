import { getUser } from "./auth.tsx";

export function Navbar() {
  const user = getUser();

  return (
    <nav>
      <span>PlanTopo</span>
      {user && <span>{" " + user.name}</span>}
    </nav>
  );
}
