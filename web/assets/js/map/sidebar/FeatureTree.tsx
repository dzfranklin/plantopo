import { useEffect, useRef, useState } from 'react';
import classNames from '../../classNames';
import {
  Feature,
  parentIdOf,
  ROOT_FEATURE,
  serializeAt,
} from '../feature/features';
import { useAppDispatch, useAppSelector, useAppStore } from '../hooks';
import {
  deleteFeature,
  selectFeaturesDisplayList,
  selectIsActiveFeature,
  selectLastTopLevelFeature,
  selectPeersActiveOnFeature,
  setActive,
  updateFeature,
} from '../mapSlice';
import * as ContextMenu from '@radix-ui/react-context-menu';
import '../components/contextMenu.css';
import { idxBetween } from '../feature/fracIdx';

const UNNAMED_PLACEHOLDER = 'Unnamed Feature';
const DRAG_NEST_AFTER_MS = 500;

// Why the fuck did the end/drop events stop? maybe use react-dnd

export default function FeatureTree() {
  const store = useAppStore();
  const ref = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  useEffect(() => {
    const handler = (e: DragEvent) => {
      const treeElem = ref.current?.firstElementChild;
      if (!treeElem || !isFeatureDrag(e)) return;
      const dragId = e.dataTransfer!.getData('plantopo/feature');
      e.preventDefault();
      console.info('windowover');

      const box = treeElem.getBoundingClientRect();
      const mid = box.top + box.height / 2;

      if (e.clientY < mid) {
        const after = selectLastTopLevelFeature(store.getState())?.id;
        setDragState({
          id: dragId,
          before: undefined,
          after,
          parent: ROOT_FEATURE,
        });
      } else {
        const before = selectLastTopLevelFeature(store.getState())?.id;
        setDragState({
          id: dragId,
          before,
          after: undefined,
          parent: ROOT_FEATURE,
        });
      }
    };
    window.addEventListener('dragover', handler);
    return () => window.removeEventListener('dragover', handler);
  }, [store]);

  return (
    <div
      ref={ref}
      className="flex flex-col pt-1 overflow-y-auto border-t border-gray-300 grow"
    >
      <GroupChildren
        parentId={ROOT_FEATURE}
        isExpanded={true}
        dragState={dragState}
        setDragState={setDragState}
      />
    </div>
  );
}

type SetDragState = React.Dispatch<React.SetStateAction<DragState>>;

type DragState = null | {
  id: string;
  // The feature that would come directly before the dragged feature if it was
  // dropped right now
  before: string | undefined;
  parent: string;
  after: string | undefined;
};

const GroupChildren = (props: {
  parentId: string;
  isExpanded: boolean;
  dragState: DragState;
  setDragState: SetDragState;
}) => {
  const { parentId, isExpanded, dragState, setDragState } = props;
  const list = useAppSelector(selectFeaturesDisplayList(parentId));

  if (isExpanded) {
    return (
      <ul>
        <li>
          {dragState && dragState.before === undefined && (
            <DragPreview nest={false} />
          )}
        </li>

        {list.map((feature, idx, list) => (
          <li key={feature.id}>
            {(!dragState || dragState.id !== feature.id) && (
              <GroupChild
                key={feature.id}
                feature={feature}
                idx={idx}
                list={list}
                dragState={dragState}
                setDragState={setDragState}
              />
            )}

            {dragState && dragState.before === feature.id && (
              <DragPreview nest={dragState.parent === feature.id} />
            )}
          </li>
        ))}
      </ul>
    );
  } else {
    return <></>;
  }
};

