// Os ícones dos itens em pixel art (no lugar dos emojis): poções, pergaminho, pão de viagem, amuleto e os
// 35 materiais que os monstros soltam, pintados com o mesmo pincel do bestiário (volume, rampa de 6 tons,
// pontilhado e o contorno colorido). Cada forma (frasco, gema, escama, presa, coração...) recebe as cores
// do item. iconeDoItem(id) devolve o <img> pronto; o tamanho vem do CSS de quem usa.
// Depende de pixel.js e bestiario.js (pintura, rampaDe, lembrarBestiario).

const FORMAS_DE_ITEM = {
  // um frasco redondo com rolha e o líquido brilhando por dentro
  frasco(p, { cor, vidro = "#d8ecff", grande = false }) {
    const r = rampaDe(cor);
    const cx = 9;
    const raio = grande ? 7 : 6;
    const cy = 18 - raio - 0.5;
    p.elipsoide(cx, cy, raio, raio, rampaDe(vidro), { alfa: 200, brilho: false });
    p.elipsoide(cx, cy + 1, raio - 1.2, raio - 1.6, r, { brilhoMaior: 0.05 });
    // a superfície do líquido e o reflexo no vidro
    p.linha(cx - raio + 2, cy - raio + 3.5, cx + raio - 2, cy - raio + 3.5, r, 1, 5);
    p.pixel(cx - raio + 2, cy - 2, [255, 255, 255]);
    p.pixel(cx - raio + 2, cy - 1, [235, 245, 255]);
    // o gargalo e a rolha
    p.poligono([[cx - 2, cy - raio - 3.5], [cx + 2, cy - raio - 3.5], [cx + 2, cy - raio + 1], [cx - 2, cy - raio + 1]], rampaDe(vidro), { alfa: 220 });
    p.poligono([[cx - 2.5, cy - raio - 6], [cx + 2.5, cy - raio - 6], [cx + 2, cy - raio - 3], [cx - 2, cy - raio - 3]], rampaDe("#a8703a"));
    if (grande) p.elipsoide(cx + 3, cy - 1, 1.2, 1.2, rampaDe("#ffffff"), { deslocar: 1 });
  },
  // o pergaminho enrolado, com o lacre vermelho
  pergaminho(p) {
    const papel = rampaDe("#f1dca4");
    p.poligono([[3, 4], [15, 4], [15, 15], [3, 15]], papel, { tom: 3 });
    for (let y = 6; y <= 13; y += 2) p.linha(5, y, 12 - (y % 4), y, rampaDe("#8a6a3a"), 1, 2);
    p.elipsoide(9, 3.5, 7.5, 2, rampaDe("#d9b56c"), { brilho: false });
    p.elipsoide(9, 15.5, 7.5, 2, rampaDe("#c79a4c"), { brilho: false });
    p.elipsoide(13, 13, 2.2, 2.2, rampaDe("#c8283c"));
  },
  // o pão de viagem: um pão redondo e dourado com cortes em cima
  pao(p) {
    p.elipsoide(9, 11, 8, 5.5, rampaDe("#d08a3a"), { brilhoMaior: 0.03 });
    [[5, 9], [9, 8], [13, 9]].forEach(([x, y]) => p.linha(x - 1.5, y + 1.5, x + 1.5, y - 1.5, rampaDe("#f6d58c"), 1, 4));
    p.elipsoide(9, 16, 7, 1.2, rampaDe("#8a4f1a"), { brilho: false, deslocar: -1 });
  },
  // o amuleto: corrente de ouro e a gema no meio
  amuleto(p, { cor = "#4cdf6a" }) {
    const ouro = rampaDe("#f5c451");
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * (0.05 + (i / 8) * 0.9);
      p.pixel(9 - Math.cos(a) * 7, 1 + Math.sin(a) * 4 - 0.5, ouro[i % 2 ? 4 : 2]);
    }
    p.elipsoide(9, 11.5, 5.5, 6, ouro);
    p.elipsoide(9, 11.5, 3.4, 3.8, rampaDe(cor), { brilhoMaior: 0.06 });
  },
  // gosma ou lodo: uma gota mole que escorre
  gota(p, { cor, olhos = false }) {
    const r = rampaDe(cor);
    p.elipsoide(9, 12, 7.5, 5.5, r, { ate: 16 });
    p.elipsoide(9, 6.5, 3.5, 4, r);
    p.elipsoide(15, 16, 1.4, 1.4, r);
    if (olhos) [[6.5, 11], [11.5, 11]].forEach(([x, y]) => p.elipsoide(x, y, 1, 1.4, rampaDe("#1b1533"), { brilho: false }));
  },
  // a lágrima: uma gota pontuda e lisa
  lagrima(p, { cor }) {
    const r = rampaDe(cor);
    p.poligono([[9, 1], [13, 9], [5, 9]], r, { tom: 3 });
    p.elipsoide(9, 11.5, 5, 5.5, r, { brilhoMaior: 0.05 });
  },
  // a gema lapidada: faces de luz e sombra
  gema(p, { cor }) {
    const r = rampaDe(cor);
    const pontos = [[9, 1], [16, 7], [9, 17], [2, 7]];
    p.poligono(pontos, r, { tom: 2 });
    p.poligono([[9, 1], [16, 7], [9, 7]], r, { tom: 4 });
    p.poligono([[9, 1], [9, 7], [2, 7]], r, { tom: 5 });
    p.poligono([[2, 7], [9, 7], [9, 17]], r, { tom: 3 });
    p.poligono([[9, 7], [16, 7], [9, 17]], r, { tom: 1 });
    p.pixel(6, 4, [255, 255, 255]);
  },
  // o núcleo: uma esfera que brilha por dentro
  nucleo(p, { cor }) {
    const r = rampaDe(cor);
    p.elipsoide(9, 9, 7.5, 7.5, r, { brilhoMaior: 0.04 });
    p.elipsoide(10, 10, 3.5, 3.5, rampaDe("#ffffff"), { deslocar: -0.5, alfa: 140, brilho: false });
  },
  // a coroa partida
  coroa(p, { cor = "#f5c451", gema = "#e63946" }) {
    const r = rampaDe(cor);
    p.poligono([[1, 16], [17, 16], [17, 5], [13.5, 10], [11.5, 1.5], [9, 8], [6.5, 1.5], [4.5, 10], [1, 5]], r);
    p.poligono([[1, 12], [17, 12], [17, 16], [1, 16]], r, { tom: 2 });
    p.linha(1, 12, 17, 12, r, 1, 5);
    [[1, 4.5], [6.5, 1], [11.5, 1], [17, 4.5]].forEach(([x, y]) => p.elipsoide(x, y, 1.2, 1.2, rampaDe("#fff3b0")));
    p.elipsoide(9, 14, 1.8, 1.6, rampaDe(gema));
    p.elipsoide(4.5, 14, 1.2, 1.2, rampaDe(gema));
    p.elipsoide(13.5, 14, 1.2, 1.2, rampaDe(gema));
  },
  // um tufo de pelo, em mechas curvas
  pelo(p, { cor }) {
    const r = rampaDe(cor);
    for (let i = 0; i < 6; i++) {
      const x = 4 + i * 2;
      p.poligono([[x - 2, 16], [x + 2, 16], [x + 3 + (i % 2), 3 + (i % 3) * 2], [x + 1, 6 + (i % 3) * 2]], r, { deslocar: (i % 2) * 0.6 });
    }
  },
  // uma presa ou ferrão: curva e afiada
  presa(p, { cor, base = "#c9cbe0" }) {
    const r = rampaDe(cor);
    p.poligono([[3, 3], [14, 3], [15, 7], [13, 12], [8, 17.5], [7, 12], [4, 8]], r);
    p.poligono([[3, 3], [8, 3], [7, 9], [8, 16], [6, 11], [4, 7]], r, { tom: 4 });
    p.linha(6, 5, 7.5, 13, r, 1, 5);
    p.poligono([[2, 0.5], [16, 0.5], [16, 4], [2, 4]], rampaDe(base));
    p.linha(3, 1.5, 15, 1.5, rampaDe(base), 1, 5);
  },
  // a pedra da lua: uma esfera clara com crateras
  lua(p, { cor }) {
    p.elipsoide(9, 9, 7.5, 7.5, rampaDe(cor));
    [[6, 7, 1.6], [11, 11, 1.3], [12, 5.5, 1]].forEach(([x, y, rr]) => p.elipsoide(x, y, rr, rr, rampaDe(tom(cor, 0.7)), { brilho: false }));
  },
  // a garrafa com uma chamazinha presa dentro
  garrafa(p, { cor }) {
    const vidro = rampaDe("#cfe6ff");
    p.poligono([[4, 7], [14, 7], [14, 17], [4, 17]], vidro, { alfa: 160 });
    p.poligono([[7, 3], [11, 3], [11, 7], [7, 7]], vidro, { alfa: 200 });
    p.poligono([[6.5, 1], [11.5, 1], [11, 3.5], [7, 3.5]], rampaDe("#a8703a"));
    const fogo = rampaDe(cor);
    p.poligono([[9, 8], [12, 13], [11, 16], [7, 16], [6, 13]], fogo);
    p.elipsoide(9, 14, 1.4, 1.6, rampaDe("#ffffff"), { brilho: false, deslocar: 0.5 });
  },
  // a ampulheta (a areia de bug)
  ampulheta(p, { cor = "#e8c06a" }) {
    const madeira = rampaDe("#8a5a2a");
    p.linha(3, 1, 15, 1, madeira, 2, 3);
    p.linha(3, 16, 15, 16, madeira, 2, 3);
    const vidro = rampaDe("#cfe6ff");
    p.poligono([[4, 3], [14, 3], [10, 9], [14, 15], [4, 15], [8, 9]], vidro, { alfa: 150 });
    const areia = rampaDe(cor);
    p.poligono([[6, 4], [12, 4], [9.5, 8], [8.5, 8]], areia);
    p.poligono([[9, 10], [13, 15], [5, 15]], areia);
  },
  // um osso
  osso(p, { cor = "#e8e4dc" }) {
    const r = rampaDe(cor);
    p.linha(4, 13, 13, 4, r, 3, 3);
    [[3, 12], [5, 15], [12, 2.5], [15, 5]].forEach(([x, y]) => p.elipsoide(x, y, 2.2, 2.2, r));
  },
  // a pedra de minério com veios
  minerio(p, { cor = "#5a5a70", veio = "#d8b878" }) {
    p.poligono([[2, 12], [5, 4], [11, 2], [16, 7], [15, 15], [7, 17]], rampaDe(cor));
    p.linha(5, 9, 9, 7, rampaDe(veio), 1, 4);
    p.linha(9, 13, 13, 10, rampaDe(veio), 1, 4);
    p.pixel(11, 5, hexParaRgb(veio));
  },
  // uma escama grande, com o desenho das placas
  escama(p, { cor }) {
    const r = rampaDe(cor);
    p.poligono([[9, 1], [16, 6], [15, 13], [9, 17], [3, 13], [2, 6]], r);
    p.elipsoide(9, 8, 4.5, 5, r, { dentro: true, deslocar: 0.6 });
    p.linha(9, 3, 9, 15, r, 1, 1);
  },
  // um coração (de pedra, brasa ou gelo)
  coracao(p, { cor, brilho = "#ffffff" }) {
    const r = rampaDe(cor);
    p.elipsoide(6, 7, 4.2, 4.2, r);
    p.elipsoide(12, 7, 4.2, 4.2, r);
    p.poligono([[1.8, 8], [16.2, 8], [9, 17]], r, { tom: 2 });
    p.elipsoide(9, 9, 3, 3, r, { dentro: true, deslocar: 0.4, brilho: false });
    p.pixel(5, 5, hexParaRgb(brilho));
  },
  // um caco de sombra ou de cristal
  caco(p, { cor }) {
    const r = rampaDe(cor);
    p.poligono([[8, 1], [14, 6], [12, 17], [4, 13], [3, 5]], r);
    p.poligono([[8, 1], [14, 6], [9, 8]], r, { tom: 4 });
    p.poligono([[3, 5], [9, 8], [4, 13]], r, { tom: 1 });
  },
  // o redemoinho (eco da Ruptura)
  espiral(p, { cor }) {
    p.elipsoide(9, 9, 8, 8, rampaDe(tom(cor, 0.4)), { brilho: false });
    const r = rampaDe(cor);
    for (let i = 0; i < 70; i++) {
      const a = i * 0.28;
      const raio = 0.4 + i * 0.1;
      p.pixel(9 + Math.cos(a) * raio, 9 + Math.sin(a) * raio, r[Math.min(5, 2 + Math.floor(i / 18))]);
    }
  },
  // um montinho de pó brilhante
  po(p, { cor, estrelas = "#ffffff" }) {
    p.elipsoide(9, 14, 7.5, 3.5, rampaDe(cor), { ate: 16 });
    p.elipsoide(9, 12, 4.5, 3, rampaDe(cor));
    [[4, 6], [13, 4], [9, 2], [15, 9]].forEach(([x, y]) => {
      const c = hexParaRgb(estrelas);
      p.pixel(x, y, c);
      p.pixel(x - 1, y, c, 140);
      p.pixel(x + 1, y, c, 140);
      p.pixel(x, y - 1, c, 140);
      p.pixel(x, y + 1, c, 140);
    });
  },
  // o carretel de seda
  seda(p, { cor }) {
    const madeira = rampaDe("#8a5a2a");
    p.linha(4, 2, 14, 2, madeira, 2, 3);
    p.linha(4, 15, 14, 15, madeira, 2, 3);
    p.elipsoide(9, 9, 4.5, 5.5, rampaDe(cor), { brilhoMaior: 0.05 });
    for (let y = 5; y <= 13; y += 2) p.linha(5, y, 13, y + 0.5, rampaDe(cor), 1, 5);
  },
  // o olho do vazio, ainda aberto
  olho(p, { cor }) {
    p.elipsoide(9, 9, 8, 6, rampaDe("#e8e0ff"), { brilho: false });
    p.elipsoide(9, 9, 4.5, 4.5, rampaDe(cor), { deslocar: 0.4 });
    p.elipsoide(9, 9, 1.8, 3, rampaDe("#05030f"), { brilho: false });
    p.pixel(7, 7, [255, 255, 255]);
  },
  // o cubo de gelo
  gelo(p, { cor }) {
    const r = rampaDe(cor);
    p.poligono([[9, 1], [16, 5], [9, 9], [2, 5]], r, { tom: 5 });
    p.poligono([[2, 5], [9, 9], [9, 17], [2, 13]], r, { tom: 3 });
    p.poligono([[9, 9], [16, 5], [16, 13], [9, 17]], r, { tom: 2 });
    p.pixel(5, 8, [255, 255, 255]);
  },
  // o floco de neve preso no gelo (o uivo congelado)
  floco(p, { cor }) {
    const r = rampaDe(cor);
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI) / 3;
      p.linha(9 - Math.cos(a) * 7.5, 9 - Math.sin(a) * 7.5, 9 + Math.cos(a) * 7.5, 9 + Math.sin(a) * 7.5, r, 1, 4);
    }
    p.elipsoide(9, 9, 2, 2, r);
  },
  // a asa de couro
  asa(p, { cor }) {
    const r = rampaDe(cor);
    p.poligono([[2, 4], [16, 2], [15, 9], [12, 8], [10, 13], [7, 10], [3, 15]], r);
    p.linha(2, 4, 16, 2, rampaDe(tom(cor, 1.4)), 1, 4);
    p.linha(9, 3, 7, 10, r, 1, 1);
    p.linha(13, 2.5, 12, 8, r, 1, 1);
  },
  // a moeda e a estrela de XP (os ganhos que não são item)
  moeda(p) {
    const ouro = rampaDe("#f5c451");
    p.elipsoide(9, 9, 7.5, 7.5, ouro);
    p.elipsoide(9, 9, 5, 5, ouro, { deslocar: -0.7, brilho: false });
    p.linha(9, 6, 9, 12, ouro, 1, 5);
  },
  estrela(p, { cor = "#ffd166" }) {
    const pontos = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const raio = i % 2 ? 3.6 : 8.5;
      pontos.push([9 + Math.cos(a) * raio, 9.5 + Math.sin(a) * raio]);
    }
    p.poligono(pontos, rampaDe(cor));
    p.elipsoide(9, 9.5, 2.5, 2.5, rampaDe("#fff3b0"), { brilho: false });
  },
};

