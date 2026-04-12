import {
  keepPreviousData,
  skipToken,
  useQueries,
  useQuery,
} from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import z from "zod";

import { type AppStyle, mergeOverlay } from "@pt/shared";

import { LayerPicker } from "./LayerPicker";
import { MapManager } from "./MapManager";
import { MapView } from "./MapView";
import {
  DEFAULT_SELECTED_LAYERS,
  type MapProps,
  type SelectedLayers,
  SelectedLayersSchema,
} from "./types";
import { useUserPrefs } from "@/auth/auth-client";
import { useTRPC } from "@/trpc";

type AppMapProps = Omit<MapProps, "style" | "distanceUnit">;

export function AppMap(props: AppMapProps) {
  const trpc = useTRPC();
  const prefs = useUserPrefs();

  const unsubscribeIdleRef = useRef<(() => void) | null>(null);
  const { onManager: onManagerProp, ...forwardedProps } = props;
  const onManager = useCallback(
    (m: MapManager) => {
      unsubscribeIdleRef.current?.();
      const { unsubscribe } = m.on("idle", () => {
        if (!m.hasMoved) return;
        saveLocalDefaults(p => ({
          ...p,
          camera: m.serializeCamera(),
        }));
      });
      unsubscribeIdleRef.current = unsubscribe;
      onManagerProp?.(m);
    },
    [onManagerProp],
  );

  const localDefaults = useMemo(() => getLocalDefaults(), []);
  const [selectedLayers, setSelectedLayers] = useState(
    localDefaults.selectedLayers ?? DEFAULT_SELECTED_LAYERS,
  );

  const onSelectLayers = useCallback((selectedLayers: SelectedLayers) => {
    setSelectedLayers(selectedLayers);
    saveLocalDefaults(d => ({ ...d, selectedLayers }));
  }, []);

  const styleQuery = useQuery(
    trpc.map.style.queryOptions(selectedLayers?.style ?? skipToken, {
      staleTime: Infinity,
      gcTime: Infinity,
      placeholderData: selectedLayers?.style ? keepPreviousData : undefined,
      throwOnError: false,
    }),
  );
  if (styleQuery.error) {
    if (
      styleQuery.error.data?.httpStatus === 404 &&
      selectedLayers?.style === localDefaults.selectedLayers?.style &&
      selectedLayers?.style !== "default"
    ) {
      console.warn(
        `Failed to load stored default style, resetting (defaults: ${JSON.stringify({ defaults: localDefaults })})`,
        styleQuery.error.data,
      );
      clearLocalDefaults();
      setSelectedLayers(DEFAULT_SELECTED_LAYERS);
    } else {
      throw styleQuery.error;
    }
  }
  const baseStyle = styleQuery.data as AppStyle | undefined;

  const overlayQueries = useQueries({
    queries: (selectedLayers?.overlays ?? []).map(id =>
      trpc.map.overlay.queryOptions(id, {
        staleTime: Infinity,
        gcTime: Infinity,
      }),
    ),
  });

  const style = useMemo(() => {
    if (!baseStyle) return undefined;
    const loadedOverlays = overlayQueries
      .map(q => q.data as AppStyle | undefined)
      .filter((o): o is AppStyle => o !== undefined);
    return loadedOverlays.reduce(mergeOverlay, baseStyle);
  }, [baseStyle, overlayQueries]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <MapView
        {...forwardedProps}
        style={style}
        distanceUnit={prefs.distanceUnit}
        initialCamera={localDefaults.camera}
        onManager={onManager}
      />
      <div className="absolute right-2 bottom-8 z-10">
        <LayerPicker selected={selectedLayers} onSelect={onSelectLayers} />
      </div>
    </div>
  );
}

const LocalDefaultsSchema = z.object({
  selectedLayers: SelectedLayersSchema.optional(),
  camera: z.string().optional(),
});

type LocalDefaults = z.infer<typeof LocalDefaultsSchema>;

function getLocalDefaults(): LocalDefaults {
  const raw = localStorage.getItem("mapDefaults");
  const parsed = LocalDefaultsSchema.safeParse(raw ? JSON.parse(raw) : {});
  if (parsed.success) {
    return parsed.data;
  } else {
    console.warn("Failed to parse map defaults, using defaults schema", {
      error: parsed.error,
      raw,
    });
    localStorage.removeItem("mapDefaults");
    return {};
  }
}

function saveLocalDefaults(
  defaults: LocalDefaults | ((d: LocalDefaults) => LocalDefaults),
) {
  const newDefaults =
    typeof defaults === "function" ? defaults(getLocalDefaults()) : defaults;
  localStorage.setItem("mapDefaults", JSON.stringify(newDefaults));
}

function clearLocalDefaults() {
  localStorage.removeItem("mapDefaults");
}
