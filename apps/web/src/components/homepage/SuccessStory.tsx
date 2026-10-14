import { Check } from "lucide-react";

export function SuccessStory() {
  return (
    <section className="marketing-container confidence-section">
      <div className="confidence-mark" aria-hidden="true"><Check /></div>
      <h2>Your career.<br />Your call.</h2>
      <div className="confidence-copy"><p>Good tools help you make better decisions. They don&apos;t make them for you.</p><ul><li><Check aria-hidden="true" /> Review matches at your own pace</li><li><Check aria-hidden="true" /> Keep your resume in private storage</li><li><Check aria-hidden="true" /> Apply directly on the original job page</li></ul></div>
    </section>
  );
}
