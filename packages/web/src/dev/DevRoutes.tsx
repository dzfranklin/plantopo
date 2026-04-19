import { Link, Route, Routes } from "react-router-dom";

import DevCompleteRoutePage from "./DevCompleteRoutePage.tsx";
import DevErrorsPage from "./DevErrorsPage.tsx";
import DevMapPage from "./DevMapPage.tsx";
import DevMapViewPage from "./DevMapViewPage.tsx";
import NotFoundPage from "@/NotFoundPage.tsx";

const DEV_ROUTES = [
  { path: "map", element: <DevMapPage /> },
  { path: "mapview", element: <DevMapViewPage /> },
  { path: "errors", element: <DevErrorsPage /> },
  { path: "complete-route", element: <DevCompleteRoutePage /> },
];

function DevIndexPage() {
  return (
    <ul className="space-y-1 p-4">
      <li>
        <Link to="/debug-flags" className="link">
          {"/debug-flags"}
        </Link>
      </li>
      {DEV_ROUTES.map(r => (
        <li key={r.path}>
          <Link to={r.path} className="link">
            {"/dev/" + r.path}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function DevRoutes() {
  return (
    <Routes>
      <Route path="" element={<DevIndexPage />} />
      {DEV_ROUTES.map(r => (
        <Route key={r.path} path={r.path} element={r.element} />
      ))}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
