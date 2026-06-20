import { useState, useMemo, useEffect } from "react";

/* ============================================================
   MUNDIAL 2026 · TRACKER (versión con API en vivo)
   - Calendario, sedes y grupos: datos estáticos verificados
     (sorteo oficial FIFA + repechajes de marzo 2026)
   - Resultados: se cargan en vivo desde /api/scores
     (football-data.org, plan gratis) con caché de 60s
   - Respaldo: si la API falla, se usa el objeto RESULTS
   ============================================================ */

const TEAMS = {
  MEX:{es:"México",en:"Mexico",f:"🇲🇽"}, RSA:{es:"Sudáfrica",en:"South Africa",f:"🇿🇦"},
  KOR:{es:"Corea del Sur",en:"South Korea",f:"🇰🇷"}, CZE:{es:"Chequia",en:"Czechia",f:"🇨🇿"},
  CAN:{es:"Canadá",en:"Canada",f:"🇨🇦"}, BIH:{es:"Bosnia y Herz.",en:"Bosnia & Herz.",f:"🇧🇦"},
  QAT:{es:"Catar",en:"Qatar",f:"🇶🇦"}, SUI:{es:"Suiza",en:"Switzerland",f:"🇨🇭"},
  BRA:{es:"Brasil",en:"Brazil",f:"🇧🇷"}, MAR:{es:"Marruecos",en:"Morocco",f:"🇲🇦"},
  SCO:{es:"Escocia",en:"Scotland",f:"🏴󠁧󠁢󠁳󠁣󠁴󠁿"}, HAI:{es:"Haití",en:"Haiti",f:"🇭🇹"},
  USA:{es:"Estados Unidos",en:"United States",f:"🇺🇸"}, AUS:{es:"Australia",en:"Australia",f:"🇦🇺"},
  PAR:{es:"Paraguay",en:"Paraguay",f:"🇵🇾"}, TUR:{es:"Turquía",en:"Türkiye",f:"🇹🇷"},
  GER:{es:"Alemania",en:"Germany",f:"🇩🇪"}, ECU:{es:"Ecuador",en:"Ecuador",f:"🇪🇨"},
  CIV:{es:"Costa de Marfil",en:"Ivory Coast",f:"🇨🇮"}, CUW:{es:"Curazao",en:"Curaçao",f:"🇨🇼"},
  NED:{es:"Países Bajos",en:"Netherlands",f:"🇳🇱"}, JPN:{es:"Japón",en:"Japan",f:"🇯🇵"},
  TUN:{es:"Túnez",en:"Tunisia",f:"🇹🇳"}, SWE:{es:"Suecia",en:"Sweden",f:"🇸🇪"},
  BEL:{es:"Bélgica",en:"Belgium",f:"🇧🇪"}, IRN:{es:"Irán",en:"Iran",f:"🇮🇷"},
  EGY:{es:"Egipto",en:"Egypt",f:"🇪🇬"}, NZL:{es:"Nueva Zelanda",en:"New Zealand",f:"🇳🇿"},
  ESP:{es:"España",en:"Spain",f:"🇪🇸"}, URU:{es:"Uruguay",en:"Uruguay",f:"🇺🇾"},
  KSA:{es:"Arabia Saudita",en:"Saudi Arabia",f:"🇸🇦"}, CPV:{es:"Cabo Verde",en:"Cape Verde",f:"🇨🇻"},
  FRA:{es:"Francia",en:"France",f:"🇫🇷"}, SEN:{es:"Senegal",en:"Senegal",f:"🇸🇳"},
  NOR:{es:"Noruega",en:"Norway",f:"🇳🇴"}, IRQ:{es:"Irak",en:"Iraq",f:"🇮🇶"},
  ARG:{es:"Argentina",en:"Argentina",f:"🇦🇷"}, AUT:{es:"Austria",en:"Austria",f:"🇦🇹"},
  ALG:{es:"Argelia",en:"Algeria",f:"🇩🇿"}, JOR:{es:"Jordania",en:"Jordan",f:"🇯🇴"},
  POR:{es:"Portugal",en:"Portugal",f:"🇵🇹"}, COL:{es:"Colombia",en:"Colombia",f:"🇨🇴"},
  UZB:{es:"Uzbekistán",en:"Uzbekistan",f:"🇺🇿"}, COD:{es:"RD Congo",en:"DR Congo",f:"🇨🇩"},
  ENG:{es:"Inglaterra",en:"England",f:"🏴󠁧󠁢󠁥󠁮󠁧󠁿"}, CRO:{es:"Croacia",en:"Croatia",f:"🇭🇷"},
  PAN:{es:"Panamá",en:"Panama",f:"🇵🇦"}, GHA:{es:"Ghana",en:"Ghana",f:"🇬🇭"},
};

