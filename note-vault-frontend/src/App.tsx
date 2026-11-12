import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminNotes } from '@/pages/AdminNotes'
import { AdminUsers } from '@/pages/AdminUsers'
import { Interests } from '@/pages/Interests'
import { Login } from '@/pages/Login'
import { Notes } from '@/pages/Notes'
import { Posts } from '@/pages/Posts'
import { Profile } from '@/pages/Profile'
import { Register } from '@/pages/Register'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/notes" replace />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="/interests" element={<Interests />} />
          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/notes" element={<AdminNotes />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/notes" replace />} />
    </Routes>
  )
}
