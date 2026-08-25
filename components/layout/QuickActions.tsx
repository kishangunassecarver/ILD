import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { QUICK_ACTIONS } from "@/lib/cms";

/** The dark rail of shortcuts directly under the title-partner strip. */
export function QuickActions() {
  return (
    <nav aria-label="Quick actions" className="bg-ink">
      <ul className="shell flex gap-1 overflow-x-auto py-3 no-scrollbar sm:justify-between">
        {QUICK_ACTIONS.map((action) => (
          <li key={action.label} className="shrink-0">
            <Link
              href={action.href}
              className="group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition hover:bg-white/5"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-white transition group-hover:border-brand-400 group-hover:text-brand-400">
                <Icon name={action.icon} className="h-4 w-4" />
              </span>
              <span className="leading-tight">
                <span className="block text-xs font-bold text-white">{action.label}</span>
                <span className="block whitespace-nowrap text-[0.625rem] text-white/55">
                  {action.tagline}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
