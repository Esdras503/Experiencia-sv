import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const distRoot = join(root, 'dist')
const envPath = join(root, '.env')

if (!existsSync(distRoot)) {
  console.error('No existe dist/. Ejecuta primero: npm run build')
  process.exit(1)
}

const secretKeys = []
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim())
    if (!match) continue
    const [, key] = match
    if (key.startsWith('VITE_')) continue
    if (!/(KEY|SECRET|TOKEN|PASSWORD)/i.test(key)) continue
    const value = match[2].trim().replace(/^["']|["']$/g, '')
    if (value.length >= 8) secretKeys.push({ key, value })
  }
}

function collectFiles(directory) {
  const files = []
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry)
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectFiles(fullPath))
    } else {
      files.push(fullPath)
    }
  }
  return files
}

const bundleFiles = collectFiles(distRoot)
const violations = []

for (const { key, value } of secretKeys) {
  for (const file of bundleFiles) {
    if (readFileSync(file, 'utf8').includes(value)) {
      violations.push(`${key} aparece en ${file.replace(root, '')}`)
    }
  }
}

if (violations.length > 0) {
  console.error('Se encontraron secretos de servidor en el bundle:')
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}

console.log(
  `Bundle revisado: ${bundleFiles.length} archivos, ${secretKeys.length} secretos de servidor comprobados. Ninguno fue encontrado.`,
)
