import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Market from './pages/Market';
import Portfolio from './pages/Portfolio';
import News from './pages/News';
import Leaderboard from './pages/Leaderboard';
import Admin from './pages/Admin';
import TeamManagement from './pages/TeamManagement';
import JoinTeam from './pages/JoinTeam';
import Profile from './pages/Profile';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

import { Toaster } from './components/ui/sonner';

function App() {
  return (
    <Router>
      <Toaster />
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/join-team" element={<ProtectedRoute><JoinTeam /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Navigate to="/" replace />} />
              <Route path="market" element={<Market />} />
              <Route path="portfolio" element={<Portfolio />} />
              <Route path="news" element={<News />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="admin" element={<Admin />} />
              <Route path="team" element={<TeamManagement />} />
              <Route path="profile" element={<Profile />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
