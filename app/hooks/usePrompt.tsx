export interface PromptHook {
  confirm: (message: string) => Promise<boolean>;
}

export function usePrompt(): PromptHook {
  return {
    confirm: async (message) => {
      return window.confirm(message);
    },
  };
}
