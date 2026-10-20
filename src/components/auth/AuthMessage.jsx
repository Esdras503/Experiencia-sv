export default function AuthMessage({ tone = 'error', id, children }) {
  if (!children) return null

  return (
    <p
      id={id}
      className={`auth-message auth-message-${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </p>
  )
}
