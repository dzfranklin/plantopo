import { useState } from 'react';
import classNames from '../../classNames';
import { ROOT_FEATURE } from '../feature/features';
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

const UNNAMED_PLACEHOLDER = 'Unnamed Feature';

export default function FeatureTree() {
  return (
    <div className="flex flex-col pt-1 overflow-y-auto border-t border-gray-300 grow">
      <GroupChildren parentId={ROOT_FEATURE} isExpanded={true} />
    </div>
  );
}

function FeatureItem({ feature }) {
  const { type } = feature;
  if (type !== 'group' && type !== 'point' && type !== 'route') {
    console.info(`Unknown feature [type=${feature.type}]`, feature);
    return <></>;
  }

  const dispatch = useAppDispatch();
  const isActive = useAppSelector(selectIsActiveFeature(feature.id));
  const activePeers = useAppSelector(selectPeersActiveOnFeature(feature.id));
  const [isRename, setIsRename] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <ContextMenu.Root
      onOpenChange={(isOpen) => isOpen && dispatch(setActive(feature))}
    >
      <li
        className={classNames(
          'flex px-2 py-1 border-[1px] border-transparent',
          feature.type === 'group' && 'ml-[30px]',
          isActive && 'bg-blue-100',
          activePeers.length > 0 && 'border-dashed border-purple-500',
        )}
      >
        <button onClick={() => setIsExpanded(!isExpanded)}>TODO Exp</button>

        <ContextMenu.Trigger asChild>
          <button
            onClick={() => {
              if (isActive) {
                setIsRename(true);
              } else {
                dispatch(setActive(feature));
              }
            }}
            className="flex overflow-x-hidden text-sm text-left truncate grow"
          >
            {isRename ? (
              <input
                placeholder={UNNAMED_PLACEHOLDER}
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
              <span className={classNames(!feature.name && 'opacity-60')}>
                {feature.name || UNNAMED_PLACEHOLDER}
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

const GroupChildren = ({ parentId, isExpanded }) => {
  const list = useAppSelector(selectFeaturesDisplayList(parentId));

  if (isExpanded) {
    return (
      <ul>
        {list.map((feature) => (
          <FeatureItem key={feature.id} feature={feature} />
        ))}
      </ul>
    );
  } else {
    return <></>;
  }
};