// Nombres que usa football-data.org → nuestro código
const NAME_MAP = {
  "mexico":"MEX","south africa":"RSA","korea republic":"KOR","south korea":"KOR",
  "czechia":"CZE","czech republic":"CZE","canada":"CAN",
  "bosnia and herzegovina":"BIH","bosnia & herzegovina":"BIH","qatar":"QAT",
  "switzerland":"SUI","brazil":"BRA","morocco":"MAR","scotland":"SCO","haiti":"HAI",
  "united states":"USA","usa":"USA","australia":"AUS","paraguay":"PAR",
  "turkiye":"TUR","türkiye":"TUR","turkey":"TUR","germany":"GER","ecuador":"ECU",
  "ivory coast":"CIV","cote d'ivoire":"CIV","côte d'ivoire":"CIV",
  "curacao":"CUW","curaçao":"CUW","netherlands":"NED","japan":"JPN",
  "tunisia":"TUN","sweden":"SWE","belgium":"BEL","iran":"IRN","ir iran":"IRN",
  "egypt":"EGY","new zealand":"NZL","spain":"ESP","uruguay":"URU",
  "saudi arabia":"KSA","cape verde":"CPV","cabo verde":"CPV","france":"FRA",
  "senegal":"SEN","norway":"NOR","iraq":"IRQ","argentina":"ARG","austria":"AUT",
  "algeria":"ALG","jordan":"JOR","portugal":"POR","colombia":"COL",
  "uzbekistan":"UZB","dr congo":"COD","congo dr":"COD",
  "democratic republic of the congo":"COD","england":"ENG","croatia":"CRO",
  "panama":"PAN","ghana":"GHA",
};
const resolveCode = (tla, name) => {
  if (tla && TEAMS[tla]) return tla;
  return NAME_MAP[(name || "").toLowerCase().trim()] || null;
};

// [id, grupo, fecha-hora UTC, ciudad, local, visitante]
const MATCHES = [
  ["A1","A","2026-06-11T19:00Z","Ciudad de México","MEX","RSA"],
  ["A2","A","2026-06-12T02:00Z","Guadalajara","KOR","CZE"],
  ["B1","B","2026-06-12T19:00Z","Toronto","CAN","BIH"],
  ["D1","D","2026-06-13T01:00Z","Los Ángeles","USA","PAR"],
  ["B2","B","2026-06-13T19:00Z","San Francisco","QAT","SUI"],
  ["C1","C","2026-06-13T22:00Z","Nueva York/NJ","BRA","MAR"],
  ["C2","C","2026-06-14T01:00Z","Boston","HAI","SCO"],
  ["D2","D","2026-06-14T04:00Z","Vancouver","AUS","TUR"],
  ["E1","E","2026-06-14T17:00Z","Houston","GER","CUW"],
  ["F1","F","2026-06-14T20:00Z","Dallas","NED","JPN"],
  ["E2","E","2026-06-14T23:00Z","Filadelfia","CIV","ECU"],
  ["F2","F","2026-06-15T02:00Z","Monterrey","SWE","TUN"],
  ["H1","H","2026-06-15T16:00Z","Atlanta","ESP","CPV"],
  ["G1","G","2026-06-15T19:00Z","Seattle","BEL","EGY"],
  ["H2","H","2026-06-15T22:00Z","Miami","KSA","URU"],
  ["G2","G","2026-06-16T01:00Z","Los Ángeles","IRN","NZL"],
  ["I1","I","2026-06-16T19:00Z","Nueva York/NJ","FRA","SEN"],
  ["I2","I","2026-06-16T22:00Z","Boston","IRQ","NOR"],
  ["J1","J","2026-06-17T01:00Z","Kansas City","ARG","ALG"],
  ["J2","J","2026-06-17T04:00Z","San Francisco","AUT","JOR"],
  ["K1","K","2026-06-17T17:00Z","Houston","POR","COD"],
  ["L1","L","2026-06-17T20:00Z","Dallas","ENG","CRO"],
  ["L2","L","2026-06-17T23:00Z","Toronto","GHA","PAN"],
  ["K2","K","2026-06-18T02:00Z","Ciudad de México","UZB","COL"],
  ["A3","A","2026-06-18T16:00Z","Atlanta","CZE","RSA"],
  ["B3","B","2026-06-18T19:00Z","Los Ángeles","SUI","BIH"],
  ["B4","B","2026-06-18T22:00Z","Vancouver","CAN","QAT"],
  ["A4","A","2026-06-19T01:00Z","Guadalajara","MEX","KOR"],
  ["D3","D","2026-06-19T19:00Z","Seattle","USA","AUS"],
  ["C3","C","2026-06-19T22:00Z","Boston","SCO","MAR"],
  ["C4","C","2026-06-20T01:00Z","Filadelfia","BRA","HAI"],
  ["D4","D","2026-06-20T04:00Z","San Francisco","TUR","PAR"],
  ["F3","F","2026-06-20T17:00Z","Houston","NED","SWE"],
  ["E3","E","2026-06-20T20:00Z","Toronto","GER","CIV"],
  ["E4","E","2026-06-21T00:00Z","Kansas City","ECU","CUW"],
  ["F4","F","2026-06-21T04:00Z","Monterrey","TUN","JPN"],
  ["H3","H","2026-06-21T16:00Z","Atlanta","ESP","KSA"],
  ["G3","G","2026-06-21T19:00Z","Los Ángeles","BEL","IRN"],
  ["H4","H","2026-06-21T22:00Z","Miami","URU","CPV"],
  ["G4","G","2026-06-22T01:00Z","Vancouver","NZL","EGY"],
  ["J3","J","2026-06-22T17:00Z","Dallas","ARG","AUT"],
  ["I3","I","2026-06-22T21:00Z","Filadelfia","FRA","IRQ"],
  ["I4","I","2026-06-23T00:00Z","Nueva York/NJ","NOR","SEN"],
  ["J4","J","2026-06-23T03:00Z","San Francisco","JOR","ALG"],
  ["K3","K","2026-06-23T17:00Z","Houston","POR","UZB"],
  ["L3","L","2026-06-23T20:00Z","Boston","ENG","GHA"],
  ["L4","L","2026-06-23T23:00Z","Toronto","PAN","CRO"],
  ["K4","K","2026-06-24T02:00Z","Guadalajara","COL","COD"],
  ["B5","B","2026-06-24T19:00Z","Vancouver","SUI","CAN"],
  ["B6","B","2026-06-24T19:00Z","Seattle","BIH","QAT"],
  ["C5","C","2026-06-24T22:00Z","Miami","SCO","BRA"],
  ["C6","C","2026-06-24T22:00Z","Atlanta","MAR","HAI"],
  ["A5","A","2026-06-25T01:00Z","Ciudad de México","CZE","MEX"],
  ["A6","A","2026-06-25T01:00Z","Monterrey","RSA","KOR"],
  ["E5","E","2026-06-25T20:00Z","Nueva York/NJ","ECU","GER"],
  ["E6","E","2026-06-25T20:00Z","Filadelfia","CUW","CIV"],
  ["F5","F","2026-06-25T23:00Z","Dallas","JPN","SWE"],
  ["F6","F","2026-06-25T23:00Z","Kansas City","TUN","NED"],
  ["D5","D","2026-06-26T02:00Z","Los Ángeles","TUR","USA"],
  ["D6","D","2026-06-26T02:00Z","San Francisco","PAR","AUS"],
  ["I5","I","2026-06-26T19:00Z","Boston","NOR","FRA"],
  ["I6","I","2026-06-26T19:00Z","Toronto","SEN","IRQ"],
  ["H5","H","2026-06-27T00:00Z","Houston","CPV","KSA"],
  ["H6","H","2026-06-27T00:00Z","Guadalajara","URU","ESP"],
  ["G5","G","2026-06-27T03:00Z","Seattle","EGY","IRN"],
  ["G6","G","2026-06-27T03:00Z","Vancouver","NZL","BEL"],
  ["L5","L","2026-06-27T21:00Z","Nueva York/NJ","PAN","ENG"],
  ["L6","L","2026-06-27T21:00Z","Filadelfia","CRO","GHA"],
  ["K5","K","2026-06-27T23:30Z","Miami","COL","POR"],
  ["K6","K","2026-06-27T23:30Z","Atlanta","COD","UZB"],
  ["J5","J","2026-06-28T02:00Z","Kansas City","ALG","AUT"],
  ["J6","J","2026-06-28T02:00Z","Dallas","JOR","ARG"],
];

