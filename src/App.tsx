import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { db, ensureSettings } from './db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { HomePage } from './pages/HomePage';
import { ImportPage } from './pages/ImportPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';
import { BottomNav } from './components/BottomNav';
import { applyTheme, watchAutoTheme } from './lib/theme';

export default function App() {
  const settings = useLiveQuery(() => db.settings.get('app'), []);

  useEffect(() => {
    void ensureSettings();
  }, []);

  useEffect(() => {
    // only daylight supported now; ensure theme applied
    applyTheme();
    return watchAutoTheme();
  }, [settings?.theme]);

  return (
    <div className="min-h-full flex flex-col">
      <main className="flex-1 pb-20">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/import" element={<ImportPage />} />
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
