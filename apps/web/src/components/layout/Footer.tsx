import Link from "next/link";
import { Logo } from "@/components/layout/Logo";

export function Footer() {
  return <footer className="marketing-footer"><div className="marketing-container footer-inner"><Logo /><nav aria-label="Footer navigation" className="footer-links"><Link href="/dashboard">Dashboard</Link><span className="footer-unavailable" title="Policy has not been published yet">Privacy Policy</span><span className="footer-unavailable" title="Terms have not been published yet">Terms &amp; Condition</span></nav></div></footer>;
}
