// Por dentro das construções do Reino: a Estalagem do Grifo e o Mercado de Elyndor,
// como cenários andáveis do motor de mundos (mundo.js).
// Depende de pixel.js, heroi.js e academia_mapa.js (spriteDe, planta, animarChama, animarBardo, animarBalaoFala).

const INTERIOR = { colunas: 22, linhas: 14 };

function pintarAssoalho(ctx, largura, y0, y1, cor = "#8b5a2b") {
  for (let y = y0; y < y1; y += 4) {
    retangulo(ctx, 16, y, largura - 32, 4, (y / 4) % 2 ? cor : tom(cor, 0.92));
    retangulo(ctx, 16, y + 3, largura - 32, 1, tom(cor, 0.75));
    for (let x = 16 + ((y / 4) % 3) * 13; x < largura - 16; x += 38) retangulo(ctx, x, y, 1, 3, tom(cor, 0.75));
  }
}

function paredesInterior(ctx, largura, altura, corParede) {
  retangulo(ctx, 0, 0, largura, 4 * 16, corParede);
  for (let x = 0; x < largura; x += 12) retangulo(ctx, x, 0, 1, 4 * 16, tom(corParede, 0.82));
  retangulo(ctx, 0, 36, largura, 3, tom(corParede, 1.25));
  retangulo(ctx, 0, 4 * 16 - 4, largura, 4, tom(corParede, 0.55));
  [[0, 16], [largura - 16, 16]].forEach(([x, w]) => retangulo(ctx, x, 4 * 16, w, altura - 4 * 16, tom(corParede, 0.7)));
  retangulo(ctx, 0, altura - 16, largura, 16, tom(corParede, 0.7));
  retangulo(ctx, 10 * 16, altura - 16, 2 * 16, 16, "#5c3418");
}

const barril = () => spriteAcademia("barril", () => spriteDe(14, 18, (ctx) => {
  retangulo(ctx, 1, 0, 12, 18, "#8b5a2b");
  retangulo(ctx, 0, 3, 14, 12, "#8b5a2b");
  [2, 9, 15].forEach((y) => retangulo(ctx, 0, y, 14, 1, "#6d6d7a"));
  retangulo(ctx, 4, 1, 2, 16, "#a8703a");
}));

const mesaTaverna = () => spriteAcademia("mesaTaverna", () => spriteDe(30, 18, (ctx) => {
  retangulo(ctx, 0, 4, 30, 6, "#8b5a2b");
  retangulo(ctx, 0, 4, 30, 1, "#a8703a");
  retangulo(ctx, 3, 10, 3, 8, "#5c3418");
  retangulo(ctx, 24, 10, 3, 8, "#5c3418");
  retangulo(ctx, 6, 0, 4, 5, "#e9e4d4");
  retangulo(ctx, 7, 1, 2, 3, "#ffd166");
  retangulo(ctx, 18, 1, 6, 4, "#c98d63");
  retangulo(ctx, 19, 2, 4, 1, "#a8323e");
}));

const balcaoTaverna = () => spriteAcademia("balcaoTaverna", () => spriteDe(112, 22, (ctx) => {
  retangulo(ctx, 0, 6, 112, 16, "#5c3418");
  retangulo(ctx, 0, 4, 112, 4, "#8b5a2b");
  retangulo(ctx, 0, 4, 112, 1, "#a8703a");
  for (let x = 6; x < 112; x += 16) retangulo(ctx, x, 10, 10, 9, "#4a2a12");
  [[10, "#ffd166"], [30, "#e9e4d4"], [70, "#a8323e"], [92, "#ffd166"]].forEach(([x, cor]) => {
    retangulo(ctx, x, 0, 5, 5, "#e9e4d4");
    retangulo(ctx, x + 1, 1, 3, 3, cor);
  });
}));

const lareira = () => spriteAcademia("lareira", () => spriteDe(44, 40, (ctx) => {
  retangulo(ctx, 0, 0, 44, 40, "#7a7266");
  for (let y = 2; y < 40; y += 6) for (let x = (y % 12 ? 0 : 6); x < 44; x += 12) retangulo(ctx, x, y, 11, 5, "#8a8b99");
  retangulo(ctx, 8, 14, 28, 26, "#1b1210");
  retangulo(ctx, 4, 10, 36, 4, "#5c3418");
  retangulo(ctx, 12, 34, 20, 4, "#5c3418");
}));

