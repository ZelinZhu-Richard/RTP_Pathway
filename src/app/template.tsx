// Re-mounts on every route change, giving each page a soft entry.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
