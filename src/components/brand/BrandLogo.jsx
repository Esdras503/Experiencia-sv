import horizontalLogo from '../../assets/logo-experiencia-sv.png'
import iconLogo from '../../assets/logo-experiencia-sv-icon.png'

const LOGOS = {
  horizontal: {
    src: horizontalLogo,
    width: 597,
    height: 126,
  },
  icon: {
    src: iconLogo,
    width: 134,
    height: 134,
  },
}

export default function BrandLogo({
  variant = 'horizontal',
  className = '',
  alt = 'Experiencia SV',
  decorative = false,
}) {
  const logo = LOGOS[variant] ?? LOGOS.horizontal

  return (
    <img
      className={`brand-logo brand-logo--${variant}${className ? ` ${className}` : ''}`}
      src={logo.src}
      width={logo.width}
      height={logo.height}
      alt={decorative ? '' : alt}
      aria-hidden={decorative ? 'true' : undefined}
      draggable="false"
    />
  )
}
