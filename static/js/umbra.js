// Umbraterra, o Abismo da Ruptura: o segundo mapa, uma ilha flutuando no Vazio, sempre no crepúsculo.
// Só abre quando o herói chega ao último degrau da subclasse (o servidor confere em cada batalha).
// Seis regiões em volta do Refúgio da Aurora: a Fenda, os Ermos de Cinza (lagos de lava), o Bosque de
// Cristal, o Brejo do Abismo, a Geleira do Silêncio e, no alto, o Trono do Vazio, onde Nyxar voa.
// Usa o motor de mundos (mundo.js) e as peças do Reino (reino.js e cenario_hd.js): o mesmo tileset, as
// mesmas árvores (tingidas) e os mesmos monstros, com cores e números novos.

const COLUNAS_UMBRA = 200;
const LINHAS_UMBRA = 170;
// muda quando o mapa muda de forma (a posição salva do herói deixa de valer)
const VERSAO_UMBRA = 1;
const REFUGIO = [100, 138];

const REGIOES_UMBRA = {
  // cor: a névoa por cima do chão (r, g, b, opacidade) que dá o clima de cada região
  fenda: { nome: "Fenda da Ruptura", perigo: 4, nivelMinimo: 15, cor: "70, 30, 120, 0.4", visual: "campos" },
  cinzas: { nome: "Ermos de Cinza", perigo: 4, nivelMinimo: 15, cor: "40, 22, 24, 0.62", visual: "deserto" },
  cristais: { nome: "Bosque de Cristal", perigo: 4, nivelMinimo: 16, cor: "20, 70, 150, 0.38", visual: "floresta" },
  abismo: { nome: "Brejo do Abismo", perigo: 4, nivelMinimo: 17, cor: "50, 10, 80, 0.45", visual: "pantano" },
  geleira: { nome: "Geleira do Silêncio", perigo: 4, nivelMinimo: 18, cor: "60, 90, 160, 0.3", visual: "montanhas" },
  trono: { nome: "Trono do Vazio", perigo: 4, nivelMinimo: 20, cor: "30, 0, 50, 0.5", visual: "montanhas" },
};

function regiaoUmbra(x, y) {
  const r = ruidoMundo(x * 0.25 + 70, y * 0.25) * 6;
  if (Math.hypot(x - REFUGIO[0], (y - REFUGIO[1]) * 1.2) < 26) return "fenda";
  if (y < 38 + r && Math.abs(x - 100) < 34 + r) return "trono";
  if (y < 96 + r) return x < 100 + r ? "abismo" : "geleira";
  return x < 100 + r ? "cristais" : "cinzas";
}

// onde fica cada coisa: [coluna, linha]
const LUGARES_UMBRA = { "volta-reino": [100, 132], forja: [150, 104], "biblioteca-vazio": [60, 76], cidadela: [138, 34] };
// a porta de cada dungeon nova é a de uma dungeon do Reino, tingida com a cor da região
const PORTAS_UMBRA = {
  "volta-reino": { base: "fenda", filtro: "none" },
  forja: { base: "bugs", filtro: "hue-rotate(-40deg) saturate(1.6) brightness(0.85)" },
  "biblioteca-vazio": { base: "cripta", filtro: "hue-rotate(30deg) saturate(1.3) brightness(0.8)" },
  cidadela: { base: "cofre", filtro: "hue-rotate(170deg) saturate(0.8) brightness(1.15)" },
};
// "depois": o chefão só aparece quando aquele outro já caiu (o Vazio sai do Trono depois de Nyxar)
const CHEFES_UMBRA = [
  { tipoId: "colossoMagma", tx: 162, ty: 132 }, { tipoId: "rainhaCristal", tx: 40, ty: 130 },
  { tipoId: "leviata", tx: 38, ty: 50 }, { tipoId: "ymir", tx: 168, ty: 62 }, { tipoId: "nyxar", tx: 100, ty: 20 },
  { tipoId: "vazio", tx: 100, ty: 24, depois: "chefe-nyxar" },
];
const POPULACAO_UMBRA = {
  fenda: [["sombraFenda", 10]],
  cinzas: [["golemMagma", 10], ["salamandra", 12]],
  cristais: [["aranhaCristal", 12], ["sentinelaCristal", 9]],
  abismo: [["lodoAbissal", 12], ["olhoVazio", 9]],
  geleira: [["loboGlacial", 12], ["espectroGelo", 9]],
  trono: [["wyvern", 8], ["cavaleiroVazio", 8]],
};
// ruínas espalhadas: [tipo, coluna, linha (base), largura, altura, filtro]
const RUINAS_UMBRA = [
  ["coluna", 92, 132, 1, 1, "brightness(0.7) hue-rotate(220deg)"], ["coluna", 108, 132, 1, 1, "brightness(0.7) hue-rotate(220deg)"],
  ["coluna", 88, 24, 1, 1, "brightness(0.55) hue-rotate(240deg)"], ["coluna", 112, 24, 1, 1, "brightness(0.55) hue-rotate(240deg)"],
  ["coluna", 88, 14, 1, 1, "brightness(0.55) hue-rotate(240deg)"], ["coluna", 112, 14, 1, 1, "brightness(0.55) hue-rotate(240deg)"],
  ["torre", 128, 150, 2, 2, "brightness(0.6) sepia(0.6) hue-rotate(-30deg)"], ["torre", 70, 104, 2, 2, "brightness(0.55) hue-rotate(200deg)"],
  ["lampiao", 96, 141, 1, 1, "hue-rotate(220deg)"], ["lampiao", 104, 141, 1, 1, "hue-rotate(220deg)"],
];
// Lyra, a sentinela que assinava as cartas "L." nos fragmentos da história
const LYRA = {
  id: "lyra", nome: "Lyra, a Sentinela", tx: 106, ty: 140,
  visual: { corpo: "feminino", pele: "#c98d63", cabelo: "longo", corCabelo: "#e8e4dc", rosto: "serio", chapeu: "capuz", manto: "#3d1d63", detalhe: "#ff4d6d", item: "arco", magia: "#c08bff", acessorio: "nenhum" },
  falas: [
    "Então tu és o **último título** da Academia. Eu sou Lyra, a que escrevia as cartas. Bem-vindo a Umbraterra.",
    "Nyxar voa sobre o **Trono do Vazio**, ao norte. Vence os quatro guardiões antes: o Colosso, a Rainha, o Leviatã e Ymir.",
    "Aqui nada perdoa resposta decorada. Cada erro dói **o triplo**. Volta pela Fenda se a vida apertar.",
  ],
};
// o Eco de Malakar: o que sobrou da parte do velho mestre que ainda pensa, uma sombra translúcida no Brejo
const ECO_MALAKAR = {
  id: "eco-malakar", nome: "Eco de Malakar", tx: 74, ty: 66, translucido: true,
  visual: { pele: "#c9b8d8", cabelo: "longo", corCabelo: "#e8e4dc", rosto: "serio", chapeu: "capuz", manto: "#2b1d40", detalhe: "#a98bff", item: "cajado", magia: "#a98bff", acessorio: "barba", familiar: "nenhum" },
  falas: [
    "Eu fui Malakar. Quis que ninguém mais precisasse estudar... e dei de comer ao Vazio. **Não cometa o meu erro.**",
    "O Vazio não é forte. Ele é **cômodo**. Oferece a resposta pronta para quem tem preguiça de perguntar.",
    "Minha filha guardou a Fenda por trezentos anos. Ela acha que pode me salvar. **Talvez possa. Talvez não deva.**",
  ],
};
// As falas da Lyra e do Eco mudam conforme a história anda (quests concluídas) e as escolhas do herói.
const historiaFeita = (id) => (progresso.quests?.concluidas || []).includes(id);
const escolhaDoHeroi = (id) => (progresso.escolhas || {})[id];
LYRA.falasAgora = () => {
  if (historiaFeita("h-vazio")) {
    return progresso.finalDoJogo === "libertar"
      ? ["Meu pai voltou a dar aulas. Ele ainda erra o caminho para a sala... e ri disso. Obrigada, herói.", "Toda noite eu olho as estrelas com ele de novo. Como antes do Oráculo."]
      : ["Eu acendo a lanterna toda noite. Às vezes, acho que o Selo brilha de volta.", "Tu fizeste o que eu não teria coragem de fazer. Elyndor está segura."];
  }
  if (historiaFeita("h-eco")) {
    return escolhaDoHeroi("perdao") === "perdoar"
      ? ["Tu me perdoaste. Eu ainda não me perdoei, mas vou chegar lá.", "Quando tudo isso acabar, quero te mostrar as estrelas que meu pai me ensinou a ler."]
      : ["Tu querias a verdade inteira. Eu te devo isso. Pergunta o que quiser.", "Não espero que tu confies em mim. Só que me deixes lutar ao teu lado."];
  }
  if (escolhaDoHeroi("confianca") === "desconfiar") {
    return ["Tu mostraste minha carta ao Ulf. Eu entendo... ninguém confia numa voz que só assina \"L.\".", "Eu vou provar que estou do teu lado. Uma batalha de cada vez."];
  }
  if (escolhaDoHeroi("confianca") === "confiar") {
    return ["Tu vieste sozinho, como eu pedi. Obrigada por confiar... mesmo sem saber em quem.", "Tem coisas que eu ainda não posso te contar. Ainda."];
  }
  return [];
};
ECO_MALAKAR.falasAgora = () => {
  if (historiaFeita("h-vazio")) return ["Tu terminaste o que eu comecei errado. O Abismo está em paz. E eu também."];
  if (historiaFeita("h-leviata")) return ["Agora eu lembro de tudo. O Oráculo, a fome, o Vazio vestindo meu rosto. Derruba Nyxar: ele era meu amigo antes de ser dele.", "Se a minha filha pedir para tu me salvares... pensa bem. Eu não sei se mereço."];
  return [];
};