function animarLareira(ctx, x, y, t) {
  for (let i = 0; i < 5; i++) {
    const h = 6 + Math.round(Math.abs(Math.sin(t * 7 + i * 1.7)) * 8);
    retangulo(ctx, x + 13 + i * 4, y + 35 - h, 3, h, i % 2 ? "#ff7a1a" : "#ffd166");
  }
  brilhoRedondo(ctx, x + 22, y + 30, 16, "255, 160, 60", 0.07 + Math.sin(t * 5) * 0.02);
}

const escada = () => spriteAcademia("escada", () => spriteDe(28, 40, (ctx) => {
  for (let i = 0; i < 8; i++) {
    retangulo(ctx, 2, 36 - i * 5, 24, 4, "#8b5a2b");
    retangulo(ctx, 2, 36 - i * 5, 24, 1, "#a8703a");
  }
  retangulo(ctx, 0, 0, 3, 40, "#5c3418");
  retangulo(ctx, 25, 0, 3, 40, "#5c3418");
}));

// a estalagem: balcão do Bram, lareira, mesas com fregueses, menestrel e a escada para os quartos
function cenarioEstalagem({ fregueses, menestrel, estalajadeiro }) {
  const chao = spriteAcademia("chaoEstalagem", () => {
    const { canvas, ctx } = criarTela(INTERIOR.colunas * 16, INTERIOR.linhas * 16);
    paredesInterior(ctx, canvas.width, canvas.height, "#6b4423");
    pintarAssoalho(ctx, canvas.width, 4 * 16, 13 * 16, "#9a6a3a");
    // prateleiras de garrafas e um escudo do grifo na parede
    [[2, 14], [2, 26]].forEach(([tx, y]) => {
      retangulo(ctx, tx * 16, y, 7 * 16, 2, "#4a2a12");
      for (let i = 0; i < 12; i++) retangulo(ctx, tx * 16 + 4 + i * 9, y - 7, 4, 7, ["#2f8a4c", "#a8323e", "#e2b04a", "#4fa8ff"][i % 4]);
    });
    retangulo(ctx, 11 * 16, 8, 24, 26, "#a8323e");
    retangulo(ctx, 11 * 16 + 4, 12, 16, 18, "#f5c451");
    retangulo(ctx, 11 * 16 + 9, 15, 6, 10, "#a8323e");
    // tapete na frente da lareira
    retangulo(ctx, 15 * 16, 6 * 16, 5 * 16, 2 * 16, "#7b241c");
    retangulo(ctx, 15 * 16 + 3, 6 * 16 + 3, 5 * 16 - 6, 2 * 16 - 6, "#a8323e");
    return canvas;
  });
  const props = [
    { x: 6 * 16, y: 6 * 16, sprite: balcaoTaverna(), tilesBloqueados: ["3,5", "4,5", "5,5", "6,5", "7,5", "8,5", "9,5"] },
    { x: 17 * 16 + 8, y: 4 * 16 + 6, sprite: lareira(), tilesBloqueados: ["16,4", "17,4", "18,4"], animar: animarLareira },
    ...[[5, 9], [10, 8], [16, 10]].map(([tx, ty]) => ({ x: tx * 16 + 8, y: (ty + 1) * 16, sprite: mesaTaverna(), tilesBloqueados: [`${tx - 1},${ty}`, `${tx},${ty}`, `${tx + 1},${ty}`] })),
    ...[[1, 4], [1, 5], [20, 12], [1, 12]].map(([tx, ty]) => ({ x: tx * 16 + 8, y: (ty + 1) * 16, sprite: barril(), tilesBloqueados: [`${tx},${ty}`] })),
    { x: 20 * 16 + 8, y: 6 * 16, sprite: escada(), tilesBloqueados: ["20,4", "20,5"] },
  ];
  const nada = spriteDe(2, 2, () => {}, null);
  const pessoa = (id, nome, visual, tx, ty, extra = {}) => {
    const sprite = heroiParado(visual);
    return {
      id, nome, sprite, visual, px: tx * 16 + 8, py: (ty + 1) * 16, sobrepoe: true, semRotulo: true, acao: "Falar",
      entrada: { x: tx * 16 + 8, y: (ty + 1) * 16 + 10 }, tilesBloqueados: [`${tx},${ty}`],
      animar: (ctx, x, y, t) => animarBalaoFala(ctx, x, y, t, sprite.width), ...extra,
    };
  };
  const lugares = [
    pessoa("bram", estalajadeiro.nome, estalajadeiro.avatar, 6, 4, { semRotulo: false, icone: "🍺", destaque: true, entrada: { x: 6 * 16 + 8, y: 6 * 16 + 12 } }),
    pessoa("menestrel", menestrel.nome, menestrel.visual, 13, 6, { animar: (ctx, x, y, t) => animarBardo(ctx, x, y, t) }),
    ...fregueses.map((f) => pessoa(`freguês-${f.id}`, f.nome, f.visual, f.tx, f.ty, { fregues: f, visual: f.visual, passeia: 16 })),
    { id: "quarto", nome: "Quartos", icone: "🛏️", acao: "Subir aos", sprite: nada, px: 20 * 16 + 8, py: 7 * 16, sobrepoe: true, entrada: { x: 19 * 16 + 8, y: 6 * 16 + 8 } },
    { id: "saida", nome: "Reino", icone: "🚪", acao: "Voltar ao", sprite: nada, px: 11 * 16, py: 14 * 16, entrada: { x: 11 * 16, y: 12 * 16 + 8 }, semRotulo: true },
  ];
  return salaEmHD({
    colunas: INTERIOR.colunas, linhas: INTERIOR.linhas, chao, corFundo: "#1b1210", props, lugares,
    andavel: (tx, ty) => tx >= 1 && tx <= 20 && ty >= 4 && ty <= 12,
    spawn: { x: 11 * 16, y: 11 * 16 + 8 },
  }, "estalagem");
}

