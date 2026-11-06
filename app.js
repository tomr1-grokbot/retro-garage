/* Retro Garage M1.7 — bundled build (file:// friendly)
   Forward windshield POV + center rearview + driver-side mirror.
   Engine S1 bolt-ons only. No engine swap.
   Q3 cash-only start + Inbox odd jobs. Chaos QA input hitbox patch. M1 eight sprites embedded.
   M1.3: gas slide-off release + Inbox job cooldown/cap.
   M1.4: Computer Controls tab + remappable PC keys (persist in save + localStorage).
   M1.5: race F/R art — windshield rival=_rear; mirrors=_front flipped H into MIRROR_C/MIRROR_L.
         Relative sprites/car_0N_{front,rear}.png (crop+colorkey, NN, no stretch).
         car_06 front Drive id 1x3kJ4kHBLJrW3j-CClCrIZxiAjcRwd7d only (old grille trashed).
   M1.6: Pixel Forge bay + cockpit polish wired (sprites/bay_hub_polish.png,
         sprites/cockpit_dock_polish.png).
   M1.6.1: Chaos QA — Tune hitbox covers painted Engine card (y→130, x 140..340);
         WIND/MIRROR_C/MIRROR_L aligned to cockpit_dock_polish glass.
   M1.6.2: Chaos visual HOLD — glass inset; skip drawTouchDock when polish loads (reverted).
   M1.6.3: clean-dash polish (no painted controls) + live dock always owns
         wheel/pedals/shift/DNR (drawTouchDock + hitDock original coords);
         WIND/mirrors enlarged to fill punched glass, content-only mirrors.
   M1.7: Free Run — loaner practice (no car/cash), owned Fun run (Rep+soft cash),
         paid Night Drag unchanged; race.paidOut latch; bay door → loaner/Fun.
         Bay hub sprite content-fit sizing (opaque bbox + length table + shared floor);
         Classifieds thumbs + race F/R sprites unchanged. */
