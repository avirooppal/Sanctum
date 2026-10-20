import {defineConfig} from 'vite';
// Development reuse library; this is not a desktop app or a user-facing route.
export default defineConfig({build:{lib:{entry:{api:'src/api.ts',markdown:'src/ui/SafeMarkdown.tsx'},formats:['es']},rollupOptions:{external:['react','react/jsx-runtime']}}});
