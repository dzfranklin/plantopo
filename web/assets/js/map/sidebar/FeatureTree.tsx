import { useState } from 'react';
import classNames from '../../classNames';
import {
  Feature,
  GroupFeature,
  PointFeature,
  ROOT_FEATURE,
  RouteFeature,
} from '../features';
import { useAppDispatch, useAppSelector } from '../hooks';
import {
  selectFeaturesDisplayList,
  selectIsActiveFeature,
  selectPeersActiveOnFeature,
  startCreate,
} from '../mapSlice';
import AddDropdown from './AddDropdown';

export default function FeatureTree() {
  const dispatch = useAppDispatch();

  // TODO: refactor so that parent is a part of idx, as they need to go together

  return (
    <div className="flex flex-col overflow-y-scroll grow">
      <div className="sticky flex flex-row justify-end mx-[14px] pb-8px">
        <AddDropdown onNew={(type) => dispatch(startCreate({ type }))} />
      </div>

      <Group
        feature={null}
        id={ROOT_FEATURE}
        isActive={false}
        activePeers={[]}
      />

      <div className="h-[50%] max-h-[200px]">TODO feature editor</div>
    </div>
  );
}

// TODO: Scroll to active

function Feature({ feature }) {
  const isActive = useAppSelector(selectIsActiveFeature(feature.id));
  const activePeers = useAppSelector(selectPeersActiveOnFeature(feature.id));
  const props = {
    id: feature.id,
    feature,
    isActive,
    activePeers,
  };

  if (feature.type === 'group') {
    return <Group {...props} />;
  } else if (feature.type === 'point') {
    return <Point {...props} />;
  } else if (feature.type === 'route') {
    return <Route {...props} />;
  } else {
    console.warn(`Unknown feature [type=${feature.type}]`, feature);
    return <></>;
  }
}

interface FeatureProps<T> {
  feature: T;
  id: string;
  isActive: boolean;
  activePeers: number[];
}

function Group({ feature, id }: FeatureProps<GroupFeature | null>) {
  const list = useAppSelector(selectFeaturesDisplayList(id));
  const [isExpanded, setIsExpanded] = useState(id === ROOT_FEATURE);

  return (
    <div className={classNames(!feature && 'grow')}>
      {feature && (
        <div>
          <button onClick={() => setIsExpanded(!isExpanded)}>
            TODO EXPAND ICON
          </button>

          <p>{feature.name}</p>
        </div>
      )}

      {isExpanded && (
        <ul>
          {list.map((feature) => (
            <Feature key={feature.id} feature={feature} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Point({ feature }: FeatureProps<PointFeature>) {
  return (
    <li>
      <span>{feature.name || 'Unnamed point'}</span>
    </li>
  );
}

function Route({ feature }: FeatureProps<RouteFeature>) {
  return (
    <li>
      <span>{feature.name || 'Unnamed route'}</span>
    </li>
  );
}
