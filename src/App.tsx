// Root router: creator space and Studio (authenticated), visitor space (public), auth pages.
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { LoginPage, SignupPage } from './creator/AuthPages';
import { CreatorLayout } from './creator/CreatorLayout';
import { AnalyticsPage, SettingsPage, ToursPage, UnavailablePage } from './creator/CreatorPages';
import { DashboardPage } from './creator/DashboardPage';
import { navigate, useRoute } from './router';
import { useSession } from './store/session';
import { useWorkspace } from './store/workspace';
import StudioApp from './studio/StudioApp';
import { VisitorExplorer, VisitorTour } from './visitor/VisitorSpace';

export default function App() {
  const route = useRoute();
  const status = useSession((s) => s.status);
  const orgId = useSession((s) => s.orgId);
  const needsAuth = route.space === 'creator' || route.space === 'studio';

  // The visitor space is anonymous: the session is only restored when a creator page is opened.
  useEffect(() => {
    if (route.space !== 'visitor' && useSession.getState().status === 'unknown') void useSession.getState().restore();
  }, [route.space]);

  // Private spaces redirect to login (keeping the requested page); auth pages skip when signed in.
  useEffect(() => {
    if (status === 'anonymous' && needsAuth) {
      const here = location.hash.replace(/^#/, '') || '/';
      navigate(`/login?next=${encodeURIComponent(here)}`);
    }
    if (status === 'authenticated' && route.space === 'auth') navigate(route.next ?? '/');
  }, [status, needsAuth, route]);

  // The creator space always reflects the latest server data.
  useEffect(() => {
    if (route.space === 'creator' && status === 'authenticated' && orgId) void useWorkspace.getState().refresh();
  }, [route, status, orgId]);

  useEffect(() => {
    document.title =
      route.space === 'studio' ? 'VISORA Studio 3D' : route.space === 'visitor' ? 'VISORA — Visites' : route.space === 'auth' ? 'VISORA — Connexion' : 'VISORA — Espace créateur';
  }, [route.space]);

  if (route.space === 'visitor') return route.page === 'tour' ? <VisitorTour projectId={route.projectId} /> : <VisitorExplorer />;
  if (route.space === 'auth' && status !== 'authenticated') {
    if (status === 'unknown') return <Splash />;
    return route.page === 'login' ? <LoginPage next={route.next} /> : <SignupPage next={route.next} />;
  }
  if (status !== 'authenticated') return <Splash />;

  if (route.space === 'studio') return <StudioApp key={route.projectId ?? 'last'} projectId={route.projectId} />;
  if (route.space !== 'creator') return <Splash />;
  const page = route.page;
  return (
    <CreatorLayout page={page}>
      {page === 'dashboard' && <DashboardPage />}
      {page === 'tours' && <ToursPage />}
      {page === 'publications' && <ToursPage publishedOnly />}
      {page === 'analytics' && <AnalyticsPage />}
      {page === 'settings' && <SettingsPage />}
      {(page === 'ai-builder' || page === 'team' || page === 'subscription') && <UnavailablePage id={page} />}
    </CreatorLayout>
  );
}

function Splash() {
  return (
    <div className="flex h-screen items-center justify-center gap-2 bg-[#F3F6FB] text-slate-500" role="status">
      <Loader2 className="animate-spin" size={18} /> Chargement…
    </div>
  );
}
