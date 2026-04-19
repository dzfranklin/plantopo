import {
  type RemixiconComponentType,
  RiEarthLine,
  RiRecordCircleLine,
  RiRouteLine,
  RiSettings3Line,
} from "@remixicon/react";
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

const BASE: NavTab[] = [
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

const NAV_TABS = BASE.filter(t => !t.nativeOnly || window.Native);
const UNAUTH_NAV_TABS = NAV_TABS.filter(t => !t.requireAuth);

export function useNavTabs({ includeSettings = false } = {}) {
  const session = useSession().data;
  const base = session ? NAV_TABS : UNAUTH_NAV_TABS;
  return includeSettings ? [...base, SETTINGS_TAB] : base;
}
