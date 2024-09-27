import { z } from 'zod';
import { baseStyleIDSchema, defaultBaseStyle } from '@/features/map/style';

const initialViewSchema = z.object({
  lng: z.number(),
  lat: z.number(),
  zoom: z.number(),
  baseStyle: baseStyleIDSchema,
});

export type InitialView = z.infer<typeof initialViewSchema>;

export const defaultInitialView: InitialView = {
  lng: 0,
  lat: 50,
  zoom: 2,
  baseStyle: defaultBaseStyle.id,
};

const storageKey = 'plantopo-map-initial-view';

export function loadInitialView(): InitialView {
  if (typeof localStorage !== 'undefined') {
    const storedValue = localStorage.getItem(storageKey);
    if (storedValue) {
      try {
        return initialViewSchema.parse(JSON.parse(storedValue));
      } catch (err) {
        console.warn('error parsing stored map initial view', err);
      }
    }
  }
  return defaultInitialView;
}

export function storeInitialView(value: InitialView) {
  const validatedValue = initialViewSchema.parse(value);
  localStorage.setItem(storageKey, JSON.stringify(validatedValue));
}

export function clearInitialView() {
  localStorage.removeItem(storageKey);
}
