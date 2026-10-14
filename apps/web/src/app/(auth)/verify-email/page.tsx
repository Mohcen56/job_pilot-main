import { Navbar } from "@/components/layout/Navbar";
import { VerificationForm } from "@/components/auth/VerificationForm";
import { redirect } from "next/navigation";
import { skipEmailVerification } from "@/lib/auth-settings";
export const dynamic = "force-dynamic";
export const metadata = { title: "Verify your email | JobHunt EZ", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; email?: string }> }) {
  if (skipEmailVerification()) redirect("/register");
  const { token, email } = await searchParams;
  const validToken = typeof token === "string" && /^[a-f0-9]{64}$/.test(token) ? token : undefined;
  const validEmail = typeof email === "string" && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
  return <><Navbar /><main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-lg px-4 py-10">
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">
      {token && !validToken && <p role="alert" className="mb-5 text-sm leading-6 text-error">This link is invalid. Request a new code below.</p>}
      <VerificationForm token={validToken} email={validEmail} />
    </section>
  </main></>;
}
