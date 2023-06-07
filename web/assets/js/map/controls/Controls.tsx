import {
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from '@heroicons/react/24/outline';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AnimatePresence,
  motion,
  Reorder,
  useDragControls,
} from 'framer-motion';
import * as Slider from '@radix-ui/react-slider';
import classNames from '../../classNames';
import {
  CloseIcon,
  GoToMyLocationIcon,
  GripIcon,
  LayerSelectionIcon,
  UploadIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '../components/icons';
import { useAppDispatch, useAppSelector } from '../hooks';
import {
  exitFullscreen,
  requestFullscreen,
  zoomIn,
  zoomOut,
  selectGeolocation,
  clearGeolocation,
  requestGeolocation,
} from './slice';
import Button from '../components/Button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMountain } from '@fortawesome/free-solid-svg-icons';
import Tooltip from '../components/Tooltip';
import { Layer, LayerSource } from '../layers/types';
import useResources from '../useResources';
import useSyncSelector from '../sync/useSyncSelector';
import useSyncDispatch from '../sync/useSyncDispatch';

export default function Controls() {
  const dispatch = useAppDispatch();
  const syncDispatch = useSyncDispatch();
  const [layerSelectIsOpen, setLayerSelectIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const is3d = useSyncSelector((state) => !!state.attrs['is3d']);
  const geolocation = useAppSelector(selectGeolocation);

  useEffect(() => {
    document.addEventListener('fullscreenchange', () =>
      setIsFullscreen(!!document.fullscreenElement),
    );
  }, [setIsFullscreen]);

  return (
    <div className="flex flex-col items-end gap-[8px] controls w-min">
      <Control
        title="Go to my location"
        onClick={() =>
          dispatch(
            geolocation.value || geolocation.updating
              ? clearGeolocation()
              : requestGeolocation(),
          )
        }
      >
        <GoToMyLocationIcon
          className={classNames(
            'w-[24px]',
            (geolocation.value || geolocation.updating) && 'fill-purple-600',
            geolocation.updating && 'animate-spin',
          )}
        />
      </Control>

      <Control
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        onClick={() =>
          dispatch(isFullscreen ? exitFullscreen() : requestFullscreen())
        }
      >
        {isFullscreen ? (
          <ArrowsPointingInIcon className="w-[24px]" />
        ) : (
          <ArrowsPointingOutIcon className="w-[24px]" />
        )}
      </Control>

      <Control
        title={is3d ? 'Exit 3D terrain' : '3D terrain'}
        onClick={() =>
          syncDispatch({
            type: 'attr/set',
            payload: {
              key: 'is3d',
              value: !is3d,
            },
          })
        }
      >
        <FontAwesomeIcon
          icon={faMountain}
          className={classNames(
            'h-[20px] w-[20px] p-[2px]',
            is3d ? 'text-purple-600' : 'text-gray-700',
          )}
        />
      </Control>

      <ZoomControl />

      <Control title="Layers" onClick={() => setLayerSelectIsOpen(true)}>
        <LayerSelectionIcon className="w-[24px]" />
      </Control>

      <AnimatePresence>
        {layerSelectIsOpen && (
          <LayerSelect close={() => setLayerSelectIsOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function LayerSelect({ close }: { close: () => void }) {
  const dispatch = useSyncDispatch();
  const resources = useResources();
  const layers = useSyncSelector((state) => state.layers);

  const layerSources = useMemo(() => {
    if (resources.isError || !resources.data) return;
    return Object.values(resources.data.layerSource).sort((a, b) => {
      if (a.name > b.name) return 1;
      if (a.name < b.name) return -1;
      return 0;
    });
  }, [resources]);

  if (resources.isError || !resources.data) {
    return (
      <div className="absolute flex flex-col bottom-0 right-0 w-full sm:max-w-[400px] bg-white p-[16px]">
        {/* TODO: Make pretty */}
        {resources.isError ? (
          <p>Error loading layer information</p>
        ) : (
          <p>Loading...</p>
        )}
      </div>
    );
  }

  if (!layerSources) throw new Error('Unreachable');
  const unusedLayerSources = layerSources.filter(
    (source) => layers.find((layer) => layer.id === source.id) === undefined,
  );

  const onReorder = (newList: Layer[]) => {
    for (let i = 0; i < newList.length; i++) {
      const newItem = newList[i]!;
      if (layers[i]?.id !== newItem.id) {
        const layer = newItem.id;
        const before = newList[i - 1]?.id;
        const after = newList[i + 1]?.id;
        dispatch({
          type: 'layer/move',
          payload: { layer, before, after },
        });
        break;
      }
    }
  };

  return (
    <motion.div
      initial={{ height: 0 }}
      animate={{ height: '60%', minHeight: 400 }}
      exit={{ height: 0 }}
      className="absolute flex flex-col bottom-0 right-0 w-full sm:max-w-[400px] bg-white p-[16px]"
    >
      {/* Negative margin & padding hack moves the scrollback over */}
      <motion.div
        layoutScroll
        className="grow overflow-y-scroll -mr-[16px] pr-[16px]"
      >
        <Reorder.Group axis="y" values={layers} onReorder={onReorder}>
          {layers.map((v, i) => (
            <LayerItem
              key={v.id}
              layer={v}
              source={resources.data.layerSource[v.id]}
              isFirst={i === 0}
            />
          ))}
        </Reorder.Group>

        <hr className="my-[25px]" />

        <ul>
          {unusedLayerSources.map((v) => (
            <SourceItem key={v.id} source={v} />
          ))}
        </ul>
      </motion.div>

      <div className="flex flex-row justify-end gap-2 mt-2 shrink">
        <Button onClick={close} style="primary">
          Done
        </Button>
      </div>
    </motion.div>
  );
}

function LayerItem({
  layer,
  isFirst,
  source,
}: {
  layer: Layer;
  isFirst: boolean;
  source: LayerSource | undefined;
}) {
  const dispatch = useSyncDispatch();
  const reorderControls = useDragControls();

  // Workaround for <https://github.com/framer/motion/issues/1597>
  const setupReorderTarget = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    node.addEventListener('touchstart', (e) => e.preventDefault(), {
      passive: false,
    });
  }, []);

  return (
    <Reorder.Item
      value={layer}
      dragListener={false}
      dragControls={reorderControls}
      layoutId={layer.id}
      className="flex flex-row mb-[16px]"
    >
      <Tooltip title="Remove">
        <button
          onClick={() =>
            dispatch({ type: 'layer/remove', payload: { layer: layer.id } })
          }
          className="-ml-1 mr-[8px]"
        >
          <CloseIcon className="fill-gray-500 w-[20px]" />
        </button>
      </Tooltip>

      {source ? (
        <>
          <img
            src={source.icon ?? undefined}
            loading="lazy"
            className="aspect-square h-[45px] mr-[14px]"
            alt=""
          />

          <div className="flex flex-col justify-center grow">
            <div>{source.name}</div>

            {!isFirst && (
              <Tooltip title="Opacity">
                <Slider.Root
                  min={0}
                  max={1}
                  step={0.01}
                  value={[
                    layer.attrs.opacity === undefined ? 1 : layer.attrs.opacity,
                  ]}
                  onValueChange={([value]) => {
                    dispatch({
                      type: 'layer/setAttr',
                      payload: {
                        layer: layer.id,
                        key: 'opacity',
                        value,
                      },
                    });
                  }}
                  className="relative flex items-center select-none touch-none w-full h-5 py-[15px]"
                >
                  <Slider.Track className="bg-[hsla(0,_0%,_0%,_0.478)] relative grow rounded-full h-[3px]">
                    <Slider.Range className="absolute h-full bg-purple-600 rounded-full" />
                  </Slider.Track>
                  <Slider.Thumb className="block w-5 h-5 bg-purple-600 rounded-[10px] hover:bg-purple-500 focus:outline-none focus:shadow-[0_0_0_5px] focus:shadow-[hsla(0,_0%,_0%,_0.220)]" />
                </Slider.Root>
              </Tooltip>
            )}
          </div>
        </>
      ) : (
        // TODO: Make pretty
        <div>Error: Unrecognized layer</div>
      )}

      <Tooltip title="Reorder">
        <div
          className="flex flex-col justify-center ml-[16px] p-[8px] cursor-grab fill-gray-400"
          ref={setupReorderTarget}
          onPointerDown={(evt) => {
            evt.preventDefault();
            reorderControls.start(evt);
          }}
        >
          <GripIcon className="h-[24px]" />
        </div>
      </Tooltip>
    </Reorder.Item>
  );
}

function SourceItem({ source }: { source: LayerSource }) {
  const dispatch = useSyncDispatch();

  return (
    <motion.div
      layoutId={source.id.toString()}
      className="flex flex-row items-center mb-[10px]"
    >
      <Tooltip title="Add">
        <button
          onClick={() =>
            dispatch({
              type: 'layer/add',
              payload: {
                id: source.id,
              },
            })
          }
          className="-ml-1 mr-[8px]"
        >
          <UploadIcon className="stroke-gray-500 w-[20px]" />
        </button>
      </Tooltip>

      <img
        src={source.icon}
        loading="lazy"
        className="aspect-square h-[45px] mr-[14px]"
        alt=""
      />

      <div className="grow mr-[8px]">{source.name}</div>
    </motion.div>
  );
}

function Control(props) {
  return (
    <div className="bg-white border border-gray-200 rounded-[2px]">
      <Tooltip title={props.title}>
        <button
          onClick={props.onClick}
          className="flex justify-center p-[5px] hover:bg-gray-200"
        >
          {props.children}
        </button>
      </Tooltip>
    </div>
  );
}

function ZoomControl() {
  const dispatch = useAppDispatch();
  return (
    <div className="bg-white border border-gray-200 rounded-[2px] flex flex-col w-min">
      <Tooltip title="Zoom in">
        <button
          onClick={() => dispatch(zoomIn)}
          className="flex justify-center p-[10px] pb-[5px] hover:bg-gray-200"
        >
          <ZoomInIcon className="w-[14px]" />
        </button>
      </Tooltip>
      <Tooltip title="Zoom out">
        <button
          onClick={() => dispatch(zoomOut)}
          className="flex justify-center p-[10px] pt-[5px] hover:bg-gray-200"
        >
          <ZoomOutIcon className="w-[14px]" />
        </button>
      </Tooltip>
    </div>
  );
}
