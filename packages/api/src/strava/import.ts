import { enqueueJob } from "../jobs.js";
import { getLog } from "../logger.js";
import {
  type CoordinateProperties,
  type Geometry,
  ImportError,
  type Properties,
  type TrackImport,
  fileExtension,
  importTrack,
  normalizeFilenameComponent,
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
}

export async function importStravaActivity(
  opts: ImportStravaActivityOpts,
): Promise<void> {
  await enqueueJob("strava.importActivity", opts);
}

export async function runImportStravaActivity(
  opts: ImportStravaActivityOpts,
): Promise<void> {
  const { userId, activityId } = opts;
  const log = getLog().child({ userId, stravaActivityId: activityId });

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

  const trackImport = stravaToTrackImport(activity, streams, photos);
  await importTrack({ userId, trackImport });
  log.info("Enqueued track.import for Strava activity");
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
    const filename =
      normalizeFilenameComponent(activity.name) + ` ${i + 1}.${ext}`;
    photosProp.push({
      url: photo.urls["2048"],
      taken_at: photo.created_at_local,
      filename: filename,
    });
  }

  const properties = {
    sourceType: "strava",
    sourceId: activity.id.toString(),
    name: activity.name,
    startTime: start.getTime(),
    endTime: start.getTime() + activity.elapsed_time * 1000,
    description: activity.description ?? undefined,
    photos: photosProp,
    coordinateProperties,
  } satisfies Properties;

  return {
    type: "Feature",
    geometry,
    properties,
  };
}
