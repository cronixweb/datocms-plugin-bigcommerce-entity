import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const defaultAllowedHosts = [
    '.ngrok-free.app',
    '.ngrok-free.dev',
    'localhost',
    '127.0.0.1',
  ]
  const envAllowedHosts = (env.ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)
  const allowedHosts = Array.from(new Set([...defaultAllowedHosts, ...envAllowedHosts]))

  return {
    base: './',
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      allowedHosts,
    },
    preview: {
      host: '0.0.0.0',
      allowedHosts,
    },
  }
})
