import { Suspense, lazy } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { Navbar } from "./Navbar.tsx";
import { getUser } from "./auth.tsx";

const App = lazy(() => import("./App.tsx"));
const TripList = lazy(() => import("./trips/TripList.tsx"));
const TripEditor = lazy(() => import("./trips/TripEditor.tsx"));
const Login = lazy(() => import("./auth/Login.tsx"));
const Signup = lazy(() => import("./auth/Signup.tsx"));
const NotFound = lazy(() => import("./NotFound.tsx"));

function RequireAuth() {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function AppRoutes() {
  return (
    <ErrorBoundary>
      <Suspense>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

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
