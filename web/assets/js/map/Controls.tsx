import {
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  Reorder,
  useDragControls,
} from "framer-motion";
import * as Slider from "@radix-ui/react-slider";
import classNames from "../classNames";
import {
  CloseIcon,
  GoToMyLocationIcon,
  GripIcon,
  LayerSelectionIcon,
  UploadIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "./components/icons";
import { useAppDispatch, useAppSelector } from "./hooks";
import {
  exitFullscreen,
  requestGeolocation,
  requestFullscreen,
  zoomIn,
  zoomOut,
  selectGeolocation,
  clearGeolocation,
  selectViewLayerSourceDisplayList,
  overrideViewLayers,
  selectViewLayerSource,
  updateOverrideViewLayer,
  saveOverrideViewLayers,
  clearOverrideViewLayers,
  selectViewLayers,
  removeOverrideViewLayer,
  addOverrideViewLayer,
} from "./mapSlice";
import Button from "./components/Button";

export default function Controls() {
  const dispatch = useAppDispatch();
  const [layerSelectIsOpen, setLayerSelectIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const geolocation = useAppSelector(selectGeolocation);

  useEffect(() => {
    document.addEventListener("fullscreenchange", () =>
      setIsFullscreen(!!document.fullscreenElement)
    );
  }, [setIsFullscreen]);

  return (
    <div className="flex flex-col items-end gap-[8px] controls w-min">
      {!geolocation.value && !geolocation.updating ? (
        <Control
          icon={GoToMyLocationIcon}
          onClick={() => dispatch(requestGeolocation())}
        />
      ) : (
        <Control
          icon={GoToMyLocationIcon}
          iconClass={classNames(
            "fill-purple-600",
            geolocation.updating && "animate-spin"
          )}
          onClick={() => dispatch(clearGeolocation())}
        />
      )}

      {!isFullscreen ? (
        <Control
          icon={ArrowsPointingOutIcon}
          onClick={() => dispatch(requestFullscreen())}
        />
      ) : (
        <Control
          icon={ArrowsPointingInIcon}
          onClick={() => dispatch(exitFullscreen())}
        />
      )}

      <ZoomControl />

      <Control
        icon={LayerSelectionIcon}
        onClick={() => {
          setLayerSelectIsOpen(true);
          dispatch(overrideViewLayers());
        }}
      />

      <AnimatePresence>
        {layerSelectIsOpen && (
          <LayerSelect close={() => setLayerSelectIsOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function LayerSelect({ close }) {
  const dispatch = useAppDispatch();
  const viewLayers = useAppSelector(selectViewLayers);
  const sourceList = useAppSelector(selectViewLayerSourceDisplayList);

  const complete = (save) => {
    if (save) {
      dispatch(saveOverrideViewLayers());
    } else {
      dispatch(clearOverrideViewLayers());
    }
    close();
  };

  return (
    <motion.div
      initial={{ height: 0 }}
      animate={{ height: "60%", minHeight: 400 }}
      exit={{ height: 0 }}
      className="absolute flex flex-col bottom-0 right-0 w-full max-w-[400px] bg-white p-[16px]"
    >
      {/* Negative margin & padding hack moves the scrollback over */}
      <motion.div
        layoutScroll
        className="grow overflow-y-scroll -mr-[16px] pr-[16px]"
      >
        <Reorder.Group
          axis="y"
          values={viewLayers}
          onReorder={(v) => dispatch(overrideViewLayers(v))}
        >
          {viewLayers.map((v, i) => (
            <LayerItem key={v.sourceId} layer={v} idx={i} />
          ))}
        </Reorder.Group>

        <hr className="my-[25px]" />

        <ul>
          {sourceList.map((v) => (
            <SourceItem key={v.id} source={v} />
          ))}
        </ul>
      </motion.div>

      <div className="flex flex-row justify-end gap-2 mt-2 shrink">
        <Button onClick={() => complete(false)}>Cancel</Button>
        <Button onClick={() => complete(true)} style="primary">
          Done
        </Button>
      </div>
    </motion.div>
  );
}

function LayerItem({ layer, idx }) {
  const dispatch = useAppDispatch();
  const source = useAppSelector(selectViewLayerSource(layer.sourceId));
  const reorderControls = useDragControls();

  return (
    <Reorder.Item
      value={layer}
      dragListener={false}
      dragControls={reorderControls}
      layoutId={source.id.toString()}
      className="flex flex-row select-none mb-[16px]"
    >
      <button
        onClick={() => dispatch(removeOverrideViewLayer(idx))}
        className="-ml-1 mr-[8px]"
      >
        <CloseIcon className="fill-gray-500 w-[20px]" />
      </button>

      <img
        src={source.icon}
        loading="lazy"
        className="aspect-square h-[45px] mr-[14px]"
        alt=""
      />

      <div className="flex flex-col justify-center grow">
        <div>{source.name}</div>

        {idx !== 0 && (
          <Slider.Root
            min={0}
            max={1}
            step={0.01}
            value={[layer.opacity]}
            onValueChange={([opacity]) => {
              dispatch(
                updateOverrideViewLayer({
                  idx,
                  value: { opacity },
                })
              );
            }}
            className="relative flex items-center select-none touch-none w-full h-5 py-[15px]"
          >
            <Slider.Track className="bg-[hsla(0,_0%,_0%,_0.478)] relative grow rounded-full h-[3px]">
              <Slider.Range className="absolute h-full bg-purple-600 rounded-full" />
            </Slider.Track>
            <Slider.Thumb className="block w-5 h-5 bg-purple-600 rounded-[10px] hover:bg-purple-500 focus:outline-none focus:shadow-[0_0_0_5px] focus:shadow-[hsla(0,_0%,_0%,_0.220)]" />
          </Slider.Root>
        )}
      </div>

      <GripIcon
        className="h-[24px] ml-[16px] mr-1 row-span-full cursor-grab fill-gray-400 self-center"
        onPointerDown={reorderControls.start.bind(reorderControls)}
      />
    </Reorder.Item>
  );
}

function SourceItem({ source }) {
  const dispatch = useAppDispatch();

  return (
    <motion.div
      layoutId={source.id.toString()}
      className="flex flex-row items-center mb-[10px]"
    >
      <button
        onClick={() => dispatch(addOverrideViewLayer({ sourceId: source.id }))}
        className="-ml-1 mr-[8px]"
      >
        <UploadIcon className="stroke-gray-500 w-[20px]" />
      </button>

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
  const Icon = props.icon;
  return (
    <div className="bg-white border border-gray-200 rounded-[2px] w-min">
      <button
        onClick={props.onClick}
        className="flex justify-center p-[5px] hover:bg-gray-200"
      >
        <Icon className={classNames(props.iconClass, "w-[24px]")} />
      </button>
    </div>
  );
}

function ZoomControl() {
  const dispatch = useAppDispatch();
  return (
    <div className="bg-white border border-gray-200 rounded-[2px] flex flex-col w-min">
      <button
        onClick={() => dispatch(zoomIn)}
        className="flex justify-center p-[10px] pb-[5px] hover:bg-gray-200"
      >
        <ZoomInIcon className="w-[14px]" />
      </button>
      <button
        onClick={() => dispatch(zoomOut)}
        className="flex justify-center p-[10px] pt-[5px] hover:bg-gray-200"
      >
        <ZoomOutIcon className="w-[14px]" />
      </button>
    </div>
  );
}