import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ForgotPassword } from "./pages/ForgotPassword";
import { History } from "./pages/History";
import { Inspect } from "./pages/Inspect";
import { Login } from "./pages/Login";
import { Report } from "./pages/Report";
import { ResetPassword } from "./pages/ResetPassword";

export function App() {
  return (
    <>
      <div className="backdrop-grid" aria-hidden />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Inspect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <History />
            </ProtectedRoute>
          }
        />
        <Route
          path="/report/:id"
          element={
            <ProtectedRoute>
              <Report />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
