import { AppError, TransportError } from '@/api/errors';
import { ErrorReply } from '@/api/reply';
import { QueryKey, useQuery } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';

export interface MyGeolocation {
  latitude: number;
  longitude: number;
  country: string; // two-letter ISO 3166-1 alpha-2 country code
  city: string;
}

export const useMyGeolocation = () =>
  useQuery<unknown, unknown, MyGeolocation, QueryKey>({
    queryKey: ['my-geolocation-v1'],
    queryFn: async () => {
      const requestId = uuidv4();

      let resp: Response;
      try {
        resp = await fetch(
          'https://geolocate-me.plantopo.com/geolocate-me-v1',
          {
            method: 'GET',
            credentials: 'include',
            headers: {
              'X-Request-Id': requestId,
            },
          },
        );
      } catch (err) {
        throw new TransportError(requestId, err);
      }

      if (!resp.headers.get('Content-Type')?.includes('application/json')) {
        let body: string;
        try {
          body = await resp.text();
        } catch (err) {
          throw new TransportError(requestId, err);
        }
        throw TransportError.notJson(requestId, resp.status, body);
      }

      let json: unknown;
      try {
        json = await resp.json();
      } catch (err) {
        throw new TransportError(requestId, err);
      }

      if (resp.ok) {
        return (json as { data: MyGeolocation }).data;
      } else {
        const payload = json as ErrorReply;
        throw new TransportError(requestId, new AppError(requestId, payload));
      }
    },
  });
