import { ArrowUpRight, FileText, ScanSearch, UserRound } from "lucide-react";

const workflowItems = [
  { Icon: UserRound, title: "Start with your story", description: "Add your experience, skills, and preferred locations. One profile gives every search a better starting point." },
  { Icon: ScanSearch, title: "Find your kind of role", description: "Discover openings from employer career pages and connected job sources. See what fits before you apply." },
  { Icon: FileText, title: "Make it personal", description: "Tailor your resume and research the company. Then head to the original listing when you're ready." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="marketing-container workflow-section">
      <div className="workflow-heading"><span className="section-index">01 / A clearer process</span><h2 className="marketing-heading">From looking.<br />To moving forward.</h2></div>
      <div className="workflow-grid">
        {workflowItems.map(({ Icon, title, description }, index) => <article key={title} className="workflow-item"><div className="flex items-center justify-between"><Icon aria-hidden="true" className="h-6 w-6 text-accent" /><span className="workflow-number">0{index + 1}</span></div><h3 className="mt-8 text-xl font-semibold tracking-tight">{title}</h3><p className="mt-3 text-sm leading-7 text-text-secondary">{description}</p><ArrowUpRight aria-hidden="true" className="mt-6 h-5 w-5 text-text-muted" /></article>)}
      </div>
    </section>
  );
}
