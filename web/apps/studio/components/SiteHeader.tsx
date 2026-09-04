import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-bg-inset/60 backdrop-blur-sm">
      <div className="mx-auto flex h-11 max-w-[1400px] items-center justify-between px-4">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="num text-[13px] tracking-tight text-text">
            sudoku<span className="text-text-faint">/</span>solver
            <span className="text-text-faint">/</span>
            <span className="text-accent">studio</span>
          </span>
        </Link>
        <nav className="num flex items-center gap-4 text-[12px] text-text-dim">
          <Link href="/" className="hover:text-text">
            input
          </Link>
          <span className="text-text-faint">·</span>
          <Link href="/benchmarks" className="hover:text-text">
            benchmarks
          </Link>
          <span className="text-text-faint">·</span>
          <a
            href="https://github.com"
            className="hover:text-text"
            aria-label="source"
          >
            src
          </a>
        </nav>
      </div>
    </header>
  );
}
