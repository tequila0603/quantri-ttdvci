import { useEffect, useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { LoginView } from './pages/LoginView'
import { LoadingBlock } from './components/ui/LoadingBlock'
import { User, fetchApi } from './utils/shared'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    fetchApi<User>('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false))
  }, [])

  if (checkingSession) return <main className="session-check"><LoadingBlock label="Đang kiểm tra phiên làm việc" /></main>
  if (!user) return <LoginView onLogin={setUser} />
  
  return (
    <BrowserRouter>
      <AppLayout user={user} onLogout={() => setUser(null)} />
    </BrowserRouter>
  )
}
