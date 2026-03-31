import { RiGridLine, RiRecordCircleLine } from "@remixicon/react";
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
    to: "/counter",
    label: "Counter",
    icon: <RiGridLine size={24} aria-hidden="true" />,
    requireAuth: true,
  },
  {
    to: "/record-track",
    label: "Track",
    icon: <RiRecordCircleLine size={24} aria-hidden="true" />,
    requireAuth: true,
    nativeOnly: true,
  },
];

const NAV_TABS = BASE.filter(t => !t.nativeOnly || window.Native);
const UNAUTH_NAV_TABS = NAV_TABS.filter(t => !t.requireAuth);

export function useNavTabs() {
  const session = useSession().data;
  return session ? NAV_TABS : UNAUTH_NAV_TABS;
}
