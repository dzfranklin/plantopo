import { useQuery } from "@tanstack/react-query";

import { useSession } from "./auth/auth-client";
import { usePageTitle } from "./usePageTitle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTRPC } from "@/trpc";

export default function AboutPage() {
  usePageTitle("About");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-bold">About</h1>
      <p>
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

      <p>
        This project would not be possible without open data from OpenStreetMap
        and the Ordnance Survey. Thank you!
      </p>

      <LayersAttributionCard />

      <ElevationAttributionCard />

      <p>
        <a href="/web-third-party-licenses.html" className="link">
          PlanTopo Web App - Third-Party Licenses
        </a>
      </p>
    </div>
  );
}

function LayersAttributionCard() {
  const trpc = useTRPC();
  const catalogQuery = useQuery(trpc.map.catalog.queryOptions());

  const isLoading = catalogQuery.isLoading;

  const catalog = catalogQuery.data;
  const styles = catalog ? Object.values(catalog.styles) : [];
  const overlays = catalog ? Object.values(catalog.overlays) : [];
  const stylesWithAttribution = styles.filter(
    style => style.metadata["plantopo:attribution"]?.length,
  );
  const overlaysWithAttribution = overlays.filter(
    style => style.metadata["plantopo:attribution"]?.length,
  );
  const allStylesWithAttribution = [
    ...stylesWithAttribution,
    ...overlaysWithAttribution,
  ];
  const firstStyleId = allStylesWithAttribution[0]?.id;
  const hasAttribution = allStylesWithAttribution.length > 0;
  const initialSelection = isLoading ? "loading" : (firstStyleId ?? "none");

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base">
          Map layers
          <p className="text-muted-foreground mt-1 text-xs">
            <AccountEduStatusLine />
          </p>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs
          key={initialSelection}
          orientation="vertical"
          defaultValue={initialSelection}
          className="flex">
          <TabsList
            variant="line"
            className="max-h-48 w-44 shrink-0 items-stretch justify-start overflow-y-auto border-r p-2">
            <p className="text-muted-foreground px-1.5 py-1 text-[10px] font-semibold tracking-wider uppercase">
              Map
            </p>
            {isLoading
              ? Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={`map-skeleton-${i}`} className="h-7 w-full" />
                ))
              : stylesWithAttribution.map(style => (
                  <TabsTrigger key={style.id} value={style.id}>
                    {style.name ?? style.id}
                  </TabsTrigger>
                ))}

            <p className="text-muted-foreground mt-2 px-1.5 py-1 text-[10px] font-semibold tracking-wider uppercase">
              Overlay
            </p>
            {isLoading
              ? Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton
                    key={`overlay-skeleton-${i}`}
                    className="h-7 w-full"
                  />
                ))
              : overlaysWithAttribution.map(style => (
                  <TabsTrigger key={style.id} value={style.id}>
                    {style.name ?? style.id}
                  </TabsTrigger>
                ))}
          </TabsList>

          {isLoading ? (
            <TabsContent value="loading" className="p-4">
              <Skeleton className="mb-3 h-5 w-40" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[92%]" />
                <Skeleton className="h-4 w-[78%]" />
              </div>
            </TabsContent>
          ) : hasAttribution ? (
            allStylesWithAttribution.map(style => {
              const attributions = style.metadata["plantopo:attribution"] ?? [];
              return (
                <TabsContent key={style.id} value={style.id} className="p-4">
                  <p className="mb-1 text-sm font-medium">
                    {style.name ?? style.id}
                  </p>
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
            })
          ) : (
            <TabsContent value="none" className="p-4">
              <p className="text-muted-foreground text-sm">
                No attribution available.
              </p>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ElevationAttributionCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Elevation data</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
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
        .{" "}
        <span className="italic">
          <AccountEduStatusLine />
        </span>
      </CardContent>
    </Card>
  );
}

function AccountEduStatusLine() {
  const session = useSession();

  if (session.data?.user?.eduAccess) {
    return (
      <span>
        (Your account{" "}
        <span className="underline">{session.data.user.email}</span> is
        configured to use educational-use-only sources.)
      </span>
    );
  } else if (session.data?.user) {
    return (
      <span>
        (Your account{" "}
        <span className="underline">{session.data.user.email}</span> does not
        have access to educational-use-only sources. Contact daniel@plantopo.com
        to request access.)
      </span>
    );
  } else {
    return (
      <span>
        (If you create an account you can request access to educational-use-only
        sources.)
      </span>
    );
  }
}
