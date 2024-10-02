import dynamic from 'next/dynamic';
export type {
  CameraOptions,
  MapComponentProps,
  MaybeCleanup,
  OnMap,
  InitialCamera,
} from './MapComponentImpl';

export const MapComponent = dynamic(() => import('./MapComponentImpl'), {
  loading: () => (
    <div className="w-full max-w-full h-full max-h-full bg-gray-300 animate-pulse" />
  ),
  ssr: false,
});
