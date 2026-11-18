// Server-side Bloxity integration: who a player is (the game token, verified), rewarded-ad tokens, the leaderboards and the profile
// stats. This game has no in-app purchases (everything costs Wins or Gems earned in the game), so there is no Gems webhook.
// Every Boxity URL comes from the environment Boxity hosting injects (prod fallbacks only when a variable is missing).
import { allProfiles } from './profiles.js';
import { LEADERBOARDS, stageScore } from '../../shared/config.js';

export const ENV = {
    env: process.env.BLOXITY_ENV || 'prod',
    apiUrl: (process.env.BLOXITY_API_URL || 'https://api.bloxity.io').replace(/\/$/, ''),
    playUrl: (process.env.BLOXITY_MATCHMAKER_URL || 'https://play.bloxity.io').replace(/\/$/, ''),
    portalUrl: (process.env.BLOXITY_PORTAL_URL || 'https://bloxity.io').replace(/\/$/, ''),
    staticUrl: (process.env.BLOXITY_STATIC_URL || 'https://static.bloxity.io').replace(/\/$/, ''),
};
export const API_URL = ENV.apiUrl;
export const GAME_SLUG = process.env.BLOXITY_GAME_SLUG || process.env.BLOXITY_GAME_ID || 'lockdown-escape';

async function fetchJson(url, opts, ms) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms || 6000);
    try {
        const r = await fetch(url, { ...opts, signal: ctl.signal });
        const body = await r.json().catch(() => null);
        return { ok: r.ok, status: r.status, body };
    } finally { clearTimeout(timer); }
}

// Verifies a player's Bloxity game token with Boxity (POST /v1/auth/game-token/verify). Only the user id Boxity returns is ever used
// as an account id. Returns { id, name, username, carriedFrom } or null (no token, refused, unreachable): the player is a guest.
export async function verifyBloxityToken(token) {
    if (!token || typeof token !== 'string' || token.length > 4096) return null;
    try {
        const r = await fetchJson(`${API_URL}/v1/auth/game-token/verify`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameSlug: GAME_SLUG }),
        });
        if (!r.ok || !r.body || r.body.valid === false) return null;
        const u = r.body.user || null;
        if (!u || !u._id) return null;
        const carried = Array.isArray(r.body.carriedFrom) ? r.body.carriedFrom.map(String).slice(0, 5) : [];
        return { id: String(u._id), name: String(u.displayName || u.username || '').slice(0, 20), username: String(u.username || ''), carriedFrom: carried };
    } catch (e) {
        return null;
    }
}

// A rewarded ad's token (a FREE revive, a FREE stage skip, x2 Speed): valid once, for this game, within 5 minutes
export async function verifyAdReward(rewardToken) {
    if (!rewardToken || typeof rewardToken !== 'string' || rewardToken.length > 4096) return false;
    try {
        const r = await fetchJson(`${API_URL}/v1/ads/reward/verify`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameSlug: GAME_SLUG, rewardToken }),
        });
        return !!(r.ok && r.body && r.body.valid === true);
    } catch (e) { return false; }
}

