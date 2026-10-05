"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { useConfirm } from "./ConfirmDialog";

/** A one-button form for a bound server action, with optional confirmation. */
export function ActionButton({
  action,
  confirm,
  className = "btn",
  title,
  children,
}: {
  action: () => Promise<void>;
  confirm?: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const [ask, dialog] = useConfirm();
  const confirmed = useRef(false);

  return (
    <>
      <form
        action={action}
        onSubmit={(e) => {
          if (!confirm || confirmed.current) {
            confirmed.current = false;
            return;
          }
          e.preventDefault();
          const form = e.currentTarget;
          ask(confirm, { danger: className.includes("btn-danger") }).then((ok) => {
            if (!ok) return;
            confirmed.current = true;
            form.requestSubmit();
          });
        }}
        className="contents"
      >
        <SubmitButton className={className} title={title}>
          {children}
        </SubmitButton>
      </form>
      {dialog}
    </>
  );
}

export function SubmitButton({
  className = "btn btn-primary",
  title,
  children,
}: {
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} title={title} aria-label={title}>
      {children}
    </button>
  );
}

export function FormMessage({ error, message }: { error?: string; message?: string }) {
  if (error) return <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>;
  if (message) return <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">{message}</p>;
  return null;
}
