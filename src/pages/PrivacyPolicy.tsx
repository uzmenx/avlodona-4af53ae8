import { AppLayout } from '@/components/layout/AppLayout';

const PrivacyPolicy = () => {
  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 pt-4 pb-24">
        <h1 className="text-2xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Short version: we collect the minimum data needed to run Avlodona. We don’t sell your personal data.
        </p>

        <section className="mt-6 space-y-2">
          <h2 className="text-lg font-semibold">Data we collect</h2>
          <p className="text-sm text-muted-foreground">
            Account info (email/phone, username, profile details), content you post (posts, stories, messages),
            and basic app usage data (for security and performance).
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-lg font-semibold">How we use it</h2>
          <p className="text-sm text-muted-foreground">
            To create your account, show your content, power social features (likes, follows, messages),
            keep the app secure, and improve reliability.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-lg font-semibold">Who we share it with</h2>
          <p className="text-sm text-muted-foreground">
            We share data only when needed to provide the service (hosting, delivery, communications, video),
            or when required by law.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-lg font-semibold">Your rights</h2>
          <p className="text-sm text-muted-foreground">
            You can request to delete your account or export your data. Contact us at support@avlodona.com.
          </p>
        </section>

        <section id="cookies" className="mt-6 space-y-2 scroll-mt-24">
          <h2 className="text-lg font-semibold">Cookies</h2>
          <p className="text-sm text-muted-foreground">
            We use cookies and local storage to keep you signed in, remember preferences, and improve the app.
            You can accept cookies via the banner.
          </p>
        </section>

        <section className="mt-6 space-y-3">
          <h2 className="text-lg font-semibold">Third-party services</h2>

          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
            <h3 className="font-semibold">YouTube API Services</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground/90">Data:</span> search queries and video identifiers.
              <br />
              <span className="font-medium text-foreground/90">Why:</span> to show YouTube content and previews.
              <br />
              <a className="underline underline-offset-4" href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">
                youtube.com/t/terms
              </a>
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
            <h3 className="font-semibold">Google</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground/90">Data:</span> sign-in information if you use Google login.
              <br />
              <span className="font-medium text-foreground/90">Why:</span> authentication.
              <br />
              <a className="underline underline-offset-4" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
                policies/google privacy
              </a>
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
            <h3 className="font-semibold">Cloudflare</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground/90">Data:</span> IP address and basic request logs.
              <br />
              <span className="font-medium text-foreground/90">Why:</span> security, performance, and content delivery.
              <br />
              <a className="underline underline-offset-4" href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">
                cloudflare.com/privacypolicy
              </a>
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
            <h3 className="font-semibold">Daily.co</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground/90">Data:</span> call metadata (and audio/video if you join a call).
              <br />
              <span className="font-medium text-foreground/90">Why:</span> real-time video/audio features.
              <br />
              <a className="underline underline-offset-4" href="https://www.daily.co/privacy" target="_blank" rel="noreferrer">
                daily.co/privacy
              </a>
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
            <h3 className="font-semibold">Resend</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground/90">Data:</span> email address and email delivery metadata.
              <br />
              <span className="font-medium text-foreground/90">Why:</span> transactional emails (OTP, account messages).
              <br />
              <a className="underline underline-offset-4" href="https://resend.com/legal/privacy-policy" target="_blank" rel="noreferrer">
                resend.com/legal/privacy-policy
              </a>
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
            <h3 className="font-semibold">Other services</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Avlodona may use additional infrastructure providers (hosting, analytics, storage) as the product evolves.
              We will keep this page updated.
            </p>
          </div>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-lg font-semibold">Contact</h2>
          <p className="text-sm text-muted-foreground">support@avlodona.com</p>
        </section>

        <p className="mt-8 text-xs text-muted-foreground">Last updated: 2026-03-08</p>
      </div>
    </AppLayout>
  );
};

export default PrivacyPolicy;