// ----- leaderboards: scores come from server-owned state only, batched -----
const REPORT_TOKEN = process.env.BLOXITY_REPORT_TOKEN || '', GAME_ID = process.env.BLOXITY_GAME_ID || '';
const scoreQueue = [];
// board: a BOARDS id; for 'sum' boards the amount just gained, else the score itself
export function queueScore(uid, board, score) {
    if (!REPORT_TOKEN || !GAME_ID || !uid || !uid.startsWith('legion_') || !Number.isFinite(score) || score <= 0) return;
    const userId = uid.split('#m')[0];
    // a 'sum' board adds up: merge with what's queued for that player already
    const def = LEADERBOARDS.find((b) => b.id === board);
    if (def && def.mode === 'sum') { const q = scoreQueue.find((e) => e.board === board && e.userId === userId); if (q) { q.score += score; return; } }
    else if (def) { const q = scoreQueue.find((e) => e.board === board && e.userId === userId); if (q) { q.score = Math.max(q.score, score); return; } }
    scoreQueue.push({ board, userId, score: Math.round(score) });
}
let boardsSent = false;
async function flushScores() {
    if (!REPORT_TOKEN || !GAME_ID) return;
    if (!scoreQueue.length && boardsSent) return;
    const batch = scoreQueue.splice(0, 200);
    try {
        const body = { scores: batch };
        if (!boardsSent) body.boards = LEADERBOARDS;
        const r = await fetchJson(`${API_URL}/v1/leaderboards/hosted/${GAME_ID}/report`, {
            method: 'POST', headers: { Authorization: `Bearer ${REPORT_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        }, 8000);
        if (r.ok) boardsSent = true;
        else scoreQueue.unshift(...batch.slice(0, 200 - scoreQueue.length));
        if (!r.ok || (r.body && r.body.dropped && Object.keys(r.body.dropped).length)) console.log('[leaderboards]', r.status, JSON.stringify(r.body && (r.body.dropped || r.body.error || r.body)));
    } catch (e) {
        scoreQueue.unshift(...batch);
        console.warn('[leaderboards] report failed:', e.message);
    }
}
export function installLeaderboards() {
    if (!REPORT_TOKEN || !GAME_ID) return { flush: async () => {} };
    setInterval(flushScores, 15000).unref();
    setTimeout(flushScores, 4000).unref();
    return { flush: flushScores };
}

// ----- Stat reporting to Bloxity profiles ("Only in this game") -----
const STAT_DEFS = [
    { key: 'stage', label: 'Highest Stage', type: 'number', sortOrder: 1 },
    { key: 'wins', label: 'Wins Earned', type: 'number', sortOrder: 2 },
    { key: 'speed', label: 'Top Speed', type: 'number', sortOrder: 3 },
    { key: 'rebirths', label: 'Rebirths', type: 'number', sortOrder: 4 },
    { key: 'races', label: 'Races Won', type: 'number', sortOrder: 5 },
    { key: 'pets', label: 'Eggs Hatched', type: 'number', sortOrder: 6 },
    { key: 'playtime', label: 'Playtime', type: 'seconds', sortOrder: 7 },
];
const LIMIT = { number: 1e12, seconds: 31536000000, currency: 1e12, percent: 100 };
const okValue = (v, type) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= LIMIT[type];

export function installStatReporter() {
    if (!REPORT_TOKEN || !GAME_ID) return { flush: async () => {} };
    const url = `${API_URL}/v1/games/${GAME_ID}/stats`;
    async function flush() {
        try {
            const players = [];
            for (const p of allProfiles()) {
                if (!p.uid || !p.uid.startsWith('legion_')) continue;
                const values = {};
                const raw = { stage: stageScore(p), wins: Math.floor(p.totalWins || 0), speed: Math.floor(p.topSpeed || 0), rebirths: Math.floor(p.rebirths || 0), races: Math.floor(p.matchWins || 0), pets: Math.floor(p.hatched || 0), playtime: Math.floor(p.playtime || 0) * 1000 };
                for (const d of STAT_DEFS) if (okValue(raw[d.key], d.type)) values[d.key] = raw[d.key];
                if (Object.keys(values).length) players.push({ userId: p.uid.split('#m')[0], values });
            }
            for (let i = 0; i < players.length; i += 200) {
                const r = await fetchJson(url, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${REPORT_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ definitions: STAT_DEFS, players: players.slice(i, i + 200) }),
                }, 8000);
                if (!r.ok) console.log('[Bloxity stats]', r.status, JSON.stringify(r.body));
            }
        } catch (e) {
            console.warn('[Bloxity stats] report failed:', e.message);
        }
    }
    setInterval(flush, 60000).unref();
    setTimeout(flush, 5000).unref();
    return { flush };
}
