import { REPO_URL } from '../config';

// Shown under a submit button when a form is used in preview mode.
export default function PreviewNotice() {
  return (
    <p role="status" className="mt-3 text-center text-sm text-slate-600">
      Login is turned off in this preview. The code is on{' '}
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-cvsu-green underline hover:text-cvsu-green/80"
      >
        GitHub
      </a>
      .
    </p>
  );
}
