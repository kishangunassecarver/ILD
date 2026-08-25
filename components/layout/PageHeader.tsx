import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

/** Standard heading block for every inner page. */
export function PageHeader({
  title,
  intro,
  trail,
  children,
}: {
  title: string;
  intro?: string;
  trail?: { label: string; href?: string }[];
  /** Optional actions or stats sitting to the right of the heading. */
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6">
      {trail && <Breadcrumbs trail={trail} />}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>
          {intro && <p className="mt-2 text-sm leading-relaxed text-muted">{intro}</p>}
        </div>
        {children}
      </div>
    </header>
  );
}
