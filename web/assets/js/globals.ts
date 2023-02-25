export interface AppSettings {
  disableAnimation: boolean;
  advanced: boolean;
}

export interface CurrentUser {
  id: string;
  username: string;
}

declare global {
  interface Window {
    appSettings: AppSettings;
    currentUser: CurrentUser | null;
  }
}
