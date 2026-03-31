import { useParams } from "react-router-dom";

import { usePageTitle } from "@/usePageTitle";

export default function TripEditorPage() {
  usePageTitle("Trip Editor");
  const { tripId } = useParams() as { tripId: string };
  return <div>Trip editor (stub) — tripId: {tripId}</div>;
}
