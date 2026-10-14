import { ArrowUpRight, Check, FileText, Building2, MapPin } from "lucide-react";
import Link from "next/link";

export function Features() {
  return (
    <section className="marketing-container features-section">
      <h2 className="marketing-heading max-w-2xl">Bring your best.<br />We&apos;ll help with the prep.</h2>
      <p className="mt-5 max-w-xl text-base leading-7 text-text-secondary">Less time starting from scratch. More time deciding where you want to go.</p>
      <div className="feature-grid">
        <article className="feature-panel feature-resume">
          <div className="feature-copy"><FileText aria-hidden="true" className="h-6 w-6 text-accent" /><h3>Same experience.<br />A sharper story.</h3><p>Create a resume that speaks to the role, built from the experience in your profile.</p></div>
          <div className="resume-illustration" aria-label="Illustrative tailored resume"><div className="resume-paper"><span className="resume-avatar" aria-hidden="true">AJ</span><strong>Alex Jordan</strong><span className="text-xs text-text-secondary">Frontend engineer</span><div className="resume-rule" /><p className="text-xs font-semibold">Experience that matters</p><div className="resume-lines" aria-hidden="true"><span /><span /><span /></div><div className="flex flex-wrap gap-2"><span className="skill-chip">React</span><span className="skill-chip">TypeScript</span><span className="skill-chip">Accessibility</span></div><div className="resume-rule" /><div className="resume-lines" aria-hidden="true"><span /><span /></div></div><span className="resume-caption"><Check aria-hidden="true" className="h-4 w-4" /> Tailored to your next opportunity</span></div>
        </article>
        <article className="feature-panel feature-research">
          <div className="feature-copy"><Building2 aria-hidden="true" className="h-6 w-6 text-accent" /><h3>A little research.<br />A lot more context.</h3><p>Explore what a company does and how your background connects before the first conversation.</p></div>
          <div className="research-illustration" aria-label="Illustrative company research"><div className="research-company"><span className="company-monogram" aria-hidden="true">N</span><div><strong>Northstar</strong><p className="mt-1 text-xs text-text-secondary">Example company dossier</p></div></div><div className="research-row"><span>Company overview</span><Check aria-hidden="true" /></div><div className="research-row"><span>Culture & values</span><Check aria-hidden="true" /></div><div className="research-row"><span>Where you fit</span><Check aria-hidden="true" /></div><div className="research-location"><MapPin aria-hidden="true" className="h-4 w-4" /> Context for a better conversation</div></div>
        </article>
      </div>
      <Link href="/register" className="marketing-text-link mt-8">Build your profile <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>
    </section>
  );
}
