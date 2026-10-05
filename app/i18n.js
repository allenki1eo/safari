/**
 * English and Kiswahili.
 *
 * Interface text goes through `t(english, vars)`: the English string is the key, so the code
 * stays readable and a missing translation simply shows the English. `{name}` placeholders are
 * filled from `vars`.
 *
 * Story and game data (regions, allies, runners, missions, hunt words, powerups, the prologue)
 * get a Kiswahili overlay at startup. Changing language reloads the page, so nothing is ever
 * half translated.
 */
import { save, persist } from './data/save.js';
import { RUNNERS, OUTFITS, ALLIES, INTRO, TUTORIAL, MISSION_POOL, HUNT_WORDS, BOOSTS, SHOUTS } from './data/content.js';
import { REGIONS } from './data/regions.js';
import { NEAR_MISS } from './data/daily.js';

export const LANGS = { en: 'English', sw: 'Kiswahili' };

const deviceLang = () => (typeof navigator !== 'undefined' && /^sw\b/i.test(navigator.language || '') ? 'sw' : 'en');
export const lang = LANGS[save.lang] ? save.lang : deviceLang();

export function setLang(next) {
  if (!LANGS[next] || next === lang) return;
  save.lang = next;
  persist();
  location.reload();
}

export function t(en, vars) {
  let s = (lang === 'sw' && SW[en]) || en;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return s;
}

/** A mission's text in the current language (saved missions keep their English text). */
export function missionText(m) {
  const def = MISSION_POOL.find((d) => d.id === m.id);
  return def ? def.text.replace('{n}', Number(m.n).toLocaleString()) : m.text;
}

/** The challenge message that goes with a shared score card. */
export function shareMessage(run, english) {
  if (lang !== 'sw') return english;
  const d = Math.max(0, Math.floor(Number(run?.distance) || 0)).toLocaleString();
  const rank = run?.rank ? ` (#${run.rank})` : '';
  return `Nimekimbia ${d}m${rank} kwenye njia ya leo ya KIMBIA! Unaweza kunishinda?`;
}

