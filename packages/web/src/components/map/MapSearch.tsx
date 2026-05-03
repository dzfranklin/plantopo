import { RiCloseLine, RiSearchLine } from "@remixicon/react";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";

import type { GeocodingFeature } from "@pt/api";
import { round2 } from "@pt/shared";

import { useMapManager } from "./MapManagerContext";
import { MapMarker } from "./MapMarker";
import { useTRPC } from "@/trpc";
import { cn } from "@/util/cn";
import { useDebounce } from "@/util/useDebounce";

export function MapSearch() {
  const trpc = useTRPC();
  const manager = useMapManager();

  const id = useId();

  const [inputValue, setInputValue] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLngLat, setSelectedLngLat] = useState<[number, number] | null>(
    null,
  );

  const debouncedQuery = useDebounce(inputValue.trim(), 150);

  const center = manager.map.getCenter();
  const zoom = manager.map.getZoom();
  const locationBias = center
    ? { point: round2([center.lng, center.lat], 6), zoom: Math.round(zoom) }
    : undefined;

  const geocodeQuery = useQuery(
    trpc.geocoder.geocode.queryOptions(
      debouncedQuery
        ? { query: debouncedQuery, locationBias, limit: 5 }
        : skipToken,
      { staleTime: Infinity, throwOnError: false },
    ),
  );
  const results = geocodeQuery.data ?? [];
  const showDropdown = isOpen && inputValue.trim().length > 0;
  const resultsKey = results.map(f => f.properties.label).join("\0");

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
        setIsExpanded(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function selectResult(feature: GeocodingFeature) {
    const [lon, lat] = feature.geometry.coordinates;
    manager.map.flyTo({ center: [lon, lat], zoom: 13, speed: 1.5 });
    setInputValue(feature.properties.label ?? "");
    setSelectedLngLat([lon, lat]);
    setIsOpen(false);
    setIsExpanded(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(activeIndex + 1, results.length - 1);
      setActiveIndex(next);
      listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.max(activeIndex - 1, 0);
      setActiveIndex(next);
      listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target =
        activeIndex >= 0
          ? results[activeIndex]
          : results.length === 1
            ? results[0]
            : undefined;
      if (target) selectResult(target);
    } else if (e.key === "Escape") {
      setInputValue("");
      setIsOpen(false);
      setIsExpanded(false);
      setActiveIndex(-1);
      setSelectedLngLat(null);
    }
  }

  return (
    <>
      <div ref={containerRef} className="absolute top-2 left-2 z-10">
        <div
          className={cn(
            "flex items-center gap-1 rounded-[4px] bg-white px-2",
            "transition-[width] duration-200",
            isExpanded ? "w-[320px]" : "w-[220px]",
          )}
          style={{ boxShadow: "0 0 0 2px rgba(0,0,0,0.1)" }}>
          <RiSearchLine size={14} className="shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            type="search"
            placeholder="Search…"
            aria-label="Search for a place"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-activedescendant={
              activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
            }
            value={inputValue}
            onFocus={() => setIsExpanded(true)}
            onChange={e => {
              setInputValue(e.target.value);
              setIsOpen(true);
              setIsExpanded(true);
              setActiveIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            className={cn(
              "h-[29px] flex-1 bg-transparent text-sm outline-none",
              "placeholder:text-gray-400",
              "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
            )}
          />
          {inputValue && (
            <button
              aria-label="Clear search"
              onClick={() => {
                setInputValue("");
                setIsOpen(false);
                setActiveIndex(-1);
                setSelectedLngLat(null);
                inputRef.current?.focus();
              }}
              className="shrink-0 text-gray-400 hover:text-gray-600">
              <RiCloseLine size={14} />
            </button>
          )}
        </div>
        <ul
          ref={listRef}
          role="listbox"
          className={cn(
            "mt-1 w-full overflow-y-auto rounded-[4px] bg-white py-1 text-sm",
            "origin-top transition-all duration-150",
            showDropdown
              ? "h-[168px] scale-y-100 opacity-100"
              : "h-0 scale-y-95 opacity-0",
          )}
          style={{
            boxShadow: "0 0 0 2px rgba(0,0,0,0.1)",
          }}>
          <div key={resultsKey} className="animate-in fade-in duration-500">
            {results.map((feature, i) => (
              <li
                key={i}
                id={`${id}-option-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                onPointerDown={() => selectResult(feature)}
                className={cn(
                  "cursor-pointer truncate px-3 py-1.5",
                  i === activeIndex
                    ? "bg-blue-50 text-blue-700"
                    : "hover:bg-gray-50",
                )}>
                {feature.properties.label}
              </li>
            ))}
          </div>
        </ul>
      </div>
      {selectedLngLat && <MapMarker lngLat={selectedLngLat} />}
    </>
  );
}
