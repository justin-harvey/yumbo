// Small inline SVG icon set for the scan controls. Stroke uses currentColor so
// each button controls its own colour. (Civic-Chain only ships logo SVGs, not
// reusable UI icons, so these are Yumbo's own.)

type IconProps = { className?: string };

const base = "h-6 w-6";

export function TorchIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M8 2h8l-1.2 4.2a2 2 0 0 1-.5.9L13 8.5V11H11V8.5L9.7 7.1a2 2 0 0 1-.5-.9L8 2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <rect
        x="11"
        y="11"
        width="2"
        height="10"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function CompareIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="10" width="6" height="10" rx="1.4" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="5" width="6" height="15" rx="1.4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function LeafIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M20 4C10 4 4 9 4 18c0 1 .3 2 .3 2s7 .5 11-3.5C19 12.9 20 8 20 4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M5 19C9 14 13 11 17 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function BarcodeIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M4 5v14M8 5v14M12 5v14M16 5v14M20 5v14" />
      </g>
    </svg>
  );
}
