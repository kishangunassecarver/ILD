import Link from "next/link";
import { Heart } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { FOOTER, SITE } from "@/lib/cms";

export function Footer() {
  return (
    <footer className="bg-ink-800 text-white/70">
      <div className="shell grid gap-8 py-10 md:grid-cols-[1.4fr_repeat(4,1fr)] md:gap-6">
        <div className="max-w-xs">
          <Logo tone="dark" />
          <p className="mt-4 text-xs leading-relaxed">{SITE.description}</p>
        </div>

        {FOOTER.map((column) => (
          <nav key={column.heading} aria-label={column.heading}>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-white">
              {column.heading}
            </p>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={link.href + link.label}>
                  <Link href={link.href} className="text-xs transition hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="shell flex flex-wrap items-center justify-between gap-3 py-4 text-xs">
          <p>
            © {new Date().getFullYear()} {SITE.name}. All rights reserved.
          </p>
          <p className="flex items-center gap-1.5">
            Proudly Durban
            <Heart className="h-3.5 w-3.5 fill-brand-500 text-brand-500" aria-hidden />
          </p>
        </div>
      </div>
    </footer>
  );
}
