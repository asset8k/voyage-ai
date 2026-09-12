import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './auth/AuthProvider'
import { AppShell } from './components/AppShell'
import { ToastProvider } from './components/ToastProvider'
import { AuthPage } from './pages/AuthPage'
import { ExplorePage } from './pages/ExplorePage'
import { GeneratedTripPage } from './pages/GeneratedTripPage'
import { MyTripsPage } from './pages/MyTripsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PlanTripPage } from './pages/PlanTripPage'
import { PublicTripPage } from './pages/PublicTripPage'
import { SavedTripDetailPage } from './pages/SavedTripDetailPage'
import './index.css'

function App() {
  return <AuthProvider><ToastProvider><BrowserRouter><Routes><Route element={<AppShell />}><Route index element={<PlanTripPage />} /><Route path="generated" element={<GeneratedTripPage />} /><Route path="explore" element={<ExplorePage />} /><Route path="trips/:tripId" element={<PublicTripPage />} /><Route path="my-trips" element={<MyTripsPage />} /><Route path="my-trips/:tripId" element={<SavedTripDetailPage />} /><Route path="auth" element={<AuthPage />} /><Route path="*" element={<NotFoundPage />} /></Route></Routes></BrowserRouter></ToastProvider></AuthProvider>
}

export default App
