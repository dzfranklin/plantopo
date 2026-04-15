import { PlanMapOverlay } from "./PlanMapOverlay";
import { cn } from "@/cn";
import { AppMap } from "@/components/map";

export function PlanEditor() {
  return (
    <div
      className={cn(
        "grid h-full grid-rows-[minmax(0,1fr)_170px] overflow-hidden",
        "md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]",
      )}>
      <div className="row-start-2 overflow-auto border-r border-gray-200 md:row-start-1">
        {new Array(30).fill(null).map((_, i) => (
          <div className="m-2 border border-gray-500 p-2" key={i}>
            Placeholder
          </div>
        ))}
      </div>
      <div>
        <AppMap>
          <PlanMapOverlay />
        </AppMap>
      </div>
    </div>
  );
}
