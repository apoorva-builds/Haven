import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AppShell } from './components/Shell';
import { ToastProvider } from './components/Toast';
import { CalendarPage } from './pages/Calendar';
import { CampaignsPage } from './pages/Campaigns';
import { GalleryPage } from './pages/Gallery';
import { IdeasPage } from './pages/Ideas';
import { IdeaWorkspacePage } from './pages/idea/IdeaWorkspace';
import { LibraryPage } from './pages/Library';
import { LinksPage } from './pages/Links';
import { NotFoundPage } from './pages/NotFound';
import { TeamPage } from './pages/Team';
import { TodayPage } from './pages/Today';
import { StudioPage } from './pages/studio/Studio';
import { StudioProjectPage } from './pages/studio/StudioProject';
import { StoreProvider } from './state/store';
import { ThemeProvider } from './state/theme';

/** Accounts now live in the Creation Gallery's account selector. */
function AccountRedirect() {
  const { accountId = '' } = useParams();
  return <Navigate to={`/gallery?account=${encodeURIComponent(accountId)}`} replace />;
}

export function App() {
  return (
    <StoreProvider>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<TodayPage />} />
                <Route path="ideas" element={<IdeasPage />} />
                <Route path="ideas/:ideaId" element={<IdeaWorkspacePage />} />
                <Route path="ideas/:ideaId/:tab" element={<IdeaWorkspacePage />} />
                <Route path="accounts" element={<Navigate to="/gallery" replace />} />
                <Route path="accounts/:accountId" element={<AccountRedirect />} />
                <Route path="gallery" element={<GalleryPage />} />
                <Route path="gallery/:versionId" element={<GalleryPage />} />
                <Route path="studio" element={<StudioPage />} />
                <Route path="studio/:projectId" element={<StudioProjectPage />} />
                <Route path="studio/:projectId/:tab" element={<StudioProjectPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="library" element={<LibraryPage />} />
                <Route path="campaigns" element={<CampaignsPage />} />
                <Route path="links" element={<LinksPage />} />
                <Route path="team" element={<TeamPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </StoreProvider>
  );
}
