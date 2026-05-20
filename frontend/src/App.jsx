import { useEffect, useMemo, useState } from "react";
import { getMe } from "./api/authApi";
import AppShell from "./components/AppShell";
import AlertBanner from "./components/AlertBanner";
import LoadingScreen from "./components/LoadingScreen";
import { useHashRoute } from "./hooks/useHashRoute";
import LoginPage from "./pages/LoginPage";
import MembersPage from "./pages/MembersPage";
import MyTasksPage from "./pages/MyTasksPage";
import NotFoundPage from "./pages/NotFoundPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import ProjectListPage from "./pages/ProjectListPage";
import RegisterPage from "./pages/RegisterPage";
import SettingsPage from "./pages/SettingsPage";
import TaskDetailPage from "./pages/TaskDetailPage";
import ProtectedRoute from "./routes/ProtectedRoute";
import { clearAccessToken, getAccessToken, setAccessToken } from "./utils/auth";
import { navigateTo } from "./utils/router";

function matchProjectRoute(pathname) {
  const match = pathname.match(/^\/projects\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}

function matchTaskRoute(pathname) {
  const match = pathname.match(/^\/tasks\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}

export default function App() {
  const route = useHashRoute();
  const [token, setToken] = useState(() => getAccessToken());
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState("");

  const projectId = useMemo(() => matchProjectRoute(route.pathname), [route.pathname]);
  const taskId = useMemo(() => matchTaskRoute(route.pathname), [route.pathname]);

  useEffect(() => {
    if (!window.location.hash) {
      navigateTo("/", { replace: true });
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrapSession() {
      if (!token) {
        if (active) {
          setCurrentUser(null);
          setSessionReady(true);
        }
        return;
      }

      setSessionReady(false);

      try {
        const profile = await getMe();
        if (active) {
          setCurrentUser(profile);
          setSessionError("");
        }
      } catch (err) {
        clearAccessToken();
        if (active) {
          setToken("");
          setCurrentUser(null);
          setSessionError(err.message);
        }
      } finally {
        if (active) {
          setSessionReady(true);
        }
      }
    }

    bootstrapSession();

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    const isAuthPage =
      route.pathname === "/" || route.pathname === "/login" || route.pathname === "/register";

    if (!currentUser && route.pathname === "/") {
      navigateTo("/login", { replace: true });
    }

    if (currentUser && isAuthPage) {
      navigateTo("/projects", { replace: true });
    }
  }, [currentUser, route.pathname, sessionReady]);

  function handleAuthSuccess(accessToken) {
    setAccessToken(accessToken);
    setToken(accessToken);
    navigateTo("/projects", { replace: true });
  }

  function handleLogout() {
    clearAccessToken();
    setToken("");
    setCurrentUser(null);
    navigateTo("/login", { replace: true });
  }

  const isAuthenticated = Boolean(token && currentUser);
  const isPublicRoute =
    route.pathname === "/" || route.pathname === "/login" || route.pathname === "/register";

  if (!sessionReady && token) {
    return (
      <div className="px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <LoadingScreen label="Đang khôi phục phiên đăng nhập..." />
        </div>
      </div>
    );
  }

  if (isPublicRoute) {
    if (route.pathname === "/register") {
      return <RegisterPage notice={sessionError} onAuthSuccess={handleAuthSuccess} />;
    }

    return <LoginPage notice={sessionError} onAuthSuccess={handleAuthSuccess} />;
  }

  let protectedContent = <NotFoundPage />;

  if (route.pathname === "/projects") {
    protectedContent = <ProjectListPage currentUser={currentUser} />;
  } else if (route.pathname === "/my-tasks") {
    protectedContent = <MyTasksPage currentUser={currentUser} />;
  } else if (route.pathname === "/members") {
    protectedContent = <MembersPage currentUser={currentUser} />;
  } else if (route.pathname === "/settings") {
    protectedContent = <SettingsPage currentUser={currentUser} onLogout={handleLogout} />;
  } else if (projectId) {
    protectedContent = <ProjectDetailPage currentUser={currentUser} projectId={projectId} />;
  } else if (taskId) {
    protectedContent = <TaskDetailPage currentUser={currentUser} taskId={taskId} />;
  }

  return (
    <AppShell currentUser={currentUser} onLogout={handleLogout}>
      <div className="space-y-6">
        <AlertBanner message={sessionError} />
        <ProtectedRoute isAuthenticated={isAuthenticated} isReady={sessionReady}>
          {protectedContent}
        </ProtectedRoute>
      </div>
    </AppShell>
  );
}
