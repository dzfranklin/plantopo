import { PlanEditor } from "./PlanEditor";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function PlanPage() {
  usePageTitle("Route Planner");
  return <PlanEditor />;
}
