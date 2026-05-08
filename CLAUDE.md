Key scripts:

- npm run dev
- npm run db:generate -- --name <name>
- npm run db:migrate
- npm run check (typecheck + lint)
- npm run test

Logging: Provide errors to pino under the err key (logger.error({err}, "message"))

Put important/exported functions first, and helpers after the functions they
relate to

## Testing

Run tests via `npm test -w @pt/{api,web,shared} -- -t <filter>` so that
environment variables are set properly

packages/web uses vitest browser mode.

```
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import { renderWithProviders } from "@/test/render";

it("hides selected when import is clicked", () => {
  const screen = await renderWithProviders(<MyComponent/>);
  await userEvent.click(screen.getByRole("button", { name: /import/i }));
  await expect.element(screen.getByText(/selected/)).not.toBeInTheDocument();
})
```

export private functions for testing under
`export const exportedForTesting = { ... }`

in packages/api files named `*.itest.ts` will run under the integration testing
configuration. postgres/redis/minio are reset beforeEach.

## packages/web

Use shadcn instead of reimplementing simple components such as input elements
(npx -w @pt/web shadcn add ...)

Use `@remixicon/react` for icons

Use `cn` from `@/cn` for merging Tailwind class names and to organize long
Tailwind class names and split them into multiple lines.

Utility classes: .link, .hover-only-link

react-query: query client defaults to throwOnError true