// os moradores de Umbraterra (as quests da história olham para cá)
const HABITANTES_UMBRA = [LYRA, ECO_MALAKAR];

const PLACA_UMBRA = {
  id: "placa-umbra", tx: 94, ty: 140,
  texto: "🌀 **Refúgio da Aurora** · o último lugar seguro.\n\n⬆ **Norte:** Trono do Vazio (Nv. 20)\n↖ Brejo do Abismo (Nv. 17) · ↗ Geleira do Silêncio (Nv. 18)\n↙ Bosque de Cristal (Nv. 16) · ↘ Ermos de Cinza (Nv. 15)",
};

// Os monstros de Umbraterra: os mesmos desenhos do Reino, tingidos e maiores, e alguns com quadros novos.
function tingir(canvas, filtro) {
  const { canvas: novo, ctx } = criarTela(canvas.width, canvas.height);
  ctx.filter = filtro;
  ctx.drawImage(canvas, 0, 0);
  if (canvas.res) novo.res = canvas.res;
  return novo;
}

Object.assign(TIPOS_MONSTRO, {
  sombraFenda: { agressivo: true, velocidade: 34, voa: true, translucido: true, sprite: () => tingir(spriteAssombracao(), "hue-rotate(200deg) brightness(0.7) saturate(1.6)") },
  golemMagma: { agressivo: true, velocidade: 22, brilho: "255, 120, 40", sprite: () => ampliarSprite(tingir(spriteEsqueleto(), "sepia(1) hue-rotate(-30deg) saturate(4) brightness(0.9)"), 1.25) },
  salamandra: { agressivo: true, velocidade: 40, brilho: "255, 90, 30", sprite: () => spriteSapo("#ff5a1f", "#ffd166") },
  aranhaCristal: { agressivo: true, velocidade: 42, brilho: "110, 240, 255", sprite: () => spriteEscorpiao("#6ef0ff", "#2f7fbf", "#e8f6ff") },
  sentinelaCristal: { velocidade: 24, brilho: "110, 200, 255", sprite: () => ampliarSprite(tingir(spriteEsqueleto(), "hue-rotate(160deg) saturate(2.5) brightness(1.2)"), 1.2) },
  lodoAbissal: { agressivo: true, velocidade: 30, sprite: () => ampliarSprite(spriteSlime("#3d1d63"), 1.3) },
  olhoVazio: { agressivo: true, velocidade: 46, voa: true, brilho: "190, 120, 255", sprite: () => ampliarSprite(tingir(spriteFogoFatuo(), "hue-rotate(110deg) saturate(1.8)"), 1.3) },
  loboGlacial: { agressivo: true, velocidade: 48, sprite: () => spriteLobo("#bfe6ff", "#6ef0ff"), quadros: () => quadrosLobo("#bfe6ff", "#6ef0ff") },
  espectroGelo: { agressivo: true, velocidade: 30, voa: true, translucido: true, sprite: () => tingir(spriteAssombracao(), "hue-rotate(150deg) brightness(1.3)") },
  wyvern: { agressivo: true, velocidade: 40, voa: true, sprite: () => quadrosDragao("#3d1d63", { escala: 0.9, barriga: "#a98bff" })[0], quadros: () => quadrosDragao("#3d1d63", { escala: 0.9, barriga: "#a98bff" }) },
  cavaleiroVazio: { agressivo: true, velocidade: 36, brilho: "170, 90, 255", sprite: () => ampliarSprite(tingir(spriteEsqueleto(), "hue-rotate(230deg) saturate(2) brightness(0.55)"), 1.3) },
  // os guardiões e o dragão do fim
  colossoMagma: { brilho: "255, 110, 30", sprite: () => ampliarSprite(comCoroa(tingir(spriteEsqueleto(), "sepia(1) hue-rotate(-30deg) saturate(4) brightness(0.9)"), 14), 3) },
  rainhaCristal: { brilho: "110, 240, 255", sprite: () => ampliarSprite(comCoroa(spriteEscorpiao("#6ef0ff", "#2f7fbf", "#ffffff"), 21, 0, 10), 3.25) },
  leviata: { sprite: () => ampliarSprite(comCoroa(spriteSapo("#3d1d63", "#a98bff"), 11, 3), 3.9) },
  ymir: { sprite: () => ampliarSprite(comCoroa(spriteLobo("#e8f6ff", "#6ef0ff"), 25), 3.2) },
  // o Vazio veste o corpo de Malakar: gigante, escuro, com olhos roxos e a aura que engole a luz
  vazio: { translucido: true, brilho: "150, 60, 255", sprite: () => ampliarSprite(tingir(heroiParado(VISUAL_MALAKAR), "brightness(0.35) saturate(2.5) hue-rotate(230deg) drop-shadow(0 0 2px #c08bff)"), 3.6) },
  nyxar: { voa: true, voaAlto: true, sprite: () => quadrosDragao("#2b1150", { escala: 2.8, barriga: "#a98bff", coroa: true })[0], quadros: () => quadrosDragao("#2b1150", { escala: 2.8, barriga: "#a98bff", coroa: true }) },
});
// os de Umbraterra que vêm do bestiário (bestiario.js), nas cores de cada região (antes eram os do Reino
// tingidos por filtro), com os quadros vivos; os guardiões, grandes de verdade e coroados
Object.entries({
  sombraFenda: () => assombracaoArte("#7a5ac8"),
  espectroGelo: () => assombracaoArte("#bfe9ff"),
  golemMagma: () => esqueletoArte({ escala: 1.2, osso: "#c0602a", olho: "#ffd166" }),
  sentinelaCristal: () => esqueletoArte({ escala: 1.15, osso: "#9fe6ff", olho: "#ffffff" }),
  cavaleiroVazio: () => esqueletoArte({ escala: 1.25, osso: "#5a4a8a", olho: "#d07bff" }),
  salamandra: () => sapoArte("#ff5a1f", "#ffd166"),
  aranhaCristal: () => escorpiaoArte("#6ef0ff", "#2f7fbf", "#e8f6ff"),
  lodoAbissal: () => slimeArte("#3d1d63", { escala: 1.2 }),
  olhoVazio: () => fogoFatuoArte("#b07cff", { escala: 1.2 }),
  colossoMagma: () => esqueletoArte({ escala: 2.4, coroa: true, osso: "#c0602a", olho: "#ffd166" }),
  rainhaCristal: () => escorpiaoArte("#6ef0ff", "#2f7fbf", "#ffffff", { escala: 2.4, coroa: true }),
  leviata: () => sapoArte("#3d1d63", "#a98bff", { escala: 2.8, coroa: true }),
}).forEach(([id, arte]) => Object.assign(TIPOS_MONSTRO[id], { sprite: () => arte()[0], quadros: arte, vivo: true }));

