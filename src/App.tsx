import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { db, ensureSettings } from './db/database';
import { HomePage } from './pages/HomePage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';
import { BottomNav } from './components/BottomNav';

export default function App() {
  useEffect(() => {
    void ensureSettings();
  }, []);

  return (
    <div className="min-h-full flex flex-col">
      <main className="flex-1 pb-20">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}

// hilfreich, damit Vite das Tree-Shaking nicht verliert
export { db };
