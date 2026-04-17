import { useQuery } from "@tanstack/react-query";

import { useSession } from "./auth/auth-client";
import { usePageTitle } from "./usePageTitle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTRPC } from "@/trpc";

export default function AboutPage() {
  usePageTitle("About");

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="mb-4 text-2xl font-bold">About</h1>
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

      <p className="mb-4">
        Map data is credited on the map based on the layers you select. This
        project would not be possible without open data from OpenStreetMap and
        the Ordnance Survey. Thank you!
      </p>

      <LayersAttribution />

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

function LayersAttribution() {
  const session = useSession();
  const trpc = useTRPC();
  const catalogQuery = useQuery(trpc.map.catalog.queryOptions());

  const catalog = catalogQuery.data;
  const styles = catalog ? Object.values(catalog.styles) : [];
  const overlays = catalog ? Object.values(catalog.overlays) : [];
  const allStyles = [...styles, ...overlays];
  const firstWithAttribution = allStyles.find(
    s => s.metadata["plantopo:attribution"]?.length,
  );

  if (!firstWithAttribution) return null;

  return (
    <div className="mb-4">
      <h2 className="mb-2 text-base font-semibold">Map layers</h2>
      {session.data?.user?.eduAccess && (
        <p className="text-muted-foreground mb-2 text-sm">
          (Your account has educational data enabled)
        </p>
      )}

      <Tabs
        orientation="vertical"
        defaultValue={firstWithAttribution.id}
        className="rounded-lg border">
        <TabsList variant="line" className="w-44 shrink-0 border-r p-2">
          <p className="text-muted-foreground px-1.5 py-1 text-[10px] font-semibold tracking-wider uppercase">
            Map
          </p>
          {styles.map(style =>
            style.metadata["plantopo:attribution"]?.length ? (
              <TabsTrigger key={style.id} value={style.id}>
                {style.name ?? style.id}
              </TabsTrigger>
            ) : null,
          )}

          <p className="text-muted-foreground mt-2 px-1.5 py-1 text-[10px] font-semibold tracking-wider uppercase">
            Overlay
          </p>
          {overlays.map(style =>
            style.metadata["plantopo:attribution"]?.length ? (
              <TabsTrigger key={style.id} value={style.id}>
                {style.name ?? style.id}
              </TabsTrigger>
            ) : null,
          )}
        </TabsList>

        {allStyles.map(style => {
          const attributions = style.metadata["plantopo:attribution"];
          if (!attributions?.length) return null;
          return (
            <TabsContent key={style.id} value={style.id} className="p-4">
              <p className="mb-1 font-medium">{style.name ?? style.id}</p>
              <ul className="text-muted-foreground space-y-1 text-sm">
                {attributions.map((attr, i) => (
                  <li
                    key={i}
                    dangerouslySetInnerHTML={{ __html: attr }}
                    className="link-container"
                  />
                ))}
              </ul>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