// ---------- geração ----------

function chaoUmbra(regiao, x, y) {
  const n1 = ruidoMundo(x * 0.5 + 300, y * 0.5);
  const n2 = ruidoMundo(x * 0.35 + 500, y * 0.35 + 200);
  switch (regiao) {
    case "fenda": return n1 > 0.4 ? T.LAMA : T.GRAMA;
    case "cinzas": return n2 > 0.52 ? T.AGUA : n1 > 0.35 ? T.ROCHA : T.AREIA;
    case "cristais": return n2 > 0.62 ? T.AGUA : T.MATA;
    case "abismo": return n1 > 0.25 ? T.AGUA : T.LAMA;
    case "geleira": return n1 > 0.3 ? T.ROCHA : T.NEVE;
    default: return Math.hypot(x - 100, (y - 18) * 1.3) < 12 ? T.PEDRA : n1 > 0.15 ? T.ROCHA : T.NEVE;
  }
}

let umbraGerada = null;

function gerarUmbra() {
  const C = COLUNAS_UMBRA;
  const L = LINHAS_UMBRA;
  const mapa = Array.from({ length: L }, () => new Array(C).fill(T.AGUA));
  const vazio = Array.from({ length: L }, () => new Uint8Array(C).fill(1)); // fora da ilha: o Vazio
  const regioes = Array.from({ length: L }, (_, y) => Array.from({ length: C }, (_, x) => regiaoUmbra(x, y)));
  for (let y = 0; y < L; y++) {
    for (let x = 0; x < C; x++) {
      const nx = (x - C / 2) / (C / 2 - 5);
      const ny = (y - L / 2) / (L / 2 - 5);
      const d = Math.pow(nx ** 4 + ny ** 4, 0.25) + ruidoMundo(x * 0.4 + 11, y * 0.4) * 0.07;
      if (d >= 1) continue;
      vazio[y][x] = 0;
      // a beira da ilha é penhasco de rocha (abaixo, só o Vazio)
      mapa[y][x] = d > 0.95 ? T.ROCHA : chaoUmbra(regioes[y][x], x, y);
    }
  }
  // clareiras em volta de lugares, chefões, moradores e ruínas
  const limpar = (cx, cy, rx, ry, chao = null) => {
    for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
      if (mapa[y]?.[x] === undefined || vazio[y][x]) continue;
      if ([T.AGUA, T.ROCHA].includes(mapa[y][x]) || chao !== null) mapa[y][x] = chao ?? ({ cinzas: T.AREIA, cristais: T.MATA, abismo: T.LAMA, geleira: T.NEVE, trono: T.PEDRA }[regioes[y][x]] ?? T.GRAMA);
    }
  };
  // o Refúgio: uma praça de pedra em volta do portal de volta
  for (let y = REFUGIO[1] - 8; y <= REFUGIO[1] + 6; y++) for (let x = REFUGIO[0] - 12; x <= REFUGIO[0] + 12; x++) {
    if (Math.hypot(x - REFUGIO[0], (y - REFUGIO[1]) * 1.4) < 12) mapa[y][x] = T.PEDRA;
  }
  Object.values(LUGARES_UMBRA).forEach(([cx, cy]) => limpar(cx, cy, 4, 3));
  CHEFES_UMBRA.forEach(({ tx, ty }) => limpar(tx, ty - 2, 7, 6));
  HABITANTES_UMBRA.forEach((h) => limpar(h.tx, h.ty, 2, 2));
  limpar(PLACA_UMBRA.tx, PLACA_UMBRA.ty, 1, 1);
  RUINAS_UMBRA.forEach(([, cx, cy, w, h]) => limpar(cx, cy - h, Math.ceil(w * ESCALA_CENARIO / 2) + 1, Math.ceil(h * ESCALA_CENARIO / 2) + 1));

  const ocupado = new Set();
  RUINAS_UMBRA.forEach(([, cx, cy, w, h]) => tilesDaBase(centroConstrucao(cx, w), cy, w * TILE, h * ESCALA_CENARIO).forEach((t) => ocupado.add(t)));
  Object.entries(LUGARES_UMBRA).forEach(([id, [cx, cy]]) => tilesDaBase(cx * TILE + 8, cy, TAMANHO_LUGARES[PORTAS_UMBRA[id].base][0], 3).forEach((t) => ocupado.add(t)));
  HABITANTES_UMBRA.forEach((h) => ocupado.add(`${h.tx},${h.ty}`));
  ocupado.add(`${PLACA_UMBRA.tx},${PLACA_UMBRA.ty}`);

  // as trilhas saem do Refúgio até cada lugar e cada covil (lava e brejo viram ponte)
  const custo = (t, x, y) => {
    if (ocupado.has(`${x},${y}`) || vazio[y][x]) return undefined;
    return { [T.CAMINHO]: 0.4, [T.PONTE]: 0.4, [T.PEDRA]: 0.4, [T.GRAMA]: 1, [T.MATA]: 1.3, [T.AREIA]: 1.3, [T.NEVE]: 1.4, [T.LAMA]: 1.6, [T.ROCHA]: 30, [T.AGUA]: 18 }[t];
  };
  const destinos = [
    ...Object.values(LUGARES_UMBRA).map(([cx, cy]) => [cx, cy + 1]),
    ...CHEFES_UMBRA.map(({ tx, ty }) => [tx, ty + 5]),
    ...HABITANTES_UMBRA.map((h) => [h.tx, h.ty + 1]),
  ];
  const veio = arvoreDeCaminhos(mapa, [REFUGIO[0], REFUGIO[1] + 3], custo, new Set(destinos.map(([x, y]) => y * C + x)));
  destinos.forEach(([dx, dy]) => {
    for (let k = dy * C + dx; k !== -1; k = veio[k]) {
      const x = k % C;
      const y = (k - x) / C;
      if ([T.PEDRA, T.PONTE, T.CAMINHO].includes(mapa[y][x])) continue;
      mapa[y][x] = mapa[y][x] === T.AGUA ? T.PONTE : T.CAMINHO;
    }
  });

  // a vegetação de cada região (árvores mortas, cristais, pinheiros de gelo), com espaço entre as grandes
  const decoracao = [];
  const grandes = new Set();
  const GRANDES = new Set(["morta", "escura", "pinheiroNeve", "cristal", "redonda"]);
  const naEstrada = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => [T.CAMINHO, T.PONTE, T.PEDRA].includes(mapa[y + dy]?.[x + dx]));
  const pertoDeAlgo = (x, y) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (ocupado.has(`${x + dx},${y + dy}`)) return true;
    return false;
  };
  for (let y = 1; y < L - 1; y++) {
    for (let x = 1; x < C - 1; x++) {
      const t = mapa[y][x];
      if (![T.GRAMA, T.MATA, T.LAMA, T.AREIA, T.NEVE].includes(t) || naEstrada(x, y) || pertoDeAlgo(x, y)) continue;
      if (CHEFES_UMBRA.some((c) => Math.abs(x - c.tx) <= 7 && y >= c.ty - 7 && y <= c.ty + 3)) continue;
      if (Math.hypot(x - REFUGIO[0], (y - REFUGIO[1]) * 1.4) < 14) continue;
      const h = hashTile(x, y, 31);
      const h2 = hashTile(x, y, 37);
      const tipo = {
        fenda: h > 0.9 ? "morta" : h > 0.86 ? "osso" : h > 0.84 ? "rocha" : null,
        cinzas: h > 0.93 ? "morta" : h > 0.9 ? "rocha" : h > 0.88 ? "osso" : null,
        cristais: h > 0.6 ? (h2 > 0.55 ? "cristal" : "escura") : h > 0.5 ? "cogumelo" : h > 0.46 ? "arbusto" : null,
        abismo: h > 0.85 ? "morta" : h > 0.74 ? "junco" : h > 0.7 ? "cogumelo" : null,
        geleira: h > 0.84 ? "pinheiroNeve" : h > 0.8 ? "rochaNeve" : null,
        trono: h > 0.95 ? "rochaNeve" : h > 0.93 ? "osso" : null,
      }[regioes[y][x]];
      if (!tipo) continue;
      if (GRANDES.has(tipo)) {
        if ([[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-2, 0], [0, -2]].some(([dx, dy]) => grandes.has(`${x + dx},${y + dy}`))) continue;
        grandes.add(`${x},${y}`);
      }
      decoracao.push({ x, y, tipo, regiao: regioes[y][x] });
    }
  }
  return { mapa, vazio, regioes, decoracao };
}

