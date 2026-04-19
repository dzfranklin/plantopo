import { useState, useSyncExternalStore } from "react";

import { cn } from "@/cn.ts";
import { setDebugFlag, useDebugFlag } from "@/hooks/debug-flags.ts";
import { useFullscreenLandscape } from "@/hooks/useFullscreenLandscape.ts";
import { useIsDesktop } from "@/hooks/useMediaQuery.ts";
import {
  type LogEntry,
  clearLogViewer,
  getLogViewerState,
  safeStringify,
  subscribeLogViewer,
} from "@/logger.ts";

export function LogViewerPanel() {
  const isOpen = useDebugFlag("openLogViewer");
  const isDesktop = useIsDesktop();
  const state = useSyncExternalStore(
    subscribeLogViewer,
    getLogViewerState,
    getLogViewerState,
  );
  const close = () => setDebugFlag("openLogViewer", false);

  useFullscreenLandscape(isOpen && !isDesktop);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-white sm:inset-x-0 sm:top-auto sm:bottom-0 sm:h-[500px]">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-3 py-2">
        <span className="text-sm font-medium">Logs</span>
        <div className="flex gap-2">
          <button
            onClick={clearLogViewer}
            className="cursor-pointer rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100">
            Clear
          </button>
          <button
            onClick={close}
            className="cursor-pointer rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100">
            ✕ Close
          </button>
        </div>
      </div>
      {state ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {state.entries.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400">
              No logs yet
            </div>
          ) : (
            [...state.entries]
              .reverse()
              .map((entry, i) => (
                <LogEntryRow key={state.entries.length - 1 - i} entry={entry} />
              ))
          )}
        </div>
      ) : (
        <div className="p-4 text-center text-xs text-red-600">Disabled</div>
      )}
    </div>
  );
}

const LEVEL_STYLES: Record<string, string> = {
  trace: "bg-gray-100 text-gray-500",
  debug: "bg-gray-100 text-gray-700",
  info: "bg-blue-100 text-blue-700",
  warn: "bg-yellow-100 text-yellow-700",
  error: "bg-red-100 text-red-700",
  fatal: "bg-red-200 text-red-900",
};

function LogEntryRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const { level, msg, time, ...rest } = entry;
  const hasExtra = Object.keys(rest).length > 0;
  const msgLong = msg.length > 80;
  const clickable = hasExtra || msgLong;
  const timeStr = new Date(time).toTimeString().slice(0, 8);

  return (
    <div
      className={cn(
        "border-b border-gray-100 px-2 py-1 font-mono text-xs",
        clickable && "cursor-pointer",
      )}
      onClick={() =>
        clickable && !window.getSelection()?.toString() && setExpanded(e => !e)
      }>
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 text-gray-400">{timeStr}</span>
        <span
          className={cn(
            "shrink-0 rounded px-1 uppercase",
            LEVEL_STYLES[level] ?? "bg-gray-100 text-gray-700",
          )}>
          {level}
        </span>
        <span className={cn("min-w-0 text-gray-900", !expanded && "truncate")}>
          {msg}
        </span>
        {clickable && !expanded && (
          <span className="ml-auto shrink-0 text-gray-300">▸</span>
        )}
      </div>
      {expanded && hasExtra && (
        <pre className="mt-1 overflow-x-auto break-all whitespace-pre-wrap text-gray-600">
          {safeStringify(rest, 2)}
        </pre>
      )}
    </div>
  );
}
