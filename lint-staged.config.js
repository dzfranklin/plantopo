export default {
  // ts tasks that modify (run sequentially as modifying)
  "**/*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  // typecheck (run sequentially to use caching)
  "**/*.ts?(x)": () =>
    ["shared", "web", "api"].map(
      pkg => `tsc --noEmit -p packages/${pkg}/tsconfig.json`,
    ),
  "**/*.{js,mjs,json,css,md}": "prettier --write",
};
