import { useEffect, useState } from "react";
import Button from "./components/Button";
import { useAppDispatch, useAppSelector } from "./hooks";
import {
  closeViewEditor,
  glLayerId,
  mapClick,
  selectView,
  selectViewEditorState,
  selectViewLayer,
  selectViewLayerSource,
  selectViewLayerSources,
  reorderViewLayers,
  setViewName,
  addViewLayer,
  setViewLayerOpacity,
} from "./mapSlice";
import {
  ChevronRightIcon,
  EllipsisVerticalIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { XMarkIcon } from "@heroicons/react/20/solid";
import { startListening } from "./listener";
import Select from "./components/Select";
import Input from "./components/Input";
import Checkbox from "./components/Checkbox";
import { Reorder, useDragControls } from "framer-motion";
import RangeInput from "./components/RangeInput";

const typeFilters = [
  "any",
  "background",
  "fill",
  "line",
  "symbol",
  "raster",
  "circle",
  "fill-extrusion",
  "heatmap",
  "hillshade",
];

export default function ViewEditor() {
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectViewEditorState);
  const viewName = useAppSelector((s) => selectView(s).name);

  // The active layer id
  const [active, setActive] = useState<string | null>(null);
  const activeSourceName = useAppSelector((s) => {
    if (active === null) return;
    const layer = selectViewLayer(active)(s);
    const source = selectViewLayerSource(layer.sourceId)(s);
    return source.name;
  });

  const [advanced, setAdvanced] = useState(window.userSettings.advanced);

  return (
    <div className="grid grid-rows-[max-content_minmax(0,1fr)_max-content] gap-4 p-3 view-editor">
      <h2>
        <button disabled={active === null} onClick={() => setActive(null)}>
          {viewName}
        </button>

        {active && (
          <span>
            <ChevronRightIcon className="inline-block h-5" />
            {activeSourceName}
          </span>
        )}
      </h2>

      {state === "loading" ? (
        <div className="flex-grow">Loading...</div>
      ) : (
        <div className="grid grid-rows-[min-content_minmax(0,1fr)]">
          {!active ? (
            <RootEditor setActiveSourceId={setActive} />
          ) : (
            <LayerEditor id={active} advanced={advanced} />
          )}
        </div>
      )}

      <div className="grid grid-cols-[max-content_1fr_max-content_max-content] space-x-3">
        <Checkbox
          value={advanced}
          onChange={setAdvanced}
          label="Advanced mode"
        />
        <Button
          onClick={() => dispatch(closeViewEditor({ discard: true }))}
          className="col-start-3"
        >
          Discard
        </Button>
        <Button
          style="primary"
          onClick={() => dispatch(closeViewEditor({ discard: false }))}
          disableWith={state === "save-wait" && "Saving..."}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function RootEditor({ setActiveSourceId: setActiveSourceId }) {
  const dispatch = useAppDispatch();
  const name = useAppSelector((s) => selectView(s).name);
  const layers = useAppSelector((s) => selectView(s).layers.map((l) => l.id));
  const sources = useAppSelector(selectViewLayerSources);

  const sourceList = Object.values(sources).sort((a, b) => {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  });
  const [addSelect, setAddSelect] = useState(sourceList[0]);

  return (
    <>
      <div>
        <div className="mb-10">
          <Input
            label="Name"
            value={name}
            onChange={(value) => dispatch(setViewName(value))}
          />
        </div>

        <div className="flex flex-row items-end gap-1 mb-4">
          <Select
            label="New layer"
            options={sourceList}
            value={addSelect}
            valueMap={(s) => ({ id: s.id.toString(), label: s.name })}
            onChange={(s) => setAddSelect(s)}
          />

          <Button
            onClick={() => dispatch(addViewLayer({ sourceId: addSelect.id }))}
          >
            Add
          </Button>
        </div>
      </div>

      <Reorder.Group
        axis="y"
        values={layers}
        onReorder={(layers) => dispatch(reorderViewLayers(layers))}
        layoutScroll
        className="max-w-screen-sm overflow-y-auto"
      >
        {layers.map((id) => (
          <ViewLayerItem id={id} key={id} setActive={setActiveSourceId} />
        ))}
      </Reorder.Group>
    </>
  );
}

function ViewLayerItem({ id, setActive }) {
  const layer = useAppSelector(selectViewLayer(id));
  const sourceName = useAppSelector(
    (s) => selectViewLayerSource(layer.sourceId)(s).name
  );

  const reorderControls = useDragControls();

  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={reorderControls}
      className="flex flex-row justify-between w-full mb-2"
    >
      <button onPointerDown={(e) => reorderControls.start(e)}>
        <EllipsisVerticalIcon className="inline-block h-5" />
      </button>

      <span className="mr-4 grow">{sourceName}</span>

      <button className="mr-6">
        <TrashIcon className="inline-block h-5" />
      </button>

      <button onClick={() => setActive(layer.id)}>
        <ChevronRightIcon className="inline-block h-5" />
      </button>
    </Reorder.Item>
  );
}

function LayerEditor({ id, advanced }) {
  const dispatch = useAppDispatch();
  const layer = useAppSelector(selectViewLayer(id));
  const source = useAppSelector(selectViewLayerSource(layer.sourceId));
  const [clickFilter, setClickFilter] = useState<string[] | null>(null);
  const [typeFilter, setTypeFilter] = useState("any");
  const [idFilter, setIdFilter] = useState("");

  useEffect(() => {
    startListening({
      actionCreator: mapClick,
      effect: async (action, l) => {
        setClickFilter(action.payload.features.map((f) => f.layer));
      },
    });
  }, []);

  const sourceLayerClickFilter = (l) => {
    if (!clickFilter) return true;
    const glId = glLayerId(layer.sourceId, l.id);
    return clickFilter.includes(glId);
  };

  const sourceLayerTypeFilter = (l) =>
    typeFilter === "any" || typeFilter === l.type;

  const sourceLayerIdFilter = (l) => l.id.indexOf(idFilter) !== -1;

  const sourceLayerFilter = (l) =>
    sourceLayerClickFilter(l) &&
    sourceLayerTypeFilter(l) &&
    sourceLayerIdFilter(l);

  const displayOtherProps = (l) => {
    const entries = Object.entries(l).filter(
      ([k, _v]) => !["id", "type", "layout", "paint"].includes(k)
    );
    if (entries.length === 0) {
      return "";
    } else {
      return JSON.stringify(Object.fromEntries(entries));
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <RangeInput
          label="Opacity"
          min={0}
          max={100}
          value={layer.opacity * 100}
          onChange={(v) =>
            dispatch(setViewLayerOpacity({ layer: layer.id, value: v / 100 }))
          }
          className="w-32"
        />

        {advanced && (
          <div>
            <h3 className="mb-1 font-medium">Filter layers</h3>
            <div className="flex flex-row items-end gap-4">
              <Select
                label="Type"
                options={typeFilters}
                value={typeFilter}
                onChange={setTypeFilter}
              />

              <Input
                label="id"
                value={idFilter}
                onChange={(value) => setIdFilter(value)}
              />

              {clickFilter && (
                <Button onClick={() => setClickFilter(null)}>
                  <span className="font-normal text-black">
                    Showing clicked
                  </span>
                  <XMarkIcon className="inline-block h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {advanced && (
        <ul className="mt-4 overflow-y-scroll overflow-x-clip">
          {source.layerSpecs.filter(sourceLayerFilter).map((l) => (
            <li key={l.id} className="flex flex-row gap-1 mb-1 truncate">
              <span>
                <span className="text-sm text-gray-700">id:</span>
                <span>{l.id}</span>
              </span>

              <span>
                <span className="text-sm text-gray-700">type:</span>
                <span>{l.type}</span>
              </span>

              <span>
                <span className="text-sm text-gray-700">props:</span>

                <span>
                  {JSON.stringify({ layout: l.layout, paint: l.paint })}
                </span>
              </span>

              <span className="pl-4 text-gray-700">{displayOtherProps(l)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