// que forma e que cores cada item usa
const ARTE_DOS_ITENS = {
  // consumíveis
  pocao: ["frasco", { cor: "#6ec8ff" }],
  pergaminho: ["pergaminho", {}],
  elixir: ["frasco", { cor: "#e8283c" }],
  "pao-queijo": ["pao", {}],
  "elixir-grande": ["frasco", { cor: "#ff4d8d", grande: true }],
  amuleto: ["amuleto", { cor: "#4cdf6a" }],
  "tonico-mana": ["frasco", { cor: "#2f7bff" }],
  "elixir-arcano": ["frasco", { cor: "#9b5cff", grande: true }],
  // materiais dos Campos, da Floresta e do Pântano
  "gosma-slime": ["gota", { cor: "#5fd35f" }],
  "nucleo-slime": ["nucleo", { cor: "#3fd6e8" }],
  "coroa-gosmenta": ["coroa", { cor: "#7ddc5a", gema: "#3fd6e8" }],
  "pelo-lobo": ["pelo", { cor: "#a8acc0" }],
  "presa-nevoa": ["presa", { cor: "#e6f0ff", base: "#6a7a9a" }],
  "uivo-fenrir": ["lua", { cor: "#e8e4c8" }],
  "lodo-brejo": ["gota", { cor: "#6a7a3a" }],
  "fatuo-engarrafado": ["garrafa", { cor: "#2fd6e8" }],
  "lagrima-sapo-rei": ["lagrima", { cor: "#a8c83a" }],
  // Deserto e Montanhas
  "areia-bug": ["ampulheta", { cor: "#e8c06a" }],
  "osso-compilado": ["osso", {}],
  "ferrao-imperial": ["presa", { cor: "#f5c451", base: "#8b4513" }],
  "minerio-montanha": ["minerio", { cor: "#5a5a70", veio: "#d8b878" }],
  "escama-dragao": ["escama", { cor: "#c8283c" }],
  "coracao-ignis": ["coracao", { cor: "#ff6a28", brilho: "#fff3b0" }],
  // Umbraterra
  "sombra-partida": ["caco", { cor: "#4a3a7a" }],
  "eco-ruptura": ["espiral", { cor: "#c08bff" }],
  "coracao-sombra": ["coracao", { cor: "#3a2a5a", brilho: "#c08bff" }],
  "cinza-ardente": ["minerio", { cor: "#3a3038", veio: "#ff6a28" }],
  "escama-salamandra": ["escama", { cor: "#ff9a2a" }],
  "nucleo-magma": ["nucleo", { cor: "#ff5a1f" }],
  "po-cristal": ["po", { cor: "#9fe8ff", estrelas: "#ffffff" }],
  "seda-cristal": ["seda", { cor: "#d8f4ff" }],
  "lagrima-rainha": ["gema", { cor: "#ff9ad8" }],
  "lodo-abissal": ["gota", { cor: "#1e3a6a", olhos: true }],
  "olho-vazio": ["olho", { cor: "#9b5cff" }],
  "escama-leviata": ["escama", { cor: "#1f8a9a" }],
  "gelo-silencio": ["gelo", { cor: "#9fd4ff" }],
  "uivo-congelado": ["floco", { cor: "#cfeaff" }],
  "coracao-ymir": ["coracao", { cor: "#4fa8ff", brilho: "#e6fdff" }],
  "po-vazio": ["po", { cor: "#2b2050", estrelas: "#fff3b0" }],
  "asa-wyvern": ["asa", { cor: "#3d2c5c" }],
  "coroa-vazio": ["coroa", { cor: "#7a5ab8", gema: "#05030f" }],
  "fragmento-oraculo": ["caco", { cor: "#f5c451" }],
  // os ganhos que não são item
  "ganho-moedas": ["moeda", {}],
  "ganho-xp": ["estrela", {}],
};

