import { Suspense, lazy } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { Navbar } from "./Navbar.tsx";
import { useSession } from "./auth/auth-client.ts";

const App = lazy(() => import("./App.tsx"));
const Counter = lazy(() => import("./counter/Counter.tsx"));
const TripList = lazy(() => import("./trips/TripList.tsx"));
const TripEditor = lazy(() => import("./trips/TripEditor.tsx"));
const Login = lazy(() => import("./auth/Login.tsx"));
const NotFound = lazy(() => import("./NotFound.tsx"));

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
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <>
                <Navbar />
                <Outlet />
              </>
            }
          >
            <Route index element={<App />} />

            <Route element={<RequireAuth />}>
              <Route path="/counter" element={<Counter />} />
              <Route path="/trips" element={<TripList />} />
              <Route path="/trips/:tripId" element={<TripEditor />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
