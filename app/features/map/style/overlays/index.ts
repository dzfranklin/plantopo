import { geophotosOverlay } from '@/features/map/style/overlays/geophotos';
import type { DynamicOverlayStyle, OverlayStyle } from './OverlayStyle';
import { scotCorePathsOverlay } from '@/features/map/style/overlays/scotCorePaths';
import { scotWildLandAreasOverlay } from '@/features/map/style/overlays/scotWildLandAreas';
import { caledonianPinewoodInventoryOverlay } from '@/features/map/style/overlays/caledonianPinewoodInventory';
import { bgsMiningHazardExCoalOverlay } from '@/features/map/style/overlays/bgsMiningHazardExCoal';
import { globalHumanSettlementUrbanisationOverlay } from '@/features/map/style/overlays/globalHumanSettlementUrbanisation';
import { paperMapsOverlay } from '@/features/map/style/overlays/paperMaps';
import { weatherOverlays } from '@/features/map/style/overlays/weather';
import { busStopsUKOverlay } from '@/features/map/style/overlays/busStopsUK';
import { sepaStationsOverlay } from '@/features/map/style/overlays/sepaStations';
import { mwisForecastAreaOverlay } from '@/features/map/style/overlays/mwisForecastArea';

const overlayStyleList: (OverlayStyle | DynamicOverlayStyle)[] = [
  bgsMiningHazardExCoalOverlay,
  busStopsUKOverlay,
  caledonianPinewoodInventoryOverlay,
  geophotosOverlay,
  globalHumanSettlementUrbanisationOverlay,
  paperMapsOverlay,
  sepaStationsOverlay,
  scotCorePathsOverlay,
  scotWildLandAreasOverlay,
  mwisForecastAreaOverlay,
  ...weatherOverlays,
];

export const overlayStyles: Record<string, OverlayStyle | DynamicOverlayStyle> =
  overlayStyleList.reduce((acc, item) => ({ ...acc, [item.id]: item }), {});
