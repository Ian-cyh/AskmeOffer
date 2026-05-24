interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  hint?: string;
}

export function FormField({ label, children, hint }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 rounded-lg border border-border bg-white text-sm
        focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
        transition-colors ${props.className || ""}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full px-3 py-2 rounded-lg border border-border bg-white text-sm
        focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
        transition-colors resize-y ${props.className || ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2 rounded-lg border border-border bg-white text-sm
        focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
        transition-colors ${props.className || ""}`}
    />
  );
}
