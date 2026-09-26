import { PageHeader } from "@/components/page-header"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Terms of Service | ShowSeek",
  description:
    "The terms that govern your use of ShowSeek for tracking movies and TV shows.",
}

const CONTACT_EMAIL = "feedback@show-seek.app"

/**
 * Terms of Service Page
 * Legal terms governing use of ShowSeek on the web and mobile.
 */
export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-3xl px-4 pb-12 pt-36 sm:px-8">
        <PageHeader
          title="Terms of Service"
          description="Last updated: September 16, 2026"
        />
        <div className="flex flex-col gap-8 text-sm/relaxed text-gray-400">
          <section className="flex flex-col gap-3">
            <p>
              Welcome to ShowSeek! These Terms of Service (&ldquo;Terms&rdquo;)
              are a legal agreement between you and ShowSeek
              (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) that
              governs your use of the ShowSeek website at{" "}
              <span className="text-white">show-seek.app</span> and the
              ShowSeek mobile app (together, &ldquo;ShowSeek&rdquo; or the
              &ldquo;Service&rdquo;). By accessing or using ShowSeek on any
              platform, you agree to these Terms. If you do not agree,
              please do not use ShowSeek.
            </p>
            <p>
              We may modify these Terms at any time. Changes take effect
              immediately when posted on this page with a revised
              &ldquo;Last updated&rdquo; date. Your continued use of ShowSeek
              after changes are posted constitutes acceptance of the modified
              Terms.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">
              1. Description of Service
            </h2>
            <p>ShowSeek lets you:</p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>Discover and search for movies and TV shows</li>
              <li>
                Browse details about films, series, seasons, episodes, and
                cast members
              </li>
              <li>
                Create and manage watchlists, favorites, and custom lists
              </li>
              <li>Rate movies, shows, and individual episodes</li>
              <li>Track watched episodes and your watch progress</li>
              <li>Keep personal notes on titles</li>
              <li>Check where titles are available to stream</li>
              <li>
                Import existing data from supported services such as Trakt
                and IMDb
              </li>
              <li>Upgrade to Premium for higher limits and extra features</li>
            </ul>
            <p>
              Movie and TV show data is provided by The Movie Database (TMDB)
              API. ShowSeek is not affiliated with, endorsed by, or sponsored
              by TMDB, and all catalog information is sourced from their
              database.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">2. Accounts</h2>
            <h3 className="text-base font-semibold text-white">
              2.1 Account creation
            </h3>
            <p>
              Most ShowSeek features require an account. You can sign up with
              an email address and password or with a supported third-party
              sign-in provider such as Google. Authentication and account data
              are managed through Firebase Authentication. On the mobile app,
              you may also continue as a guest with an anonymous account and
              limited functionality.
            </p>
            <h3 className="text-base font-semibold text-white">
              2.2 Account security
            </h3>
            <p>You are responsible for:</p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>Maintaining the confidentiality of your credentials</li>
              <li>All activity that occurs under your account</li>
              <li>
                Notifying us promptly at{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-white underline underline-offset-2 hover:text-gray-200"
                >
                  {CONTACT_EMAIL}
                </a>{" "}
                of any unauthorized use of your account
              </li>
            </ul>
            <h3 className="text-base font-semibold text-white">
              2.3 Browsing without an account
            </h3>
            <p>
              Visitors without an account may browse public catalog content,
              but saving lists, ratings, notes, reminders, and personalized
              settings requires signing in. On the mobile app, guest users
              may browse with limited access; full functionality requires
              creating an account.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">
              3. Premium Subscriptions
            </h2>
            <p>
              ShowSeek offers an optional Premium subscription with higher
              limits and additional features. How you pay depends on where
              you subscribe:
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>
                <span className="text-white">On the website:</span> payments
                are processed by Polar. By purchasing Premium on the web,
                you also agree to Polar&apos;s applicable checkout and
                billing terms. Manage or cancel through the Polar customer
                portal linked from your Profile page.
              </li>
              <li>
                <span className="text-white">On the mobile app:</span>{" "}
                payments are processed through the App Store or Google Play
                (via RevenueCat). By purchasing Premium in the app, you also
                agree to the applicable app store billing terms. Manage or
                cancel through your device&apos;s App Store or Google Play
                subscription settings.
              </li>
              <li>
                Cancellation stops future billing; access generally continues
                until the end of the current billing period.
              </li>
              <li>
                Refunds, where applicable, are handled according to the
                relevant store or provider policies and applicable law.
              </li>
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">
              4. Acceptable Use
            </h2>
            <p>When using ShowSeek, you agree NOT to:</p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>Use ShowSeek for any illegal or unauthorized purpose</li>
              <li>
                Attempt to gain unauthorized access to our systems or other
                users&apos; accounts
              </li>
              <li>
                Interfere with or disrupt our servers, networks, or security
                measures
              </li>
              <li>
                Reverse engineer, decompile, or scrape the service in ways
                that abuse or degrade it
              </li>
              <li>Use bots or automation to abuse the service</li>
              <li>
                Violate app store terms or policies when using the mobile
                app
              </li>
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe the intellectual property rights of others</li>
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">
              5. Content and Intellectual Property
            </h2>
            <h3 className="text-base font-semibold text-white">
              5.1 Third-party catalog content
            </h3>
            <p>
              Titles, posters, release dates, cast information, trailers, and
              related catalog content are sourced from TMDB and belong to
              their respective owners. This content is displayed in accordance
              with TMDB&apos;s terms of use.
            </p>
            <h3 className="text-base font-semibold text-white">
              5.2 ShowSeek content
            </h3>
            <p>
              The ShowSeek website and mobile app, including their design,
              code, features, and branding, are our intellectual property
              and are protected by copyright and other intellectual property
              laws.
            </p>
            <h3 className="text-base font-semibold text-white">
              5.3 Your content
            </h3>
            <p>
              Ratings, lists, notes, and other content you create remain
              yours. By using ShowSeek, you grant us a non-exclusive,
              worldwide license to store, process, and display that content
              solely as necessary to operate the service (for example,
              syncing your lists across your sessions).
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">
              6. Privacy and Data
            </h2>
            <p>
              Our collection and use of personal data is governed by our{" "}
              <Link
                href="/privacy"
                className="text-white underline underline-offset-2 hover:text-gray-200"
              >
                Privacy Policy
              </Link>
              . By using ShowSeek, you consent to the practices described
              there, including storage of your account information, lists,
              ratings, notes, and tracking data using Firebase services.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">7. Disclaimers</h2>
            <h3 className="text-base font-semibold text-white">
              7.1 &ldquo;As is&rdquo; service
            </h3>
            <p>
              ShowSeek is provided &ldquo;as is&rdquo; and &ldquo;as
              available&rdquo; without warranties of any kind, express or
              implied, including implied warranties of merchantability,
              fitness for a particular purpose, and non-infringement.
            </p>
            <h3 className="text-base font-semibold text-white">
              7.2 Content accuracy
            </h3>
            <p>
              We do not guarantee the accuracy, completeness, or timeliness
              of catalog information. Third-party data may contain errors or
              become outdated.
            </p>
            <h3 className="text-base font-semibold text-white">
              7.3 Availability
            </h3>
            <p>
              We do not guarantee uninterrupted or error-free operation. The
              service may be temporarily unavailable due to maintenance,
              updates, or technical issues.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">
              8. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by law, ShowSeek and its
              affiliates, officers, employees, and agents are not liable for
              any indirect, incidental, special, consequential, or punitive
              damages, or any loss of profits, data, or goodwill, arising
              from your use of or inability to use ShowSeek, or from any
              third-party content or conduct.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">
              9. Indemnification
            </h2>
            <p>
              You agree to indemnify, defend, and hold harmless ShowSeek and
              its affiliates from claims, damages, losses, or expenses
              (including reasonable legal fees) arising from your use of
              ShowSeek, your violation of these Terms, or your violation of
              another party&apos;s rights.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">
              10. Termination and Deletion
            </h2>
            <p>
              We may suspend or terminate your access at any time, without
              notice, for any reason, including violation of these Terms. You
              may delete your account at any time from your Profile page on
              the website, from the app settings on mobile, or by contacting
              us. Upon termination, your right to use ShowSeek immediately
              ceases, and stored data is handled as described in our{" "}
              <Link
                href="/privacy"
                className="text-white underline underline-offset-2 hover:text-gray-200"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">
              11. Changes to These Terms
            </h2>
            <p>
              We may update these Terms from time to time and will revise the
              &ldquo;Last updated&rdquo; date above when we do. Continued use
              of ShowSeek after changes are posted constitutes acceptance of
              the modified Terms.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">
              12. Governing Law, Severability, Entire Agreement
            </h2>
            <p>
              These Terms are governed by applicable laws without regard to
              conflict-of-law principles. If any provision is found invalid
              or unenforceable, the remaining provisions continue in full
              force. These Terms, together with our Privacy Policy,
              constitute the entire agreement between you and ShowSeek
              regarding your use of the service.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">Contact Us</h2>
            <p>
              Questions about these Terms? Contact us at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-white underline underline-offset-2 hover:text-gray-200"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
            <p className="text-gray-500">
              &copy; 2026 ShowSeek. All rights reserved. Movie and TV data
              provided by TMDB.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
