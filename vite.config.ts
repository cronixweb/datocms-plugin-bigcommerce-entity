import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const allowedHosts = (env.ALLOWED_HOSTS ?? '.ngrok-free.app')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)

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