/* RESPALDO MANUAL — solo se usa si la API no responde
   o no tiene aún el partido. Formato: ID: [local, visitante] */
const FALLBACK_RESULTS = {
  A1: [2, 0], // México 2-0 Sudáfrica
  A2: [2, 1], // Corea del Sur 2-1 Chequia
};

// Rondas de eliminación, en orden
const KO_ROUNDS = [
  { key:"R32", es:"Dieciseisavos de final", en:"Round of 32" },
  { key:"R16", es:"Octavos de final", en:"Round of 16" },
  { key:"QF",  es:"Cuartos de final", en:"Quarter-finals" },
  { key:"SF",  es:"Semifinales", en:"Semi-finals" },
  { key:"TP",  es:"Tercer lugar", en:"Third place" },
  { key:"F",   es:"Final", en:"Final" },
];

// Etapas que devuelve football-data.org → nuestra ronda
const STAGE_MAP = {
  LAST_32:"R32", LAST_16:"R16",
  QUARTER_FINALS:"QF", QUARTER_FINAL:"QF",
  SEMI_FINALS:"SF", SEMI_FINAL:"SF",
  THIRD_PLACE:"TP", "3RD_PLACE":"TP",
  FINAL:"F",
};
const KO_STAGES = new Set(Object.keys(STAGE_MAP));

/* Calendario oficial de eliminatorias (sorteo FIFA).
   Sedes, fechas y horarios verificados. Los equipos son
   marcadores (2.º A, Ganador 73, etc.) hasta que se definan:
   se llenan SOLOS desde la API cuando FIFA asigna los cruces.
   [id, ronda, fecha-hora UTC, ciudad, localSlot, visitanteSlot] */
