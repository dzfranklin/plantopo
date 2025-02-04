import type { Meta, StoryObj } from '@storybook/react';

import { PaperMapsInspect } from './paperMaps';
import type { InspectFeature } from '../InspectFeature';

const meta = {
  component: PaperMapsInspect,
  render: (args) => (
    <div style={{ maxWidth: '240px', maxHeight: '275px' }}>
      <PaperMapsInspect {...args} />
    </div>
  ),
} satisfies Meta<typeof PaperMapsInspect>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoImagesInspect: Story = {
  args: {
    f: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        // prettier-ignore
        coordinates: [[[-3.58154296875, 57.16603560463153], [-3.5595703125, 57.148160713298324], [-3.350830078125, 57.148160713298324], [-3.33984375, 57.05865660667763], [-3.394775390625, 57.05865660667763], [-3.3837890625, 56.96294713526058], [-3.8671875, 56.95096612859507], [-3.8671875, 56.980911424544786], [-3.9111328125, 56.98689759580651], [-3.9111328125, 57.11835002634524], [-3.856201171875, 57.136239319177434], [-3.834228515625, 57.16007826737999], [-3.614501953125, 57.16603560463153], [-3.58154296875, 57.16603560463153]]],
      },
      properties: {
        publisher: 'Harvey Maps',
        series: 'Ultramap (1:40,000)',
        color: '#fdc800',
        url: 'https://www.harveymaps.co.uk/acatalog/Cairn-Gorm-YHULCG.html',
        title: 'Cairn Gorm',
        icon: 'https://plantopo-storage.b-cdn.net/paper-maps/images/publisher_icons/harvey.png',
        thumbnail:
          'https://plantopo-storage.b-cdn.net/paper-maps/images/harvey/YHULCG_thumbnail.jpg',
      },
    },
  },
};

export const NoImagesNoThumbnailInspect: Story = {
  args: {
    f: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        // prettier-ignore
        coordinates: [[[-3.58154296875, 57.16603560463153], [-3.5595703125, 57.148160713298324], [-3.350830078125, 57.148160713298324], [-3.33984375, 57.05865660667763], [-3.394775390625, 57.05865660667763], [-3.3837890625, 56.96294713526058], [-3.8671875, 56.95096612859507], [-3.8671875, 56.980911424544786], [-3.9111328125, 56.98689759580651], [-3.9111328125, 57.11835002634524], [-3.856201171875, 57.136239319177434], [-3.834228515625, 57.16007826737999], [-3.614501953125, 57.16603560463153], [-3.58154296875, 57.16603560463153]]],
      },
      properties: {
        publisher: 'Harvey Maps',
        series: 'Ultramap (1:40,000)',
        color: '#fdc800',
        url: 'https://www.harveymaps.co.uk/acatalog/Cairn-Gorm-YHULCG.html',
        title: 'Cairn Gorm',
        icon: 'https://plantopo-storage.b-cdn.net/paper-maps/images/publisher_icons/harvey.png',
      },
    },
  },
};

export const HarveyInspect: Story = {
  args: {
    f: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        // prettier-ignore
        coordinates: [[[-3.58154296875, 57.16603560463153], [-3.5595703125, 57.148160713298324], [-3.350830078125, 57.148160713298324], [-3.33984375, 57.05865660667763], [-3.394775390625, 57.05865660667763], [-3.3837890625, 56.96294713526058], [-3.8671875, 56.95096612859507], [-3.8671875, 56.980911424544786], [-3.9111328125, 56.98689759580651], [-3.9111328125, 57.11835002634524], [-3.856201171875, 57.136239319177434], [-3.834228515625, 57.16007826737999], [-3.614501953125, 57.16603560463153], [-3.58154296875, 57.16603560463153]]],
      },
      properties: {
        publisher: 'Harvey Maps',
        series: 'Ultramap (1:40,000)',
        color: '#fdc800',
        url: 'https://www.harveymaps.co.uk/acatalog/Cairn-Gorm-YHULCG.html',
        title: 'Cairn Gorm',
        icon: 'https://plantopo-storage.b-cdn.net/paper-maps/images/publisher_icons/harvey.png',
        thumbnail:
          'https://plantopo-storage.b-cdn.net/paper-maps/images/harvey/YHULCG_thumbnail.jpg',
        images:
          '["https://plantopo-storage.b-cdn.net/paper-maps/images/harvey/YHULCG_front.jpg"]',
      },
    },
  },
};

export const HarveyInspectLongTitle: Story = {
  args: {
    f: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        // prettier-ignore
        coordinates: [[[-3.58154296875, 57.16603560463153], [-3.5595703125, 57.148160713298324], [-3.350830078125, 57.148160713298324], [-3.33984375, 57.05865660667763], [-3.394775390625, 57.05865660667763], [-3.3837890625, 56.96294713526058], [-3.8671875, 56.95096612859507], [-3.8671875, 56.980911424544786], [-3.9111328125, 56.98689759580651], [-3.9111328125, 57.11835002634524], [-3.856201171875, 57.136239319177434], [-3.834228515625, 57.16007826737999], [-3.614501953125, 57.16603560463153], [-3.58154296875, 57.16603560463153]]],
      },
      properties: {
        publisher: 'Harvey Maps',
        series: 'Ultramap (1:40,000)',
        color: '#fdc800',
        url: 'https://www.harveymaps.co.uk/acatalog/Cairn-Gorm-YHULCG.html',
        title: "A very long example title that doesn't end for a while",
        icon: 'https://plantopo-storage.b-cdn.net/paper-maps/images/publisher_icons/harvey.png',
        thumbnail:
          'https://plantopo-storage.b-cdn.net/paper-maps/images/harvey/YHULCG_thumbnail.jpg',
        images:
          '["https://plantopo-storage.b-cdn.net/paper-maps/images/harvey/YHULCG_front.jpg"]',
      },
    },
  },
};

export const OSInspect: Story = {
  args: {
    f: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        // prettier-ignore
        'coordinates': [[[-2.911376953125, 57.23150299147892], [-2.911376953125, 57.20175947677694], [-3.2958984375, 57.20175947677694], [-3.2958984375, 57.379861262404376], [-2.911376953125, 57.38578314962143], [-2.537841796875, 57.38578314962143], [-2.52685546875, 57.23150299147892], [-2.911376953125, 57.23150299147892]]],
      },
      properties: {
        publisher: 'Ordnance Survey',
        series: 'OS Explorer',
        color: '#ED6229',
        isbn: '9780319242995',
        url: 'https://shop.ordnancesurvey.co.uk/map-of-lochindorb-grantown-on-spey-carrbridge/',
        title: 'Lochindorb, Grantown-on-Spey & Carrbridge OL60',
        short_title: 'OL60',
        icon: 'https://plantopo-storage.b-cdn.net/paper-maps/images/publisher_icons/os.png',
        thumbnail:
          'https://plantopo-storage.b-cdn.net/paper-maps/images/os_explorer/covers/thumbnails/9780319242995_C.jpg',
        images:
          '["https://plantopo-storage.b-cdn.net/paper-maps/images/os_explorer/covers/9780319242995_C.jpg","https://plantopo-storage.b-cdn.net/paper-maps/images/os_explorer/covers/9780319242995_B.jpg"]',
      },
    },
  },
};
