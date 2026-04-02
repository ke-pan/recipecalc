import { useState, useEffect } from 'react';
import { LicenseProvider, useLicense } from '../../contexts/LicenseContext.js';
import './nav.css';

// ---------------------------------------------------------------------------
// Nav items
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { label: 'Calculator', href: '/calculator' },
  { label: 'My Recipes', href: '/template' },
  { label: 'My Pantry', href: '/pantry' },
] as const;

// ---------------------------------------------------------------------------
// Inner component — uses LicenseContext
// ---------------------------------------------------------------------------

function NavBarContent() {
  const { isUnlocked } = useLicense();
  const [currentPath, setCurrentPath] = useState('');

  useEffect(() => {
    setCurrentPath(window.location.pathname);
  }, []);

  // Only render for paid users
  if (!isUnlocked) {
    return null;
  }

  return (
    <nav className="navbar" aria-label="Main navigation" data-testid="navbar">
      <div className="navbar__inner">
        {NAV_ITEMS.map(({ label, href }) => {
          const isActive = currentPath === href;
          return (
            <a
              key={href}
              href={href}
              className={`navbar__link${isActive ? ' navbar__link--active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              data-testid={`navbar-link-${href.slice(1)}`}
            >
              {label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Exported component — wraps with LicenseProvider
// ---------------------------------------------------------------------------

export default function NavBar() {
  return (
    <LicenseProvider>
      <NavBarContent />
    </LicenseProvider>
  );
}
