Key scripts:

- npm run dev
- npm run db:generate
- npm run db:migrate
- npm run check
- npm run test

Logging: Provide errors to pino under the err key

Put important/exported functions first, and helpers after the functions they
relate to

packages/web

Use shadcn instead of reimplementing simple components such as input elements
(npx -w @pt/web shadcn add ...)

Use `@remixicon/react` for icons

Use `cn` from `@/cn` for merging Tailwind class names and to organize long
Tailwind class names and split them into multiple lines.

Utility classes: .link, .hover-only-link
