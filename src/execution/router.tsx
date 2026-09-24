import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

export type Route =
  | { name: "home" }
  | { name: "explore" }
  | { name: "tasks" }
  | { name: "humans" }
  | { name: "capabilities" }
  | { name: "developers" }
  | { name: "x402" }
  | { name: "skills" }
  | { name: "rewards" }
  | { name: "activity" }
  | { name: "build" }
  | { name: "docs" }
  | { name: "profile" }
  | { name: "task"; id: string }
  | { name: "execution"; id: string }
  | { name: "capability"; id: string }
  | { name: "not-found" };

export function parseRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { name: "home" };
  if (path === "/explore") return { name: "explore" };
  if (path === "/tasks") return { name: "tasks" };
  if (path === "/humans") return { name: "humans" };
  if (path === "/capabilities") return { name: "capabilities" };
  if (path === "/developers") return { name: "developers" };
  if (path === "/x402") return { name: "x402" };
  if (path === "/skills") return { name: "skills" };
  if (path === "/rewards") return { name: "rewards" };
  if (path === "/activity") return { name: "activity" };
  if (path === "/build") return { name: "build" };
  if (path === "/docs") return { name: "docs" };
  if (path === "/profile") return { name: "profile" };
  const [resource, id] = path.slice(1).split("/");
  if (resource === "tasks" && id) return { name: "task", id: decodeURIComponent(id) };
  if (resource === "executions" && id)
    return { name: "execution", id: decodeURIComponent(id) };
  if (resource === "capabilities" && id)
    return { name: "capability", id: decodeURIComponent(id) };
  return { name: "not-found" };
}

export function navigate(href: string, options?: { replace?: boolean }) {
  if (options?.replace) window.history.replaceState({}, "", href);
  else window.history.pushState({}, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));
  useEffect(() => {
    const update = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return route;
}

export function Link({
  href,
  children,
  className,
  onClick,
  ariaLabel,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.();
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    navigate(href);
  };
  return (
    <a href={href} className={className} onClick={follow} aria-label={ariaLabel}>
      {children}
    </a>
  );
}
