import RootOverlay from '@/app/components/RootOverlay';
import { LAYERS, LayerData } from '@/layers';
import { SyncEngine } from '@/api/map/sync/SyncEngine';
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
import {
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AriaButtonProps,
  useButton,
  useDialog,
  useOverlayTrigger,
  usePopover,
} from 'react-aria';
import { OverlayTriggerState, useOverlayTriggerState } from 'react-stately';

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
  const [activeOrder, setActiveOrder] = useState(() =>
    engine.lOrder().map((lid) => LAYERS.layers[lid]!),
  );
  useEffect(() => {
    const l = engine.addLOrderListener((v) =>
      setActiveOrder(v.map((lid) => LAYERS.layers[lid]!)),
    );
    return () => engine.removeLOrderListener(l);
  }, [engine]);

  const orderIfInactive = useMemo(
    () =>
      Object.entries(LAYERS.layers)
        .sort(([_a, a], [_b, b]) => a.name.localeCompare(b.name))
        .map(([_, data]) => data),
    [],
  );
  const inactiveOrder = useMemo(
    () =>
      orderIfInactive.filter(
        (data) => activeOrder.findIndex((p) => p.lid === data.lid) === -1,
      ),
    [activeOrder, orderIfInactive],
  );

  // By using one list of active & inactive we ensure that selecting in one
  // clears the selection in the other.
  const [selectedKeys, setSelectedKeys] = useState<
    'all' | Array<string | number>
  >([]);
  const onSelectionChange = useCallback((sel: 'all' | Set<string | number>) => {
    if (sel === 'all') setSelectedKeys('all');
    else setSelectedKeys(Array.from(sel));
  }, []);

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
      const ids = [];
      const prevI = new Map<number, number>();
      for (let k of keys) {
        k = deserializeKey(k);
        const i = activeOrder.findIndex((p) => p.lid === k);
        ids.push(k);
        prevI.set(k, i);
      }
      ids.sort((a, b) => prevI.get(a)! - prevI.get(b)!);

      const targetLid = deserializeKey(target.key);
      const at = target.dropPosition === 'on' ? 'after' : target.dropPosition;
      engine.lMove(ids, { target: targetLid, at });
    },
    onRootDrop: async (evt) => {
      const values = [];
      for (const item of evt.items) {
        if (item.kind !== 'text') continue;
        if (!item.types.has('x-pt/lmove-inactive')) continue;
        const value = item.getText('x-pt/lmove-inactive').then(deserializeKey);
        values.push(value);
      }
      const ids = await Promise.all(values);
      ids.sort(
        (a, b) =>
          inactiveOrder.findIndex((p) => p.lid === a) -
          inactiveOrder.findIndex((p) => p.lid === b),
      );
      engine.lMove(ids, { at: 'last' });
    },
    onInsert: async ({ items, target }) => {
      const values = [];
      for (const item of items) {
        if (item.kind !== 'text') continue;
        if (!item.types.has('x-pt/lmove-inactive')) continue;
        const v = item.getText('x-pt/lmove-inactive').then(deserializeKey);
        values.push(v);
      }
      const ids = await Promise.all(values);
      ids.sort(
        (a, b) =>
          inactiveOrder.findIndex((p) => p.lid === a) -
          inactiveOrder.findIndex((p) => p.lid === b),
      );

      const targetLid = deserializeKey(target.key);
      const at = target.dropPosition === 'on' ? 'after' : target.dropPosition;
      engine.lMove(ids, { target: targetLid, at });
    },
  });
  const { dragAndDropHooks: inactiveDndHooks } = useDragAndDrop({
    getItems: (keys) =>
      Array.from(keys).map((k) => ({ 'x-pt/lmove-inactive': k.toString() })),
    getAllowedDropOperations: () => ['move'],
    acceptedDragTypes: ['x-pt/lmove-active'],
    getDropOperation: (target) => (target.type === 'root' ? 'move' : 'cancel'),
    onDrop: async (evt) => {
      const values = [];
      for (const item of evt.items) {
        if (item.kind !== 'text') continue;
        if (!item.types.has('x-pt/lmove-active')) continue;
        const v = item.getText('x-pt/lmove-active').then(deserializeKey);
        values.push(v);
      }
      const ids = await Promise.all(values);

      engine.startTransaction();
      for (const lid of ids) engine.lRemove(lid);
      engine.commitTransaction();
    },
  });

  return (
    <div className="w-[15rem]">
      <h2 className="mb-0.5 font-semibold">Active layers</h2>

      <ListView
        aria-label="layer order"
        width="100%"
        items={activeOrder}
        selectionMode="multiple"
        selectionStyle="highlight"
        density="compact"
        dragAndDropHooks={engine.canEdit ? activeDndHooks : undefined}
        selectedKeys={selectedKeys}
        onSelectionChange={onSelectionChange}
      >
        {(data) => (
          <Item key={data.lid} textValue={data.name}>
            <LayerItem data={data}>
              <ActiveLayerActionMenu data={data} engine={engine} />
            </LayerItem>
          </Item>
        )}
      </ListView>

      <h2 className="mt-3 mb-0.5 font-semibold">Available layers</h2>

      <ListView
        aria-label="inactive layers"
        width="100%"
        items={inactiveOrder}
        selectionStyle="highlight"
        selectionMode="multiple"
        density="compact"
        dragAndDropHooks={engine.canEdit ? inactiveDndHooks : undefined}
        selectedKeys={selectedKeys}
        onSelectionChange={onSelectionChange}
      >
        {(data) => (
          <Item key={data.lid} textValue={data.name}>
            <LayerItem data={data} />
          </Item>
        )}
      </ListView>
    </div>
  );
}

function LayerItem({
  data,
  children,
}: {
  data: LayerData;
  children?: ReactNode;
}) {
  return (
    <>
      <span>{data.name}</span>
      {children}
    </>
  );
}

function ActiveLayerActionMenu({
  data: { defaultOpacity, lid },
  engine,
}: {
  data: LayerData;
  engine: SyncEngine;
}) {
  const [opacity, setOpacity] = useState(
    () => engine.lGet(lid, 'opacity') ?? defaultOpacity,
  );
  useEffect(() => {
    const l = engine.addLPropListener(lid, 'opacity', (v) =>
      setOpacity(v ?? defaultOpacity),
    );
    return () => engine.removeLPropListener(lid, 'opacity', l);
  }, [defaultOpacity, engine, lid]);

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
        <div className="flex items-center justify-center overflow-auto row-span-full col-span-full">
          <Slider
            label="Opacity"
            minValue={0}
            maxValue={1}
            step={0.01}
            formatOptions={{ style: 'percent' }}
            value={opacity}
            onChange={setOpacity}
            onChangeEnd={(v) => engine.lSet(lid, 'opacity', v)}
          />
        </div>
      </Dialog>
    </DialogTrigger>
  );
}
