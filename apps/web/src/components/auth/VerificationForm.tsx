"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { LoaderCircle, MailCheck } from "lucide-react";
import { authRequest, buttonClass, inputClass } from "./auth-form";

export function VerificationForm({ token, email: initialEmail = "", delivery: initialDelivery, onChangeEmail }: {
  token?: string; email?: string; delivery?: string; onChangeEmail?: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [requested, setRequested] = useState(Boolean(initialEmail || token));
  const [delivery, setDelivery] = useState(initialDelivery);
  const [busy, setBusy] = useState<"verify" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(initialDelivery ? "Your signup request was accepted." : "");
  const [cooldown, setCooldown] = useState(initialDelivery ? 60 : 0);
  const [code, setCode] = useState("");
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function send(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy || cooldown) return;
    setBusy("send"); setError(null); setNotice("");
    try {
      const result = await authRequest("resend-verification", { email: email.trim().toLowerCase() });
      setEmail(email.trim().toLowerCase()); setDelivery(result.delivery); setRequested(true); setCooldown(60); setCode("");
      setNotice("Request accepted. If this email has a pending account, a fresh code is ready. Only the latest code will work.");
    } catch (error) { setError(error instanceof Error && error.name === "Error" ? error.message : "Couldn't connect. Please try again."); }
    finally { setBusy(null); }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    if (data.get("password") !== data.get("confirmPassword")) { setError("Your passwords don't match."); return; }
    setBusy("verify"); setError(null);
    try {
      await authRequest("verify-email", { ...(token ? { token } : { email, code }), password: data.get("password") });
      // A fresh document resets verification's no-referrer policy for native forms.
      window.location.replace("/login?error=verified");
    } catch (error) { setError(error instanceof Error && error.name === "Error" ? error.message : "Couldn't connect. Please try again."); }
    finally { setBusy(null); }
  }

  return <div>
    <div className="mb-5 inline-flex rounded-xl bg-accent-light p-3 text-accent"><MailCheck aria-hidden className="h-6 w-6" /></div>
    <h2 className="text-3xl font-semibold text-text-primary">{requested ? "Verify your email" : "Get a verification code"}</h2>
    <p className="mt-3 break-words text-sm leading-6 text-text-secondary">{token ? "Confirm ownership and choose your password to activate your account." : requested ? <>Enter the eight-digit code for <strong className="font-medium text-text-primary">{email}</strong>, then choose your password.</> : "Enter the email you used to create your account. We'll send a fresh verification code."}</p>
    {notice && <p role="status" className="mt-4 rounded-md border border-success bg-success-lightest px-4 py-3 text-sm leading-6 text-success-foreground">{notice}</p>}
    {delivery === "local" && <p role="status" className="mt-4 rounded-md border border-border bg-surface-secondary px-4 py-3 text-sm leading-6 text-text-secondary">Development inbox: open the matching email file in <code>data/mail</code> to read your code. Real email delivery is not configured.</p>}
    {!requested ? <form action="/api/auth/resend-verification" method="post" onSubmit={send} aria-busy={Boolean(busy)} className="mt-6 grid gap-4">
      <label htmlFor="verification-email" className="text-sm font-medium text-text-primary">Email</label>
      <input id="verification-email" name="email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} readOnly={Boolean(busy)} className={inputClass} />
      <button disabled={Boolean(busy)} className={buttonClass}>{busy && <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />}{busy ? "Sending code..." : "Send verification code"}</button>
    </form> : <form action="/api/auth/verify-email" method="post" onSubmit={verify} aria-busy={Boolean(busy)} className="mt-6 grid gap-4">
      {token ? <input type="hidden" name="token" value={token} /> : <>
        <input type="hidden" name="email" value={email} />
        <div className="grid gap-2">
          <label htmlFor="code" className="text-sm font-medium text-text-primary">Verification code</label>
          <input id="code" name="code" type="text" inputMode="numeric" pattern="[0-9]{8}" required maxLength={8} autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))} readOnly={Boolean(busy)} aria-describedby="code-hint" className={`${inputClass} text-center text-xl tracking-[0.3em]`} />
          <p id="code-hint" className="text-xs text-text-secondary">Codes expire after 15 minutes. Check your spam folder too.</p>
        </div>
      </>}
      <div className="grid gap-2">
        <label htmlFor="new-password" className="text-sm font-medium text-text-primary">Choose a password</label>
        <input id="new-password" name="password" type="password" required minLength={12} maxLength={256} autoComplete="new-password" readOnly={Boolean(busy)} aria-describedby="new-password-hint" className={inputClass} />
        <p id="new-password-hint" className="text-xs text-text-secondary">Use at least 12 characters.</p>
      </div>
      <div className="grid gap-2">
        <label htmlFor="confirm-password" className="text-sm font-medium text-text-primary">Confirm password</label>
        <input id="confirm-password" name="confirmPassword" type="password" required minLength={12} maxLength={256} autoComplete="new-password" readOnly={Boolean(busy)} className={inputClass} />
      </div>
      <button disabled={Boolean(busy)} className={buttonClass}>{busy === "verify" && <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />}{busy === "verify" ? "Verifying..." : "Verify email & finish signup"}</button>
    </form>}
    {error && <p role="alert" className="mt-4 rounded-md border border-error px-4 py-3 text-sm leading-6 text-error">{error}</p>}
    {requested && !token && <div className="mt-4 flex flex-wrap items-center gap-4">
      <button type="button" onClick={() => void send()} disabled={Boolean(busy) || cooldown > 0} className="min-h-10 text-sm font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:text-text-muted">{busy === "send" ? "Sending..." : cooldown ? `Resend code in ${cooldown}s` : "Resend code"}</button>
      <button type="button" disabled={Boolean(busy)} onClick={() => { if (onChangeEmail) onChangeEmail(); else { setRequested(false); setCooldown(0); setError(null); setNotice(""); setDelivery(undefined); } }} className="min-h-10 text-sm text-text-secondary hover:text-accent">Change email</button>
    </div>}
    <Link href="/login" className="mt-6 inline-block text-sm font-medium text-accent hover:underline">Back to sign in</Link>
  </div>;
}
