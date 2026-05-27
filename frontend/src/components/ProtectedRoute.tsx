import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { auth } from '@/lib/auth'

interface Props {
  children: ReactNode
}

export default function ProtectedRoute({ children }: Props) {
  if (!auth.isLoggedIn()) {
    return <Navigate to="/login" replace />
  }
  if (!auth.isSetupWizardDone() && window.location.pathname !== '/welcome') {
    return <Navigate to="/welcome" replace />
  }
  return <>{children}</>
}
