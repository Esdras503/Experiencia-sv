import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const sourceRoot = join(import.meta.dirname)
const forbiddenServerVariables = [
  'AI_API_KEY',
  'CHAT_SIGNING_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GOOGLE_MAPS_API_KEY',
  'GOOGLE_PLACES_API_KEY',
]

function collectJsFiles(directory) {
  const files = []
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry)
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectJsFiles(fullPath))
    } else if (/\.(js|jsx)$/.test(entry) && !/\.test\.(js|jsx)$/.test(entry)) {
      files.push(fullPath)
    }
  }
  return files
}

test('el código React no accede a secretos de servidor o IA', () => {
  const files = collectJsFiles(sourceRoot)
  const source = files.map((file) => readFileSync(file, 'utf8')).join('\n')

  for (const variable of forbiddenServerVariables) {
    assert.equal(
      source.includes(variable),
      false,
      `El código del navegador no debe mencionar ${variable}`,
    )
  }
  assert.equal(source.includes('service_role_key'), false)
  assert.equal(source.includes('process.env'), false)
})

test('solo se leen variables públicas de Vite', () => {
  const files = collectJsFiles(sourceRoot)
  const source = files.map((file) => readFileSync(file, 'utf8')).join('\n')
  const referenced = new Set()

  for (const match of source.matchAll(/env\.(VITE_[A-Z0-9_]+)/g)) {
    referenced.add(match[1])
  }
  for (const match of source.matchAll(/import\.meta\.env\.(VITE_[A-Z0-9_]+)/g)) {
    referenced.add(match[1])
  }

  assert.deepEqual(
    [...referenced].sort(),
    ['VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_URL'],
  )
})

test('la configuración de ejemplo distingue claves públicas de secretas', () => {
  const envExample = readFileSync(join(sourceRoot, '..', '.env.example'), 'utf8')
  assert.match(envExample, /VITE_SUPABASE_URL=/)
  assert.match(envExample, /VITE_SUPABASE_ANON_KEY=/)
  assert.match(envExample, /nunca.*service_role/i)
})
