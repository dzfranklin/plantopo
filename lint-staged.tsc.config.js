export default {
  "**/*.ts?(x)": () => [
    "tsc --noEmit -p packages/shared/tsconfig.json",
    "tsc --noEmit -p packages/web/tsconfig.app.json",
    "tsc --noEmit -p packages/api/tsconfig.json",
  ],
};
