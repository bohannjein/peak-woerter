"use client";

import { startTransition, useActionState } from "react";

/**
 * Like useActionState, but submits via onSubmit so React does not reset the
 * form: on a validation error the user keeps what they typed.
 */
export function useFormAction<S>(fn: (prev: S | null, fd: FormData) => Promise<S>) {
  const [state, dispatch, pending] = useActionState<S | null, FormData>(fn, null);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
  return [state, onSubmit, pending] as const;
}

type State = { ok: boolean; error?: string } | null | undefined;

export function FormError({ state }: { state: State }) {
  if (!state || state.ok || !state.error) return null;
  return (
    <p role="alert" className="rounded-xl border-[1.5px] border-no/60 bg-no/10 px-4 py-3 font-medium">
      {state.error}
    </p>
  );
}

export function FormOk({ state, text }: { state: State; text: string }) {
  if (!state?.ok) return null;
  return (
    <p role="status" className="rounded-xl border-[1.5px] border-yes/60 bg-yes/10 px-4 py-3 font-medium">
      {text}
    </p>
  );
}

/** Large touch-friendly switch backed by a real checkbox. */
export function Toggle({ name, label, hint, defaultChecked }: { name: string; label: string; hint?: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border-[1.5px] border-line p-4 transition-colors hover:border-ink-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
      <span>
        <span className="block font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-sm text-ink-2">{hint}</span>}
      </span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span
        aria-hidden
        className="relative mt-0.5 h-7 w-12 shrink-0 rounded-full bg-table-3 transition-colors after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-yes peer-checked:after:translate-x-5"
      />
    </label>
  );
}
