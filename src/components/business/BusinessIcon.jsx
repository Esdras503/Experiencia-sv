const ICONS = {
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" />
      <path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
      <path d="m5.5 14 .7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
    </>
  ),
  crown: (
    <>
      <path d="m4 8 3.5 3L12 5l4.5 6L20 8l-1.7 9H5.7L4 8Z" />
      <path d="M6 20h12" />
      <circle cx="12" cy="13.5" r="1" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  store: (
    <>
      <path d="M4 10v10h16V10" />
      <path d="M3 10 5.2 4h13.6L21 10" />
      <path d="M3 10a3 3 0 0 0 5.2 1.9A3 3 0 0 0 13.4 12 3 3 0 0 0 18.8 12 3 3 0 0 0 21 10" />
      <path d="M9 20v-5h6v5" />
    </>
  ),
  file: (
    <>
      <path d="M6 3h8l4 4v14H6V3Z" />
      <path d="M14 3v5h5M9 12h6M9 16h6" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m4 18 5-5 4 4 2.5-2.5L20 19" />
    </>
  ),
  map: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  contact: (
    <>
      <path d="M6.5 3h3l1.5 4-2 1.5a15 15 0 0 0 6.5 6.5l1.5-2 4 1.5v3A2.5 2.5 0 0 1 18.5 21C10.5 20.6 3.4 13.5 3 5.5A2.5 2.5 0 0 1 5.5 3h1Z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  check: <path d="m5 12 4.5 4.5L19 7" />,
  visibility: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  exposure: (
    <>
      <path d="M3 12s3.5-6.5 9-6.5S21 12 21 12s-3.5 6.5-9 6.5S3 12 3 12Z" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
    </>
  ),
  tag: (
    <>
      <path d="M20 13 13 20l-9-9V4h7l9 9Z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.2A8 8 0 1 1 20 11.5Z" />
      <path d="M9 8.5c.4 3.7 2.8 6.1 6.5 6.5l1-1.6-2.2-1-1 .8c-1-.5-1.7-1.2-2.2-2.2l.8-1-1-2.2-1.9.7Z" />
    </>
  ),
  priority: (
    <>
      <path d="M12 20V5M6 11l6-6 6 6" />
      <path d="M4 21h16" />
    </>
  ),
  gallery: (
    <>
      <rect x="7" y="3" width="14" height="14" rx="2" />
      <path d="M17 21H5a2 2 0 0 1-2-2V7" />
      <circle cx="12" cy="8" r="1.3" />
      <path d="m8 15 3-3 2.5 2.5 2-2L20 17" />
    </>
  ),
  promo: (
    <>
      <path d="m4 10 10-5v14L4 14v-4Z" />
      <path d="M14 9a4 4 0 0 1 0 6M7 15.5 8 21h4l-1-5" />
    </>
  ),
  analytics: (
    <>
      <path d="M3 20h18M5 16l4-5 3 3 5-8 3 4" />
      <path d="M5 20v-4M9 20v-3M13 20v-2M17 20v-5M21 20v-8" />
    </>
  ),
  tools: (
    <>
      <path d="M4 6h6M14 6h6M4 12h11M18 12h2M4 18h2M10 18h10" />
      <circle cx="12" cy="6" r="2" />
      <circle cx="16" cy="12" r="2" />
      <circle cx="8" cy="18" r="2" />
    </>
  ),
}

export default function BusinessIcon({ name, size = 20, className = '' }) {
  return (
    <svg
      className={`business-icon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name] ?? ICONS.check}
    </svg>
  )
}