// expositores do mercado
const mesaVitrine = () => spriteAcademia("mesaVitrine", () => spriteDe(22, 16, (ctx) => {
  retangulo(ctx, 0, 6, 22, 5, "#c98d63");
  retangulo(ctx, 0, 6, 22, 1, "#e0a87a");
  retangulo(ctx, 2, 11, 3, 5, "#8b5a2b");
  retangulo(ctx, 17, 11, 3, 5, "#8b5a2b");
  retangulo(ctx, 3, 4, 16, 3, "#7b241c");
}));

function spriteVitrine(icone) {
  return spriteAcademia(`vitrine-${icone}`, () => {
    const base = mesaVitrine();
    const item = emojiCanvas(icone, 16);
    const { canvas, ctx } = criarTela(base.width, base.height + 14);
    ctx.drawImage(base, 0, 14);
    ctx.drawImage(item, Math.round((base.width - item.width) / 2), 4);
    return canvas;
  });
}

const pedestalManequim = () => spriteAcademia("pedestalManequim", () => spriteDe(22, 6, (ctx) => {
  retangulo(ctx, 0, 0, 22, 6, "#6b6c7a");
  retangulo(ctx, 0, 0, 22, 1, "#a3a6c2");
}));

// manequim vestindo o visual; se o item for um mascote, ele aparece ao lado
function spriteManequim(visual) {
  const corpo = heroiParado({ ...visual, familiar: "nenhum" });
  const mascote = visual.familiar && visual.familiar !== "nenhum" ? familiarCanvas(visual) : null;
  const pe = pedestalManequim();
  const largura = Math.max(corpo.width, pe.width) + (mascote ? 10 : 0);
  const { canvas, ctx } = criarTela(largura, corpo.height + 4);
  ctx.drawImage(pe, 0, canvas.height - pe.height);
  ctx.drawImage(corpo, Math.round((pe.width - corpo.width) / 2), 0);
  if (mascote) ctx.drawImage(mascote, largura - mascote.width, canvas.height - mascote.height - 3);
  return canvas;
}

const estantePocoes = () => spriteAcademia("estantePocoes", () => spriteDe(48, 40, (ctx) => {
  retangulo(ctx, 0, 0, 48, 40, "#5c3418");
  for (let p = 0; p < 3; p++) {
    const y = 4 + p * 12;
    retangulo(ctx, 2, y, 44, 10, "#2b1608");
    for (let i = 0; i < 6; i++) {
      const cor = ["#6ef0ff", "#ff7ad9", "#7dff9a", "#ffd166", "#a98bff", "#ff6b7a"][(i + p) % 6];
      retangulo(ctx, 4 + i * 7, y + 3, 5, 7, cor);
      retangulo(ctx, 5 + i * 7, y + 1, 3, 2, "#e9e4d4");
    }
    retangulo(ctx, 0, y + 10, 48, 2, "#8b5a2b");
  }
}));

