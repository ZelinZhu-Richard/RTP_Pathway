"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ConnectionField } from "@/components/landing/ConnectionField";
import styles from "./PublicExperienceShell.module.css";

interface PublicExperienceShellProps {
  children: ReactNode;
}

function routeKind(pathname: string): "home" | "explore" | "standard" {
  if (pathname === "/") return "home";
  if (pathname === "/explore") return "explore";
  return "standard";
}

/**
 * Keeps the public cosmic atmosphere mounted while visitors move between the
 * landing page and Explore. It also progressively enhances internal route
 * changes with the View Transition API without changing normal link semantics.
 */
export function PublicExperienceShell({ children }: PublicExperienceShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const shellRef = useRef<HTMLDivElement>(null);
  const pendingResolve = useRef<(() => void) | null>(null);
  const pendingTimer = useRef<number | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const kind = routeKind(pathname);
  const cinematic = kind !== "standard";

  const shellClassName = useMemo(
    () =>
      [
        "public-experience-shell",
        styles.shell,
        styles[kind],
        cinematic ? styles.cinematic : styles.standard,
        transitioning ? styles.transitioning : "",
      ]
        .filter(Boolean)
        .join(" "),
    [cinematic, kind, transitioning],
  );

  useEffect(() => {
    const shell = shellRef.current;
    if (shell) {
      shell.style.setProperty(
        "--public-ambient-image-opacity",
        kind === "home" ? "1" : kind === "explore" ? "0.58" : "0",
      );
      shell.style.setProperty(
        "--public-ambient-network-opacity",
        kind === "home" ? "0.78" : kind === "explore" ? "0.42" : "0",
      );
      shell.style.setProperty(
        "--public-ambient-shift-y",
        kind === "explore" ? "-3vh" : "0vh",
      );
    }

    if (pendingResolve.current) {
      const resolve = pendingResolve.current;
      pendingResolve.current = null;
      window.requestAnimationFrame(() => {
        resolve();
        setTransitioning(false);
      });
    } else {
      setTransitioning(false);
    }
  }, [kind, pathname]);

  useEffect(
    () => () => {
      if (pendingTimer.current !== null) window.clearTimeout(pendingTimer.current);
      pendingResolve.current?.();
    },
    [],
  );

  const handleNavigation = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a");
    if (
      !anchor ||
      anchor.target === "_blank" ||
      anchor.hasAttribute("download") ||
      anchor.dataset.nativeNavigation === "true"
    ) {
      return;
    }

    const destination = new URL(anchor.href, window.location.href);
    if (
      destination.origin !== window.location.origin ||
      destination.pathname === window.location.pathname
    ) {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof document.startViewTransition !== "function" || reducedMotion) return;

    event.preventDefault();
    event.stopPropagation();
    setTransitioning(true);

    const namedSource =
      destination.pathname === "/explore" && anchor.classList.contains("landing-button-primary")
        ? anchor
        : destination.pathname.startsWith("/opportunities/")
          ? anchor.closest<HTMLElement>("[data-opportunity-id]")
          : null;
    if (namedSource) {
      const opportunityId = namedSource.dataset.opportunityId;
      const transitionName = opportunityId
        ? `opportunity-${opportunityId.replace(/[^a-zA-Z0-9_-]/g, "-")}`
        : "discovery-portal";
      namedSource.style.setProperty("view-transition-name", transitionName);
    }

    const href = destination.pathname + destination.search + destination.hash;
    let transition: ViewTransition;
    try {
      transition = document.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            pendingResolve.current = resolve;
            router.push(href);
            pendingTimer.current = window.setTimeout(() => {
              if (pendingResolve.current === resolve) pendingResolve.current = null;
              resolve();
              setTransitioning(false);
            }, 1400);
          }),
      );
    } catch {
      namedSource?.style.removeProperty("view-transition-name");
      setTransitioning(false);
      router.push(href);
      return;
    }

    void transition.finished.finally(() => {
      namedSource?.style.removeProperty("view-transition-name");
      if (pendingTimer.current !== null) {
        window.clearTimeout(pendingTimer.current);
        pendingTimer.current = null;
      }
      setTransitioning(false);
    });
  };

  return (
    <div
      ref={shellRef}
      className={shellClassName}
      data-public-route={kind}
      onClickCapture={handleNavigation}
    >
      {cinematic && (
        <div className={styles.ambient} aria-hidden="true">
          <Image
            src="/images/cosmic-community.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className={["public-ambient-image", styles.ambientImage].join(" ")}
          />
          <div className={styles.ambientColor} />
          <div className={styles.ambientScrim} />
          <ConnectionField
            className={["public-ambient-network", styles.ambientNetwork].join(" ")}
          />
        </div>
      )}
      <div className={styles.routeVeil} aria-hidden="true" />
      {children}
    </div>
  );
}
