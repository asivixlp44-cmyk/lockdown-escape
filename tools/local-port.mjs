// Picks the port start-local.bat uses. Prints "running <port>" when Lockdown Escape already answers on a port, else "free <port>":
// 3191 first, then the next free one, so another local game or test server sitting on 3191 never gets opened as Lockdown Escape.
// No dependencies (runs before npm install).
import net from 'node:net';

const BASE = 3191;
const LAST = 3197; // 3198 is the test suite's port

const isOurs = async (port) => {
    try {
        const r = await fetch(`http://localhost:${port}/health`, { signal: AbortSignal.timeout(1500) });
        return (await r.json()).game === 'lockdown-escape';
    } catch (e) {
        return false;
    }
};
const isFree = (port) => new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(port);
});

for (let port = BASE; port <= LAST; port++) {
    if (await isOurs(port)) { console.log('running', port); process.exit(0); }
    if (await isFree(port)) { console.log('free', port); process.exit(0); }
}
console.log('none', BASE);
process.exit(1);
