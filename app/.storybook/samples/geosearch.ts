// noinspection ES6PreferShortImport

import { paths } from '../../api/v1';

export const benAlderGeosearchResponse: paths['/geosearch']['get']['responses']['200']['content']['application/json'] =
  {
    user: 'u_drckha3aas1bq3bjqx5kmz3syc',
    results: [
      {
        id: '1',
        name: 'Ben Alder',
        type: 'hill',
        countryCode2: 'GB',
        geometry: {
          type: 'Point',
          coordinates: [-4.46509, 56.813804],
        },
      },
      {
        id: '2',
        name: 'Ben Alisky',
        type: 'hill',
        countryCode2: 'GB',
        geometry: {
          type: 'Point',
          coordinates: [-3.632231, 58.325499],
        },
      },
      {
        id: '3',
        name: 'Ben-a-chielt',
        type: 'hill',
        countryCode2: 'GB',
        geometry: {
          type: 'Point',
          coordinates: [-3.377763, 58.317859],
        },
      },
      {
        id: '4',
        name: 'Beinn an Aodainn [Ben Aden]',
        type: 'hill',
        countryCode2: 'GB',
        geometry: {
          type: 'Point',
          coordinates: [-5.463143, 57.030736],
        },
      },
      {
        id: '5',
        name: "Ben A'an",
        type: 'hill',
        countryCode2: 'GB',
        geometry: {
          type: 'Point',
          coordinates: [-4.418826, 56.242637],
        },
      },
    ],
  };
