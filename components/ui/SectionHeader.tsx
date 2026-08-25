import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** "What's happening in Durban  →  View all events" */
export function SectionHeader({
  id,
  title,
  href,
  linkLabel,
  children,
}: {
  /** Set when the surrounding section labels itself with aria-labelledby. */
  id?: string;
  title: string;
  href?: string;
  linkLabel?: string;
  /** Optional controls that sit between the title and the link, e.g. tabs. */
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
      <h2 id={id} className="section-title">
        {title}
      </h2>
      {children}
      {href && (
        <Link href={href} className="link-more ml-auto">
          {linkLabel ?? "View all"}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}
