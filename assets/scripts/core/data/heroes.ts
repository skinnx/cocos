// SPEC v2 §7.1 + §7.6 heroes, §11.4 long-term progression (levels, stars, per-star passives, 10 skill picks each),
// §11.5 garrison effects. Owned by core-heroes. Pure data (+ tiny helpers), no `cc`, no Date/Math.random.
import type { DamageType, HeroId, ProjectileKind } from '../api';

export type SkillId = 'shieldBash' | 'arrowRain' | 'fireWall' | 'miniTurret' | 'sanctum' | 'shadowStep' | 'packCall' | 'holdLine' | 'flare' | 'powderKeg';

export interface HeroDef {
  id: HeroId;
  hp: number;
  dmg: number;
  rate: number;           // attacks / s
  range: number;          // tiles (melee ≈ 1.1)
  melee: boolean;
  dtype: DamageType;
  projectile?: ProjectileKind;
  projSpeed?: number;
  splash?: number;        // AoE radius of the basic attack (pyro fireball, bomb)
  hitsFlying: boolean;
  crit?: { chance: number; mul: number };
  knockback?: number;     // warden hammer (tiles)
  skill: SkillId;
  skillCd: number;
  /** starting hero (owned at hold creation) */
  starter?: boolean;
}

export const HEROES: Record<HeroId, HeroDef> = {
  knight: { id: 'knight', hp: 120, dmg: 10, rate: 1.2, range: 1.1, melee: true, dtype: 'impact', hitsFlying: false, skill: 'shieldBash', skillCd: 8, starter: true },
  ranger: { id: 'ranger', hp: 70, dmg: 7, rate: 1.5, range: 5, melee: false, dtype: 'pierce', projectile: 'arrow', projSpeed: 13, hitsFlying: true, skill: 'arrowRain', skillCd: 10 },
  pyro: { id: 'pyro', hp: 60, dmg: 14, rate: 0.6, range: 4, melee: false, dtype: 'fire', projectile: 'fireball', projSpeed: 9, splash: 1.2, hitsFlying: true, skill: 'fireWall', skillCd: 14 },
  tinker: { id: 'tinker', hp: 80, dmg: 6, rate: 1.0, range: 1.1, melee: true, dtype: 'impact', hitsFlying: false, skill: 'miniTurret', skillCd: 16 },
  cleric: { id: 'cleric', hp: 75, dmg: 4, rate: 1.0, range: 3, melee: false, dtype: 'spark', projectile: 'spark', projSpeed: 20, hitsFlying: true, skill: 'sanctum', skillCd: 18 },
  rogue: { id: 'rogue', hp: 65, dmg: 6, rate: 2.5, range: 1.1, melee: true, dtype: 'pierce', hitsFlying: true, crit: { chance: 0.25, mul: 2.5 }, skill: 'shadowStep', skillCd: 9 },
  beast: { id: 'beast', hp: 85, dmg: 8, rate: 1.0, range: 3, melee: false, dtype: 'pierce', projectile: 'javelin', projSpeed: 12, hitsFlying: true, skill: 'packCall', skillCd: 15 },
  warden: { id: 'warden', hp: 110, dmg: 12, rate: 0.8, range: 1.1, melee: true, dtype: 'impact', hitsFlying: false, knockback: 0.5, skill: 'holdLine', skillCd: 16 },
  shade: { id: 'shade', hp: 70, dmg: 9, rate: 1.1, range: 4.5, melee: false, dtype: 'pierce', projectile: 'bolt', projSpeed: 15, hitsFlying: true, skill: 'flare', skillCd: 12 },
  bomb: { id: 'bomb', hp: 80, dmg: 16, rate: 0.5, range: 3.5, melee: false, dtype: 'impact', projectile: 'bomb', projSpeed: 7, splash: 1, hitsFlying: false, skill: 'powderKeg', skillCd: 14 },
};

export const HERO_IDS: HeroId[] = ['knight', 'ranger', 'pyro', 'tinker', 'cleric', 'rogue', 'beast', 'warden', 'shade', 'bomb'];

/** Base skill numbers (level-1, no picks). */
export const SKILLS = {
  shieldBash: { range: 2, stun: 1, dmg: 10, cone: Math.PI / 2.2 },
  arrowRain: { arrows: 5, spread: 0.5, dmgMul: 1.4, range: 6, flight: 7 },
  fireWall: { length: 4, dps: 8, secs: 4, width: 0.8, castRange: 5 },
  miniTurret: { secs: 8, hp: 40, dmg: 5, rate: 2, range: 4 },
  sanctum: { radius: 2.5, secs: 5, hps: 10, enemyDmgMul: 0.8 },
  shadowStep: { range: 6, nextHitMul: 3 },
  packCall: { wolves: 2, secs: 8 },
  holdLine: { radius: 4, secs: 5, dmgTakenMul: 0.5 },
  flare: { radius: 3, secs: 6 },
  powderKeg: { fuse: 1.5, dmg: 40, radius: 2 },
  wolf: { hp: 60, dmg: 7, rate: 1.4, range: 1.0, speed: 3.4, respawn: 12, leash: 6 },
  passive: {
    tauntRange: 2, rangerDarkMul: 1.25, pyroRelightRange: 3, tinkerRepairHps: 8, tinkerRepairRange: 3, tinkerCostMul: 0.9,
    clericHealHps: 6, clericRange: 4, rogueSpeedMul: 1.3, wardenTowerRate: 0.15, wardenRange: 3,
    shadeSight: 6, shadeRevealedMul: 1.3, shadeRevealedSecs: 3, bombArmoredMul: 2,
  },
};

