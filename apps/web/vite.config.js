import {defineConfig} from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: {
        api: 'src/api.ts',
        markdown: 'src/ui/SafeMarkdown.tsx',
        desktop: 'src/index.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime', 'react-dom'],
    },
  },
});
