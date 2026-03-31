import {
  RiEarthLine,
  RiRecordCircleLine,
  RiSettings3Line,
} from "@remixicon/react";
import type { ReactNode } from "react";

import { useSession } from "@/auth/auth-client";

export interface NavTab {
  to: string;
  label: string;
  icon: ReactNode;
  requireAuth?: boolean;
  nativeOnly?: boolean;
}

const BASE: NavTab[] = [
  {
    to: "/map",
    label: "Map",
    icon: <RiEarthLine size={24} aria-hidden="true" />,
  },
  {
    to: "/record-track",
    label: "Track",
    icon: <RiRecordCircleLine size={24} aria-hidden="true" />,
    requireAuth: true,
    nativeOnly: true,
  },
];

const SETTINGS_TAB: NavTab = {
  to: "/settings",
  label: "Settings",
  icon: <RiSettings3Line size={24} aria-hidden="true" />,
  requireAuth: true,
};

const NAV_TABS = BASE.filter(t => !t.nativeOnly || window.Native);
const UNAUTH_NAV_TABS = NAV_TABS.filter(t => !t.requireAuth);

export function useNavTabs({ includeSettings = false } = {}) {
  const session = useSession().data;
  const base = session ? NAV_TABS : UNAUTH_NAV_TABS;
  return includeSettings ? [...base, SETTINGS_TAB] : base;
}
