import { Dialog } from '@/components/dialog';
import { Button } from '@/components/button';
import { overlayStyles } from '@/features/map/style';
import JSONView from '@/components/JSONView';
import * as ml from 'maplibre-gl';
import { ReactNode } from 'react';

export function InspectFeaturesDialog({
  show,
  onClose,
  features,
}: {
  show: boolean;
  onClose: () => void;
  features: ml.MapGeoJSONFeature[];
}) {
  return (
    <Dialog open={show} onClose={onClose}>
      <Dialog.Title>Inspect features</Dialog.Title>
      <Dialog.Body>
        <ul className="w-full max-w-full text-sm space-y-4">
          {features.map((feature, i) => (
            <li
              key={i}
              className="w-full max-w-full border border-gray-400 p-2 rounded-sm"
            >
              <InspectFeature feature={feature} />
            </li>
          ))}
        </ul>
      </Dialog.Body>
      <Dialog.Actions>
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
}

function InspectFeature({ feature }: { feature: ml.MapGeoJSONFeature }) {
  let sourceName: string;
  if (feature.source.startsWith('overlay:')) {
    const sourceID = feature.source.split(':')[1]!;
    sourceName = (overlayStyles[sourceID]?.name ?? 'Unknown') + ' (overlay)';
  } else {
    sourceName = 'Base';
  }

  return (
    <div>
      <table className="w-full max-w-full table-fixed">
        <tbody>
          <InspectFeaturePropRow label="ID" value={feature.id} />
          <InspectFeaturePropRow label="Source" value={sourceName} />
          <InspectFeaturePropRow
            label="Source layer"
            value={feature.sourceLayer}
          />
          {Object.entries(feature.properties).map(([key, value]) => (
            <InspectFeaturePropRow key={key} label={key} value={value} />
          ))}
          <InspectFeaturePropRow label="Geometry">
            <span className="p-1 select-all">
              {JSON.stringify(feature.geometry)}
            </span>
          </InspectFeaturePropRow>
        </tbody>
      </table>

      {feature.layer && (
        <details>
          <summary>Layer</summary>

          <JSONView data={feature.layer} />
        </details>
      )}
    </div>
  );
}

function InspectFeaturePropRow(
  props: {
    label: string;
  } & ({ value: unknown } | { children: ReactNode }),
) {
  return (
    <tr>
      <td
        className="w-28 mr-4 text-left truncate font-medium"
        title={props.label}
      >
        {props.label}
      </td>
      <td
        className="text-left truncate"
        title={'value' in props ? stringValue(props.value) : ''}
      >
        {'value' in props && <InspectFeaturePropValue value={props.value} />}
        {'children' in props && props.children}
      </td>
    </tr>
  );
}

function InspectFeaturePropValue({ value }: { value: unknown }) {
  return stringValue(value);
}

function stringValue(value: unknown): string {
  if (value === undefined || value === '') {
    return '';
  } else if (typeof value === 'string') {
    return value;
  } else if (typeof value === 'number') {
    return value.toString();
  } else {
    return JSON.stringify(value);
  }
}
