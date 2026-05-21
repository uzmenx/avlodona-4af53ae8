import { Link } from 'react-router-dom';

export const LegalFooter = ({ className = '' }: { className?: string }) => {
  return (
    <footer className={className}>
      <div className="max-w-lg mx-auto px-4 py-4 text-center text-xs text-white/45">
        <span>© 2026 Avlodona</span>
        <span className="mx-2">·</span>
        <Link to="/terms" className="text-sky-200/70 hover:text-sky-100 underline-offset-4 hover:underline">
          Terms
        </Link>
        <span className="mx-2">·</span>
        <Link to="/privacy-policy" className="text-sky-200/70 hover:text-sky-100 underline-offset-4 hover:underline">
          Privacy
        </Link>
        <span className="mx-2">·</span>
        <Link
          to="/about"
          onClick={() => {
            setTimeout(() => {
              document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }}
          className="text-sky-200/70 hover:text-sky-100 underline-offset-4 hover:underline"
        >
          Contact
        </Link>
      </div>
    </footer>
  );
};
