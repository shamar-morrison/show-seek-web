import { PageHeader } from "@/components/page-header"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy | ShowSeek",
  description:
    "How ShowSeek collects, uses, stores, and protects your information.",
}

const CONTACT_EMAIL = "shamar.morrison2000@gmail.com"

/**
 * Privacy Policy Page
 * Explains how ShowSeek collects, uses, stores, and protects user data
 * across the website and mobile app.
 */
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-3xl px-4 pb-12 pt-36 sm:px-8">
        <PageHeader
          title="Privacy Policy"
          description="Last updated: September 16, 2026"
        />
        <div className="flex flex-col gap-8 text-sm/relaxed text-gray-400">
          <section className="flex flex-col gap-3">
            <p>
              ShowSeek (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or
              &ldquo;us&rdquo;) is committed to protecting your privacy. This
              Privacy Policy explains how we collect, use, store, and share
              information when you use the ShowSeek website at{" "}
              <span className="text-white">show-seek.app</span> and the
              ShowSeek mobile app (together, &ldquo;ShowSeek&rdquo;). By
              using ShowSeek on any platform, you agree to the collection
              and use of information as described here.
            </p>
            <p>
              ShowSeek is developed and operated by an independent developer.
              For privacy questions or requests, contact us at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-white underline underline-offset-2 hover:text-gray-200"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">
              1. Information We Collect
            </h2>
            <h3 className="text-base font-semibold text-white">
              1.1 Account information
            </h3>
            <p>When you create an account, we collect:</p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>
                <span className="text-white">Email address</span> — used for
                authentication, account recovery, and essential service
                messages
              </li>
              <li>
                <span className="text-white">Authentication data</span> —
                securely managed through Firebase Authentication, including
                third-party sign-in (such as Google) identifiers when you
                choose that option
              </li>
            </ul>
            <p>
              We never see or store your actual password; credentials are
              handled by Firebase Authentication. On the mobile app you may
              also continue as a guest with an anonymous account, which
              collects no email address but cannot sync personal data across
              devices until you create a full account.
            </p>
            <h3 className="text-base font-semibold text-white">
              1.2 Content you create
            </h3>
            <p>When you use ShowSeek, we store data you create, such as:</p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>
                Personal lists — watchlists, favorites, currently watching,
                already watched, dropped, and custom lists
              </li>
              <li>Ratings for movies, shows, and episodes</li>
              <li>Episode watch progress</li>
              <li>Personal notes on titles</li>
              <li>Release reminders and notification preferences</li>
              <li>
                Preferences such as region, streaming services, and display
                settings
              </li>
            </ul>
            <h3 className="text-base font-semibold text-white">
              1.3 Imported data
            </h3>
            <p>
              If you connect Trakt or import an IMDb export, we process that
              data only to import your ratings, watch history, and lists into
              ShowSeek. Connecting these services is always optional and can
              be disconnected at any time.
            </p>
            <h3 className="text-base font-semibold text-white">
              1.4 Automatically collected information
            </h3>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>
                <span className="text-white">Session and device basics</span>{" "}
                — information needed to keep you signed in, secure the
                service, and deliver core features
              </li>
              <li>
                <span className="text-white">Basic analytics</span> —
                aggregated usage and performance data used to improve features
                and fix issues
              </li>
              <li>
                <span className="text-white">
                  Cookies and local storage (website)
                </span>{" "}
                — used for authentication sessions and remembering your
                on-device preferences
              </li>
              <li>
                <span className="text-white">
                  Push tokens and device identifiers (mobile app)
                </span>{" "}
                — used only to deliver release reminders and notifications
                you opt into, via Expo&apos;s push notification service
              </li>
            </ul>
            <h3 className="text-base font-semibold text-white">
              1.5 Device permissions (mobile app)
            </h3>
            <p>
              The mobile app may request notification permission to send
              release reminders you opt into. Granting it is optional and you
              can revoke it at any time in your device settings.
            </p>
            <h3 className="text-base font-semibold text-white">
              1.6 Third-party catalog data
            </h3>
            <p>
              We retrieve movie and TV show information (titles, posters,
              release dates, cast) from The Movie Database (TMDB) API. This
              catalog data is publicly available content information, not
              personal data.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">
              2. How We Use Your Information
            </h2>
            <p>We use the information we collect to:</p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>
                Provide core features — tracking, lists, ratings, notes,
                episode progress, and reminders
              </li>
              <li>Manage your account, sign-in, and password recovery</li>
              <li>
                Process Premium subscriptions and enforce Premium limits
              </li>
              <li>Improve the service through aggregated usage patterns</li>
              <li>
                Communicate essential service updates related to your account
              </li>
            </ul>
            <p>We do NOT use your data for:</p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>Advertising or ad personalization</li>
              <li>Selling to third parties</li>
              <li>Profiling or behavioral tracking beyond basic service use</li>
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">
              3. Data Storage and Security
            </h2>
            <h3 className="text-base font-semibold text-white">
              3.1 Where data lives
            </h3>
            <p>User data is stored using Google Firebase services:</p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>
                <span className="text-white">Firebase Authentication</span> —
                accounts and sign-in
              </li>
              <li>
                <span className="text-white">Cloud Firestore</span> — lists,
                ratings, notes, tracking data, reminders, and preferences
              </li>
            </ul>
            <p>
              Data is hosted on Google Cloud infrastructure. The site itself
              is served through Cloudflare&apos;s hosting and content
              delivery network.
            </p>
            <h3 className="text-base font-semibold text-white">
              3.2 Protections
            </h3>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>Encryption in transit via HTTPS/TLS</li>
              <li>
                Firestore security rules restricting access to your own data
              </li>
              <li>
                Passwords handled exclusively by Firebase Authentication
              </li>
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">4. Data Sharing</h2>
            <p>
              We share data only with the service providers needed to operate
              ShowSeek:
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>
                <span className="text-white">
                  Firebase Authentication / Cloud Firestore (Google)
                </span>{" "}
                — account management and data storage
              </li>
              <li>
                <span className="text-white">Polar (website)</span> — Premium
                subscription payments and billing management
              </li>
              <li>
                <span className="text-white">
                  RevenueCat, Apple App Store, and Google Play (mobile app)
                </span>{" "}
                — Premium subscription purchases and entitlement status
              </li>
              <li>
                <span className="text-white">TMDB API</span> — read-only
                catalog data; we send no personal data to retrieve it
              </li>
              <li>
                <span className="text-white">Trakt</span> — only if you
                connect your Trakt account, to sync the data you request
              </li>
              <li>
                <span className="text-white">Cloudflare</span> — hosting and
                delivery of the website
              </li>
              <li>
                <span className="text-white">
                  Expo push notification service (mobile app)
                </span>{" "}
                — delivery of reminders you opt into, using your device push
                token
              </li>
            </ul>
            <p>We do NOT:</p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>Sell your personal data to any third party</li>
              <li>Share data with advertising networks or data brokers</li>
            </ul>
            <p>
              <span className="text-white">Legal disclosure:</span> we may
              disclose information if required by law or in response to valid
              legal requests from public authorities.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">
              5. Retention and Deletion
            </h2>
            <h3 className="text-base font-semibold text-white">
              5.1 How long we keep data
            </h3>
            <p>
              We retain your data for as long as your account is active so
              your lists, ratings, and progress stay in sync.
            </p>
            <h3 className="text-base font-semibold text-white">
              5.2 Deleting your account
            </h3>
            <p>
              You can delete your account and all associated data at any time
              from your Profile page on the website, from the app settings on
              mobile, or by emailing{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-white underline underline-offset-2 hover:text-gray-200"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              from the address associated with your account. Deletion is
              irreversible and removes:
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>Your sign in account</li>
              <li>
                Your lists, ratings, notes, reminders, and episode watch
                progress
              </li>
              <li>Your preferences and app settings</li>
              <li>Your Trakt connection data and import records</li>
              <li>Your subscription entitlement records held by us</li>
            </ul>
            <p>
              Payment providers (Polar on the web, the App Store or Google
              Play on mobile) keep their own billing records as required by
              law. You should cancel any active Premium subscription before
              deleting your account.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">6. Your Rights</h2>
            <p>
              Depending on your location, you may have the right to access,
              correct, delete, or receive a portable copy of your personal
              data, and to withdraw consent for optional processing such as
              reminders. To exercise these rights, contact us at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-white underline underline-offset-2 hover:text-gray-200"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
            <h3 className="text-base font-semibold text-white">
              6.1 EU / EEA / UK (GDPR)
            </h3>
            <p>
              Our legal bases for processing are contract performance (to
              provide the service you signed up for), consent (for optional
              features like reminders and third-party connections), and
              legitimate interests (basic analytics and service improvement).
            </p>
            <h3 className="text-base font-semibold text-white">
              6.2 California (CCPA)
            </h3>
            <p>
              California residents have the right to know what personal
              information we collect, request its deletion, and opt out of
              sales of personal information. We do not sell personal
              information.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">
              7. Children&apos;s Privacy
            </h2>
            <p>
              ShowSeek is not directed at children under 13, and we do not
              knowingly collect personal information from children under 13.
              If you believe a child has provided us personal information,
              contact us and we will delete it.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">
              8. Changes to This Policy
            </h2>
            <p>
              We may update this policy from time to time and will revise the
              &ldquo;Last updated&rdquo; date above when we do. For material
              changes, we will provide notice on the website or in the app.
              Continued use of ShowSeek after changes take effect constitutes
              acceptance.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">Contact Us</h2>
            <p>
              Questions or requests about this policy or our data practices?
              Contact us at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-white underline underline-offset-2 hover:text-gray-200"
              >
                {CONTACT_EMAIL}
              </a>
              . These practices are also summarized in our{" "}
              <Link
                href="/terms"
                className="text-white underline underline-offset-2 hover:text-gray-200"
              >
                Terms of Service
              </Link>
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