/* ------------------------------------------------------------------ interface */
const SW = {
  // title
  MULTIPLIER: 'KIZIDISHI',
  Install: 'Sakinisha',
  'Install Kimbia! on this device': 'Sakinisha Kimbia! kwenye kifaa hiki',
  Leaderboard: 'Ubao wa washindi',
  Settings: 'Mipangilio',
  'SPIRIT OF THE SERENGETI': 'ROHO YA SERENGETI',
  "{name} ran that on an earlier route. Today's trail is a new one.": '{name} alikimbia hiyo kwenye njia ya zamani. Njia ya leo ni mpya.',
  "{name} challenges you to beat {score} on today's route!": '{name} anakupa changamoto ya kushinda {score} kwenye njia ya leo!',
  '{name} is a faint runner ahead — pass them.': '{name} ni kivuli cha mkimbiaji mbele yako — mpite.',
  'Best run {score} pts · {dist}m': 'Mbio bora {score} pointi · {dist}m',
  'Starting at': 'Unaanzia',
  Change: 'Badilisha',
  '🐾 The herd is on its way…': '🐾 Kundi linakuja…',
  '🐾 The herd is here': '🐾 Kundi limefika',
  '▶ RUN!': '▶ KIMBIA!',
  Runners: 'Wakimbiaji',
  Allies: 'Marafiki',
  Missions: 'Majukumu',
  Journey: 'Safari',
  // prologue
  'Skip story': 'Ruka hadithi',
  'Next ›': 'Endelea ›',
  'Run! ›': 'Kimbia! ›',
  // HUD
  Pause: 'Simamisha',
  'Word hunt': 'Tafuta neno',
  'Word hunt: {word}': 'Tafuta neno: {word}',
  '{w}… word hunt': '{w}… tafuta neno',
  'Use Ngao shield': 'Tumia ngao',
  'Shield already up!': 'Ngao tayari iko juu!',
  'No Ngao charms — get more in Allies': 'Huna hirizi za Ngao — pata zaidi kwa Marafiki',
  '{name} · {m}m ahead': '{name} · {m}m mbele',
  'Passed {name}': 'Umempita {name}',
  'Mission complete!': 'Jukumu limekamilika!',
  '{name} the {species}': '{name} · {species}',
  'New powerup · {name}': 'Nguvu mpya · {name}',
  'Legend lap {n}': 'Mzunguko wa gwiji {n}',
  '✨ New region unlocked': '✨ Eneo jipya limefunguliwa',
  '{name} unlocked — start your next run here from the Journey map!': '{name} limefunguliwa — anza mbio zako zijazo hapa kutoka ramani ya Safari!',
  combo: 'mfululizo',
  'Journey complete!': 'Safari imekamilika!',
  '<b>You crossed three countries!</b> The song grows stronger — keep running.': '<b>Umevuka nchi tatu!</b> Wimbo unazidi kupata nguvu — endelea kukimbia.',
  'Switched to Low graphics to keep things smooth — change it in Settings.': 'Tumebadili kwenda michoro ya Chini ili mchezo uende vizuri — unaweza kubadilisha kwenye Mipangilio.',
  // pause and revive
  Paused: 'Umesimama',
  'Fisi is waiting… catch your breath.': 'Fisi anasubiri… vuta pumzi.',
  '▶ Keep running': '▶ Endelea kukimbia',
  '🔊 Music': '🔊 Muziki',
  '🔇 Music': '🔇 Muziki',
  '🏠 Home': '🏠 Nyumbani',
  'Second wind?': 'Pumzi ya pili?',
  'Bibi Tembo can scare Fisi away — for a few golden seeds.': 'Bibi Tembo anaweza kumfukuza Fisi — kwa mbegu chache za dhahabu.',
  Revive: 'Fufuka',
  'No thanks': 'Hapana, asante',
  'Shoo, Fisi! Off you go, little one — run!': 'Toka, Fisi! Haya, mdogo wangu — kimbia!',
  // results
  '🐾 Fisi caught you!': '🐾 Fisi amekukamata!',
  '💥 Ouch!': '💥 Lo!',
  '★ NEW BEST ★': '★ REKODI MPYA ★',
  'Best {n}': 'Bora {n}',
  'You beat': 'Umemshinda',
  Seeds: 'Mbegu',
  Distance: 'Umbali',
  'Savanna board': 'Ubao wa Savana',
  'Top runs': 'Mbio bora',
  'Saving your run…': 'Tunahifadhi mbio zako…',
  'Next: {place}': 'Ijayo: {place}',
  'You crossed all three countries!': 'Umevuka nchi zote tatu!',
  '↻ Run again': '↻ Kimbia tena',
  'Clean run · no close call': 'Mbio safi · hakuna nusura',
  "Today's route": 'Njia ya leo',
  Today: 'Leo',
  "Today's rank didn't save": 'Nafasi ya leo haikuhifadhiwa',
  'Today — off the board': 'Leo — nje ya ubao',
  'WhatsApp link copied — send it to a friend!': 'Kiungo cha WhatsApp kimenakiliwa — mtumie rafiki!',
  'The board is quiet right now.': 'Ubao uko kimya kwa sasa.',
  '“{name}” is taken. Pick another name.': '“{name}” limeshachukuliwa. Chagua jina lingine.',
  'Could not save your score': 'Imeshindikana kuhifadhi alama zako',
  'Add your name so this run is saved.': 'Weka jina lako ili mbio hizi zihifadhiwe.',
  "You're <b>#{n}</b> on the savanna board": 'Wewe ni <b>#{n}</b> kwenye ubao wa savana',
  'Finish a run with points to make the board': 'Maliza mbio zenye pointi ili uingie kwenye ubao',
  '🎉 New personal best!': '🎉 Rekodi yako mpya!',
  'Your best: <b>{n}</b>': 'Bora yako: <b>{n}</b>',
  "Pick your runner name. It's yours for good, and your best run will post by itself after every game.":
    'Chagua jina lako la mkimbiaji. Ni lako milele, na mbio zako bora zitaingia zenyewe baada ya kila mchezo.',
  'Your name': 'Jina lako',
  'Save score': 'Hifadhi alama',
  'No scores yet. Be the first name on the board.': 'Bado hakuna alama. Kuwa jina la kwanza kwenye ubao.',
  'Full board ›': 'Ubao wote ›',
  // leaderboard
  'All-time': 'Wakati wote',
  "Loading today's route…": 'Inapakia njia ya leo…',
  'Loading the savanna board…': 'Inapakia ubao wa savana…',
  "Today's route · {day} · resets at midnight in Dar es Salaam.": 'Njia ya leo · {day} · inaanza upya saa sita usiku, Dar es Salaam.',
  'One best run per runner, ranked by score.': 'Mbio moja bora kwa kila mkimbiaji, kwa mpangilio wa alama.',
  "No scores on today's route yet. Finish a run and it lands here.": 'Bado hakuna alama kwenye njia ya leo. Maliza mbio, zitaonekana hapa.',
  'No scores yet. Finish a run and put your name on the board.': 'Bado hakuna alama. Maliza mbio na uweke jina lako kwenye ubao.',
  'Could not load the board': 'Imeshindikana kupakia ubao',
  'Try again': 'Jaribu tena',
  'Mission set complete!': 'Majukumu yote yamekamilika!',
  'Multiplier is now ×{m} · +{s} seeds': 'Kizidishi sasa ni ×{m} · +{s} mbegu',
  Back: 'Rudi',
  // allies
  MAX: 'JUU',
  'Ngao Shield': 'Ngao',
  '× {n} owned': '× {n} unazo',
  'Tap 🛡️ while running · 30s': 'Gusa 🛡️ ukikimbia · sekunde 30',
  'A Maasai-style shield charm that absorbs one crash and keeps your run alive.': 'Hirizi ya ngao ya Kimaasai inayozuia ajali moja na kuendeleza mbio zako.',
  'Animal Allies': 'Marafiki wa Wanyama',
  'Grab glowing totems on the trail to call an ally. Upgrade them to make their help last longer.':
    'Chukua alama zinazong’aa njiani kumwita rafiki. Waboreshe ili msaada wao udumu zaidi.',
  'Ngao shield ready! You have <b>{n}</b>.': 'Ngao iko tayari! Una <b>{n}</b>.',
  '<b>{name}</b> upgraded to level {n}!': '<b>{name}</b> amepanda hadi kiwango {n}!',
  // missions and journey
  'Score multiplier': 'Kizidishi cha alama',
  'Each mission pays seeds. Settle all three — finish them or skip them — to raise your multiplier and win the set bonus.':
    'Kila jukumu lina zawadi ya mbegu. Maliza au ruka yote matatu ili kuongeza kizidishi chako na kushinda bonasi ya seti.',
  Challenges: 'Changamoto',
  'Collect all': 'Kusanya zote',
  'Set bonus': 'Bonasi ya seti',
  Skipped: 'Imerukwa',
  'Counts towards the set': 'Inahesabiwa kwenye seti',
  Collected: 'Imekusanywa',
  Collect: 'Kusanya',
  'Done!': 'Umemaliza!',
  Skip: 'Ruka',
  'Pay {n}?': 'Lipa {n}?',
  'to collect at the finish': 'za kukusanya mwishoni',
  'Complete all three missions to raise it by one and earn bonus seeds.': 'Kamilisha majukumu yote matatu ili kukiongeza kwa moja na kupata mbegu za ziada.',
  '🎉 Claim reward': '🎉 Pokea zawadi',
  '<b>{n}</b> / {total} regions discovered': '<b>{n}</b> / {total} maeneo yamegunduliwa',
  '📖 Replay the prologue': '📖 Rudia utangulizi',
  START: 'MWANZO',
  'Keep running to discover this place.': 'Endelea kukimbia ili ugundue mahali hapa.',
  '✓ Starting here': '✓ Unaanzia hapa',
  'Start runs here': 'Anzia hapa',
  'The Journey': 'Safari',
  // runners
  Outfit: 'Mavazi',
  '✓ Selected': '✓ Umechagua',
  Select: 'Chagua',
  'Unlock · {cost}': 'Fungua · {cost}',
  Previous: 'Iliyopita',
  Next: 'Ijayo',
  '<b>{name}</b> joins the run!': '<b>{name}</b> amejiunga na mbio!',
  // install
  'Kimbia! is on your home screen. Karibu tena!': 'Kimbia! iko kwenye skrini yako ya nyumbani. Karibu tena!',
  "Tap <b>Share</b> {icon} in Safari's toolbar": 'Gusa <b>Shiriki</b> {icon} kwenye upau wa Safari',
  'Scroll down and tap <b>Add to Home Screen</b>': 'Shuka chini na ugusa <b>Add to Home Screen</b>',
  'Tap <b>Add</b>. Kimbia! opens full screen, even offline': 'Gusa <b>Add</b>. Kimbia! itafunguka skrini nzima, hata bila intaneti',
  'Tap the <b>⋮</b> or <b>•••</b> menu in this app': 'Gusa menyu ya <b>⋮</b> au <b>•••</b> kwenye programu hii',
  'Choose <b>Open in browser</b> (Chrome or Safari)': 'Chagua <b>Open in browser</b> (Chrome au Safari)',
  'Tap <b>Install</b> on the Kimbia! home screen there': 'Gusa <b>Sakinisha</b> kwenye ukurasa wa Kimbia! huko',
  'Open your browser menu <b>⋮</b>': 'Fungua menyu ya kivinjari chako <b>⋮</b>',
  'Tap <b>Install app</b> or <b>Add to Home screen</b>': 'Gusa <b>Install app</b> au <b>Add to Home screen</b>',
  'Confirm. Kimbia! opens full screen, even offline': 'Thibitisha. Kimbia! itafunguka skrini nzima, hata bila intaneti',
  'Install Kimbia!': 'Sakinisha Kimbia!',
  'Play from your home screen: full screen, quicker to open, and it works offline.':
    'Cheza kutoka skrini yako ya nyumbani: skrini nzima, inafunguka haraka, na inafanya kazi bila intaneti.',
  'Got it': 'Sawa',
  // settings
  '🎵 Music': '🎵 Muziki',
  '🔊 Sound effects': '🔊 Sauti',
  '📳 Vibration': '📳 Mtetemo',
  '✨ Graphics': '✨ Michoro',
  Auto: 'Otomatiki',
  High: 'Juu',
  Low: 'Chini',
  '🌍 Language': '🌍 Lugha',
  '📲 Play from your home screen': '📲 Cheza kutoka skrini ya nyumbani',
  'Your runner name (shown on challenges)': 'Jina lako la mkimbiaji (linaonekana kwenye changamoto)',
  'e.g. Zuri': 'mf. Zuri',
  Done: 'Tayari',
  'Swipe to move · Arrow keys / WASD on desktop': 'Telezesha kidole kusogea · Vitufe vya mishale / WASD kwenye kompyuta',
  'Runners: Quaternius (CC0). Animals: © Wildfire Games, from': 'Wakimbiaji: Quaternius (CC0). Wanyama: © Wildfire Games, kutoka',
  "You're now <b>{name}</b> on the leaderboard.": 'Sasa wewe ni <b>{name}</b> kwenye ubao wa washindi.',
  '<b>{name}</b> is already taken. Try another name.': '<b>{name}</b> limeshachukuliwa. Jaribu jina lingine.',
  "Couldn't reach the leaderboard. Your name wasn't changed.": 'Imeshindikana kufikia ubao wa washindi. Jina lako halijabadilika.',
  // daily reward
  'Jambo! Day {n}': 'Jambo! Siku {n}',
  'The savanna rewards those who return.': 'Savana huwazawadia wanaorudi.',
  'Day {n}': 'Siku {n}',
  // in the run
  'Ngao saved you!': 'Ngao imekuokoa!',
  'Shield broken': 'Ngao imevunjika',
  'Close call!': 'Nusura!',
  'Stumbled!': 'Umejikwaa!',
  'Fisi is right behind you!': 'Fisi yuko nyuma yako!',
  'Passed!': 'Umempita!',
  'JACKPOT!': 'BAHATI KUBWA!',
  '+{n} seeds': '+{n} mbegu',
  'Ngao charm!': 'Hirizi ya Ngao!',
  'One more shield for the road': 'Ngao moja zaidi kwa safari',
  '{name} joins you!': '{name} amejiunga nawe!',
  'Double seeds!': 'Mbegu mara mbili!',
  'Every seed counts twice for 15s': 'Kila mbegu ni mara mbili kwa sekunde 15',
  '+{n} points': '+{n} pointi',
  '{line} · +{n} seeds & a shield': '{line} · +{n} mbegu na ngao',
  'Combo ×{n}!': 'Mfululizo ×{n}!',
  // the score card image
  'I OUTRAN FISI FOR': 'NILIMKIMBIA FISI',
  'I RAN': 'NIMEKIMBIA',
  'Clean run': 'Mbio safi',
  'Today #{n}': 'Leo #{n}',
  '★ {n} points': '★ pointi {n}',
  'Can you beat me?': 'Unaweza kunishinda?',
  'Play free ▸ safari-blush.vercel.app': 'Cheza bure ▸ safari-blush.vercel.app',
};

