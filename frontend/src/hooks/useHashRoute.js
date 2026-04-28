import { useEffect, useState } from "react";
import { getCurrentRoute } from "../utils/router";

export function useHashRoute() {
  const [route, setRoute] = useState(() => getCurrentRoute());

  useEffect(() => {
    const syncRoute = () => {
      setRoute(getCurrentRoute());
    };

    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("load", syncRoute);

    return () => {
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("load", syncRoute);
    };
  }, []);

  return route;
}
