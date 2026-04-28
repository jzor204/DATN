import { useEffect } from "react";
import LoadingScreen from "../components/LoadingScreen";
import { navigateTo } from "../utils/router";

export default function ProtectedRoute({ isReady, isAuthenticated, children }) {
  useEffect(() => {
    if (isReady && !isAuthenticated) {
      navigateTo("/login", { replace: true });
    }
  }, [isReady, isAuthenticated]);

  if (!isReady) {
    return <LoadingScreen label="Checking session..." />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return children;
}
