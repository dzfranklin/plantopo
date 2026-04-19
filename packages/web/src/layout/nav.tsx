import {
  type RemixiconComponentType,
  RiEarthLine,
  RiRecordCircleLine,
  RiRouteLine,
  RiSettings3Line,
} from "@remixicon/react";
import { useMemo } from "react";
import { toast } from "sonner";

import { useSession } from "@/auth/auth-client";
import { getDebugFlag, setDebugFlag } from "@/hooks/debug-flags";

export interface NavTab {
  to: string;
  label: string;
  Icon: RemixiconComponentType;
  requireAuth?: boolean;
  nativeOnly?: boolean;
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
  { to: "/map", label: "Map", Icon: RiEarthLine },
  { to: "/plan", label: "Plan", Icon: RiRouteLine, requireAuth: true },
  {
    to: "/record-track",
    label: "Track",
    Icon: RiRecordCircleLine,
    requireAuth: true,
    nativeOnly: true,
  },
];

const SETTINGS_TAB: NavTab = {
  to: "/settings",
  label: "Settings",
  Icon: RiSettings3Line,
  requireAuth: true,
};

const COMMIT_HASH = import.meta.env.DEV
  ? "dev"
  : import.meta.env.VITE_COMMIT_HASH?.slice(0, 7);

export const FOOTER_LINKS: FooterLink[] = [
  { to: "/about", label: "About" },
  {
    label: COMMIT_HASH,
    onClick: () => {
      const current = getDebugFlag("showDebugOptions");
      setDebugFlag("showDebugOptions", !current);
      toast.success(`Debug options ${!current ? "enabled" : "disabled"}`);
    },
  },
];

export function useNavTabs({ includeSettings = false } = {}) {
  const session = useSession().data;
  return useMemo(() => {
    const nativeFilter = (t: NavTab) => !t.nativeOnly || window.Native;
    const authFilter = (t: NavTab) => !t.requireAuth || session;
    return (includeSettings ? [...NAV_TABS, SETTINGS_TAB] : NAV_TABS)
      .filter(nativeFilter)
      .filter(authFilter);
  }, [session, includeSettings]);
}
