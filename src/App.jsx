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

const KO_ROUNDS = [
  { es:"Dieciseisavos de final", en:"Round of 32", d:"28 jun – 3 jul" },
  { es:"Octavos de final", en:"Round of 16", d:"4 – 7 jul" },
  { es:"Cuartos de final", en:"Quarter-finals", d:"9 – 11 jul" },
  { es:"Semifinales", en:"Semi-finals", d:"14 – 15 jul · Dallas / Atlanta" },
  { es:"Tercer lugar", en:"Third place", d:"18 jul · Miami" },
  { es:"Gran Final", en:"Final", d:"19 jul · MetLife, Nueva York/NJ" },
];

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
  bracket:{es:"Llaves",en:"Bracket"}, info:{es:"Info",en:"About"},
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

function SponsorSlot({lang}) {
  return (
    <div style={{margin:"14px 0", padding:"12px 16px", borderRadius:12,
      border:`1.5px dashed ${C.gold}55`, background:"linear-gradient(90deg,#F2C14E0F,transparent)",
      display:"flex", justifyContent:"space-between", alignItems:"center", gap:10}}>
      <div>
        <div style={{fontSize:11, letterSpacing:2, color:C.gold, fontWeight:700}}>SPONSOR</div>
        <div style={{fontSize:14, color:C.text}}>{t("sponsor",lang)}</div>
      </div>
      <div style={{fontSize:12, color:C.mute, textAlign:"right"}}>{t("sponsorCta",lang)}</div>
    </div>
  );
}

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
      <SponsorSlot lang={lang}/>
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

function BracketView({lang}) {
  return (
    <div>
      {KO_ROUNDS.map((r,i)=>(
        <div key={i} style={{display:"flex", alignItems:"center", gap:14,
          background: i===KO_ROUNDS.length-1 ? "#F2C14E14" : C.card,
          border:`1px solid ${i===KO_ROUNDS.length-1 ? C.gold+"66" : C.line}`,
          borderRadius:14, padding:"14px 16px", marginBottom:10}}>
          <div style={{fontFamily:"ui-monospace,monospace", fontSize:22, fontWeight:800,
            color: i===KO_ROUNDS.length-1 ? C.gold : C.mute, minWidth:44, textAlign:"center"}}>
            {[32,16,8,4,2,"🏆"][i]}
          </div>
          <div>
            <div style={{fontWeight:700, color:C.text}}>{lang==="es"?r.es:r.en}</div>
            <div style={{fontSize:13, color:C.mute}}>{r.d}</div>
          </div>
        </div>
      ))}
      <p style={{color:C.mute, fontSize:13}}>{t("rule",lang)}</p>
    </div>
  );
}

function InfoView({lang}) {
  return (
    <div style={{background:C.card, border:`1px solid ${C.line}`, borderRadius:14,
      padding:"16px 18px", lineHeight:1.65}}>
      <h3 style={{margin:"0 0 8px", color:C.gold}}>{t("infoTitle",lang)}</h3>
      <p style={{color:C.text, margin:0}}>{t("infoBody",lang)}</p>
      <SponsorSlot lang={lang}/>
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
        {tab==="bracket" && <BracketView lang={lang}/>}
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
