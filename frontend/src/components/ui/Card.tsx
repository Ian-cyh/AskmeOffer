import { clsx } from "clsx";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
}

export function Card({ children, className, title, description }: CardProps) {
  return (
    <div className={clsx("bg-card rounded-xl border border-border p-6", className)}>
      {title && (
        <div className="mb-4">
          <h3 className="font-semibold text-foreground">{title}</h3>
          {description && <p className="text-sm text-muted mt-0.5">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
