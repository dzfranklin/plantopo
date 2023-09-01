import RootOverlay from '@/generic/RootOverlay';
import { SyncEngine } from '../api/SyncEngine/SyncEngine';
import {
  ActionButton,
  Dialog,
  DialogTrigger,
  Slider,
  useDragAndDrop,
} from '@adobe/react-spectrum';
import { ListView, Item } from '@react-spectrum/list';
import { DOMProps } from '@react-types/shared';
import EditIcon from '@spectrum-icons/workflow/Edit';
import LayersIcon from '@spectrum-icons/workflow/Layers';
import { ReactNode, RefObject, useCallback, useRef, useState } from 'react';
import {
  AriaButtonProps,
  useButton,
  useDialog,
  useOverlayTrigger,
  usePopover,
} from 'react-aria';
import { OverlayTriggerState, useOverlayTriggerState } from 'react-stately';
import { useScene } from '../api/useScene';
import { InactiveSceneLayer, SceneLayer } from '../api/SyncEngine/Scene';

export function LayersControl({ engine }: { engine: SyncEngine }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverState = useOverlayTriggerState({});
  const { triggerProps, overlayProps } = useOverlayTrigger(
    { type: 'dialog' },
    popoverState,
    triggerRef,
  );

  return (
    <>
      <ControlOpenButton buttonProps={triggerProps} buttonRef={triggerRef} />
      {popoverState.isOpen && (
        <ControlPopover
          popoverState={popoverState}
          triggerRef={triggerRef}
          overlayProps={overlayProps}
        >
          <OrderControl engine={engine} />
        </ControlPopover>
      )}
    </>
  );
}

function ControlOpenButton(props: {
  buttonProps: AriaButtonProps<'button'>;
  buttonRef: RefObject<HTMLButtonElement>;
}) {
  const { buttonProps } = useButton(props.buttonProps, props.buttonRef);
  return (
    <div className="absolute bottom-0 right-0 z-30 m-[10px]">
      <button
        className="bg-white rounded border-gray-400 p-1.5 border"
        {...buttonProps}
        ref={props.buttonRef}
      >
        <LayersIcon />
      </button>
    </div>
  );
}

