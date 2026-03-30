import './resume-banner.css';

interface ResumeBannerProps {
  recipeName: string;
  onContinue: () => void;
  onStartFresh: () => void;
}

export function ResumeBanner({
  recipeName,
  onContinue,
  onStartFresh,
}: ResumeBannerProps) {
  return (
    <div className="resume-banner" role="status">
      <span className="resume-banner__text">
        Resume: <strong>{recipeName}</strong>?
      </span>
      <div className="resume-banner__actions">
        <button
          type="button"
          className="resume-banner__btn resume-banner__btn--continue"
          onClick={onContinue}
        >
          Continue
        </button>
        <button
          type="button"
          className="resume-banner__btn resume-banner__btn--fresh"
          onClick={onStartFresh}
        >
          Start fresh
        </button>
      </div>
    </div>
  );
}
