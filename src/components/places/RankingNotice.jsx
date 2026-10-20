export default function RankingNotice({ text }) {
  if (!text) return null

  return (
    <details className="ranking-note">
      <summary>¿Cómo se ordenan los resultados?</summary>
      <p>{text}</p>
    </details>
  )
}
