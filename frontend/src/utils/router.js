function normalizePath(path) {
  if (!path || path === "#") {
    return "/";
  }

  let normalizedPath = path;
  if (!normalizedPath.startsWith("/")) {
    normalizedPath = `/${normalizedPath}`;
  }

  if (normalizedPath.length > 1) {
    normalizedPath = normalizedPath.replace(/\/+$/, "");
  }

  return normalizedPath || "/";
}

export function getCurrentRoute() {
  const rawHash = window.location.hash.replace(/^#/, "");
  const normalized = normalizePath(rawHash || "/");
  const [pathname, search = ""] = normalized.split("?");

  return {
    pathname,
    searchParams: new URLSearchParams(search),
    fullPath: normalized
  };
}

export function navigateTo(path, options = {}) {
  const target = normalizePath(path);

  if (options.replace) {
    const nextUrl = `${window.location.pathname}${window.location.search}#${target}`;
    window.history.replaceState(null, "", nextUrl);
    window.dispatchEvent(new Event("hashchange"));
    return;
  }

  window.location.hash = target;
}
