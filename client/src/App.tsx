import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { FlightStatusPage } from './pages/FlightStatusPage';
import { FlightResultsPage } from './pages/FlightResultsPage';
import { FlightDetailsPage } from './pages/FlightDetailsPage';
import { AirportsPage } from './pages/AirportsPage';
import { AirportDetailPage } from './pages/AirportDetailPage';
import { AboutPage } from './pages/AboutPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotFoundPage } from './pages/NotFoundPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/flight-status" element={<FlightStatusPage />} />
          <Route path="/flight-results" element={<FlightResultsPage />} />
          <Route path="/flight/:flightNumber" element={<FlightDetailsPage />} />
          <Route path="/airports" element={<AirportsPage />} />
          <Route path="/airport/:airportCode" element={<AirportDetailPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
