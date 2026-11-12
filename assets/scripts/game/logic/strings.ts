// Player-facing text lookup for the view (no 'cc'). Core owns the gameplay string tables (core/data/i18n.ts); the
// view keeps the UI keys of the v2 screens here so the view never shows a raw key. A key the core defines wins.
// Text is rendered with the ASCII bitmap font (logic/text.toAscii folds diacritics and typographic punctuation).
import { t as coreT, STRINGS_EN, type Lang } from '../../core/data/i18n';

const EN: Record<string, string> = {
  // generic
  'ui.enterHold': 'Enter Hold', 'ui.begin': 'Light the Hearth', 'ui.settings': 'Settings', 'ui.back': 'Back', 'ui.close': 'Close',
  'ui.yes': 'Yes', 'ui.no': 'No', 'ui.on': 'On', 'ui.off': 'Off', 'ui.music': 'Music', 'ui.sfx': 'Sound', 'ui.haptics': 'Vibration',
  'ui.bigText': 'Big text', 'ui.language': 'Language', 'ui.english': 'English', 'ui.vietnamese': 'Tieng Viet', 'ui.save': 'Save',
  'ui.export': 'Export', 'ui.import': 'Import', 'ui.exported': 'Save copied to the clipboard', 'ui.exportShown': 'Save string ready to copy',
  'ui.imported': 'Save imported', 'ui.importFailed': 'That save string could not be read', 'ui.importPrompt': 'Paste your Emberhold save string',
  'ui.erase': 'Erase data', 'ui.eraseConfirm1': 'Erase your Hold? This cannot be undone.', 'ui.eraseConfirm2': 'Really erase everything?',
  'ui.pause': 'Paused', 'ui.resume': 'Resume', 'ui.quit': 'Title', 'ui.collectAll': 'Collect all', 'ui.continue': 'Continue',
  'ui.loading': 'Loading', 'ui.locked': 'Locked', 'ui.max': 'Max', 'ui.level': 'Lv {n}', 'ui.tier': 'Tier {n}', 'ui.needTier': 'Hearth tier {n}',
  'ui.holdSummary': 'Night {n} - Threat {tr} - Hearth tier {t}', 'ui.firstHold': 'A new Hold awaits', 'ui.saveCorrupt': 'Your save could not be read. A new Hold was started.',
  'ui.saveRestored': 'Restored your Hold from the backup save.', 'ui.page': '{a}/{b}', 'ui.none': 'None', 'ui.done': 'Done', 'ui.claimed': 'Claimed',
  'ui.notEnough': 'Not enough resources', 'ui.cost': 'Cost {c}', 'ui.confirm': 'Confirm', 'ui.cancel': 'Cancel', 'ui.apply': 'Use', 'ui.owned': 'Owned',
  'ui.inUse': 'In use', 'ui.free': 'Free', 'ui.seconds': '{n}s',
  // phases + hud
  'phase.peace': 'Day', 'phase.dusk': 'Dusk', 'phase.night': 'Night', 'phase.dawn': 'Dawn',
  'hud.night': 'NIGHT {n}', 'hud.threat': 'Threat {x}/{cap}', 'hud.threatDeep': 'Threat {x}', 'hud.threatCap': 'Threat at cap - seal the Rift Heart to go on',
  'hud.enemiesLeft': '{n} left', 'hud.storageFull': 'Storage full: {res}', 'hud.bell': 'Dusk Bell', 'hud.bellBonus': '+10% night loot',
  'hud.startNight': 'Start night', 'hud.hearthLow': 'The Hearth is failing!', 'hud.siege': 'RIFT HEART SIEGE', 'hud.horn': 'Horn',
  'hud.blessingNights': '{n}', 'hud.warmth': 'Warmth {n}/7', 'hud.relocate': 'Drag to move - release to place', 'hud.bloodMoon': 'BLOOD MOON',
  'banner.boss': 'A great foe approaches', 'banner.tier': 'Hearth tier {n}', 'banner.sealed': 'Region sealed', 'banner.unlock': 'Unlocked',
  'banner.enrage': 'The Gloom grows restless', 'banner.dawn': 'Dawn breaks',
  'tab.build': 'Build', 'tab.hero': 'Heroes', 'tab.village': 'Village', 'tab.book': 'Book', 'tab.map': 'Map',
  'goal.title': 'Next goal', 'goal.session': 'Now', 'goal.day': 'Today', 'goal.week': 'This week',
  // away
  'away.title': 'While you were away ({t})', 'away.villagers': 'Your villagers kept working', 'away.dispatch.forage': '{hero} returned from foraging',
  'away.dispatch.hunt': '{hero} returned from the Gloom hunt', 'away.dispatch.scout': '{hero} returned from scouting', 'away.bounties': '{n} new bounties posted',
  'away.traveler': 'A traveler waits at the market', 'away.warmthUp': 'Hearth warmth +{n}', 'away.warmthDown': 'Hearth warmth -{n}',
  'away.quiet': 'All quiet. The Hold waited for you.',
  // build
  'build.tab.defense': 'Defense', 'build.tab.light': 'Light', 'build.tab.traps': 'Traps', 'build.tab.economy': 'Economy',
  'build.total': 'Total', 'build.bulkUpgrade': 'Upgrade brush', 'build.bulkRepair': 'Repair brush', 'build.rebuildAll': 'Rebuild all',
  'build.bulkHint': 'Drag over buildings', 'build.fail.cost': 'Not enough resources', 'build.fail.blocked': 'Something is in the way',
  'build.fail.dark': 'Only in the static light', 'build.fail.locked': 'Not unlocked yet', 'build.fail.unique': 'Only one allowed',
  'build.fail.cap': 'Building limit reached', 'build.fail.phase': 'Not during the night',
  // building panel
  'bp.level': 'Level {n}/{m}', 'bp.hp': 'HP {a}/{b}', 'bp.workers': 'Workers {a}/{b}', 'bp.garrison': 'Garrison', 'bp.module': 'Module',
  'bp.upgrade': 'Upgrade', 'bp.repair': 'Repair', 'bp.sell': 'Sell', 'bp.relocate': 'Move', 'bp.rebuild': 'Rebuild', 'bp.clear': 'Clear',
  'bp.upgradeHearth': 'Raise tier', 'bp.hearthNote': 'The Hearth heals fully every dawn', 'bp.unpowered': 'Needs full light to work',
  'bp.frozen': 'Frozen', 'bp.burning': 'Burning', 'bp.ruined': 'Rubble - rebuild for 50%', 'bp.noModule': 'No module', 'bp.moduleSlot': 'Module slot at level 3',
  'bp.garrisonEmpty': 'Empty - assign at dusk', 'bp.sellAll': 'Refund {p}%', 'bp.hearthReq': 'Needs: {c}',
  // dusk / omens
  'omen.title': 'Omens', 'omen.subtitle': 'Tonight the Gloom brings', 'omen.elite': 'elite', 'omen.boss': 'BOSS', 'omen.rift': 'rift {n}',
  'omen.beacon': 'Beacon', 'beacon.calm': 'Calm', 'beacon.steady': 'Steady', 'beacon.fierce': 'Fierce', 'beacon.nightmare': 'Nightmare',
  'beacon.reward': 'Foes x{b}  Loot x{l}  Threat +{t}', 'beacon.extra.fierce': '+1 gift choice', 'beacon.extra.nightmare': 'Rare gift sure',
  'beacon.extra.calm': 'No hero shards', 'beacon.extra.steady': '', 'beacon.forced': 'The Hold rests: Calm for {n} more nights', 'beacon.locked': 'Hearth tier {n}',
  'siege.title': 'Rift Heart siege', 'siege.text': 'The region boss comes with the Gloom. Win to seal the region.',
  'garrison.title': 'Garrison - drag a hero onto a tower', 'garrison.slots': '{a}/{b}', 'garrison.fail.level': 'Tower must be level 2+',
  'garrison.fail.slots': 'No free garrison slot', 'garrison.fail.ruined': 'That tower is rubble', 'garrison.fail.notTower': 'Heroes garrison on towers',
  'garrison.fail.none': 'Drop the hero on a tower', 'garrison.done': '{hero} holds the tower',
  'moon.new': 'New moon', 'moon.crescent': 'Crescent', 'moon.half': 'Half moon', 'moon.gibbous': 'Gibbous', 'moon.full': 'Full moon',
  'moon.waning': 'Waning moon', 'moon.blood': 'Blood moon',
  'moon.new.rule': 'Darker: light -1, hidden foes +10% dmg, essence x1.5', 'moon.crescent.rule': 'No change tonight',
  'moon.half.rule': 'Wind: arrow/bolt range -1, traps +50%', 'moon.gibbous.rule': 'Mist: an extra wave of flyers',
  'moon.full.rule': 'Bright: light +1, heroes +15% dmg, gold x1.5', 'moon.waning.rule': 'Still air: braziers burn free',
  'moon.blood.rule': 'Siege: foes x1.5 and a Gloom Champion',
  'event.none': '', 'event.swarm': 'Swarm', 'event.pincer': 'Pincer', 'event.hunters': 'Fire hunters', 'event.short': 'Short night', 'event.rain': 'Rain',
  'event.swarm.rule': 'One kind of foe, 1.5x as many', 'event.pincer.rule': 'Two opposite rifts at once', 'event.hunters.rule': '3 extra Snuffers',
  'event.short.rule': 'Spawns in half the time', 'event.rain.rule': 'Braziers -1, tar will not burn, fire weaker',
  // dawn gifts
  'gifts.title': 'Dawn gifts', 'gifts.chest': 'Chest', 'gifts.expedition': 'Trip boon', 'gifts.choose': 'Choose one', 'gifts.reroll': 'Reroll',
  'gifts.full': 'Blessings are full - choose one to let go', 'gifts.blessing': 'Blessing - {n} nights', 'gifts.resources': 'Supplies',
  'gifts.rare': 'Rare gift', 'gifts.rare.shards': '{n} shards: {hero}', 'gifts.rare.gear': 'A piece of gear', 'gifts.rare.lore': '{n} lore pages',
  'gifts.drop': 'Let go', 'gifts.stack': 'Stack {n}/{m}',
  // fire gutters
  'gutter.title': 'The fire gutters', 'gutter.text': 'The Gloom broke through tonight, but your Hold stands. The Hearth rekindles at dawn.',
  'gutter.lost': 'Swept away', 'gutter.kept': 'Kept safe in the vault: {n} of each', 'gutter.ruins': '{n} buildings fell to rubble - they keep their level',
  'gutter.safe': 'Heroes, gear, research and the Hearth tier are untouched', 'gutter.gold': 'You still keep {n} gold from tonight',
  'gutter.rebuildAll': 'Rebuild all', 'gutter.return': 'Back to the village', 'gutter.calm': 'The next 2 nights will be Calm',
  // heroes
  'hero.title': 'Heroes', 'hero.squad': 'Squad {a}/{b}', 'hero.inSquad': 'In squad', 'hero.join': 'Join squad', 'hero.leave': 'Leave squad',
  'hero.stars': 'Stars', 'hero.lv': 'Lv {n}/{cap}', 'hero.shards': '{a}/{b} shards', 'hero.starUp': 'Star up', 'hero.collect': 'Collect {n} shards',
  'hero.status.squad': 'Squad', 'hero.status.garrison': 'Garrison', 'hero.status.dispatch': 'Away', 'hero.status.rest': 'Resting',
  'hero.skills': 'Skill paths', 'hero.skillAt': 'Level {n}', 'hero.skillLocked': 'Reach level {n}', 'hero.pathA': 'Path A', 'hero.pathB': 'Path B',
  'hero.respec': 'Change ({g} gold)', 'hero.gear': 'Gear', 'hero.inventory': 'Inventory: {slot}', 'hero.equip': 'Equip', 'hero.unequip': 'Remove',
  'hero.empty': 'Empty', 'hero.noItems': 'No {slot} items - craft one at the Forge', 'hero.dispatch': 'Scout trips', 'hero.send': 'Send',
  'hero.backIn': 'Back in {t}', 'hero.garrisonOn': 'Garrisoned on {b}', 'hero.ungarrison': 'Recall', 'hero.garrisonHint': 'Drag onto a tower at dusk',
  'hero.recruit': 'Recruit', 'hero.detail': 'Details', 'hero.noSlots': 'All scout trips busy', 'hero.squadFull': 'Squad is full',
  'slot.weapon': 'Weapon', 'slot.armor': 'Armor', 'slot.charm': 'Charm', 'rarity.common': 'Common', 'rarity.rare': 'Rare', 'rarity.epic': 'Epic',
  'gear.stats': '+{d}% dmg +{h}% hp', 'gear.reduce': '-{r}% dmg taken', 'gear.onHit': 'on hit: {e}',
  'dispatch.forage': 'Forage', 'dispatch.hunt': 'Gloom hunt', 'dispatch.scout': 'Scouting', 'dispatch.forage.desc': 'wood, stone, iron',
  'dispatch.hunt.desc': 'essence, gold, hero shards', 'dispatch.scout.desc': 'omens, trails, lore',
  // village
  'village.title': 'Village', 'village.people': 'People', 'village.storage': 'Storage', 'village.forge': 'Forge', 'village.study': 'Study',
  'village.market': 'Market', 'village.villagers': '{n} villagers - {i} idle', 'village.auto': 'Auto-assign', 'village.food': 'Food {f} - eats {n} at dawn',
  'village.hungry': '{n} hungry: work -50% until a fed dawn', 'village.fed': 'Everyone is fed', 'village.cap': 'Cap {n} each',
  'village.essenceCap': 'Essence cap {n}', 'village.vault': 'Protected if the fire gutters: {n} each', 'village.job': '{a}/{b} at work',
  'village.noJobs': 'Build a lumber camp, quarry or farm to give villagers work', 'village.homeless': 'Build houses for more villagers',
  'forge.craft': 'Craft', 'forge.salvage': 'Salvage', 'forge.modules': 'Modules', 'forge.blueprint': 'Needs a blueprint', 'forge.charm': 'Charm: {c}',
  'forge.random': 'Random charm', 'forge.needForge': 'Build a Forge to craft gear', 'forge.module': 'Craft module', 'forge.owned': 'x{n}',
  'study.branch0': 'Fortification', 'study.branch1': 'The Flame', 'study.branch2': 'Stewardship', 'study.next': 'Next: {n}', 'study.done': 'Complete',
  'study.needStudy': 'Build a Study to research',
  'market.traveler': 'Traveler', 'market.noTraveler': 'The traveler comes every 3rd dawn', 'market.trade': 'Trade', 'market.sold': 'Sold',
  'market.tavern': 'Tavern guest', 'market.noGuest': 'A hero visits the tavern at dawn', 'market.give.shards': '{n} shards: {hero}',
  'market.give.gear': '{r} gear', 'market.give.cosmetic': 'Decoration: {c}',
  // book
  'book.title': 'Book', 'book.bounties': 'Bounties', 'book.chronicle': 'Chronicle', 'book.gloom': 'Gloom book', 'book.achievements': 'Feats',
  'book.cosmetics': 'Looks', 'book.claim': 'Claim', 'book.reroll': 'Reroll', 'book.rerolls': 'Free rerolls: {n}', 'book.deeds': 'Deeds {n}',
  'book.week': 'Week {n}', 'book.step': 'Step {n}', 'book.kills': '{n} defeated', 'book.unseen': 'Not met yet', 'book.bonus': '+{n}% dmg',
  'book.ach': '{a}/{b} feats', 'book.flame': 'Flame', 'book.banner': 'Banner', 'book.wallSkin': 'Walls', 'book.default': 'Default',
  // map
  'map.title': 'The island', 'map.region': 'Region {n}', 'map.sealed': 'Sealed', 'map.open': 'Open', 'map.veiled': 'Behind the veil',
  'map.heart.sleep': 'Rift Heart sleeps', 'map.heart.awake': 'Rift Heart is awake - go touch it', 'map.heart.sealed': 'Rift Heart sealed',
  'map.rifts': '{n} rifts', 'map.dock': 'Dock', 'map.noDock': 'Build a dock on the shore', 'map.siege': 'Siege tonight', 'map.goDock': 'Open dock',
  'region.1': 'Ember Meadow', 'region.2': 'Darkpine Wood', 'region.3': 'Stonefield', 'region.4': 'Frost Rim', 'region.5': 'Ashland', 'region.6': 'Deep Gloom',
  // dock + expedition
  'dock.title': 'Dock', 'dock.trails': 'Trails left: {n}', 'dock.noTrail': 'No trails: only wood, stone, iron and gold', 'dock.setOff': 'Set off',
  'dock.squad': 'Squad: {n}', 'dock.tier': 'Tier {n}', 'dock.focus.iron': 'Iron', 'dock.focus.essence': 'Essence', 'dock.focus.shards': 'Hero shards',
  'dock.focus.lore': 'Lore', 'dock.focus.regional': 'Region goods', 'dock.focus.blueprint': 'Blueprints', 'dock.needDock': 'Build a Dock first',
  'dock.nightOnly': 'Only during the day',
  'biome.meadow': 'Meadow', 'biome.forest': 'Pinewood', 'biome.quarry': 'Quarry', 'biome.ruins': 'Ruins', 'biome.snow': 'Snowfield', 'biome.ash': 'Ashland',
  'biome.shore': 'Shore', 'biome.water': 'Sea',
  'exp.carried': 'Carrying', 'exp.toBoat': 'Back to the boat!', 'exp.extracting': 'Boarding {n}', 'exp.chests': 'Chests {a}/{b}',
  'exp.result.extracted': 'Safe return!', 'exp.result.timeout': 'Out of time', 'exp.result.wiped': 'The squad fell',
  'exp.kept': 'Brought home', 'exp.keptHalf': 'Half the haul was lost at sea', 'exp.home': 'Home', 'exp.abandon': 'Abandon',
  'exp.bossDown': 'Nest boss down!',
  // tutorial + intro cards
  'tutorial.skip': 'Skip', 'tutorial.0': 'Drag anywhere low on the screen to walk.', 'tutorial.1': 'Stand next to a tree to chop it.',
  'tutorial.2': 'Open the hammer and paint 6 wall tiles.', 'tutorial.3': 'Place an arrow tower next to the brazier - see the fire link.',
  'tutorial.4': 'Read the omens, then start the night.',
  'intro.ok': 'Got it', 'intro.quest': 'Goal: {q}',
  'unlock.generic': 'Something new is open', 'unlock.hero': 'A new hero joins: {hero}', 'unlock.region': 'A new region opens: {name}',
  'unlock.building': 'New building: {name}', 'unlock.building.text': 'Find it in the Build drawer.',
  'unlock.dock.title': 'Expeditions', 'unlock.dock.text': 'Build a Dock on the shore and sail to 3 new islands every day.',
  'unlock.dock.quest': 'Build a Dock', 'unlock.bounties.title': 'Bounties', 'unlock.bounties.text': 'Three tasks each day. Claim them for gold, Ember and deeds.',
  'unlock.bounties.quest': 'Claim a bounty', 'unlock.chronicle.title': 'Chronicle', 'unlock.chronicle.text': 'Deeds fill 7 steps a week. Step 7 is a decoration.',
  'unlock.chronicle.quest': 'Earn 10 deeds', 'unlock.garrison.title': 'Garrison', 'unlock.garrison.text': 'At dusk, drag a hero onto a level 2 tower to hold it.',
  'unlock.garrison.quest': 'Garrison a hero', 'unlock.dispatch.title': 'Scout trips', 'unlock.dispatch.text': 'Send a hero away in real time. They return with loot.',
  'unlock.dispatch.quest': 'Send a hero to forage for 15 minutes', 'unlock.research.title': 'Research', 'unlock.research.text': 'Spend lore pages in the Study for lasting upgrades.',
  'unlock.research.quest': 'Research one node', 'unlock.forge.title': 'Forge', 'unlock.forge.text': 'Craft weapons, armor and charms from iron and essence.',
  'unlock.forge.quest': 'Craft a piece of gear', 'unlock.market.title': 'Market', 'unlock.market.text': 'The traveler trades here every 3rd dawn.',
  'unlock.market.quest': 'Make a trade', 'unlock.modules.title': 'Tower modules', 'unlock.modules.text': 'Level 3 towers take one module. Swap them freely by day.',
  'unlock.modules.quest': 'Fit a module', 'unlock.squad5.title': 'Five heroes', 'unlock.squad5.text': 'Your squad can now take five heroes.',
  'unlock.squad5.quest': 'Field five heroes', 'unlock.beacon_fierce.title': 'Fierce beacon', 'unlock.beacon_fierce.text': 'More foes, more loot and a 4th dawn gift.',
  'unlock.beacon_fierce.quest': 'Win a Fierce night', 'unlock.beacon_nightmare.title': 'Nightmare beacon',
  'unlock.beacon_nightmare.text': 'Many elites - and a rare dawn gift every time.', 'unlock.beacon_nightmare.quest': 'Win a Nightmare night',
  // stat names for gifts / storage
  'res.wood': 'wood', 'res.stone': 'stone', 'res.gold': 'gold', 'res.iron': 'iron', 'res.food': 'food', 'res.essence': 'essence',
  'res.lore': 'lore', 'res.resin': 'resin', 'res.frost': 'frost crystal', 'res.coal': 'core coal', 'res.ember': 'Ember',
};

