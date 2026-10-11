import { defineConfig } from 'vite';
export default defineConfig({build: {assetsInlineLimit: 0,rollupOptions:{input:{app:'index.html',website:'website.html',docs:'docs.html'}}}});

