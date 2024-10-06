import { HighwaySegment } from '@/features/map/snap/HighwayGraph';
import { beforeEach, describe, expect, test } from 'vitest';
import { decodePolyline } from '@/features/tracks/polyline';
import { bboxOf, lengthOf, lineStringGeometry } from '@/geo';
import { searchPathToLine } from '@/features/map/snap/searchPathToLine';
import { AssertionError } from '@/errors';

const segmentCache = new Map<number, HighwaySegment>();
beforeEach(() => segmentCache.clear());

function segment(data: {
  id: number;
  polyline: string;
  start: number;
  end: number;
}) {
  if (segmentCache.has(data.id)) {
    const cached = segmentCache.get(data.id)!;
    if (
      cached.polyline !== data.polyline ||
      cached.start !== data.start ||
      cached.end !== data.end
    ) {
      throw new AssertionError('inconsistent segment');
    }
    return cached;
  }

  const geometry = lineStringGeometry(decodePolyline(data.polyline));
  const seg = HighwaySegment.fromData({
    ...data,
    meters: lengthOf(geometry),
    bbox: bboxOf(geometry),
  });

  segmentCache.set(seg.id, seg);
  return seg;
}

const cases = [
  {
    name: 'one segment forwards',
    args: {
      start: [-3.7299158622513744, 56.732069583711876],
      goal: [-3.7299025369117658, 56.73223004825397],
      goalSeg: segment({
        id: 1531541,
        polyline: 'gdgyIhywUMm@Q[Ma@[m@I]U_@MMIE_@He@IKIEKKOGCUGOK]Ua@QG@KB',
        start: 1268505,
        end: 195871,
      }),
      segs: [
        segment({
          id: 1531541,
          polyline: 'gdgyIhywUMm@Q[Ma@[m@I]U_@MMIE_@He@IKIEKKOGCUGOK]Ua@QG@KB',
          start: 1268505,
          end: 195871,
        }),
      ],
    },
    want: lineStringGeometry([
      [-3.7299158622513744, 56.732069583711876],
      [-3.7299171690774147, 56.73206979174266],
      [-3.72988, 56.73214],
      [-3.72989, 56.73218],
      [-3.729906548610787, 56.73222964583236],
    ]),
  },
  {
    name: 'one segment reversed',
    args: {
      start: [-3.7299047254190043, 56.732228274115045],
      goal: [-3.729917730250577, 56.73207407323355],
      goalSeg: segment({
        id: 1531541,
        polyline: 'gdgyIhywUMm@Q[Ma@[m@I]U_@MMIE_@He@IKIEKKOGCUGOK]Ua@QG@KB',
        start: 1268505,
        end: 195871,
      }),
      segs: [
        segment({
          id: 1531541,
          polyline: 'gdgyIhywUMm@Q[Ma@[m@I]U_@MMIE_@He@IKIEKKOGCUGOK]Ua@QG@KB',
          start: 1268505,
          end: 195871,
        }),
      ],
    },
    want: lineStringGeometry([
      [-3.7299047254190043, 56.732228274115045],
      [-3.7299060471687673, 56.7322281415063],
      [-3.72989, 56.73218],
      [-3.72988, 56.73214],
      [-3.7299151224338516, 56.732073657624944],
    ]),
  },
  {
    name: 'two segment forwards',
    args: {
      start: [-3.7299135488476054, 56.73208380683431],
      goal: [-3.728453966832518, 56.73329174056752],
      goalSeg: segment({
        id: 187109,
        polyline:
          'oogyI|nwUCGCGAMAYCSUi@OYOIGA]KYMOMOOWc@Uk@M_@OWIOKKc@Bm@SYs@IcAMe@]m@MKE_@OQSC_@IGGI]Ey@K]]g@o@}Ae@_Am@[a@g@OYQUI_@',
        start: 195871,
        end: 195872,
      }),
      segs: [
        segment({
          id: 1531541,
          polyline: 'gdgyIhywUMm@Q[Ma@[m@I]U_@MMIE_@He@IKIEKKOGCUGOK]Ua@QG@KB',
          start: 1268505,
          end: 195871,
        }),
        segment({
          id: 187109,
          polyline:
            'oogyI|nwUCGCGAMAYCSUi@OYOIGA]KYMOMOOWc@Uk@M_@OWIOKKc@Bm@SYs@IcAMe@]m@MKE_@OQSC_@IGGI]Ey@K]]g@o@}Ae@_Am@[a@g@OYQUI_@',
          start: 195871,
          end: 195872,
        }),
      ],
    },
    want: lineStringGeometry([
      [-3.7299135488476054, 56.73208380683431],
      [-3.729910044942967, 56.732083248441064],
      [-3.72988, 56.73214],
      [-3.72989, 56.73218],
      [-3.72991, 56.73224],
      [-3.72991, 56.73224],
      [-3.72987, 56.73226],
      [-3.72983, 56.73228],
      [-3.72976, 56.73229],
      [-3.72963, 56.7323],
      [-3.72953, 56.73232],
      [-3.72932, 56.73243],
      [-3.72919, 56.73251],
      [-3.72914, 56.73259],
      [-3.72913, 56.73263],
      [-3.72907, 56.73278],
      [-3.729, 56.73291],
      [-3.72893, 56.73299],
      [-3.72885, 56.73307],
      [-3.72867, 56.73319],
      [-3.728459663515491, 56.73329516824226],
    ]),
  },
  {
    name: 'two segments reversed',
    args: {
      start: [-3.729272694446422, 56.7324570446919],
      goal: [-3.7300351016394586, 56.73188282048869],
      goalSeg: segment({
        id: 1531541,
        polyline: 'gdgyIhywUMm@Q[Ma@[m@I]U_@MMIE_@He@IKIEKKOGCUGOK]Ua@QG@KB',
        start: 1268505,
        end: 195871,
      }),
      segs: [
        segment({
          id: 187109,
          polyline:
            'oogyI|nwUCGCGAMAYCSUi@OYOIGA]KYMOMOOWc@Uk@M_@OWIOKKc@Bm@SYs@IcAMe@]m@MKE_@OQSC_@IGGI]Ey@K]]g@o@}Ae@_Am@[a@g@OYQUI_@',
          start: 195871,
          end: 195872,
        }),
        segment({
          id: 1531541,
          polyline: 'gdgyIhywUMm@Q[Ma@[m@I]U_@MMIE_@He@IKIEKKOGCUGOK]Ua@QG@KB',
          start: 1268505,
          end: 195871,
        }),
      ],
    },
    want: lineStringGeometry([
      [-3.729272694446422, 56.7324570446919],
      [-3.729274565682559, 56.73245795957996],
      [-3.72932, 56.73243],
      [-3.72953, 56.73232],
      [-3.72963, 56.7323],
      [-3.72976, 56.73229],
      [-3.72983, 56.73228],
      [-3.72987, 56.73226],
      [-3.72991, 56.73224],
      [-3.72991, 56.73224],
      [-3.72989, 56.73218],
      [-3.72988, 56.73214],
      [-3.72997, 56.73197],
      [-3.7300340946900787, 56.73188259814989],
    ]),
  },
  {
    name: 'multiple segments',
    args: {
      start: [-3.7226971282674697, 56.74113874029712],
      goal: [-3.7203565925042597, 56.742764251076636],
      goalSeg: segment({
        id: 187110,
        polyline:
          'ipiyIluuUAKCI?MECWk@AQEOOM?E@yAIq@Qw@GCIDIFCEGEI@EIIGW?{@]O@_@MMQo@_@EEKGCCG@EMG?AGGAAIGAUa@I@YGWEMMi@HEGG?GIEMC?EFCBCBCCOOEAIDKIC@QMG@KJG?CGG?GOKGAI?KAE@M?E@[EQWGq@OAE?QAIMEIFEIG@EQC?EIE?CKA?Kk@GGCYIQGCKc@IMAIGGASGEAC?GG@?OEIIECECACIECC?AE?MCMOOUA{@{Bo@r@YL[`@Gr@a@R[a@S?GdBJdC?`CJdA',
        start: 195873,
        end: 195874,
      }),
      segs: [
        segment({
          id: 861069,
          polyline: 'izhyIhnvU[KqBUqBTOCgAoAg@wAMq@Qm@Ak@JyBAW',
          start: 785110,
          end: 785111,
        }),
        segment({
          id: 1498162,
          polyline: 'agiyIr_vUaAbAE?AAQg@MQe@eAcAaCgA_C',
          start: 785111,
          end: 1239693,
        }),
        segment({
          id: 1484595,
          polyline: '}oiyIruuUECA?',
          start: 1239693,
          end: 1239694,
        }),
        segment({
          id: 1531555,
          polyline: 'epiyInuuUA@AC',
          start: 1239694,
          end: 195873,
        }),
        segment({
          id: 187110,
          polyline:
            'ipiyIluuUAKCI?MECWk@AQEOOM?E@yAIq@Qw@GCIDIFCEGEI@EIIGW?{@]O@_@MMQo@_@EEKGCCG@EMG?AGGAAIGAUa@I@YGWEMMi@HEGG?GIEMC?EFCBCBCCOOEAIDKIC@QMG@KJG?CGG?GOKGAI?KAE@M?E@[EQWGq@OAE?QAIMEIFEIG@EQC?EIE?CKA?Kk@GGCYIQGCKc@IMAIGGASGEAC?GG@?OEIIECECACIECC?AE?MCMOOUA{@{Bo@r@YL[`@Gr@a@R[a@S?GdBJdC?`CJdA',
          start: 195873,
          end: 195874,
        }),
      ],
    },
    want: lineStringGeometry([
      [-3.7226971282674697, 56.74113874029712],
      [-3.7226956756097898, 56.74114318120752],
      [-3.72246, 56.74112],
      [-3.72234, 56.74113],
      [-3.72234, 56.74113],
      [-3.72268, 56.74146],
      [-3.72268, 56.74149],
      [-3.72267, 56.7415],
      [-3.72247, 56.74159],
      [-3.72238, 56.74166],
      [-3.72203, 56.74185],
      [-3.72138, 56.74219],
      [-3.72074, 56.74255],
      [-3.72074, 56.74255],
      [-3.72072, 56.74258],
      [-3.72072, 56.74259],
      [-3.72072, 56.74259],
      [-3.72073, 56.7426],
      [-3.72071, 56.74261],
      [-3.72071, 56.74261],
      [-3.72065, 56.74262],
      [-3.7206, 56.74264],
      [-3.72053, 56.74264],
      [-3.72051, 56.74267],
      [-3.7203469518924455, 56.742758935331395],
    ]),
  },
];

describe('segmentsToLine', () => {
  for (const tt of cases) {
    test(tt.name, () => {
      const got = searchPathToLine(
        tt.args.start,
        tt.args.goal,
        tt.args.goalSeg,
        tt.args.segs,
      );
      expect(got).toEqual(tt.want);
    });
  }
});
