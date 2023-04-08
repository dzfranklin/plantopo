import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Awareness as YAwareness } from 'y-protocols/awareness';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import * as decoding from 'lib0/decoding';
import { IndexeddbPersistence } from 'y-indexeddb';
import { ViewAt } from '../ViewAt';
import ComponentChildren from '../components/ComponentChildren';
import { SyncContext } from './context';
import { SyncState } from './types';
import {
  featureCmp,
  idxOfAt,
  parentIdOf,
  parentIdOfAt,
} from '../features/algorithms';
import { Feature } from '../features/types';

const useMapSync = () => useContext(SyncContext);

export const useInitialViewAt = () => useMapSync().initialViewAt;

const useYData = () => useMapSync().aware?.doc.getMap<unknown>('data');

export const useFeatureChildren = (parentId: string): string[] => {
  const yData = useYData();
  const yFeatures = yData?.get('features');
  const [children, setChildren] = useState<string[]>([]);

  useEffect(() => {
    if (!(yFeatures instanceof Y.Map)) return;

    const childIdxes = new Map<string, string>();
    const update = () => {
      const value = Array.from(childIdxes.entries())
        .sort(([aId, aIdx], [bId, bIdx]) => {
          if (aIdx < bIdx) return -1;
          if (aIdx > bIdx) return 1;
          if (aId < bId) return -1;
          if (aId > bId) return 1;
          return 0;
        })
        .map(([id, _idx]) => id);
      setChildren(value);
    };

    for (const [key, value] of yFeatures.entries()) {
      const at = value.get('at');
      if (parentIdOfAt(at) === parentId) childIdxes.set(key, idxOfAt(at));
    }
    update();

    const observer = (events: Y.YMapEvent<unknown>[]) => {
      // `event.path`: the parent of the change. e.g. ['features'] for add features[id]

      let dirty = false;

      for (const event of events) {
        if (event.target === yFeatures) {
          for (const [key, { action, oldValue }] of event.keys) {
            const oldValueAt = oldValue?.get('at') as string | undefined;

            const value = yFeatures.get(key) as Y.Map<unknown> | undefined;
            const valueAt = value?.get('at') as string | undefined;

            if (
              action === 'add' &&
              value &&
              valueAt &&
              parentIdOfAt(valueAt) === parentId
            ) {
              const id = value.get('id') as string;
              const idx = idxOfAt(valueAt);
              childIdxes.set(id, idx);
              dirty = true;
            } else if (
              action === 'delete' &&
              oldValueAt &&
              parentIdOfAt(oldValueAt) === parentId
            ) {
              const id = oldValue.get('id') as string;
              childIdxes.delete(id);
              dirty = true;
            }
          }
        } else if (event.target.parent === yFeatures) {
          if (event.keysChanged.has('at')) {
            const id = event.target.get('id') as string | undefined;
            const at = event.target.get('at') as string | undefined;
            const atParent = at && parentIdOfAt(at);

            if (!id) continue;

            if (at && atParent === parentId) {
              const idx = idxOfAt(at);
              childIdxes.set(id, idx);
              dirty = true;
            } else if (id && childIdxes.has(id)) {
              childIdxes.delete(id);
              dirty = true;
            }
          }
        }
      }

      if (dirty) {
        update();
      }
    };

    yFeatures.observeDeep(observer);

    return () => {
      yFeatures.unobserveDeep(observer);
      setChildren([]);
    };
  }, [parentId, yFeatures]);

  return children;
};
