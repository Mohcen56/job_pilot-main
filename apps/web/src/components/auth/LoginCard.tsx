import { GitBranch, Globe, ShieldCheck } from "lucide-react";
import { AccountForm } from "./AccountForm";
import { skipEmailVerification } from "@/lib/auth-settings";

const errorMessages: Record<string, string> = {
  callback: "We couldn't finish signing you in. Please try again.",
  oauth: "That sign-in method is unavailable. Please use email.",
  provider: "That sign-in method is not available.",
  "check-email": "Open email verification to finish creating your account.",
  verified: "Your email is verified. Sign in with your new password.",
  verification: "Request a new code from the verification page.",
  credentials: "Check your email and password. Make sure your email is verified.",
  register: "We couldn't start signup. Enter a valid email and try again.",
};

export function LoginCard({ error, mode = "login" }: { error?: string; mode?: "login" | "register" }) {
  const message = error ? errorMessages[error] : null;
  const google = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const github = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
  const social = google || github ? <div className="mt-6 border-t border-border pt-6">
    <p className="mb-3 text-center text-xs text-text-secondary">Or continue with</p>
    <div className="grid gap-3">
      {[{ id: "google", label: "Google", enabled: google, Icon: Globe }, { id: "github", label: "GitHub", enabled: github, Icon: GitBranch }].filter(item => item.enabled).map(({ id, label, Icon }) =>
        <a key={id} href={`/api/auth/oauth/${id}`} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-primary hover:bg-surface-secondary focus-visible:outline-accent">
          <Icon aria-hidden className="h-5 w-5" />Continue with {label}
        </a>)}
    </div>
  </div> : null;
  return <section className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-[1440px] items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
    <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-surface shadow-card lg:grid-cols-2">
      <div className="auth-story landing-hero-glow hidden flex-col justify-between border-r border-border p-10 lg:flex">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-secondary"><ShieldCheck aria-hidden className="h-4 w-4 text-accent" />JobHunt EZ</div>
          <h1 className="mt-8 text-5xl font-semibold leading-tight tracking-tight text-text-primary">Your next opportunity starts here.</h1>
          <p className="mt-6 text-base leading-7 text-text-secondary">Find jobs that fit, build a stronger resume, and prepare for your next move.</p>
        </div>
        <div className="auth-steps"><div className="auth-step"><span>01</span> A profile that tells your story</div><div className="auth-step"><span>02</span> Opportunities that fit your skills</div><div className="auth-step"><span>03</span> A little more confidence to apply</div></div>
      </div>
      <div className="p-6 sm:p-10">
        {message && <p role={error === "verified" || error === "check-email" ? "status" : "alert"} className={`mb-6 rounded-md border px-4 py-3 text-sm leading-6 ${error === "verified" ? "border-success text-success-foreground bg-success-lightest" : "border-border text-text-secondary"}`}>{message}</p>}
        <AccountForm key={mode} mode={mode} social={social} skipVerification={skipEmailVerification()} />
      </div>
    </div>
  </section>;
}
