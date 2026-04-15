import { PlanEditor } from "./PlanEditor";
import { usePageTitle } from "@/usePageTitle";

export default function PlanPage() {
  usePageTitle("Route Planner");
  return <PlanEditor />;
}
