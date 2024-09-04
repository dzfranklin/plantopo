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
            Data from European Space Agency, Sinergise (2021).{' '}
            <i>Copernicus Global Digital Elevation Model</i>. Distributed by{' '}
            OpenTopography.{' '}
            <a href="https://doi.org/10.5069/G9028PQB">
              https://doi.org/10.5069/G9028PQB
            </a>
          </li>
          <li>
            Elevation data from the{' '}
            <a href="https://earth.jaxa.jp/en/data/policy/">
              Japan Aerospace Exploration Agency
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
