// Bloxity (Legion) SDK integration, kept in one place.
// The SDK is loaded by a <script> tag in index.html (before the game's code) and exposes window.Legion.SDK. Every call is guarded,
// so the game still runs when the SDK is missing (blocked network, older SDK build, a page Boxity doesn't serve).
// ONE subscription to onUserChanged is the source of truth for who the player is (onIdentity hands it on).
// Every Boxity URL is built from the environment Boxity tells the page (env()), never from this page's own hostname.
import { LEADERBOARDS } from '../../shared/config.js';

export const GAME_SLUG = 'lockdown-escape';

const sdk = () => (window.Legion && window.Legion.SDK) || null;
const has = (path) => {
    let o = sdk();
    for (const k of path.split('.')) { if (!o) return false; o = o[k]; }
    return typeof o === 'function';
};
function call(path, ...args) {
    if (!has(path)) return undefined;
    const parts = path.split('.');
    const fn = parts.pop();
    let o = sdk();
    for (const k of parts) o = o[k];
    try { return o[fn](...args); } catch (e) { console.warn('[Bloxity]', path, e); return undefined; }
}

// ----- the environment: what Boxity told this page (prod when nothing was told) -----
const PROD = { env: 'prod', apiUrl: 'https://api.bloxity.io', playUrl: 'https://play.bloxity.io', portalUrl: 'https://bloxity.io', staticUrl: 'https://static.bloxity.io' };
const strip = (u) => String(u || '').replace(/\/$/, '');
export function env() {
    const told = call('environment') || window.BLOXITY_ENV || null;
    if (!told || typeof told !== 'object') return PROD;
    return { env: told.env || 'prod', apiUrl: strip(told.apiUrl) || PROD.apiUrl, playUrl: strip(told.playUrl) || PROD.playUrl, portalUrl: strip(told.portalUrl) || PROD.portalUrl, staticUrl: strip(told.staticUrl) || PROD.staticUrl };
}
export const onEnvironmentChanged = (cb) => call('onEnvironmentChanged', cb);
// this game's own page on CrazyGames (?cg=true on its own address): no fullscreen button of its own there
export const ON_CG = new URLSearchParams(location.search).get('cg') === 'true';

export const bloxity = {
    ready: false,
    user: null,       // LegionUser when logged in
    guest: null,      // GuestIdentity when signed out
    embedded: false,
    available: () => !!sdk(),
};

const userListeners = [];
export function onIdentity(cb) { userListeners.push(cb); cb(identity()); }

// Who the player is right now: a Bloxity user, a Bloxity guest, or nobody (no SDK)
export function identity() {
    const u = bloxity.user;
    if (u) return { loggedIn: true, id: u._id, name: u.displayName || u.username, username: u.username, pfp: u.pfp || '', token: call('auth.getToken') || '' };
    const g = bloxity.guest;
    if (g) return { loggedIn: false, id: '', name: g.displayName || g.username, username: g.username, pfp: g.pfp || '', token: '' };
    return { loggedIn: false, id: '', name: '', username: '', pfp: '', token: '' };
}

// Ad breaks: Boxity may start one at any time; the game pauses and mutes for it (main.js passes what to do)
const breakHooks = { start: null, end: null };
export function onAdBreak(start, end) { breakHooks.start = start; breakHooks.end = end; }

