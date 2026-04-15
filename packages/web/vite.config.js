import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import license from "rollup-plugin-license";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [
    tailwindcss(),
    react(),
    license({
      thirdParty: {
        output: {
          file: "dist/web-third-party-licenses.html",
          template(dependencies) {
            const sorted = [...dependencies].sort((a, b) =>
              (a.name ?? "").localeCompare(b.name ?? ""),
            );

            const licensesSummary = [
              ...new Set(sorted.map(d => d.license).filter(Boolean)),
            ]
              .sort()
              .map(l => `<span class="license-badge">${l}</span>`)
              .join(" ");

            function repoUrl(dep) {
              if (!dep.repository) return null;
              return typeof dep.repository === "string"
                ? dep.repository
                : dep.repository.url;
            }

            function buildTable(deps) {
              const rows = deps
                .map(dep => {
                  const url = repoUrl(dep);
                  const name = url
                    ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${dep.name}</a>`
                    : dep.name;
                  const maintainers =
                    dep.maintainers.length > 0
                      ? `<span class="publisher">${dep.maintainers.join(", ")}</span>`
                      : "";
                  const lic = dep.license
                    ? `<span class="license-badge">${dep.license}</span>`
                    : "";
                  return `<tr><td>${name}${maintainers ? " — " + maintainers : ""}</td><td>${lic}</td></tr>`;
                })
                .join("\n");
              return `<table>
    <thead><tr><th>Package</th><th>License</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
            }

            return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Third-party licenses</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 1.5; color: #1a1a1a; max-width: 900px; margin: 0 auto; padding: 2rem 1rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    p.subtitle { color: #555; margin-top: 0; margin-bottom: 1rem; }
    .licenses-summary { margin-bottom: 1.5rem; display: flex; flex-wrap: wrap; gap: 0.35rem; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 0.5rem 0.75rem; background: #f5f5f5; border-bottom: 2px solid #ddd; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #555; }
    td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #eee; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #fafafa; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .publisher { color: #666; font-size: 0.875em; }
    .license-badge { display: inline-block; padding: 0.1em 0.5em; border-radius: 3px; background: #e8f0fe; color: #1a56c4; font-size: 0.75rem; font-family: ui-monospace, monospace; white-space: nowrap; }
  </style>
</head>
<body>
  <h1>PlanTopo Web App - Third-Party Licenses</h1>
  <p class="subtitle">${sorted.length} packages &bull; Generated from <a href="https://github.com/dzfranklin/plantopo">github.com/dzfranklin/plantopo</a></p>
  <div class="licenses-summary">${licensesSummary}</div>
  ${buildTable(sorted)}
</body>
</html>`;
          },
        },
      },
    }),
    // command === "serve" && {
    //   name: "react-devtools",
    //   transformIndexHtml: () => [
    //     {
    //       tag: "script",
    //       attrs: { src: "http://localhost:8097" },
    //       injectTo: "head-prepend",
    //     },
    //   ],
    // },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@pt/shared": path.resolve(__dirname, "../shared/src/index.ts"),
    },
  },
}));
