import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import RecipeDetail from './pages/RecipeDetail'
import GroceryList from './pages/GroceryList'
import NotFound from './pages/NotFound'
import Login from './pages/Login'
import Profile from './pages/Profile'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import PrivateRoute from './components/PrivateRoute'
import NotificationToast from './components/ui/NotificationToast'

function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={
              <PrivateRoute>
                <Home />
              </PrivateRoute>
            } />
            <Route path="recipe/:id" element={
              <PrivateRoute>
                <RecipeDetail />
              </PrivateRoute>
            } />
            <Route path="grocery-list" element={
              <PrivateRoute>
                <GroceryList />
              </PrivateRoute>
            } />
            <Route path="login" element={<Login />} />
            <Route path="profile" element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
        <NotificationToast />
      </AuthProvider>
    </NotificationProvider>
  )
}

export default App
