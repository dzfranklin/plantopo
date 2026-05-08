import { enqueueJob } from "../jobs.js";
import { getLog } from "../logger.js";
import {
  type CoordinateProperties,
  type Geometry,
  ImportError,
  type Properties,
  type TrackImport,
  type TrackImportKey,
  createTrackImport,
  fileExtension,
  getConversionInput,
  importTrack,
  normalizeFilenameComponent,
  setRawData,
} from "../track/imports.js";
import type {
  ActivityPhotos,
  DetailedActivity,
  StreamResponse,
} from "./strava.api.js";
import { stravaApi } from "./strava.api.js";

export interface ImportStravaActivityOpts {
  userId: string;
  activityId: number;
  force?: boolean;
}

export async function importStravaActivity(
  opts: ImportStravaActivityOpts,
): Promise<void> {
  const key = stravaImportKey(opts);
  await createTrackImport(key);
  await enqueueJob("strava.importActivity", opts);
}

function stravaImportKey({
  userId,
  activityId,
}: Pick<ImportStravaActivityOpts, "userId" | "activityId">): TrackImportKey {
  return {
    userId,
    sourceType: "strava",
    sourceId: activityId.toString(),
  };
}

export async function runImportStravaActivity({
  userId,
  activityId,
  force,
}: ImportStravaActivityOpts): Promise<void> {
  const key = stravaImportKey({ userId, activityId });

  const rawResult = await getConversionInput(key);

  const log = getLog().child({
    userId,
    activityId,
    force,
    conversionInputStatus: rawResult.status,
  });

  if (rawResult.status === "already_converted") {
    if (force) {
      log.info("force refetching Strava activity");
    } else {
      log.info("skipping Strava activity import");
      await enqueueJob("track.import", { key });
      return;
    }
  }

  let rawData: StravaRawData;
  if (rawResult.status === "has_raw") {
    rawData = JSON.parse(rawResult.data.toString("utf8")) as StravaRawData;
  } else {
    log.info("Fetching Strava activity data");
    const [activity, streams, photos] = await Promise.all([
      stravaApi.getActivity(userId, activityId),
      stravaApi.getActivityStreams(userId, activityId, [
        "latlng",
        "time",
        "velocity_smooth",
      ]),
      stravaApi.getActivityPhotos(userId, activityId),
    ]);
    rawData = { activity, streams, photos };
    await setRawData(key, Buffer.from(JSON.stringify(rawData), "utf8"));
  }

  const data = stravaToTrackImport(
    rawData.activity,
    rawData.streams,
    rawData.photos,
  );
  await importTrack(key, data, { force });
  log.info("Converted and enqueued track.import");
}

interface StravaRawData {
  activity: DetailedActivity;
  streams: StreamResponse;
  photos: ActivityPhotos;
}

export function stravaToTrackImport(
  activity: DetailedActivity,
  streams: StreamResponse,
  photos: ActivityPhotos,
): TrackImport {
  const log = getLog().child({
    stravaToTrackImportActivity: activity.id,
    streams: Object.keys(streams).join(","),
    photoCount: photos.length,
  });

  const latLngs = streams.latlng;
  const times = streams.time;
  const speeds = streams.velocity_smooth;
  if (!latLngs) {
    throw new ImportError("Strava activity is missing latlng stream");
  }
  if (times && times.data.length !== latLngs.data.length) {
    throw new ImportError(
      "Strava activity time stream length does not match latlng stream length",
    );
  }
  if (speeds && speeds.data.length !== latLngs.data.length) {
    throw new ImportError(
      "Strava activity velocity_smooth stream length does not match latlng stream length",
    );
  }

  const geometry = {
    type: "LineString",
    coordinates: latLngs.data.map(([lat, lng]) => [lng, lat]),
  } satisfies Geometry;

  const coordinateProperties = {
    times: times?.data,
    speeds: speeds?.data,
  } satisfies CoordinateProperties;

  const start = new Date(activity.start_date);

  const photosProp: Properties["photos"] = [];
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]!;
    const url = photo.urls["2048"];
    if (!url) {
      log.warn(
        `Strava activity photo ${photo.id} is missing 2048 url, skipping`,
      );
      continue;
    }
    const ext = fileExtension(url);
    photosProp.push({
      url,
      taken_at: photo.created_at_local,
      filename: normalizeFilenameComponent(activity.name) + ` ${i + 1}.${ext}`,
    });
  }

  return {
    type: "Feature",
    geometry,
    properties: {
      sourceType: "strava",
      sourceId: activity.id.toString(),
      name: activity.name,
      startTime: start.getTime(),
      endTime: start.getTime() + activity.elapsed_time * 1000,
      description: activity.description ?? undefined,
      photos: photosProp,
      coordinateProperties,
    } satisfies Properties,
  };
}