/* ------------------------------------------------------------------ game data */
const DATA = {
  runners: {
    zuri: { title: 'Mlinzi Kijana', bio: 'Amekulia ukingoni mwa nyanda; Zuri anajua kila ndege kwa wimbo wake.' },
    juma: { title: 'Mshambuliaji wa Arusha', bio: 'Miguu ya kasi zaidi kwenye ligi ya kijiji. Hajawahi kushindwa mbio na mbuzi.' },
    neema: { title: 'Mtunza Shanga', bio: 'Shanga zake zinasimulia hadithi ya uhamaji. Ameamua kuimaliza.' },
    baraka: { title: 'Mvumbuzi', bio: 'Anachora ramani ya kila kilima na kuipa jina kila mbuyu. Hubeba vitafunio vingi mno.' },
    amani: { title: 'Mkimbiaji wa Usiku', bio: 'Anakimbia kwa mwanga wa nyota. Vimulimuli humfuata nyumbani.' },
    kito: { title: 'Gwiji Mdogo', bio: 'Mkimbiaji mdogo kuliko wote aliyewahi kumshinda Fisi. Hakuna anayejua alivyofanya. Kito hasemi.' },
  },
  outfits: {
    kit: { name: 'Jezi ya mbio', line: 'Fulana ya mbio, kaptula fupi na viatu vyepesi.' },
    jersey: { name: 'Jezi', line: 'Jezi ya mpira yenye mistari, soksi na buti.' },
    kanga: { name: 'Kanga', line: 'Kitenge cha kujifunga na kanga yenye pindo kiunoni.' },
    vest: { name: 'Fulana ya mlinzi', line: 'Shati lenye kola chini ya fulana ya mlinzi yenye mifuko.' },
    journey: { name: 'Joho', line: 'Kanzu fupi na shuka kwa safari ndefu.' },
  },
  allies: {
    tembo: {
      species: 'Ndovu', power: 'Kupanda Tembo', desc: 'Panda juu ya Tembo na uvunje kila kitu kilicho mbele yako.',
      lines: ['Panda, mdogo wangu!', 'Hakuna kinachosimama mbele ya Tembo!', 'Shika masikio yangu — na ushike kwa nguvu!'],
    },
    tai: {
      species: 'Tai', power: 'Kupaa Angani', desc: 'Tai anakubeba juu ya savana kando ya mto wa mbegu za dhahabu.',
      lines: ['Twende mawinguni!', 'Nyanda zinaonekana ndogo kutoka huku juu!', 'Angalia manyoya yangu!'],
    },
    duma: {
      species: 'Duma', power: 'Kasi ya Radi', desc: 'Kimbia sambamba na Duma — kasi ya ajabu, hakuna anayekugusa.',
      lines: ['Jaribu kunifuata!', 'Kasi kuliko upepo!', 'Haraka! HARAKA ZAIDI!'],
    },
    twiga: {
      species: 'Twiga', power: 'Kuruka Juu Sana', desc: 'Twiga anakuazima miguu yake mirefu. Unaruka juu mara mbili.',
      lines: ['Fikia vilele vya mishita!', 'Juu, juu zaidi, mpenzi!', 'Miguu mirefu, miruko mikubwa!'],
    },
    hondo: {
      species: 'Hondohondo', power: 'Sumaku ya Mbegu', desc: 'Hondo anaruka kuchukua kila mbegu karibu na kuziweka kwenye mfuko wako.',
      lines: ['Inang’aa! Yangu! Ah… yako!', 'Hondo anaona mbegu ZOTE!', 'Niachie kazi ya kukusanya!'],
    },
    simba: {
      species: 'Simba', power: 'Ngurumo ya Kifalme', desc: 'Ngurumo ya mfalme wa simba inazidisha mara mbili kila pointi unayopata.',
      lines: ['ROOOAAARRR!', 'Nyanda zinatusujudia!', 'Kimbia, mtoto wa simba — kundi liko nawe!'],
    },
  },
  intro: [
    { speaker: 'Serengeti', text: 'Kila mwaka, kwato milioni mbili hufuata wimbo wa kale kuvuka nyanda — Wimbo wa Savana.' },
    { speaker: 'Mbegu ya Moyo', text: 'Wimbo huo unaishi ndani ya Mbegu ya Moyo, mbegu ya dhahabu iliyochanua chini ya mbuyu mkuu kwa miaka elfu.' },
    { speaker: 'Fisi, Mfalme wa Fisi', text: '“Hehehe! Nikiwa na Mbegu ya Moyo, kila kundi litaenda pale FISI anaposema!” Usiku wa jana, Fisi na genge lake la Rustmaw waliiba.' },
    { speaker: 'Nyanda', text: 'Malori yao yalipokuwa yakinguruma kuondoka, mbegu za dhahabu zilimwagika ardhini. Bila wimbo, makundi yamepotea.' },
    { speaker: 'Bibi Tembo', text: '“Wewe, mtoto. Fisi anakimbia kuvuka Tanzania — huenda hadi Kenya na Uganda. Wanyama watawasaidia wanaowasaidia. Kimbia — usisimame!”' },
  ],
  tutorial: [
    'Telezesha ← → kubadilisha njia',
    'Telezesha ↑ kuruka magogo',
    'Telezesha ↓ kuteleza chini ya matawi',
    'Chukua alama zinazong’aa kumwita rafiki wa wanyama!',
  ],
  missions: {
    seeds: 'Kusanya mbegu {n} kwenye mbio moja',
    dist: 'Kimbia {n}m kwenye mbio moja',
    jumps: 'Ruka mara {n} kwenye mbio moja',
    slides: 'Teleza mara {n} kwenye mbio moja',
    allies: 'Mwite rafiki wa wanyama mara {n} kwenye mbio moja',
    score: 'Pata pointi {n} kwenye mbio moja',
    roofs: 'Kimbia juu ya malori {n} ya Rustmaw',
    smash: 'Vunja vizuizi {n} ukiwa juu ya Tembo',
    nearmiss: 'Pata nusura {n}',
    regions: 'Ingia maeneo mapya {n} kwenye mbio moja',
    combo: 'Fikia mfululizo wa mbegu ×{n}',
    boxes: 'Fungua masanduku {n} ya Zawadi kwenye mbio moja',
    words: 'Maliza kutafuta neno mara {n} kwenye mbio moja',
  },
  hunt: {
    SERENGETI: 'Kutoka Kimaa, “nyanda zisizo na mwisho”: nyumbani kwa Uhamaji Mkuu',
    NGORONGORO: 'Volkano iliyoporomoka, sasa kreta iliyojaa wanyamapori',
    TANZANIA: 'Tanganyika + Zanzibar, ziliungana mwaka 1964',
    RUAHA: 'Pori, la mbali, na limepewa jina la Mto Ruaha Mkuu',
    KILIMANJARO: 'Mlima mrefu kuliko yote Afrika: mita 5,895 za theluji juu ya savana',
    ZANZIBAR: 'Kisiwa cha Viungo: karafuu, milango ya nakshi na bahari ya samawati',
    TARANGIRE: 'Mibuyu ya kale na baadhi ya makundi makubwa zaidi ya tembo Afrika',
    MANYARA: 'Ziwa la heroe, na simba wanaopanda miti',
    MIKUMI: 'Nyanda wazi karibu na Milima ya Uluguru, Serengeti ndogo',
    GOMBE: 'Msitu ambapo Jane Goodall aliishi pamoja na sokwe',
    KATAVI: 'Mito ya mbali iliyojaa viboko bega kwa bega',
    SAADANI: 'Ambapo pori linafika hadi ufukweni',
    NYERERE: 'Hifadhi kubwa kuliko zote Afrika, imepewa jina la Baba wa Taifa',
    KIMBIA: 'Ndiyo jina la mchezo huu: kimbia!',
    PUNDAMILIA: 'Punda mwenye milia: farasi wa mistari wa savana',
    TWIGA: 'Mnyama mrefu kuliko wote duniani',
    TEMBO: 'Mnyama mkubwa kuliko wote wa nchi kavu',
    SIMBA: 'Mfalme wa nyika',
  },
  boosts: {
    gold: { line: 'Mbegu za dhahabu: kila mbegu ina thamani ya 3', intro: 'Dhahabu! Kwa sekunde 12 kila mbegu unayochukua ina thamani ya tatu!', tag: '×3' },
    score: { name: 'Pointi ×2', line: 'Kila hatua inapata pointi mara mbili', intro: 'Pointi mara mbili kwa sekunde 15. Endelea kukimbia na uone alama zikipaa!', tag: '×2' },
    slow: { line: 'Mbio zinapungua kasi', intro: 'Pole pole! Njia inapunguza kasi kwa sekunde 8 ili upumzike kidogo.', tag: 'pole' },
    wind: { line: 'Kimbunga kinasafisha njia mbele yako', intro: 'Kimbunga! Kinapeperusha kila kizuizi kilicho mbele yako nje ya njia.' },
  },
  shouts: ['Hakuna shida!', 'Safi sana!', 'Pole pole? Hapana!', 'Kimbia!', 'Poa!', 'Hatari!', 'Mambo poa!'],
  nearMiss: { lion: 'Simba amekaribia', wildebeest: 'Nyumbu amejaza skrini', water: 'Ruka la mwisho juu ya maji' },
  regions: {
    serengeti: {
      title: 'Wimbo Ulioibiwa',
      line: 'Kimbia, mtoto! Kusanya mbegu za dhahabu zilizotawanyika — makundi yatafuata wimbo wao.',
      blurb: 'Nyanda za dhahabu zisizo na mwisho ambapo kwato milioni mbili hufuata Wimbo wa Savana.',
    },
    ngorongoro: {
      name: 'Kreta ya Ngorongoro', title: 'Kreta ya Majitu', speaker: 'Kifaru',
      line: 'Malori ya Fisi yalishuka barabara ya kreta. Angalia nyati — hawagawani njia!',
      blurb: 'Dunia iliyofichika ndani ya volkano ya kale: maziwa ya magadi, heroe na vifaru weusi wa mwisho.',
    },
    manyara: {
      name: 'Ziwa Manyara', title: 'Ziwa la Heroe', speaker: 'Heroe',
      line: 'Fisi amepita ufukweni mwa ziwa! Simba hapa hulala juu ya miti — usiangalie juu, kimbia tu!',
      blurb: 'Ziwa la magadi lenye ukingo wa waridi chini ya ukuta wa Bonde la Ufa, likizungukwa na msitu.',
    },
    tarangire: {
      title: 'Ufalme wa Mibuyu', speaker: 'Mzee Mbuyu',
      line: 'Nimewaona tembo wakipita kwa miaka elfu. Fisi amekimbia kusini — angalia makundi yanayovuka!',
      blurb: 'Mibuyu ya kale na vichuguu virefu, ambapo familia za tembo hukusanyika kwa mamia.',
    },
    kilimanjaro: {
      name: 'Mlima Kilimanjaro', title: 'Paa la Afrika', speaker: 'Tai',
      line: 'Fisi anapanda kuelekea barafu! Angalia angani — mlima unarusha mawe!',
      blurb: 'Kilele kirefu kuliko vyote Afrika: msitu wa mawingu, mimea mikubwa na theluji kwenye ikweta.',
    },
    ruaha: {
      title: 'Nchi ya Mbwa Mwitu', speaker: 'Mbwa Mwitu',
      line: 'Kundi langu lilimwona Fisi akinyemelea kuelekea Rufiji. Kimbia nasi — na ukae mbali na simba!',
      blurb: 'Nchi ya pori yenye miamba, iliyokatwa na Mto Ruaha Mkuu: mibuyu, makundi ya simba na mbwa mwitu.',
    },
    selous: {
      title: 'Mto wa Wafalme', speaker: 'Kiboko',
      line: 'Mto Rufiji unakwenda kasi hapa. Mamba wamelala njiani — waruke, usiwaamshe!',
      blurb: 'Pori kubwa kuliko yote Afrika, lililosukwa na Mto Rufiji wenye nguvu.',
    },
    zanzibar: {
      title: 'Kisiwa cha Viungo', speaker: 'Kima Mpunju',
      line: 'Fisi anajipenyeza kwenye jahazi linaloelekea Kenya! Pita sokoni mwa viungo — haraka!',
      blurb: 'Mchanga mweupe, maji ya samawati, milango ya nakshi na harufu ya karafuu kwenye upepo.',
    },
    mara: {
      title: 'Uvukaji Mkuu', speaker: 'Nyumbu',
      line: 'Sisi milioni moja tunavuka Mara kila mwaka. Pita katikati ya kundi linalokimbia, mkimbiaji mdogo!',
      blurb: 'Nyasi nyekundu ambapo Uhamaji Mkuu unanguruma kuvuka Mto Mara.',
    },
    amboseli: {
      title: 'Chini ya Mlima wa Theluji',
      line: 'Kundi langu lilimwona Fisi akielekea magharibi, kwenye misitu ya ukungu. Kuwa makini — tunavuka tupendapo!',
      blurb: 'Nyanda za vumbi na vinamasi chini ya Kilimanjaro, nyumbani kwa tembo wakubwa wa Afrika.',
    },
    bwindi: {
      name: 'Msitu wa Bwindi', title: 'Msitu Usiopenyeka', speaker: 'Sokwe Mkuu',
      line: 'Wimbo wa Mbegu ya Moyo unasikika kwenye vilima hivi. Familia yangu itakulinda — kimbia!',
      blurb: 'Msitu wa mvua wa kale wenye ukungu, nyumbani kwa nusu ya sokwe wa milimani duniani.',
    },
  },
};