/** §11.4 "each star also +1 level to the passive": the passive's key number at 1★..5★. */
export const PASSIVE_BY_STAR: Record<HeroId, { key: string; values: [number, number, number, number, number] }> = {
  knight: { key: 'tauntRange', values: [2, 2.5, 3, 3.5, 4] },
  ranger: { key: 'darkMul', values: [1.25, 1.3, 1.35, 1.4, 1.5] },
  pyro: { key: 'relightRange', values: [3, 3.5, 4, 4.5, 5] },
  tinker: { key: 'repairHps', values: [8, 10, 12, 14, 16] },
  cleric: { key: 'healHps', values: [6, 7, 8, 9, 10] },
  rogue: { key: 'squadSpeedMul', values: [1.3, 1.35, 1.4, 1.45, 1.5] },
  beast: { key: 'wolfStatMul', values: [1, 1.15, 1.3, 1.45, 1.6] },
  warden: { key: 'towerRate', values: [0.15, 0.18, 0.21, 0.24, 0.3] },
  shade: { key: 'sight', values: [6, 6.5, 7, 7.5, 8] },
  bomb: { key: 'armoredMul', values: [2, 2.2, 2.4, 2.6, 3] },
};

/** SPEC §17 hero constants (mirrored here so core-heroes does not depend on balance.ts layout). */
export const HERO_BAL = {
  maxLevel: 30, levelMul: 0.06, capByStar: [10, 15, 20, 25, 30], unlockShards: 30,
  starShards: [20, 40, 80, 160], starEssence: [30, 80, 160, 300],
  skillPickLevels: [5, 10, 15, 20, 25], garrisonXpShare: 0.5, garrisonDmgPerLevel: 0.02, squadMax: 4, squadMax5Tier: 8,
  respecGoldPerLevel: 50, garrisonSlotsByTier: [[3, 2], [5, 4], [8, 6]] as Array<[number, number]>,
  moveSpeed: 3.2, engageRange: 3.5, followCatchup: 1.35, teleportDist: 12, reviveSeconds: 20, harvestRange: 1.2, harvestInterval: 0.6,
  /** XP to go from `level` to `level+1`. */
  xpToNext: (level: number) => Math.round(12 + 8 * Math.pow(level, 1.5)),
};

// ── §11.4 skill picks: levels 5/10/15/20/25, option 0 or 1. ──────────────────
export interface Txt { en: string; vi: string }
export interface SkillPick { id: string; hero: HeroId; level: number; option: 0 | 1; name: Txt; desc: Txt }

const P = (hero: HeroId, level: number, option: 0 | 1, id: string, en: string, vi: string, dEn: string, dVi: string): SkillPick =>
  ({ id, hero, level, option, name: { en, vi }, desc: { en: dEn, vi: dVi } });

