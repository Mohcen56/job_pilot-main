import { CTASection } from "@/components/homepage/CTASection";
import { Features } from "@/components/homepage/Features";
import { Hero } from "@/components/homepage/Hero";
import { HowItWorks } from "@/components/homepage/HowItWorks";
import { SuccessStory } from "@/components/homepage/SuccessStory";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

export default function HomePage() {
  return <><Navbar /><main id="main-content" tabIndex={-1} className="marketing-page"><Hero /><HowItWorks /><Features /><SuccessStory /><CTASection /></main><Footer /></>;
}