const KNOCKOUT = [
  // Dieciseisavos (28 jun – 3 jul)
  ["73","R32","2026-06-28T19:00Z","Los Ángeles","2A","2B"],
  ["76","R32","2026-06-29T17:00Z","Houston","1C","2F"],
  ["74","R32","2026-06-29T20:30Z","Boston","1E","3:ABCDF"],
  ["75","R32","2026-06-30T01:00Z","Monterrey","1F","2C"],
  ["78","R32","2026-06-30T17:00Z","Dallas","2E","2I"],
  ["77","R32","2026-06-30T21:00Z","Nueva York/NJ","1I","3:CDFGH"],
  ["79","R32","2026-07-01T01:00Z","Ciudad de México","1A","3:CEFHI"],
  ["80","R32","2026-07-01T16:00Z","Atlanta","1L","3:EHIJK"],
  ["82","R32","2026-07-01T20:00Z","Seattle","1G","3:AEHIJ"],
  ["81","R32","2026-07-02T00:00Z","San Francisco","1D","3:BEFIJ"],
  ["84","R32","2026-07-02T19:00Z","Los Ángeles","1H","2J"],
  ["83","R32","2026-07-02T23:00Z","Toronto","2K","2L"],
  ["85","R32","2026-07-03T03:00Z","Vancouver","1B","3:EFGIJ"],
  ["88","R32","2026-07-03T18:00Z","Dallas","2D","2G"],
  ["86","R32","2026-07-03T22:00Z","Miami","1J","2H"],
  ["87","R32","2026-07-04T01:30Z","Kansas City","1K","3:DEIJL"],
  // Octavos (4 – 7 jul)
  ["90","R16","2026-07-04T17:00Z","Houston","W73","W75"],
  ["89","R16","2026-07-04T21:00Z","Filadelfia","W74","W77"],
  ["91","R16","2026-07-05T20:00Z","Nueva York/NJ","W76","W78"],
  ["92","R16","2026-07-06T00:00Z","Ciudad de México","W79","W80"],
  ["93","R16","2026-07-06T19:00Z","Dallas","W83","W84"],
  ["94","R16","2026-07-07T00:00Z","Seattle","W81","W82"],
  ["95","R16","2026-07-07T16:00Z","Atlanta","W86","W88"],
  ["96","R16","2026-07-07T20:00Z","Vancouver","W85","W87"],
  // Cuartos (9 – 11 jul)
  ["97","QF","2026-07-09T20:30Z","Boston","W89","W90"],
  ["98","QF","2026-07-11T00:00Z","Los Ángeles","W93","W94"],
  ["99","QF","2026-07-11T21:00Z","Miami","W91","W92"],
  ["100","QF","2026-07-12T01:00Z","Kansas City","W95","W96"],
  // Semifinales (14 – 15 jul)
  ["101","SF","2026-07-14T19:00Z","Dallas","W97","W98"],
  ["102","SF","2026-07-15T19:00Z","Atlanta","W99","W100"],
  // Tercer lugar (18 jul)
  ["103","TP","2026-07-18T21:00Z","Miami","P101","P102"],
  // Final (19 jul)
  ["104","F","2026-07-19T19:00Z","Nueva York/NJ","W101","W102"],
];

// Convierte un slot ("2A", "1C", "3:ABCDF", "W73", "P101") a texto
function slotLabel(slot, lang) {
  if (slot.startsWith("W")) return (lang==="es"?"Ganador ":"Winner ") + slot.slice(1);
  if (slot.startsWith("P")) return (lang==="es"?"Perdedor ":"Loser ") + slot.slice(1);
  if (slot.startsWith("3:")) {
    const groups = slot.slice(2).split("").join("/");
    return (lang==="es"?"Mejor 3.º (":"Best 3rd (") + groups + ")";
  }
  const pos = slot[0], grp = slot[1];
  const ord = lang==="es" ? pos+".º " : (pos==="1"?"1st ":"2nd ");
  return ord + grp;
}

const TZ_OPTIONS = [
  { id:"auto", es:"Tu hora (auto)", en:"Your time (auto)" },
  { id:"America/Santo_Domingo", es:"Rep. Dominicana", en:"Dominican Rep." },
  { id:"America/New_York", es:"EE.UU. Este (ET)", en:"US Eastern (ET)" },
  { id:"America/Mexico_City", es:"México (Centro)", en:"Mexico (Central)" },
  { id:"America/Los_Angeles", es:"EE.UU. Pacífico", en:"US Pacific" },
  { id:"America/Bogota", es:"Colombia / Perú", en:"Colombia / Peru" },
  { id:"America/Argentina/Buenos_Aires", es:"Argentina", en:"Argentina" },
  { id:"Europe/Madrid", es:"España", en:"Spain" },
];

const TXT = {
  matches:{es:"Partidos",en:"Matches"}, groups:{es:"Grupos",en:"Groups"},
  bracket:{es:"Eliminatorias",en:"Bracket"}, info:{es:"Info",en:"About"},
  today:{es:"HOY",en:"TODAY"}, live:{es:"EN VIVO",en:"LIVE"},
  ft:{es:"FINAL",en:"FT"}, group:{es:"Grupo",en:"Group"},
  thirds:{es:"Mejores terceros (clasifican 8 de 12)",en:"Best thirds (8 of 12 advance)"},
  rule:{es:"Avanzan 1.º y 2.º de cada grupo + los 8 mejores terceros → 32 equipos.",
        en:"Top 2 of each group + the 8 best third-placed teams advance → 32 teams."},
  noMatches:{es:"Sin partidos este día.",en:"No matches this day."},
  pts:{es:"PTS",en:"PTS"},
  sponsor:{es:"Espacio disponible para tu marca",en:"Your brand here"},
  sponsorCta:{es:"Patrocina el Mundial con nosotros",en:"Sponsor the World Cup with us"},
  infoTitle:{es:"Acerca de esta app",en:"About this app"},
  infoBody:{es:"Calendario, sedes y grupos según el sorteo oficial FIFA (5 dic 2025) y los repechajes de marzo 2026. Los horarios se muestran automáticamente en tu zona horaria. Marcadores en vivo vía football-data.org.",
            en:"Schedule, venues and groups per the official FIFA draw (Dec 5, 2025) and the March 2026 playoffs. Kickoff times adjust to your timezone automatically. Live scores via football-data.org."},
  liveData:{es:"Marcadores en vivo · actualizado",en:"Live scores · updated"},
  fallbackData:{es:"Modo respaldo (datos manuales)",en:"Fallback mode (manual data)"},
  koIntro:{es:"Calendario oficial de la fase final con fechas, sedes y horarios en tu zona. Los equipos aparecen en cuanto FIFA define cada cruce; los marcadores entran en vivo.",
           en:"Official knockout schedule with dates, venues and times in your zone. Teams appear as soon as FIFA sets each tie; scores update live."},
  pens:{es:"pen.",en:"pen."},
  createdBy:{es:"Una app de",en:"An app by"},
  ubicuaCta:{es:"Visitar portal →",en:"Visit site →"},
};