export const SKILL_PICKS: SkillPick[] = [
  // Brann — guardian: crowd control vs single-target lockdown, tanking vs payback, support vs mobility
  P('knight', 5, 0, 'knight_whirl', 'Whirling Bash', 'Khiên Xoáy', 'Shield Bash hits all around Brann (radius 2.5).', 'Khiên Đập đánh mọi hướng quanh Brann (bán kính 2.5).'),
  P('knight', 5, 1, 'knight_crush', 'Crushing Bash', 'Khiên Nghiền', 'Shield Bash deals triple damage and stuns for 2 s.', 'Khiên Đập gây gấp ba sát thương và choáng 2 giây.'),
  P('knight', 10, 0, 'knight_bulwark', 'Bulwark', 'Thành Trì', 'Takes 30% less damage while 3+ foes are within 2.5 tiles.', 'Nhận ít hơn 30% sát thương khi có từ 3 quái trong 2.5 ô.'),
  P('knight', 10, 1, 'knight_spikes', 'Spiked Shield', 'Khiên Gai', 'Attackers take 40% of the damage they deal to Brann.', 'Quái đánh Brann chịu lại 40% sát thương chúng gây ra.'),
  P('knight', 15, 0, 'knight_rally', 'Rallying Bash', 'Khiên Hiệu Triệu', 'Shield Bash heals heroes within 4 tiles for 15% of their max HP.', 'Khiên Đập hồi 15% máu tối đa cho hero trong 4 ô.'),
  P('knight', 15, 1, 'knight_charge', 'Shield Charge', 'Lao Khiên', 'Shield Bash triggers from 5 tiles away: Brann dashes to the target first.', 'Khiên Đập kích hoạt từ 5 ô: Brann lao tới mục tiêu trước.'),
  P('knight', 20, 0, 'knight_wall', 'Living Wall', 'Bức Tường Sống', '+40% max HP, but 20% slower attacks.', '+40% máu tối đa nhưng đánh chậm hơn 20%.'),
  P('knight', 20, 1, 'knight_avenger', 'Avenger', 'Kẻ Báo Thù', '+5% damage for every 10% HP missing.', '+5% sát thương cho mỗi 10% máu đã mất.'),
  P('knight', 25, 0, 'knight_aegis', 'Aegis', 'Khiên Thánh', 'Shield Bash shields heroes within 4 tiles for 25% of Brann\'s max HP (5 s).', 'Khiên Đập tạo khiên bằng 25% máu tối đa của Brann cho hero trong 4 ô (5 giây).'),
  P('knight', 25, 1, 'knight_quake', 'Earthquake', 'Động Đất', 'Every 3rd attack sends a shockwave (radius 1.8) that slows 30%.', 'Mỗi đòn thứ 3 tạo sóng chấn (bán kính 1.8) làm chậm 30%.'),
  // Wren — archer: wide volley vs piercing lines, multishot vs sniping, burn vs chill, openers vs anti-air
  P('ranger', 5, 0, 'ranger_volley', 'Volley', 'Loạt Tên', 'Arrow Rain fires 8 arrows.', 'Mưa Tên bắn 8 mũi.'),
  P('ranger', 5, 1, 'ranger_pierce', 'Piercing Rain', 'Mưa Xuyên', 'Arrow Rain arrows pierce every foe and fly 9 tiles.', 'Mưa Tên xuyên mọi mục tiêu và bay 9 ô.'),
  P('ranger', 10, 0, 'ranger_double', 'Double Shot', 'Bắn Đôi', 'Basic attacks shoot two targets.', 'Đòn thường bắn hai mục tiêu.'),
  P('ranger', 10, 1, 'ranger_longbow', 'Longbow', 'Cung Dài', '+2 range and +35% damage, 25% slower attacks.', '+2 tầm và +35% sát thương, đánh chậm hơn 25%.'),
  P('ranger', 15, 0, 'ranger_fire', 'Fire Arrows', 'Tên Lửa', 'Basic attacks burn (3/s for 3 s) and light tar.', 'Đòn thường gây cháy (3/giây trong 3 giây) và châm hắc ín.'),
  P('ranger', 15, 1, 'ranger_frost', 'Frost Arrows', 'Tên Băng', 'Basic attacks slow by 25% for 1.5 s.', 'Đòn thường làm chậm 25% trong 1.5 giây.'),
  P('ranger', 20, 0, 'ranger_opener', 'First Blood', 'Phát Mở Màn', '+60% damage to foes above 80% HP.', '+60% sát thương lên quái còn trên 80% máu.'),
  P('ranger', 20, 1, 'ranger_sky', 'Skyhunter', 'Thợ Săn Trời', '+60% damage to flying foes; Arrow Rain aims at fliers first.', '+60% sát thương lên quái bay; Mưa Tên ưu tiên quái bay.'),
  P('ranger', 25, 0, 'ranger_storm', 'Arrow Storm', 'Bão Tên', 'Arrow Rain fires a second volley 0.6 s later.', 'Mưa Tên bắn thêm một loạt sau 0.6 giây.'),
  P('ranger', 25, 1, 'ranger_ricochet', 'Ricochet', 'Tên Nảy', 'Basic arrows bounce to one more foe.', 'Tên thường nảy sang thêm một quái.'),
  // Ilka — firecaller: zone control vs self-defence ring, big AoE vs rapid single fire, DoT vs execute, death bomb vs torch
  P('pyro', 5, 0, 'pyro_inferno', 'Inferno', 'Hỏa Ngục', 'Fire Wall is 7 tiles long and lasts 6 s.', 'Tường Lửa dài 7 ô và cháy 6 giây.'),
  P('pyro', 5, 1, 'pyro_ring', 'Ring of Fire', 'Vòng Lửa', 'Fire Wall becomes a ring (radius 2) around Ilka.', 'Tường Lửa thành vòng lửa (bán kính 2) quanh Ilka.'),
  P('pyro', 10, 0, 'pyro_meteor', 'Meteor', 'Thiên Thạch', 'Fireballs explode 0.8 tiles wider.', 'Cầu lửa nổ rộng thêm 0.8 ô.'),
  P('pyro', 10, 1, 'pyro_firebolt', 'Firebolt', 'Tia Lửa', 'Twice the attack speed, 40% less damage, no explosion.', 'Đánh nhanh gấp đôi, sát thương −40%, không nổ lan.'),
  P('pyro', 15, 0, 'pyro_kindle', 'Kindling', 'Mồi Lửa', 'Fireballs set foes burning (4/s for 4 s).', 'Cầu lửa đốt cháy quái (4/giây trong 4 giây).'),
  P('pyro', 15, 1, 'pyro_heat', 'Heatwave', 'Sóng Nhiệt', '+50% damage to burning foes.', '+50% sát thương lên quái đang cháy.'),
  P('pyro', 20, 0, 'pyro_phoenix', 'Phoenix Heart', 'Tim Phượng Hoàng', 'When Ilka falls she explodes (40 fire, radius 2.5) and returns in 10 s.', 'Khi gục Ilka nổ tung (40 lửa, bán kính 2.5) và trở lại sau 10 giây.'),
  P('pyro', 20, 1, 'pyro_torch', 'Living Torch', 'Đuốc Sống', 'Ilka carries a flare: tiles within 2.5 are lit.', 'Ilka mang theo pháo sáng: các ô trong 2.5 được thắp sáng.'),
  P('pyro', 25, 0, 'pyro_firestorm', 'Firestorm', 'Bão Lửa', 'Fire Wall deals double damage and burns foes for 6 s.', 'Tường Lửa gây gấp đôi sát thương và đốt quái 6 giây.'),
  P('pyro', 25, 1, 'pyro_cross', 'Crossfire', 'Lửa Chéo', 'Casts two crossing Fire Walls.', 'Tạo hai Tường Lửa bắt chéo.'),
  // Tobi — tinkerer: more turrets vs longer turret, fire vs lightning, builder vs brawler, decoy vs tower buff, artillery vs uptime
  P('tinker', 5, 0, 'tinker_twin', 'Twin Turrets', 'Ụ Súng Đôi', 'Mini Turret deploys two turrets.', 'Tháp Mini đặt hai ụ súng.'),
  P('tinker', 5, 1, 'tinker_sentry', 'Sentry', 'Lính Gác', 'Turret lasts 16 s with +2 range.', 'Ụ súng tồn tại 16 giây, +2 tầm.'),
  P('tinker', 10, 0, 'tinker_flame', 'Flame Turret', 'Ụ Phun Lửa', 'Turret shoots fire that burns and lights tar.', 'Ụ súng bắn lửa gây cháy và châm hắc ín.'),
  P('tinker', 10, 1, 'tinker_tesla', 'Tesla Coil', 'Cuộn Tesla', 'Turret shots chain lightning to 3 foes.', 'Ụ súng phóng sét nảy 3 quái.'),
  P('tinker', 15, 0, 'tinker_engineer', 'Field Engineer', 'Kỹ Sư Chiến Trường', 'Repairs twice as fast, within 5 tiles.', 'Sửa nhanh gấp đôi, trong 5 ô.'),
  P('tinker', 15, 1, 'tinker_wrench', 'Heavy Wrench', 'Cờ Lê Nặng', 'Every 3rd hit deals double damage and stuns for 0.6 s.', 'Mỗi đòn thứ 3 gây gấp đôi sát thương và choáng 0.6 giây.'),
  P('tinker', 20, 0, 'tinker_decoy', 'Decoy Turret', 'Ụ Mồi', 'Turret has triple HP and taunts foes within 3 tiles.', 'Ụ súng có gấp ba máu và khiêu khích quái trong 3 ô.'),
  P('tinker', 20, 1, 'tinker_overclock', 'Overclock', 'Ép Xung', 'Towers within 3 tiles of Tobi fire 20% faster.', 'Tháp trong 3 ô quanh Tobi bắn nhanh hơn 20%.'),
  P('tinker', 25, 0, 'tinker_mortar', 'Mortar Turret', 'Ụ Cối', 'Turret lobs shells: ×2.5 damage, explodes (1.5), slower, range 7.', 'Ụ súng bắn đạn cối: ×2.5 sát thương, nổ 1.5 ô, chậm hơn, tầm 7.'),
  P('tinker', 25, 1, 'tinker_rapid', 'Rapid Deploy', 'Triển Khai Nhanh', 'Mini Turret cooldown −50%.', 'Hồi chiêu Tháp Mini −50%.'),
  // Mira — healer: sustained zone vs burst, offense chain vs double heal, smite zone vs shields, rescue vs empower, fortress vs battle-priest
  P('cleric', 5, 0, 'cleric_great', 'Great Sanctum', 'Đại Thánh Địa', 'Sanctum radius 4, lasts 7 s.', 'Thánh Địa bán kính 4, kéo dài 7 giây.'),
  P('cleric', 5, 1, 'cleric_burst', 'Holy Burst', 'Bùng Thánh', 'Sanctum instantly heals 40% max HP, but lasts only 2 s.', 'Thánh Địa hồi ngay 40% máu tối đa nhưng chỉ kéo dài 2 giây.'),
  P('cleric', 10, 0, 'cleric_smite', 'Smite', 'Trừng Phạt', 'Basic attacks chain to 3 foes.', 'Đòn thường nảy sang 3 quái.'),
  P('cleric', 10, 1, 'cleric_mender', 'Mender', 'Thầy Thuốc', 'Passive healing is doubled and heals the two most wounded.', 'Hồi máu nội tại gấp đôi, hồi cho hai người yếu nhất.'),
  P('cleric', 15, 0, 'cleric_judgment', 'Judgment', 'Phán Xét', 'Foes inside Sanctum take 6 spark damage per second.', 'Quái trong Thánh Địa chịu 6 sét mỗi giây.'),
  P('cleric', 15, 1, 'cleric_ward', 'Ward', 'Bùa Hộ Thân', 'Every 6 s the most wounded hero nearby gets a 25 HP shield.', 'Mỗi 6 giây hero yếu nhất gần đó nhận khiên 25 máu.'),
  P('cleric', 20, 0, 'cleric_resurrect', 'Resurrection', 'Hồi Sinh', 'Once per night, revives a fallen hero within 6 tiles at 50% HP.', 'Mỗi đêm một lần, hồi sinh hero gục trong 6 ô với 50% máu.'),
  P('cleric', 20, 1, 'cleric_zeal', 'Zeal', 'Nhiệt Huyết', 'Heroes inside Sanctum deal +30% damage.', 'Hero trong Thánh Địa +30% sát thương.'),
  P('cleric', 25, 0, 'cleric_sanctuary', 'Sanctuary', 'Nơi Trú Ẩn', 'Sanctum also repairs structures inside (12 HP/s).', 'Thánh Địa cũng sửa công trình bên trong (12 HP/giây).'),
  P('cleric', 25, 1, 'cleric_storm', 'Storm Priestess', 'Nữ Tu Bão Tố', 'Attacks twice as fast with +50% damage, but no passive healing.', 'Đánh nhanh gấp đôi, +50% sát thương, nhưng mất hồi máu nội tại.'),
  // Vex — assassin: chain blinks vs one huge hit, poison vs crits, dodge vs frenzy, smoke vs backstab, blade fan vs execute
  P('rogue', 5, 0, 'rogue_chain', 'Chain Step', 'Bước Chuỗi', 'Shadow Step jumps to up to 3 foes in a row (each hit ×2).', 'Bước Bóng nhảy liên tiếp tới 3 quái (mỗi đòn ×2).'),
  P('rogue', 5, 1, 'rogue_assassin', 'Assassinate', 'Ám Sát', 'Shadow Step\'s empowered hit deals ×5.', 'Đòn cường hóa của Bước Bóng gây ×5.'),
  P('rogue', 10, 0, 'rogue_venom', 'Venom', 'Nọc Độc', 'Hits poison foes (3/s for 4 s, stacks up to 8 s).', 'Đòn đánh gây độc (3/giây trong 4 giây, cộng dồn tới 8 giây).'),
  P('rogue', 10, 1, 'rogue_precision', 'Deadly Precision', 'Chính Xác Chết Người', '+20% crit chance, crits deal ×3.', '+20% chí mạng, chí mạng gây ×3.'),
  P('rogue', 15, 0, 'rogue_evasion', 'Evasion', 'Né Tránh', '30% chance to dodge attacks.', '30% cơ hội né đòn.'),
  P('rogue', 15, 1, 'rogue_frenzy', 'Frenzy', 'Cuồng Sát', 'Each kill: +15% attack speed for 4 s (up to 3 stacks).', 'Mỗi lần hạ quái: +15% tốc đánh trong 4 giây (tối đa 3 tầng).'),
  P('rogue', 20, 0, 'rogue_smoke', 'Smoke Bomb', 'Bom Khói', 'Shadow Step leaves smoke: foes within 2 tiles are stunned 1.2 s.', 'Bước Bóng để lại khói: quái trong 2 ô bị choáng 1.2 giây.'),
  P('rogue', 20, 1, 'rogue_backstab', 'Backstab', 'Đâm Lén', '+50% damage to foes attacking someone else.', '+50% sát thương lên quái đang đánh mục tiêu khác.'),
  P('rogue', 25, 0, 'rogue_fan', 'Fan of Knives', 'Quạt Dao', 'Every 4 s, knives hit all foes within 2.5 tiles for 150% damage.', 'Mỗi 4 giây, dao bay trúng mọi quái trong 2.5 ô với 150% sát thương.'),
  P('rogue', 25, 1, 'rogue_execute', 'Executioner', 'Đao Phủ', 'Hits slay non-boss foes below 15% HP.', 'Đòn đánh kết liễu quái thường dưới 15% máu.'),
  // Fenn — beastmaster: one alpha vs a big pack, buffs vs control, bodyguard vs piercing javelins, bleed vs twin companions, sustain vs stampede
  P('beast', 5, 0, 'beast_alpha', 'Alpha Wolf', 'Sói Đầu Đàn', 'The companion wolf has double HP and damage.', 'Sói đồng hành có gấp đôi máu và sát thương.'),
  P('beast', 5, 1, 'beast_bigpack', 'Big Pack', 'Đàn Lớn', 'Call the Pack summons 4 wolves.', 'Gọi Bầy triệu 4 sói.'),
  P('beast', 10, 0, 'beast_howl', 'Howl', 'Tru Gọi', 'Call the Pack gives all heroes +20% damage for 6 s.', 'Gọi Bầy cho mọi hero +20% sát thương trong 6 giây.'),
  P('beast', 10, 1, 'beast_winter', 'Winter Wolves', 'Sói Mùa Đông', 'Wolf bites slow by 30% for 2 s.', 'Sói cắn làm chậm 30% trong 2 giây.'),
  P('beast', 15, 0, 'beast_bond', 'Bond', 'Gắn Kết', 'The companion wolf takes 30% of the damage aimed at Fenn.', 'Sói đồng hành gánh 30% sát thương nhắm vào Fenn.'),
  P('beast', 15, 1, 'beast_hunter', 'Hunter\'s Javelin', 'Lao Thợ Săn', 'Javelins fly straight and pierce 3 foes.', 'Lao bay thẳng và xuyên 3 quái.'),
  P('beast', 20, 0, 'beast_rend', 'Rending Fangs', 'Nanh Xé', 'Wolf bites cause bleeding (3/s for 4 s).', 'Sói cắn gây chảy máu (3/giây trong 4 giây).'),
  P('beast', 20, 1, 'beast_twin', 'Twin Companions', 'Song Sói', 'Two companion wolves instead of one.', 'Hai sói đồng hành thay vì một.'),
  P('beast', 25, 0, 'beast_feast', 'Feast', 'Bữa Tiệc', 'Wolves heal themselves and Fenn for 25% of their damage.', 'Sói hồi cho bản thân và Fenn 25% sát thương gây ra.'),
  P('beast', 25, 1, 'beast_stampede', 'Stampede', 'Giẫm Đạp', 'Summoned wolves last 12 s and stun on their first bite (1 s).', 'Sói được gọi tồn tại 12 giây, cú cắn đầu gây choáng 1 giây.'),
  // Orla — warden: wide aura vs repair, splash vs taunt, tower rate vs tower range, control vs self-armor, invulnerability vs firepower
  P('warden', 5, 0, 'warden_bastion', 'Bastion', 'Pháo Đài', 'Hold the Line covers 7 tiles and lasts 8 s.', 'Lệnh Giữ Thành phủ 7 ô và kéo dài 8 giây.'),
  P('warden', 5, 1, 'warden_mend', 'Mortar & Mend', 'Vữa Vá', 'Hold the Line also repairs structures by 15% of max HP.', 'Lệnh Giữ Thành còn sửa công trình 15% máu tối đa.'),
  P('warden', 10, 0, 'warden_quake', 'Earthshaker', 'Rung Chuyển', 'Hammer blows splash 1.2 tiles.', 'Búa nện lan 1.2 ô.'),
  P('warden', 10, 1, 'warden_guard', 'Guardian', 'Hộ Vệ', 'Foes within 3 tiles that attack buildings turn on Orla.', 'Quái trong 3 ô đang đánh công trình sẽ quay sang đánh Orla.'),
  P('warden', 15, 0, 'warden_drill', 'Drillmaster', 'Huấn Luyện Viên', 'Tower aura doubles (+30% rate) and reaches 5 tiles.', 'Hào quang tháp gấp đôi (+30% tốc bắn) và xa 5 ô.'),
  P('warden', 15, 1, 'warden_spotter', 'Spotter', 'Trinh Sát', 'Towers within 3 tiles also get +1 range.', 'Tháp trong 3 ô còn được +1 tầm.'),
  P('warden', 20, 0, 'warden_stun', 'Stunning Blows', 'Đòn Choáng', 'Knockback 1.2 tiles and stuns for 0.6 s.', 'Đẩy lùi 1.2 ô và choáng 0.6 giây.'),
  P('warden', 20, 1, 'warden_iron', 'Ironclad', 'Giáp Sắt', 'Takes 35% less damage within 3 tiles of a structure.', 'Nhận ít hơn 35% sát thương khi trong 3 ô quanh công trình.'),
  P('warden', 25, 0, 'warden_rampart', 'Rampart', 'Thành Lũy', 'Structures are invulnerable for the first 3 s of Hold the Line.', 'Công trình bất tử trong 3 giây đầu của Lệnh Giữ Thành.'),
  P('warden', 25, 1, 'warden_volley', 'Call the Volley', 'Lệnh Bắn', 'Towers inside Hold the Line fire 50% faster.', 'Tháp trong Lệnh Giữ Thành bắn nhanh hơn 50%.'),
  // Sable — shade: big flare vs burning flare, piercing vs rapid, revealed vs darkness, two flares vs blinding, vision vs deadeye
  P('shade', 5, 0, 'shade_starshell', 'Starshell', 'Pháo Sao', 'Flare radius 5, lasts 10 s.', 'Pháo Sáng bán kính 5, kéo dài 10 giây.'),
  P('shade', 5, 1, 'shade_incendiary', 'Incendiary Flare', 'Pháo Cháy', 'Flare burns foes inside (5 fire/s).', 'Pháo Sáng đốt quái bên trong (5 lửa/giây).'),
  P('shade', 10, 0, 'shade_heavy', 'Heavy Bolts', 'Tên Nỏ Nặng', 'Bolts pierce 3 foes.', 'Tên nỏ xuyên 3 quái.'),
  P('shade', 10, 1, 'shade_repeater', 'Repeater', 'Nỏ Liên Thanh', '80% faster attacks, 30% less damage.', 'Đánh nhanh hơn 80%, sát thương −30%.'),
  P('shade', 15, 0, 'shade_prey', 'Marked Prey', 'Con Mồi', 'Revealed foes take +60% (not +30%) for 6 s.', 'Quái bị lộ diện chịu +60% (thay vì +30%) trong 6 giây.'),
  P('shade', 15, 1, 'shade_stalker', 'Night Stalker', 'Kẻ Rình Đêm', '+40% damage to foes standing in the dark.', '+40% sát thương lên quái đứng trong bóng tối.'),
  P('shade', 20, 0, 'shade_twin', 'Twin Flares', 'Pháo Đôi', 'Fires two flares (farthest and second farthest foe).', 'Bắn hai pháo sáng (quái xa nhất và xa nhì).'),
  P('shade', 20, 1, 'shade_blind', 'Blinding Flare', 'Pháo Chói', 'Foes inside the flare when it bursts are stunned 1.5 s.', 'Quái trong pháo sáng lúc nổ bị choáng 1.5 giây.'),
  P('shade', 25, 0, 'shade_allseeing', 'All-Seeing', 'Toàn Nhãn', 'Reveals veiled foes within 10 tiles; Flare cooldown −30%.', 'Lộ diện quái ẩn trong 10 ô; hồi Pháo Sáng −30%.'),
  P('shade', 25, 1, 'shade_deadeye', 'Deadeye', 'Mắt Tử Thần', 'Every 4th bolt is a ×3 critical hit.', 'Mỗi phát nỏ thứ 4 là chí mạng ×3.'),
  // Garrick — bombardier: cluster vs one huge keg, tar vs fire, two kegs vs short fuse, reach vs concussion, chain reaction vs demolition
  P('bomb', 5, 0, 'bomb_cluster', 'Cluster Bombs', 'Bom Chùm', 'Bombs scatter 3 bomblets (40% damage each).', 'Bom tung thêm 3 bom con (mỗi quả 40% sát thương).'),
  P('bomb', 5, 1, 'bomb_bigkeg', 'Big Keg', 'Thùng Lớn', 'Powder Keg deals 70 damage in radius 3.', 'Thùng Thuốc gây 70 sát thương bán kính 3.'),
  P('bomb', 10, 0, 'bomb_tar', 'Tar Bombs', 'Bom Hắc Ín', 'Bombs slow foes by 40% for 2 s.', 'Bom làm chậm quái 40% trong 2 giây.'),
  P('bomb', 10, 1, 'bomb_incendiary', 'Incendiary', 'Bom Cháy', 'Bombs set foes burning (4/s for 4 s) and light tar.', 'Bom đốt cháy quái (4/giây trong 4 giây) và châm hắc ín.'),
  P('bomb', 15, 0, 'bomb_double', 'Double Keg', 'Thùng Đôi', 'Places two Powder Kegs.', 'Đặt hai Thùng Thuốc.'),
  P('bomb', 15, 1, 'bomb_shortfuse', 'Short Fuse', 'Ngòi Ngắn', 'Keg fuse 0.5 s and cooldown −30%.', 'Ngòi thùng 0.5 giây và hồi chiêu −30%.'),
  P('bomb', 20, 0, 'bomb_longarm', 'Long Arm', 'Tay Dài', '+2 throwing range.', '+2 tầm ném.'),
  P('bomb', 20, 1, 'bomb_concussion', 'Concussion', 'Chấn Động', 'Powder Kegs stun for 2 s.', 'Thùng Thuốc gây choáng 2 giây.'),
  P('bomb', 25, 0, 'bomb_chain', 'Chain Reaction', 'Phản Ứng Dây Chuyền', 'Foes Garrick kills explode (15 impact, radius 1.2).', 'Quái bị Garrick hạ phát nổ (15 va chạm, bán kính 1.2).'),
  P('bomb', 25, 1, 'bomb_demolition', 'Demolition', 'Phá Hủy', '+100% damage to elites and bosses.', '+100% sát thương lên quái tinh nhuệ và boss.'),
];

