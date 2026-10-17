import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  type ErrorComponentProps,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import "@genlayer/transaction-kit-react/styles.css";
import "../styles.css";
import { SiteFooter, SiteHeader } from "@/components/cover/Shell";
import { WalletProvider } from "@/lib/genlayer/wallet";

function NotFound() {
  return (
    <div className="not-found">
      <p className="eyebrow">404 / record absent</p>
      <h1>Nothing here.</h1>
      <p>The page you requested does not exist in COVER.</p>
      <Link className="button button-light" to="/">
        Return home
      </Link>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const errorMessage = error instanceof Error ? error.message : String(error);
  useEffect(() => console.error(error), [error]);
  return (
    <div className="not-found">
      <p className="eyebrow">COVER / read error</p>
      <h1>COVER could not load this page.</h1>
      <p>{errorMessage}</p>
      <div className="inline-actions">
        <button
          className="button button-light"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Try again
        </button>
        <Link className="button button-quiet" to="/">
          Home
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "COVER · Insurance for autonomous agents" },
        {
          name: "description",
          content:
            "COVER is an AI-powered insurance claims court on GenLayer for specified autonomous agent failures.",
        },
        {
          property: "og:title",
          content: "COVER · Insurance for autonomous agents",
        },
        {
          property: "og:description",
          content:
            "Create funded policies, submit claims, and evaluate specified AI agent failures through GenLayer consensus.",
        },
      ],
      links: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossOrigin: "anonymous",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap",
        },
      ],
    }),
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: NotFound,
    errorComponent: ErrorComponent,
  },
);

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <SiteHeader />
        <Outlet />
        <SiteFooter />
      </WalletProvider>
    </QueryClientProvider>
  );
}