// o desenho (canvas) do item, ou null se ele não tem arte própria
function canvasDoItem(id) {
  const arte = ARTE_DOS_ITENS[id];
  if (!arte) return null;
  return lembrarBestiario(`item|${id}`, () => {
    const p = pintura(18, 18);
    FORMAS_DE_ITEM[arte[0]](p, arte[1]);
    return p.pronto();
  });
}

function arteDoItem(id) {
  return ARTE_DOS_ITENS[id] ? lembrarBestiario(`item-url|${id}`, () => canvasDoItem(id).toDataURL()) : null;
}

function temArteDeItem(id) {
  return Boolean(ARTE_DOS_ITENS[id]);
}

// o <img> do ícone; sem arte, o emoji de sempre
function iconeDoItem(id, emoji = "🎁", classe = "") {
  const src = arteDoItem(id);
  return src ? `<img class="icone-item ${classe}" src="${src}" alt="" draggable="false">` : emoji;
}

// o ícone de um ganho do servidor (moedas, XP, item ou material)
function iconeDoGanho(g, classe = "") {
  if (g.icone === "🪙") return iconeDoItem("ganho-moedas", g.icone, classe);
  if (g.icone === "⭐") return iconeDoItem("ganho-xp", g.icone, classe);
  return iconeDoItem(g.material || g.item, g.icone, classe);
}
