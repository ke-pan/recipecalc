import type React from 'react';
import './resume-banner.css';

export interface ResumeBannerProps {
  recipeName: string;
  onContinue: () => void;
  onStartFresh: () => void;
}

export const ResumeBanner: React.FC<ResumeBannerProps> = ({
  recipeName,
  onContinue,
  onStartFresh,
}) => {
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
};