/** Display names for content the core may not name yet (core keys win when present). */
const NAMES_EN: Record<string, string> = {
  'bld.hearth.name': 'Hearth', 'bld.wall_wood.name': 'Wooden wall', 'bld.wall_stone.name': 'Stone wall', 'bld.wall_ember.name': 'Ember wall',
  'bld.gate.name': 'Gate', 'bld.brazier.name': 'Brazier', 'bld.watchtower.name': 'Watchtower', 'bld.tower_arrow.name': 'Arrow tower',
  'bld.tower_ballista.name': 'Ballista', 'bld.tower_frost.name': 'Frost tower', 'bld.tower_mortar.name': 'Mortar', 'bld.tower_spark.name': 'Spark tower',
  'bld.trap_spikes.name': 'Spikes', 'bld.trap_tar.name': 'Tar', 'bld.lumber_camp.name': 'Lumber camp', 'bld.quarry.name': 'Quarry',
  'bld.farm.name': 'Farm', 'bld.house.name': 'House', 'bld.storehouse.name': 'Storehouse', 'bld.vault.name': 'Vault', 'bld.dock.name': 'Dock',
  'bld.scout_lodge.name': 'Scout lodge', 'bld.forge.name': 'Forge', 'bld.study.name': 'Study', 'bld.market.name': 'Market', 'bld.tavern.name': 'Tavern',
  'bld.barracks.name': 'Barracks', 'bld.workshop.name': 'Workshop', 'bld.dawn_shrine.name': 'Dawn shrine', 'bld.decor_statue.name': 'Statue',
  'bld.decor_well.name': 'Well', 'bld.decor_garden.name': 'Flower bed', 'bld.decor_lamp.name': 'Lamp post', 'bld.decor_coop.name': 'Hen coop',
  'bld.decor_board.name': 'Notice board',
  'bld.hearth.desc': 'The heart of the Hold. Its light is your land.', 'bld.wall_wood.desc': 'Blocks the Gloom. Paint in lines.',
  'bld.wall_stone.desc': 'Sturdy wall. Paint in lines.', 'bld.wall_ember.desc': 'Burns foes that touch it.', 'bld.gate.desc': 'Heroes pass, foes must break it.',
  'bld.brazier.desc': 'Lights 4 tiles. Burns 1 wood a night.', 'bld.watchtower.desc': 'Dim light far out so towers can see.',
  'bld.tower_arrow.desc': 'Fast single shots, hits flyers.', 'bld.tower_ballista.desc': 'Piercing bolts in a line.', 'bld.tower_frost.desc': 'Slows foes nearby.',
  'bld.tower_mortar.desc': 'Area shells at long range.', 'bld.tower_spark.desc': 'Chain lightning, hits flyers.', 'bld.trap_spikes.desc': 'Hurts foes that step on it.',
  'bld.trap_tar.desc': 'Slows foes. Fire sets it ablaze.', 'bld.lumber_camp.desc': 'Villagers cut wood near trees.', 'bld.quarry.desc': 'Villagers dig stone near rocks.',
  'bld.farm.desc': 'Villagers grow food.', 'bld.house.desc': 'Home for 2-4 villagers.', 'bld.storehouse.desc': '+400 storage per level.',
  'bld.vault.desc': 'Protects resources when the fire gutters.', 'bld.dock.desc': 'Sail out on expeditions.', 'bld.scout_lodge.desc': 'Send heroes on scout trips.',
  'bld.forge.desc': 'Craft gear and tower modules.', 'bld.study.desc': 'Research with lore pages.', 'bld.market.desc': 'The traveler trades here.',
  'bld.tavern.desc': 'A hero visits every dawn.', 'bld.barracks.desc': 'Militia guard nearby each night.', 'bld.workshop.desc': 'Repairs buildings at night.',
  'bld.dawn_shrine.desc': 'Reroll the dawn gifts once.', 'bld.decor_statue.desc': 'Decoration.', 'bld.decor_well.desc': 'Decoration.',
  'bld.decor_garden.desc': 'Decoration.', 'bld.decor_lamp.desc': 'Decoration.', 'bld.decor_coop.desc': 'Decoration.', 'bld.decor_board.desc': 'Decoration.',
  'hero.knight.name': 'Brann', 'hero.ranger.name': 'Wren', 'hero.pyro.name': 'Ilka', 'hero.tinker.name': 'Tobi', 'hero.cleric.name': 'Mira',
  'hero.rogue.name': 'Vex', 'hero.beast.name': 'Fenn', 'hero.warden.name': 'Orla', 'hero.shade.name': 'Sable', 'hero.bomb.name': 'Garrick',
  'hero.knight.role': 'Defender', 'hero.ranger.role': 'Archer', 'hero.pyro.role': 'Fire mage', 'hero.tinker.role': 'Engineer', 'hero.cleric.role': 'Healer',
  'hero.rogue.role': 'Assassin', 'hero.beast.role': 'Wolf keeper', 'hero.warden.role': 'Tower warden', 'hero.shade.role': 'Shadow hunter', 'hero.bomb.role': 'Bombardier',
  'enemy.gloomling.name': 'Gloomling', 'enemy.skitter.name': 'Skitter', 'enemy.spitter.name': 'Spitter', 'enemy.brute.name': 'Brute', 'enemy.wisp.name': 'Wisp',
  'enemy.bomber.name': 'Bomber', 'enemy.snuffer.name': 'Snuffer', 'enemy.burrower.name': 'Burrower', 'enemy.shrieker.name': 'Shrieker', 'enemy.hurler.name': 'Hurler',
  'enemy.frostwraith.name': 'Frost wraith', 'enemy.cinderling.name': 'Cinderling', 'enemy.mossback.name': 'Mossback', 'enemy.briarqueen.name': 'Briarqueen',
  'enemy.colossus.name': 'Cairn Colossus', 'enemy.rimefather.name': 'Rimefather', 'enemy.unlit.name': 'The Unlit', 'enemy.champion.name': 'Gloom Champion',
  'module.split': 'Split head', 'module.barb': 'Iron barbs', 'module.frostoil': 'Frost oil', 'module.scope': 'Long scope', 'module.winch': 'Quick winch',
  'module.coalcore': 'Coal core', 'module.hawkeye': 'Hawk eye', 'module.bulwark': 'Bulwark',
  'charm.owl': 'Owl feather', 'charm.whetstone': 'Whetstone', 'charm.chestnut': 'Fire chestnut', 'charm.tinkerlock': 'Tinker lock', 'charm.shell': 'Snail shell',
  'charm.windchime': 'Wind chime', 'charm.cateye': 'Cat eye', 'charm.hunger': 'Hunger charm', 'charm.icecore': 'Ice core', 'charm.luckycoin': 'Lucky coin',
  'charm.phoenix': 'Phoenix ash', 'charm.fuse': 'Fire fuse',
};

