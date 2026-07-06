import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function BottomNav() {
  const { t } = useTranslation();
  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center gap-0.5 py-2 px-3 text-xs
     ${isActive ? 'text-slate-900 dark:text-slate-100 font-semibold' : 'text-slate-500 dark:text-slate-400'}`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-[var(--border)]
                    bg-[var(--bg-card)]/95 backdrop-blur
                    pb-[env(safe-area-inset-bottom)] z-40">
      <div className="max-w-xl mx-auto grid grid-cols-3">
        <NavLink to="/" end className={cls}>
          <span aria-hidden>🏠</span>
          <span>{t('thisWeek')}</span>
        </NavLink>
        <NavLink to="/stats" className={cls}>
          <span aria-hidden>📊</span>
          <span>{t('stats')}</span>
        </NavLink>
        <NavLink to="/settings" className={cls}>
          <span aria-hidden>⚙️</span>
          <span>{t('settings')}</span>
        </NavLink>
      </div>
    </nav>
  );
}
