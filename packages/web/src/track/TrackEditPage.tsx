import { RiDeleteBin2Line } from "@remixicon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import type { ImageInfo } from "@pt/api";

import { ImageUploaderDialog } from "@/components/ImageUploader";
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
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useTRPC } from "@/trpc";
import { cn } from "@/util/cn";

export default function TrackEditPage() {
  const id = useParams<{ trackId: string }>().trackId!;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const query = useQuery(trpc.track.getTrack.queryOptions({ id }));

  usePageTitle(query.data?.name ? `Edit: ${query.data.name}` : "Edit Track");

  const [name, setName] = useState<string | undefined>(undefined);
  const displayName = name ?? query.data?.name ?? "";

  const updateMutation = useMutation(
    trpc.track.updateTrack.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.track.pathFilter());
      },
    }),
  );

  const handleSaveName = () => {
    updateMutation.mutate({ id, name: displayName || null });
  };

  return (
    <div className="mx-auto w-full max-w-xl space-y-8 p-8">
      <div>
        <Link to={`/track/${id}`} className={cn("text-sm", "text-blue-600")}>
          ← Back to track
        </Link>
      </div>

      <section className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="track-name">Name</Label>
          <Input
            id="track-name"
            value={displayName}
            onChange={e => setName(e.target.value)}
            placeholder={query.isLoading ? "Loading..." : "Unnamed track"}
            disabled={query.isLoading}
          />
        </div>
        <Button
          onClick={handleSaveName}
          disabled={updateMutation.isPending || query.isLoading}>
          {updateMutation.isPending ? "Saving…" : "Save"}
        </Button>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Photos</h2>
        <TrackImageEditer id={id} />
      </section>
    </div>
  );
}

interface DeleteConfirmState {
  image: ImageInfo;
  alsoDeleteFromAccount: boolean;
}

function TrackImageEditer({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const [pending, setPending] = useState<DeleteConfirmState | null>(null);

  const { data: images } = useQuery(
    trpc.track.getTrack.queryOptions({ id }, { select: d => d?.images }),
  );

  const deleteMutation = useMutation(
    trpc.image.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.image.pathFilter());
        queryClient.invalidateQueries(trpc.track.pathFilter());
        setPending(null);
      },
    }),
  );

  const unlinkMutation = useMutation(
    trpc.image.unlinkFromTrack.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.track.pathFilter());
        setPending(null);
      },
    }),
  );

  const isDeleting = deleteMutation.isPending || unlinkMutation.isPending;

  const handleConfirmDelete = () => {
    if (!pending) return;
    if (pending.alsoDeleteFromAccount) {
      deleteMutation.mutate({ s3Key: pending.image.id });
    } else {
      unlinkMutation.mutate({ s3Key: pending.image.id, trackId: id });
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-4">
        {!images && <Skeleton className="size-[160px]" />}

        {images?.map(img => (
          <TrackImageEdit
            key={img.id}
            image={img}
            onDelete={() =>
              setPending({ image: img, alsoDeleteFromAccount: false })
            }
          />
        ))}

        <ImageUploaderDialog
          linkedTrackId={id}
          trigger={
            <ImageUploaderDialog.Trigger className="size-[160px]" />
          }></ImageUploaderDialog>
      </div>

      <Dialog
        open={pending !== null}
        onOpenChange={open => !open && setPending(null)}>
        <DialogContent aria-describedby={undefined}>
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

function TrackImageEdit({
  image,
  onDelete,
}: {
  image: ImageInfo;
  onDelete: () => void;
}) {
  return (
    <div className="group relative size-[160px] overflow-hidden rounded border border-gray-200">
      <img
        src={image.imageSmallSquare.src}
        width={image.imageSmallSquare.width}
        height={image.imageSmallSquare.height}
        alt={image.filename}
        className="aspect-square w-full object-cover"
      />
      <button
        type="button"
        onClick={onDelete}
        className="absolute top-1 right-1 rounded bg-white/80 p-1 transition-colors hover:bg-white">
        <RiDeleteBin2Line className="size-4 text-red-600" />
      </button>
    </div>
  );
}
