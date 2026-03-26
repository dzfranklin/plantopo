import { useParams } from "react-router-dom";

export default function TripEditorPage() {
  const { tripId } = useParams() as { tripId: string };
  return <div>Trip editor (stub) — tripId: {tripId}</div>;
}