export const PICK_BY_ID: Record<string, SkillPick> = Object.fromEntries(SKILL_PICKS.map((p) => [p.id, p]));

/** The two options at `level` for `hero`. */
export function picksAt(hero: HeroId, level: number): [SkillPick, SkillPick] {
  const a = SKILL_PICKS.filter((p) => p.hero === hero && p.level === level).sort((x, y) => x.option - y.option);
  return [a[0], a[1]];
}

/** Numbers behind the picks (read by Squad.ts). */
export const PF = {
  knight_whirl: { radius: 2.5 }, knight_crush: { dmgMul: 3, stun: 2 }, knight_bulwark: { foes: 3, range: 2.5, mul: 0.7 },
  knight_spikes: { reflect: 0.4 }, knight_rally: { heal: 0.15, range: 4 }, knight_charge: { range: 5 },
  knight_wall: { hpMul: 1.4, rateMul: 0.8 }, knight_avenger: { perTenth: 0.05 }, knight_aegis: { frac: 0.25, range: 4, secs: 5 },
  knight_quake: { every: 3, radius: 1.8, slow: 0.3, secs: 2 },
  ranger_volley: { arrows: 8 }, ranger_pierce: { pierce: 99, flight: 9 }, ranger_double: { targets: 2 },
  ranger_longbow: { range: 2, dmgMul: 1.35, rateMul: 0.75 }, ranger_fire: { dps: 3, secs: 3 }, ranger_frost: { slow: 0.25, secs: 1.5 },
  ranger_opener: { above: 0.8, mul: 1.6 }, ranger_sky: { mul: 1.6 }, ranger_storm: { delay: 0.6 }, ranger_ricochet: { chain: 2 },
  pyro_inferno: { length: 7, secs: 6 }, pyro_ring: { radius: 2, segments: 6 }, pyro_meteor: { splash: 0.8 },
  pyro_firebolt: { rateMul: 2, dmgMul: 0.6 }, pyro_kindle: { dps: 4, secs: 4 }, pyro_heat: { mul: 1.5 },
  pyro_phoenix: { dmg: 40, radius: 2.5, revive: 10 }, pyro_torch: { radius: 2.5 }, pyro_firestorm: { dpsMul: 2, burn: 6 }, pyro_cross: {},
  tinker_twin: { count: 2 }, tinker_sentry: { secs: 16, range: 2 }, tinker_flame: {}, tinker_tesla: { chain: 3 },
  tinker_engineer: { hpsMul: 2, range: 5 }, tinker_wrench: { every: 3, mul: 2, stun: 0.6 }, tinker_decoy: { hpMul: 3, taunt: 3 },
  tinker_overclock: { range: 3, rate: 0.2 }, tinker_mortar: { dmgMul: 2.5, splash: 1.5, rate: 0.5, range: 7 }, tinker_rapid: { cdMul: 0.5 },
  cleric_great: { radius: 4, secs: 7 }, cleric_burst: { heal: 0.4, secs: 2 }, cleric_smite: { chain: 3 }, cleric_mender: { hpsMul: 2, targets: 2 },
  cleric_judgment: { dps: 6 }, cleric_ward: { every: 6, shield: 25, range: 4 }, cleric_resurrect: { range: 6, hp: 0.5 },
  cleric_zeal: { dmg: 0.3 }, cleric_sanctuary: { hps: 12 }, cleric_storm: { rateMul: 2, dmgMul: 1.5 },
  rogue_chain: { jumps: 3, mul: 2, range: 4 }, rogue_assassin: { mul: 5 }, rogue_venom: { dps: 3, secs: 4, cap: 8 },
  rogue_precision: { crit: 0.2, critMul: 3 }, rogue_evasion: { chance: 0.3 }, rogue_frenzy: { rate: 0.15, secs: 4, stacks: 3 },
  rogue_smoke: { radius: 2, stun: 1.2 }, rogue_backstab: { mul: 1.5 }, rogue_fan: { every: 4, radius: 2.5, mul: 1.5 }, rogue_execute: { below: 0.15 },
  beast_alpha: { mul: 2 }, beast_bigpack: { wolves: 4 }, beast_howl: { dmg: 0.2, secs: 6 }, beast_winter: { slow: 0.3, secs: 2 },
  beast_bond: { share: 0.3 }, beast_hunter: { pierce: 3 }, beast_rend: { dps: 3, secs: 4 }, beast_twin: { wolves: 2 },
  beast_feast: { heal: 0.25 }, beast_stampede: { secs: 12, stun: 1 },
  warden_bastion: { radius: 7, secs: 8 }, warden_mend: { repair: 0.15 }, warden_quake: { splash: 1.2 }, warden_guard: { range: 3 },
  warden_drill: { rateMul: 2, range: 5 }, warden_spotter: { range: 1 }, warden_stun: { knock: 1.2, stun: 0.6 },
  warden_iron: { range: 3, mul: 0.65 }, warden_rampart: { secs: 3 }, warden_volley: { rate: 0.5 },
  shade_starshell: { radius: 5, secs: 10 }, shade_incendiary: { dps: 5 }, shade_heavy: { pierce: 3 }, shade_repeater: { rateMul: 1.8, dmgMul: 0.7 },
  shade_prey: { mul: 1.6, secs: 6 }, shade_stalker: { mul: 1.4 }, shade_twin: { count: 2 }, shade_blind: { stun: 1.5 },
  shade_allseeing: { sight: 10, cdMul: 0.7 }, shade_deadeye: { every: 4, mul: 3 },
  bomb_cluster: { count: 3, frac: 0.4, spread: 1.5 }, bomb_bigkeg: { dmg: 70, radius: 3 }, bomb_tar: { slow: 0.4, secs: 2 },
  bomb_incendiary: { dps: 4, secs: 4 }, bomb_double: { count: 2 }, bomb_shortfuse: { fuse: 0.5, cdMul: 0.7 }, bomb_longarm: { range: 2 },
  bomb_concussion: { stun: 2 }, bomb_chain: { dmg: 15, radius: 1.2 }, bomb_demolition: { mul: 2 },
} as const;

