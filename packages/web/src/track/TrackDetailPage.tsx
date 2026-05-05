import { useQuery } from "@tanstack/react-query";
import { featureCollection, lineString, point } from "@turf/helpers";
import { Dialog } from "radix-ui";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import type { ImageSrc } from "@pt/api";
import type { Point2 } from "@pt/shared";

import type { RecordedTrack } from "../../../api/src/track/track.service";
import { decodePolyline } from "../../../shared/src/polyline";
import ElevationChart from "@/components/ElevationChart";
import { formatInstant } from "@/components/format";
import { AppMap } from "@/components/map";
import { Button } from "@/components/ui/button";
import { Carousel, type CarouselApi } from "@/components/ui/carousel";
import useAnimationThrottledState from "@/hooks/useAnimationThrottledState";
import { usePageTitle } from "@/hooks/usePageTitle";
import { type AppUseQueryResult, useTRPC } from "@/trpc";
import { cn } from "@/util/cn";

export default function TrackDetailPage() {
  const id = useParams().trackId!;
  const query = useTrackDetailQuery(id);
  const navigate = useNavigate();

  usePageTitle(
    query.data
      ? query.data.name
        ? `Track: ${query.data.name}`
        : `Track on ${formatInstant(query.data.startTime, "date")}`
      : "Track",
  );

  const [hoveredPoint, setHoveredPoint] =
    useAnimationThrottledState<Point2 | null>(null);

  const geojson = useMemo(() => {
    if (!query.data) return null;

    const fc = featureCollection<GeoJSON.Geometry>([
      lineString(query.data.coordinates, {
        stroke: "hsl(240 91% 47%)",
        "stroke-width": 5,
      }),
    ]);

    if (hoveredPoint) {
      fc.features.push(
        point(hoveredPoint, {
          "marker-color": "hsl(240 91.2% 90%)",
        }),
      );
    }

    return fc;
  }, [hoveredPoint, query.data]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-8">
      <h1 className="flex items-baseline justify-between gap-4 text-2xl font-bold">
        Track Detail
        <Button variant="outline" onClick={() => navigate(`/track/${id}/edit`)}>
          Edit
        </Button>
      </h1>
      {query.isLoading && <p>Loading...</p>}
      {query.data && (
        <div className="rounded border p-4">
          <p className="font-semibold">{query.data.name}</p>
          <p className="text-sm text-gray-600">
            Recorded at {new Date(query.data.createdAt).toLocaleString()}
          </p>
        </div>
      )}

      {query.data ? (
        <TrackImageCarousel images={query.data.images} />
      ) : (
        <SkeletonImageCarousel />
      )}

      <AppMap
        className="h-[400px] rounded"
        geojson={geojson}
        initialCamera="fit"
      />

      {query.data && query.data.pointDemElevation && (
        <ElevationChart
          points={query.data.coordinates}
          elevations={query.data.pointDemElevation}
          timestamps={query.data.pointTimestamps}
          onPointHover={setHoveredPoint}
          className="h-[200px] rounded"
        />
      )}
    </div>
  );
}

type HydratedRecordedTrack = RecordedTrack & {
  coordinates: Point2[];
};

function useTrackDetailQuery(
  id: string,
): AppUseQueryResult<HydratedRecordedTrack | null> {
  const trpc = useTRPC();
  return useQuery(
    trpc.track.getRecordedTrack.queryOptions(
      { id },
      {
        select: selectHydratedRecordedTrack,
      },
    ),
  );
}

function selectHydratedRecordedTrack(
  data: RecordedTrack | null,
): HydratedRecordedTrack | null {
  if (!data) return null;
  return {
    ...data,
    coordinates: decodePolyline(data.polyline),
  };
}

function TrackImageCarousel({
  images,
  variant,
}: {
  images: { image: ImageSrc; imageSmallSquare: ImageSrc }[];
  variant?: "modalContent";
}) {
  const [api, setApi] = useState<CarouselApi>();

  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!api || variant === "modalContent") return;
    const handleClick = () => setShowModal(true);
    api.containerNode().addEventListener("click", handleClick);
    return () => {
      api.containerNode().removeEventListener("click", handleClick);
    };
  }, [api, variant]);

  if (!images) return <SkeletonImageCarousel />;
  if (images.length === 0) return null;

  const previousNextStyle = cn(
    variant === "modalContent" &&
      "bg-gray-100 disabled:bg-gray-300 hover:bg-gray-100 hover:opacity-100 opacity-80 disabled:opacity-80",
    "disabled:pointer-events-auto", // otherwise click dismisses modal
  );

  return (
    <>
      <Carousel setApi={setApi}>
        <Carousel.Previous className={previousNextStyle} />
        <Carousel.Content>
          {images.map((img, i) => (
            <Carousel.Item
              key={i}
              className={variant === "modalContent" ? "" : "basis-1/3"}>
              <img
                alt=""
                className="bg-muted rounded"
                {...(variant === "modalContent"
                  ? img.image
                  : img.imageSmallSquare)}
              />
            </Carousel.Item>
          ))}
        </Carousel.Content>
        <Carousel.Next className={previousNextStyle} />
      </Carousel>

      <Dialog.Root
        open={showModal}
        onOpenChange={open => !open && setShowModal(false)}>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed inset-10 z-50 m-auto w-full max-w-3xl outline-none">
          <Dialog.Title className="sr-only">Track Images</Dialog.Title>
          <Dialog.Description className="sr-only">
            A carousel of images
          </Dialog.Description>
          <div className="max-h-full">
            {showModal && (
              <TrackImageCarousel images={images} variant="modalContent" />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
}

function SkeletonImageCarousel() {
  return (
    <div className="animate-pulse">
      <div className="flex justify-between overflow-hidden">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-muted size-[266px] rounded-md" />
        ))}
      </div>
    </div>
  );
}
