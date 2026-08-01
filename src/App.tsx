import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthContext'
import { ThemeProvider } from '@/features/theme/ThemeContext'
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute'
import { AuthLayout } from '@/layouts/AuthLayout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { DronesPage } from '@/pages/DronesPage'
import { SitesPage } from '@/pages/SitesPage'
import { AlertsPage } from '@/pages/AlertsPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { ActiveSessionsPage } from '@/pages/ActiveSessionsPage'
import { SessionLifecycle } from '@/features/session/SessionLifecycle'

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <SessionLifecycle />
        <Routes>
        {/* Public route — login */}
        <Route path="/login" element={<AuthLayout />}>
          <Route index element={<LoginPage />} />
        </Route>

        {/* Protected routes — require authentication */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/drones"
          element={
            <ProtectedRoute>
              <DronesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/drones/:id"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sites"
          element={
            <ProtectedRoute>
              <SitesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/alerts"
          element={
            <ProtectedRoute>
              <AlertsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <HistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/sessions"
          element={
            <ProtectedRoute>
              <ActiveSessionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </ThemeProvider>
    </AuthProvider>
  )
}
