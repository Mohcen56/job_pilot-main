"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { VerificationForm } from "./VerificationForm";
import { authRequest, buttonClass, inputClass } from "./auth-form";

export function AccountForm({ mode, social, skipVerification = false }: { mode: "login" | "register"; social?: ReactNode; skipVerification?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState<{ email: string; delivery?: string } | null>(null);
  const registering = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim().toLowerCase();
    if (registering && skipVerification && form.get("password") !== form.get("confirmPassword")) { setError("Your passwords don't match."); return; }
    setBusy(true); setError(null);
    try {
      const result = await authRequest(mode, registering && !skipVerification ? { email } : { email, password: form.get("password") });
      if (registering && !result.redirect) setVerification({ email, delivery: result.delivery });
      else window.location.assign(result.redirect === "/dashboard" ? "/dashboard" : "/profile");
    } catch (error) {
      setError(error instanceof Error && error.name === "Error" ? error.message : "Couldn't connect. Please try again.");
    } finally { setBusy(false); }
  }

  if (verification) return <VerificationForm email={verification.email} delivery={verification.delivery} onChangeEmail={() => setVerification(null)} />;

  return <>
    <h2 className="text-3xl font-semibold text-text-primary">{registering ? "Create your account" : "Welcome back"}</h2>
    <p className="mt-3 text-sm leading-6 text-text-secondary">{registering ? (skipVerification ? "Enter your email and choose a password to get started." : "Enter your email to get started. You'll verify it and choose your password in the next step.") : "Sign in to continue your job search."}</p>
    <form action={`/api/auth/${mode}`} method="post" onSubmit={submit} aria-busy={busy} className="mt-6 grid gap-4">
      <div className="grid gap-2">
        <label htmlFor="email" className="text-sm font-medium text-text-primary">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} readOnly={busy} className={inputClass} />
      </div>
      {(!registering || skipVerification) && <div className="grid gap-2">
        <label htmlFor="password" className="text-sm font-medium text-text-primary">Password</label>
        <input id="password" name="password" type="password" autoComplete={registering ? "new-password" : "current-password"} required minLength={12} maxLength={256} readOnly={busy} className={inputClass} />
        {registering && <p className="text-xs text-text-secondary">Use at least 12 characters.</p>}
      </div>}
      {registering && skipVerification && <div className="grid gap-2">
        <label htmlFor="confirm-password" className="text-sm font-medium text-text-primary">Confirm password</label>
        <input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={256} readOnly={busy} className={inputClass} />
      </div>}
      {error && <p role="alert" className="rounded-md border border-error px-4 py-3 text-sm leading-6 text-error">{error}</p>}
      <button type="submit" disabled={busy} className={buttonClass}>
        {busy && <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />}
        {busy ? (registering ? (skipVerification ? "Creating account..." : "Requesting verification...") : "Signing in...") : (registering ? "Create account" : "Sign in")}
      </button>
      {busy && <p role="status" className="text-sm text-text-secondary">{registering ? "Your request is being processed. Please wait." : "Checking your account..."}</p>}
    </form>
    {!registering && !skipVerification && <Link href="/verify-email" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">Need to verify your email?</Link>}
    <p className="mt-6 text-sm text-text-secondary">{registering ? "Already have an account? " : "New to JobHunt EZ? "}<Link href={registering ? "/login" : "/register"} className="font-medium text-accent hover:underline">{registering ? "Sign in" : "Create an account"}</Link></p>
    {social}
  </>;
}