// o cristal do Bosque: lascas azuis com brilho, no tamanho de uma árvore pequena
function spriteCristal() {
  return desenhar(14, 22, (ctx) => {
    const lasca = (x, topo, base, w, cor, claro) => {
      for (let y = topo; y <= base; y++) {
        const meia = Math.max(0, Math.round(((y - topo) / (base - topo)) * w));
        retangulo(ctx, x - meia, y, meia * 2 + 1, 1, cor);
        if (meia > 0) retangulo(ctx, x - meia, y, 1, 1, claro);
      }
    };
    lasca(4, 8, 21, 2, "#2f7fbf", "#a8e6ff");
    lasca(10, 6, 21, 2, "#2f7fbf", "#a8e6ff");
    lasca(7, 0, 21, 3, "#4fc3ff", "#e8f6ff");
    retangulo(ctx, 7, 3, 1, 6, "#ffffff");
    retangulo(ctx, 1, 20, 12, 2, "#1d4f80");
  });
}

// o filtro de cor das árvores e pedras de cada região (o mesmo desenho do Reino, outro clima)
const FILTRO_DECORACAO_UMBRA = {
  fenda: "hue-rotate(230deg) saturate(0.7) brightness(0.7)",
  cinzas: "grayscale(0.7) sepia(0.5) brightness(0.45) contrast(1.2)",
  cristais: "hue-rotate(150deg) saturate(1.4) brightness(0.9)",
  abismo: "hue-rotate(220deg) saturate(1.2) brightness(0.6)",
  geleira: "hue-rotate(10deg) saturate(0.6) brightness(1.05)",
  trono: "hue-rotate(240deg) brightness(0.55)",
};

