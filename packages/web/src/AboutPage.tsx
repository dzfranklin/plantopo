import { usePageTitle } from "./usePageTitle";

export default function CreditsPage() {
  usePageTitle("Credits");

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="mb-4 text-2xl font-bold">Credits</h1>
      <p className="mb-2">
        PlanTopo is a side project by{" "}
        <a href="https://dfranklin.dev" className="link">
          Daniel Franklin
        </a>
        . The project is open source and available on{" "}
        <a href="https://github.com/dzfranklin/plantopo" className="link">
          GitHub
        </a>
        .
      </p>

      <p className="mb-2">
        Map data is credited on the map based on the layers you select. This
        project would not be possible without open data from from OpenStreetMap
        and the Ordnance Survey. Thank you!
      </p>

      <p className="mb-2">
        Elevation data comes from a variety of open-data sources via{" "}
        <a href="https://mapterhorn.com/attribution/" className="link">
          Mapterhorn
        </a>
        . This provides excellent coverage of England and Wales, but
        unfortunately no high-quality open data is available for the Scottish
        Highlands. Educational users can use OS Terrain 5 data via{" "}
        <a href="https://digimap.edina.ac.uk/" className="link">
          Digimap
        </a>
        . Contact daniel@plantopo.com to enable educational data for your
        account.
      </p>

      <p className="mb-2">
        <a href="/web-third-party-licenses.html" className="link">
          PlanTopo Web App - Third-Party Licenses
        </a>
      </p>
    </div>
  );
}
