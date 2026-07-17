import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { PublicExperienceShell } from "@/components/public/PublicExperienceShell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RTP Pathway — opportunities for Triangle students",
  description:
    "A free, source-linked preview directory of internships, volunteer roles, scholarships, and programs for Triangle high-school students.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} antialiased min-h-screen flex flex-col`}
      >
        <PublicExperienceShell>
          <header
            data-site-header
            className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/85 backdrop-blur"
          >
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
              <Link href="/" className="site-wordmark flex items-baseline gap-2">
                <span className="whitespace-nowrap font-display text-lg font-bold tracking-tight text-teal-800">
                  RTP Pathway
                </span>
                <span className="hidden text-xs text-stone-500 sm:inline">
                  opportunities for Triangle students
                </span>
              </Link>
              <nav className="flex items-center gap-1 text-sm">
                <Link
                  href="/explore"
                  className="rounded-md px-3 py-1.5 text-stone-700 hover:bg-stone-100"
                >
                  Explore
                </Link>
                <Link
                  href="/saved"
                  className="rounded-md px-3 py-1.5 text-stone-700 hover:bg-stone-100"
                >
                  Saved
                </Link>
                <Link
                  href="/compare"
                  className="rounded-md px-3 py-1.5 text-stone-700 hover:bg-stone-100"
                >
                  Compare
                </Link>
                <Link
                  href="/submit"
                  className="ml-1 whitespace-nowrap rounded-md bg-teal-700 px-3 py-1.5 font-medium text-white hover:bg-teal-800"
                >
                  Submit<span className="hidden md:inline"> an opportunity</span>
                </Link>
              </nav>
            </div>
          </header>
          <main data-site-main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
            {children}
          </main>
          <footer data-site-footer className="border-t border-stone-200 bg-white">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-stone-500">
              <p>
                A community resource for high-school students in Chapel Hill, Carrboro, Durham,
                Raleigh, and around the Triangle. Always confirm details with the organization
                before applying.
              </p>
              <Link href="/admin" className="hover:text-stone-700">
                Admin
              </Link>
            </div>
          </footer>
        </PublicExperienceShell>
      </body>
    </html>
  );
}