// ── §11.5 garrison effects ────────────────────────────────────────────────────
export const GARRISON = {
  knight: { taunt: 3, wallHpMul: 1.3 },
  ranger: { range: 2, pierce: 1 },
  pyro: { splash: 1 },
  tinker: { repairHps: 6, range: 3 },
  cleric: { healHps: 8, range: 4 },
  rogue: { crit: 0.2, critMul: 2.5 },
  beast: { patrol: 5 },
  warden: { range: 3, rate: 0.15 },
  shade: {},
  bomb: { every: 10, range: 6, dmg: 30, radius: 1.5 },
};

export const GARRISON_TXT: Record<HeroId, Txt> = {
  knight: { en: 'Foes within 3 tiles attack this tower; adjacent walls +30% HP.', vi: 'Quái trong 3 ô ưu tiên đánh tháp này; tường kề tháp +30% HP.' },
  ranger: { en: '+2 range; shots pierce one more foe.', vi: '+2 tầm; đạn xuyên thêm 1 mục tiêu.' },
  pyro: { en: 'Always Flaming Arrows; shots explode 1 tile.', vi: 'Tháp luôn có Tên lửa, đạn nổ lan 1 ô.' },
  tinker: { en: 'Tower and structures within 3 tiles repair 6 HP/s.', vi: 'Tháp và công trình trong 3 ô tự sửa 6 HP/s.' },
  cleric: { en: 'Heals heroes within 4 tiles 8 HP/s; tower immune to freezing.', vi: 'Hồi 8 HP/s cho hero trong 4 ô; tháp miễn nhiễm vô hiệu hóa.' },
  rogue: { en: '20% crit ×2.5; targets the toughest foe.', vi: 'Chí mạng 20% ×2.5; ưu tiên quái nhiều máu nhất.' },
  beast: { en: 'A wolf patrols 5 tiles around the tower.', vi: 'Sói tuần tra 5 ô quanh tháp.' },
  warden: { en: 'Other towers within 3 tiles fire 15% faster.', vi: 'Tháp khác trong 3 ô +15% tốc bắn.' },
  shade: { en: 'Veiled foes in range are revealed.', vi: 'Quái ẩn trong tầm bị lộ diện.' },
  bomb: { en: 'Every 10 s lobs a barrel (range 6, 30 impact, radius 1.5).', vi: 'Mỗi 10 giây ném 1 thùng nổ (tầm 6, 30 va chạm, nổ 1.5 ô).' },
};

