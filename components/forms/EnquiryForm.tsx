"use client";

import { useState } from "react";
import { Check } from "lucide-react";

/**
 * The site's only form primitive.
 *
 * A static export has nowhere to POST to, so submissions are validated by the
 * browser and acknowledged locally. Set `ENDPOINT` to a form handler (a
 * Cloudflare Worker, Formspree, the WordPress REST API) to make it live — the
 * markup and validation stay as they are.
 */
const ENDPOINT: string | null = null;

export interface FieldSpec {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "textarea" | "select";
  required?: boolean;
  placeholder?: string;
  options?: string[];
  /** Half-width on desktop. */
  half?: boolean;
}

export function EnquiryForm({
  fields,
  submitLabel,
  successTitle,
  successBody,
  footnote,
}: {
  fields: FieldSpec[];
  submitLabel: string;
  successTitle: string;
  successBody: string;
  footnote?: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries());

    if (!ENDPOINT) {
      setState("done");
      return;
    }

    setState("sending");
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="panel p-8 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-brand-50">
          <Check className="h-5 w-5 text-brand-500" aria-hidden />
        </span>
        <h3 className="mt-3 text-base font-bold text-ink">{successTitle}</h3>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{successBody}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="panel grid gap-4 p-5 sm:grid-cols-2">
      {fields.map((field) => {
        const id = `field-${field.name}`;
        const spanClass = field.half ? "sm:col-span-1" : "sm:col-span-2";

        return (
          <div key={field.name} className={spanClass}>
            <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-ink">
              {field.label}
              {field.required && <span className="text-brand-500"> *</span>}
            </label>

            {field.type === "textarea" ? (
              <textarea
                id={id}
                name={field.name}
                required={field.required}
                rows={4}
                placeholder={field.placeholder}
                className="field resize-y"
              />
            ) : field.type === "select" ? (
              <select
                id={id}
                name={field.name}
                required={field.required}
                className="field"
                defaultValue=""
              >
                <option value="" disabled>
                  Please choose…
                </option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                name={field.name}
                type={field.type ?? "text"}
                required={field.required}
                placeholder={field.placeholder}
                autoComplete={
                  field.type === "email" ? "email" : field.type === "tel" ? "tel" : undefined
                }
                className="field"
              />
            )}
          </div>
        );
      })}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={state === "sending"}
          className="btn-primary w-full sm:w-auto"
        >
          {state === "sending" ? "Sending…" : submitLabel}
        </button>

        {footnote && (
          <p className="mt-2.5 text-[0.6875rem] leading-relaxed text-muted">{footnote}</p>
        )}

        {state === "error" && (
          <p role="alert" className="mt-2.5 text-xs font-medium text-brand-600">
            That didn&apos;t send. Please try again, or email us directly.
          </p>
        )}
      </div>
    </form>
  );
}
