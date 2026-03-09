import { AppLayout } from '@/components/layout/AppLayout';

const Terms = () => {
  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 pt-4 pb-24">
        <h1 className="text-2xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          By using Avlodona, you agree to these terms.
        </p>

        <section className="mt-6 space-y-2">
          <h2 className="text-lg font-semibold">Be respectful</h2>
          <p className="text-sm text-muted-foreground">
            Don’t harass others, don’t post illegal content, and don’t try to break the app.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-lg font-semibold">Your content</h2>
          <p className="text-sm text-muted-foreground">
            You own your content. You give us permission to store and display it so the service can work.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-lg font-semibold">Accounts & security</h2>
          <p className="text-sm text-muted-foreground">
            You’re responsible for your account. Don’t share your login codes or passwords.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-lg font-semibold">YouTube Terms</h2>
          <p className="text-sm text-muted-foreground">
            If you use features powered by YouTube API Services, you also agree to YouTube’s Terms of Service.
          </p>
          <a
            className="text-sm underline underline-offset-4"
            href="https://www.youtube.com/t/terms"
            target="_blank"
            rel="noreferrer"
          >
            youtube.com/t/terms
          </a>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-lg font-semibold">Changes</h2>
          <p className="text-sm text-muted-foreground">
            We may update these terms as the product evolves. We’ll keep this page updated.
          </p>
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

export default Terms;