const GroupChild = ({
  feature,
  idx,
  list,
  dragState,
  setDragState,
}: {
  feature: Feature;
  idx: number;
  list: Feature[];
  dragState: DragState;
  setDragState: SetDragState;
}) => {
  return (
    <div
      onDragOver={(e) => {
        if (!isFeatureDrag(e) || !dragState) return;
        e.preventDefault();
        e.stopPropagation();

        const dragId = e.dataTransfer.getData('plantopo/feature');
        const over = feature;
        const overElem = e.target as HTMLElement;

        let beforeOver: Feature | undefined = list[idx - 1];
        let afterOver: Feature | undefined = list[idx + 1];
        if (beforeOver?.id === dragId) beforeOver = list[idx - 2];
        if (afterOver?.id === dragId) afterOver = list[idx + 2];

        const overbox = overElem.getBoundingClientRect();
        const relY = e.pageY - overbox.top;

        let before: Feature | undefined;
        let after: Feature | undefined;
        if (relY > overbox.height / 2) {
          before = over;
          after = afterOver;
        } else {
          before = beforeOver;
          after = over;
        }
        console.info(dragId, before?.['name'], after?.['name']);

        setDragState({
          id: dragId,
          before: before?.id,
          after: after?.id,
          parent: before ? parentIdOf(before) : ROOT_FEATURE,
        });
      }}
    >
      <FeatureItem
        key={feature.id}
        feature={feature}
        dragState={dragState}
        setDragState={setDragState}
      />
    </div>
  );
};

const isFeatureDrag = (e: DragEvent | React.DragEvent<any>) =>
  e.dataTransfer?.types?.includes('plantopo/feature') ?? false;

const DragPreview = ({ nest }) => {
  return <div className={classNames(nest && 'ml-[20px]')}>dp</div>;
};

function FeatureItem(props: {
  feature: Feature;
  dragState: DragState;
  setDragState: SetDragState;
}) {
  const { feature, dragState, setDragState } = props;
  const { type } = feature;

  const dispatch = useAppDispatch();
  const isActive = useAppSelector(selectIsActiveFeature(feature.id));
  const activePeers = useAppSelector(selectPeersActiveOnFeature(feature.id));
  const [isRename, setIsRename] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dragHoverTimer, setDragHoverTimer] = useState<any>(null);

  useEffect(() => {
    return () => {
      if (dragHoverTimer) clearTimeout(dragHoverTimer);
    };
  }, [dragHoverTimer]);

  if (type !== 'group' && type !== 'point' && type !== 'route') {
    console.info(`Unknown feature [type=${feature.type}]`, feature);
    return <></>;
  }

  return (
    <ContextMenu.Root
      onOpenChange={(isOpen) => isOpen && dispatch(setActive(feature))}
    >
      <div
        draggable="true"
        onDragStart={(e) => {
          if (isRename) return;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('plantopo/feature', feature.id);
        }}
        onDragEnter={(e) => {
          if (!isFeatureDrag(e)) return;
          e.preventDefault();

          if (feature.type === 'group') {
            const timer = setTimeout(() => {
              setDragState((prev) => prev && { ...prev, parent: feature.id });
            }, DRAG_NEST_AFTER_MS);
            setDragHoverTimer(timer);
          }
        }}
        onDragExit={(e) => {
          if (!isFeatureDrag(e)) return;
          e.preventDefault();
          if (dragHoverTimer) {
            clearTimeout(dragHoverTimer);
            setDragHoverTimer(null);
          }
        }}
        onDrop={(e) => {
          console.info('drop');
          if (!isFeatureDrag(e) || !dragState) return;
          e.preventDefault();

          const idx = idxBetween(dragState.before, dragState.after);
          const at = serializeAt(dragState.parent, idx);

          setDragState(null);
          dispatch(
            updateFeature({
              id: feature.id,
              update: { at },
            }),
          );
        }}
        onDragEnd={(e) => {
          console.info('dragend');
          if (!isFeatureDrag(e)) return;
          e.preventDefault();
          if (dragState) setDragState(null);
        }}
        className={classNames(
          'flex px-2 py-1 border-[1px] border-transparent w-full',
          feature.type === 'group' && 'ml-[30px]',
          isActive && 'bg-blue-100',
          activePeers.length > 0 && 'border-dashed border-purple-500',
        )}
      >
        <button onClick={() => setIsExpanded(!isExpanded)}>TODO Exp</button>

        <ContextMenu.Trigger asChild>
          <button
            onMouseDown={() => !isActive && dispatch(setActive(feature))}
            onClick={() => isActive && setIsRename(true)}
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
              <span
                className={classNames('grow', !feature.name && 'opacity-60')}
              >
                {feature.name || UNNAMED_PLACEHOLDER}
              </span>
            )}

            {type === 'group' && (
              <GroupChildren
                parentId={feature.id}
                isExpanded={isExpanded}
                dragState={props.dragState}
                setDragState={props.setDragState}
              />
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
      </div>
    </ContextMenu.Root>
  );
}
