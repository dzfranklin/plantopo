import {
  keepPreviousData,
  skipToken,
  useQueries,
  useQuery,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import z from "zod";

import { type AppStyle, mergeOverlay } from "@pt/shared";

import { LayerPicker } from "./LayerPicker";
import { MapManager } from "./MapManager";
import { MapView } from "./MapView";
import { PointInfoPopup } from "./PointInfoPopup";
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

  const { onManager: onManagerProp, hash, ...forwardedProps } = props;
  const initialOnManagerPropRef = useRef(onManagerProp);

  const [manager, setManager] = useState<MapManager | null>(null);

  const onManager = useCallback((m: MapManager) => {
    initialOnManagerPropRef.current?.(m);
    setManager(m);

    m.on("idle", () => {
      if (!m.hasMoved) return;
      saveLocalDefaults(p => ({ ...p, camera: m.serializeCamera() }));
    });
  }, []);

  const localDefaults = useMemo(() => getLocalDefaults(), []);
  const [selectedLayers, setSelectedLayers] = useState(() => {
    if (hash) {
      const fromHash = getHashLayers();
      if (fromHash) return fromHash;
    }
    return localDefaults.selectedLayers ?? DEFAULT_SELECTED_LAYERS;
  });

  const onSelectLayers = useCallback(
    (selectedLayers: SelectedLayers) => {
      setSelectedLayers(selectedLayers);
      saveLocalDefaults(d => ({ ...d, selectedLayers }));
      if (hash) setHashLayers(selectedLayers);
    },
    [hash],
  );

  // Keep selectedLayers in sync if the hash is changed externally
  useEffect(() => {
    if (!hash) return;
    const handler = () => {
      const fromHash = getHashLayers();
      if (fromHash) setSelectedLayers(fromHash);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [hash]);

  // Write initial selectedLayers into the hash on mount
  useEffect(() => {
    if (!hash) return;
    if (!getHashLayers()) setHashLayers(selectedLayers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const loadedOverlays = useQueries({
    queries: (selectedLayers?.overlays ?? []).map(id =>
      trpc.map.overlay.queryOptions(id, {
        staleTime: Infinity,
        gcTime: Infinity,
      }),
    ),
    combine: results =>
      results
        .map(q => q.data as AppStyle | undefined)
        .filter((o): o is AppStyle => o !== undefined),
  });

  const style = useMemo(
    () =>
      baseStyle ? loadedOverlays.reduce(mergeOverlay, baseStyle) : undefined,
    [baseStyle, loadedOverlays],
  );

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <MapView
        {...forwardedProps}
        hash={hash}
        style={style}
        distanceUnit={prefs.distanceUnit}
        initialCamera={localDefaults.camera}
        onManager={onManager}
      />
      <PointInfoPopup manager={manager} />
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

function encodeId(id: string): string {
  // decodeId isn't needed, as decodeURIComponent will decode all percent-encoded sequences
  return id.replaceAll("~", "%7E").replaceAll("+", "%2B");
}

// Serialize: "style~overlay1+overlay2" or just "style" if no overlays.
function serializeSelectedLayers(layers: SelectedLayers): string {
  const style = encodeId(layers.style);
  if (layers.overlays.length === 0) return style;
  const overlays = layers.overlays.map(encodeId).join("+");
  return `${style}~${overlays}`;
}

function deserializeSelectedLayers(s: string): SelectedLayers | null {
  const tildeIdx = s.indexOf("~");
  const style = decodeURIComponent(tildeIdx === -1 ? s : s.slice(0, tildeIdx));
  const overlaysStr = tildeIdx === -1 ? "" : s.slice(tildeIdx + 1);
  const overlays = overlaysStr
    ? overlaysStr.split("+").map(decodeURIComponent)
    : [];
  const result = SelectedLayersSchema.safeParse({ style, overlays });
  return result.success ? result.data : null;
}

function getHashLayers(): SelectedLayers | null {
  const hash = location.hash.slice(1); // remove leading #
  for (const part of hash.split("&")) {
    if (part.startsWith("l=")) {
      return deserializeSelectedLayers(part.slice(2));
    }
  }
  return null;
}

function setHashLayers(layers: SelectedLayers) {
  const serialized = serializeSelectedLayers(layers);
  const hash = location.hash.slice(1);
  const parts = hash ? hash.split("&") : [];
  const idx = parts.findIndex(p => p.startsWith("l="));
  const entry = `l=${serialized}`;
  if (idx === -1) {
    parts.push(entry);
  } else {
    parts[idx] = entry;
  }
  const newHash = parts.join("&");
  history.replaceState(
    null,
    "",
    `${location.pathname}${location.search}#${newHash}`,
  );
}