function prepararUmbra() {
  if (umbraGerada) return umbraGerada;
  const mundo = gerarUmbra();
  const regiaoVisual = (x, y) => REGIOES_UMBRA[mundo.regioes[y]?.[x]]?.visual || "campos";
  const tileset = tilesetHD();
  const indice = Object.fromEntries(tileset.nomes.map((nome, i) => [nome, i]));
  const desenharChao = criarDesenhoDoChao(tileset, camadasDoChao(mundo.mapa, indice, regiaoVisual));
  const spriteDecoracao = (tipo, regiao) => spriteHD(`umbra-${tipo}-${regiao}`, () => {
    const base = tipo === "cristal" ? ampliadoHD(spriteCristal(), 91, 0.05) : decoracaoHD(tipo);
    return tipo === "cristal" ? base : tingir(base, FILTRO_DECORACAO_UMBRA[regiao]);
  });
  // a decoração pintada (arvores_arte.js), na cor de cada região; 3 variações sorteadas pela posição
  const pintadaUmbra = (a) => {
    if (typeof arvorePintada !== "function" || !ARVORES_PINTADAS.has(a.tipo)) return null;
    const v = Math.floor(hashTile(a.x, a.y, 9) * 3);
    return lembrarBestiario(`umbra|${a.tipo}|${a.regiao}|${v}`, () => {
      const base = arvorePintada(a.tipo, v);
      if (a.tipo === "cristal") return base;
      const tingida = tingir(base, FILTRO_DECORACAO_UMBRA[a.regiao]);
      tingida.acabado = true;
      tingida.folhas = [];
      return tingida;
    });
  };
  const props = mundo.decoracao.map((a) => ({
    x: a.x * TILE + 8, y: a.y * TILE + 16, sprite: pintadaUmbra(a) || spriteDecoracao(a.tipo, a.regiao),
    // em Umbraterra o que cai das árvores são cinzas e faíscas do vazio
    folhas: ["#a98bff", "#6a4fc0", "#3a3048"],
    balanco: !DECORACAO_SEM_COLISAO.has(a.tipo) && !a.tipo.startsWith("rocha") && a.tipo !== "cristal",
    tilesBloqueados: DECORACAO_SEM_COLISAO.has(a.tipo) ? [] : [`${a.x},${a.y}`],
    vazado: !DECORACAO_SEM_COLISAO.has(a.tipo) && !a.tipo.startsWith("rocha"),
  }));
  RUINAS_UMBRA.forEach(([tipo, cx, cy, w, h, filtro], i) => {
    const sprite = spriteHD(`umbra-ruina-${tipo}-${i}`, () => tingir(ampliadoHD(SPRITES_CONSTRUCAO[tipo](tipo === "lampiao" ? "#c08bff" : undefined), 40 + i), filtro));
    const centro = centroConstrucao(cx, w);
    const prop = { x: centro, y: (cy + 1) * TILE, sprite, tilesBloqueados: tilesDaBase(centro, cy, w * TILE, h * ESCALA_CENARIO), vazado: true };
    if (tipo === "lampiao" && typeof postePintado === "function") {
      // o poste pintado, com a chama roxa do vazio
      prop.sprite = postePintado(32, 104, "#c08bff");
      prop.animar = (c, x, y, t) => animarPostePintado(c, x, y, t, prop.sprite, cx);
    } else if (tipo === "lampiao") {
      prop.animar = animarAmpliado((c, x, y, t) => {
        c.fillStyle = `rgba(200, 150, 255, ${0.3 + Math.sin(t * 7 + cx) * 0.15})`;
        c.fillRect(x + 2, y + 2, 4, 5);
      });
    }
    props.push(prop);
  });
  umbraGerada = { ...mundo, desenharChao, props };
  return umbraGerada;
}

// O mapinha de Umbraterra (1 pixel por tile), com as cores de cada região e o Vazio em volta.
function miniMapaUmbra() {
  return spriteReino("minimapa-umbra", () => {
    const { mapa, vazio, regioes } = prepararUmbra();
    const { canvas, ctx } = criarTela(COLUNAS_UMBRA, LINHAS_UMBRA);
    const cores = { fenda: "#5b3f7a", cinzas: "#5a3a2a", cristais: "#2c5f7a", abismo: "#3a2450", geleira: "#a9c4dc", trono: "#2b2033" };
    for (let y = 0; y < LINHAS_UMBRA; y++) for (let x = 0; x < COLUNAS_UMBRA; x++) {
      let cor = vazio[y][x] ? "#0b0818" : cores[regioes[y][x]];
      const t = mapa[y][x];
      if (!vazio[y][x] && t === T.AGUA) cor = regioes[y][x] === "cinzas" ? "#e2531f" : regioes[y][x] === "cristais" ? "#4fc3ff" : "#1a0b2e";
      if (t === T.ROCHA && !vazio[y][x]) cor = "#3a3346";
      if ([T.CAMINHO, T.PONTE, T.PEDRA].includes(t)) cor = "#8a7f9a";
      retangulo(ctx, x, y, 1, 1, cor);
    }
    return canvas;
  });
}

const estadoUmbra = { monstros: null };