const VI: Record<string, string> = {
  'ui.enterHold': 'Vao Hold', 'ui.begin': 'Thap Lo Lua', 'ui.settings': 'Cai dat', 'ui.back': 'Quay lai', 'ui.close': 'Dong', 'ui.yes': 'Co', 'ui.no': 'Khong',
  'ui.on': 'Bat', 'ui.off': 'Tat', 'ui.music': 'Nhac', 'ui.sfx': 'Am thanh', 'ui.haptics': 'Rung', 'ui.bigText': 'Chu to', 'ui.language': 'Ngon ngu',
  'ui.export': 'Xuat', 'ui.import': 'Nhap', 'ui.erase': 'Xoa du lieu', 'ui.pause': 'Tam dung', 'ui.resume': 'Tiep tuc', 'ui.quit': 'Man hinh chinh',
  'ui.collectAll': 'Nhan tat ca', 'ui.holdSummary': 'Dem {n} - Hiem hoa {tr} - Hearth bac {t}',
  'phase.peace': 'Ngay', 'phase.dusk': 'Hoang hon', 'phase.night': 'Dem', 'phase.dawn': 'Binh minh', 'hud.night': 'DEM {n}', 'hud.threat': 'Hiem hoa {x}/{cap}',
  'hud.bell': 'Chuong Hoang Hon', 'hud.startNight': 'Bat dau dem', 'tab.build': 'Xay', 'tab.hero': 'Hero', 'tab.village': 'Lang', 'tab.book': 'So', 'tab.map': 'Ban do',
  'goal.title': 'Muc tieu ke tiep', 'away.title': 'Trong luc ban di vang ({t})', 'gutter.title': 'Lua lui', 'gutter.rebuildAll': 'Dung lai tat ca',
  'gutter.return': 'Tro ve lang', 'gifts.title': 'Qua binh minh', 'omen.title': 'Diem bao', 'dock.setOff': 'Ra khoi',
};

let lang: Lang = 'en';
export function setLang(l: Lang): void { lang = l; }
export function getLang(): Lang { return lang; }

/** True when a key resolves to text (core table or view tables). */
export function hasText(key: string): boolean { return key in STRINGS_EN || key in EN || key in NAMES_EN; }

export function tr(key: string, params?: Record<string, string | number>): string {
  if (key in STRINGS_EN) return coreT(key, lang, params);
  let s = (lang === 'vi' ? VI[key] : undefined) ?? EN[key] ?? NAMES_EN[key];
  if (s === undefined) return key;
  if (params) for (const k in params) s = s.split(`{${k}}`).join(String(params[k]));
  return s;
}

/** Text for a key, or `fallback` when no table has it (for content-driven keys such as skill names). */
export function trOr(key: string, fallback: string, params?: Record<string, string | number>): string {
  return hasText(key) ? tr(key, params) : fallback;
}
