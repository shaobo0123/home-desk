import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api/terminal': {
        target: 'ws://localhost:3010',
        ws: true,
      },
      '/api': 'http://localhost:3010',
    },
  },
})
