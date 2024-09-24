import { FeatureCollection } from 'geojson';
import { gpx } from '@tmcw/togeojson';
import { ParsedTrack } from './schema';
import { DateTime } from 'luxon';

export async function parseTrackFile(file: File): Promise<ParsedTrack[]> {
  const fileName = file.name.slice(
    0,
    file.name.lastIndexOf('.') ?? file.name.length - 1,
  );

  const text = await file.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xml');
  const errorNode = doc.querySelector('parsererror');
  if (errorNode) {
    console.error(errorNode.textContent);
    throw new Error('xml syntax error');
  }

  const metaName =
    doc.querySelector('metadata > name')?.textContent ?? undefined;

  let fc: FeatureCollection;
  try {
    fc = gpx(doc);
  } catch (err) {
    throw new Error(`parse gpx: ${err}`);
  }

  const out: ParsedTrack[] = [];
  for (const f of fc.features) {
    const props = f.properties ?? {};
    const coordProps = props['coordinateProperties'] ?? {};

    if (props['_gpxType'] !== 'trk') {
      continue;
    }

    const name = props['name'] || metaName || fileName;

    const geom = f.geometry;
    if (geom.type === 'MultiLineString') {
      // Note that togeojson doesn't handle the time properties correctly for
      // multis.
      throw new Error(
        'tracks with multiple segments are not currently supported',
      );
    }
    if (geom.type !== 'LineString') {
      throw new Error('unreachable: expected LineString');
    }

    if (!geom.coordinates.every((p) => p.length >= 2)) {
      throw new Error('invalid coordinate format');
    }
    const line: ParsedTrack['line'] = geom.coordinates.map((p) => [
      p[0]!,
      p[1]!,
    ]);

    // This uses the user's local timezone if unspecified. That is more likely
    // to be correct than anything else but of course isn't ideal.
    const normalizeDateIfValid = (v: string) =>
      DateTime.fromJSDate(new Date(v)).toUTC().toISO() ?? undefined;

    const date = normalizeDateIfValid(props['time']);

    const timesProp = coordProps['times'];
    const parsedTimes = Array.isArray(timesProp)
      ? timesProp.map(normalizeDateIfValid)
      : undefined;
    let times: string[] | undefined;
    if (
      parsedTimes &&
      parsedTimes.length === line.length &&
      parsedTimes.every((v) => v !== undefined)
    ) {
      times = parsedTimes;
    }

    out.push({ name, date, times, line });
  }

  return out;
}