function cenarioUmbra(dadosLugares, combate = {}, regioesServidor = {}, nivelHeroi = 1) {
  const { mapa, vazio, regioes, desenharChao, props } = prepararUmbra();
  Object.entries(regioesServidor).forEach(([id, r]) => REGIOES_UMBRA[id] && Object.assign(REGIOES_UMBRA[id], r));
  const liberadaUmbra = (id) => nivelHeroi >= (REGIOES_UMBRA[id].nivelMinimo || 1);
  const trancada = (tx, ty) => {
    const id = regioes[ty]?.[tx];
    return id && !liberadaUmbra(id) ? REGIOES_UMBRA[id] : null;
  };

  const lugares = dadosLugares.map((l) => {
    const [cx, cy] = LUGARES_UMBRA[l.id];
    const { base: baseId, filtro } = PORTAS_UMBRA[l.id];
    const [w] = TAMANHO_LUGARES[baseId];
    const base = spriteReino(`lugar-umbra-${l.id}`, () => tingir(spriteLugar(baseId), filtro));
    const lugar = {
      ...l, sprite: spriteHD(`lugar-umbra-${l.id}`, () => ampliadoHD(base, l.id.length * 29, 0.05)),
      px: cx * TILE + 8, py: (cy + 1) * TILE,
      entrada: { x: cx * TILE + 8, y: (cy + 1) * TILE + 8 }, tilesBloqueados: tilesDaBase(cx * TILE + 8, cy, w, 3),
      sobrepoe: l.tipo === "dungeon", semTransicao: true,
    };
    lugar.animar = animarAmpliado((ctx, x, y, t) => animarLugarReino(ctx, { ...lugar, id: baseId, sprite: base }, x, y, t));
    return lugar;
  });
  // Lyra e o Eco: quem tem quest da história mostra o "!" (ou o "?" para entregar); o Eco é translúcido
  HABITANTES_UMBRA.forEach((h) => {
    const corpo = heroiParado(h.visual);
    const sprite = h.translucido ? tingir(corpo, "opacity(0.6) drop-shadow(0 0 3px #a98bff)") : corpo;
    lugares.push({
      id: `npc-${h.id}`, habitante: h, nome: h.nome, icone: "💬", acao: "Falar", sprite, sobrepoe: true, semRotulo: true,
      visual: h.visual, passeia: h.translucido ? 0 : 6,
      px: h.tx * TILE + 8, py: (h.ty + 1) * TILE, entrada: { x: h.tx * TILE + 8, y: (h.ty + 1) * TILE + 8 }, tilesBloqueados: [`${h.tx},${h.ty}`],
      animar: (ctx, x, y, t) => {
        const quest = typeof estadoQuestNpc === "function" ? estadoQuestNpc(h.id) : null;
        if (quest) desenharMarcadorQuest(ctx, x + corpo.width / RESOLUCAO_REINO / 2, y - 4, t, quest);
        else animarBalaoFala(ctx, x, y, t, corpo.width / RESOLUCAO_REINO);
      },
    });
  });
  lugares.push({
    id: PLACA_UMBRA.id, placa: PLACA_UMBRA, nome: "Placa", icone: "🪧", acao: "Ler", sobrepoe: true, semRotulo: true,
    sprite: spriteHD("umbra-placa", () => tingir(dobradoHD(SPRITES_PONTOS.placa(), 11), "hue-rotate(220deg) brightness(0.8)")),
    px: PLACA_UMBRA.tx * TILE + 8, py: (PLACA_UMBRA.ty + 1) * TILE, entrada: { x: PLACA_UMBRA.tx * TILE + 8, y: (PLACA_UMBRA.ty + 1) * TILE + 8 },
    tilesBloqueados: [`${PLACA_UMBRA.tx},${PLACA_UMBRA.ty}`],
  });

  const andavel = (tx, ty) => {
    const t = mapa[ty]?.[tx];
    return t !== undefined && t !== T.AGUA && t !== T.ROCHA;
  };
  if (!estadoUmbra.monstros) {
    estadoUmbra.monstros = [];
    const forma = (tipoId) => {
      const { noite, sprite: criar, quadros, ...resto } = TIPOS_MONSTRO[tipoId];
      return {
        tipoId, agressivo: false, voa: false, translucido: false, brilho: null, ...resto, ...combate[tipoId],
        sprite: spriteReino(`monstro-${tipoId}`, criar), quadros: quadros ? spriteReino(`quadros-${tipoId}`, quadros) : null,
      };
    };
    let n = 0;
    Object.entries(POPULACAO_UMBRA).forEach(([regiao, lista]) => lista.forEach(([tipoId, quantos]) => {
      if (!combate[tipoId]) return;
      const tipo = forma(tipoId);
      let colocados = 0;
      for (let tentativa = 0; colocados < quantos && tentativa < 5000; tentativa++) {
        const tx = 3 + Math.floor(hashTile(tentativa, n, 19) * (COLUNAS_UMBRA - 6));
        const ty = 3 + Math.floor(hashTile(n, tentativa, 23) * (LINHAS_UMBRA - 6));
        if (regioes[ty][tx] !== regiao || !andavel(tx, ty) || [T.CAMINHO, T.PONTE, T.PEDRA].includes(mapa[ty][tx])) continue;
        if (Math.hypot(tx - REFUGIO[0], ty - REFUGIO[1]) < 16) continue;
        const id = `umbra-${tipoId}-${n}`;
        estadoUmbra.monstros.push({
          id, ...tipo, regiao, casa: [tx, ty], x: tx * TILE + 8, y: ty * TILE + 12, alvo: null, espera: 0,
          derrotado: () => {
            const quando = estadoMundo.derrotados[id];
            if (quando && Date.now() - quando > 120000) delete estadoMundo.derrotados[id];
            return Boolean(estadoMundo.derrotados[id]);
          },
        });
        colocados++;
        n++;
      }
    }));
    CHEFES_UMBRA.forEach(({ tipoId, tx, ty, depois }) => {
      if (!combate[tipoId]) return;
      const tipo = forma(tipoId);
      const id = `chefe-${tipoId}`;
      const vencidos = () => progresso.chefesDerrotados || [];
      estadoUmbra.monstros.push({
        id, ...tipo, regiao: regioes[ty][tx], parado: !tipo.voaAlto, casa: [tx, ty], x: tx * TILE + 8, y: ty * TILE + 12, alvo: null, espera: 0,
        // quem espera outro chefão cair fica escondido (como derrotado) até lá
        derrotado: () => vencidos().includes(id) || Boolean(depois && !vencidos().includes(depois)),
      });
    });
  }
  estadoUmbra.monstros.forEach((m) => { m.trancado = !liberadaUmbra(m.regiao); });

  // brasas e cinzas no ar (o mesmo céu para todo mundo: posições calculadas pelo tempo)
  const desenharCinzas = (ctx, w, h, t) => {
    for (let i = 0; i < 46; i++) {
      const ciclo = (t * (0.04 + hashTile(i, 3) * 0.05) + hashTile(i, 7)) % 1;
      const x = (hashTile(i, 11) * w + Math.sin(t * 0.7 + i) * 12) % w;
      const y = h - ciclo * (h + 20);
      ctx.fillStyle = i % 4 ? `rgba(200, 160, 255, ${0.25 + 0.25 * Math.sin(t * 3 + i)})` : `rgba(255, 140, 60, ${0.5 * (1 - ciclo)})`;
      ctx.fillRect(Math.round(x), Math.round(y), i % 5 ? 1 : 2, i % 5 ? 1 : 2);
    }
  };

  // a barreira das regiões trancadas que aparecem
  function desenharBarreirasUmbra(ctx, camera, w, h, t) {
    const x0 = Math.floor(camera.x / TILE);
    const y0 = Math.floor(camera.y / TILE);
    for (let ty = Math.max(0, y0); ty <= Math.min(LINHAS_UMBRA - 1, y0 + Math.ceil(h / TILE)); ty++) {
      for (let tx = Math.max(0, x0); tx <= Math.min(COLUNAS_UMBRA - 1, x0 + Math.ceil(w / TILE)); tx++) {
        if (trancada(tx, ty) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => regioes[ty + dy]?.[tx + dx] && !trancada(tx + dx, ty + dy))) {
          desenharBarreira(ctx, tx * TILE - camera.x, ty * TILE - camera.y, t, hashTile(tx, ty));
        }
      }
    }
  }

  const [sx, sy] = LUGARES_UMBRA["volta-reino"];
  return {
    colunas: COLUNAS_UMBRA, linhas: LINHAS_UMBRA, desenharChao, props, lugares, monstros: estadoUmbra.monstros, corFundo: "#0b0818",
    resolucao: RESOLUCAO_REINO,
    andavel,
    barreira: trancada,
    spawn: { x: sx * TILE + 8, y: (sy + 2) * TILE + 8 },
    teleporte: { x: sx * TILE + 8, y: (sy + 2) * TILE + 8 },
    noite: () => true,
    ambiente: (x, y) => regioes[Math.floor(y / TILE)]?.[Math.floor(x / TILE)] || "fenda",
    chaoDoPasso: (tx, ty) => CHAO_DO_PASSO[mapa[ty]?.[tx]] || "pedra",
    // o Vazio, a lava, o brejo escuro e a névoa colorida de cada região, por cima do chão
    animarChao(ctx, camera, w, h, t) {
      const x0 = Math.max(0, Math.floor(camera.x / TILE));
      const y0 = Math.max(0, Math.floor(camera.y / TILE));
      const x1 = Math.min(COLUNAS_UMBRA - 1, x0 + Math.ceil(w / TILE) + 1);
      const y1 = Math.min(LINHAS_UMBRA - 1, y0 + Math.ceil(h / TILE) + 1);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const px = tx * TILE - camera.x;
          const py = ty * TILE - camera.y;
          const regiao = regioes[ty][tx];
          if (vazio[ty][tx]) {
            // o Vazio: quase preto, com estrelinhas roxas piscando lá embaixo
            ctx.fillStyle = "rgba(11, 8, 24, 0.94)";
            ctx.fillRect(px, py, TILE, TILE);
            const h0 = hashTile(tx, ty, 3);
            if (h0 > 0.93) {
              ctx.fillStyle = `rgba(190, 150, 255, ${0.3 + 0.4 * Math.sin(t * 2 + h0 * 40)})`;
              ctx.fillRect(px + Math.floor(h0 * 13), py + Math.floor(hashTile(tx, ty, 4) * 13), 1, 1);
            }
            continue;
          }
          if (mapa[ty][tx] === T.AGUA) {
            if (regiao === "cinzas") {
              // lava: laranja que pulsa, com bolhas amarelas
              ctx.fillStyle = `rgba(226, ${70 + Math.round(25 * Math.sin(t * 2 + tx * 0.7 + ty))}, 20, 0.88)`;
              ctx.fillRect(px, py, TILE, TILE);
              const fase = Math.floor(t * 2 + hashTile(tx, ty) * 10) % 8;
              ctx.fillStyle = "#ffd166";
              ctx.fillRect(px + (fase * 2) % 14, py + 4 + (fase % 3) * 3, 2, 1);
              continue;
            }
            ctx.fillStyle = regiao === "cristais" ? "rgba(80, 200, 255, 0.35)" : "rgba(26, 11, 46, 0.55)";
            ctx.fillRect(px, py, TILE, TILE);
            continue;
          }
          ctx.fillStyle = `rgba(${REGIOES_UMBRA[regiao].cor})`;
          ctx.fillRect(px, py, TILE, TILE);
          vidaDoChaoUmbra(ctx, regiao, px, py, tx, ty, t);
        }
      }
    },
    // a barreira das regiões trancadas, as cinzas no ar e o crepúsculo eterno (só em volta do herói é claro)
    animarPorCima(ctx, camera, w, h, t, heroi) {
      desenharBarreirasUmbra(ctx, camera, w, h, t);
      desenharCinzas(ctx, w, h, t);
      if (!heroi) return;
      const cx = heroi.x - camera.x;
      const cy = heroi.y - camera.y - 10;
      const luz = ctx.createRadialGradient(cx, cy, 50, cx, cy, Math.max(w, h) * 0.7);
      luz.addColorStop(0, "rgba(12, 4, 28, 0)");
      luz.addColorStop(1, "rgba(12, 4, 28, 0.62)");
      ctx.fillStyle = luz;
      ctx.fillRect(0, 0, w, h);
    },
  };
}

