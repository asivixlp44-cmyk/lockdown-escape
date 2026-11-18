import { defineConfig } from 'vite';

// The dev server only (apply: 'serve'): tells a standalone local page it runs against a local Boxity, before any of the game's code.
// A production build is told nothing here: Boxity injects window.BLOXITY_ENV into the pages it serves (prod / stage), and a page
// Boxity doesn't serve runs against prod.
const localBoxity = {
    name: 'local-boxity-env',
    apply: 'serve',
    transformIndexHtml(html) {
        if (process.env.NO_LOCAL_ENV) return html;
        const env = "<script>window.BLOXITY_ENV = { env: 'local', apiUrl: 'http://localhost:4000', playUrl: 'http://localhost:2567', portalUrl: 'http://localhost:3000', staticUrl: 'https://static.bloxity.io' };</script>";
        return html.replace('<head>', '<head>\n' + env);
    },
};

export default defineConfig({
    plugins: [localBoxity],
    // shared/ lives next to client/ and is imported by both client and server.
    // NO_HMR (the test runs): no hot reload, so an edit saved mid-run never reloads a page under test
    server: { fs: { allow: ['..'] }, port: 5719, hmr: process.env.NO_HMR ? false : undefined, watch: process.env.NO_HMR ? { ignored: ['**/*'] } : undefined },
    build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
