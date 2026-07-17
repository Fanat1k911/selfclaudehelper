import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { IngredientsPage } from './pages/IngredientsPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProductionPage } from './pages/ProductionPage'
import { PackagingPage } from './pages/PackagingPage'
import { SalesPage } from './pages/SalesPage'
import { RecipesPage } from './pages/RecipesPage'
import { ProductsPage } from './pages/ProductsPage'
import { StaffPage } from './pages/StaffPage'
import { CounterpartiesPage } from './pages/CounterpartiesPage'
import { TechPanelPage } from './pages/TechPanelPage'
import { SurveillancePage } from './pages/SurveillancePage'
import { Layout } from './components/Layout'
import { RequireAuth, RequireRole, defaultPathForRole, useAuth } from './lib/auth'

function DefaultRoute() {
  const { user } = useAuth()
  return <Navigate to={defaultPathForRole(user?.role)} replace />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/ingredients" element={<IngredientsPage />} />
        <Route path="/production" element={<ProductionPage />} />
        <Route path="/packaging" element={<PackagingPage />} />
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
  )
}

export default App
