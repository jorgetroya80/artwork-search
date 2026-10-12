import type { PropsWithChildren, ReactNode } from 'react';

type LayoutProps = PropsWithChildren<{ toolbar?: ReactNode }>;

export function Layout({ toolbar, children }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="contents sm:sticky sm:top-0 sm:z-10 sm:bg-bg">
        <header className="flex items-center gap-2 border-b border-fg px-4 py-3.5 sm:gap-3 sm:px-6 sm:py-[18px]">
          <span aria-hidden className="size-3 bg-mark sm:size-3.5" />
          <span className="font-sans text-base font-extrabold tracking-wide uppercase sm:text-[18px]">
            Artwork Search
          </span>
        </header>
        {toolbar}
      </div>
      <main className="flex-1">{children}</main>
      <footer className="flex flex-col gap-1 bg-fg p-4 font-mono text-xs text-bg uppercase sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <a href="https://data.rijksmuseum.nl">
          Collection data and images: Rijksmuseum
        </a>
        <span>Artwork Search</span>
      </footer>
    </div>
  );
}
