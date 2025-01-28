// The glyphs property in each baseStyle will be overridden with styleGlyphs so we can reliably use it in overlays
import { MAPTILER_KEY } from '@/env';

export const styleGlyphs =
  'https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=' + MAPTILER_KEY;