// A vida do chão de cada região de Umbraterra (em alguns tiles, sorteados pela posição, sempre os mesmos):
// rachaduras de magma pulsando nos Ermos de Cinza, cristais brilhando em estrelinhas no Bosque, bolhas subindo
// no Brejo do Abismo, gelo cintilando na Geleira, pó do vazio flutuando no Trono e runas acesas na Fenda.
function vidaDoChaoUmbra(ctx, regiao, px, py, tx, ty, t) {
  const h = hashTile(tx, ty, 7);
  const h2 = hashTile(tx, ty, 9);
  if (regiao === "cinzas" && h > 0.78) {
    const pulso = 0.45 + Math.sin(t * 2.2 + h * 30) * 0.35;
    ctx.fillStyle = `rgba(255, ${110 + Math.round(h2 * 60)}, 40, ${pulso})`;
    let x = px + 2 + Math.floor(h2 * 6);
    let y = py + 3;
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(x, y, 1, 2);
      x += ((i + Math.floor(h * 10)) % 3) - 1;
      y += 2;
    }
    if (pulso > 0.7) brilhoRedondo(ctx, px + 8, py + 8, 7, "255, 120, 40", 0.04);
  } else if (regiao === "cristais" && h > 0.82) {
    const brilho = Math.max(0, Math.sin(t * 1.8 + h * 50));
    if (brilho < 0.3) return;
    const x = px + 3 + Math.floor(h2 * 10);
    const y = py + 3 + Math.floor(hashTile(tx, ty, 11) * 10);
    ctx.fillStyle = `rgba(160, 230, 255, ${brilho})`;
    ctx.fillRect(x - 1, y, 3, 1);
    ctx.fillRect(x, y - 1, 1, 3);
    if (brilho > 0.8) {
      ctx.fillRect(x - 2, y, 1, 1);
      ctx.fillRect(x + 2, y, 1, 1);
      ctx.fillRect(x, y - 2, 1, 1);
      ctx.fillRect(x, y + 2, 1, 1);
    }
    ctx.fillStyle = `rgba(255, 255, 255, ${brilho})`;
    ctx.fillRect(x, y, 1, 1);
  } else if (regiao === "abismo" && h > 0.85) {
    const vida = (t * 0.35 + h * 7) % 1;
    const x = px + 4 + Math.floor(h2 * 8) + Math.round(Math.sin(vida * 6) * 1);
    const y = py + 13 - vida * 10;
    ctx.fillStyle = `rgba(150, 90, 220, ${0.7 * (1 - vida)})`;
    ctx.fillRect(x - 1, y, 3, 1);
    ctx.fillRect(x - 1, y - 2, 3, 1);
    ctx.fillRect(x - 2, y - 1, 1, 1);
    ctx.fillRect(x + 2, y - 1, 1, 1);
    ctx.fillStyle = `rgba(230, 210, 255, ${0.8 * (1 - vida)})`;
    ctx.fillRect(x - 1, y - 2, 1, 1);
  } else if (regiao === "geleira" && h > 0.75) {
    const brilho = Math.max(0, Math.sin(t * 2.6 + h * 70));
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(px + 2 + Math.floor(h2 * 11), py + 5 + Math.floor(h * 7), 2, 1);
    if (brilho > 0.85) {
      ctx.fillStyle = `rgba(255, 255, 255, ${brilho})`;
      const x = px + 3 + Math.floor(h2 * 9);
      const y = py + 2 + Math.floor(h * 9);
      ctx.fillRect(x, y, 1, 1);
      ctx.fillRect(x - 1, y, 1, 1);
      ctx.fillRect(x + 1, y, 1, 1);
      ctx.fillRect(x, y - 1, 1, 1);
      ctx.fillRect(x, y + 1, 1, 1);
    }
  } else if (regiao === "trono" && h > 0.8) {
    const vida = (t * 0.2 + h * 5) % 1;
    ctx.fillStyle = `rgba(200, 140, 255, ${Math.sin(vida * Math.PI) * 0.75})`;
    ctx.fillRect(px + Math.floor(h2 * 14) + Math.round(Math.sin(t + h * 9) * 2), py + 14 - Math.round(vida * 14), 1, 1);
  } else if (regiao === "fenda" && h > 0.94) {
    const pulso = 0.25 + Math.max(0, Math.sin(t * 1.4 + h * 40)) * 0.6;
    ctx.fillStyle = `rgba(200, 140, 255, ${pulso})`;
    const x = px + 4;
    const y = py + 4;
    [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2], [0, 3], [2, 3], [1, 4]].forEach(([dx, dy]) => ctx.fillRect(x + dx * 2, y + dy * 2, 2, 1));
  }
}