// o espelho de corpo inteiro do mercado: moldura dourada, vidro azulado com reflexo e pé de madeira
const espelhoMercado = () => spriteAcademia("espelhoMercado", () => spriteDe(18, 34, (ctx) => {
  for (let y = 0; y < 28; y++) {
    const meia = y < 4 ? [5, 7, 8, 9][y] : y > 23 ? [9, 8, 7, 5][y - 24] : 9;
    retangulo(ctx, 9 - meia, y, meia * 2, 1, "#c9952a");
    if (y > 1 && y < 26) retangulo(ctx, 9 - meia + 2, y, meia * 2 - 4, 1, y < 14 ? "#9fd4ff" : "#7bb6e8");
  }
  retangulo(ctx, 5, 4, 1, 8, "#e6fdff");
  retangulo(ctx, 7, 5, 1, 4, "#e6fdff");
  retangulo(ctx, 8, 0, 2, 2, "#f5c451");
  retangulo(ctx, 8, 28, 2, 4, "#8b5a2b");
  retangulo(ctx, 4, 32, 10, 2, "#5c3418");
}));

// ---------- a Casa da Forja ----------
// a fornalha grande, de pedra, com a boca acesa (o fogo é animado por cima)
const fornalhaForja = () => spriteAcademia("fornalhaForja", () => spriteDe(64, 52, (ctx) => {
  retangulo(ctx, 0, 6, 64, 46, "#4a4440");
  for (let y = 8; y < 52; y += 6) for (let x = (y % 12 === 2 ? 0 : 8); x < 64; x += 16) retangulo(ctx, x, y, 15, 5, y % 12 === 2 ? "#5e5753" : "#544d49");
  retangulo(ctx, 22, 0, 20, 8, "#3a3330");
  retangulo(ctx, 20, 0, 24, 2, "#5e5753");
  // a boca em arco
  retangulo(ctx, 12, 22, 40, 30, "#2a2420");
  retangulo(ctx, 16, 19, 32, 3, "#2a2420");
  retangulo(ctx, 15, 25, 34, 27, "#120a06");
  retangulo(ctx, 15, 44, 34, 8, "#7b1010");
  retangulo(ctx, 17, 46, 30, 4, "#c0392b");
  // as runas de calor em volta da boca
  [[8, 28], [54, 28], [8, 40], [54, 40]].forEach(([x, y]) => retangulo(ctx, x, y, 2, 4, "#ff9f43"));
}));

function animarFornalha(ctx, x, y, t) {
  for (let i = 0; i < 9; i++) {
    const h = 6 + Math.round(Math.abs(Math.sin(t * 7 + i * 1.3)) * 14);
    retangulo(ctx, x + 17 + i * 3.5, y + 47 - h, 3, h, i % 3 === 0 ? "#ffd166" : i % 3 === 1 ? "#ff7a1a" : "#ff4d1a");
    if (h > 15) retangulo(ctx, x + 18 + i * 3.5, y + 47 - h, 1, 2, "#fff3b0");
  }
  brilhoRedondo(ctx, x + 32, y + 40, 34, "255, 140, 50", 0.08 + Math.sin(t * 5) * 0.025);
  // fagulhas subindo da boca
  for (let i = 0; i < 5; i++) {
    const vida = (t * 0.8 + i / 5) % 1;
    retangulo(ctx, x + 20 + ((i * 7) % 26) + Math.round(Math.sin(vida * 8 + i) * 2), y + 30 - Math.round(vida * 26), 1, 1, `rgba(255, ${180 + i * 12}, 90, ${1 - vida})`);
  }
}

