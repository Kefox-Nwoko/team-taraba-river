import React from "react";
import {
  X,
  Shield,
  CheckCircle2,
  BookOpen,
  Star,
  Users,
  Heart,
  Scale,
  Gavel,
  Lock,
  FileText,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  Cake,
  HardDrive,
} from "lucide-react";

interface TermsAndConditionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsAndConditionsModal: React.FC<TermsAndConditionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center font-normal">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-4xl max-h-[90vh] mx-4 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">

        {/* Header */}
        <div className="shrink-0 px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-teal-50 to-slate-50 dark:from-teal-950/40 dark:to-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/60 flex items-center justify-center">
              <Shield className="w-5 h-5 text-teal-700 dark:text-teal-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
                Terms and Conditions
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Team Taraba River · Master Member Agreement &amp; Privacy Policy · v2.1 (August 2026)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-500 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="max-w-none text-slate-600 dark:text-slate-300 space-y-7">

            {/* Preamble */}
            <section className="bg-gradient-to-br from-teal-50 to-slate-50 dark:from-teal-950/20 dark:to-slate-800/30 p-6 rounded-2xl border border-teal-100 dark:border-teal-900/40">
              <div className="flex items-start gap-3">
                <BookOpen className="w-5 h-5 text-teal-600 dark:text-teal-400 mt-0.5 shrink-0" />
                <div className="space-y-3 text-sm leading-relaxed">
                  <p>
                    Welcome to the <strong className="text-slate-800 dark:text-white">Team Taraba River Portal</strong> — the official digital community platform of <strong className="text-slate-800 dark:text-white">Team Taraba River</strong>, a fellowship group under the umbrella of <strong className="text-slate-800 dark:text-white">URIP (Usosans Resident in Port Harcourt)</strong>, a recognized chapter of the <strong className="text-slate-800 dark:text-white">Unity Schools Old Students Association (USOSA)</strong>.
                  </p>
                  <p>
                    USOSA is the umbrella alumni body for all 115 Federal Unity Colleges across Nigeria — institutions founded to foster national integration, moral and academic excellence, and detribalized citizenship. Operating within this proud tradition, Team Taraba River unites members for community fellowship, professional networking, social outings, mutual support, and civic impact in Rivers State and across the diaspora.
                  </p>
                  <p>
                    This platform is <strong className="text-slate-800 dark:text-white">owned and managed exclusively by Team Taraba River</strong>. By registering, signing in, or accessing this portal in any capacity, you enter into a legally binding agreement under the <strong>Nigeria Data Protection Act (NDPA) 2023</strong>, the <strong>Cybercrimes (Prohibition, Prevention, etc.) Act 2015 (as amended 2024)</strong>, and applicable international data governance standards.
                  </p>
                  <div className="p-3.5 rounded-xl bg-teal-100/60 dark:bg-teal-900/40 border border-teal-200 dark:border-teal-800 text-xs text-teal-900 dark:text-teal-200 font-medium">
                    💡 <strong>Plain English Summary:</strong> This portal is an exclusive, secure space for verified members of Team Taraba River. By using it, you agree to treat fellow members with dignity, safeguard community privacy, uphold our shared values of unity and integrity, and comply with Nigerian law.
                  </div>
                </div>
              </div>
            </section>

            {/* Document Changelog */}
            <section className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-5 rounded-2xl">
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4" />
                Document Revision History &amp; Modifications
              </h3>
              <div className="text-xs text-amber-900 dark:text-amber-200 space-y-2 leading-relaxed">
                <p>
                  <strong>v2.1 — August 2026 (Current):</strong> Comprehensive technical &amp; legal update. Added explicit disclosures for:
                  (1) Automated Birthday Reminders &amp; Backend Scheduler Engine;
                  (2) Cloud Media Pipeline with YouTube Transcoding &amp; Google Drive Synchronization;
                  (3) AI Knowledge Assistant (AI Xplora) Terms &amp; Advisory Disclaimers;
                  (4) Privacy-First 30-Minute Deduplication Analytics;
                  (5) Nigeria Data Protection Act (NDPA) 2023 Statutory Rights &amp; Cross-Border Cloud Processing Guarantees; and
                  (6) Binding Dispute Resolution seated in Port Harcourt, Rivers State under the Arbitration and Mediation Act 2023.
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  <em>v2.0 — August 2026:</em> Initial comprehensive Master Member Agreement review.
                </p>
              </div>
            </section>

            {/* Section 1 */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                1. Membership Eligibility, Registration &amp; Verification
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                <li>Membership on this portal is restricted to verified alumni of Federal Unity Colleges resident in Port Harcourt (URIP) and accredited members of Team Taraba River.</li>
                <li>Members must provide accurate and truthful personal information during registration (including Full Legal Name, School, Graduation Year, Contact Telephone, Valid Email, and Next of Kin). Willful falsification of identity violates these Terms and the Cybercrimes Act 2015.</li>
                <li>You must be at least <strong className="text-slate-700 dark:text-slate-200">18 years of age</strong> to register an account. By registering, you warrant that you meet this age requirement under Nigerian law.</li>
                <li>Profile photos and media assets undergo administrative moderation to ensure decency before public display. Photographs deemed vulgar, offensive, or misleading will be rejected without prior notice.</li>
                <li>By registering, you affirm that you are a person of good character and commit to upholding the values of unity, integrity, and fraternity.</li>
              </ul>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Star className="w-4 h-4 text-teal-600 shrink-0" />
                2. Code of Conduct &amp; USOSA Values
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                <li>All members must embody the core values of USOSA and Team Taraba River: mutual respect, detribalized brotherhood, zero discrimination (ethnic, religious, gender, or social), and active community support.</li>
                <li>All content shared on the platform (comments, photos, announcements) must be constructive, decent, and free from inflammatory, defamatory, or offensive rhetoric.</li>
                <li>Any conduct that brings Team Taraba River, URIP, or USOSA into disrepute — online or at in-person events — may result in administrative sanction or removal.</li>
              </ul>

              {/* 2.1 Prohibited Activities */}
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl">
                <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  2.1 Strictly Prohibited Activities
                </h4>
                <p className="text-xs text-red-900 dark:text-red-200 mb-2">The following actions are strictly prohibited and result in immediate account suspension, point forfeiture, and possible legal referral:</p>
                <ul className="list-disc pl-5 space-y-1 text-xs text-red-800 dark:text-red-200 marker:text-red-500">
                  <li>Harassment, cyberbullying, intimidation, or threatening behavior toward any member.</li>
                  <li>Dissemination of defamatory, obscene, sexually explicit, or politically inciting material.</li>
                  <li>Impersonating another person, chapter official, or portal administrator.</li>
                  <li>Unauthorized web scraping, automated bot data extraction, or harvesting member contact directories.</li>
                  <li>Commercial spamming, unsolicited financial solicitations, pyramid schemes, or fraudulent activities.</li>
                  <li>Doxing or unauthorized sharing of another member's confidential residential or personal information.</li>
                  <li>Interfering with, hacking, or attempting to breach the security tokens or infrastructure of the portal.</li>
                </ul>
              </div>

              {/* 2.2 Appeals Process */}
              <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2">
                  <Scale className="w-4 h-4 text-teal-600" />
                  2.2 Administrative Actions &amp; Appeals Process
                </h4>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  Administrative sanctions (warnings, feature restrictions, content removal, or account suspension) may be appealed by submitting a written request to the Team Lead within <strong>14 calendar days</strong> of the action. Appeals are reviewed by an independent panel of at least two administrators not involved in the original determination. A final, binding written decision will be delivered within <strong>7 business days</strong>.
                </p>
              </div>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600 shrink-0" />
                3. Event Participation, Safety &amp; Community Rules
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                <li>Team Taraba River gatherings are organized for fellowship, recreational sports, professional development, and community impact. Members are encouraged to attend regularly and in good spirit.</li>
                <li><strong>RSVP Commitment:</strong> An event RSVP represents a binding logistical commitment. Excessive no-shows without timely prior notification disrupt planning and may result in activity point deductions.</li>
                <li>Members are expected to uphold standards of safety and decency at all physical events. Endangering others or causing disruption will result in immediate event ejection.</li>
              </ul>

              {/* 3.1 Event Safety & Media Consent */}
              <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2">
                  <Heart className="w-4 h-4 text-teal-600" />
                  3.1 Safety, Emergency Care &amp; General Media Consent
                </h4>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-700 dark:text-slate-300 marker:text-slate-400">
                  <li>By attending physical events, members acknowledge inherent physical risks associated with sports or outdoor activities and agree to abide by safety directives.</li>
                  <li>Next-of-Kin information provided during registration is encrypted and accessed exclusively during on-site health or safety emergencies.</li>
                  <li>Attendance at official events constitutes permission for official photographers to capture images and video footage for community archives and recaps, unless a member submits a prior written objection.</li>
                </ul>
              </div>

              {/* 3.2 Media Review Timeline */}
              <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-teal-600" />
                  3.2 Media Submission &amp; Moderation Timeline
                </h4>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  Member-submitted media albums and video clips undergo administrative review within <strong>5 business days</strong>. If rejected, a brief constructive rationale is provided. Approved media is published to official event galleries.
                </p>
              </div>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-teal-600 shrink-0" />
                4. Content, Media Pipeline &amp; YouTube Integration
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                <li><strong>Ownership:</strong> Members retain full copyright and ownership in original photographs and video clips they upload to the portal.</li>
                <li><strong>Community Media License:</strong> By uploading media to event albums or video repositories, you grant Team Taraba River a <strong className="text-slate-700 dark:text-slate-200">non-exclusive, royalty-free, worldwide, transferable license</strong> to host, transcode, display, and publish the media for community archives, event recaps, and video streaming on official YouTube and Google Drive repositories.</li>
                <li><strong>Content Representations:</strong> You warrant that all media you submit is your original creation or that you possess all necessary releases and permissions, and that the content does not infringe on third-party intellectual property or privacy rights.</li>
                <li><strong>Takedown Procedure (Copyright Compliance):</strong> Any party asserting copyright infringement may submit a formal takedown request containing: (a) proof of copyrighted ownership, (b) specific link/URL to the infringing material, and (c) full contact information. Valid takedown notices are processed within <strong>48 hours</strong>.</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-teal-600 shrink-0" />
                5. Privacy Policy &amp; Nigeria Data Protection Act (NDPA) 2023 Compliance
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                <li><strong>Data Controller:</strong> Team Taraba River acts as the Data Controller under the <strong>Nigeria Data Protection Act (NDPA) 2023</strong>.</li>
                <li><strong>Public Member Directory:</strong> Only authenticated, verified members of Team Taraba River can view directory profiles (Full Name, Unity School, Graduation Year, Occupation, Skills, and Photo).</li>
                <li><strong>Protected Administrative Data:</strong> Sensitive records (Phone Number, Email, Residential Address, Next of Kin, and Birth Dates) are encrypted and restricted strictly to authorized administrative workflows.</li>
                <li><strong>Zero-Sale Guarantee:</strong> Member data is <strong className="text-slate-700 dark:text-slate-200">never sold, leased, rented, or commercialized</strong> to third-party advertisers, data brokers, or political organizations.</li>
              </ul>

              {/* 5.1 Automated Birthday Reminder Processing */}
              <div className="mt-4 p-4 bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/40 rounded-xl">
                <h4 className="text-sm font-semibold text-teal-800 dark:text-teal-300 flex items-center gap-2 mb-2">
                  <Cake className="w-4 h-4 text-teal-600" />
                  5.1 Automated Birthday Reminder Processing
                </h4>
                <p className="text-xs text-teal-900 dark:text-teal-200 leading-relaxed">
                  The portal operates an automated background scheduling engine that runs daily at <strong>12:00 PM WAT</strong>. The engine processes member birth dates (<strong>Day and Month only — birth year is never collected, stored, or displayed</strong>) to generate monthly advance planning digests and daily 24-hour eve reminders. Notifications are dispatched securely via transactional email (Resend) to official team administrators (<code>tarabateam@gmail.com</code>) strictly for community felicitations and WhatsApp announcements.
                </p>
              </div>

              {/* 5.2 NDPA 2023 Statutory Rights & Breach SLA */}
              <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-teal-600" />
                  5.2 Statutory Rights, Cross-Border Transfers &amp; Breach SLA
                </h4>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-700 dark:text-slate-300 marker:text-slate-400">
                  <li><strong>Cross-Border Cloud Infrastructure:</strong> In compliance with Sections 41–43 of the NDPA 2023, data stored on Google Cloud Firebase and associated infrastructure is protected by enterprise AES-256 encryption at rest and TLS 1.3 in transit within ISO 27001 certified data centers.</li>
                  <li><strong>Member Statutory Rights:</strong> Members have the right to request access to their data, immediate correction of inaccurate details, data portability, and permanent account deletion (&quot;Right to Erasure&quot;), executed within <strong>30 calendar days</strong>.</li>
                  <li><strong>Breach Notification SLA:</strong> In the unlikely event of a verified data breach affecting personal records, Team Taraba River will notify affected members and the <strong>Nigeria Data Protection Commission (NDPC)</strong> within <strong>72 hours</strong> of formal confirmation.</li>
                </ul>
              </div>
            </section>

            {/* Section 6 */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                6. Local Storage, Cookies &amp; Analytics Transparency
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                <li><strong>No Third-Party Tracking:</strong> The portal does not employ third-party tracking pixels, advertising beacons, or invasive biometric profiling cookies.</li>
                <li><strong>Local Storage Utilization:</strong> Standard browser <code>localStorage</code> and <code>sessionStorage</code> are used exclusively for:
                  (a) maintaining secure authenticated member sessions,
                  (b) storing Light/Dark theme preferences,
                  (c) local directory caching for low-bandwidth resilience, and
                  (d) executing the 30-minute anti-spam deduplication gate for authentic community metrics (as documented in our Analytics Methodology).</li>
              </ul>
            </section>

            {/* Section 7 */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600 shrink-0" />
                7. AI Knowledge Assistant (AI Xplora)
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                <li><strong>Informational &amp; Search Purpose:</strong> The AI Xplora assistant processes public community archives, USOSA school histories, and member professional skills to facilitate search, knowledge retrieval, and alumni discovery.</li>
                <li><strong>Disclaimer of Professional Warranty:</strong> AI-generated suggestions, summaries, and search matches are advisory. Members are responsible for conducting independent due diligence before entering into professional or commercial agreements.</li>
              </ul>
            </section>

            {/* Section 8 */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Heart className="w-4 h-4 text-teal-600 shrink-0" />
                8. Activity Points &amp; Community Recognition
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                <li><strong>Fellowship Currency:</strong> Activity points (earned for portal exploration, AI research, skill searches, media uploads, verification, and event RSVPs) serve solely as non-monetary community incentives.</li>
                <li><strong>No Cash Value:</strong> Points carry <strong className="text-slate-700 dark:text-slate-200">zero monetary cash value</strong>, cannot be traded, sold, or transferred, and do not constitute personal property.</li>
                <li><strong>Audit &amp; Revocation:</strong> Team Taraba River reserves the right to audit, adjust, or revoke points obtained through bot scripts, exploits, or violations of these Terms without liability.</li>
              </ul>
            </section>

            {/* Section 9 */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-teal-600 shrink-0" />
                9. Account Security &amp; Member Responsibility
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                <li>Members are responsible for maintaining the confidentiality of their login credentials and devices. You must not share your account access with third parties.</li>
                <li>You agree to immediately report any suspected unauthorized access or security breach to administrators. Team Taraba River is not liable for losses resulting from member credential negligence.</li>
              </ul>
            </section>

            {/* Section 10 */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <X className="w-4 h-4 text-teal-600 shrink-0" />
                10. Termination, Suspension &amp; Account Deactivation
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                <li>Team Taraba River reserves the right to suspend or terminate accounts for violations of these Terms, community disruption, or legal non-compliance.</li>
                <li>Members may request voluntary account deactivation at any time. Upon deactivation, public profile visibility is revoked within <strong>7 business days</strong>, and non-archival PII is permanently purged within <strong>90 days</strong> in line with NDPA guidelines.</li>
              </ul>
            </section>

            {/* Section 11 */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-teal-600 shrink-0" />
                11. Limitation of Liability &amp; Disclaimers
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                <li>This portal is provided on an <strong>&quot;As Is&quot;</strong> and <strong>&quot;As Available&quot;</strong> basis without express or implied warranties of continuous uptime.</li>
                <li>To the fullest extent permitted under Nigerian law, Team Taraba River, USOSA, URIP, and their respective officers and volunteer administrators shall not be liable for any indirect, incidental, special, or consequential damages resulting from portal downtime or member interactions.</li>
                <li>Our total aggregate liability for any claim arising from portal usage shall not exceed the amount paid by the member, if any, for portal services during the preceding twelve (12) months.</li>
              </ul>
            </section>

            {/* Section 12 */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-teal-600 shrink-0" />
                12. Third-Party Services
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                <li>The platform integrates with secure third-party infrastructure providers, including Google Cloud Firebase, YouTube APIs, Google Drive, and Resend email services.</li>
                <li>These services are governed by their respective enterprise terms of service and privacy policies. Team Taraba River is not responsible for the independent operation or third-party outages of external providers.</li>
              </ul>
            </section>

            {/* Section 13 */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Gavel className="w-4 h-4 text-teal-600 shrink-0" />
                13. Dispute Resolution &amp; Governing Law
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                <li>These Terms are governed exclusively by the <strong>laws of the Federal Republic of Nigeria</strong>.</li>
                <li>Any dispute arising from these Terms shall first be submitted to good-faith informal mediation with the Team Taraba River Executive Council within <strong>30 calendar days</strong>.</li>
                <li>Unresolved disputes shall be referred to and finally resolved by arbitration under the <strong>Arbitration and Mediation Act 2023 (Nigeria)</strong> by a sole arbitrator seated in <strong>Port Harcourt, Rivers State, Nigeria</strong>. The language of arbitration shall be English.</li>
                <li>Nothing in this section restricts either party from seeking urgent injunctive relief from a competent court in Port Harcourt, Rivers State.</li>
              </ul>
            </section>

            {/* Section 14 */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                14. General Provisions
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                <li><strong>Entire Agreement:</strong> These Terms constitute the complete understanding between the member and Team Taraba River regarding portal usage.</li>
                <li><strong>Severability:</strong> If any provision is deemed unenforceable by a court of competent jurisdiction, the remaining provisions remain in full force and effect.</li>
                <li><strong>Force Majeure:</strong> Team Taraba River is not liable for failure to perform resulting from causes beyond reasonable control (natural disasters, network disruptions, civil unrest, or statutory embargoes).</li>
              </ul>
            </section>

            {/* Section 15 */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600 shrink-0" />
                15. Amendments, Communications &amp; Official Contact
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                <li>Team Taraba River reserves the right to amend these Terms to reflect community developments or statutory updates. Material changes are published on the portal. Continued access constitutes acceptance.</li>
                <li>Official inquiries, data subject access requests, or privacy concerns should be directed to the official administration email: <code className="text-teal-700 dark:text-teal-300 font-medium">tarabateam@gmail.com</code>.</li>
              </ul>
            </section>

            {/* Signature Block */}
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700/50">
              <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
                <div className="text-sm text-slate-500 dark:text-slate-400 space-y-1">
                  <p className="font-medium text-slate-700 dark:text-slate-300">Team Taraba River Community Portal</p>
                  <p>Under URIP — Usosans Resident in Port Harcourt</p>
                  <p>Unity Schools Old Students Association (USOSA)</p>
                  <p className="text-xs italic">Port Harcourt, Rivers State, Nigeria</p>
                </div>
                <div className="flex flex-col items-end text-right">
                  <p
                    className="text-teal-700 dark:text-teal-400 mb-1 font-bold"
                    style={{ fontFamily: "Georgia, serif", fontSize: "1.4rem", letterSpacing: "0.04em", fontStyle: "italic" }}
                  >
                    Dr. N. Okonkwo
                  </p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Signed: Dr. Nneka Okonkwo
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Lead, Team Taraba River
                  </p>
                  <p className="text-xs font-medium text-teal-700 dark:text-teal-400 mt-1">
                    11 August 2026 (Original)
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Updated: August 2026 (Version 2.1 Technical &amp; Legal Review)
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Protected under NDPA 2023 &amp; USOSA Code of Conduct
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-medium text-sm transition-colors shadow-sm cursor-pointer"
          >
            I Understand &amp; Agree
          </button>
        </div>

      </div>
    </div>
  );
};