const t = (k, lang) => TXT[k][lang];
const tn = (code, lang) => TEAMS[code][lang];

function fmtTime(iso, tz, lang) {
  const opts = { hour:"2-digit", minute:"2-digit", hour12:true };
  if (tz !== "auto") opts.timeZone = tz;
  return new Date(iso).toLocaleTimeString(lang==="es"?"es-DO":"en-US", opts);
}
function fmtDayKey(iso, tz) {
  const opts = { year:"numeric", month:"2-digit", day:"2-digit" };
  if (tz !== "auto") opts.timeZone = tz;
  return new Date(iso).toLocaleDateString("en-CA", opts);
}
function fmtDayLabel(key, lang) {
  const d = new Date(key + "T12:00:00");
  return d.toLocaleDateString(lang==="es"?"es-DO":"en-US",
    { weekday:"short", day:"numeric", month:"short" });
}

/* Empareja partidos de la API con nuestro calendario:
   misma pareja de equipos (en cualquier orden) y fecha a ±36h */
function mergeApiResults(apiMatches) {
  const results = { ...FALLBACK_RESULTS };
  const liveIds = new Set();
  if (!apiMatches?.length) return { results, liveIds };

  const index = new Map();
  for (const m of MATCHES) {
    index.set([m[4], m[5]].sort().join("-") , (index.get([m[4],m[5]].sort().join("-"))||[]).concat([m]));
  }
  for (const am of apiMatches) {
    const h = resolveCode(am.home, am.homeName);
    const a = resolveCode(am.away, am.awayName);
    if (!h || !a) continue;
    const candidates = index.get([h, a].sort().join("-")) || [];
    const apiTime = new Date(am.utcDate).getTime();
    const local = candidates.find(
      (m) => Math.abs(new Date(m[2]).getTime() - apiTime) < 36 * 3600 * 1000
    );
    if (!local) continue;
    const sameOrder = local[4] === h;
    const hg = sameOrder ? am.hg : am.ag;
    const ag = sameOrder ? am.ag : am.hg;
    if (am.status === "FINISHED" && hg != null && ag != null) {
      results[local[0]] = [hg, ag];
    } else if (["IN_PLAY", "PAUSED"].includes(am.status)) {
      liveIds.add(local[0]);
      if (hg != null && ag != null) results[local[0]] = [hg, ag];
    }
  }
  return { results, liveIds };
}

function computeStandings(results) {
  const table = {};
  for (const m of MATCHES) {
    for (const team of [m[4], m[5]]) {
      if (!table[team]) table[team] = { team, g:m[1], pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,pts:0 };
    }
    const r = results[m[0]];
    if (!r) continue;
    const [hg, ag] = r, h = table[m[4]], a = table[m[5]];
    h.pj++; a.pj++; h.gf+=hg; h.gc+=ag; a.gf+=ag; a.gc+=hg;
    if (hg>ag){h.pg++;a.pp++;h.pts+=3;}
    else if (hg<ag){a.pg++;h.pp++;a.pts+=3;}
    else {h.pe++;a.pe++;h.pts++;a.pts++;}
  }
  const byGroup = {};
  Object.values(table).forEach(r => (byGroup[r.g] ||= []).push(r));
  const sortFn = (a,b)=> b.pts-a.pts || (b.gf-b.gc)-(a.gf-a.gc) || b.gf-a.gf;
  Object.values(byGroup).forEach(rows => rows.sort(sortFn));
  const thirds = Object.values(byGroup).map(rows=>rows[2]).sort(sortFn);
  return { byGroup, thirds };
}

/* ---------- UI ---------- */

const C = {
  bg:"#0B1322", card:"#131F35", card2:"#0F1A2D", line:"rgba(170,195,235,0.12)",
  text:"#ECF2FC", mute:"#8FA3C4", green:"#2EE08A", gold:"#F2C14E",
};

