import { Suspense, lazy } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import AboutPage from "./AboutPage.tsx";
import DebugFlagsPage from "./DebugFlagsPage.tsx";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import HomePage from "./HomePage.tsx";
import NotFoundPage from "./NotFoundPage.tsx";
import LoginPage from "./auth/LoginPage.tsx";
import SignUpPage from "./auth/SignUpPage.tsx";
import { useSession } from "./auth/auth-client.ts";
import { NavbarLayout } from "./layout/NavbarLayout.tsx";
import MapPage from "./map/MapPage.tsx";
import PlanPage from "./plan/PlanPage.tsx";
import SettingsAccountPage from "./settings/SettingsAccountPage.tsx";
import SettingsInterfacePage from "./settings/SettingsInterfacePage.tsx";
import SettingsPage from "./settings/SettingsPage.tsx";
import RecordTrackPage from "./track/RecordTrackPage.tsx";

const DevRoutes = lazy(() => import("./dev/DevRoutes.tsx"));

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

          <Route element={<NavbarLayout fullBleed />}>
            <Route path="/map" element={<MapPage />} />
            <Route path="/plan" element={<PlanPage />} />

            <Route element={<RequireAuth />}>
              <Route path="/record-track" element={<RecordTrackPage />} />
            </Route>
          </Route>

          <Route element={<NavbarLayout />}>
            <Route index element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/debug-flags" element={<DebugFlagsPage />} />

            <Route element={<RequireAuth />}>
              <Route path="/settings" element={<SettingsPage />}>
                <Route
                  index
                  element={<Navigate to="/settings/account" replace />}
                />
                <Route path="account" element={<SettingsAccountPage />} />
                <Route path="interface" element={<SettingsInterfacePage />} />
              </Route>
            </Route>

            <Route path="/dev/*" element={<DevRoutes />} />

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
