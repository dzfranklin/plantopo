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
            Data from{' '}
            <a href="https://www.hills-database.co.uk">
              The Database of British and Irish Hills
            </a>
            licensed under a{' '}
            <a href="http://creativecommons.org/licenses/by/4.0/">
              Creative Commons Attribution 4.0 International Licence
            </a>
          </li>
          <li>
            Data from <a href="https://en.wikipedia.org">Wikipedia</a>
          </li>
        </ul>

        <h2>App</h2>

        <h3>Icons</h3>
        <ul>
          {nounprojectCredit.map((entry, i) => (
            <li key={i}>
              {entry.name} by {entry.author} from{' '}
              <a href="https://thenounproject.com">The Noun Project</a>
            </li>
          ))}
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

        <h2>API</h2>
        <p>
          See{' '}
          <a href="https://github.com/dzfranklin/plantopo-api/blob/main/go.mod">
            github.com/dzfranklin/plantopo-api/blob/main/go.mod
          </a>
        </p>

        <h2>Elevation API</h2>
        <p>
          See{' '}
          <a href="https://github.com/dzfranklin/elevation-api/blob/main/Cargo.toml">
            github.com/dzfranklin/elevation-api/blob/main/Cargo.toml
          </a>
        </p>

        <h2>ToGeoJSON API</h2>
        <p>
          See{' '}
          <a href="https://github.com/dzfranklin/togeojson-server/blob/main/deno.lock">
            github.com/dzfranklin/togeojson-server/blob/main/deno.lock
          </a>
        </p>
      </section>
    </Layout>
  );
}