function ControlPopover({
  triggerRef,
  popoverState,
  overlayProps,
  children,
}: {
  triggerRef: RefObject<Element>;
  popoverState: OverlayTriggerState;
  overlayProps: DOMProps;
  children: ReactNode;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const { underlayProps, popoverProps, arrowProps } = usePopover(
    {
      popoverRef,
      triggerRef,
      containerPadding: 10,
      placement: 'top',
      offset: 10,
    },
    popoverState,
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const { dialogProps } = useDialog(overlayProps, dialogRef);
  return (
    <RootOverlay>
      <div {...underlayProps} className="fixed inset-0" />
      <div {...popoverProps} ref={popoverRef}>
        <svg
          {...arrowProps}
          className="absolute fill-white top-full translate-x-[-50]"
          width="12px"
          height="12px"
          viewBox="0 0 100 100"
        >
          <polygon points="0,0 100,0 50,50 0,0" />
        </svg>

        <div
          {...overlayProps}
          {...dialogProps}
          ref={dialogRef}
          className="p-2 bg-white rounded shadow outline-none w-30 h-30"
        >
          {children}
        </div>
      </div>
    </RootOverlay>
  );
}

function OrderControl({ engine }: { engine: SyncEngine }) {
  const layers = useScene((s) => s.layers);

  const onSelectionChange =
    (which: 'active' | 'inactive') => (sel: 'all' | Set<string | number>) => {
      engine.startTransaction();
      for (const layer of layers[which]) {
        if (sel === 'all' || sel.has(layer.id)) {
          engine.lAddToMySelection(layer.id);
        } else {
          engine.lRemoveFromMySelection(layer.id);
        }
      }
      engine.commitTransaction();
    };

  const serializeKey = (key: string | number) => key.toString();
  const deserializeKey = (key: unknown): number => {
    if (typeof key === 'number') return key;
    if (typeof key === 'string') {
      const v = Number.parseInt(key, 10);
      if (isNaN(v)) throw new Error('Unreachable');
      return v;
    } else {
      throw new Error('Unreachable');
    }
  };
  const { dragAndDropHooks: activeDndHooks } = useDragAndDrop({
    getItems: (keys) =>
      Array.from(keys).map((k) => ({ 'x-pt/lmove-active': serializeKey(k) })),
    acceptedDragTypes: ['x-pt/lmove-active', 'x-pt/lmove-inactive'],
    getAllowedDropOperations: () => ['move'],
    onReorder: async ({ keys, target }) => {
      let key;
      for (const k of keys) {
        if (key) throw new Error('Unreachable: expected one key');
        key = deserializeKey(k);
      }
      if (key === undefined) return;

      const targetLid = deserializeKey(target.key);
      const at = target.dropPosition === 'on' ? 'after' : target.dropPosition;
      engine.lMove([key], { target: targetLid, at });
    },
    onRootDrop: async (evt) => {
      let key;
      for (const item of evt.items) {
        if (item.kind !== 'text') continue;
        if (!item.types.has('x-pt/lmove-inactive')) continue;

        if (key) throw new Error('Unreachable: expected one key');

        const textValue = await item.getText('x-pt/lmove-inactive');
        key = deserializeKey(textValue);
      }
      if (key === undefined) return;

      engine.lMove([key], { at: 'last' });
    },
    onInsert: async ({ items, target }) => {
      let key;
      for (const item of items) {
        if (item.kind !== 'text') continue;
        if (!item.types.has('x-pt/lmove-inactive')) continue;

        if (key) throw new Error('Unreachable: expected one key');

        const textValue = await item.getText('x-pt/lmove-inactive');
        key = deserializeKey(textValue);
      }
      if (key === undefined) return;

      const targetLid = deserializeKey(target.key);
      const at = target.dropPosition === 'on' ? 'after' : target.dropPosition;
      engine.lMove([key], { target: targetLid, at });
    },
  });
  const { dragAndDropHooks: inactiveDndHooks } = useDragAndDrop({
    getItems: (keys) =>
      Array.from(keys).map((k) => ({ 'x-pt/lmove-inactive': k.toString() })),
    getAllowedDropOperations: () => ['move'],
    acceptedDragTypes: ['x-pt/lmove-active'],
    getDropOperation: (target) => (target.type === 'root' ? 'move' : 'cancel'),
    onDrop: async (evt) => {
      let key;
      for (const item of evt.items) {
        if (item.kind !== 'text') continue;
        if (!item.types.has('x-pt/lmove-active')) continue;

        if (key) throw new Error('Unreachable: expected one key');

        const textValue = await item.getText('x-pt/lmove-active');
        key = deserializeKey(textValue);
      }
      if (key === undefined) return;

      engine.lRemove(key);
    },
  });

  return (
    <div className="w-[15rem]">
      <h2 className="mb-0.5 font-semibold">Active layers</h2>

      <ListView
        aria-label="layer order"
        width="100%"
        items={layers.active}
        selectionStyle="highlight"
        density="compact"
        selectionMode="single"
        dragAndDropHooks={engine.canEdit ? activeDndHooks : undefined}
        selectedKeys={layers.active
          .filter((l) => l.selectedByMe)
          .map((l) => l.id)}
        onSelectionChange={onSelectionChange('active')}
      >
        {(layer) => (
          <Item textValue={layer.source.name}>
            <LayerItem layer={layer}>
              <ActiveLayerActionMenu layer={layer} engine={engine} />
            </LayerItem>
          </Item>
        )}
      </ListView>

      <h2 className="mt-3 mb-0.5 font-semibold">Available layers</h2>

      <ListView
        aria-label="inactive layers"
        width="100%"
        items={layers.inactive}
        selectionStyle="highlight"
        density="compact"
        selectionMode="single"
        dragAndDropHooks={engine.canEdit ? inactiveDndHooks : undefined}
        selectedKeys={layers.inactive
          .filter((l) => l.selectedByMe)
          .map((l) => l.id)}
        onSelectionChange={onSelectionChange('inactive')}
      >
        {(layer) => (
          <Item textValue={layer.source.name}>
            <LayerItem layer={layer} />
          </Item>
        )}
      </ListView>
    </div>
  );
}

function LayerItem({
  layer,
  children,
}: {
  layer: SceneLayer | InactiveSceneLayer;
  children?: ReactNode;
}) {
  return (
    <>
      <span>{layer.source.name}</span>
      {children}
    </>
  );
}

function ActiveLayerActionMenu({
  layer,
  engine,
}: {
  layer: SceneLayer;
  engine: SyncEngine;
}) {
  return (
    <DialogTrigger type="popover">
      <ActionButton
        aria-label="edit"
        marginEnd={'-10px'}
        isDisabled={!engine.canEdit}
      >
        <EditIcon />
      </ActionButton>
      <Dialog height="5rem" width="3rem">
        <ActiveLayerEditor layer={layer} engine={engine} />
      </Dialog>
    </DialogTrigger>
  );
}

const MAX_UPDATE_INTERVAL = 10; // Throttle changes to 100 per second

function ActiveLayerEditor({
  layer,
  engine,
}: {
  engine: SyncEngine;
  layer: SceneLayer;
}) {
  const [opacity, _setOpacity] = useState(
    layer.opacity ?? layer.source.defaultOpacity,
  );
  const tick = useRef<number | null>(null);
  const setOpacity = useCallback(
    (value: number, immediate = false) => {
      _setOpacity(value);

      if (tick.current) {
        window.clearTimeout(tick.current);
        tick.current = null;
      }

      if (immediate) {
        engine.lSetOpacity(layer.id, value);
      } else {
        tick.current = window.setTimeout(() => {
          engine.lSetOpacity(layer.id, value);
          tick.current = null;
        }, MAX_UPDATE_INTERVAL);
      }
    },
    [engine, layer.id],
  );
  return (
    <div className="flex items-center justify-center overflow-auto row-span-full col-span-full">
      <Slider
        label="Opacity"
        minValue={0}
        maxValue={1}
        step={0.01}
        formatOptions={{ style: 'percent' }}
        value={opacity}
        onChange={setOpacity}
        onChangeEnd={(v) => setOpacity(v, true)}
      />
    </div>
  );
}