// a bigorna grande do Duran, num toco de carvalho
const bigornaForja = () => spriteAcademia("bigornaForja", () => spriteDe(30, 22, (ctx) => {
  retangulo(ctx, 8, 12, 14, 10, "#6b4423");
  retangulo(ctx, 8, 12, 14, 1, "#8b5a2b");
  for (let y = 14; y < 22; y += 3) retangulo(ctx, 9, y, 12, 1, "#5c3418");
  retangulo(ctx, 2, 3, 26, 5, "#4a4a55");
  retangulo(ctx, 0, 3, 4, 3, "#4a4a55");
  retangulo(ctx, 2, 2, 24, 1, "#8a8b99");
  retangulo(ctx, 10, 8, 10, 4, "#3a3a44");
  retangulo(ctx, 6, 3, 10, 1, "#c4cbd8");
}));

function animarBigorna(ctx, x, y, t) {
  // a peça em brasa em cima da bigorna e as faíscas a cada martelada
  const calor = Math.sin(t * 3) * 0.5 + 0.5;
  retangulo(ctx, x + 9, y + 1, 12, 2, calor > 0.5 ? "#ffd166" : "#ff7a1a");
  brilhoRedondo(ctx, x + 15, y + 2, 10, "255, 170, 60", 0.1 + calor * 0.06);
  const martelada = (t * 0.9) % 1;
  if (martelada < 0.3) {
    for (let i = 0; i < 8; i++) {
      const v = martelada / 0.3;
      const a = -Math.PI * (0.1 + (i / 8) * 0.8);
      retangulo(ctx, x + 15 + Math.round(Math.cos(a) * v * 14), y + 2 + Math.round(Math.sin(a) * v * 10 + v * v * 6), 1, 1, i % 2 ? "#ffd166" : "#fff3b0");
    }
  }
}

// o suporte de armas da parede, com espadas, machados e arcos de ferro comum
const suporteDeArmas = () => spriteAcademia("suporteDeArmas", () => spriteDe(44, 34, (ctx) => {
  retangulo(ctx, 0, 4, 44, 3, "#5c3418");
  retangulo(ctx, 0, 26, 44, 3, "#5c3418");
  [[4, "#c9cbe0"], [12, "#a3a6c2"], [20, "#c9cbe0"]].forEach(([x, cor]) => {
    retangulo(ctx, x, 1, 2, 24, cor);
    retangulo(ctx, x - 2, 20, 6, 2, "#c9952a");
    retangulo(ctx, x, 22, 2, 6, "#5c3418");
  });
  retangulo(ctx, 29, 2, 2, 26, "#8b5a2b");
  retangulo(ctx, 26, 3, 6, 6, "#8a8b99");
  retangulo(ctx, 25, 4, 2, 4, "#c4cbd8");
  retangulo(ctx, 37, 2, 1, 26, "#e8e4dc");
  for (let i = 0; i < 26; i++) retangulo(ctx, 38 + Math.round(Math.sin((i / 26) * Math.PI) * 4), 2 + i, 1, 1, "#8b5a2b");
}));

// carvão e lenha empilhados
const pilhaDeCarvao = () => spriteAcademia("pilhaDeCarvao", () => spriteDe(26, 14, (ctx) => {
  for (let y = 0; y < 12; y++) {
    const meia = Math.round(Math.sqrt(Math.max(0, 1 - ((y - 12) / 12) ** 2)) * 12);
    retangulo(ctx, 13 - meia, y + 2, meia * 2, 1, y % 3 ? "#2b2b35" : "#1b1b22");
  }
  [[6, 9], [12, 6], [18, 10], [10, 11]].forEach(([x, y]) => retangulo(ctx, x, y, 2, 1, "#4a4a55"));
}));

// o pedestal de pedra da vitrine das lendárias, com a peça flutuando em cima
function pedestalDaForja(item) {
  return spriteAcademia(`pedestal-forja-${item.id}`, () => {
    const desenho = desenhoDoItem(item);
    const escala = Math.min(1, 26 / desenho.height, 22 / desenho.width);
    const { canvas, ctx } = criarTela(26, 44);
    retangulo(ctx, 3, 32, 20, 12, "#4a4440");
    retangulo(ctx, 1, 30, 24, 3, "#6b6460");
    retangulo(ctx, 3, 41, 20, 3, "#3a3330");
    retangulo(ctx, 6, 35, 14, 1, "#c9952a");
    ctx.imageSmoothingEnabled = false;
    const w = Math.round(desenho.width * escala);
    const h = Math.round(desenho.height * escala);
    ctx.drawImage(desenho, Math.round((26 - w) / 2), 28 - h, w, h);
    return canvas;
  });
}

