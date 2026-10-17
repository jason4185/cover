import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { WalletControl, useWallet } from "@/lib/genlayer/wallet";

const links = [
  { label: "Home", to: "/" },
  { label: "Policies", to: "/policies" },
  { label: "Claims", to: "/claims" },
  { label: "How it works", to: "/how-it-works" },
] as const;

export function CoverMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <span
      className={`cover-mark ${inverse ? "cover-mark-inverse" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 34 34" fill="none">
        <path
          d="M17 2.5 29 7v8.7c0 7.8-5.1 13.1-12 16.2C10.1 28.8 5 23.5 5 15.7V7l12-4.5Z"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path
          d="M22.2 11.7a7 7 0 1 0 0 10.6"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="square"
        />
        <circle cx="23.3" cy="17" r="1.25" fill="currentColor" />
      </svg>
    </span>
  );
}

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      to="/"
      className={`brand ${inverse ? "brand-inverse" : ""}`}
      aria-label="COVER home"
    >
      <CoverMark inverse={inverse} />
      <span>
        COVER<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const wallet = useWallet();
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={pathname === link.to ? "active" : ""}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <WalletControl />
          <button
            className="menu-button"
            type="button"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        {open && (
          <nav className="mobile-nav" aria-label="Mobile navigation">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className={pathname === link.to ? "active" : ""}
              >
                {link.label}
              </Link>
            ))}
            <div className="mobile-wallet">
              <WalletControl />
            </div>
          </nav>
        )}
      </div>
      {wallet.error && (
        <div className="wallet-notice">
          <div className="container">{wallet.error}</div>
        </div>
      )}
    </header>
  );
}

export function PageContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={`container page-container ${className}`}>{children}</main>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    to: "/policies" | "/claims" | "/create" | "/how-it-works";
  };
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description && <p className="section-description">{description}</p>}
      </div>
      {action && (
        <Link className="text-link" to={action.to}>
          {action.label}
          <ArrowUpRight size={15} />
        </Link>
      )}
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="page-intro">
      <div>
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          {eyebrow}
        </p>
        <h1>{title}</h1>
        <p className="intro-copy">{description}</p>
      </div>
      {action}
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Brand inverse />
          <p className="footer-copy">
            COVER is an AI-powered insurance claims court on GenLayer. Policy
            terms, compensation, and settlement remain deterministic.
          </p>
        </div>
        <div className="footer-links">
          <Link to="/policies">Policies</Link>
          <Link to="/claims">Claims</Link>
          <Link to="/how-it-works">How it works</Link>
          <Link to="/dashboard">Dashboard</Link>
        </div>
        <div className="footer-bottom">
          <span>© COVER protocol</span>
          <span>Studio Next · Chain 61997 · GEN</span>
        </div>
      </div>
    </footer>
  );
}
