import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleDashed,
  FileWarning,
  LoaderCircle,
  SearchX,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  COVER_CONTRACT_ADDRESS,
  GENLAYER_CONFIG_ERROR,
} from "@/lib/genlayer/config";
import { formatStatus } from "@/lib/genlayer/format";

type ButtonHref =
  "/" | "/policies" | "/claims" | "/create" | "/dashboard" | "/how-it-works";

export function Button({
  children,
  className = "",
  variant = "dark",
  type = "button",
  disabled = false,
  onClick,
  href,
}: {
  children: ReactNode;
  className?: string;
  variant?: "dark" | "light" | "outline" | "quiet" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  href?: ButtonHref;
}) {
  const classes = `button button-${variant} ${className}`;
  if (href)
    return (
      <Link className={classes} to={href}>
        {children}
        <ArrowRight size={16} />
      </Link>
    );
  return (
    <button
      className={classes}
      type={type}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function StatusPill({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const tone =
    status.includes("COVERED") || status === "PAID"
      ? "positive"
      : status.includes("NOT_COVERED") || status === "REFUNDED"
        ? "negative"
        : status.includes("INSUFFICIENT") || status === "REVIEW_OPEN"
          ? "warning"
          : "neutral";
  return (
    <span className={`status-pill status-${tone}`}>
      <span className="status-dot" />
      {label ?? formatStatus(status)}
    </span>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: string;
}) {
  return (
    <div className={`metric-card ${tone}`}>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      {detail && <span className="metric-detail">{detail}</span>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon = <SearchX size={19} />,
  action,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function LoadingState({
  label = "Reading COVER records",
}: {
  label?: string;
}) {
  return (
    <div className="loading-state">
      <LoaderCircle className="spin" size={18} />
      <span>{label}…</span>
    </div>
  );
}

export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-state">
      <AlertTriangle size={19} />
      <div>
        <strong>Could not load COVER data</strong>
        <p>{message}</p>
        {retry && (
          <button className="text-link-button" onClick={retry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

export function UnconfiguredState({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`unconfigured ${compact ? "unconfigured-compact" : ""}`}>
      <CircleDashed size={18} />
      <div>
        <strong>
          {COVER_CONTRACT_ADDRESS
            ? "Studio Next configuration is invalid"
            : "Contract address not configured"}
        </strong>
        <p>
          {GENLAYER_CONFIG_ERROR ??
            "Set VITE_COVER_CONTRACT_ADDRESS in the frontend environment to read Studio Next."}
        </p>
      </div>
    </div>
  );
}

export function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong className={mono ? "mono" : ""}>{value}</strong>
    </div>
  );
}

export function AddressValue({ value }: { value: string }) {
  return (
    <span className="address-value" title={value}>
      {value.slice(0, 6)}…{value.slice(-4)}
    </span>
  );
}

export function Timeline({
  items,
}: {
  items: {
    label: string;
    detail: string;
    state: "complete" | "current" | "pending";
  }[];
}) {
  return (
    <div className="timeline">
      {items.map((item) => (
        <div
          className={`timeline-item timeline-${item.state}`}
          key={item.label}
        >
          <div className="timeline-marker">
            {item.state === "complete" ? (
              <Check size={13} />
            ) : item.state === "current" ? (
              <CircleDashed size={13} />
            ) : (
              <span />
            )}
          </div>
          <div>
            <strong>{item.label}</strong>
            <p>{item.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function EvidenceLink({
  url,
  hash,
  label,
}: {
  url: string;
  hash: string;
  label: string;
}) {
  if (!url)
    return (
      <div className="evidence-empty">
        <FileWarning size={15} /> No evidence submitted
      </div>
    );
  return (
    <div className="evidence-item">
      <div>
        <span className="eyebrow">{label}</span>
        <a href={url} target="_blank" rel="noreferrer">
          {url}
        </a>
      </div>
      <code>{hash}</code>
    </div>
  );
}