/** The Kiswahili game text, exported so tests can check nothing is left out. */
export const KISWAHILI = DATA;

/** Puts the Kiswahili into the game data, once, before anything renders. */
function applyKiswahili() {
  for (const r of RUNNERS) Object.assign(r, DATA.runners[r.id]);
  for (const o of OUTFITS) Object.assign(o, DATA.outfits[o.id]);
  for (const [id, a] of Object.entries(ALLIES)) Object.assign(a, DATA.allies[id]);
  INTRO.forEach((p, i) => Object.assign(p, DATA.intro[i]));
  TUTORIAL.forEach((p, i) => DATA.tutorial[i] && (p.text = DATA.tutorial[i]));
  for (const m of MISSION_POOL) if (DATA.missions[m.id]) m.text = DATA.missions[m.id];
  for (const w of HUNT_WORDS) if (DATA.hunt[w.word]) w.line = DATA.hunt[w.word];
  for (const [id, b] of Object.entries(BOOSTS)) Object.assign(b, DATA.boosts[id]);
  SHOUTS.splice(0, SHOUTS.length, ...DATA.shouts);
  for (const [k, line] of Object.entries(DATA.nearMiss)) if (NEAR_MISS[k]) NEAR_MISS[k] = { ...NEAR_MISS[k], line };
  for (const r of REGIONS) Object.assign(r, DATA.regions[r.id]);
}

if (lang === 'sw') applyKiswahili();
if (typeof document !== 'undefined') document.documentElement.lang = lang;
