import { expect, test, describe } from 'vitest';
import { parseTrackFile } from './parseTrackFile';

function mockFile(name: string, contents: string): File {
  return {
    name,
    text: () => Promise.resolve(contents),
  } as any;
}

describe('parseFile(gpx)', () => {
  test('accepts without elevation', async () => {
    const input = mockFile(
      'file.gpx',
      `<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1"
     creator="CALTOPO" version="1.1">
    <metadata>
        <name><![CDATA[export]]></name>
    </metadata>
    <trk>
        <name>8/11/2024</name>
        <trkseg>
            <trkpt lat="56.44940396" lon="-5.04323256">
                <time>2024-08-11T05:51:10Z</time>
            </trkpt>
            <trkpt lat="56.44940123" lon="-5.04321416">
                <time>2024-08-11T05:51:11Z</time>
            </trkpt>
        </trkseg>
    </trk>
</gpx>`,
    );
    const got = await parseTrackFile(input);
    expect(got).toStrictEqual([
      {
        name: '8/11/2024',
        date: '2024-08-11T05:51:10.000Z',
        times: ['2024-08-11T05:51:10.000Z', '2024-08-11T05:51:11.000Z'],
        line: [
          [-5.04323256, 56.44940396],
          [-5.04321416, 56.44940123],
        ],
      },
    ]);
  });

  test('discards elevation', async () => {
    const input = mockFile(
      'file.gpx',
      `<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1"
     creator="CALTOPO" version="1.1">
    <metadata>
        <name><![CDATA[export]]></name>
    </metadata>
    <trk>
        <name>8/11/2024</name>
        <trkseg>
            <trkpt lat="56.44940396" lon="-5.04323256">
                <ele>838.0</ele>
                <time>2024-08-11T05:51:10Z</time>
            </trkpt>
            <trkpt lat="56.44940123" lon="-5.04321416">
                <ele>838.0</ele>
                <time>2024-08-11T05:51:11Z</time>
            </trkpt>
        </trkseg>
    </trk>
</gpx>`,
    );
    const got = await parseTrackFile(input);
    expect(got).toStrictEqual([
      {
        name: '8/11/2024',
        date: '2024-08-11T05:51:10.000Z',
        times: ['2024-08-11T05:51:10.000Z', '2024-08-11T05:51:11.000Z'],
        line: [
          [-5.04323256, 56.44940396],
          [-5.04321416, 56.44940123],
        ],
      },
    ]);
  });

  test('accepts without time', async () => {
    const input = mockFile(
      'file.gpx',
      `<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1"
     creator="CALTOPO" version="1.1">
    <metadata>
        <name><![CDATA[export]]></name>
    </metadata>
    <trk>
        <name>8/11/2024</name>
        <trkseg>
            <trkpt lat="56.44940396" lon="-5.04323256"></trkpt>
            <trkpt lat="56.44940123" lon="-5.04321416"></trkpt>
        </trkseg>
    </trk>
</gpx>`,
    );
    const got = await parseTrackFile(input);
    expect(got).toStrictEqual([
      {
        name: '8/11/2024',
        date: undefined,
        times: undefined,
        line: [
          [-5.04323256, 56.44940396],
          [-5.04321416, 56.44940123],
        ],
      },
    ]);
  });

  test('normalizes times', async () => {
    const input = mockFile(
      'file.gpx',
      `<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1"
     creator="CALTOPO" version="1.1">
    <metadata>
        <name><![CDATA[export]]></name>
    </metadata>
    <trk>
        <name>8/11/2024</name>
        <trkseg>
            <trkpt lat="56.44940396" lon="-5.04323256">
                <time>2024-08-11 05:51:10</time>
            </trkpt>
            <trkpt lat="56.44940123" lon="-5.04321416">
                <time>2024-08-11 05:51:11</time>
            </trkpt>
        </trkseg>
    </trk>
</gpx>`,
    );
    const got = await parseTrackFile(input);
    expect(got).toStrictEqual([
      {
        name: '8/11/2024',
        date: '2024-08-11T05:51:10.000Z',
        times: ['2024-08-11T05:51:10.000Z', '2024-08-11T05:51:11.000Z'],
        line: [
          [-5.04323256, 56.44940396],
          [-5.04321416, 56.44940123],
        ],
      },
    ]);
  });

  test('uses metadata name if no track name', async () => {
    const input = mockFile(
      'file.gpx',
      `<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1"
     creator="CALTOPO" version="1.1">
    <metadata>
        <name><![CDATA[My Export]]></name>
    </metadata>
    <trk>
        <trkseg>
            <trkpt lat="56.44940396" lon="-5.04323256"></trkpt>
            <trkpt lat="56.44940123" lon="-5.04321416"></trkpt>
        </trkseg>
    </trk>
</gpx>`,
    );
    const got = await parseTrackFile(input);
    expect(got).toHaveLength(1);
    expect(got[0]!.name).toStrictEqual('My Export');
  });

  test('uses filename if no metadata or track name', async () => {
    const input = mockFile(
      'file.gpx',
      `<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1"
     creator="CALTOPO" version="1.1">
    <metadata></metadata>
    <trk>
        <trkseg>
            <trkpt lat="56.44940396" lon="-5.04323256"></trkpt>
            <trkpt lat="56.44940123" lon="-5.04321416"></trkpt>
        </trkseg>
    </trk>
</gpx>`,
    );
    const got = await parseTrackFile(input);
    expect(got).toHaveLength(1);
    expect(got[0]!.name).toStrictEqual('file');
  });

  test('multiple tracks', async () => {
    const input = mockFile(
      'file.gpx',
      `<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1"
     creator="CALTOPO" version="1.1">
    <metadata>
        <name><![CDATA[export]]></name>
    </metadata>
    <trk>
        <name>Track 1</name>
        <trkseg>
            <trkpt lat="56.44940396" lon="-5.04323256"></trkpt>
            <trkpt lat="56.44940123" lon="-5.04321416"></trkpt>
        </trkseg>
    </trk>
        <trk>
        <name>Track 2</name>
        <trkseg>
            <trkpt lat="56.44940123" lon="-5.04321416"></trkpt>
            <trkpt lat="56.44940396" lon="-5.04323256"></trkpt>
        </trkseg>
    </trk>
</gpx>`,
    );
    const got = await parseTrackFile(input);
    expect(got).toStrictEqual([
      {
        name: 'Track 1',
        date: undefined,
        times: undefined,
        line: [
          [-5.04323256, 56.44940396],
          [-5.04321416, 56.44940123],
        ],
      },
      {
        name: 'Track 2',
        date: undefined,
        times: undefined,
        line: [
          [-5.04321416, 56.44940123],
          [-5.04323256, 56.44940396],
        ],
      },
    ]);
  });

  test('rejects multi-segment track', async () => {
    const input = mockFile(
      'file.gpx',
      `<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1"
     creator="CALTOPO" version="1.1">
    <metadata>
        <name><![CDATA[export]]></name>
    </metadata>
    <trk>
        <name>Track</name>
        <trkseg>
            <trkpt lat="56.44940396" lon="-5.04323256"></trkpt>
            <trkpt lat="56.44940123" lon="-5.04321416"></trkpt>
        </trkseg>
        <trkseg>
            <trkpt lat="56.44940123" lon="-5.04321416"></trkpt>
            <trkpt lat="56.44940396" lon="-5.04323256"></trkpt>
        </trkseg>
    </trk>
</gpx>`,
    );
    await expect(async () => await parseTrackFile(input)).rejects.toThrow(
      'tracks with multiple segments are not currently supported',
    );
  });
});
