import Link from "next/link";
import { ArrowDown, ArrowUpRight, BriefcaseBusiness, Check, SlidersHorizontal } from "lucide-react";

const previewJobs = [
  { company: "Northstar", role: "Frontend engineer", location: "Remote", score: 94, initials: "N" },
  { company: "Forma", role: "Product designer", location: "London / Hybrid", score: 88, initials: "F" },
  { company: "Meridian", role: "Software engineer", location: "Remote", score: 82, initials: "M" },
];

export function Hero() {
  return (
    <section className="marketing-hero marketing-container">
      <div className="hero-copy">
        <p className="hero-kicker"><span aria-hidden="true" /> A little clarity for your next chapter</p>
        <h1>Less searching.<br /><span className="text-accent">More possibility.</span></h1>
        <p className="hero-description">Find jobs that fit, tailor your resume, and make your next move with confidence.</p>
        <div className="hero-actions">
          <Link href="/register" className="landing-button-primary">Get started <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>
          <a href="#how-it-works" className="marketing-text-link">See how it works <ArrowDown aria-hidden="true" className="h-4 w-4" /></a>
        </div>
      </div>
      <div className="hero-product-stage">
        <div className="product-orbit" aria-hidden="true" />
        <div className="product-preview" aria-label="Illustrative job matches preview">
          <div className="preview-topbar"><span className="inline-flex items-center gap-2 font-semibold"><BriefcaseBusiness aria-hidden="true" className="h-4 w-4 text-accent" /> Your next move</span><span className="preview-label">Example workspace</span></div>
          <div className="preview-content">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs text-text-secondary">A shortlist worth your time</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Your job matches</h2></div><SlidersHorizontal aria-hidden="true" className="mt-2 h-5 w-5 text-text-secondary" /></div>
            <div className="preview-tabs"><span className="preview-tab-active">Best matches</span><span>Recently found</span><span>Saved</span></div>
            <div className="preview-jobs">
              {previewJobs.map((job) => <div key={job.company} className="preview-job"><span className="company-monogram" aria-hidden="true">{job.initials}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{job.role}</p><p className="mt-1 text-xs text-text-secondary">{job.company} <span className="mx-1">/</span> {job.location}</p></div><div className="preview-score"><strong>{job.score}%</strong><span>match</span></div></div>)}
            </div>
            <div className="preview-footer"><span className="inline-flex items-center gap-2"><Check aria-hidden="true" className="h-4 w-4 text-accent" /> Based on your profile</span><span className="text-accent">3 matches</span></div>
          </div>
        </div>
        <div className="preview-note"><span className="preview-note-icon"><Check aria-hidden="true" className="h-5 w-5" /></span><div><strong>A stronger first impression.</strong><p>Your experience, tailored to the role.</p></div></div>
      </div>
    </section>
  );
}
