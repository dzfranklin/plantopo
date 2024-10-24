'use client';

import { ContourGuessrGame } from '@/app/contourguessr/ContourGuessrGame';

// TODO: Show a picker of square images of like for example Scotland, England, Wales and also the map every time. then a button for a random challenge

export function ContourGuessrScreen() {
  return (
    <div className="w-screen min-w-screen h-screen min-h-screen">
      <ContourGuessrGame
        newGame={() => {}}
        game={{
          id: 'axf1',
          map: 'osExplorer',
          photo: {
            point: [-4.46025, 56.81575],
            title: 'Ben Alder from the Pattack track',
            attributionText: 'Jim Barton (geograph.org.uk)',
            attributionLink: 'https://www.geograph.org.uk/photo/5218815',
            dateTaken: '2016-12-03T00:00:00.000000Z',
            full: {
              width: 1024,
              height: 678,
              url: 'https://s0.geograph.org.uk/geophotos/05/21/88/5218815_b165ac24_original.jpg',
            },
            small: {
              width: 640,
              height: 424,
              url: 'https://s0.geograph.org.uk/geophotos/05/21/88/5218815_b165ac24.jpg',
            },
          },
        }}
      />
    </div>
  );
}