export const HERO_TXT: Record<HeroId, { name: string; role: Txt; skill: Txt; skillDesc: Txt; passive: Txt }> = {
  knight: { name: 'Brann', role: { en: 'Guardian', vi: 'Đỡ đòn' }, skill: { en: 'Shield Bash', vi: 'Khiên Đập' }, skillDesc: { en: 'Stuns foes in a cone for 1 s.', vi: 'Choáng 1 giây hình nón 2 ô.' }, passive: { en: 'Nearby Gloom attack Brann first.', vi: 'Quái trong 2 ô ưu tiên đánh Brann.' } },
  ranger: { name: 'Wren', role: { en: 'Archer', vi: 'Bắn xa' }, skill: { en: 'Arrow Rain', vi: 'Mưa Tên' }, skillDesc: { en: 'Fires a fan of 5 arrows.', vi: '5 mũi tên hình quạt.' }, passive: { en: '+25% damage to foes in the dark.', vi: '+25% sát thương lên quái ở ô tối.' } },
  pyro: { name: 'Ilka', role: { en: 'Firecaller', vi: 'Diện rộng' }, skill: { en: 'Fire Wall', vi: 'Tường Lửa' }, skillDesc: { en: 'A 4-tile wall of flame for 4 s.', vi: 'Vệt lửa 4 ô trong 4 giây.' }, passive: { en: 'Relights nearby braziers instantly; ignites tar.', vi: 'Thắp lại brazier gần đó tức thì; châm hắc ín.' } },
  tinker: { name: 'Tobi', role: { en: 'Tinkerer', vi: 'Thợ' }, skill: { en: 'Mini Turret', vi: 'Tháp Mini' }, skillDesc: { en: 'Deploys a turret for 8 s.', vi: 'Đặt ụ súng 8 giây.' }, passive: { en: 'Repairs nearby buildings; building costs −10%.', vi: 'Sửa công trình gần đó; giá xây −10%.' } },
  cleric: { name: 'Mira', role: { en: 'Healer', vi: 'Hồi máu' }, skill: { en: 'Sanctum', vi: 'Thánh Địa' }, skillDesc: { en: 'Holy ground heals allies and weakens foes.', vi: 'Vùng thánh hồi máu đồng đội, làm yếu quái.' }, passive: { en: 'Heals the most wounded ally nearby.', vi: 'Hồi máu cho đồng đội yếu nhất gần đó.' } },
  rogue: { name: 'Vex', role: { en: 'Assassin', vi: 'Sát thủ' }, skill: { en: 'Shadow Step', vi: 'Bước Bóng' }, skillDesc: { en: 'Blinks to the toughest foe; next hit ×3.', vi: 'Dịch chuyển tới quái nhiều máu nhất; đòn kế ×3.' }, passive: { en: 'Squad moves 30% faster out of combat.', vi: 'Cả đội +30% tốc chạy khi không giao tranh.' } },
  beast: { name: 'Fenn', role: { en: 'Beastmaster', vi: 'Người nuôi sói' }, skill: { en: 'Call the Pack', vi: 'Gọi Bầy' }, skillDesc: { en: 'Two more wolves for 8 s.', vi: 'Thêm 2 sói trong 8 giây.' }, passive: { en: 'A wolf companion; it returns 12 s after falling.', vi: 'Luôn có 1 sói đi cùng, sói chết thì hồi sau 12 giây.' } },
  warden: { name: 'Orla', role: { en: 'Warden', vi: 'Hộ vệ tháp' }, skill: { en: 'Hold the Line', vi: 'Lệnh Giữ Thành' }, skillDesc: { en: 'Structures within 4 tiles take −50% damage for 5 s.', vi: 'Công trình trong 4 ô nhận −50% sát thương trong 5 giây.' }, passive: { en: 'Towers within 3 tiles fire 15% faster.', vi: 'Tháp trong 3 ô +15% tốc bắn.' } },
  shade: { name: 'Sable', role: { en: 'Shade hunter', vi: 'Thợ săn bóng tối' }, skill: { en: 'Flare', vi: 'Pháo Sáng' }, skillDesc: { en: 'Lights 3 tiles around the farthest foe for 6 s.', vi: 'Thắp sáng 3 ô quanh quái xa nhất trong 6 giây.' }, passive: { en: 'Reveals veiled foes within 6 tiles; +30% damage to revealed foes.', vi: 'Thấy quái ẩn trong 6 ô; +30% sát thương lên quái vừa lộ diện.' } },
  bomb: { name: 'Garrick', role: { en: 'Bombardier', vi: 'Pháo thủ' }, skill: { en: 'Powder Keg', vi: 'Thùng Thuốc' }, skillDesc: { en: 'A keg blows up after 1.5 s (40 impact, radius 2).', vi: 'Thùng nổ sau 1.5 giây (40 va chạm, bán kính 2).' }, passive: { en: 'Basic attacks deal ×2 to armored foes.', vi: 'Đòn thường gây ×2 lên quái bọc giáp.' } },
};
