import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { UpdateBanner } from './components/UpdateBanner'
import { RequireAuth, RequireRole, defaultPathForRole, useAuth } from './lib/auth'

// React.lazy для всех страниц (2026-07-27, находка vercel-react-best-practices) — раньше
// все 18 страниц импортировались статически в один чанк (1.5MB/416KB gzip, Vite сам
// предупреждал). Recharts + react-grid-layout нужны только на /dashboard, но грузились
// всем ролям сразу, включая worker, который эту страницу физически не видит.
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const IngredientsPage = lazy(() => import('./pages/IngredientsPage').then((m) => ({ default: m.IngredientsPage })))
const EquipmentPage = lazy(() => import('./pages/EquipmentPage').then((m) => ({ default: m.EquipmentPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ProductionPage = lazy(() => import('./pages/ProductionPage').then((m) => ({ default: m.ProductionPage })))
const PackagingMaterialsPage = lazy(() =>
  import('./pages/PackagingMaterialsPage').then((m) => ({ default: m.PackagingMaterialsPage }))
)
const SalesPage = lazy(() => import('./pages/SalesPage').then((m) => ({ default: m.SalesPage })))
const RecipesPage = lazy(() => import('./pages/RecipesPage').then((m) => ({ default: m.RecipesPage })))
const ProductsPage = lazy(() => import('./pages/ProductsPage').then((m) => ({ default: m.ProductsPage })))
const StaffPage = lazy(() => import('./pages/StaffPage').then((m) => ({ default: m.StaffPage })))
const CompaniesPage = lazy(() => import('./pages/CompaniesPage').then((m) => ({ default: m.CompaniesPage })))
const CounterpartiesPage = lazy(() =>
  import('./pages/CounterpartiesPage').then((m) => ({ default: m.CounterpartiesPage }))
)
const TechPanelPage = lazy(() => import('./pages/TechPanelPage').then((m) => ({ default: m.TechPanelPage })))
const SurveillancePage = lazy(() =>
  import('./pages/SurveillancePage').then((m) => ({ default: m.SurveillancePage }))
)
const FeedbackPage = lazy(() => import('./pages/FeedbackPage').then((m) => ({ default: m.FeedbackPage })))

function DefaultRoute() {
  const { user } = useAuth()
  return <Navigate to={defaultPathForRole(user?.role)} replace />
}

function App() {
  return (
    <>
      <UpdateBanner />
      <Suspense fallback={<div className="min-h-screen bg-premium-bg" />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/ingredients" element={<IngredientsPage />} />
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="/production" element={<ProductionPage />} />
            <Route path="/packaging" element={<PackagingMaterialsPage />} />
            <Route
              path="/dashboard"
              element={
                <RequireRole roles={['founder', 'developer']}>
                  <DashboardPage />
                </RequireRole>
              }
            />
            <Route
              path="/sales"
              element={
                <RequireRole roles={['founder', 'developer']}>
                  <SalesPage />
                </RequireRole>
              }
            />
            <Route path="/recipes" element={<RecipesPage />} />
            <Route
              path="/products"
              element={
                <RequireRole roles={['founder', 'developer']}>
                  <ProductsPage />
                </RequireRole>
              }
            />
            <Route
              path="/staff"
              element={
                <RequireRole roles={['founder', 'developer']}>
                  <StaffPage />
                </RequireRole>
              }
            />
            <Route
              path="/counterparties"
              element={
                <RequireRole roles={['founder', 'developer']}>
                  <CounterpartiesPage />
                </RequireRole>
              }
            />
            <Route
              path="/techpanel"
              element={
                <RequireRole roles={['developer']}>
                  <TechPanelPage />
                </RequireRole>
              }
            />
            <Route
              path="/companies"
              element={
                <RequireRole roles={['developer']}>
                  <CompaniesPage />
                </RequireRole>
              }
            />
            <Route
              path="/equipment"
              element={
                <RequireRole roles={['founder', 'developer']}>
                  <EquipmentPage />
                </RequireRole>
              }
            />
            <Route
              path="/surveillance"
              element={
                <RequireRole roles={['founder', 'developer']}>
                  <SurveillancePage />
                </RequireRole>
              }
            />
          </Route>
          <Route path="*" element={<DefaultRoute />} />
        </Routes>
      </Suspense>
    </>
  )
}

export default App
