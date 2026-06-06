import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import RequireAuth from './routes/RequireAuth'
import AppShell from './shell/AppShell'
import HomePage from './views/HomePage'
import GroupsPage from './views/GroupsPage'
import GroupExpensesPage from './views/GroupExpensesPage'
import ExpensesPage from './views/ExpensesPage'
import FriendsPage from './views/FriendsPage'
import AccountPage from './views/AccountPage'
import GlobalSettlePage from './views/GlobalSettlePage'
import FinancePage from './views/FinancePage'
import IncomePage from './views/IncomePage'
import DebtsLoansPage from './views/DebtsLoansPage'
import EconomePage from './views/EconomePage'
import DashboardPage from './views/DashboardPage'
import InsightsPage from './views/InsightsPage'
import StatsPage from './views/StatsPage'
import OverviewPage from './views/OverviewPage'
import LoginPage from './views/LoginPage'
import SignupPage from './views/SignupPage'
import NotFoundPage from './views/NotFoundPage'
import JoinGroupPage from './views/JoinGroupPage'

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            <Route
              path="/app"
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
            <Route index element={<HomePage />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="groups/:groupId/expenses" element={<GroupExpensesPage />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="friends" element={<FriendsPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="global-settle" element={<GlobalSettlePage />} />
              <Route path="finance" element={<FinancePage />} />
              <Route path="income" element={<IncomePage />} />
              <Route path="debts-loans" element={<DebtsLoansPage />} />
              <Route path="econome" element={<EconomePage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="insights" element={<InsightsPage />} />
              <Route path="stats" element={<StatsPage />} />
              <Route path="overview" element={<OverviewPage />} />
            </Route>

            <Route path="/join/:groupId" element={<RequireAuth><JoinGroupPage /></RequireAuth>} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  )
}
