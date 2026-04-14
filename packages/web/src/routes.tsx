import { Suspense, lazy } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { useSession } from "./auth/auth-client.ts";
import { NavbarLayout } from "./layout/NavbarLayout.tsx";

const HomePage = lazy(() => import("./HomePage.tsx"));
const MapPage = lazy(() => import("./map/MapPage.tsx"));
const LoginPage = lazy(() => import("./auth/LoginPage.tsx"));
const SignUpPage = lazy(() => import("./auth/SignUpPage.tsx"));
const RecordTrackPage = lazy(() => import("./track/RecordTrackPage.tsx"));
const NotFoundPage = lazy(() => import("./NotFoundPage.tsx"));
const SettingsPage = lazy(() => import("./settings/SettingsPage.tsx"));
const SettingsAccountPage = lazy(
  () => import("./settings/SettingsAccountPage.tsx"),
);
const SettingsInterfacePage = lazy(
  () => import("./settings/SettingsInterfacePage.tsx"),
);
const PlanPage = lazy(() => import("./plan/PlanPage.tsx"));
const DevMapViewPage = lazy(() => import("./dev/DevMapViewPage.tsx"));
const DevMapPage = lazy(() => import("./dev/DevMapPage.tsx"));
const DevErrorPage = lazy(() => import("./dev/DevErrorsPage.tsx"));
const DevCompleteRoutePage = lazy(
  () => import("./dev/DevCompleteRoutePage.tsx"),
);

function RequireAuth() {
  const { data: session } = useSession();
  const location = useLocation();
  if (!session) {
    const returnTo = location.pathname + location.search;
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }
  return <Outlet />;
}

export function AppRoutes() {
  return (
    <ErrorBoundary>
      <Suspense>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />

          <Route element={<NavbarLayout />}>
            <Route index element={<HomePage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/plan" element={<PlanPage />} />

            <Route element={<RequireAuth />}>
              <Route path="/record-track" element={<RecordTrackPage />} />
              <Route path="/settings" element={<SettingsPage />}>
                <Route
                  index
                  element={<Navigate to="/settings/account" replace />}
                />
                <Route path="account" element={<SettingsAccountPage />} />
                <Route path="interface" element={<SettingsInterfacePage />} />
              </Route>
            </Route>

            <Route path="/dev">
              <Route path="mapview" element={<DevMapViewPage />} />
              <Route path="map" element={<DevMapPage />} />
              <Route path="errors" element={<DevErrorPage />} />
              <Route path="complete-route" element={<DevCompleteRoutePage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
