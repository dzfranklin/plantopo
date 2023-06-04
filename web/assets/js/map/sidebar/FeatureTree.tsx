import useSyncSelector from '../sync/useSyncSelector';
import useResources, { Resources } from '../useResources';
import { SyncState } from '../sync/types';
import {
  GROUP_FEATURE,
  ROOT_FEATURE as ROOT_FEATURE,
  Feature,
  ROUTE_FEATURE,
  POINT_FEATURE,
} from '../features/types';
import {
  Key,
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import classNames from '../../classNames';
import { useRef } from 'react';
import useSync from '../sync/useSync';
import { SyncClient } from '../sync/SyncClient';
import {
  ControlledTreeEnvironment,
  DraggingPosition,
  Tree,
  TreeItem,
  TreeItemIndex,
} from 'react-complex-tree';
import 'react-complex-tree/lib/style-modern.css';
import useSyncDispatch from '../sync/useSyncDispatch';

type Item = TreeItem<Feature | null>;

export default function FeatureTree() {
  const sync = useSync();
  const resources = useResources();

  const [focused, setFocused] = useState<string | undefined>(undefined);
  const [expanded, setExpanded] = useState<Array<string>>([]);
  const [selected, setSelected] = useState<Array<string>>([]);

  const treeItems: Record<string, Item> = useSyncSelector((s) =>
    Object.entries(s.features.value).reduce(
      (acc, [id, value]) => {
        const isFolder = value.type === GROUP_FEATURE;
        acc[value.id] = {
          index: id,
          children: isFolder ? s.features.order[id] || [] : undefined,
          isFolder,
          data: value,
        };
        return acc;
      },
      {
        [ROOT_FEATURE]: {
          index: ROOT_FEATURE,
          children: s.features.order[ROOT_FEATURE] || [],
          isFolder: true,
          data: null,
        },
      },
    ),
  );

  const onSelectItems = useCallback(
    (items: Array<string>) => {
      const state = sync.state().features;
      const ids: Array<string> = [];
      for (const id of items) {
        ids.push(id);
        getAllChildren(state, id, ids);
      }
      setSelected(ids);
    },
    [sync],
  );

  const onDrop = useCallback(
    (items: Array<Item>, target: DraggingPosition) => {
      const state = sync.state().features;

      const ids = items
        .filter((item): item is TreeItem<Feature> => item !== null)
        .sort((a, b) => a.data.linearIdx - b.data.linearIdx)
        .map((item) => item.index);

      switch (target.targetType) {
        case 'item': {
          sync.dispatch({
            type: 'feature/move',
            payload: {
              ids,
              parent: target.targetItem,
              before: undefined,
              after: state.order[target.targetItem]?.[0],
            },
          });
          break;
        }
        case 'between-items': {
          const sibs = state.order[target.parentItem] || [];

          // Note: childIndex is the index an inserted single id would have
          let beforeIdx = Math.max(0, target.childIndex - 1);
          let afterIdx = Math.min(sibs.length - 1, target.childIndex);
          if (sibs[beforeIdx] === ids[0]) {
            beforeIdx -= 1;
          }
          if (sibs[afterIdx] === ids[ids.length - 1]) {
            afterIdx += 1;
          }
          const before = sibs[beforeIdx];
          const after = sibs[afterIdx];

          sync.dispatch({
            type: 'feature/move',
            payload: {
              ids,
              parent: target.parentItem,
              before,
              after,
            },
          });
          break;
        }
        case 'root': {
          sync.dispatch({
            type: 'feature/move',
            payload: {
              ids,
              parent: ROOT_FEATURE,
              before: undefined,
              after: state.order[ROOT_FEATURE]?.[0],
            },
          });
          break;
        }
      }
    },
    [sync],
  );

  // TODO: Style
  if (resources.isError) {
    return <div>Error loading</div>;
  } else if (!resources.data) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col pt-1 mx-[4px] overflow-y-auto grow">
      <ControlledTreeEnvironment
        canDragAndDrop={true}
        canReorderItems={true}
        canDropOnFolder={true}
        items={treeItems}
        getItemTitle={(value) => value.data?.attrs.name || ''}
        viewState={{
          root: {
            focusedItem: focused,
            expandedItems: expanded,
            selectedItems: selected,
          },
        }}
        onFocusItem={(item) => setFocused(item.index as string)}
        onExpandItem={(item) =>
          setExpanded((p) => [...p, item.index as string])
        }
        onCollapseItem={(item) =>
          setExpanded((p) => p.filter((i) => i !== (item.index as string)))
        }
        onSelectItems={onSelectItems}
        onDrop={onDrop}
        renderItemTitle={ItemTitle}
      >
        <Tree treeId="root" rootItem={ROOT_FEATURE} />
      </ControlledTreeEnvironment>
    </div>
  );
}

const UNNAMED_PLACEHOLDER = {
  [GROUP_FEATURE]: 'folder',
  [ROUTE_FEATURE]: 'route',
  [POINT_FEATURE]: 'point',
};

function ItemTitle({ item }: { item: Item }) {
  if (item.data === null) return null;
  const { attrs, type } = item.data;
  return <span>{attrs.name || `Unnamed ${UNNAMED_PLACEHOLDER[type]}`}</span>;
}

const getAllChildren = (
  state: SyncState['features'],
  id: string,
  out: Array<string>,
) => {
  const children = state.order[id] || [];
  for (const child of children) {
    out.push(child);
    if (state.value[child]?.type === GROUP_FEATURE) {
      getAllChildren(state, child, out);
    }
  }
};
