import { useRef, useState } from 'react';
import classNames from '../../classNames';
import { Feature, ROOT_FEATURE } from '../feature/features';
import { useAppDispatch, useAppSelector } from '../hooks';
import {
  deleteFeature,
  selectFeaturesDisplayList,
  selectIsActiveFeature,
  selectPeersActiveOnFeature,
  setActive,
  updateFeature,
} from '../mapSlice';
import * as ContextMenu from '@radix-ui/react-context-menu';
import '../components/contextMenu.css';
import useFeatureTreeDrag from './useFeatureTreeDrag';
import './featureDrag.css';

const UNNAMED_PLACEHOLDER = {
  group: 'Unnamed folder',
  point: 'Unnamed point',
  route: 'Unnamed route',
};

export default function FeatureTree() {
  const ref = useRef<HTMLDivElement>(null);
  useFeatureTreeDrag(ref);

  return (
    <div
      ref={ref}
      className="flex flex-col pt-1 mx-[4px] overflow-y-auto border-t border-gray-300 grow"
    >
      <GroupChildren parentId={ROOT_FEATURE} isExpanded={true} />
    </div>
  );
}

const GroupChildren = ({
  parentId,
  isExpanded,
}: {
  parentId: string;
  isExpanded: boolean;
}) => {
  const list = useAppSelector(selectFeaturesDisplayList(parentId));

  if (isExpanded) {
    return (
      <ul className={classNames(parentId !== ROOT_FEATURE && 'ml-[15px]')}>
        {list.map((feature) => (
          <FeatureItem key={feature.id} feature={feature} />
        ))}
      </ul>
    );
  } else {
    return <></>;
  }
};

function FeatureItem({ feature }: { feature: Feature }) {
  const { type } = feature;

  const dispatch = useAppDispatch();
  const isActive = useAppSelector(selectIsActiveFeature(feature.id));
  const activePeers = useAppSelector(selectPeersActiveOnFeature(feature.id));
  const [isRename, setIsRename] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  if (type !== 'group' && type !== 'point' && type !== 'route') {
    console.info(`Unknown feature [type=${feature.type}]`, feature);
    return <></>;
  }

  return (
    <ContextMenu.Root
      onOpenChange={(isOpen) => isOpen && dispatch(setActive(feature.id))}
    >
      <li
        draggable={isRename ? 'false' : 'true'}
        data-feature={feature.id}
        data-feature-type={feature.type}
        className={classNames(
          'tree-feature flex px-2 py-1 border-[1px] border-transparent w-full',
          isActive && 'bg-blue-100',
          activePeers.length > 0 && 'border-dashed border-purple-500',
        )}
      >
        {/* The problem is that in some contexts the children should be in here and in others no
        Crazy idea: Snapshot feature state during a drag. have it set as local state in this file, and use that state to compute the new it
        Crazy idea #2: As you drag compute new ats, and have a dragstub feature type merged in locally. Doesn't re-compute at unnecessarily every little move
         */}
        {feature.type === 'group' && (
          <button onClick={() => setIsExpanded(!isExpanded)}>TODO Exp</button>
        )}

        <ContextMenu.Trigger asChild>
          <button
            onMouseDown={() => !isActive && dispatch(setActive(feature.id))}
            onClick={() => isActive && setIsRename(true)}
            className="flex overflow-x-hidden text-sm text-left truncate grow"
          >
            {isRename ? (
              <input
                placeholder={UNNAMED_PLACEHOLDER[feature.type]}
                value={feature.name || ''}
                onChange={(e) =>
                  dispatch(
                    updateFeature({
                      id: feature.id,
                      update: { name: e.target.value },
                    }),
                  )
                }
                autoFocus
                onFocus={(e) => e.currentTarget.select()}
                onBlur={() => setIsRename(false)}
                onKeyDown={(e) =>
                  (e.key === 'Escape' || e.key === 'Enter') &&
                  setIsRename(false)
                }
                className="bg-blue-100 grow"
              />
            ) : (
              <span
                className={classNames('grow', !feature.name && 'opacity-60')}
              >
                {feature.name || UNNAMED_PLACEHOLDER[feature.type]}
              </span>
            )}

            {type === 'group' && (
              <GroupChildren parentId={feature.id} isExpanded={isExpanded} />
            )}
          </button>
        </ContextMenu.Trigger>

        <ContextMenu.Portal>
          <ContextMenu.Content
            className="ContextMenuContent"
            loop={true}
            collisionPadding={5}
          >
            <ContextMenu.Item
              onClick={() => setTimeout(() => setIsRename(true))}
              className="ContextMenuItem"
            >
              Rename <div className="RightSlot">Alt+R</div>
            </ContextMenu.Item>
            <ContextMenu.Item
              onClick={() => dispatch(deleteFeature(feature))}
              className="ContextMenuItem"
            >
              Delete <div className="RightSlot">Del</div>
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </li>
    </ContextMenu.Root>
  );
}
