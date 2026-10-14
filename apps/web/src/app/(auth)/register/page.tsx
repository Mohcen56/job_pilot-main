import { redirect } from "next/navigation";
import { LoginCard } from "@/components/auth/LoginCard";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getCurrentUser, getPostLoginRedirectPath } from "@/lib/auth";

export const metadata = { title: "Create your account | JobHunt EZ" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const user = await getCurrentUser();
  if (user) redirect(await getPostLoginRedirectPath(user.id));
  const { error } = await searchParams;
  return <><Navbar /><main id="main-content" tabIndex={-1}><LoginCard mode="register" error={typeof error === "string" ? error : undefined} /></main><Footer /></>;
}
