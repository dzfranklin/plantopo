import type ml from "maplibre-gl";
import z from "zod";

export type Slot = "bottom" | "middle" | "top";

const boundsSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const StyleMetadataFieldSchema = z
  .object({
    "plantopo:accessScopes": z.array(z.string()).optional(),
    "plantopo:bounds": boundsSchema.optional(),
    "plantopo:thumbnail": z.string().optional(),
  })
  .default({});

export type StyleMetadataField = z.infer<typeof StyleMetadataFieldSchema>;

export interface AppStyle extends ml.StyleSpecification {
  id: string;
  metadata: StyleMetadataField;
}

export interface AppStyleMeta {
  id: string;
  name?: string;
  metadata: StyleMetadataField;
}

export interface StyleCatalog {
  styles: Record<string, AppStyleMeta>;
  overlays: Record<string, AppStyleMeta>;
}

export function insertLayers(
  layers: ml.LayerSpecification[],
  slot: Slot,
  newLayers: ml.LayerSpecification[],
): ml.LayerSpecification[] {
  let slotIndex = layers.findIndex(
    layer => layer.id === `plantopo:slot-${slot}`,
  );
  if (slotIndex === -1) {
    slotIndex = layers.length;
  }
  return [
    ...layers.slice(0, slotIndex),
    ...newLayers,
    ...layers.slice(slotIndex),
  ];
}

export function mergeOverlay(base: AppStyle, overlay: AppStyle): AppStyle {
  const sources = { ...overlay.sources, ...base.sources };

  // Group overlay layers by slot, splitting on plantopo:slot-* placeholders
  // Slot placeholders are stripped from the output; layers inherit the previous slot (default: middle)
  let currentSlot: Slot = "middle";
  const groups: { slot: Slot; layers: ml.LayerSpecification[] }[] = [];
  let currentGroup: ml.LayerSpecification[] = [];

  for (const layer of overlay.layers) {
    const slotMatch = layer.id.match(/^plantopo:slot-(bottom|middle|top)$/);
    if (slotMatch) {
      if (currentGroup.length > 0) {
        groups.push({ slot: currentSlot, layers: currentGroup });
        currentGroup = [];
      }
      currentSlot = slotMatch[1] as Slot;
    } else {
      currentGroup.push({ ...layer, id: `${overlay.id}:${layer.id}` });
    }
  }
  if (currentGroup.length > 0) {
    groups.push({ slot: currentSlot, layers: currentGroup });
  }

  // Insert each group at the matching slot in the base layers
  let mergedLayers = base.layers;
  for (const group of groups) {
    mergedLayers = insertLayers(mergedLayers, group.slot, group.layers);
  }

  return { ...base, sources, layers: mergedLayers };
}
