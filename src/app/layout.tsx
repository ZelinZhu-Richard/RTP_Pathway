import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RTP Pathway — opportunities for Triangle students",
  description:
    "Free, verified internships, volunteer roles, scholarships, and programs for high-school students in Chapel Hill, Durham, and Raleigh.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}>
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-lg font-bold tracking-tight text-teal-800">RTP Pathway</span>
              <span className="hidden text-xs text-stone-500 sm:inline">
                opportunities for Triangle students
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/" className="rounded-md px-3 py-1.5 text-stone-700 hover:bg-stone-100">
                Explore
              </Link>
              <Link href="/saved" className="rounded-md px-3 py-1.5 text-stone-700 hover:bg-stone-100">
                Saved
              </Link>
              <Link href="/compare" className="rounded-md px-3 py-1.5 text-stone-700 hover:bg-stone-100">
                Compare
              </Link>
              <Link
                href="/submit"
                className="ml-1 rounded-md bg-teal-700 px-3 py-1.5 font-medium text-white hover:bg-teal-800"
              >
                Submit an opportunity
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-stone-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-stone-500">
            <p>
              A community resource for high-school students in Chapel Hill, Carrboro, Durham, Raleigh, and
              around the Triangle. Always confirm details with the organization before applying.
            </p>
            <Link href="/admin" className="hover:text-stone-700">
              Admin
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
