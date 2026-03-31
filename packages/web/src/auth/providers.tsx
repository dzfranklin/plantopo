import { RiGithubFill, RiGoogleFill } from "@remixicon/react";

export interface ProviderInfo {
  label: string;
  icon: React.ReactNode;
}

export const providersInfo = {
  github: {
    label: "GitHub",
    icon: <RiGithubFill className="h-4 w-4" />,
  },
  google: {
    label: "Google",
    icon: <RiGoogleFill className="h-4 w-4" />,
  },
} as const satisfies Record<string, ProviderInfo>;

export function getProviderInfo(providerId: string): ProviderInfo | undefined {
  return providersInfo[providerId as keyof typeof providersInfo];
}
