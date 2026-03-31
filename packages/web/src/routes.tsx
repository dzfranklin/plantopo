import { Suspense, lazy } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { useSession } from "./auth/auth-client.ts";
import { NavbarLayout } from "./layout/NavbarLayout.tsx";
import ErrorTest from "./test/ErrorTest.tsx";

const HomePage = lazy(() => import("./HomePage.tsx"));
const CounterPage = lazy(() => import("./counter/CounterPage.tsx"));
const TripListPage = lazy(() => import("./trip/TripListPage.tsx"));
const TripEditorPage = lazy(() => import("./trip/TripEditorPage.tsx"));
const LoginPage = lazy(() => import("./auth/LoginPage.tsx"));
const RecordTrackPage = lazy(() => import("./track/RecordTrackPage.tsx"));
const NotFoundPage = lazy(() => import("./NotFoundPage.tsx"));
const DevMapPage = lazy(() => import("./dev/DevMapPage.tsx"));
const DevErrorPage = lazy(() => import("./dev/DevErrorsPage.tsx"));

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

          <Route element={<NavbarLayout />}>
            <Route index element={<HomePage />} />

            <Route element={<RequireAuth />}>
              <Route path="/counter" element={<CounterPage />} />
              <Route path="/trips" element={<TripListPage />} />
              <Route path="/trips/:tripId" element={<TripEditorPage />} />
              <Route path="/record-track" element={<RecordTrackPage />} />
            </Route>

            <Route path="/unauth-counter" element={<CounterPage />} />
            <Route path="/error-test" element={<ErrorTest />} />
            <Route path="/dev/map" element={<DevMapPage />} />
            <Route path="/dev/errors" element={<DevErrorPage />} />

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
