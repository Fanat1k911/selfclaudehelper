import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { IngredientsPage } from './pages/IngredientsPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProductionPage } from './pages/ProductionPage'
import { SalesPage } from './pages/SalesPage'
import { RecipesPage } from './pages/RecipesPage'
import { ProductsPage } from './pages/ProductsPage'
import { StaffPage } from './pages/StaffPage'
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
      </Route>
      <Route path="*" element={<DefaultRoute />} />
    </Routes>
  )
}

export default App
