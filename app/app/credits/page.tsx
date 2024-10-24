import { Layout } from '@/components/Layout';
import dependencyReport from '@/dependencyReport.json';

const nounprojectCredit = [{ author: 'Adrien Coquet', name: 'No Image' }];

export default function Page() {
  return (
    <Layout pageTitle="Credits" className="prose prose-h2:text-xl">
      <section>
        <h2>Data</h2>
        <ul>
          <li>
            Yahoo Flickr Creative Commons 100 Million Dataset (
            <a href="https://dl.acm.org/doi/10.1145/2812802">
              B. Thomee, D.A. Shamma, G. Friedland, B. Elizalde, K. Ni, D.
              Poland, D. Borth, and L. Li, “YFCC100M: The New Data in Multimedia
              Research”, Communications of the ACM, 59(2), 2016, pp. 64-73
            </a>
            ) with additional work by{' '}
            <a href="https://multimediacommons.wordpress.com/">
              multimediacommons.wordpress.com
            </a>
          </li>
          <li>
            Images from <a href="https://www.geograph.org.uk/">Geograph</a>
          </li>
          <li>
            Images from <a href="https://flickr.com/">flickr</a>
          </li>
          <li>
            Map data from{' '}
            <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> ©
            OpenStreetMap contributors
          </li>
          <li>
            Contains{' '}
            <a href="https://osdatahub.os.uk/legal/overview">OS data</a> &copy;
            Crown copyright and database rights {new Date().getFullYear()}
          </li>
          <li>
            Elevation data from the European Space Agency{' '}
            <a href="https://spacedata.copernicus.eu/en/web/guest/collections/copernicus-digital-elevation-model/">
              Copernicus Global Digital Elevation Model.
            </a>
          </li>
          <li>
            Data from{' '}
            <a href="https://www.hills-database.co.uk">
              The Database of British and Irish Hills
            </a>{' '}
            licensed under a{' '}
            <a href="http://creativecommons.org/licenses/by/4.0/">
              Creative Commons Attribution 4.0 International Licence
            </a>
          </li>
          <li>
            Data from{' '}
            <a href="https://www.geoboundaries.org/">geoboundaries.org</a>
          </li>
          <li>
            Data from <a href="https://en.wikipedia.org">Wikipedia</a>
          </li>
          <li>Map sources as attributed on each map</li>
        </ul>

        <h2>App</h2>

        <h3>Visual resources</h3>
        <ul>
          {nounprojectCredit.map((entry, i) => (
            <li key={i}>
              {entry.name} by {entry.author} from{' '}
              <a href="https://thenounproject.com">The Noun Project</a>
            </li>
          ))}
          <li>Free Triangle loading Animation by Sun Cx</li>
        </ul>

        <h3>Dependencies</h3>
        <ul>
          {dependencyReport.map((entry) => (
            <li key={entry.name}>
              <a href={entry.repository ?? undefined}>{entry.name}</a>{' '}
              {entry.publisher && <span>by {entry.publisher}</span>}{' '}
              <span>({entry.licenses})</span>
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  );
}
