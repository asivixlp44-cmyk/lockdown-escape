import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

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

// The production build loads three.js from jsDelivr (a fast public CDN, cached worldwide) instead of bundling it: Boxity's hosting can
// be very slow the first time a freshly deployed file is fetched (40+ seconds for the whole bundle from Sri Lanka), so a third of the
// bytes no longer come from there. The exact version installed here, through an import map, so the addons share the one copy.
// (Dev builds and the test runs keep using node_modules.)
const THREE_VERSION = JSON.parse(readFileSync(new URL('./node_modules/three/package.json', import.meta.url), 'utf8')).version;
const THREE_CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}`;
const threeFromCdn = {
    name: 'three-from-cdn',
    apply: 'build',
    transformIndexHtml() {
        return [
            { tag: 'script', attrs: { type: 'importmap' }, children: JSON.stringify({ imports: { three: `${THREE_CDN}/build/three.module.min.js`, 'three/addons/': `${THREE_CDN}/examples/jsm/` } }), injectTo: 'head-prepend' },
            { tag: 'link', attrs: { rel: 'preconnect', href: 'https://cdn.jsdelivr.net', crossorigin: '' }, injectTo: 'head' },
            { tag: 'link', attrs: { rel: 'modulepreload', href: `${THREE_CDN}/build/three.module.min.js`, crossorigin: '' }, injectTo: 'head' },
            { tag: 'link', attrs: { rel: 'modulepreload', href: `${THREE_CDN}/build/three.core.min.js`, crossorigin: '' }, injectTo: 'head' },
        ];
    },
};
// (VITE_BUNDLE_THREE=1: bundle three as before, for a build that must not depend on the CDN)
const CDN = !process.env.VITE_BUNDLE_THREE;

export default defineConfig({
    plugins: [localBoxity, ...(CDN ? [threeFromCdn] : [])],
    // shared/ lives next to client/ and is imported by both client and server.
    // NO_HMR (the test runs): no hot reload, so an edit saved mid-run never reloads a page under test
    server: { fs: { allow: ['..'] }, port: 5719, hmr: process.env.NO_HMR ? false : undefined, watch: process.env.NO_HMR ? { ignored: ['**/*'] } : undefined },
    build: {
        target: 'es2022',
        chunkSizeWarningLimit: 1500,
        rollupOptions: CDN ? { external: (id) => id === 'three' || id.startsWith('three/') } : {},
    },
});
