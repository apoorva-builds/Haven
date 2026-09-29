import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/Shell';
import { ToastProvider } from './components/Toast';
import { AccountsPage } from './pages/Accounts';
import { CalendarPage } from './pages/Calendar';
import { CampaignsPage } from './pages/Campaigns';
import { IdeasPage } from './pages/Ideas';
import { IdeaWorkspacePage } from './pages/idea/IdeaWorkspace';
import { LibraryPage } from './pages/Library';
import { LinksPage } from './pages/Links';
import { NotFoundPage } from './pages/NotFound';
import { TodayPage } from './pages/Today';
import { StoreProvider } from './state/store';
import { ThemeProvider } from './state/theme';

export function App() {
  return (
    <ThemeProvider>
      <StoreProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<TodayPage />} />
                <Route path="ideas" element={<IdeasPage />} />
                <Route path="ideas/:ideaId" element={<IdeaWorkspacePage />} />
                <Route path="ideas/:ideaId/:tab" element={<IdeaWorkspacePage />} />
                <Route path="accounts" element={<AccountsPage />} />
                <Route path="accounts/:accountId" element={<AccountsPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="library" element={<LibraryPage />} />
                <Route path="campaigns" element={<CampaignsPage />} />
                <Route path="links" element={<LinksPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </StoreProvider>
    </ThemeProvider>
  );
}