function MatchCard({m, tz, lang, results, liveIds}) {
  const r = results[m[0]];
  const isLive = liveIds.has(m[0]);
  return (
    <div style={{background:C.card, border:`1px solid ${isLive?C.green+"66":C.line}`,
      borderRadius:14, padding:"12px 14px", marginBottom:10}}>
      <div style={{display:"flex", justifyContent:"space-between", fontSize:11,
        color:C.mute, letterSpacing:1, marginBottom:8}}>
        <span>{t("group",lang)} {m[1]} · {m[3]}</span>
        {isLive
          ? <span style={{color:C.green, fontWeight:800}}>● {t("live",lang)}</span>
          : r ? <span style={{color:C.gold, fontWeight:700}}>{t("ft",lang)}</span>
              : <span>{fmtTime(m[2], tz, lang)}</span>}
      </div>
      {[ [m[4], r?.[0]], [m[5], r?.[1]] ].map(([code, goals], i) => {
        const decided = r && !isLive;
        const won = decided && ((i===0 && r[0]>r[1]) || (i===1 && r[1]>r[0]));
        return (
          <div key={code} style={{display:"flex", justifyContent:"space-between",
            alignItems:"center", padding:"3px 0"}}>
            <span style={{fontSize:16, fontWeight: won?800:500,
              color: decided && !won ? C.mute : C.text}}>
              <span style={{marginRight:8}}>{TEAMS[code].f}</span>{tn(code,lang)}
            </span>
            <span style={{fontFamily:"ui-monospace,monospace", fontSize:20,
              fontWeight:800, minWidth:26, textAlign:"right",
              color: isLive ? C.green : won ? C.green : r ? C.mute : C.line}}>
              {r ? goals : "–"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MatchesView({tz, lang, results, liveIds}) {
  const days = useMemo(()=>{
    const map = new Map();
    for (const m of MATCHES) {
      const k = fmtDayKey(m[2], tz);
      (map.get(k) ?? map.set(k, []).get(k)).push(m);
    }
    return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  },[tz]);

  const todayKey = fmtDayKey(new Date().toISOString(), tz);
  const defaultIdx = Math.max(0, days.findIndex(([k])=>k>=todayKey));
  const [idx, setIdx] = useState(defaultIdx === -1 ? days.length-1 : defaultIdx);
  const safe = Math.min(idx, days.length-1);
  const [, list] = days[safe];

  return (
    <div>
      <div style={{display:"flex", gap:6, overflowX:"auto", paddingBottom:10,
        marginBottom:6, WebkitOverflowScrolling:"touch"}}>
        {days.map(([k],i)=>(
          <button key={k} onClick={()=>setIdx(i)} style={{
            flex:"0 0 auto", padding:"7px 12px", borderRadius:999, cursor:"pointer",
            border:`1px solid ${i===safe?C.green:C.line}`,
            background: i===safe ? "#2EE08A1A" : "transparent",
            color: k===todayKey ? C.green : i===safe ? C.text : C.mute,
            fontWeight: i===safe?700:500, fontSize:13, whiteSpace:"nowrap"}}>
            {k===todayKey ? t("today",lang) : fmtDayLabel(k,lang)}
          </button>
        ))}
      </div>
      {list.length ? list.map(m=>
        <MatchCard key={m[0]} m={m} tz={tz} lang={lang} results={results} liveIds={liveIds}/>)
        : <p style={{color:C.mute}}>{t("noMatches",lang)}</p>}
    </div>
  );
}

function Table({rows, lang, highlight}) {
  return (
    <table style={{width:"100%", borderCollapse:"collapse", fontSize:13}}>
      <thead><tr style={{color:C.mute, fontSize:11, letterSpacing:1}}>
        <th style={{textAlign:"left", padding:"4px 2px"}}></th>
        {["PJ","G","E","P","DG",t("pts",lang)].map(h=>
          <th key={h} style={{padding:"4px 4px", textAlign:"center"}}>{h}</th>)}
      </tr></thead>
      <tbody>
        {rows.map((r,i)=>(
          <tr key={r.team} style={{borderTop:`1px solid ${C.line}`,
            background: i<highlight ? "#2EE08A0D" : "transparent"}}>
            <td style={{padding:"7px 2px", color:C.text}}>
              <span style={{color: i<highlight?C.green:C.mute, fontWeight:700,
                marginRight:8, fontFamily:"ui-monospace,monospace"}}>{i+1}</span>
              {TEAMS[r.team].f} {tn(r.team,lang)}
            </td>
            {[r.pj,r.pg,r.pe,r.pp,r.gf-r.gc,r.pts].map((v,j)=>
              <td key={j} style={{textAlign:"center", padding:"7px 4px",
                color: j===5?C.text:C.mute, fontWeight: j===5?800:400,
                fontFamily:"ui-monospace,monospace"}}>
                {j===4 && v>0 ? "+"+v : v}
              </td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GroupsView({lang, results}) {
  const {byGroup, thirds} = useMemo(()=>computeStandings(results), [results]);
  return (
    <div>
      <p style={{color:C.mute, fontSize:13, marginTop:0}}>{t("rule",lang)}</p>
      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))", gap:12}}>
        {Object.keys(byGroup).sort().map(g=>(
          <div key={g} style={{background:C.card, border:`1px solid ${C.line}`,
            borderRadius:14, padding:"12px 14px"}}>
            <div style={{fontWeight:800, marginBottom:6, color:C.gold,
              letterSpacing:1, fontSize:13}}>{t("group",lang).toUpperCase()} {g}</div>
            <Table rows={byGroup[g]} lang={lang} highlight={2}/>
          </div>
        ))}
      </div>
      <div style={{background:C.card2, border:`1px solid ${C.line}`,
        borderRadius:14, padding:"12px 14px", marginTop:14}}>
        <div style={{fontWeight:800, marginBottom:6, color:C.green, fontSize:13}}>
          {t("thirds",lang)}</div>
        <Table rows={thirds} lang={lang} highlight={8}/>
      </div>
    </div>
  );
}

/* Une el calendario fijo de eliminatorias con lo que entrega la API.
   Empareja por ronda + cercanía de horario, sin inventar nada:
   si la API ya tiene los equipos reales, los muestra; si no, deja
   el marcador de posición (2.º A, Ganador 73, etc.). */
function mergeKnockout(apiMatches) {
  const out = {};
  const koApi = (apiMatches || []).filter(m => KO_STAGES.has(m.stage));
  const byRound = {};
  for (const am of koApi) {
    const rk = STAGE_MAP[am.stage];
    (byRound[rk] ||= []).push(am);
  }
  for (const rk of Object.keys(byRound)) byRound[rk].sort((a,b)=>new Date(a.utcDate)-new Date(b.utcDate));

  for (const rd of KO_ROUNDS) {
    const statics = KNOCKOUT.filter(k => k[1]===rd.key).sort((a,b)=>new Date(a[2])-new Date(b[2]));
    const apis = (byRound[rd.key] || []).slice();
    for (const k of statics) {
      const kt = new Date(k[2]).getTime();
      let best=-1, bestDiff=Infinity;
      apis.forEach((am,idx)=>{
        const d = Math.abs(new Date(am.utcDate).getTime()-kt);
        if (d<bestDiff){bestDiff=d; best=idx;}
      });
      if (best>=0 && bestDiff < 6*3600*1000) {
        const am = apis.splice(best,1)[0];
        const live = ["IN_PLAY","PAUSED"].includes(am.status);
        const done = am.status==="FINISHED";
        out[k[0]] = {
          home: resolveCode(am.home, am.homeName),
          away: resolveCode(am.away, am.awayName),
          hg: am.hg, ag: am.ag, php: am.php, pap: am.pap,
          live, done,
        };
      }
    }
  }
  return out;
}

function KnockoutCard({ k, tz, lang, info }) {
  const [, , utc, city, hSlot, aSlot] = k;
  const live = info?.live, done = info?.done;
  const rows = [
    { code: info?.home, slot: hSlot, g: info?.hg, p: info?.php, side:0 },
    { code: info?.away, slot: aSlot, g: info?.ag, p: info?.pap, side:1 },
  ];
  const hasScore = info && info.hg != null && info.ag != null;
  const winSide = done && hasScore
    ? (info.hg>info.ag ? 0 : info.ag>info.hg ? 1
      : (info.php??0)>(info.pap??0) ? 0 : (info.pap??0)>(info.php??0) ? 1 : -1)
    : -1;
  return (
    <div style={{background:C.card, border:`1px solid ${live?C.green+"66":C.line}`,
      borderRadius:14, padding:"12px 14px", marginBottom:10}}>
      <div style={{display:"flex", justifyContent:"space-between", fontSize:11,
        color:C.mute, letterSpacing:1, marginBottom:8}}>
        <span>#{k[0]} · {city}</span>
        {live ? <span style={{color:C.green, fontWeight:800}}>● {t("live",lang)}</span>
          : done ? <span style={{color:C.gold, fontWeight:700}}>{t("ft",lang)}</span>
          : <span>{fmtDayLabel(fmtDayKey(utc,tz),lang)} · {fmtTime(utc,tz,lang)}</span>}
      </div>
      {rows.map((r,i)=>{
        const known = r.code && TEAMS[r.code];
        const won = winSide===i;
        return (
          <div key={i} style={{display:"flex", justifyContent:"space-between",
            alignItems:"center", padding:"3px 0"}}>
            <span style={{fontSize: known?16:14, fontWeight: won?800:500,
              color: known ? (done&&!won?C.mute:C.text) : C.mute,
              fontStyle: known?"normal":"italic"}}>
              {known ? <><span style={{marginRight:8}}>{TEAMS[r.code].f}</span>{tn(r.code,lang)}</>
                     : slotLabel(r.slot, lang)}
            </span>
            <span style={{fontFamily:"ui-monospace,monospace", fontSize:20, fontWeight:800,
              minWidth:46, textAlign:"right",
              color: live?C.green : won?C.green : hasScore?C.mute : C.line}}>
              {hasScore ? <>{r.g}{r.p!=null && <span style={{fontSize:11, color:C.mute}}> ({r.p})</span>}</> : "–"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function KnockoutView({lang, tz, apiMatches}) {
  const ko = useMemo(()=>mergeKnockout(apiMatches), [apiMatches]);
  return (
    <div>
      <p style={{color:C.mute, fontSize:13, marginTop:0}}>{t("koIntro",lang)}</p>
      {KO_ROUNDS.map(rd=>{
        const matches = KNOCKOUT.filter(k=>k[1]===rd.key)
          .sort((a,b)=>new Date(a[2])-new Date(b[2]));
        return (
          <div key={rd.key} style={{marginBottom:18}}>
            <div style={{fontWeight:800, color:rd.key==="F"?C.gold:C.green,
              fontSize:14, letterSpacing:0.5, margin:"4px 0 10px"}}>
              {rd.key==="F" && "🏆 "}{lang==="es"?rd.es:rd.en}
            </div>
            {matches.map(k=>
              <KnockoutCard key={k[0]} k={k} tz={tz} lang={lang} info={ko[k[0]]}/>)}
          </div>
        );
      })}
    </div>
  );
}

function UbicuaCard({lang}) {
  return (
    <a href="https://ubicuaeducacion.com/academy/" target="_blank" rel="noopener noreferrer"
      style={{display:"block", textDecoration:"none", margin:"16px 0 0",
      padding:"16px 18px", borderRadius:14,
      border:`1.5px solid ${C.gold}66`,
      background:"linear-gradient(135deg,#F2C14E14,#0F1A2D)"}}>
      <div style={{fontSize:11, letterSpacing:2, color:C.gold, fontWeight:700, marginBottom:4}}>
        {t("createdBy",lang)}
      </div>
      <div style={{display:"flex", alignItems:"center", gap:10}}>
        <span style={{fontSize:22, fontWeight:900, color:C.text, letterSpacing:-0.5}}>
          Ubicua <span style={{color:C.gold}}>Academy</span>
        </span>
      </div>
      <div style={{fontSize:13, color:C.green, marginTop:6, fontWeight:600}}>
        {t("ubicuaCta",lang)}
      </div>
    </a>
  );
}

function InfoView({lang}) {
  return (
    <div style={{background:C.card, border:`1px solid ${C.line}`, borderRadius:14,
      padding:"16px 18px", lineHeight:1.65}}>
      <h3 style={{margin:"0 0 8px", color:C.gold}}>{t("infoTitle",lang)}</h3>
      <p style={{color:C.text, margin:0}}>{t("infoBody",lang)}</p>
      <UbicuaCard lang={lang}/>
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState("es");
  const [tz, setTz] = useState("auto");
  const [tab, setTab] = useState("matches");
  const [api, setApi] = useState({ matches: null, updatedAt: null, ok: false });

  // Carga marcadores cada 60s (el caché del servidor protege el rate limit)
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const r = await fetch("/api/scores");
        if (!r.ok) throw new Error();
        const data = await r.json();
        if (active) setApi({ matches: data.matches, updatedAt: data.updatedAt, ok: true });
      } catch {
        if (active) setApi((p) => ({ ...p, ok: false }));
      }
    };
    load();
    const id = setInterval(load, 60000);
    return () => { active = false; clearInterval(id); };
  }, []);

  const { results, liveIds } = useMemo(
    () => mergeApiResults(api.matches), [api.matches]
  );

  const tabs = ["matches","groups","bracket","info"];

  return (
    <div style={{minHeight:"100vh", background:C.bg, color:C.text,
      fontFamily:"'Archivo','Segoe UI',system-ui,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;700;900&display=swap');
        ::-webkit-scrollbar{height:5px;width:5px} ::-webkit-scrollbar-thumb{background:#2a3b58;border-radius:3px}
        button:focus-visible{outline:2px solid ${C.green};outline-offset:2px}`}</style>

      <header style={{padding:"18px 16px 10px", maxWidth:880, margin:"0 auto"}}>
        <div style={{display:"flex", justifyContent:"space-between",
          alignItems:"flex-start", gap:10, flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:11, letterSpacing:3, color:C.green, fontWeight:700}}>
              🇲🇽 🇺🇸 🇨🇦 · 11 JUN – 19 JUL
            </div>
            <h1 style={{margin:"2px 0 0", fontWeight:900, fontSize:"clamp(26px,6vw,38px)",
              letterSpacing:-0.5}}>
              MUNDIAL <span style={{color:C.gold}}>2026</span>
            </h1>
          </div>
          <div style={{display:"flex", gap:8}}>
            <select value={tz} onChange={e=>setTz(e.target.value)} style={{
              background:C.card, color:C.text, border:`1px solid ${C.line}`,
              borderRadius:10, padding:"7px 8px", fontSize:13}}>
              {TZ_OPTIONS.map(o=><option key={o.id} value={o.id}>
                🕐 {lang==="es"?o.es:o.en}</option>)}
            </select>
            <button onClick={()=>setLang(lang==="es"?"en":"es")} style={{
              background:C.card, color:C.text, border:`1px solid ${C.line}`,
              borderRadius:10, padding:"7px 12px", fontSize:13, cursor:"pointer",
              fontWeight:700}}>
              {lang==="es"?"EN":"ES"}
            </button>
          </div>
        </div>

        <nav style={{display:"flex", gap:6, marginTop:16}}>
          {tabs.map(id=>(
            <button key={id} onClick={()=>setTab(id)} style={{
              flex:1, padding:"10px 4px", borderRadius:12, cursor:"pointer",
              border:`1px solid ${tab===id?C.green+"88":C.line}`,
              background: tab===id ? "#2EE08A14" : C.card2,
              color: tab===id ? C.green : C.mute,
              fontWeight:700, fontSize:13, letterSpacing:0.5}}>
              {t(id,lang)}
            </button>
          ))}
        </nav>
      </header>

      <main style={{maxWidth:880, margin:"0 auto", padding:"4px 16px 30px"}}>
        {tab==="matches" && <MatchesView tz={tz} lang={lang} results={results} liveIds={liveIds}/>}
        {tab==="groups" && <GroupsView lang={lang} results={results}/>}
        {tab==="bracket" && <KnockoutView lang={lang} tz={tz} apiMatches={api.matches}/>}
        {tab==="info" && <InfoView lang={lang}/>}
      </main>

      <footer style={{maxWidth:880, margin:"0 auto", padding:"0 16px 40px",
        fontSize:11, color:C.mute, display:"flex", alignItems:"center", gap:6}}>
        <span style={{width:7, height:7, borderRadius:99, display:"inline-block",
          background: api.ok ? C.green : C.gold}}/>
        {api.ok
          ? `${t("liveData",lang)} ${api.updatedAt ? new Date(api.updatedAt).toLocaleTimeString(lang==="es"?"es-DO":"en-US",{hour:"2-digit",minute:"2-digit"}) : ""}`
          : t("fallbackData",lang)}
      </footer>
    </div>
  );
}
