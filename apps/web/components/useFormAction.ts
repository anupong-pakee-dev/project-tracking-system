"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { FormState } from "@/lib/actions";

/**
 * Like useActionState, but submits via onSubmit so React doesn't auto-reset the form —
 * a validation error keeps whatever the user typed.
 */
export function useFormAction(action: (state: FormState, fd: FormData) => Promise<FormState>) {
  const [state, dispatch, pending] = useActionState(action, {});
  const submit = (fd: FormData) => startTransition(() => dispatch(fd));
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit(new FormData(e.currentTarget));
  };
  return { state, onSubmit, submit, pending };
}
