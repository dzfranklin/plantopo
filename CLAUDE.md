Key scripts:

- npm run dev
- npm run db:generate
- npm run db:migrate
- npm run check (typecheck + lint)
- npm run test

Logging: Provide errors to pino under the err key (logger.error({err}, "message"))

Put important/exported functions first, and helpers after the functions they
relate to

## Testing

packages/web uses vitest browser mode. Use await expect.element(locator)... so
vitest polls for the locator.

export private functions for testing under
`export const exportedForTesting = { ... }`

## packages/web

Use shadcn instead of reimplementing simple components such as input elements
(npx -w @pt/web shadcn add ...)

Use `@remixicon/react` for icons

Use `cn` from `@/cn` for merging Tailwind class names and to organize long
Tailwind class names and split them into multiple lines.

Utility classes: .link, .hover-only-link

react-query: query client defaults to throwOnError true
