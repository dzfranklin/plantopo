import { useEffect, useRef, useState } from 'react';
import classNames from '../../classNames';
import { Feature, ROOT_FEATURE, sortFeatures } from '../feature/features';
import { useAppDispatch, useAppSelector } from '../hooks';
import {
  deleteFeature,
  moveActive,
  selectFeaturesList,
  selectIsActiveFeature,
  selectPeersActiveOnFeature,
  setActive,
  updateFeature,
} from '../mapSlice';
import * as ContextMenu from '@radix-ui/react-context-menu';
import '../components/contextMenu.css';
import useFeatureTreeDrag, { DragState } from './useFeatureTreeDrag';
import './featureDrag.css';
import { AnimatePresence, motion } from 'framer-motion';

const UNNAMED_PLACEHOLDER = {
  group: 'Unnamed folder',
  point: 'Unnamed point',
  route: 'Unnamed route',
};

export default function FeatureTree() {
  const dispatch = useAppDispatch();
  const ref = useRef<HTMLDivElement>(null);
  const dragState = useFeatureTreeDrag();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Down' || e.key === 'ArrowDown') {
        dispatch(moveActive('down'));
        e.preventDefault();
      } else if (e.key === 'Up' || e.key === 'ArrowUp') {
        dispatch(moveActive('up'));
        e.preventDefault();
      } else if (e.key === 'Right' || e.key === 'ArrowRight') {
        dispatch(moveActive('in'));
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch]);

  return (
    <div
      ref={ref}
      className="flex flex-col pt-1 mx-[4px] overflow-y-auto border-t border-gray-300 grow"
    >
      <GroupChildren
        parentId={ROOT_FEATURE}
        isExpanded={true}
        dragState={dragState}
      />
    </div>
  );
}

const GroupChildren = ({
  parentId,
  isExpanded,
  dragState,
}: {
  parentId: string;
  isExpanded: boolean;
  dragState: DragState | undefined;
}) => {
  const featureList = useAppSelector(selectFeaturesList(parentId));

  let dragChild: DragState | undefined;
  if (dragState && dragState.parentId === parentId) {
    dragChild = dragState;
  }

  let list: (Feature | DragState)[] = [];
  if (isExpanded) {
    if (dragChild) {
      list = sortFeatures([dragChild, ...featureList]);
    } else {
      list = sortFeatures(featureList);
    }
  }

  return (
    <ul
      className={classNames(
        parentId === ROOT_FEATURE ? 'feature-tree__root' : 'ml-[15px]',
      )}
    >
      <AnimatePresence initial={false}>
        {!isExpanded && dragChild && (
          <DragInsertPoint key="drag-insert-point" />
        )}

        {isExpanded && (
          <motion.div
            key="children"
            initial={'collapsed'}
            animate={'open'}
            exit={'collapsed'}
            variants={{
              open: { opacity: 1, height: 'auto' },
              collapsed: { opacity: 0, height: 0 },
            }}
          >
            {list.map((item) =>
              item.type === 'dragState' ? (
                <DragInsertPoint key="drag-insert-point" />
              ) : (
                <FeatureItem
                  key={item.id}
                  feature={item}
                  dragState={dragState}
                />
              ),
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </ul>
  );
};

const DragInsertPoint = () => (
  <motion.li
    transition={{ duration: window.appSettings.disableAnimation ? 0 : 0.1 }}
    layoutId="drag-insert-point"
    className="feature-tree__insertpoint h-[1px] mx-auto bg-blue-500"
  />
);

function FeatureItem({
  feature,
  dragState,
}: {
  feature: Feature;
  dragState: DragState | undefined;
}) {
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
    <motion.li
      draggable={isRename ? 'false' : 'true'}
      data-feature={feature.id}
      data-feature-type={feature.type}
      data-feature-at={feature.at}
      className="feature-tree__parent"
      layoutId={feature.id}
    >
      <div
        className={classNames(
          'flex flex-row feature-tree__item grow',
          isActive && 'bg-blue-100',
          activePeers.length > 0 && 'border-dashed border-purple-500',
        )}
      >
        {feature.type === 'group' && (
          <button onClick={() => setIsExpanded(!isExpanded)}>Exp</button>
        )}

        <ContextMenu.Root
          onOpenChange={(isOpen) => isOpen && dispatch(setActive(feature.id))}
        >
          <ContextMenu.Trigger asChild>
            <button
              onClick={() => {
                if (isActive) setIsRename(true);
                else dispatch(setActive(feature.id));
              }}
              className="flex flex-row overflow-x-hidden text-sm text-left truncate grow"
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
            </button>
          </ContextMenu.Trigger>
          <FeatureContextMenu feature={feature} setIsRename={setIsRename} />
        </ContextMenu.Root>
      </div>

      {type === 'group' && (
        <GroupChildren
          parentId={feature.id}
          isExpanded={isExpanded}
          dragState={dragState}
        />
      )}
    </motion.li>
  );
}

const FeatureContextMenu = ({ feature, setIsRename }) => {
  const dispatch = useAppDispatch();

  return (
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
  );
};
