import {
  type RemixiconComponentType,
  RiEarthLine,
  RiFootprintLine,
  RiRecordCircleLine,
  RiRouteLine,
  RiSettings3Line,
} from "@remixicon/react";
import { useMemo } from "react";
import { toast } from "sonner";

import { useUser } from "@/auth/auth-client";
import { getDebugFlag, setDebugFlag } from "@/hooks/debug-flags";

export interface NavTab {
  to: string;
  label: string;
  Icon: RemixiconComponentType;
  requireAuth?: boolean;
  nativeOnly?: boolean;
  primary?: boolean;
}

export type FooterLink = {
  label: string;
} & (
  | {
      to: string;
    }
  | { onClick: () => void }
);

const NAV_TABS: NavTab[] = [
  { to: "/map", label: "Map", Icon: RiEarthLine, primary: true },
  {
    to: "/plan",
    label: "Plan",
    Icon: RiRouteLine,
    requireAuth: true,
    primary: true,
  },
  {
    to: "/record-track",
    label: "Track",
    Icon: RiRecordCircleLine,
    requireAuth: true,
    nativeOnly: true,
    primary: true,
  },
  {
    to: "/tracks",
    label: "My Tracks",
    Icon: RiFootprintLine,
    requireAuth: true,
  },
  {
    to: "/settings",
    label: "Settings",
    Icon: RiSettings3Line,
    requireAuth: true,
  },
];

const COMMIT_HASH = import.meta.env.DEV
  ? "dev"
  : import.meta.env.VITE_COMMIT_HASH?.slice(0, 7);

const VERSION = window.Native?.version()
  ? `v${window.Native.version()}/${COMMIT_HASH}`
  : COMMIT_HASH;

export const FOOTER_LINKS: FooterLink[] = [
  { to: "/about", label: "About" },
  {
    label: VERSION,
    onClick: () => {
      const current = getDebugFlag("showDebugOptions");
      setDebugFlag("showDebugOptions", !current);
      toast.success(`Debug options ${!current ? "enabled" : "disabled"}`);
    },
  },
];

export function useNavTabs() {
  const session = useUser();
  return useMemo(() => {
    const nativeFilter = (t: NavTab) => !t.nativeOnly || window.Native;
    const authFilter = (t: NavTab) => !t.requireAuth || session;
    return NAV_TABS.filter(nativeFilter).filter(authFilter);
  }, [session]);
}

export function useMobileBottomNavTabs() {
  const tabs = useNavTabs();
  return useMemo(() => tabs.filter(t => t.primary), [tabs]);
}
