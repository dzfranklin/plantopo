import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc";

export default function MyPicturesPage() {
  const trpc = useTRPC();
  const { data: images } = useQuery(trpc.image.list.queryOptions());

  return (
    <div className="mx-auto max-w-5xl p-4">
      <h1 className="mb-4 text-2xl font-bold">My Pictures</h1>
      <div className="flex flex-wrap gap-4">
        {images?.map(image => (
          <div key={image.s3Key} className="bg-muted overflow-hidden rounded">
            <img {...image.imageSmallSquare} alt="" />
          </div>
        ))}
      </div>
    </div>
  );
}