// ferreiro: { nome, avatar }; vitrine: até 6 peças lendárias da classe do herói (forjadas ou não)
function cenarioForja({ ferreiro, vitrine }) {
  const chao = spriteAcademia("chaoForja", () => {
    const { canvas, ctx } = criarTela(INTERIOR.colunas * 16, INTERIOR.linhas * 16);
    paredesInterior(ctx, canvas.width, canvas.height, "#4a4440");
    // o chão de lajes de pedra
    for (let y = 4 * 16; y < 13 * 16; y += 16) {
      for (let x = 16; x < canvas.width - 16; x += 16) {
        const escuro = ((x + y) / 16) % 3 === 0;
        retangulo(ctx, x, y, 16, 16, escuro ? "#5a524c" : "#655d56");
        retangulo(ctx, x, y, 16, 1, "#3e3833");
        retangulo(ctx, x, y, 1, 16, "#3e3833");
      }
    }
    // o canal de lava que sai da fornalha e atravessa a sala (o brilho é animado)
    retangulo(ctx, 3 * 16 + 4, 7 * 16, 3 * 16, 6, "#3a1006");
    retangulo(ctx, 6 * 16 - 2, 7 * 16, 6, 4 * 16, "#3a1006");
    // os escudos das linhagens pendurados na parede de cima
    ["#c0392b", "#6ef0ff", "#ff7a1a", "#3ff0c0", "#e07bff", "#f5c451"].forEach((cor, i) => {
      const x = 9 * 16 + i * 20;
      retangulo(ctx, x, 14, 14, 16, "#3a3330");
      retangulo(ctx, x + 1, 15, 12, 13, cor);
      retangulo(ctx, x + 4, 28, 6, 3, cor);
      retangulo(ctx, x + 5, 19, 4, 4, "#fff3b0");
    });
    // o tapete de couro na frente da bigorna
    retangulo(ctx, 9 * 16, 9 * 16, 5 * 16, 2 * 16, "#5c3418");
    retangulo(ctx, 9 * 16 + 3, 9 * 16 + 3, 5 * 16 - 6, 2 * 16 - 6, "#7a4d24");
    return canvas;
  });
  const lava = (ctx, x, y, t) => {
    for (let i = 0; i < 3 * 16; i += 3) retangulo(ctx, x + i, y + 1, 3, 4, (Math.floor(t * 6) + i / 3) % 4 ? "#ff7a1a" : "#ffd166");
    for (let i = 0; i < 4 * 16; i += 3) retangulo(ctx, x + 3 * 16 - 5, y + i, 4, 3, (Math.floor(t * 6) + i / 3) % 4 ? "#ff7a1a" : "#ffd166");
  };
  const nada = spriteDe(2, 2, () => {}, null);
  const props = [
    { x: 3 * 16 + 8, y: 6 * 16 + 4, sprite: fornalhaForja(), tilesBloqueados: ["1,4", "2,4", "3,4", "4,4", "5,4", "1,5", "2,5", "3,5", "4,5", "5,5"], animar: animarFornalha },
    // (o "nada" tem 2 x 2: o canto do desenho cai em x - 1, y - 2, em cima do canal pintado no chão)
    { x: 3 * 16 + 5, y: 7 * 16 + 2, sprite: nada, animar: lava },
    { x: 18 * 16, y: 4 * 16 + 2, sprite: suporteDeArmas(), tilesBloqueados: ["17,4", "18,4", "19,4"] },
    { x: 8 * 16, y: 4 * 16 + 2, sprite: suporteDeArmas(), tilesBloqueados: ["7,4", "8,4", "9,4"] },
    { x: 2 * 16, y: 12 * 16 + 14, sprite: pilhaDeCarvao(), tilesBloqueados: ["1,12", "2,12"] },
    ...[[20, 12], [1, 9]].map(([tx, ty]) => ({ x: tx * 16 + 8, y: (ty + 1) * 16, sprite: barril(), tilesBloqueados: [`${tx},${ty}`] })),
  ];
  const duran = heroiParado(ferreiro.avatar);
  const lugares = [
    {
      id: "bigorna", nome: "Bigorna", icone: "⚒️", acao: "Forjar na", sprite: bigornaForja(), px: 11 * 16 + 8, py: 8 * 16, sobrepoe: true, destaque: true,
      entrada: { x: 11 * 16 + 8, y: 9 * 16 + 4 }, tilesBloqueados: ["10,7", "11,7", "12,7"], animar: animarBigorna,
    },
    {
      id: "duran", nome: ferreiro.nome.split(",")[0], icone: "🔨", acao: "Falar", sprite: duran, visual: ferreiro.avatar, px: 14 * 16 + 8, py: 7 * 16,
      sobrepoe: true, destaque: true, entrada: { x: 14 * 16 + 8, y: 8 * 16 + 6 }, tilesBloqueados: ["14,6"],
      animar: (ctx, x, y, t) => animarBalaoFala(ctx, x, y, t, duran.width),
    },
    { id: "saida", nome: "Reino", icone: "🚪", acao: "Voltar ao", sprite: nada, px: 11 * 16, py: 14 * 16, entrada: { x: 11 * 16, y: 12 * 16 + 8 }, semRotulo: true },
  ];
  // a vitrine das lendárias, na parede da direita: a peça brilha na cor da raridade
  const posicoes = [[17, 7], [19, 7], [17, 10], [19, 10], [15, 11], [8, 11]];
  vitrine.slice(0, posicoes.length).forEach((item, i) => {
    const [tx, ty] = posicoes[i];
    const sprite = pedestalDaForja(item);
    const cor = item.forjado ? "255, 209, 102" : "190, 160, 255";
    lugares.push({
      id: `peca-${item.id}`, pecaDaForja: item, nome: item.forjado ? "✓ Tua" : item.nome, icone: item.icone, acao: "Ver", sprite,
      px: tx * 16 + 8, py: (ty + 1) * 16, sobrepoe: true, semRotulo: true, vencida: item.forjado, entrada: { x: tx * 16 + 8, y: (ty + 1) * 16 + 10 }, tilesBloqueados: [`${tx},${ty}`],
      animar: (ctx, x, y, t) => {
        brilhoRedondo(ctx, x + 13, y + 18, 12, cor, 0.08 + Math.sin(t * 2.4 + i) * 0.03);
        const vida = (t * 0.7 + i / 6) % 1;
        retangulo(ctx, x + 6 + ((i * 5) % 14), y + 26 - Math.round(vida * 20), 1, 1, `rgba(${cor}, ${1 - vida})`);
      },
    });
  });
  return salaEmHD({
    colunas: INTERIOR.colunas, linhas: INTERIOR.linhas, chao, corFundo: "#120c0a", props, lugares,
    andavel: (tx, ty) => tx >= 1 && tx <= 20 && ty >= 4 && ty <= 12,
    spawn: { x: 11 * 16, y: 11 * 16 + 8 },
  }, "forja");
}

