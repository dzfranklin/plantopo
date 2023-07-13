import { useParams } from 'react-router-dom';

export default function MapPage() {
  const params = useParams();
  return <div>Map {params.id}</div>;
}
