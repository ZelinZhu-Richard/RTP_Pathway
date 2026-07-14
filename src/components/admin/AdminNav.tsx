"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Review queue" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/analytics", label: "Analytics" },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1 rounded-xl border border-stone-200 bg-white p-1.5 text-sm">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`rounded-lg px-3 py-1.5 ${
            pathname === l.href ? "bg-teal-700 font-medium text-white" : "text-stone-600 hover:bg-stone-100"
          }`}
        >
          {l.label}
        </Link>
      ))}
      <button
        type="button"
        onClick={async () => {
          await fetch("/api/admin/logout", { method: "POST" });
          router.push("/admin/login");
          router.refresh();
        }}
        className="ml-auto rounded-lg px-3 py-1.5 text-stone-500 hover:bg-stone-100"
      >
        Sign out
      </button>
    </nav>
  );
}