// o minimapa de Umbraterra: regiões, lugares, covis (💀) e o herói
function montarMinimapaUmbra(caixa, mundo, lugares) {
  const canvas = caixa.querySelector("canvas");
  const rotulo = caixa.querySelector(".regiao-atual");
  const base = miniMapaUmbra();
  const E = 2;
  canvas.width = base.width * E;
  canvas.height = base.height * E;
  const ctx = canvas.getContext("2d");
  // o meio de cada região (para escrever o nome dela no mapa ampliado): a média dos tiles dela
  const centros = {};
  for (let ty = 0; ty < LINHAS_UMBRA; ty += 3) {
    for (let tx = 0; tx < COLUNAS_UMBRA; tx += 3) {
      const id = regiaoUmbra(tx, ty);
      if (!id || !REGIOES_UMBRA[id]) continue;
      const c = (centros[id] ||= { x: 0, y: 0, n: 0 });
      c.x += tx;
      c.y += ty;
      c.n += 1;
    }
  }
  // clique ou a tecla M ampliam o mapa (igual ao do Reino)
  const alternar = () => {
    caixa.classList.toggle("ampliado");
    desenhar(false);
  };
  caixa.addEventListener("click", alternar);
  const teclaM = (e) => {
    if (!caixa.isConnected) return window.removeEventListener("keydown", teclaM);
    if ((e.key === "m" || e.key === "M") && !document.querySelector("dialog[open]") && !(e.target instanceof Element && e.target.closest("input, textarea"))) alternar();
  };
  window.addEventListener("keydown", teclaM);
  function desenhar(repetir = true) {
    if (!caixa.isConnected) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
    // ampliado: o nome de cada região, em dourado, no meio dela
    if (caixa.classList.contains("ampliado")) {
      ctx.textAlign = "center";
      ctx.font = "18px 'Jersey 10', sans-serif";
      Object.entries(centros).forEach(([id, c]) => {
        const nome = REGIOES_UMBRA[id].nome;
        const x = (c.x / c.n) * E;
        // um pouco acima do meio, para não cobrir as caveiras dos chefões nem o herói
        const y = (c.y / c.n) * E - 22;
        const largura = ctx.measureText(nome).width + 10;
        ctx.fillStyle = "rgba(20, 12, 36, 0.82)";
        ctx.fillRect(x - largura / 2, y - 13, largura, 18);
        ctx.fillStyle = "#e0c8ff";
        ctx.fillText(nome, x, y + 1);
      });
    }
    lugares.forEach((l) => {
      const [x, y] = LUGARES_UMBRA[l.id];
      ctx.fillStyle = "#1b1533";
      ctx.fillRect(x * E - 4, y * E - 4, 8, 8);
      ctx.fillStyle = l.tipo === "dungeon" ? "#ff4d6d" : "#c08bff";
      ctx.fillRect(x * E - 3, y * E - 3, 6, 6);
    });
    ctx.textAlign = "center";
    ctx.font = "bold 12px sans-serif";
    (estadoUmbra.monstros || []).filter((m) => m.chefe && !m.derrotado()).forEach((m) => ctx.fillText("💀", (m.x / TILE) * E, (m.y / TILE) * E + 4));
    // o herói: o mesmo medalhão com o rosto dele do mapa do Reino
    const hx = Math.round((mundo.heroi.x / TILE) * E);
    const hy = Math.round((mundo.heroi.y / TILE) * E);
    const T = Math.max(16, Math.min(48, Math.round((15 * canvas.width) / (canvas.clientWidth || canvas.width))));
    const marcador = marcadorDoHeroi(T);
    ctx.drawImage(marcador, hx - marcador.width / 2, hy - marcador.height / 2);
    const regiao = REGIOES_UMBRA[regiaoUmbra(Math.floor(mundo.heroi.x / TILE), Math.floor(mundo.heroi.y / TILE))];
    if (rotulo && regiao) rotulo.textContent = regiao.nome;
    if (repetir) setTimeout(desenhar, 300);
  }
  desenhar();
}

// todos os monstros (do Reino e de Umbraterra) com o volume do herói (reino.js)
monstrosComVolume();