(function () {
  "use strict";

  var W = 480, H = 270;
  // M1.6.3: glass rects inset ~3px inside clean-dash punched openings (480×270).
  // WIND fills main glass (x~90..393, y~18..170). MIRROR_L = left punched glass.
  // MIRROR_C content-only inside WIND (no separate painted rearview frame). Both after road.
  var WIND = { x: 92, y: 20, w: 301, h: 150 };
  var MIRROR_C = { x: 186, y: 24, w: 120, h: 38 };
  var MIRROR_L = { x: 45, y: 63, w: 38, h: 96 };
  var SAVE_KEY = "retro_garage_m1_v2";

  var BINDS_KEY = "retro_garage_m1_binds";
  // Remappable PC binds: primary + optional alt. Remap edits primary.
  // Lean CRT legend order (Design Scout): gearing first, then pedals, range, steer.
  var DEFAULT_BINDS = {
    shiftUp:     { primary: "KeyE",       alt: "ShiftRight" },
    shiftDown:   { primary: "KeyQ",       alt: "ShiftLeft" },
    gas:         { primary: "Space",      alt: "KeyW" },
    brake:       { primary: "ArrowDown",  alt: "KeyS" },
    rangeD:      { primary: "Digit1",     alt: null },
    rangeN:      { primary: "Digit2",     alt: null },
    rangeR:      { primary: "Digit3",     alt: null },
    cycleRange:  { primary: "KeyR",       alt: null },
    steerL:      { primary: "ArrowLeft",  alt: "KeyA" },
    steerR:      { primary: "ArrowRight", alt: "KeyD" },
    menuUp:      { primary: "ArrowUp",    alt: "KeyW" },
    menuDown:    { primary: "ArrowDown",  alt: "KeyS" },
    menuConfirm: { primary: "Enter",      alt: "Space" }
  };
  // Gas also accepted ArrowUp historically — keep as soft third default via alt2 (not remapped UI row).
  DEFAULT_BINDS.gas.alt2 = "ArrowUp";
  var BIND_ROWS = [
    { id: "shiftUp",     label: "Shift Up",   section: "race" },
    { id: "shiftDown",   label: "Shift Down", section: "race" },
    { id: "gas",         label: "Gas",        section: "race" },
    { id: "brake",       label: "Brake",      section: "race" },
    { id: "rangeD",      label: "Range D",    section: "race" },
    { id: "rangeN",      label: "Range N",    section: "race" },
    { id: "rangeR",      label: "Range R",    section: "race" },
    { id: "cycleRange",  label: "Cycle D/N",  section: "race" },
    { id: "steerL",      label: "Steer L",    section: "race" },
    { id: "steerR",      label: "Steer R",    section: "race" },
    { id: "menuUp",      label: "Menu Up",    section: "menu" },
    { id: "menuDown",    label: "Menu Down",  section: "menu" },
    { id: "menuConfirm", label: "Menu OK",    section: "menu" }
  ];
  // Controls panel layout (draw + click must match)
  var CTRL_ROW_H = 16;
  var CTRL_ROW_Y0 = 70;
  var CTRL_COLS = 2;
  var CTRL_COL_W = 180;
  var CTRL_COL_X = [58, 248];
  var CTRL_LEFT_N = 7; // first 7 rows in left column (gearing/pedals/range)
  function ctrlRowRect(i){
    // returns {x,y,w,h} for bind row index i
    var col = (i < CTRL_LEFT_N) ? 0 : 1;
    var row = (i < CTRL_LEFT_N) ? i : (i - CTRL_LEFT_N);
    return { x: CTRL_COL_X[col], y: CTRL_ROW_Y0 + row*CTRL_ROW_H, w: CTRL_COL_W, h: CTRL_ROW_H-1 };
  }
  function ctrlResetY(){
    return CTRL_ROW_Y0 + CTRL_LEFT_N*CTRL_ROW_H + 8;
  }
  function cloneBinds(srcB){
    var out = {};
    var src = srcB || DEFAULT_BINDS;
    for (var k in DEFAULT_BINDS){
      var d = DEFAULT_BINDS[k];
      var s = (src && src[k]) || d;
      out[k] = { primary: s.primary || d.primary, alt: (s.alt !== undefined ? s.alt : d.alt) };
      if (d.alt2) out[k].alt2 = (s.alt2 !== undefined ? s.alt2 : d.alt2);
    }
    return out;
  }
  var keybinds = cloneBinds();
  var bindListen = null; // action id while capturing a new primary
  function humanizeKey(code){
    if (!code) return "—";
    var map = {
      Space: "SPACE", Enter: "ENTER", Escape: "ESC",
      ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓",
      ShiftLeft: "L-SHIFT", ShiftRight: "R-SHIFT",
      ControlLeft: "L-CTRL", ControlRight: "R-CTRL",
      AltLeft: "L-ALT", AltRight: "R-ALT",
      Backspace: "BKSP", Tab: "TAB", MetaLeft: "META", MetaRight: "META"
    };
    if (map[code]) return map[code];
    if (code.indexOf("Key") === 0) return code.slice(3);
    if (code.indexOf("Digit") === 0) return code.slice(5);
    if (code.indexOf("Numpad") === 0) return "NP"+code.slice(6);
    return code;
  }
  function bindLabel(action){
    var b = keybinds[action] || DEFAULT_BINDS[action];
    if (!b) return "?";
    var s = humanizeKey(b.primary);
    if (b.alt) s += "/" + humanizeKey(b.alt);
    return s;
  }
  function codesFor(action){
    var b = keybinds[action] || DEFAULT_BINDS[action];
    if (!b) return [];
    var arr = [b.primary];
    if (b.alt) arr.push(b.alt);
    if (b.alt2) arr.push(b.alt2);
    return arr;
  }
  function keyHeld(action){
    var c = codesFor(action);
    for (var i=0;i<c.length;i++) if (keys[c[i]]) return true;
    return false;
  }
  function codeMatches(action, code){
    var c = codesFor(action);
    for (var i=0;i<c.length;i++) if (c[i] === code) return true;
    return false;
  }
  function persistBinds(){
    try { localStorage.setItem(BINDS_KEY, JSON.stringify(keybinds)); } catch(e){}
    if (state) state.keybinds = cloneBinds(keybinds);
  }
  function loadBindsFrom(obj){
    if (!obj || typeof obj !== "object") return;
    keybinds = cloneBinds(obj);
  }
  function loadBindsStorage(){
    try {
      var raw = localStorage.getItem(BINDS_KEY);
      if (raw) loadBindsFrom(JSON.parse(raw));
    } catch(e){}
  }
  function resetBindsDefaults(){
    keybinds = cloneBinds();
    bindListen = null;
    persistBinds();
    toast("Controls reset to defaults.");
  }
  function findBindConflict(code, exceptAction){
    for (var i=0;i<BIND_ROWS.length;i++){
      var id = BIND_ROWS[i].id;
      if (id === exceptAction) continue;
      var b = keybinds[id];
      if (!b) continue;
      if (b.primary === code) return id;
    }
    return null;
  }
  function applyRemap(action, code){
    if (!keybinds[action]) return false;
    if (code === "Escape") { toast("Esc reserved (abort / cancel)."); return false; }
    var conflict = findBindConflict(code, action);
    if (conflict) {
      toast("Key used by "+conflict+" — pick another.");
      return false;
    }
    keybinds[action].primary = code;
    persistBinds();
    toast(BIND_ROWS.filter(function(r){return r.id===action;})[0].label+" → "+humanizeKey(code));
    return true;
  }

  var ENTRY_FEE = 50;
  var WIN_PAY = 180;
  var FUN_SOFT_CASH = 50; // Fun win cash only while cash < ENTRY_FEE
  var LOANER_CAR_ID = 7; // VW Golf GTI Mk1 — temp practice only, never garage
  var RACE_LEN = 402; // meters ~1/4 mile-ish arcade
  var AD_CYCLE = 8;

  // ---------- Roster (stable carId) ----------
  var ROSTER = {
    1:  { id:1,  year:1971, name:"Datsun 240Z",           hp:151, weight:1040, color:"#6a7a8a" },
    2:  { id:2,  year:1974, name:"Ford Escort RS2000",    hp:100, weight:900,  color:"#c44" },
    3:  { id:3,  year:1975, name:"Chevrolet Vega GT",     hp:110, weight:1120, color:"#3a6a9a" },
    4:  { id:4,  year:1978, name:"Volvo 242 GT",          hp:123, weight:1280, color:"#b8b0a0" },
    5:  { id:5,  year:1985, name:"Toyota Corolla AE86",   hp:130, weight:950,  color:"#e8e0d0" },
    6:  { id:6,  year:1987, name:"Buick Regal GNX",       hp:276, weight:1610, color:"#222" },
    7:  { id:7,  year:1983, name:"VW Golf GTI Mk1",       hp:110, weight:860,  color:"#c22" },
    8:  { id:8,  year:1990, name:"Mustang GT Fox",        hp:225, weight:1450, color:"#d44" },
    9:  { id:9,  year:1988, name:"Nissan Pulsar EXA",     hp:118, weight:980,  color:"#88a" },
    10: { id:10, year:1994, name:"Nissan 240SX S14",      hp:155, weight:1250, color:"#556" },
    11: { id:11, year:1989, name:"Skyline GT-R R32",      hp:280, weight:1430, color:"#445566" },
    12: { id:12, year:1993, name:"Supra RZ JZA80",        hp:276, weight:1540, color:"#e8e8e8" },
    13: { id:13, year:1999, name:"RX-7 Type R FD",        hp:280, weight:1260, color:"#c00" },
    14: { id:14, year:1997, name:"Civic Type R EK9",      hp:185, weight:1050, color:"#f0f0f0" },
    15: { id:15, year:1985, name:"MR2 AW11",              hp:112, weight:980,  color:"#e8c040" },
    16: { id:16, year:1989, name:"Peugeot 205 GTI",       hp:130, weight:880,  color:"#c44" },
    17: { id:17, year:1998, name:"Impreza WRX STI GC8",   hp:280, weight:1270, color:"#2266bb" },
    18: { id:18, year:1990, name:"MX-5 Miata NA",         hp:116, weight:940,  color:"#c04040" },
    19: { id:19, year:1970, name:"Chevelle SS",           hp:350, weight:1700, color:"#2244aa" },
    20: { id:20, year:1994, name:"Accord Wagon CE1",      hp:145, weight:1380, color:"#8899aa" },
    21: { id:21, year:1991, name:"Silvia S13",            hp:175, weight:1200, color:"#ccdd88" },
    22: { id:22, year:1998, name:"Legacy GT-B",           hp:280, weight:1450, color:"#334455" },
    23: { id:23, year:1992, name:"Autozam AZ-1",          hp:64,  weight:720,  color:"#e8e040" },
    24: { id:24, year:2003, name:"Nissan 350Z",           hp:287, weight:1450, color:"#8899aa" },
    25: { id:25, year:2000, name:"S2000 AP1",             hp:240, weight:1270, color:"#f0f0f0" },
    26: { id:26, year:1987, name:"BMW 325i E30",          hp:168, weight:1270, color:"#445566" },
    27: { id:27, year:1999, name:"Eclipse GSX",           hp:210, weight:1450, color:"#c44" },
    28: { id:28, year:1997, name:"Integra Type R DC2",    hp:195, weight:1170, color:"#f5f5f5" },
    29: { id:29, year:2001, name:"BMW M3 E46",            hp:333, weight:1570, color:"#2244aa" },
    30: { id:30, year:2003, name:"Dodge SRT-4",           hp:230, weight:1320, color:"#2244aa" }
  };

  // Engine Stage 1 bolt-ons only (M1)
  var PARTS = {
    intake:  { id:"intake",  name:"Cold Air Intake",  price:180, hp:8,  et:-0.08 },
    exhaust: { id:"exhaust", name:"Cat-Back Exhaust", price:320, hp:12, et:-0.12 },
    chip:    { id:"chip",    name:"ECU Chip S1",      price:250, hp:15, et:-0.15 },
    pulleys: { id:"pulleys", name:"Lightweight Pulleys", price:140, hp:5, et:-0.05 }
  };
  var PART_ORDER = ["intake","exhaust","chip","pulleys"];

  // M1 playable roster = carId 1–8 (finished pixel art). 9–30 catalog later.
  var M1_CARS = [1,2,3,4,5,6,7,8];
  var SPRITE_URL = {
    1: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABICAYAAAA+hf0SAAAGLklEQVR4nO3aW0wUVxgH8P+ZWRYFEYkBHqq2ksbWNiRqn5qYtDUtoIAXbrtycUHABSy6IBSQUKReWpV6WVNbhFbxxkUhclGUqE9NmtimLybGNBpjUlOauth4Y3dh5uvDwioCVbHuDvX7PcBmzu7Md875zsyZMwMwxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY2yiEt4O4EUVl28hh7Mf1p1VAgBWJKbQ67NmQIKASioAAQGAQCAiCCGwZ9cO0X3+Ip3v7saOHV9N+DZ4ETpvBzAeuetKydbbi+ajB4SvsCM0JAh5OTnUe6cXjU3HntqhxcVFFPHxIlFYsIEWr0imFUtjsCYj+ZVOBM3L/rSMElLMBAAVFZX0ZLnFYhmx7d9ERUURAJSUlBAA5BaWU3xyxnPtg3lArqWcFi9PcXfM2rV5o3ZSfn7+uDtvw4YiAoD4lZmvXAJI3g5gNAZTjrsjvt2zVaQbo91lA4o66m9sNtu4j3ft+jVs2foltTR8LwAga23JK5cIHmMymchoNI7ZwLEJphFlRw4fHrbNYhk52tPS0l640+pqa937SEg1vxJJoImJT7q5kA7V7BIAsGRFCoEEIAiBgYEQAGRZhqoqUFQVDrsDsqwDDShoaf5BFBYWU1DQNFy5chn+/lNQV1c37jpVVVXRFH9/XPr5Eibp9XjwsA8nW1o00UYvi1crtyxpNSmKAr1ehk7WQ6/XIyxsNuwOO65fuw4fWYJCrlO+oiiQJRkqqRBCQvD06Zg6NRC+vnoMqCq2bfpMLDOYKHCSDrJOB1V9VDsiglAJBIKqqoAkgVTXbWG/0wEIQBIymhoPj9oekcuS6Vzb8WFlixYn0sWuEyJi6UoCEbo7Gidkong86KKyrUSkwtHvhM1mQ8Oh/SNiiIg1UHdH0zPFFhFrcHVAZ7OIiTNRf78TgIpzHU0iMtZIkuya5gghIIRwfyYafoYfKgMAPz8/3Lt3F12nGoQpe73rm/RoLQGA+7+Pjw+EEJAlCSAChITQkBA8uH9/8Mylos9ux3f7tLne4PGgVmVbqOfPHnS3e37ERC410lDHPd7hrg2Df4ggBHC2zRXf4uXJpKqPJp5PJs7TEjU6Lo0mT5qEoGmB8NH5YNasmbA77Lhx4ybq6/Z6PSk8GoBhRgA1/X5PAEDswvep48efnnr8rJwNFBY2G+Hhb0GCwG/XbuLq1auo+Wan1xtvLOuKK2le+FyoioJLv17GAY2Ofq/aHxr01Fl2QekXY37HkGom46rR1wROnWr3ygw+t6B8zOOuyR/91vLY8aPu7avNz7eYxQBExhgmZKO1b0mkxIVzKMm4ckT8RWVjJz7ToDjDsy8hf7IkiQAgaqbvsN8kppopIcVMSxPTPdr5Hr02tbacpDt3egEISJIERVEAAaiqip4/evB55aZR44mNWULvvBuO23/dxpw5b6KktEzT19Tdu7+mW7duoa/PgfcWLMDqzEzNxqvZwIaUbyylrdtck6jTpzspOjpG0zHX1tVSdla2AIDNm6uooqJS7LPupfx160fEXWApoJDQYDidTgSHBOP+3Xu4bbNBp5Mxb94CJCUlabqu4xITEz2uU1xJSQmZzWY6095GAFBdvcPj18mIyGeL3WBIpOysLMrLy6Hq6moCALN57KXl5NmTyTLXj9a9HUA5cwM8Wi+Pvw/Q2Xl6XFm9fft2YbXupbr6IwAAh8M54jsx8WkkyxLamutFdFyqa/2GCPLgwo86+ELI4wE8uq0nEAGSLEEAUAYGIEky/AKmwGG3AwTIsoSElZmkEoGUAfTZ7Tjb0ezeXVxCPLWebBFNTSdcD5UyM6ioqEgAwPz588esW58CvBEIPBxwYOMvzv/fqP8vpKYmDxsZVqtVczPluLg4d0xD7xsMOXjwoObiBTT6OPhxJpPr6eCHH3wEAEhPd82S/74z/se/L0tra6t79M6Y8dqwsoyMjFFHdl5BOWXlFWsyOTTj4oUL7gbKysykrq4uzTbYmqxsqqmpccdntVqpoaFBs/FOmOtNfX09AUDXmTNobHq2B0XedPzYUSIIpKSkaD5WxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxthE8w+ANW011Fr+NgAAAABJRU5ErkJggg==",
    2: "data:image/png;base64,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",
    3: "data:image/png;base64,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",
    4: "data:image/png;base64,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",
    5: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABICAYAAAA+hf0SAAAGxklEQVR4nO3Ze3BUVx3A8e85u+nmRRpigU4kNrUjfyioWKZ/dDpMFUqTFEIyAtJJUBnk3akKBFpaoc8/nCnlMcMoI6WCooOhCUKJDo60Mz5Ay0N5ZXjGVKBJ89xNTLKbvffnH3cTWNNBLJjs0t9nMrNz75yc+9tzfud3z90LSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZKYGeoAPq6DB38nrusw/ivjCYVCADiOgyCIC9HeCH/+02GmFEzGdVwwBsdxsNaCK7iuiyveZ3Z2FocOHaakZGbSjscnwtKli0VE5I2tW6SgsFBu1Pan27dKqKPlhm2u98La5+XE34/ddPs7RdJkvIgjv6nZT9ETxXExT58+XYwxSGw179u3zwBs2LhO7h01ktmz55jCwkIxxtDXzuvP+zTGUFNT099nsL1Z7s6+J2nG5Y5VVv6k/PEP70hLc2PcqiwqKpKCohuv/rpL56S6ulIWLVrwsVb0449PkrLysk9cNUgIs2bNlGeeqZDzF87ImjU/+J8nYXpJsZw7d1rq6y/c0gTO+sZMuXTpvCbBYDly5JBcvVwnX59RekuDvmTJYjl96rg0NFy+LZP34otr5Bc7t2si/L/s2P6GdP2rTfZUV96WQW5taZAdO96Ubdu23bZJ27BhvaxcWXFHJsGgb3ZKS0tly4820dTczNFjx8nNzSUQuIvReXncn/+5W47n/fqL8vOdv2T16udv+3errT0htWdqCUd6GTVqFE7U4bEpBUm9YRz04I8d+6uk+P0cOvwXpj5RSHd3D8aAtZbhw7NJS0vHmGuhGe8AEUH61+DAxejt6oW/nTjJxYt1PPBAPuFwBIPBGovruhhrAIMB79gY8P6Q2LXq6+sJBkOEQh2sWvVs3PhEwp1y9OhxcnKyY2cMI0eOIDU1lXA4QuXuatLS0igvn5M0STFkgR45ckiMtfQ9njmO0z/x1tr+diLSnwS4gpj4R7i+Nn3H585dYOwXPs/YsV/u/24rViyXsvLZ8X31/Z8x8YNw3TVEhI6ODtLT0zHG4PP52FO9jydnzyTcG/H6cF3vE/AZi4gQ7o1gjSEzM5OM9HSGDRvGtjd3gBhWVFQkVHL4B/uCV+ffLbk/CRprLcZYMBAIpPLWW1XY2ACWlBbT29sLeOvVjQ0yAK5gzXUJAv3P9yIuoWCQSCTCzp0/k/z8z2CMISdnON09PQNiuT4Zrp30zhvX6zs7K4v+q4sBY3HxEsnv9xOJROJ+W3BdlxS/H4yhp6eHcLiXtmA7kyc9imD4sPGyRKMOLS2tjPvi+CFPhkFPgM3V9wJBQsFOMAZXXN59Zy9f/dpErLX4fD5On6olEAiQk/MpXnvtdfbu/XXcQBUUFEpFxTIEh1jlx1ofrjj4/D7ag0HGjBlDZ2cH1loaP2xCXBAcAP7zR6E+fX1hrp03WCR2yzEYwpEe3nvvCGdqz5KensmjEx8hGo3S2trKrl2VVFVVxcVaWloizz23mhS/l9xXr37gXdda9u6tlra2Vj49Oo/Jk6YMSTIMegK82nzWANT/832s9Up/ezDEP+rqYwmQQkPDB1y5coX16zeaoqKpA2/4xs+kSY+Z/fvflvZQu/cOwBGi0ag3wH33eXExxCYbubZ18Co/JnarEQGvRd+txCKuEL9B8BKgs7OLQCCVL40bB8bQ0NjA6dO1vPLyK2ZaccmAWLu7IkyY8JCp3rNb+iqXt/WwFBeXmpPfHyXNB2Dd6xtk+bLvDXlFUINsVh4yPdcO2SPmoGacSETC3V24xnhv5MRFXPGCMN7mKxoVTp6qZeIjE286tlCoVTo6OnAchy0/3sqixfPxp3gl12d93uaP2MqOvS3EgIjbXx0s9toGM7ZZFFcwlv7KEY06jM77rGlra5JQR5Bf7aqiomLlTcV58N3fixuN8vDDD4EYb8NrwGJjsQjGWgKBYVoFPkphwTSZOm1giU1UhUXFSRNrQpsxY5YALFy4WABWP7smaQa2rOybCR9rUpSbb8/9jjQ1NZF/Xz6bN29M6JiXLV8ldXV15OXlcfH8WdIyMthduSthY7b/vcnQCwVD3J9/X0JP/rx58wWgsbERJxph08Z1Zn/N26a7q2uoQ7tzLFiwRADK53wr4UrrlCkFcTE99dTTAvD0d5cnXKzXS4oKsHDRUgEIpN4FQGZGxpDG81EOHPitmTt3nrz86g8FICsrC4BNG9clbNWCJNkDTJtWLA8+OAHXdXnppRcSOuaFCxfLiBH3kJKSwtq1axI6VqWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUknp342oBpI/a3iAAAAAAElFTkSuQmCC",
    6: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABICAYAAAA+hf0SAAAERElEQVR4nO3a609bZRwH8O9pKYUVxJglXbxsGF8r+k9AaVmZA8ZlAh1MhEZZzSrgxuCNEtkYIQspmjWgU+eyQHDc4ZUa9T1Z4mSauGRhRpFhtFzatOfni2rDRbINStvTfT9vmpy0z/n+fs9zTp9eACIiIiIiIiIiIiIiIiIiIiIiIiIiItI2Jd4BHpXb7ZaVlVX4fMtYXFzE+Pio5mqgHaqvb5B4Z0g2mrl6qqoccuXKx9vmLXz1iChQEFJVjN64seF5tbU1IqJCJLx+wo8CQIkcA3RQ1RB8vmUMDw9veH3npV5pbnxTM716FElRVGFhodzYNOnrVVRUCBCe+PCEq1AUHcILQAUgEFGgKAJVBVRVxeDg4IbxPujpkRaXKyn6tZ4mCrLZ7DI+PrKrrFarVRRl/RUfJiJQFAUCCd8U/qVCMD05teGcReWVMvTFp5roGe2RxqZ35dQ7bu5FHhfnO89Le3v7lgnv+ehyUiyChLmdHTtWIgcPPg+9XgcFgmAohLnbP2F0ZPv3dgDIzc2VmZmZuNRRffJ1+cR7OWF6uBN7Gr7+DacEQwEsLf2FoaHrMW9UXl6+TE9P7sl5bQWHxZhqhMlkQigUihy/evWzB57PYrGKTqfDxMRY3BdP3AMkG0uuVVKNRuzf/xR0ej10OgWZmU8gEFjFss+P/oH/v2PYbIdFATAW4y+2uAASwGvHHZKZZUKGKQMXLnRyTijM4aiRxrfe3tPNZlRXW/OL2fLCgg9/K3qc/vW3HY9dWVktZrMZ9+bn4Q8EIABUFfD7/Zic2N33AbFmKyiUNGMqzGZz5Nji4h9Y9q1hbPzLh66lztkoTx84AJ0iaDt3Nmo9SInWQADQefPOroJZLFZJS98HVQRra2swpqVBn5ICg8GAldU1BPyBaEWNiaLiMjEY9EhPN0FVg1BVFcFgEFlZTyIU/BMWS75MTT3cJrVk4RJSs0vgvblvr2PHj91+JCk+W//HZiuIWj2nK/Ll86OGxO2PxWJN3HBEyaYu2X8a7754MVJgg8aLdblcG/J7PB5N17OF290U9YJsNtuWMfu9Xs01rqurK5K5tLRUAMBiyZPe3l7N1RITH3r6tjSmo6NDAKDGUavZptXV1QkAtLS0RKWGysoqzfbigcrKyrYUt/k2qgUVx8N/RGlrPScAcObMWQGA1tZWAYC+vq2L/bFnt9u3bUpxcbGmGlZeXr5t3tzcPLl27bqm6omJ2dlZcTaEN30u1ylxOp0CAAMDA/L9t99prmEnHCek4733pehoUSS7o6pauru7E6IWXbwDbJaTk6OUlpYAAEymDHg8HgUAFn5fwOj4SFyz7URbWxvuL93HoexDAICWpmZ55rln8crLL8U5WYLr93pl7tYPcvfOL/LN118lxNWyG3O3fpSfb8/Jvfm7crJGu5tZIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiShD/ACxSnAewwQbNAAAAAElFTkSuQmCC",
    7: "data:image/png;base64,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",
    8: "data:image/png;base64,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"
  };
  var SPRITE_IMG = {};
  var spritesReady = 0;
  function loadSprites(){
    M1_CARS.forEach(function(id){
      var im = new Image();
      im.onload = function(){ spritesReady++; };
      im.onerror = function(){ spritesReady++; };
      im.src = SPRITE_URL[id];
      SPRITE_IMG[id] = im;
    });
  }
  function drawCarSprite(carId, x, y, scale){
    // Classifieds / list thumbs — full padded canvas scale (unchanged).
    scale = scale || 1;
    var im = SPRITE_IMG[carId];
    if (im && im.complete && im.naturalWidth) {
      var w = im.naturalWidth * scale, h = im.naturalHeight * scale;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(im, x - w/2, y - h/2, w, h);
      return true;
    }
    return false;
  }

  // M1.7 bay hub: fit opaque content (not 128×72 pad) to real-world length, floor-anchored.
  // metres (approx): Datsun/AE86 short, GNX long — one px/m across roster → ~140–180px typical.
  var BAY_CAR_LEN_M = {1:4.19,2:4.06,3:4.55,4:4.90,5:4.19,6:5.09,7:3.82,8:4.55};
  var BAY_PX_PER_M = 35; // GNX≈178px, AE86≈147px, Golf≈134px
  var BAY_FLOOR_Y = 198; // shared tyre/bottom line for all 8
  var BAY_CX = 240;
  var SPRITE_BOUNDS = {}; // carId → {x,y,w,h} opaque bbox in source px
  function spriteContentBounds(carId){
    if (SPRITE_BOUNDS[carId]) return SPRITE_BOUNDS[carId];
    var im = SPRITE_IMG[carId];
    if (!im || !im.complete || !im.naturalWidth) return null;
    var w = im.naturalWidth, h = im.naturalHeight;
    var off = document.createElement("canvas");
    off.width = w; off.height = h;
    var octx = off.getContext("2d");
    octx.imageSmoothingEnabled = false;
    octx.drawImage(im, 0, 0);
    var data;
    try { data = octx.getImageData(0, 0, w, h).data; }
    catch (e) { return null; }
    var minx = w, miny = h, maxx = -1, maxy = -1;
    for (var y = 0; y < h; y++){
      for (var x = 0; x < w; x++){
        if (data[(y * w + x) * 4 + 3] > 8) {
          if (x < minx) minx = x;
          if (y < miny) miny = y;
          if (x > maxx) maxx = x;
          if (y > maxy) maxy = y;
        }
      }
    }
    if (maxx < 0) { SPRITE_BOUNDS[carId] = { x:0, y:0, w:w, h:h }; return SPRITE_BOUNDS[carId]; }
    SPRITE_BOUNDS[carId] = { x:minx, y:miny, w:maxx - minx + 1, h:maxy - miny + 1 };
    return SPRITE_BOUNDS[carId];
  }
  function drawBayCarSprite(carId, cx, floorY){
    cx = (cx == null) ? BAY_CX : cx;
    floorY = (floorY == null) ? BAY_FLOOR_Y : floorY;
    var im = SPRITE_IMG[carId];
    if (!im || !im.complete || !im.naturalWidth) return false;
    var b = spriteContentBounds(carId);
    if (!b || !b.w || !b.h) return false;
    var lenM = BAY_CAR_LEN_M[carId] || 4.4;
    var targetW = Math.round(lenM * BAY_PX_PER_M);
    // Clamp so tiny/huge content still lands in Chaos ~140–180 band for mid cars
    targetW = Math.max(120, Math.min(190, targetW));
    var sc = targetW / b.w;
    var dw = Math.max(1, Math.round(b.w * sc));
    var dh = Math.max(1, Math.round(b.h * sc));
    // Preserve aspect: recompute dh from exact sc (already did); NN draw of content crop
    var dx = Math.round(cx - dw / 2);
    var dy = Math.round(floorY - dh); // bottom of opaque content on shared floor
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, b.x, b.y, b.w, b.h, dx, dy, dw, dh);
    return true;
  }

  // M1.5 race front/rear — relative to index.html (file:// OK). car_06 front = 1x3kJ4kHBLJrW3j-CClCrIZxiAjcRwd7d
  var RACE_SPRITE = { front: {}, rear: {} };
  var raceSpritesReady = 0;
  function raceSpritePath(id, view){
    var n = id < 10 ? ("0" + id) : ("" + id);
    return "sprites/car_" + n + "_" + view + ".png";
  }
  function loadRaceSprites(){
    M1_CARS.forEach(function(id){
      ["front","rear"].forEach(function(view){
        var im = new Image();
        im.onload = function(){ raceSpritesReady++; };
        im.onerror = function(){ raceSpritesReady++; };
        im.src = raceSpritePath(id, view);
        RACE_SPRITE[view][id] = im;
      });
    });
  }
  // Fit inside maxW×maxH, aspect preserved, floor pixel sizes, NN, optional H-flip (mirrors).
  function drawRaceCarSprite(carId, view, x, y, maxW, maxH, flipH){
    var bucket = RACE_SPRITE[view];
    var im = bucket && bucket[carId];
    if (!im || !im.complete || !im.naturalWidth) return false;
    var nw = im.naturalWidth, nh = im.naturalHeight;
    var s = Math.min(maxW / nw, maxH / nh);
    var dw = Math.max(1, Math.floor(nw * s));
    var dh = Math.max(1, Math.floor(nh * s));
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x, y);
    if (flipH) ctx.scale(-1, 1);
    ctx.drawImage(im, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    return true;
  }

  // M1.6 Pixel Forge polish — relative sprites/ (file:// OK). 480×270 NN.
  var POLISH = { bay: null, cockpit: null };
  function loadPolish(){
    function one(key, file){
      var im = new Image();
      im.src = "sprites/" + file;
      POLISH[key] = im;
    }
    one("bay", "bay_hub_polish.png");
    one("cockpit", "cockpit_dock_polish.png");
  }
  function drawPolishBg(im){
    if (!im || !im.complete || !im.naturalWidth) return false;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, 0, 0, W, H);
    return true;
  }
  function polishReady(im){
    return !!(im && im.complete && im.naturalWidth);
  }

  var ADS = [
    { id:"oil",  title:"OIL DRIP",  sub:"SYNTHETIC", color:"#c08020" },
    { id:"tire", title:"TIRE KING", sub:"STICKY",    color:"#4080c0" },
    { id:"radio",title:"NIGHT FM", sub:"98.8",      color:"#a040a0" }
  ];

  // ---------- Utilities ----------
  function uid() {
    return "i_" + Date.now().toString(36) + "_" + Math.floor(Math.random()*1e6).toString(36);
  }
  function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
  function lerp(a,b,t){ return a+(b-a)*t; }
  function rosterOf(carId){ return ROSTER[carId] || ROSTER[3]; }
  function carListPrice(carId){
    // Cheap → spicy within M1 eight
    var base = {1:720,2:680,3:650,4:700,5:780,6:920,7:660,8:850};
    return base[carId] || 750;
  }
  function labelCar(carId){
    var r = rosterOf(carId);
    return r.year + " " + r.name;
  }
  function repLabel(rep){
    if (rep >= 40) return "Pro";
    if (rep >= 20) return "Amateur";
    if (rep >= 8) return "Contender";
    return "Rookie";
  }

  // ---------- Audio (minimal Web Audio) ----------
  var audioCtx = null;
  function ensureAudio(){
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }
  function beep(freq, dur, type, vol){
    ensureAudio();
    if (!audioCtx) return;
    var o = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    o.type = type || "square";
    o.frequency.value = freq;
    g.gain.value = vol || 0.05;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (dur||0.08));
    o.stop(audioCtx.currentTime + (dur||0.08) + 0.02);
  }
  function sfxClick(){ beep(660, 0.04, "square", 0.04); }
  function sfxShift(){ beep(220, 0.06, "sawtooth", 0.05); beep(330, 0.05, "square", 0.04); }
  function sfxWin(){ beep(440,0.08); setTimeout(function(){beep(554,0.08);},80); setTimeout(function(){beep(659,0.12);},160); }
  function sfxLose(){ beep(180,0.2,"triangle",0.06); }

  // ---------- Save / State ----------
  function newOwned(carId){
    return {
      instanceId: uid(),
      carId: carId,
      fitted: { intake:false, exhaust:false, chip:false, pulleys:false },
      inventory: { intake:0, exhaust:0, chip:0, pulleys:0 }
    };
  }
  function defaultState(){
    // Q3: cash only — buy first car from Classifieds (no gifted beater)
    return {
      cash: 780,
      rep: 0,
      wins: 0,
      losses: 0,
      activeInstanceId: null,
      garage: [],
      inbox: [
        { id:"barn1", kind:"tip", from:"BarnScout_88", subj:"Tip — old lot off Route 9",
          body:["Heard a barn out past the quarry has a","sleeping classic. Not unlocked in M1 —","just a tip for later. Keep wrenching."],
          read:false, done:true }
      ],
      jobSeed: 1,
      jobsDone: {},
      jobsCompleted: 0,
      jobCooldownUntil: 0,
      classifiedSold: {}
    };
  }
  var state = defaultState();
  loadBindsStorage();
  if (state.keybinds) loadBindsFrom(state.keybinds);
  else state.keybinds = cloneBinds(keybinds);
  function saveGame(){
    try {
      state.keybinds = cloneBinds(keybinds);
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      persistBinds();
      toast("Saved."); sfxClick();
    }
    catch(e){ toast("Save failed."); }
  }
  function loadGame(){
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { toast("No save found."); return false; }
      var s = JSON.parse(raw);
      if (!s || !Array.isArray(s.garage)) { toast("Corrupt save."); return false; }
      if (!s.inbox) {
        s.inbox = [
          { id:"barn1", kind:"tip", from:"BarnScout_88", subj:"Tip — old lot off Route 9",
            body:["Heard a barn out past the quarry has a","sleeping classic. Not unlocked in M1 —","just a tip for later. Keep wrenching."],
            read:!!s.inboxRead, done:true }
        ];
      }
      if (s.activeInstanceId == null && s.garage.length) s.activeInstanceId = s.garage[0].instanceId;
      if (s.jobSeed == null) s.jobSeed = 1;
      if (!s.jobsDone) s.jobsDone = {};
      if (s.jobsCompleted == null) s.jobsCompleted = 0;
      if (s.jobCooldownUntil == null) s.jobCooldownUntil = 0;
      state = s;
      if (s.keybinds) loadBindsFrom(s.keybinds);
      else loadBindsStorage();
      state.keybinds = cloneBinds(keybinds);
      persistBinds();
      toast("Loaded."); sfxClick();
      return true;
    } catch(e){ toast("Load failed."); return false; }
  }
  function activeCar(){
    if (!state.garage || !state.garage.length) return null;
    for (var i=0;i<state.garage.length;i++){
      if (state.garage[i].instanceId === state.activeInstanceId) return state.garage[i];
    }
    return state.garage[0] || null;
  }
  function requireCar(){
    var me = activeCar();
    if (!me) { toast("Buy a car in Classifieds first."); return null; }
    return me;
  }
  function spawnSideJob(forceEmergency){
    // Boring Inbox gigs — small cash, not the main loop.
    var jobs = [
      { kind:"job", title:"Tire swap — customer waiting", pay:45, flavor:["Jack stands. Lug nuts. No glory.","You change four tires. Hands smell like rubber."] },
      { kind:"job", title:"Drop-in idle tune", pay:60, flavor:["Some beater rolled in coughing.","You tweak the idle screw. It coughs less."] },
      { kind:"job", title:"Oil drip cleanup", pay:35, flavor:["Bay floor looks like a crime scene.","Mop. Absorbent. Repeat."] },
      { kind:"job", title:"Align headlights (sort of)", pay:40, flavor:["Owner says they point at the trees.","You twist until they pretend to aim."] }
    ];
    if (!state.jobsDone) state.jobsDone = {};
    if (state.jobsCompleted == null) state.jobsCompleted = 0;
    if (state.jobCooldownUntil == null) state.jobCooldownUntil = 0;
    var now = Date.now();
    // Cooldown between offers (persisted). Emergency soft-lock bypasses cooldown.
    if (!forceEmergency && now < state.jobCooldownUntil) return;
    // Cap lifetime completed jobs in M1 stub (anti-farm); emergency still allowed once if softlocked
    if (!forceEmergency && state.jobsCompleted >= 3) return;
    state.jobSeed = (state.jobSeed|0) + 1;
    var j = jobs[state.jobSeed % jobs.length];
    var id = "job_"+state.jobSeed;
    // Don't stack open jobs / don't reissue same id
    for (var i=0;i<state.inbox.length;i++){
      if (state.inbox[i].id === id) return;
      if (state.inbox[i].kind==="job" && !state.inbox[i].done) return; // max 1 open job
    }
    if (state.jobsDone[id]) return;
    state.inbox.unshift({
      id:id, kind:"job", from:"OddJobs_Local", subj:j.title, pay:j.pay,
      body:j.flavor.concat(["Pay $"+j.pay+" if you bother. Not a career."]),
      read:false, done:false, emergency:!!forceEmergency
    });
    // Next offer no sooner than 3 minutes real-time (or after race progression later)
    state.jobCooldownUntil = now + 3*60*1000;
  }
  function maybeOfferJobs(){
    if (!state.inbox) return;
    if (!state.jobsDone) state.jobsDone = {};
    if (state.jobsCompleted == null) state.jobsCompleted = 0;
    var openJobs = 0;
    for (var i=0;i<state.inbox.length;i++) if (state.inbox[i].kind==="job" && !state.inbox[i].done) openJobs++;
    if (openJobs >= 1) return;
    var cheapest = 650;
    for (var i=0;i<M1_CARS.length;i++) cheapest = Math.min(cheapest, carListPrice(M1_CARS[i]));
    var softlock = !state.garage.length && state.cash < cheapest;
    // Emergency: guarantee recovery path when broke with no car
    if (softlock) { spawnSideJob(true); return; }
    // Normal: rare — only if under cooldown cleared and under lifetime cap
    var broke = state.cash < 150;
    if (broke && Math.random() < 0.35) spawnSideJob(false);
  }
  function carPower(owned){
    var r = rosterOf(owned.carId);
    var hp = r.hp;
    var etBonus = 0;
    for (var i=0;i<PART_ORDER.length;i++){
      var p = PART_ORDER[i];
      if (owned.fitted[p]) { hp += PARTS[p].hp; etBonus += PARTS[p].et; }
    }
    // rough ET estimate from power/weight
    var baseEt = 14.8 - (hp / r.weight) * 8.5;
    return { hp: hp, et: Math.max(9.5, baseEt + etBonus), weight: r.weight };
  }

  // ---------- Scene machine ----------
  var scene = "bay"; // bay | computer | tune | race | result
  var computerTab = "classifieds";
  var toastMsg = "";
  var toastT = 0;
  function toast(m){ toastMsg = m; toastT = 2.2; }

  // Computer scroll / selection
  var uiSel = 0;
  var adIndex = 0;
  var adTimer = 0;

  // Race state
  var race = null;
  // mode: "loaner" | "fun" | "drag"
  function makeLoanerOwned(){
    // Temporary practice car — never pushed to state.garage / career ownership.
    var o = newOwned(LOANER_CAR_ID);
    o.instanceId = "loaner_tmp";
    o.loaner = true;
    return o;
  }
  function startRace(opts){
    opts = opts || {};
    var mode = opts.mode || "drag";
    var me = null;
    var isLoaner = false;
    if (mode === "loaner") {
      me = makeLoanerOwned();
      isLoaner = true;
    } else {
      me = activeCar();
      if (!me) {
        if (mode === "fun") toast("Buy a car for Fun run — or Free Run (loaner).");
        else toast("Buy a car in Classifieds first.");
        return false;
      }
    }
    if (mode === "drag") {
      if (state.cash < ENTRY_FEE) { toast("Need $"+ENTRY_FEE+" entry."); return false; }
      state.cash -= ENTRY_FEE;
    }
    var pwr = carPower(me);
    // AI: random M1 car (prefer not player's)
    var aiPool = M1_CARS.filter(function(id){ return !me || id !== me.carId; });
    if (!aiPool.length) aiPool = M1_CARS.slice();
    var aiCarId = aiPool[(Math.random()*aiPool.length)|0];
    var aiHp = rosterOf(aiCarId).hp + 10;
    var aiW = rosterOf(aiCarId).weight;
    var aiEt = Math.max(9.8, 14.8 - (aiHp/aiW)*8.5 - 0.05);
    race = {
      phase: "staging", // staging | go | run | done
      t: 0,
      countdown: 3.2,
      mode: mode, // loaner | fun | drag
      free: mode !== "drag",
      loaner: isLoaner,
      paidOut: false,
      payoutNote: "",
      player: {
        owned: me, pwr: pwr, color: rosterOf(me.carId).color,
        dist: 0, speed: 0, rpm: 800, gear: 1, range: "N", // D N R
        lane: 0, // -1..1 soft sway
        throttle: 0, brake: 0,
        finished: false, finishT: 0
      },
      ai: {
        carId: aiCarId, color: rosterOf(aiCarId).color,
        hp: aiHp, et: aiEt, weight: aiW,
        dist: 0, speed: 0, gear: 1,
        lane: 0.15, // slightly right of center in opposing feel — same lane strip
        finished: false, finishT: 0,
        aggression: 0.92 + Math.random()*0.1
      },
      result: null, // "win"|"loss"
      camShake: 0
    };
    scene = "race";
    if (mode === "loaner") toast("Loaner practice — free. Career save untouched.");
    else if (mode === "fun") toast("Fun run — free. Win: +1 Rep"+ (state.cash < ENTRY_FEE ? " +$"+FUN_SOFT_CASH+" (soft)" : "") +".");
    else toast("Staged. "+bindLabel("rangeD")+"→D, "+bindLabel("gas")+" gas when green.");
    return true;
  }
  function applyRacePayout(){
    if (!race || race.paidOut) return;
    race.paidOut = true;
    var win = race.result === "win";
    var mode = race.mode || "drag";
    race.payoutNote = "";
    if (mode === "loaner") {
      // Pure practice — zero career mutation.
      race.payoutNote = "Practice — $0 · Rep 0 · W/L untouched";
      if (win) sfxWin(); else sfxLose();
      return;
    }
    if (mode === "fun") {
      if (win) {
        state.rep += 1;
        var cashGain = 0;
        if (state.cash < ENTRY_FEE) {
          cashGain = FUN_SOFT_CASH;
          state.cash += cashGain;
        }
        race.payoutNote = cashGain ? ("+$"+cashGain+" soft · Rep +1") : "Rep +1";
        sfxWin();
      } else {
        race.payoutNote = "No payout on loss";
        sfxLose();
      }
      return;
    }
    // Paid Night Drag
    if (win) {
      state.cash += WIN_PAY; state.wins++; state.rep += 2;
      race.payoutNote = "+$"+WIN_PAY+"   Rep +2";
      sfxWin();
    } else {
      state.losses++; state.rep = Math.max(0, state.rep-1);
      race.payoutNote = "Rep -1 (min 0)";
      sfxLose();
    }
  }

  // ---------- Input ----------
  var keys = {};
  var touch = {
    wheelX: 0, // -1..1
    gas: false, brake: false,
    shiftUp: false, shiftDown: false,
    rangeTap: null // 'D'|'N'|'R'
  };
  var pointerDown = {};
  window.addEventListener("keydown", function(e){
    keys[e.code] = true;
    ensureAudio();
    // Controls remap capture (Computer → Controls)
    if (bindListen) {
      e.preventDefault();
      if (e.code === "Escape") { bindListen = null; toast("Remap cancelled."); return; }
      var act = bindListen;
      bindListen = null;
      applyRemap(act, e.code);
      return;
    }
    if (e.code === "Escape") { onEsc(); e.preventDefault(); return; }
    if (scene === "race" && race) {
      if (codeMatches("shiftDown", e.code)) { shift(-1); e.preventDefault(); }
      if (codeMatches("shiftUp", e.code)) { shift(1); e.preventDefault(); }
      if (codeMatches("cycleRange", e.code)) { cycleRange(); e.preventDefault(); }
      if (codeMatches("rangeD", e.code)) { setRange("D"); e.preventDefault(); }
      if (codeMatches("rangeN", e.code)) { setRange("N"); e.preventDefault(); }
      if (codeMatches("rangeR", e.code)) { setRange("R"); e.preventDefault(); }
    }
    if (scene === "computer" || scene === "bay" || scene === "tune") {
      if (codeMatches("menuUp", e.code)) { uiSel--; sfxClick(); e.preventDefault(); }
      if (codeMatches("menuDown", e.code)) { uiSel++; sfxClick(); e.preventDefault(); }
      if (codeMatches("menuConfirm", e.code)) { activateSel(); e.preventDefault(); }
    }
  });
  window.addEventListener("keyup", function(e){ keys[e.code] = false; });

  function onEsc(){
    if (scene === "race" && race && race.phase !== "done") {
      // forfeit — still latched via applyRacePayout (loaner/fun stay career-safe)
      race.phase = "done"; race.result = "loss";
      applyRacePayout();
      scene = "result";
      toast("Race aborted.");
      return;
    }
    if (scene === "result") { scene = "bay"; race = null; return; }
    if (scene === "computer" || scene === "tune") { scene = "bay"; return; }
  }
  function setRange(r){
    if (!race) return;
    var p = race.player;
    // Chaos QA: no reverse during drag (staging or run)
    if (r === "R") { toast("No reverse on the strip."); return; }
    if (p.speed > 2 && r !== "D") { toast("Stop before shifting range."); return; }
    p.range = r;
    if (r === "N") p.gear = 0;
    if (r === "D" && p.gear < 1) p.gear = 1;
    sfxShift();
  }
  function cycleRange(){
    if (!race) return;
    var order = ["D","N"]; // R blocked on strip
    var i = order.indexOf(race.player.range);
    if (i < 0) i = 0;
    setRange(order[(i+1)%order.length]);
  }
  function shift(dir){
    if (!race || race.player.range !== "D") return;
    var p = race.player;
    var ng = clamp(p.gear + dir, 1, 5);
    if (ng !== p.gear) { p.gear = ng; sfxShift(); }
  }

  // Touch dock hit testing in canvas space
  function pointerToGame(ev){
    var rect = canvas.getBoundingClientRect();
    var x = (ev.clientX - rect.left) * (W / rect.width);
    var y = (ev.clientY - rect.top) * (H / rect.height);
    return { x:x, y:y };
  }
  function hitDock(p){
    // Must match drawTouchDock exactly:
    // WHEEL 8,222 100x44 · D/N/R 160+i*55,230 50x28 · SH+/SH- y200-220 · GAS/BRK y222-266
    if (p.y < 200) return null;
    if (p.x >= 8 && p.x <= 108 && p.y >= 222) return "wheel";
    if (p.x >= 360) {
      if (p.y >= 200 && p.y < 222) {
        if (p.x < 410) return "shiftUp";
        if (p.x >= 416) return "shiftDown";
        return null;
      }
      if (p.y >= 222 && p.y <= 266) {
        if (p.x >= 360 && p.x < 410) return "gas";
        if (p.x >= 416 && p.x <= 466) return "brake";
        return null;
      }
      return null;
    }
    if (p.y >= 230 && p.y <= 258) {
      if (p.x >= 160 && p.x < 210) return "rangeD";
      if (p.x >= 215 && p.x < 265) return "rangeN";
      if (p.x >= 270 && p.x <= 320) return "rangeR";
    }
    return null;
  }
  function onPointer(ev, down){
    ensureAudio();
    var id = ev.pointerId || 0;
    var g = pointerToGame(ev);
    if (down) {
      pointerDown[id] = g;
      if (scene === "bay") { bayClick(g.x, g.y); return; }
      if (scene === "computer") { computerClick(g.x, g.y); return; }
      if (scene === "tune") { tuneClick(g.x, g.y); return; }
      if (scene === "result") { scene = "bay"; race = null; sfxClick(); return; }
      if (scene === "race") {
        var z = hitDock(g);
        if (z === "wheel") { touch.wheelX = clamp((g.x - 54)/46, -1, 1); }
        if (z === "gas") touch.gas = true;
        if (z === "brake") touch.brake = true;
        if (z === "shiftUp") { shift(1); }
        if (z === "shiftDown") { shift(-1); }
        if (z === "rangeD") setRange("D");
        if (z === "rangeN") setRange("N");
        if (z === "rangeR") setRange("R");
      }
    } else {
      delete pointerDown[id];
      // release holds
      var anyGas=false, anyBrake=false, anyWheel=false;
      for (var k in pointerDown){
        var z2 = hitDock(pointerDown[k]);
        if (z2==="gas") anyGas=true;
        if (z2==="brake") anyBrake=true;
        if (z2==="wheel") anyWheel=true;
      }
      refreshTouchHolds();
    }
  }
  function clearHeldInputs(){
    keys = {};
    touch.gas = false;
    touch.brake = false;
    touch.wheelX = 0;
    touch.shiftUp = false;
    touch.shiftDown = false;
    touch.rangeTap = null;
    pointerDown = {};
  }
  window.addEventListener("blur", clearHeldInputs);
  document.addEventListener("visibilitychange", function(){
    if (document.hidden) clearHeldInputs();
  });
  window.addEventListener("pointerdown", function(e){ onPointer(e,true); });
  window.addEventListener("pointerup", function(e){ onPointer(e,false); });
  window.addEventListener("pointercancel", function(e){ clearHeldInputs(); });
  function refreshTouchHolds(){
    // Chaos: sliding off GAS/BRK must release; recompute from live pointer positions
    var anyGas=false, anyBrake=false, anyWheel=false, wheelX=0;
    for (var k in pointerDown){
      var z = hitDock(pointerDown[k]);
      if (z==="gas") anyGas=true;
      if (z==="brake") anyBrake=true;
      if (z==="wheel") {
        anyWheel=true;
        wheelX = clamp((pointerDown[k].x - 54)/46, -1, 1);
      }
    }
    touch.gas = anyGas;
    touch.brake = anyBrake;
    if (anyWheel) touch.wheelX = wheelX;
    else touch.wheelX *= 0.85;
  }
  window.addEventListener("pointermove", function(e){
    if (!pointerDown[e.pointerId||0]) return;
    var g = pointerToGame(e);
    pointerDown[e.pointerId||0] = g;
    if (scene === "race") refreshTouchHolds();
  });


  // Computer tabs — draw + hitbox MUST stay in sync (Chaos QA).
  // 7 tabs across content rail: x0=52, step=53, w=52 → last ends at 422 (panel 428).
  var COMP_TAB_X0 = 52, COMP_TAB_W = 52, COMP_TAB_STEP = 53, COMP_TAB_Y0 = 26, COMP_TAB_Y1 = 48;
  var COMP_TABS = [
    {id:"classifieds", label:"Classfd"},
    {id:"garage", label:"Garage"},
    {id:"races", label:"Races"},
    {id:"inbox", label:"Inbox"},
    {id:"saveload", label:"Save"},
    {id:"controls", label:"Ctrl"},
    {id:"exit", label:"Exit"}
  ];
  function tabHitIndex(x, y){
    if (y < COMP_TAB_Y0 || y > COMP_TAB_Y1) return -1;
    for (var i=0;i<COMP_TABS.length;i++){
      var tx = COMP_TAB_X0 + i*COMP_TAB_STEP;
      if (x>=tx && x<tx+COMP_TAB_W) return i;
    }
    return -1;
  }

  // ---------- Bay / Computer / Tune clicks ----------
  function bayClick(x,y){
    // Hotspots: Computer left, Tune back wall cards, Go Race door right
    // M1.6.1: Tune y→130 so painted Engine card (incl. tap 214,116) hits; clear of Comp/Door.
    if (x>=8 && x<=90 && y>=40 && y<=200) {
      scene="computer"; computerTab="classifieds"; uiSel=0;
      maybeOfferJobs(); sfxClick(); return;
    }
    if (x>=140 && x<=340 && y>=30 && y<=130) {
      if (!requireCar()) return;
      scene="tune"; uiSel=0; sfxClick(); return;
    }
    if (x>=390 && x<=472 && y>=40 && y<=220) {
      // M1.7: no car → loaner practice; owned → Fun (free). Paid Drag on Computer → Races.
      if (activeCar()) {
        if (startRace({mode:"fun"})) sfxClick();
      } else {
        if (startRace({mode:"loaner"})) sfxClick();
      }
      return;
    }
  }
  function computerClick(x,y){
    // Tabs must match drawComputer (COMP_TAB_* constants)
    var ti = tabHitIndex(x, y);
    if (ti >= 0) {
      var tid = COMP_TABS[ti].id;
      if (tid==="exit") { scene="bay"; bindListen=null; sfxClick(); return; }
      computerTab = tid; uiSel=0; bindListen=null;
      if (tid==="inbox") maybeOfferJobs();
      sfxClick(); return;
    }
    // Ad rails skip
    if (x < 48 || x > 432) { adIndex = (adIndex+1)%ADS.length; adTimer=0; sfxClick(); return; }
    // Content: set uiSel from drawn row Y, then activate
    if (y > 56 && y < 240 && x>=52 && x<=428) {
      if (computerTab === "classifieds") {
        var partBand = PART_ORDER.length * 16;
        var startY = 70 + partBand + 4;
        if (y < 70) return;
        if (y < 70 + partBand) {
          uiSel = Math.floor((y-70)/16);
        } else {
          var localY = y - startY;
          var localX = x - 58;
          if (localY < 0) return;
          var row = Math.floor(localY/34);
          var col = localX < 186 ? 0 : 1;
          var ci = row*2 + col;
          if (ci < 0 || ci >= M1_CARS.length) return;
          uiSel = PART_ORDER.length + ci;
        }
      } else if (computerTab === "garage") {
        if (!state.garage.length) return;
        var gi = Math.floor((y-72)/36);
        if (gi < 0 || gi >= state.garage.length) return;
        uiSel = gi;
      } else if (computerTab === "saveload") {
        if (y>=80 && y<110) uiSel = 0;
        else if (y>=120 && y<150) uiSel = 1;
        else return;
      } else if (computerTab === "inbox") {
        var ii = Math.floor((y-72)/52);
        if (ii < 0 || ii >= state.inbox.length) return;
        uiSel = ii;
      } else if (computerTab === "races") {
        // Three rows: Free Run / Fun / Night Drag — match drawRaceBoard Y bands
        if (y >= 120 && y < 152) uiSel = 0;
        else if (y >= 152 && y < 184) uiSel = 1;
        else if (y >= 184 && y < 216) uiSel = 2;
        else return;
      } else if (computerTab === "controls") {
        var nRows = BIND_ROWS.length;
        var rY = ctrlResetY();
        if (y >= rY && y < rY+22 && x >= CTRL_COL_X[0] && x < CTRL_COL_X[0]+140) {
          uiSel = nRows; activateSel(); return;
        }
        for (var ci=0; ci<nRows; ci++){
          var rr = ctrlRowRect(ci);
          if (x>=rr.x && x<rr.x+rr.w && y>=rr.y && y<rr.y+CTRL_ROW_H) {
            uiSel = ci; activateSel(); return;
          }
        }
        return;
      }
      activateSel();
    }
  }
  function tuneClick(x,y){
    if (x>=8 && x<=80 && y>=8 && y<=28) { scene="bay"; sfxClick(); return; }
    if (y>50 && y<230) {
      var ti = Math.floor((y-60)/40);
      if (ti < 0 || ti >= PART_ORDER.length) return;
      uiSel = ti;
      activateSel();
    }
  }
  function activateSel(){
    if (scene === "bay") return;
    if (scene === "tune") { tuneActivate(); return; }
    if (scene === "computer") computerActivate();
  }
  function computerActivate(){
    var me = activeCar();
    if (computerTab === "classifieds") {
      // rows: 4 parts + M1 cars 1–8
      var carRows = M1_CARS.map(function(id){ return "car"+id; });
      var rows = PART_ORDER.concat(carRows);
      uiSel = ((uiSel % rows.length)+rows.length)%rows.length;
      var row = rows[uiSel];
      if (row.indexOf("car") === 0) {
        var cid = parseInt(row.slice(3),10);
        var price = carListPrice(cid);
        if (state.classifiedSold[cid]) { toast("Already bought."); return; }
        if (state.cash < price) { toast("Need $"+price+" — check Inbox odd jobs?"); maybeOfferJobs(); return; }
        state.cash -= price;
        var owned = newOwned(cid);
        state.garage.push(owned);
        state.activeInstanceId = owned.instanceId;
        state.classifiedSold[cid] = true;
        toast("Bought "+labelCar(cid)+"!");
        sfxWin();
      } else {
        if (!me) { toast("Buy a car before parts."); return; }
        var part = PARTS[row];
        if (state.cash < part.price) { toast("Need $"+part.price); return; }
        state.cash -= part.price;
        me.inventory[row] = (me.inventory[row]||0) + 1;
        toast("Bought "+part.name);
        sfxClick();
      }
    } else if (computerTab === "garage") {
      if (!state.garage.length) { toast("Garage empty — Classifieds."); return; }
      uiSel = ((uiSel % state.garage.length)+state.garage.length)%state.garage.length;
      state.activeInstanceId = state.garage[uiSel].instanceId;
      toast("Active: "+labelCar(state.garage[uiSel].carId));
      sfxClick();
    } else if (computerTab === "races") {
      uiSel = ((uiSel % 3)+3)%3;
      var modes = ["loaner","fun","drag"];
      if (startRace({mode: modes[uiSel]})) sfxClick();
    } else if (computerTab === "inbox") {
      if (!state.inbox.length) { toast("Inbox empty."); return; }
      uiSel = ((uiSel % state.inbox.length)+state.inbox.length)%state.inbox.length;
      var msg = state.inbox[uiSel];
      msg.read = true;
      if (msg.kind === "job" && !msg.done) {
        msg.done = true;
        if (!state.jobsDone) state.jobsDone = {};
        if (state.jobsDone[msg.id]) { toast("Already paid out."); return; }
        state.jobsDone[msg.id] = true;
        state.jobsCompleted = (state.jobsCompleted||0) + 1;
        state.cash += (msg.pay||0);
        // Extend cooldown after payout (anti rapid reopen farm)
        state.jobCooldownUntil = Date.now() + 3*60*1000;
        toast("Done: "+msg.subj+" (+$"+msg.pay+")");
        sfxClick();
      } else {
        toast(msg.kind==="tip" ? "Tip marked read." : "OK.");
        sfxClick();
      }
    } else if (computerTab === "saveload") {
      uiSel = ((uiSel%2)+2)%2;
      if (uiSel===0) saveGame(); else loadGame();
    } else if (computerTab === "controls") {
      var n = BIND_ROWS.length;
      var max = n + 1; // + RESET
      uiSel = ((uiSel % max)+max)%max;
      if (uiSel === n) {
        resetBindsDefaults();
        sfxClick();
        return;
      }
      bindListen = BIND_ROWS[uiSel].id;
      toast("Listening… press a key (Esc cancel)");
      sfxClick();
    }
  }
  function tuneActivate(){
    var me = requireCar();
    if (!me) return;
    uiSel = ((uiSel % PART_ORDER.length)+PART_ORDER.length)%PART_ORDER.length;
    var pid = PART_ORDER[uiSel];
    if (me.fitted[pid]) { toast("Already fitted."); return; }
    if (!(me.inventory[pid] > 0)) { toast("Buy it in Classifieds first."); return; }
    me.inventory[pid]--;
    me.fitted[pid] = true;
    toast("Fitted "+PARTS[pid].name+" (+"+PARTS[pid].hp+"hp)");
    sfxShift();
  }

  // ---------- Race physics ----------
  function gearRatio(g){
    if (g < 0) return 2.8;
    var ratios = [0, 3.2, 2.1, 1.45, 1.05, 0.85];
    return ratios[g] || 1;
  }
  function updateRace(dt){
    if (!race) return;
    var p = race.player, ai = race.ai;
    race.t += dt;

    // Steering sway input
    var steer = 0;
    if (keyHeld("steerL")) steer -= 1;
    if (keyHeld("steerR")) steer += 1;
    // touch wheel
    var holdingWheel = false;
    for (var k in pointerDown){ if (hitDock(pointerDown[k])==="wheel") holdingWheel=true; }
    if (holdingWheel) steer = touch.wheelX;
    else touch.wheelX *= 0.85; // snap-to-center soft
    // deadzone
    if (Math.abs(steer) < 0.12) steer = 0;
    else steer = Math.sign(steer) * Math.pow(Math.abs(steer), 1.25);

    p.lane = clamp(p.lane + steer * 1.6 * dt, -1, 1);
    // soft return
    if (!steer) p.lane *= (1 - 2.2*dt);

    // Throttle / brake
    var gas = (keyHeld("gas")||touch.gas) ? 1 : 0;
    var brk = (keyHeld("brake")||touch.brake) ? 1 : 0;
    p.throttle = gas; p.brake = brk;

    if (race.phase === "staging") {
      race.countdown -= dt;
      if (race.countdown <= 0) { race.phase = "go"; race.countdown = 0; beep(880,0.1,"square",0.06); }
      // allow staging rpm blip
      if (p.range==="D" && gas) p.rpm = lerp(p.rpm, 3500, 4*dt);
      else p.rpm = lerp(p.rpm, 800, 3*dt);
      return;
    }
    if (race.phase === "done") return;

    // Player drive
    driveCar(p, dt, true);
    // AI drive
    driveAI(ai, dt);

    if (p.dist >= RACE_LEN && !p.finished) { p.finished=true; p.finishT=race.t; }
    if (ai.dist >= RACE_LEN && !ai.finished) { ai.finished=true; ai.finishT=race.t; }
    if (p.finished && ai.finished) {
      race.phase = "done";
      race.result = (p.finishT <= ai.finishT) ? "win" : "loss";
      applyRacePayout();
      scene = "result";
    }
  }
  function driveCar(p, dt, isPlayer){
    if (p.finished) { p.speed = Math.max(0, p.speed - 8*dt); return; }
    var hp = p.pwr.hp;
    var weight = p.pwr.weight;
    var accelScale = (hp / weight) * 9.5;

    if (p.range === "N" || p.gear === 0) {
      p.speed = Math.max(0, p.speed - (p.brake?14:2)*dt);
      p.rpm = lerp(p.rpm, 800, 3*dt);
      return;
    }
    if (p.range === "R") {
      // reverse crawl — not used in drag but functional
      if (p.brake) p.speed = Math.max(0, p.speed - 16*dt);
      else if (p.throttle) p.speed = approach(p.speed, -8, 6*dt);
      else p.speed = approach(p.speed, 0, 4*dt);
      p.dist += p.speed * dt; // can go negative — clamp
      if (p.dist < 0) p.dist = 0;
      return;
    }
    // D
    var gr = gearRatio(p.gear);
    var targetRpm = 800 + p.speed * gr * 38;
    if (p.throttle) {
      var power = accelScale * (p.throttle) / Math.max(0.7, gr*0.55);
      // soft powerband
      var band = 1 - Math.abs((targetRpm-4500)/4500);
      power *= clamp(0.55 + band*0.55, 0.4, 1.15);
      p.speed += power * dt * 10;
      // redline limit by gear
      var vmax = [0,42,72,105,138,168][p.gear] || 160;
      if (p.speed > vmax) p.speed = lerp(p.speed, vmax, 4*dt);
    } else {
      p.speed = Math.max(0, p.speed - 1.8*dt);
    }
    if (p.brake) p.speed = Math.max(0, p.speed - 18*dt);
    p.rpm = clamp(lerp(p.rpm, targetRpm + (p.throttle?900:0), 6*dt), 700, 7200);
    // auto soft shift assist if over-rev while throttling
    if (isPlayer && p.throttle && p.rpm > 6800 && p.gear < 5) {
      // don't auto — player shifts; slight power loss
      p.speed *= (1 - 0.15*dt);
    }
    p.dist += Math.max(0, p.speed) * dt;
    race.camShake = p.throttle ? 0.6 : 0.15;
  }
  function approach(a,b,d){
    if (a < b) return Math.min(b, a+d);
    return Math.max(b, a-d);
  }
  function driveAI(ai, dt){
    if (ai.finished) return;
    // Simple ET-based accel curve toward finishing near predicted ET
    var progress = ai.dist / RACE_LEN;
    var targetSpeed = 20 + progress * 55 * ai.aggression;
    // launch
    if (race.phase === "go" || race.phase === "run") {
      if (race.phase === "go") race.phase = "run";
      ai.speed = approach(ai.speed, targetSpeed, (8 + ai.hp/ai.weight*20)*dt);
      ai.dist += ai.speed * dt;
      ai.gear = ai.speed < 40 ? 1 : ai.speed < 70 ? 2 : ai.speed < 100 ? 3 : ai.speed < 130 ? 4 : 5;
      // slight lane sway
      ai.lane = 0.12 + Math.sin(race.t*1.3)*0.08;
    }
  }

  // Gap helpers for mirrors
  function gapMeters(){
    if (!race) return 0;
    return race.ai.dist - race.player.dist; // + = AI ahead
  }

  // ---------- Canvas ----------
  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var scale = 1, ox = 0, oy = 0;

  function fit(){
    var sw = window.innerWidth, sh = window.innerHeight;
    scale = Math.floor(Math.min(sw/W, sh/H));
    if (scale < 1) scale = 1;
    // allow fractional if window small
    var fs = Math.min(sw/W, sh/H);
    if (fs < 1) scale = fs;
    canvas.style.width = (W*scale) + "px";
    canvas.style.height = (H*scale) + "px";
  }
  window.addEventListener("resize", fit);
  fit();

  // Drawing helpers
  function fill(r,g,b,a){ ctx.fillStyle = a==null? "rgb("+r+","+g+","+b+")" : "rgba("+r+","+g+","+b+","+a+")"; }
  function rect(x,y,w,h){ ctx.fillRect(x|0,y|0,w|0,h|0); }
  function text(str,x,y,color,size,align){
    ctx.font = (size||10) + "px monospace";
    ctx.fillStyle = color || "#ccc";
    ctx.textAlign = align || "left";
    ctx.textBaseline = "top";
    ctx.fillText(str, x, y);
  }
  function strokeRect(x,y,w,h,color){
    ctx.strokeStyle = color||"#888";
    ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
  }

  function drawBay(){
    // M1.6: polish bg first; skip opaque procedural walls when polish loads.
    // M1.6.1: bayClick Tune hitbox extended to cover painted Engine card.
    var polished = drawPolishBg(POLISH.bay);
    if (!polished) {
      // Garage interior fallback
      fill(18,16,20); rect(0,0,W,H);
      fill(32,28,34); rect(0,0,W,120);
      fill(28,24,22); rect(0,120,W,150);
      fill(40,36,32);
      for (var i=0;i<12;i++) rect(i*40, 160+i*2, 40, 2);

      // CRT Computer left
      fill(20,40,30); rect(14,48,70,90);
      fill(40,180,80); rect(22,56,54,40);
      fill(10,14,12); rect(28,62,42,28);
      text("CRT", 30, 100, "#6f6", 9);
      text("COMPUTER", 18, 112, "#8f8", 8);
      strokeRect(12,46,74,96,"#2a4");
      text("[PC]", 30, 148, "#6a6", 9);

      // Tune cards on back wall
      fill(50,40,30); rect(150,36,180,50);
      fill(80,60,40); rect(158,42,50,38);
      fill(60,70,90); rect(216,42,50,38);
      fill(70,50,60); rect(274,42,48,38);
      text("TUNE", 220, 88, "#dc8", 11);
      text("cards", 222, 100, "#a86", 8);
      strokeRect(148,34,184,54,"#a80");

      // Go Race door right
      fill(40,30,20); rect(400,40,68,170);
      fill(20,16,12); rect(408,50,52,140);
      fill(180,140,60); rect(448,110,6,20);
      text("GO", 418, 100, "#fc6", 14);
      text("RACE", 412, 116, "#fc6", 12);
      strokeRect(398,38,72,174,"#ca6");
    }

    // Car center — sprite if M1 art, else procedural; empty pad if cash-only
    var me = activeCar();
    if (me) {
      if (!drawBayCarSprite(me.carId, BAY_CX, BAY_FLOOR_Y)) {
        drawSideCar(190, 145, rosterOf(me.carId).color, 1.1);
      }
      text(labelCar(me.carId), 170, 206, "#ccc", 9);
      var pwr = carPower(me);
      text(pwr.hp+" hp  ET~"+pwr.et.toFixed(2), 175, 218, "#888", 8);
    } else {
      fill(24,22,20, polished ? 0.55 : 1); rect(170,140,120,40);
      text("NO CAR — buy in Computer", 168, 152, "#a86", 8);
      text("Classifieds · 8 M1 cars", 185, 168, "#888", 8);
    }

    // HUD overlays (always)
    text("$"+state.cash, 8, 8, "#8f8", 11);
    text("Rep "+state.rep+" · "+repLabel(state.rep), 100, 8, "#acf", 10);
    text("W"+state.wins+" / L"+state.losses, 280, 8, "#aaa", 10);
    text("Tap: Computer · Tune · Door", 8, 252, "#666", 8);
  }

  function drawSideCar(x,y,color,sc){
    sc = sc || 1;
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(sc,sc);
    fillHex(color); rect(10,18,90,24);
    fillHex(shade(color,-30)); rect(28,6,50,16); // cabin
    fill(20,20,24); rect(18,36,18,12); rect(78,36,18,12); // wheels
    fill(200,200,210,0.15); rect(32,8,20,12); rect(56,8,18,12);
    ctx.restore();
  }
  function fillHex(h){ ctx.fillStyle = h; }
  function shade(hex, d){
    // simple
    try {
      var n = parseInt(hex.slice(1),16);
      if (hex.length<7) return hex;
      var r=clamp(((n>>16)&255)+d,0,255), g=clamp(((n>>8)&255)+d,0,255), b=clamp((n&255)+d,0,255);
      return "rgb("+r+","+g+","+b+")";
    } catch(e){ return hex; }
  }

  function drawAdRail(x, y, h){
    var ad = ADS[adIndex % ADS.length];
    fill(12,12,16); rect(x,y,48,h);
    fillHex(ad.color); rect(x+2,y+2,44,h-4);
    fill(0,0,0,0.35); rect(x+2,y+2,44,h-4);
    // vertical title
    ctx.save();
    ctx.translate(x+30, y+h-12);
    ctx.rotate(-Math.PI/2);
    text(ad.title, 0, 0, "#fff", 11);
    text(ad.sub, 0, 14, "#ddd", 9);
    ctx.restore();
    text("AD", x+16, y+4, "#fff", 8);
  }

  function drawComputer(){
    fill(8,12,10); rect(0,0,W,H);
    // OS chrome
    fill(20,40,28); rect(0,0,W,24);
    text("RETRO OS  ·  MONEY WALLET $"+state.cash, 8, 6, "#9f9", 10);
    text(repLabel(state.rep)+"  Rep "+state.rep, 340, 6, "#8cf", 9);

    // Ad rails
    drawAdRail(0, 24, 220);
    drawAdRail(432, 24, 220);

    // Tabs (hitboxes: COMP_TAB_X0/W/STEP — must match computerClick)
    for (var i=0;i<COMP_TABS.length;i++){
      var tx = COMP_TAB_X0 + i*COMP_TAB_STEP;
      var on = computerTab === COMP_TABS[i].id;
      fill(on?40:24, on?70:40, on?40:30); rect(tx, COMP_TAB_Y0, COMP_TAB_W, 20);
      text(COMP_TABS[i].label, tx+3, 31, on?"#cfc":"#8a8", 8);
    }

    // Content panel
    fill(12,18,14); rect(52,50,376,190);
    strokeRect(52,50,376,190,"#2a4");

    if (computerTab === "classifieds") drawClassifieds();
    else if (computerTab === "garage") drawGarageTab();
    else if (computerTab === "races") drawRaceBoard();
    else if (computerTab === "inbox") drawInbox();
    else if (computerTab === "saveload") drawSaveLoad();
    else if (computerTab === "controls") drawControls();

    if (computerTab === "controls") {
      text("Controls · remappable · Esc cancel listen", 52, 248, "#666", 8);
    } else {
      text(bindLabel("menuUp")+"/"+bindLabel("menuDown")+" select · "+bindLabel("menuConfirm")+" confirm · Esc/Exit · AD skip", 52, 248, "#666", 8);
    }
  }

  function drawClassifieds(){
    text("CLASSIFIEDS — S1 bolt-ons + M1 eight (1–8)", 60, 56, "#cf8", 9);
    var me = activeCar();
    var rows = PART_ORDER;
    var extra = M1_CARS.length;
    var total = rows.length + extra;
    uiSel = ((uiSel % total) + total) % total;
    // parts compact
    for (var i=0;i<rows.length;i++){
      var p = PARTS[rows[i]];
      var sel = uiSel===i;
      if (sel) { fill(30,50,30); rect(58,70+i*16,200,15); }
      var inv = me ? (me.inventory[rows[i]]||0) : 0;
      text((sel?"> ":"  ")+p.name+" $"+p.price, 64, 71+i*16, sel?"#efc":"#bbb", 8);
      text("x"+inv, 200, 71+i*16, "#666", 8);
    }
    // cars grid with sprites
    var startY = 70 + rows.length*16 + 4;
    text("CARS", 270, 56, "#fc8", 8);
    for (var c=0;c<M1_CARS.length;c++){
      var cid = M1_CARS[c];
      var bi = rows.length + c;
      var selc = uiSel===bi;
      var col = c % 2;
      var row = (c/2)|0;
      var x = 58 + col*186;
      var y = startY + row*34;
      if (selc) { fill(40,30,20); rect(x,y,180,32); }
      else { fill(16,18,16); rect(x,y,180,32); }
      if (!drawCarSprite(cid, x+28, y+16, 0.35)) {
        fillHex(rosterOf(cid).color); rect(x+8,y+8,36,16);
      }
      var sold = !!state.classifiedSold[cid];
      text((selc?">":" ")+rosterOf(cid).name.slice(0,14), x+55, y+6, selc?"#fc8":"#ccc", 8);
      text(sold?"SOLD":("$"+carListPrice(cid)), x+55, y+18, sold?"#666":"#8f8", 8);
    }
  }

  function drawGarageTab(){
    text("MY GARAGE — tap/Enter to set active", 60, 56, "#acf", 9);
    if (!state.garage.length) { text("Empty.", 64, 80, "#888", 10); return; }
    uiSel = ((uiSel % state.garage.length)+state.garage.length)%state.garage.length;
    for (var i=0;i<state.garage.length;i++){
      var o = state.garage[i];
      var pwr = carPower(o);
      var sel = uiSel===i;
      var active = o.instanceId === state.activeInstanceId;
      if (sel) { fill(30,40,50); rect(58,72+i*36,360,34); }
      text((sel?"> ":"  ")+(active?"★ ":"  ")+labelCar(o.carId), 64, 76+i*36, active?"#8f8":"#ccc", 10);
      text("  id "+o.instanceId.slice(0,10)+"…  "+pwr.hp+"hp  ET~"+pwr.et.toFixed(2), 64, 90+i*36, "#888", 8);
    }
  }

  function drawRaceBoard(){
    text("RACE BOARD — Free Run / Fun / Night Drag", 60, 56, "#fc8", 10);
    text("Street Cred: "+repLabel(state.rep)+" ("+state.rep+")  ·  Cash $"+state.cash, 64, 74, "#acf", 9);
    text("Bay door: loaner if no car, Fun if owned. Drag stays here.", 64, 90, "#888", 8);
    uiSel = ((uiSel % 3)+3)%3;
    var rows = [
      { y:120, title:"FREE RUN (LOANER)", sub:"$0 · no car needed · career untouched", ok:true },
      { y:152, title:"FUN RUN (OWNED)", sub:"$0 entry · win +1 Rep"+ (state.cash < ENTRY_FEE ? " +$"+FUN_SOFT_CASH+" soft" : " (cash≥$"+ENTRY_FEE+")"), ok:!!activeCar() },
      { y:184, title:"NIGHT DRAG $"+ENTRY_FEE+" → win $"+WIN_PAY, sub:"Career W/L · Rep +2/−1", ok:!!activeCar() && state.cash >= ENTRY_FEE }
    ];
    for (var i=0;i<rows.length;i++){
      var r = rows[i];
      var sel = uiSel===i;
      fill(sel?40:20, sel?50:28, sel?30:22); rect(58, r.y, 360, 30);
      var col = !r.ok ? "#666" : (sel?"#efc":"#ccc");
      text((sel?"> ":"  ")+r.title, 64, r.y+4, col, 10);
      text("  "+r.sub, 64, r.y+16, r.ok?"#888":"#555", 8);
    }
    text("↑/↓ select · Enter/tap start · Esc Exit", 64, 226, "#666", 8);
  }

  function drawInbox(){
    text("INBOX — tips + boring odd jobs (not the main grind)", 60, 56, "#acf", 9);
    if (!state.inbox || !state.inbox.length) { text("No messages.", 64, 80, "#888", 10); return; }
    uiSel = ((uiSel % state.inbox.length)+state.inbox.length)%state.inbox.length;
    var msg = state.inbox[uiSel];
    // list
    for (var i=0;i<Math.min(state.inbox.length,4);i++){
      var m = state.inbox[i];
      var sel = uiSel===i;
      if (sel) { fill(30,40,50); rect(58,70+i*18,360,17); }
      var tag = m.kind==="job" ? (m.done?"[DONE] ":"[JOB] ") : (m.read?"[tip] ":"[NEW] ");
      text((sel?"> ":"  ")+tag+m.subj.slice(0,34), 64, 72+i*18, sel?"#cfe":"#aaa", 8);
    }
    // detail
    fill(20,24,28); rect(58,150,360,78);
    text("FROM: "+msg.from, 64, 156, "#8cf", 8);
    text("SUBJ: "+msg.subj, 64, 168, "#ccc", 9);
    for (var b=0;b<(msg.body||[]).length && b<3;b++) text(msg.body[b], 64, 184+b*12, "#999", 8);
    if (msg.kind==="job" && !msg.done) text("Enter/tap: do the boring job (+$"+msg.pay+")", 64, 220, "#8f8", 8);
    else text("Enter/tap: mark read", 64, 220, "#666", 8);
  }

  function drawSaveLoad(){
    text("SAVE / LOAD  (localStorage)", 60, 56, "#8f8", 10);
    uiSel = ((uiSel%2)+2)%2;
    fill(uiSel===0?30:16,40,30); rect(58,80,360,28);
    text((uiSel===0?"> ":"  ")+"SAVE GAME", 70, 88, "#cfc", 12);
    fill(uiSel===1?30:16,40,30); rect(58,120,360,28);
    text((uiSel===1?"> ":"  ")+"LOAD GAME", 70, 128, "#cfc", 12);
    text("Stores cash, rep, garage, fitted parts, keybinds.", 64, 170, "#666", 8);
  }

  function drawControls(){
    // Lean 2-col CRT legend — gearing first, all rows visible (Design Scout).
    text("CONTROLS — gearing / pedals / range / steer · remappable", 60, 56, "#cf8", 8);
    var n = BIND_ROWS.length;
    var max = n + 1;
    uiSel = ((uiSel % max)+max)%max;
    for (var i=0;i<n;i++){
      var row = BIND_ROWS[i];
      var sel = uiSel===i;
      var rr = ctrlRowRect(i);
      if (sel) { fill(30,50,30); rect(rr.x, rr.y, rr.w, rr.h); }
      var b = keybinds[row.id];
      var prim = humanizeKey(b.primary);
      var alt = b.alt ? ("/"+humanizeKey(b.alt)) : "";
      var listen = (bindListen === row.id);
      var lab = (sel?">":" ")+row.label;
      var keysTxt = listen ? "…" : (prim + alt);
      text(lab, rr.x+4, rr.y+3, sel?"#efc":(row.section==="menu"?"#9ab":"#ccc"), 8);
      text(keysTxt, rr.x+88, rr.y+3, listen?"#fd8":"#8f8", 8);
    }
    var ry = ctrlResetY();
    var rsel = uiSel===n;
    fill(rsel?50:24, rsel?40:28, 20); rect(CTRL_COL_X[0], ry, 140, 18);
    text((rsel?"> ":"  ")+"RESET DEFAULTS", CTRL_COL_X[0]+4, ry+4, rsel?"#fc8":"#ca8", 8);
    text("Esc=abort/cancel (fixed)", CTRL_COL_X[1], ry+5, "#666", 7);
  }

  function drawTune(){
    fill(16,14,18); rect(0,0,W,H);
    fill(40,30,20); rect(8,8,70,20); text("< BAY", 18, 12, "#fc8", 10);
    text("TUNE BAY — fit owned S1 bolt-ons", 100, 12, "#dc8", 11);
    var me = activeCar();
    var pwr = carPower(me);
    text(labelCar(me.carId)+"  "+pwr.hp+" hp  ET~"+pwr.et.toFixed(2), 20, 36, "#ccc", 10);

    uiSel = ((uiSel%PART_ORDER.length)+PART_ORDER.length)%PART_ORDER.length;
    for (var i=0;i<PART_ORDER.length;i++){
      var pid = PART_ORDER[i];
      var p = PARTS[pid];
      var sel = uiSel===i;
      var y = 60 + i*40;
      if (sel) { fill(40,32,24); rect(20,y,440,36); }
      text((sel?"> ":"  ")+p.name, 28, y+6, sel?"#fe8":"#ccc", 11);
      text("inv "+(me.inventory[pid]||0)+"  fitted "+(me.fitted[pid]?"YES":"no")+"  +"+p.hp+"hp "+p.et+"s", 28, y+20, "#888", 9);
    }
    text(bindLabel("menuUp")+"/"+bindLabel("menuDown")+" select · "+bindLabel("menuConfirm")+"/tap fit · buy in Classifieds", 20, 250, "#666", 8);
  }

  // ----- Race render: forward POV + mirrors -----
  function drawRace(){
    var shake = (race && race.camShake) ? (Math.random()-0.5)*race.camShake : 0;
    // M1.6: cockpit polish as full-canvas bg; WIND/mirrors punch live road through.
    var polished = drawPolishBg(POLISH.cockpit);
    if (!polished) {
      fill(10,10,12); rect(0,0,W,H);
      fill(28,26,30); rect(0,0,W,H);
    }

    // Windshield road view (clip into locked WIND)
    ctx.save();
    ctx.beginPath();
    ctx.rect(WIND.x, WIND.y, WIND.w, WIND.h);
    ctx.clip();
    ctx.translate(shake, shake*0.5);
    drawRoadView("forward");
    ctx.restore();

    if (!polished) {
      // Dash / chrome around glass (fallback when polish missing)
      fill(36,32,36); rect(0,0,W,WIND.y);
      fill(36,32,36); rect(0,WIND.y+WIND.h,W, H-(WIND.y+WIND.h));
      fill(36,32,36); rect(0,0,WIND.x,H);
      fill(36,32,36); rect(WIND.x+WIND.w,0, W-(WIND.x+WIND.w),H);
      fill(22,20,24); rect(WIND.x-6, WIND.y, 6, WIND.h);
      fill(22,20,24); rect(WIND.x+WIND.w, WIND.y, 6, WIND.h);
    }

    // Center rearview mirror (functioning) — locked MIRROR_C
    drawMirror(MIRROR_C, "rear");
    // Driver-side mirror — locked MIRROR_L
    drawMirror(MIRROR_L, "quarter");

    // Instruments (live telemetry — polish has no SPD/RPM readouts)
    drawInstruments();

    // M1.6.3: clean dash — live dock owns wheel/pedals/shift/DNR (same layout as hitDock).
    drawTouchDock();

    // Staging / countdown overlay
    if (race.phase === "staging") {
      var n = Math.ceil(race.countdown);
      fill(0,0,0,0.35); rect(WIND.x, WIND.y, WIND.w, WIND.h);
      var lights = ["#400","#400","#400"];
      if (race.countdown < 3) lights[0]="#c00";
      if (race.countdown < 2) lights[1]="#c80";
      if (race.countdown < 1) lights[2]="#0c0";
      if (race.countdown <= 0) lights=["#0c0","#0c0","#0c0"];
      for (var i=0;i<3;i++){ fillHex(lights[i]); rect(220+i*20, 60, 14, 14); }
      text(race.countdown>0 ? ("STAGING "+n) : "GO", 210, 90, "#fff", 14);
      if (race.countdown > 0) {
        text(bindLabel("rangeD")+" D · "+bindLabel("gas")+" gas · "+bindLabel("shiftUp")+"/"+bindLabel("shiftDown")+" shift", 140, 112, "#ccc", 8);
      }
    }
  }

  function drawRoadView(mode){
    // Sky / night
    fill(12,14,28); rect(WIND.x-2, WIND.y-2, WIND.w+4, WIND.h+4);
    // horizon road
    var horizon = WIND.y + 70;
    fill(18,18,22); rect(WIND.x, horizon, WIND.w, WIND.y+WIND.h-horizon);

    var gap = gapMeters();
    var p = race.player, ai = race.ai;
    var rel = ai.dist - p.dist; // + ahead

    // Road trapezoid
    var roadTopW = 40, roadBotW = 280;
    var cx = WIND.x + WIND.w/2 + p.lane * -18; // sway opposite for feel
    fill(40,40,44);
    ctx.beginPath();
    ctx.moveTo(cx - roadTopW/2, horizon);
    ctx.lineTo(cx + roadTopW/2, horizon);
    ctx.lineTo(cx + roadBotW/2, WIND.y+WIND.h);
    ctx.lineTo(cx - roadBotW/2, WIND.y+WIND.h);
    ctx.closePath(); ctx.fill();

    // Center dashes scrolling
    var scroll = (p.dist * 4) % 40;
    fill(180,180,100);
    for (var s=0;s<8;s++){
      var yy = horizon + 8 + s*22 + (40-scroll)*0.5;
      if (yy > WIND.y+WIND.h) continue;
      var t = (yy-horizon)/(WIND.y+WIND.h-horizon);
      var w = lerp(2, 10, t);
      rect(cx - w/2, yy, w, lerp(4,10,t));
    }

    // Strip edge
    fill(120,80,40);
    ctx.beginPath();
    ctx.moveTo(cx - roadTopW/2 - 4, horizon);
    ctx.lineTo(cx - roadBotW/2 - 14, WIND.y+WIND.h);
    ctx.lineTo(cx - roadBotW/2, WIND.y+WIND.h);
    ctx.lineTo(cx - roadTopW/2, horizon);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + roadTopW/2 + 4, horizon);
    ctx.lineTo(cx + roadBotW/2 + 14, WIND.y+WIND.h);
    ctx.lineTo(cx + roadBotW/2, WIND.y+WIND.h);
    ctx.lineTo(cx + roadTopW/2, horizon);
    ctx.fill();

    // Opponent in windshield when ahead or alongside (|rel| small / positive ahead)
    if (mode === "forward") {
      // Show AI if ahead or roughly alongside (within ~8m behind still peeking)
      if (rel > -12) {
        var depth = clamp(1 - Math.abs(Math.min(rel, 80))/80, 0.15, 1);
        if (rel < 0) depth = clamp(0.35 + rel/20, 0.1, 0.45); // behind-ish fade if barely behind
        // If clearly behind, don't draw in windshield (mirrors handle it)
        if (rel >= -6) {
          var scaleCar = lerp(0.25, 1.35, depth);
          var laneOff = (ai.lane - p.lane) * lerp(8, 70, depth);
          var ax = cx + laneOff;
          var ay = lerp(horizon+4, WIND.y+WIND.h-28, Math.pow(depth, 0.85));
          // Ahead in windshield → rival _rear frame (Design Scout mapping)
          drawOpponentCar(ax, ay, scaleCar, ai.color, "rear", ai.carId);
          if (rel < 4 && rel > -6) {
            // alongside: 3/4 procedural peek (no dedicated side art yet)
            drawOpponentCar(ax, ay, scaleCar, ai.color, "side", ai.carId);
          }
        }
      }
      // Finish banner when close
      var remain = RACE_LEN - p.dist;
      if (remain < 40) {
        var td = 1 - remain/40;
        fill(200,40,40); rect(cx-40, horizon-10+td*40, 80, 6);
        text("FINISH", cx-18, horizon-22+td*40, "#fff", 8);
      }
    }
  }

  function drawOpponentCar(x,y,sc,color,view,carId){
    // view: "rear" (windshield ahead) | "front" (mirrors, flipped H) | "side" (procedural)
    var maxW = Math.max(8, Math.floor(100 * sc));
    var maxH = Math.max(6, Math.floor(56 * sc));
    if (view === "rear" && carId) {
      if (drawRaceCarSprite(carId, "rear", x, y, maxW, maxH, false)) return;
    }
    if (view === "front" && carId) {
      // Mirror reflection: front frame, flipped horizontally
      if (drawRaceCarSprite(carId, "front", x, y, maxW, maxH, true)) return;
    }
    // Procedural fallback (missing PNG / side peek)
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(sc,sc);
    if (view === "side" || view === "front") {
      fillHex(color); rect(-30,-10,60,18);
      fillHex(shade(color,-40)); rect(-10,-20,28,12);
      fill(10,10,12); rect(-24,6,14,8); rect(12,6,14,8);
      if (view === "front") {
        fill(200,200,160); rect(-18,-4,10,6); rect(8,-4,10,6); // headlights hint
      }
    } else {
      // rear view
      fillHex(color); rect(-22,-12,44,20);
      fill(20,20,24); rect(-18,-8,14,8); rect(4,-8,14,8); // taillight glass
      fill(180,30,30); rect(-16,-6,10,4); rect(6,-6,10,4); // tails
      fill(10,10,12); rect(-20,8,16,8); rect(4,8,16,8);
      fillHex(shade(color,-50)); rect(-14,-18,28,8); // spoiler/roof
    }
    ctx.restore();
  }

  function drawMirror(box, kind){
    var polished = polishReady(POLISH.cockpit);
    // M1.6.3: polish paints frames — content-only inside clear glass (no second bezel).
    if (!polished) {
      fill(60,58,62); rect(box.x-2, box.y-2, box.w+4, box.h+4);
    }
    fill(8,10,14); rect(box.x, box.y, box.w, box.h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();

    // Mirror sky
    fill(16,18,30); rect(box.x, box.y, box.w, box.h*0.45);
    fill(24,24,28); rect(box.x, box.y+box.h*0.45, box.w, box.h*0.55);

    if (!race) { ctx.restore(); return; }
    var rel = race.ai.dist - race.player.dist; // + ahead
    // Only show opponent in mirrors when behind (rel < 0) or barely alongside for side
    var show = false;
    var depth = 0;
    var lx = 0;

    if (kind === "rear") {
      // Straight back: opponent when behind
      if (rel < 2) {
        show = true;
        // farther behind = smaller
        var behind = Math.max(0, -rel);
        depth = clamp(1 - behind/70, 0.2, 1);
        lx = (race.ai.lane - race.player.lane) * 10;
      }
    } else if (kind === "quarter") {
      // Driver-side rear-left quarter: emphasize when AI is behind-left / overtaking on shoulder
      if (rel < 10) {
        var laneDelta = race.ai.lane - race.player.lane; // AI more positive = their right
        // Driver side is LEFT of player → show stronger when AI is to our left (laneDelta < 0) or closing from behind
        if (rel < 4 || laneDelta < 0.2) {
          show = true;
          var behind2 = Math.max(0, -rel);
          depth = clamp(1 - behind2/55, 0.25, 1);
          // Bias toward left of mirror glass
          lx = -6 + laneDelta * 14 + (rel < 0 ? -4 : 6);
        }
      }
    }

    if (show) {
      var mx = box.x + box.w/2 + lx;
      var my = box.y + box.h*0.55;
      var sc = (kind==="rear" ? 0.55 : 0.7) * depth;
      // Different silhouette angle for quarter
      // Behind in mirrors → rival _front flipped H (reads like a real mirror)
      var msc = sc * (kind==="quarter" ? 0.85 : 0.7);
      drawOpponentCar(mx, my, msc, race.ai.color, "front", race.ai.carId);
      // gap pip
      var gap = Math.abs(rel)|0;
      text(gap+"m", box.x+3, box.y+2, "#8f8", 7);
    } else {
      // empty road behind
      fill(50,50,54); rect(box.x+box.w*0.3, box.y+box.h*0.5, box.w*0.4, box.h*0.4);
    }

    ctx.restore();
    if (!polished) {
      text(kind==="rear"?"RVM":"L", box.x+box.w-12, box.y+box.h-10, "#666", 7);
      strokeRect(box.x-2, box.y-2, box.w+4, box.h+4, "#aaa");
    }
  }

  function drawInstruments(){
    var p = race.player;
    text("SPD "+String(Math.max(0,p.speed)|0), 56, 198, "#cfc", 10);
    text("RPM "+(p.rpm|0), 130, 198, "#fc8", 10);
    text("GEAR "+(p.range==="D"?p.gear:p.range), 220, 198, "#8cf", 11);
    text("DIST "+(p.dist|0)+"/"+RACE_LEN, 300, 198, "#aaa", 9);
    var rel = gapMeters();
    text(rel>=0 ? ("AI +"+ (rel|0)+"m") : ("AI "+(rel|0)+"m"), 56, 212, rel>=0?"#f88":"#8f8", 9);
    text("SH "+bindLabel("shiftUp")+"/"+bindLabel("shiftDown")+"  GAS "+bindLabel("gas")+"  BRK "+bindLabel("brake"), 160, 212, "#668", 7);
  }

  // M1.6.3: drawDockHighlights retired — drawTouchDock carries press state alone.
  function drawTouchDock(){
    // LEFT wheel
    fill(30,30,36); rect(8,222,100,44);
    strokeRect(8,222,100,44,"#555");
    text("WHEEL", 38, 226, "#888", 8);
    fill(60,60,70); rect(50 + touch.wheelX*36, 240, 12, 18);
    // CENTER ranges
    var ranges=["D","N","R"];
    for (var i=0;i<3;i++){
      var rx = 160+i*55;
      var on = race.player.range===ranges[i];
      var blocked = ranges[i]==="R";
      fill(blocked?20: (on?50:28), blocked?20:(on?80:28), blocked?24:(on?40:32)); rect(rx,230,50,28);
      text(ranges[i], rx+18, 238, blocked?"#555":(on?"#fff":"#aaa"), 12);
    }
    // RIGHT gas/brake/shift
    fill(28,50,28); rect(360,222,50,44); text("GAS", 372, 238, "#8f8", 10);
    fill(50,28,28); rect(416,222,50,44); text("BRK", 428, 238, "#f88", 10);
    fill(40,40,50); rect(360,200,50,20); text("SH+", 374, 204, "#acf", 9);
    fill(40,40,50); rect(416,200,50,20); text("SH-", 430, 204, "#acf", 9);
  }

  function drawResult(){
    fill(8,8,12); rect(0,0,W,H);
    var win = race && race.result === "win";
    var mode = race ? (race.mode || "drag") : "drag";
    var modeLab = mode==="loaner" ? "LOANER PRACTICE" : (mode==="fun" ? "FUN RUN" : "NIGHT DRAG");
    text(modeLab, 160, 36, "#acf", 10);
    text(win ? "YOU WIN" : "YOU LOSE", 180, 60, win?"#8f8":"#f88", 18);
    var note = (race && race.payoutNote) ? race.payoutNote : (win ? ("+$"+WIN_PAY+"   Rep +2") : "Rep -1 (min 0)");
    text(note, 140, 95, win?"#cfc":"#fcc", 11);
    if (race && race.paidOut) text("Payout locked", 190, 112, "#666", 8);
    text("Cash $"+state.cash+"   "+repLabel(state.rep)+" ("+state.rep+")", 140, 130, "#ccc", 11);
    text("W "+state.wins+" / L "+state.losses, 190, 150, "#aaa", 10);
    if (race) {
      text("Your ET-ish: "+(race.player.finishT||0).toFixed(2)+"s", 160, 175, "#888", 9);
      text("AI: "+(race.ai.finishT||0).toFixed(2)+"s", 190, 190, "#888", 9);
    }
    text("Tap / Enter → Bay   ·   remember to Save in Computer", 90, 230, "#666", 9);
  }

  // ---------- Main loop ----------
  var last = performance.now();
  function frame(now){
    var dt = Math.min(0.05, (now-last)/1000);
    last = now;
    adTimer += dt;
    if (adTimer >= AD_CYCLE) { adTimer = 0; adIndex = (adIndex+1)%ADS.length; }
    if (toastT > 0) toastT -= dt;

    if (scene === "race") updateRace(dt);

    // clear
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,W,H);

    if (scene === "bay") drawBay();
    else if (scene === "computer") drawComputer();
    else if (scene === "tune") drawTune();
    else if (scene === "race") drawRace();
    else if (scene === "result") drawResult();

    if (toastT > 0 && toastMsg) {
      fill(0,0,0,0.7); rect(80,120,320,28);
      text(toastMsg, 240, 128, "#fff", 11, "center");
    }

    requestAnimationFrame(frame);
  }
  loadSprites();
  loadRaceSprites();
  loadPolish();
  requestAnimationFrame(frame);

  // Click on result via keyboard
  window.addEventListener("keydown", function(e){
    if (scene==="result" && (codeMatches("menuConfirm", e.code) || e.code==="Enter" || e.code==="Space")) { scene="bay"; race=null; }
  });

  console.log("Retro Garage M1.7 ready — file:// OK · Free Run loaner/Fun + Night Drag");
})();