export function initBloxity() {
    if (!sdk() || bloxity.ready) return false;
    try { call('init', { gameSlug: GAME_SLUG }); } catch (e) { console.warn('[Bloxity] init failed', e); return false; }
    bloxity.ready = true;
    bloxity.embedded = !!call('portal.isEmbeddedInLegion');
    // Emote button in the portal overlay: register as soon as init returns
    call('game.registerFeature', 'emotes');
    // ad breaks: pause and mute, then resume
    call('ads.onBreakStart', () => { if (breakHooks.start) breakHooks.start(); });
    call('ads.onBreakEnd', () => { if (breakHooks.end) breakHooks.end(); });
    // every screen the game has: the full-screen panels (Shop, Pets, Upgrades, Quests, Daily, Wheel, Rebirth, Teleport, Leaderboards,
    // Settings...), Purge Run's queue and start line (lobby), its results card (results), and play itself (gameplay banners stay off:
    // the developer chose none while running). There is no start menu: you land straight in the Atrium.
    call('ads.declareScreens', {
        panel: { slots: [{ position: 'middle-right', sizes: ['300x600', '160x600'] }, { position: 'bottom-center', sizes: ['728x90', '320x50'] }] },
        lobby: { slots: [{ position: 'middle-left', sizes: ['300x600', '160x600'] }, { position: 'middle-right', sizes: ['300x600', '160x600'] }] },
        results: { slots: [{ position: 'middle-left', sizes: ['300x600', '160x600'] }, { position: 'middle-right', sizes: ['300x600', '160x600'] }] },
        gameplay: {},
    });
    // the leaderboards (the server submits the scores; declaring them here is what shows the trophy button)
    call('leaderboard.define', LEADERBOARDS);
    call('auth.onUserChanged', (user) => {
        bloxity.user = user || null;
        bloxity.guest = user ? null : (call('auth.getGuest') || null);
        const id = identity();
        for (const cb of userListeners) cb(id);
    });
    return true;
}

// ----- avatar -----
export function getEquipped() { return call('avatar.getEquipped') || null; }
export function getProportions() { return call('avatar.getProportions') || null; }
export function getSkinTextureUrl() { return call('avatar.getSkinTextureUrl') || ''; }
export function onAvatarChanged(cb) { return call('avatar.onAvatarChanged', cb); }
export function onProportionsChanged(cb) { return call('avatar.onProportionsChanged', cb); }
export function showCustomizer() { return call('avatar.showCustomizer'); }
// every bone-attached slot besides the hat and the back (hair, mask, neck, chest, waist, hand, shoes, and any slot Boxity adds later),
// and the CDN files for one worn item; null for a slot nothing's worn in
export function accessorySlots() { const s = call('avatar.getAccessorySlots'); return Array.isArray(s) ? s : null; }
export function accessoryUrls(field, id) { return call('avatar.getAccessoryUrls', field, id) || null; }
export function skinUrlFor(eq) { return call('avatar.getSkinTextureUrlFor', eq) || ''; }
// the platform character kit: dresses a cloned player.glb rig in the whole look (null when it's off or can't)
export function outfitKeyFor(eq) { return call('avatar.getOutfitKeyFor', eq) || ''; }
export function canDress(key) { return !!key && !!call('character.canDress', key); }
export async function dress(opts) { if (!has('character.dress')) return null; try { return (await call('character.dress', opts)) || null; } catch (e) { return null; } }
// a player's own uploaded character (getEquipped().characterId): its GLB and rig, or null
export async function characterFor(eq) { if (!has('avatar.getCharacterFor')) return null; try { return (await call('avatar.getCharacterFor', eq)) || null; } catch (e) { return null; } }
export function characterAccessoryMatrix(character, bone) { return call('avatar.characterAccessoryMatrix', character, bone) || null; }
export function currentAvatar() {
    const eq = getEquipped() || (bloxity.user && bloxity.user.avatar) || (bloxity.guest && bloxity.guest.avatar) || null;
    const props = getProportions() || (eq && eq.proportions) || null;
    return eq ? { ...eq, proportions: props || undefined } : null;
}

// ----- settings (values are strings) -----
export function listenSetting(key, cb) { return call('settings.listen', key, cb); }
export function triggerAllSettings() { call('settings.triggerAll'); }
// the game's own Settings panel changed one: Boxity saves it for every game (its listeners fire as usual)
export function saveSettings(o) { call('settings.set', o); }

// ----- lifecycle & rooms -----
export const loadingStep = (text) => call('game.loadingStep', text);
export const loadingEnd = () => call('game.loadingEnd');
export const gameplayStart = () => call('game.gameplayStart');
export const gameplayEnd = () => call('game.gameplayEnd');
export const updateRoom = (roomId) => call('game.updateRoom', roomId || '');
export const playerJoined = (name) => call('game.playerJoined', name);
export const playerInRoom = (name) => call('game.playerInRoom', name);

