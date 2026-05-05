import { RiDeleteBin2Line } from "@remixicon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";

import type { ImageInfo } from "../../../api/src/image/image.service";
import ImageUploader from "@/components/ImageUploader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useTRPC, useTRPCClient } from "@/trpc";

export default function TrackEditPage() {
  const id = useParams<{ trackId: string }>().trackId!;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const query = useQuery(trpc.track.getRecordedTrack.queryOptions({ id }));

  usePageTitle(query.data?.name ? `Edit: ${query.data.name}` : "Edit Track");

  const [name, setName] = useState<string | undefined>(undefined);
  const displayName = name ?? query.data?.name ?? "";

  const updateMutation = useMutation(
    trpc.track.updateRecordedTrack.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.track.pathFilter());
      },
    }),
  );

  const handleSaveName = () => {
    updateMutation.mutate({ id, name: displayName || null });
  };

  if (query.isLoading) return <div className="p-8">Loading...</div>;
  if (!query.data) return <div className="p-8">Track not found.</div>;

  return (
    <div className="mx-auto w-full max-w-xl space-y-8 p-8">
      <section className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="track-name">Name</Label>
          <Input
            id="track-name"
            value={displayName}
            onChange={e => setName(e.target.value)}
            placeholder="Unnamed track"
          />
        </div>
        <Button onClick={handleSaveName} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? "Saving…" : "Save"}
        </Button>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Photos</h2>
        <ImageUploader linkedTrackId={id} />
        <TrackImageList id={id} />
      </section>
    </div>
  );
}

interface DeleteConfirmState {
  image: ImageInfo;
  alsoDeleteFromAccount: boolean;
}

function TrackImageList({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const [pending, setPending] = useState<DeleteConfirmState | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: images } = useQuery(
    trpc.track.getRecordedTrack.queryOptions(
      { id },
      { select: d => d?.images },
    ),
  );
  if (!images || images.length === 0) return null;

  const handleConfirmDelete = async () => {
    if (!pending) return;
    setIsDeleting(true);
    try {
      if (pending.alsoDeleteFromAccount) {
        await trpcClient.image.delete.mutate({ s3Key: pending.image.s3Key });
        queryClient.invalidateQueries(trpc.image.pathFilter());
      } else {
        await trpcClient.image.unlinkFromTrack.mutate({
          s3Key: pending.image.s3Key,
          trackId: id,
        });
      }
      queryClient.invalidateQueries(trpc.track.pathFilter());
    } finally {
      setIsDeleting(false);
      setPending(null);
    }
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {images.map(img => (
          <TrackImage
            key={img.s3Key}
            image={img}
            onDelete={() =>
              setPending({ image: img, alsoDeleteFromAccount: false })
            }
          />
        ))}
      </div>

      <Dialog
        open={pending !== null}
        onOpenChange={open => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove image</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3 py-2">
            <Checkbox
              id="also-delete"
              checked={pending?.alsoDeleteFromAccount ?? false}
              onCheckedChange={checked =>
                pending &&
                setPending({
                  ...pending,
                  alsoDeleteFromAccount: checked === true,
                })
              }
            />
            <Label htmlFor="also-delete">Also delete from my account</Label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPending(null)}
              disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}>
              {isDeleting ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TrackImage({
  image,
  onDelete,
}: {
  image: ImageInfo;
  onDelete: () => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded border border-gray-200">
      <img
        src={image.imageSmallSquare.src}
        width={image.imageSmallSquare.width}
        height={image.imageSmallSquare.height}
        alt=""
        className="aspect-square w-full object-cover"
      />
      <button
        type="button"
        onClick={onDelete}
        className="absolute top-1 right-1 rounded bg-white/80 p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white">
        <RiDeleteBin2Line className="size-4 text-red-600" />
      </button>
    </div>
  );
}
