// Player-facing text for the preview. Core owns the string tables (core/data/i18n.ts); keys the core does not
// define yet fall back to the English table below, so the preview never shows a raw key.
import { t as coreT, STRINGS_EN, type Lang } from '../../../assets/scripts/core/data/i18n';

const EN: Record<string, string> = {
  // title / settings
  'title.enter': 'Enter the Hold',
  'title.first': 'Light the Hearth',
  'title.status': 'Night {n} - Threat {tr} - Hearth tier {tier}',
  'title.preview': 'web preview',
  'ui.settings': 'Settings', 'ui.back': 'Back', 'ui.close': 'Close', 'ui.pause': 'Paused', 'ui.resume': 'Resume', 'ui.quit': 'Save & quit',
  'ui.music': 'Music', 'ui.sfx': 'Sound', 'ui.haptics': 'Vibration', 'ui.bigText': 'Big text', 'ui.language': 'Language',
  'ui.on': 'On', 'ui.off': 'Off', 'ui.resetData': 'Erase the Hold', 'ui.resetConfirm': 'Erase the Hold? This cannot be undone.',
  'ui.resetConfirm2': 'Really erase everything?', 'ui.export': 'Export save', 'ui.import': 'Import save',
  // away
  'away.title': 'While you were away',
  'away.time': 'Away for {t}',
  'away.villagers': 'Villagers worked',
  'away.dispatch': '{hero} is back ({kind})',
  'away.bounties': '{n} new bounties',
  'away.traveler': 'A traveler waits at the market',
  'away.warmth': 'Hearth warmth {d}',
  'away.nothing': 'All quiet. The Hold waited for you.',
  'away.collect': 'Collect all',
  // bottom bar
  'bar.build': 'Build', 'bar.hero': 'Heroes', 'bar.village': 'Village', 'bar.book': 'Book', 'bar.map': 'Map',
  'hud.bell': 'Dusk bell', 'hud.bellBonus': '+10% loot', 'hud.threat': 'Threat {x}/{cap}', 'hud.threatNoCap': 'Threat {x}',
  'hud.atCap': 'Threat at cap - seal the Rift Heart', 'hud.night': 'NIGHT {n}', 'hud.day': 'DAY {n}', 'hud.dusk': 'DUSK {n}', 'hud.dawn': 'DAWN {n}',
  'hud.enemiesLeft': '{n} left', 'hud.storageFull': 'Storage full', 'hud.goals': 'Next goals',
  'hud.goal.session': 'Now', 'hud.goal.day': 'Today', 'hud.goal.week': 'This week',
  'hud.horn': 'RALLY!', 'hud.hearthLow': 'The Hearth is failing!',
  // dusk
  'dusk.omens': 'Omens - night {n}', 'dusk.moon': 'Moon', 'dusk.event': 'Event', 'dusk.beacon': 'Beacon', 'dusk.garrison': 'Garrison',
  'dusk.startNight': 'Start the night', 'dusk.garrisonHint': 'Tap a hero, then a tower (lvl 2+)', 'dusk.siege': 'Rift Heart siege',
  'dusk.forcedCalm': 'Recovering: calm for {n} more night(s)',
  'beacon.calm': 'Calm', 'beacon.steady': 'Steady', 'beacon.fierce': 'Fierce', 'beacon.nightmare': 'Nightmare',
  'beacon.calm.reward': 'x0.6 loot, threat +0', 'beacon.steady.reward': 'x1 loot, threat +1',
  'beacon.fierce.reward': 'x1.6 loot, 4 gifts', 'beacon.nightmare.reward': 'x2.5 loot, rare gift',
  'beacon.locked.fierce': 'Hearth tier 2', 'beacon.locked.nightmare': 'Hearth tier 4',
  'moon.new': 'New moon', 'moon.crescent': 'Crescent', 'moon.half': 'Half moon', 'moon.gibbous': 'Gibbous', 'moon.full': 'Full moon',
  'moon.waning': 'Waning', 'moon.blood': 'BLOOD MOON',
  'moon.new.rule': 'Darker: light -1, essence x1.5', 'moon.crescent.rule': 'No change', 'moon.half.rule': 'Wind: tower range -1, traps +50%',
  'moon.gibbous.rule': 'Mist: an extra flying wave', 'moon.full.rule': 'Bright: light +1, heroes +15%', 'moon.waning.rule': 'Still: braziers burn free',
  'moon.blood.rule': 'Siege x1.5 with a Gloom Champion',
  'event.none': 'No event', 'event.swarm': 'Swarm', 'event.pincer': 'Pincer', 'event.hunters': 'Fire hunters', 'event.short': 'Short night', 'event.rain': 'Rain',
  // night / dawn / gutter
  'banner.night': 'NIGHT {n}', 'banner.blood': 'BLOOD MOON', 'banner.boss': 'A great Gloom approaches', 'banner.day': 'Day {n}',
  'dawn.title': 'Dawn', 'dawn.won': 'Night {n} held!', 'dawn.choose': 'Choose a dawn gift', 'dawn.reroll': 'Reroll',
  'dawn.full': 'Blessings full - drop one?', 'dawn.chest': 'Chest', 'dawn.expedition': 'Trip boon',
  'gift.blessing': 'Blessing, {n} nights', 'gift.resources': 'Supplies', 'gift.rare': 'Rare gift', 'gift.shards': '{n} {hero} shards', 'gift.gear': 'A piece of gear', 'gift.lore': '{n} lore pages',
  'gutter.title': 'The fire gutters', 'gutter.sub': 'The Hearth sputters - but it will burn again at dawn.',
  'gutter.lost': 'Scattered in the dark', 'gutter.kept': 'Safe in the vault', 'gutter.ruins': '{n} buildings in ruins',
  'gutter.rebuildAll': 'Rebuild all', 'gutter.return': 'Back to the village', 'gutter.goldKept': 'Gold kept: {n}',
  'gutter.calm': 'Next 2 nights will be calm',
  // build
  'build.tab.defense': 'Defense', 'build.tab.light': 'Light', 'build.tab.traps': 'Traps', 'build.tab.economy': 'Village',
  'build.rebuildAll': 'Rebuild all', 'build.relocate': 'Hold to move', 'build.ruin': 'Ruin', 'build.rebuild': 'Rebuild', 'build.clear': 'Clear',
  'build.fail.cost': 'Not enough', 'build.fail.blocked': 'Blocked', 'build.fail.dark': 'Too dark', 'build.fail.locked': 'Locked',
  'build.fail.unique': 'Only one', 'build.fail.cap': 'Limit reached', 'build.fail.phase': 'Not now',
  // building panel
  'panel.level': 'Level {n}', 'panel.hp': 'HP {a}/{b}', 'panel.workers': 'Workers {a}/{b}', 'panel.garrison': 'Garrison',
  'panel.module': 'Module', 'panel.upgrade': 'Upgrade', 'panel.repair': 'Repair', 'panel.sell': 'Sell', 'panel.move': 'Move',
  'panel.unpowered': 'Not fully lit - idle', 'panel.none': 'none', 'panel.tierUp': 'Raise tier', 'panel.tierCond': 'Needs: {c}',
  // hero
  'hero.title': 'Heroes', 'hero.squad': 'Squad', 'hero.garrison': 'Garrison', 'hero.dispatch': 'Dispatch', 'hero.rest': 'Resting',
  'hero.level': 'Lv {n}', 'hero.shards': '{a}/{b} shards', 'hero.starUp': 'Star up', 'hero.unlock': 'Unlock', 'hero.toSquad': 'Join squad',
  'hero.leaveSquad': 'Leave squad', 'hero.gear': 'Gear', 'hero.skills': 'Skill path', 'hero.locked': 'Not recruited',
  'hero.dispatchFor': 'Send {kind} {m}m', 'hero.back': 'Back in {t}', 'dispatch.forage': 'Forage', 'dispatch.hunt': 'Hunt', 'dispatch.scout': 'Scout',
  // village
  'village.title': 'Village', 'village.villagers': 'Villagers {a}/{b}', 'village.hungry': '{n} hungry', 'village.food': 'Food {n}',
  'village.auto': 'Auto-assign', 'village.storage': 'Storage', 'village.cap': 'Cap {n}', 'village.jobs': 'Workplaces',
  'village.forge': 'Forge', 'village.study': 'Study', 'village.market': 'Market', 'village.warmth': 'Warmth {n}/7',
  'forge.title': 'Forge', 'forge.craft': 'Craft', 'forge.salvage': 'Salvage', 'forge.slot.weapon': 'Weapon', 'forge.slot.armor': 'Armor', 'forge.slot.charm': 'Charm',
  'rarity.common': 'Common', 'rarity.rare': 'Rare', 'rarity.epic': 'Epic',
  'study.title': 'Study', 'study.branch.0': 'Fortification', 'study.branch.1': 'Flame', 'study.branch.2': 'Stewardship', 'study.research': 'Research',
  'market.title': 'Market', 'market.traveler': 'Traveler', 'market.none': 'No traveler today. One comes every 3rd dawn.', 'market.buy': 'Trade', 'market.sold': 'Sold',
  // book
  'book.title': 'Book', 'book.bounties': 'Bounties', 'book.chronicle': 'Chronicle', 'book.gloom': 'Gloom book', 'book.achievements': 'Feats',
  'book.claim': 'Claim', 'book.reroll': 'Swap', 'book.deeds': '{n} deeds', 'book.week': 'Week {n}', 'book.kills': '{n} slain', 'book.unseen': '???',
  // map / dock / expedition
  'map.title': 'The Island', 'map.region': 'Region {n}', 'map.sealed': 'Sealed', 'map.veiled': 'Veiled',
  'region.1': 'Ember Meadow', 'region.2': 'Darkpine Wood', 'region.3': 'Stonefield', 'region.4': 'Frost Rim', 'region.5': 'Ashlands',
  'dock.title': 'Dock', 'dock.trails': 'New Trails {n}', 'dock.tier': 'Tier {n}', 'dock.sail': 'Set sail', 'dock.focus': 'Focus: {f}',
  'dock.noTrail': 'No trail: basic loot only', 'dock.squad': 'Crew',
  'focus.iron': 'iron', 'focus.essence': 'essence', 'focus.shards': 'hero shards', 'focus.lore': 'lore', 'focus.regional': 'regional', 'focus.blueprint': 'blueprint',
  'exp.carried': 'Carrying', 'exp.chests': 'Chests {a}/{b}', 'exp.extract': 'Extracting...', 'exp.toBoat': 'Boat', 'exp.abandon': 'Abandon',
  'exp.result.extracted': 'Extracted!', 'exp.result.timeout': 'Out of time', 'exp.result.wiped': 'Crew fell',
  'exp.result.sub.extracted': 'Everything you carried made it home.', 'exp.result.sub.timeout': 'Half of the haul made it to the boat.',
  'exp.result.sub.wiped': 'Half of the haul was dragged back.', 'exp.kept': 'Brought home', 'exp.home': 'Sail home',
  // storage
  'storage.title': 'Storage', 'storage.protected': 'Vault protects {n} each',
  // resources
  'res.wood': 'Wood', 'res.stone': 'Stone', 'res.gold': 'Gold', 'res.iron': 'Iron', 'res.food': 'Food', 'res.essence': 'Essence',
  'res.lore': 'Lore', 'res.resin': 'Resin', 'res.frost': 'Frost', 'res.coal': 'Coal',
  // unlock cards
  'unlock.title': 'New!', 'unlock.generic': '{what} is now available',
  // tutorial fallbacks
  'tutorial.skip': 'Skip',
};

let lang: Lang = 'en';
export function setLang(l: Lang) { lang = l; }
export function getLang(): Lang { return lang; }

export function tr(key: string, params?: Record<string, string | number>): string {
  if (key in STRINGS_EN) return coreT(key, lang, params);
  let s = EN[key];
  if (s === undefined) return key;
  if (params) for (const k in params) s = s.split(`{${k}}`).join(String(params[k]));
  return s;
}
export function has(key: string) { return key in STRINGS_EN || key in EN; }

/** "1h 20m" / "5m" / "3d 2h" for away / dispatch timers. */
export function fmtDuration(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${s}s`;
}
