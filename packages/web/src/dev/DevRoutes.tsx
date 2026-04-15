import { Route, Routes } from "react-router-dom";

import DevCompleteRoutePage from "./DevCompleteRoutePage.tsx";
import DevErrorsPage from "./DevErrorsPage.tsx";
import DevMapPage from "./DevMapPage.tsx";
import DevMapViewPage from "./DevMapViewPage.tsx";

export default function DevRoutes() {
  return (
    <Routes>
      <Route path="mapview" element={<DevMapViewPage />} />
      <Route path="map" element={<DevMapPage />} />
      <Route path="errors" element={<DevErrorsPage />} />
      <Route path="complete-route" element={<DevCompleteRoutePage />} />
    </Routes>
  );
}
