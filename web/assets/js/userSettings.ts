export interface UserSettings {
  disableAnimation: boolean;
  advanced: boolean;
}

declare global {
  interface Window {
    userSettings: UserSettings;
  }
}
