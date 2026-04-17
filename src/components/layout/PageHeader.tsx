interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export const PageHeader = ({ eyebrow, title, description, children }: PageHeaderProps) => (
  <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
    <div>
      {eyebrow && (
        <p className="mono text-xs uppercase tracking-[0.2em] text-primary/80 mb-2">{eyebrow}</p>
      )}
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{title}</h1>
      {description && (
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm md:text-base">{description}</p>
      )}
    </div>
    {children && <div className="flex items-center gap-2">{children}</div>}
  </header>
);