// o mercado: Brina no balcão, poções nas mesas, visuais vestidos em manequins e o espelho para trocar de visual
// itens: [{ id, icone, nome, preco, tipo: "consumivel" | "visual", avatar? }]
function cenarioMercado({ itens, mercadora, avatarAluno }) {
  const chao = spriteAcademia("chaoMercado", () => {
    const { canvas, ctx } = criarTela(INTERIOR.colunas * 16, INTERIOR.linhas * 16);
    paredesInterior(ctx, canvas.width, canvas.height, "#7a4d24");
    pintarAssoalho(ctx, canvas.width, 4 * 16, 13 * 16, "#b08a55");
    // toldo listrado na parede e uma placa
    for (let i = 0; i < 22; i++) retangulo(ctx, i * 16, 2, 16, 10, i % 2 ? "#fdf2e9" : "#e74c3c");
    retangulo(ctx, 8 * 16, 18, 6 * 16, 14, "#f5c451");
    retangulo(ctx, 8 * 16 + 3, 21, 6 * 16 - 6, 8, "#7b241c");
    // tapete na entrada
    retangulo(ctx, 9 * 16, 10 * 16, 4 * 16, 2 * 16, "#2e5cb8");
    retangulo(ctx, 9 * 16 + 3, 10 * 16 + 3, 4 * 16 - 6, 2 * 16 - 6, "#4a78d0");
    return canvas;
  });
  const props = [
    { x: 4 * 16, y: 4 * 16 + 4, sprite: estantePocoes(), tilesBloqueados: ["2,4", "3,4", "4,4", "5,4"] },
    { x: 18 * 16, y: 4 * 16 + 4, sprite: estantePocoes(), tilesBloqueados: ["16,4", "17,4", "18,4", "19,4"] },
    { x: 11 * 16, y: 6 * 16, sprite: balcaoTaverna(), tilesBloqueados: ["8,5", "9,5", "10,5", "11,5", "12,5", "13,5"] },
    ...[[1, 12], [20, 12]].map(([tx, ty]) => ({ x: tx * 16 + 8, y: (ty + 1) * 16, sprite: planta(), tilesBloqueados: [`${tx},${ty}`] })),
  ];
  const nada = spriteDe(2, 2, () => {}, null);
  const brina = heroiParado(mercadora.avatar);
  const lugares = [
    {
      id: "brina", nome: mercadora.nome.split(",")[0], icone: "🏪", acao: "Falar", sprite: brina, visual: mercadora.avatar, px: 11 * 16, py: 5 * 16, sobrepoe: true, destaque: true,
      entrada: { x: 11 * 16, y: 6 * 16 + 12 }, tilesBloqueados: ["10,4", "11,4"],
      animar: (ctx, x, y, t) => animarBalaoFala(ctx, x, y, t, brina.width),
    },
    { id: "saida", nome: "Reino", icone: "🚪", acao: "Voltar ao", sprite: nada, px: 11 * 16, py: 14 * 16, entrada: { x: 11 * 16, y: 12 * 16 + 8 }, semRotulo: true },
    {
      id: "espelho", nome: "Espelho", icone: "🪞", acao: "Trocar o visual no", sprite: espelhoMercado(), px: 1 * 16 + 8, py: 9 * 16, sobrepoe: true, destaque: true,
      entrada: { x: 2 * 16 + 8, y: 9 * 16 + 8 }, tilesBloqueados: ["1,8"],
      animar: (ctx, x, y, t) => {
        // um brilho que atravessa o vidro de tempos em tempos
        const fase = (t * 0.6) % 3;
        if (fase < 1) retangulo(ctx, x + 4 + Math.round(fase * 9), y + 6, 1, 14, "rgba(255, 255, 255, 0.55)");
      },
    },
  ];
  // poções nas mesas da esquerda, visuais nos manequins da direita
  const consumiveis = itens.filter((i) => i.tipo === "consumivel");
  const visuais = itens.filter((i) => i.tipo === "visual");
  const posConsumiveis = [[3, 8], [6, 8], [3, 11], [6, 11], [8, 8], [8, 11]];
  const posVisuais = [[14, 8], [17, 8], [20, 8], [14, 11], [17, 11], [20, 11]];
  consumiveis.slice(0, posConsumiveis.length).forEach((item, i) => {
    const [tx, ty] = posConsumiveis[i];
    const sprite = spriteVitrine(item.icone);
    lugares.push({
      id: `item-${item.id}`, item, nome: `${item.preco} 🪙`, icone: item.icone, acao: "Ver", sprite, px: tx * 16 + 8, py: (ty + 1) * 16, sobrepoe: true,
      entrada: { x: tx * 16 + 8, y: (ty + 1) * 16 + 10 }, tilesBloqueados: [`${tx},${ty}`],
    });
  });
  visuais.slice(0, posVisuais.length).forEach((item, i) => {
    const [tx, ty] = posVisuais[i];
    const sprite = spriteManequim({ ...avatarAluno, familiar: "nenhum", ...item.avatar });
    lugares.push({
      id: `item-${item.id}`, item, nome: item.comprado ? "✓ Teu" : `${item.preco} 🪙`, icone: item.icone, acao: "Ver", sprite, px: tx * 16 + 8, py: (ty + 1) * 16, sobrepoe: true,
      vencida: item.comprado, entrada: { x: tx * 16 + 8, y: (ty + 1) * 16 + 10 }, tilesBloqueados: [`${tx},${ty}`],
    });
  });
  return salaEmHD({
    colunas: INTERIOR.colunas, linhas: INTERIOR.linhas, chao, corFundo: "#1b1210", props, lugares,
    andavel: (tx, ty) => tx >= 1 && tx <= 20 && ty >= 4 && ty <= 12,
    spawn: { x: 11 * 16, y: 11 * 16 + 8 },
  }, "mercado");
}
