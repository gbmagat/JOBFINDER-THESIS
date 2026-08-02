import type { ReactNode } from "react";

export function LguPageHeader({
  action,
  eyebrow,
  intro,
  title,
}: {
  action?: ReactNode;
  eyebrow: string;
  intro: string;
  title: string;
}) {
  return (
    <header className="lgu-page-header">
      <div>
        <span className="lgu-kicker">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{intro}</p>
      </div>
      {action ? <div className="lgu-page-header__action">{action}</div> : null}
    </header>
  );
}

export function LguStatus({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "warning" | "success" | "danger";
}) {
  return <span className={`lgu-status lgu-status--${tone}`}>{children}</span>;
}