// ----- multiplayer matchmaker (Bloxity hosting): { endpoint, ... } pinned to one pod, or null -----
export async function resolveEndpoint(gameId, version) {
    if (!has('net.resolveEndpoint')) return null;
    try {
        const opts = {};
        if (version) opts.version = version;
        const r = (await call('net.resolveEndpoint', gameId, opts)) || null;
        return r && r.endpoint ? r : null;
    } catch (e) {
        console.warn('[Bloxity] matchmaker', e && e.message);
        return null;
    }
}

// ----- portal -----
export const showPortalMenu = () => call('portal.showMenu', true);
export const isEmbedded = () => bloxity.embedded;

// ----- player events from the portal: respawn, chat, emotes -----
export function onPortalEvent(cb) {
    if (has('player.onEvent')) return call('player.onEvent', cb);
    call('player.onRespawnRequest', () => cb('respawn_request'));
    call('player.onChatMessageSent', (m) => cb('chat_message_sent', m));
    return undefined;
}

// ----- chat: Boxity draws the chat box; the game shows each player's latest line over their head -----
export const hasChat = () => has('chat.onMessage');
export const onChat = (cb) => call('chat.onMessage', cb);
export function bubbleText(m) { return call('chat.bubbleText', m) || (m && m.isGif ? 'sent a GIF' : String((m && m.text) || '').slice(0, 60)); }
export const bubbleSeconds = () => { const s = sdk(); return (s && s.chat && s.chat.bubbleSeconds) || 4; };
export const attachBubble = (THREE, root, text) => call('chat.attachBubble', THREE, root, text);

// ----- ads: screens (banners round a panel or the results), rewarded ads -----
export function adScreen(type) { return call('ads.screen', type) || null; }
export const hideAdScreen = () => call('ads.hideScreen');
export const adsAvailable = () => !!call('ads.isAvailable');
export async function showRewarded(placement) {
    if (!has('ads.showRewarded')) return { status: 'disabled' };
    try { return (await call('ads.showRewarded', placement)) || { status: 'error' }; } catch (e) { return { status: 'error' }; }
}

// ----- the death screen: Boxity shows ads round the game while you're knocked out, and the game's own buttons wait for its countdown
// (at least 4 s). Outside Boxity (or with no death-screen ads) the countdown is 0 at once and respawn() is true, so one code path
// works everywhere. show() hands back { onCountdown(cb) -> unsubscribe, respawn() -> boolean, ready } -----
const noDeath = () => ({ onCountdown(cb) { try { cb(0); } catch (e) { /* the game's own */ } return () => {}; }, respawn: () => true, ready: Promise.resolve() });
export function deathShow() {
    if (!has('deathScreen.show')) return noDeath();
    const d = call('deathScreen.show');
    return d && typeof d.respawn === 'function' ? d : noDeath();
}
export const deathHide = () => call('deathScreen.hide');

// ----- leaderboards: Boxity's own panel (false outside Boxity) -----
export const openLeaderboard = (id) => !!call('leaderboard.open', id);

// ----- social -----
export async function getFriends() { try { return (await call('social.getFriends')) || []; } catch (e) { return []; } }
export const getInviteLink = () => call('social.getInviteFriendsLink') || location.href;

// This game has no in-app purchases: everything is bought with Wins or Gems earned in the game, so there is no Gems purchase code.

// ----- emote catalogue (public endpoint, from the told environment) -----
let emoteCatalog = null;
export async function loadEmotes() {
    if (emoteCatalog) return emoteCatalog;
    try {
        const r = await fetch(env().apiUrl + '/v1/avatar/emotes');
        const { emotes } = await r.json();
        emoteCatalog = new Map((emotes || []).map((e) => [e.id, e]));
    } catch (e) { emoteCatalog = new Map(); }
    return emoteCatalog;
}
