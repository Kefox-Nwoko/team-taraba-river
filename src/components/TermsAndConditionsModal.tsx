import React from "react";
import { X, Shield, CheckCircle2, BookOpen, Star, Users, Heart, Scale, Gavel, Lock, FileText, AlertTriangle, ExternalLink } from "lucide-react";

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
                Team Taraba River · Master Member Agreement · v2.0 (August 2026)
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

            {/* [AMENDED] Preamble */}
            <section className="bg-gradient-to-br from-teal-50 to-slate-50 dark:from-teal-950/20 dark:to-slate-800/30 p-6 rounded-2xl border border-teal-100 dark:border-teal-900/40">
              <div className="flex items-start gap-3">
                <BookOpen className="w-5 h-5 text-teal-600 dark:text-teal-400 mt-0.5 shrink-0" />
                <div className="space-y-3 text-sm leading-relaxed">
                  <p>
                    Welcome to the <strong className="text-slate-800 dark:text-white">Team Taraba River Portal</strong> — the official digital community platform of <strong className="text-slate-800 dark:text-white">Team Taraba River</strong>, a group under the umbrella of <strong className="text-slate-800 dark:text-white">URIP (Usosans Resident in Port Harcourt)</strong>, which is itself a chapter of the <strong className="text-slate-800 dark:text-white">Unity Schools Old Students Association (USOSA)</strong>.
                  </p>
                  <p>
                    USOSA is the umbrella alumni body for all 115 Federal Unity Colleges across Nigeria — institutions founded to foster national unity, academic excellence, and detribalized Nigerian citizenship. Team Taraba River, operating within that proud tradition, is a Port Harcourt-based fellowship group that brings its members together for fun, community support, professional networking, and the celebration of life as old students.
                  </p>
                  <p>
                    This portal is <strong className="text-slate-800 dark:text-white">owned and managed exclusively by Team Taraba River</strong>. By registering as a member, or by accessing or using this portal in any capacity, you agree to be bound by these Terms and Conditions, which encompass our Privacy Policy, Code of Conduct, and Event &amp; Community Rules.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    {/* [NEW] Explicit acceptance clause */}
                    Your registration, continued access, or use of this portal constitutes unconditional acceptance of these Terms. If you do not agree with any part of these terms, you must not use this portal.
                  </p>
                </div>
              </div>
            </section>

            {/* [NEW] Changelog */}
            <section className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-5 rounded-2xl">
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4" />
                Document Revision History &amp; Modifications
              </h3>
              <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1.5 leading-relaxed">
                <p><strong>v2.0 — August 2026:</strong> Comprehensive review and update. Added: Prohibited Activities; Content, Media &amp; Intellectual Property rights; Account Security; Termination, Suspension &amp; Deactivation; Limitation of Liability; Dispute Resolution &amp; Governing Law (Nigeria); Third-Party Services disclaimer; General Provisions (severability, force majeure); Official Communications channel; explicit acceptance clause; Nigerian Data Protection Act alignment; appeal process for administrative actions; media approval timeline; data breach notification; right to data export/deletion; event safety acknowledgment; points revocation policy; and contact/notification methods. All additions are marked with <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">[NEW]</code> or <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">[AMENDED]</code> inline.</p>
              </div>
            </section>

            {/* Section 1 */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                1. Membership Eligibility &amp; Requirements
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                <li>Membership on this portal is open to all verified members of <strong className="text-slate-700 dark:text-slate-200">Team Taraba River</strong> — comprising USOSA alumni and invited associates resident in or connected to Port Harcourt.</li>
                <li>Members must provide accurate and truthful personal information at the point of registration, including a valid phone number and email address. This information must be kept up-to-date at all times.</li>
                {/* [AMENDED] Added explicit age requirement */}
                <li>You must be at least <strong className="text-slate-700 dark:text-slate-200">18 years of age</strong> to register for and use this portal. By registering, you represent and warrant that you meet this age requirement.</li>
                <li>Profile photos are subject to mandatory review and approval by Team Taraba River administrators before being publicly displayed. Photos deemed inappropriate will be rejected without prior notice.</li>
                <li>By registering, you affirm that you are a person of good character and that you uphold the values of integrity, unity, and respectful conduct expected of every member of Team Taraba River.</li>
              </ul>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Star className="w-4 h-4 text-teal-600 shrink-0" />
                2. Code of Conduct &amp; USOSA Values
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                <li>All members are expected to embody the values of <strong className="text-slate-700 dark:text-slate-200">Team Taraba River</strong>: unity, integrity, respect for all backgrounds, community service, and joyful fellowship. These are non-negotiable pillars of membership.</li>
                <li>Treat every member with respect regardless of their ethnic background, religious belief, gender, or professional standing. Discrimination or tribalism of any form is strictly prohibited.</li>
                <li>All content shared on this portal (photos, event posts, media) must be decent, constructive, and free from defamatory, inflammatory, or offensive material.</li>
                {/* [AMENDED] Added specific prohibited activities */}
                <li>Any conduct that brings Team Taraba River or USOSA into disrepute — whether online or at in-person events — may result in suspension or removal from the platform at the sole discretion of Team Taraba River administrators.</li>
                <li>Members are encouraged to support the local communities of Port Harcourt and Rivers State through volunteering, mentorship, and social initiatives, consistent with the group's spirit of giving back.</li>
              </ul>

              {/* [NEW] Prohibited Activities Subsection */}
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl">
                <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  2.1 Prohibited Activities
                </h4>
                <p className="text-xs text-red-900 dark:text-red-200 mb-2">The following activities are strictly prohibited on this portal and may result in immediate suspension, account termination, or referral to appropriate authorities:</p>
                <ul className="list-disc pl-5 space-y-1 text-xs text-red-800 dark:text-red-200 marker:text-red-500">
                  <li>Harassment, intimidation, bullying, or threatening behavior toward any member.</li>
                  <li>Posting defamatory, obscene, pornographic, or hate speech content.</li>
                  <li>Impersonating another person, entity, or Team Taraba River administrator.</li>
                  <li>Unauthorized scraping, data mining, or bulk extraction of member data.</li>
                  <li>Spamming, phishing, or distributing malicious software or links.</li>
                  <li>Using the portal to organize or promote unauthorized commercial activities, scams, or fraudulent schemes.</li>
                  <li>Sharing or attempting to share another member's private information (doxing).</li>
                  <li>Interfering with or disrupting the integrity or performance of the portal.</li>
                </ul>
              </div>

              {/* [NEW] Appeals Process */}
              <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2">
                  <Scale className="w-4 h-4 text-teal-600" />
                  2.2 Administrative Actions &amp; Appeals
                </h4>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {/* [NEW] */}
                  Administrative actions (warnings, content removal, suspension, or termination) may be appealed by submitting a written request to the Team Taraba River lead within <strong>14 days</strong> of the action. Appeals will be reviewed by a panel of at least two administrators not involved in the original decision. The decision of the appeal panel is final. Members will be notified of the outcome within <strong>7 business days</strong>.
                </p>
              </div>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600 shrink-0" />
                3. Event Participation &amp; Community Rules
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                <li>Team Taraba River gatherings are a time for fellowship, fun, celebration, and constructive engagement. Members are encouraged to attend events regularly and in good spirit.</li>
                {/* [AMENDED] Added specific no-show notification requirement */}
                <li>When you RSVP to an event, you are making a commitment to attend. Excessive no-shows without <strong className="text-slate-700 dark:text-slate-200">prior notification</strong> to the event organizer reflect poorly on the group and may affect your standing and activity points.</li>
                <li>Events may include social outings, sports activities, educational forums, community service initiatives, and celebratory gatherings — all organized in the spirit of fun, unity, and fellowship.</li>
                <li>Members wishing to share event photos or videos may submit high-resolution media albums or videos. Submissions are reviewed by Team Taraba River administrators before featured placement.</li>
                {/* [AMENDED] Added safety and emergency provisions */}
                <li>Members are expected to uphold decency and safety at all physical events. Behavior that endangers others, causes disruption, or embarrasses the group will not be tolerated.</li>
              </ul>

              {/* [NEW] Event Safety & Emergency */}
              <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2">
                  <Heart className="w-4 h-4 text-teal-600" />
                  3.1 Safety, Emergencies &amp; Media Consent
                </h4>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-700 dark:text-slate-300 marker:text-slate-400">
                  {/* [NEW] */}
                  <li>By attending any Team Taraba River physical event, you acknowledge that participation in certain activities may carry inherent risks. You agree to follow all safety instructions provided by event organizers and to report any injuries or hazards immediately.</li>
                  {/* [NEW] */}
                  <li>Emergency contact information provided during registration may be used by organizers solely in case of medical or safety emergencies during official events.</li>
                  {/* [NEW] */}
                  <li>By attending an event, you grant Team Taraba River permission to photograph, video record, and publish images or footage from the event for community archival and promotional purposes, unless you have explicitly notified administrators in writing of your objection prior to the event.</li>
                </ul>
              </div>

              {/* [NEW] Media Approval Timeline */}
              <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-teal-600" />
                  3.2 Media Submission &amp; Approval Timeline
                </h4>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {/* [NEW] */}
                  Submitted media (photos and videos) is reviewed within <strong>5 business days</strong>. If your submission is rejected, you will receive a brief explanation. If no response is received within 5 business days, you may follow up via the official portal communication channel. Expedited review may be requested for time-sensitive content.
                </p>
              </div>
            </section>

            {/* [NEW] Section: Content, Media & Intellectual Property */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Star className="w-4 h-4 text-teal-600 shrink-0" />
                4. Content, Media &amp; Intellectual Property
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                {/* [NEW] */}
                <li>You retain ownership of content you upload to this portal. However, by uploading content, you grant Team Taraba River a <strong className="text-slate-700 dark:text-slate-200">non-exclusive, royalty-free, worldwide license</strong> to use, reproduce, display, and distribute such content solely for the purpose of operating and promoting the portal and Team Taraba River activities.</li>
                {/* [NEW] */}
                <li>You are solely responsible for the content you upload. You warrant that you have all necessary rights, consents, and permissions to share the content and that it does not infringe on any third-party intellectual property rights, privacy rights, or other legal rights.</li>
                {/* [NEW] */}
                <li>Team Taraba River reserves the right to remove or restrict access to any content that violates these Terms, is subject to a valid DMCA or Nigerian copyright complaint, or is otherwise deemed harmful or inappropriate, without prior notice.</li>
                {/* [NEW] */}
                <li>If you believe content on the portal infringes your copyright, you may submit a takedown notice to the administrators with: (a) identification of the copyrighted work; (b) identification of the allegedly infringing material; (c) your contact information; (d) a statement of good faith belief; and (e) your physical or electronic signature.</li>
              </ul>
            </section>

            {/* Section 5 (was 4) */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-teal-600 shrink-0" />
                5. Privacy Policy &amp; Data Usage
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                <li>We collect Personally Identifiable Information (PII) including your Full Name, Phone Number, Email, Residential Address, Birthday (Day &amp; Month only), Next of Kin, and Occupation.</li>
                <li>By registering, you consent to your <strong className="text-slate-700 dark:text-slate-200">public profile</strong> (Name, Occupation, Skills, and Photo) being listed in the Member Directory, visible only to other verified and authenticated members of Team Taraba River on this portal.</li>
                <li>Your birthday (Day and Month) will be highlighted on the Group Calendar to enable celebratory shout-outs during your birth month. Your birth year is deliberately not collected or displayed.</li>
                <li>Your personal data will <strong className="text-slate-700 dark:text-slate-200">never</strong> be sold, rented, or disclosed to any third party outside of Team Taraba River's administrative purposes.</li>
                <li>Administrative staff of Team Taraba River may access full member records solely for the purposes of managing membership, approving profiles, and coordinating group activities.</li>
              </ul>

              {/* [NEW] Data Protection & Rights */}
              <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-teal-600" />
                  5.1 Data Protection, Breach Notification &amp; Your Rights
                </h4>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-700 dark:text-slate-300 marker:text-slate-400">
                  {/* [NEW] */}
                  <li>We are committed to protecting your personal data in accordance with the <strong>Nigerian Data Protection Act (NDPA) 2023</strong> and applicable data protection regulations. We implement appropriate technical and organizational measures to safeguard your data.</li>
                  {/* [NEW] */}
                  <li>In the unlikely event of a data breach that may affect your rights or freedoms, we will notify you and the relevant Nigerian Data Protection Commission within <strong>72 hours</strong> of becoming aware of the breach, where required by law.</li>
                  {/* [NEW] */}
                  <li>You have the right to request access to, correction of, or deletion of your personal data. You may also request a copy of your data in a portable format. Such requests should be submitted via the official portal communication channel and will be addressed within <strong>30 days</strong>.</li>
                  {/* [NEW] */}
                  <li>Your data will be retained only for as long as necessary to fulfill the purposes outlined in these Terms, unless a longer retention period is required or permitted by law.</li>
                </ul>
              </div>
            </section>

            {/* [NEW] Section: Account Security */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-teal-600 shrink-0" />
                6. Account Security
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                {/* [NEW] */}
                <li>You are responsible for maintaining the confidentiality of your account credentials (username, password, PIN, or any other authentication method). You must not share your account with any other person.</li>
                {/* [NEW] */}
                <li>You must immediately notify Team Taraba River administrators of any unauthorized use of your account or any other breach of security known to you.</li>
                {/* [NEW] */}
                <li>Team Taraba River will not be liable for any loss or damage arising from your failure to comply with this section, or from any unauthorized access to your account resulting from your negligence.</li>
              </ul>
            </section>

            {/* Section 7 (was 5) */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Heart className="w-4 h-4 text-teal-600 shrink-0" />
                7. Activity Points &amp; Community Incentives
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                <li>The portal operates an Activity Points system designed to celebrate active participation. Points are earned for: Event RSVPs (+20 pts), Media Uploads (+30 pts), Profile Completion &amp; Updates (+15 pts), and Portal Visits (+10 pts).</li>
                <li>Points serve as <strong className="text-slate-700 dark:text-slate-200">non-monetary incentives only</strong>, and may occasionally qualify members for recognition, free gifts, or celebration during Team Taraba River gatherings.</li>
                <li>Points cannot be exchanged for cash, transferred between members, or fraudulently inflated. Any attempt to manipulate the points system will result in account review by Team Taraba River administrators.</li>
                {/* [NEW] Points revocation */}
                <li>Points have <strong>no monetary value</strong> and do not constitute property. Team Taraba River reserves the right to revoke points obtained through fraudulent means, system errors, or violations of these Terms, without liability.</li>
              </ul>
            </section>

            {/* [NEW] Section: Termination, Suspension & Deactivation */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <X className="w-4 h-4 text-teal-600 shrink-0" />
                8. Termination, Suspension &amp; Account Deactivation
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                {/* [NEW] */}
                <li>Team Taraba River may suspend or terminate your account at any time, with or without notice, for conduct that we believe violates these Terms, harms other members, or harms the reputation or interests of Team Taraba River or USOSA.</li>
                {/* [NEW] */}
                <li>You may request account deactivation at any time by contacting an administrator via the official portal communication channel. Upon deactivation, your profile will be hidden from public view within <strong>7 business days</strong>.</li>
                {/* [NEW] */}
                <li>Upon termination or deactivation, your right to use the portal will cease immediately. Certain data may be retained as required by law or for legitimate business purposes (e.g., archival event records, financial compliance). Personal data not required for such purposes will be deleted within <strong>90 days</strong> unless a longer retention period is required by applicable Nigerian law.</li>
                {/* [NEW] */}
                <li>Sections of these Terms that by their nature should survive termination (including intellectual property licenses, limitation of liability, and dispute resolution provisions) shall survive.</li>
              </ul>
            </section>

            {/* Section 9 (was 6) */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                9. Amendment of Terms
              </h3>
              <p className="text-sm leading-relaxed pl-6">
                Team Taraba River reserves the right to amend these Terms and Conditions at any time, in line with evolving community needs or directives from the wider URIP/USOSA network. Significant changes will be communicated via the portal. Your continued use of the platform after any such changes constitutes your acceptance of the revised terms.
              </p>
              {/* [NEW] Notice method */}
              <p className="text-xs text-slate-500 dark:text-slate-400 pl-6 mt-1">
                {/* [NEW] */}
                <strong>Notice Method:</strong> Material amendments will be posted on the portal's Terms page and announced via the primary notification channel (e.g., portal banner or registered email). It is your responsibility to review the Terms periodically.
              </p>
            </section>

            {/* [NEW] Section: Limitation of Liability */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-teal-600 shrink-0" />
                10. Limitation of Liability &amp; Disclaimer
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                {/* [NEW] */}
                <li>This portal is provided on an <strong>"as is"</strong> and <strong>"as available"</strong> basis. Team Taraba River makes no warranties, express or implied, regarding the operation of the portal or the information, content, or materials included on the portal.</li>
                {/* [NEW] */}
                <li>To the fullest extent permitted by applicable law, Team Taraba River, USOSA, URIP, and their respective officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, use, or goodwill, arising out of or in connection with your use of the portal.</li>
                {/* [NEW] */}
                <li>Team Taraba River does not warrant that the portal will be uninterrupted, secure, or error-free. We do not warrant that defects will be corrected, or that the portal or the servers that make it available are free of viruses or other harmful components.</li>
                {/* [NEW] */}
                <li>In no event shall our total liability to you for all claims arising out of or relating to the use of the portal exceed the amount paid by you, if any, for accessing the portal during the <strong>twelve (12) months</strong> prior to the claim.</li>
              </ul>
            </section>

            {/* [NEW] Section: Third-Party Services */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-teal-600 shrink-0" />
                11. Third-Party Services &amp; External Links
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                {/* [NEW] */}
                <li>The portal may link to or integrate with third-party services, including cloud media storage, database backends, and email providers. These services are not owned or controlled by Team Taraba River.</li>
                {/* [NEW] */}
                <li>We are not responsible for the availability, accuracy, legality, or content of any third-party services. Your use of third-party services is governed by their respective terms of service and privacy policies.</li>
                {/* [NEW] */}
                <li>We do not endorse, warrant, or guarantee any products or services offered by third parties. We are not a party to any transactions between you and third-party providers.</li>
              </ul>
            </section>

            {/* [NEW] Section: Dispute Resolution & Governing Law */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Gavel className="w-4 h-4 text-teal-600 shrink-0" />
                12. Dispute Resolution &amp; Governing Law
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                {/* [NEW] */}
                <li>These Terms shall be governed by and construed in accordance with the <strong>laws of the Federal Republic of Nigeria</strong>, without regard to its conflict of law provisions.</li>
                {/* [NEW] */}
                <li>Any dispute arising out of or in connection with these Terms, or your use of the portal, shall first be attempted to be resolved through good-faith negotiation with the Team Taraba River lead within <strong>30 days</strong> of written notice.</li>
                {/* [NEW] */}
                <li>If negotiation fails, the dispute shall be referred to and finally resolved by arbitration under the Arbitration and Mediation Act 2023 (Nigeria) or its successor legislation, by a sole arbitrator seated in Port Harcourt, Rivers State. The language of arbitration shall be English.</li>
                {/* [NEW] */}
                <li>Nothing in this section shall prevent either party from seeking urgent interim or injunctive relief from a court of competent jurisdiction in Port Harcourt, Rivers State, Nigeria.</li>
              </ul>
            </section>

            {/* [NEW] Section: General Provisions */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                13. General Provisions
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                {/* [NEW] */}
                <li><strong>Entire Agreement:</strong> These Terms, together with any policies referenced herein, constitute the entire agreement between you and Team Taraba River regarding the use of the portal and supersede any prior agreements.</li>
                {/* [NEW] */}
                <li><strong>Severability:</strong> If any provision of these Terms is held to be invalid, illegal, or unenforceable by a court of competent jurisdiction, the remaining provisions shall remain in full force and effect.</li>
                {/* [NEW] */}
                <li><strong>No Waiver:</strong> The failure of Team Taraba River to enforce any right or provision of these Terms shall not constitute a waiver of such right or provision.</li>
                {/* [NEW] */}
                <li><strong>Assignment:</strong> You may not assign or transfer these Terms or your rights hereunder without prior written consent from Team Taraba River. Team Taraba River may assign these Terms to any affiliated entity or successor without your consent.</li>
                {/* [NEW] */}
                <li><strong>Force Majeure:</strong> Team Taraba River shall not be liable for any failure or delay in performance due to circumstances beyond its reasonable control, including but not limited to acts of God, natural disasters, war, terrorism, riots, embargoes, acts of civil or military authorities, fire, floods, accidents, strikes, or shortages of transportation, facilities, fuel, energy, labor, or materials.</li>
              </ul>
            </section>

            {/* [NEW] Section: Official Communications & Contact */}
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600 shrink-0" />
                14. Official Communications &amp; Contact
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed marker:text-slate-400">
                {/* [NEW] */}
                <li>Official communications from Team Taraba River to members may be delivered via portal notifications, registered email, or SMS. It is your responsibility to ensure your contact information is current and that you review official communications promptly.</li>
                {/* [NEW] */}
                <li>Members wishing to contact administrators, report issues, or submit requests should use the official portal communication channel or contact the Team Taraba River lead directly at the contact details published on the portal.</li>
                {/* [NEW] */}
                <li>Team Taraba River shall not be responsible for communications sent to personal social media accounts, unofficial email addresses, or third-party platforms unless explicitly designated as official channels.</li>
              </ul>
            </section>

            {/* Signature Block */}
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700/50">
              <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
                <div className="text-sm text-slate-500 dark:text-slate-400 space-y-1">
                  <p className="font-medium text-slate-700 dark:text-slate-300">Team Taraba River Portal</p>
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
                    {/* [AMENDED] Added original signing date and amendment reference */}
                    11 August 2026 (Original)
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Updated: August 2026 (Comprehensive Review)
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
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
