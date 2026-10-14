import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function CTASection() {
  return <section className="marketing-container cta-section"><div><p className="section-index">Your next chapter starts with one step</p><h2 className="marketing-heading">Let&apos;s find<br /><span className="text-accent">what&apos;s next.</span></h2></div><div className="cta-action"><p>Set up your profile. Find your matches.<br />Give your next move a little direction.</p><Link href="/register" className="landing-button-primary">Get started <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link></div></section>;
}
