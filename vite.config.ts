import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/adsbfi': {
        target: 'https://opendata.adsb.fi',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/adsbfi/, '/api'),
      },
      '/api/adsb': {
        target: 'https://api.adsb.lol',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/adsb/, ''),
      },
      '/api/opensky': {
        target: 'https://opensky-network.org',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/opensky/, '/api'),
      },
      '/api/airplaneslive': {
        target: 'https://airplanes.live',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/airplaneslive/, '/api'),
      },
    },
  },
})