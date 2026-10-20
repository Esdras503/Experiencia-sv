import { useState } from 'react'

export default function SafeImage({
  src,
  alt = '',
  fallbackLabel = 'Imagen no disponible',
  className = '',
  loading = 'lazy',
  fallbackText = 'Imagen no disponible',
  ...imageProps
}) {
  const [failedSrc, setFailedSrc] = useState(null)
  const failed = failedSrc === src

  if (failed || !src) {
    return (
      <div
        className={`image-fallback ${className}`.trim()}
        role="img"
        aria-label={fallbackLabel}
      >
        <span className="image-fallback-icon" aria-hidden="true">
          ▧
        </span>
        <span className="image-fallback-text">{fallbackText}</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => setFailedSrc(src)}
      {...imageProps}
    />
  )
}
