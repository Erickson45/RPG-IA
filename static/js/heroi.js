// O herói de corpo inteiro (32 x 48) no estilo "chibi detalhado": cabeça grande, olhos com brilho,
// cabelo em 3 tons e roupa em camadas. Três vocações, cada uma com roupa e armas próprias:
// mago (casaco bordado), guerreiro (armadura, sobreveste e capa) e arqueiro (túnica, colete de couro e aljava).
// spritesHeroi(escolhas) devolve { baixo: [10 canvas], cima: [...], lado: [...] } (o lado esquerdo é o lado espelhado).
// heroiParado(escolhas) é só o quadro parado de frente (moradores, retratos, estátuas).
// Usa a paleta e as escolhas do avatar (avatar.js) e o motor de pixel.js.

const LARGURA_HEROI = 32;
const ALTURA_HEROI = 51;
// a linha dos pés no quadro (quem desenha o herói no chão alinha por ela)
const PE_HEROI = 48;
// quanto as pernas são mais compridas que no desenho original (proporção de adulto, não de criança)
const PERNA_EXTRA = 3;

// Os quadros de cada direção: 0 a 7 são a caminhada, 8 a respiração (o corpo desce um pixel com os pés
// no chão) e 9 a piscada. Na caminhada, "perna" vai de -1 a 1 (quanto a perna da frente está adiantada,
// seguindo um seno) e "corpo" é quanto o tronco desce: nada quando as pernas se cruzam (o corpo passa
// por cima, no alto) e 1 pixel quando os pés abrem e pisam (o peso cai). Os pés nunca saem do chão.
const QUADROS_ANDAR = 8;
const PASSOS = [
  ...Array.from({ length: QUADROS_ANDAR }, (_, i) => ({
    perna: Math.round(Math.sin((i / QUADROS_ANDAR) * Math.PI * 2) * 100) / 100,
    corpo: [0, 0, 1, 1, 0, 0, 1, 1][i],
  })),
  { perna: 0, corpo: 0, respira: 1 },
  { perna: 0, corpo: 0, pisca: true },
];
const QUADRO_RESPIRA = QUADROS_ANDAR;
const QUADRO_PISCA = QUADROS_ANDAR + 1;
// quadros por segundo da caminhada (2 passadas completas por segundo)
const VELOCIDADE_ANDAR = 16;

// Qual quadro mostrar para quem está parado: respira devagar e pisca de vez em quando.
// (fase desencontra os moradores, para não piscarem todos juntos)
function quadroParado(t, fase = 0) {
  const tempo = t + fase;
  if (tempo % 3.7 < 0.13) return QUADRO_PISCA;
  return Math.floor(tempo * 1.4) % 2 ? QUADRO_RESPIRA : 0;
}

function paletaHeroi(a) {
  const olhos = a.corOlhos || "#3d8bd9";
  return {
    ...paletaAvatar(a), T: tom(a.pele, 1.12), z: tom(a.pele, 0.62), j: tom(a.corCabelo, 0.45),
    N: olhos, k: tom(olhos, 0.55), l: "#c95b6a", r: "#b85c5c",
    c: "#ece6d6", C: "#bdb3a0", U: "#3e3552", u: "#2a2338", J: "#b07a45", Z: "#e8e4dc", w: "#f4f7fb", v: "#4c9a2a",
  };
}

function pincelHeroi(ctx, p) {
  return {
    px: (x, y, c) => retangulo(ctx, x, y, 1, 1, p[c]),
    fx: (x1, x2, y, c) => retangulo(ctx, x1, y, x2 - x1 + 1, 1, p[c]),
    grade: (linhas, x0, y0) => desenharTexto(ctx, linhas, p, x0, y0),
    // o mesmo pincel com algumas cores trocadas (para as variações de armas e chapéus)
    trocar: (cores) => pincelHeroi(ctx, { ...p, ...cores }),
  };
}

// Armas e chapéus da loja que são variações de uma base: mesmo desenho, outros materiais.
// base = o item desenhado; cores = letras da paleta trocadas só nesse item.
const VARIACOES_ITEM = {
  cajadoSombrio: { base: "cajado", cores: { B: "#2b2540", b: "#1b1533", D: "#a8323e", G: "#ff4d6d", g: "#ffb3c1", X: "#8a1030", W: "#ffe0e6" } },
  cajadoSolar: { base: "cajado", cores: { B: "#f5c451", b: "#c9952a", D: "#ffffff", G: "#ff9f43", g: "#fff3b0", X: "#c46a1b" } },
  varinhaEstelar: { base: "varinha", cores: { B: "#e8e4dc", b: "#c9cbe0", G: "#ffd166", g: "#fff3b0" } },
  grimorioDourado: { base: "grimorio", cores: { R: "#c9952a", b: "#7a5a12", Z: "#fff3b0", D: "#ffffff", G: "#6ef0ff" } },
  grimorioProibido: { base: "grimorio", cores: { R: "#2b2540", b: "#120e2a", Z: "#8a84a6", D: "#7dff9a", G: "#7dff9a", g: "#c8ffd6", X: "#1f7a3d" } },
  orbeTempestade: { base: "orbe", cores: { G: "#b38cff", g: "#efe6ff", X: "#5a3aa6", W: "#ffffff" } },
  espadaGelo: { base: "espadaFerro", cores: { w: "#e6fdff", A: "#9fd4ff", a: "#4fa8ff" } },
  espadaSombria: { base: "espadaFerro", cores: { w: "#8a7ab8", A: "#3d3266", a: "#1b1533", b: "#7a1f3d" } },
  escudoDragao: { base: "espadaEscudo", cores: { M: "#8a1010", n: "#c0392b", D: "#f5c451", a: "#5c3418", A: "#c9952a" } },
  machadoDourado: { base: "machado", cores: { A: "#f5c451", a: "#c9952a", w: "#fff3b0", B: "#7a1f3d", b: "#5a1530" } },
  marteloTrovao: { base: "martelo", cores: { A: "#9fd4ff", a: "#4f6fbf", w: "#ffffff", D: "#ffd166", B: "#3a3f4b", b: "#23262e" } },
  arcoGelo: { base: "arco", cores: { B: "#9fd4ff", b: "#4fa8ff", J: "#e6fdff", Z: "#e6fdff", D: "#4fa8ff" } },
  arcoSombrio: { base: "arco", cores: { B: "#3d3266", b: "#1b1533", J: "#a98bff", Z: "#a98bff", D: "#a8323e" } },
  arcoFlorido: { base: "arcoElfico", cores: { G: "#ff9fb2", g: "#ffd1dc", c: "#7dff9a", C: "#4c9a2a", D: "#ff7ad9" } },
  bestaPesada: { base: "besta", cores: { a: "#4a4a55", A: "#8a8b99", R: "#ffd166", B: "#3d220e", b: "#2a1608" } },
  bestaRunica: { base: "besta", cores: { A: "#6ef0ff", a: "#2e7bd0", R: "#6ef0ff", c: "#e6fdff", B: "#2b2540", b: "#1b1533" } },
};
const VARIACOES_CHAPEU = {
  pontudoEstrelado: { base: "pontudo", cores: { M: "#1b1b4f", m: "#12123a", n: "#2e2e7a", V: "#0b0b26", D: "#f5c451", d: "#c9952a", Q: "#fff3b0" } },
  pontudoFogo: { base: "pontudo", cores: { M: "#a8323e", m: "#7a1f2a", n: "#d9544f", V: "#4a1018", D: "#ff9f43", d: "#c46a1b", Q: "#ffd166", G: "#ff7a1a", X: "#c0392b" } },
  capuzArcano: { base: "capuz", cores: { M: "#5a3aa6", m: "#3f2a85", n: "#7b61d1", V: "#24184d", D: "#6ef0ff", Y: "#6ef0ff" } },
  elmoDourado: { base: "elmoFerro", cores: { A: "#f5c451", a: "#c9952a", w: "#fff3b0", B: "#a8323e", b: "#7a1f3d" } },
  elmoSombrio: { base: "elmoFerro", cores: { A: "#4a4a55", a: "#2b2b35", w: "#8a8b99", B: "#a8323e", b: "#7a1f3d" } },
  bandanaGuerra: { base: "bandana", cores: { D: "#a8323e", d: "#7a1f3d", Q: "#ffd166" } },
  cacadorReal: { base: "cacador", cores: { M: "#7a1f3d", m: "#5a1530", n: "#a8325a", Q: "#ffd166", D: "#f5c451", d: "#c9952a" } },
  cacadorNoturno: { base: "cacador", cores: { M: "#23235e", m: "#16163f", n: "#3a3a8a", Q: "#a98bff", D: "#e6fdff", d: "#8a84a6" } },
  capuzFloresta: { base: "capuz", cores: { M: "#2f6e1c", m: "#1f4a12", n: "#4c9a2a", V: "#163a0e", D: "#c9952a", Y: "#c9952a" } },
};

// Os efeitos dos itens raros, desenhados por cima do herói (no mapa e na vitrine do criador):
// cor (rgb) e o tipo de partícula. Os lendários soltam mais partículas e ganham um anel pulsando no chão.
const EFEITOS_ITEM = {
  cajadoSombrio: { raridade: "epico", cor: "255, 77, 109", tipo: "fumaca" },
  cajadoSolar: { raridade: "epico", cor: "255, 209, 102", tipo: "faisca" },
  grimorioDourado: { raridade: "epico", cor: "255, 243, 176", tipo: "faisca" },
  orbeTempestade: { raridade: "epico", cor: "179, 140, 255", tipo: "raio" },
  espadaGelo: { raridade: "epico", cor: "159, 212, 255", tipo: "neve" },
  espadaSombria: { raridade: "epico", cor: "169, 139, 255", tipo: "fumaca" },
  machadoDourado: { raridade: "epico", cor: "245, 196, 81", tipo: "faisca" },
  arcoGelo: { raridade: "epico", cor: "159, 212, 255", tipo: "neve" },
  arcoSombrio: { raridade: "epico", cor: "169, 139, 255", tipo: "fumaca" },
  bestaPesada: { raridade: "epico", cor: "255, 209, 102", tipo: "faisca" },
  grimorioProibido: { raridade: "lendario", cor: "125, 255, 154", tipo: "fumaca" },
  escudoDragao: { raridade: "lendario", cor: "255, 106, 40", tipo: "brasa" },
  marteloTrovao: { raridade: "lendario", cor: "159, 212, 255", tipo: "raio" },
  bestaRunica: { raridade: "lendario", cor: "110, 240, 255", tipo: "runa" },
  espada: { raridade: "lendario", cor: "110, 240, 255", tipo: "runa" },
};
const EFEITOS_CHAPEU = {
  pontudoFogo: { raridade: "epico", cor: "255, 122, 26", tipo: "brasa" },
  elmoDourado: { raridade: "epico", cor: "255, 243, 176", tipo: "faisca" },
  cacadorReal: { raridade: "epico", cor: "255, 209, 102", tipo: "faisca" },
};

// Uma partícula de efeito. p vai de 0 a 1 ao longo da vida dela (tudo calculado pelo tempo, sem estado).
function particulaDeEfeito(ctx, tipo, cor, x, y, p, t, i) {
  const alfa = Math.sin(p * Math.PI);
  if (tipo === "raio") {
    if ((Math.floor(t * 10) + i) % 4) return; // o raio pisca
    ctx.fillStyle = `rgba(${cor}, ${alfa})`;
    [[0, 0], [1, 1], [0, 2], [1, 3]].forEach(([dx, dy]) => ctx.fillRect(Math.round(x + dx), Math.round(y - p * 6 + dy), 1, 1));
    ctx.fillStyle = `rgba(255, 255, 255, ${alfa})`;
    ctx.fillRect(Math.round(x), Math.round(y - p * 6), 1, 1);
    return;
  }
  // os efeitos dos itens da Casa da Forja
  if (tipo === "bolha") {
    // a bolha sobe balançando e estoura no fim (3 pinguinhos para fora)
    const bx = x + Math.sin(p * 7 + i) * 2;
    const by = y - p * 14;
    if (p > 0.86) {
      ctx.fillStyle = `rgba(${cor}, ${(1 - p) * 5})`;
      [[-2, 0], [2, 0], [0, -2]].forEach(([dx, dy]) => ctx.fillRect(Math.round(bx + dx), Math.round(by + dy), 1, 1));
      return;
    }
    ctx.fillStyle = `rgba(${cor}, ${alfa * 0.8})`;
    ctx.fillRect(Math.round(bx), Math.round(by), 2, 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${alfa * 0.8})`;
    ctx.fillRect(Math.round(bx), Math.round(by), 1, 1);
    return;
  }
  if (tipo === "areia") {
    // grãos que o vento leva de lado, caindo devagar
    const lado = i % 2 ? 1 : -1;
    ctx.fillStyle = `rgba(${cor}, ${alfa * 0.9})`;
    ctx.fillRect(Math.round(x + lado * p * 12 + Math.sin(t * 4 + i) * 0.6), Math.round(y - 4 + p * 8 + Math.sin(p * 9) * 1.5), 1, 1);
    return;
  }
  if (tipo === "estrela") {
    // estrelinhas em cruz que acendem e apagam em volta
    const sx = Math.round(x + Math.sin(i * 2.7) * 6);
    const sy = Math.round(y - 6 - p * 6 + Math.cos(i * 1.9) * 4);
    ctx.fillStyle = `rgba(${cor}, ${alfa})`;
    ctx.fillRect(sx, sy, 1, 1);
    if (alfa > 0.55) {
      ctx.fillStyle = `rgba(${cor}, ${(alfa - 0.55) * 2})`;
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => ctx.fillRect(sx + dx, sy + dy, 1, 1));
    }
    if (alfa > 0.9) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillRect(sx, sy, 1, 1);
    }
    return;
  }
  if (tipo === "vazio") {
    // a luz em volta é puxada para dentro, girando
    const angulo = i * 2.4 + t * 1.6;
    const raio = (1 - p) * 11;
    ctx.fillStyle = `rgba(${cor}, ${Math.min(1, p * 1.6) * (1 - p * 0.3)})`;
    ctx.fillRect(Math.round(x + Math.cos(angulo) * raio), Math.round(y - 6 + Math.sin(angulo) * raio * 0.7), p > 0.7 ? 1 : 2, 1);
    return;
  }
  if (tipo === "chama") {
    // labaredas que sobem e mudam do amarelo para o vermelho
    const fogo = p < 0.3 ? "255, 243, 176" : p < 0.6 ? cor : "217, 56, 30";
    ctx.fillStyle = `rgba(${fogo}, ${alfa})`;
    const fx = Math.round(x + Math.sin(t * 9 + i * 1.3) * (1 + p));
    const fy = Math.round(y - p * 20);
    ctx.fillRect(fx, fy, p < 0.45 ? 2 : 1, p < 0.45 ? 2 : 1);
    return;
  }
  const dy = tipo === "neve" ? p * 14 : -p * 18; // a neve cai, o resto sobe
  const dx = tipo === "fumaca" ? Math.sin(p * 6 + i) * 2 : tipo === "runa" ? 0 : Math.sin(t * 3 + i) * 0.8;
  const tamanho = tipo === "runa" || (tipo === "fumaca" && p < 0.5) ? 2 : 1;
  const brilho = tipo === "brasa" && (Math.floor(t * 12) + i) % 3 === 0 ? "255, 240, 180" : cor;
  ctx.fillStyle = `rgba(${brilho}, ${tipo === "fumaca" ? alfa * 0.7 : alfa})`;
  ctx.fillRect(Math.round(x + dx), Math.round(y + dy), tamanho, tamanho);
}

// Desenha o brilho e as partículas dos itens raros que o herói está usando. (x0, y0) é o canto de cima
// do quadro do herói no ctx; t é o tempo em segundos; direcao diz em que mão a arma está
// ("baixo": à direita do quadro; "cima": de costas, do outro lado; "lado": na frente do corpo).
function desenharEfeitosHeroi(ctx, escolhas, t, x0 = 0, y0 = 0, direcao = "baixo") {
  const a = escolhasCompletas(escolhas);
  const efeitos = [[EFEITOS_ITEM[a.item], "item"], [EFEITOS_CHAPEU[a.chapeu], "chapeu"]].filter(([e]) => e);
  const xMao = { baixo: 25, cima: 6, lado: 18 }[direcao] ?? 25;
  efeitos.forEach(([e, onde]) => {
    const lendario = e.raridade === "lendario";
    // onde o efeito nasce: na mão da arma (e ao longo dela) ou em volta do chapéu
    const [cx, cy, alto] = onde === "item" ? [x0 + xMao, y0 + 30, 22] : [x0 + 16, y0 + 8, 6];
    // o brilho fica na mão (ou no chapéu), longe do rosto
    brilhoRedondo(ctx, Math.round(cx), Math.round(onde === "item" ? cy - 2 : cy), lendario ? 8 : e.raridade === "raro" ? 4 : 6, e.cor, (lendario ? 0.13 : e.raridade === "raro" ? 0.05 : 0.08) + Math.sin(t * 3) * 0.03);
    if (lendario && onde === "item") {
      // anel de poder pulsando no chão, embaixo dos pés: em pixel, pontilhado, com um segundo anel atrás
      [0, 0.5].forEach((atraso) => {
        const k = (t * 0.9 + atraso) % 1;
        const raio = 9 + k * 6;
        ctx.fillStyle = `rgba(${e.cor}, ${0.85 * (1 - k)})`;
        for (let a = 0; a < 36; a++) {
          if ((a + Math.floor(t * 10)) % 4 === 0) continue;
          const ang = (a / 36) * Math.PI * 2;
          ctx.fillRect(Math.round(x0 + 16 + Math.cos(ang) * raio), Math.round(y0 + PE_HEROI - 1 + Math.sin(ang) * raio / 3), 1, 1);
        }
      });
    }
    // épicos e lendários piscam estrelinhas de quatro pontas em volta da arma (ou do chapéu)
    if (e.raridade === "epico" || lendario) {
      const estrelas = lendario ? 3 : 1;
      for (let i = 0; i < estrelas; i++) {
        const ciclo = (t * 0.8 + i * 0.37) % 1;
        const forca = Math.max(0, Math.sin(ciclo * Math.PI * 2));
        if (forca < 0.2) continue;
        const sx = Math.round(cx + Math.sin(i * 4.1 + Math.floor(t * 0.8 + i * 0.37) * 2.3) * 5);
        const sy = Math.round(cy - ((i * 9 + Math.floor(t * 0.8 + i * 0.37) * 5) % alto));
        ctx.fillStyle = `rgba(${e.cor}, ${forca})`;
        const tam = lendario && forca > 0.8 ? 2 : 1;
        for (let k = 1; k <= tam; k++) {
          ctx.fillRect(sx - k, sy, 1, 1);
          ctx.fillRect(sx + k, sy, 1, 1);
          ctx.fillRect(sx, sy - k, 1, 1);
          ctx.fillRect(sx, sy + k, 1, 1);
        }
        ctx.fillStyle = `rgba(255, 255, 255, ${forca})`;
        ctx.fillRect(sx, sy, 1, 1);
      }
    }
    // quanto mais raro, mais partículas: raro 2, épico 3, lendário 7 (com o anel no chão)
    const quantas = lendario ? 7 : e.raridade === "raro" ? 2 : 3;
    for (let i = 0; i < quantas; i++) {
      const p = (t * (e.tipo === "runa" ? 0.35 : 0.7) + i / quantas) % 1;
      if (e.tipo === "runa") {
        // runas girando em volta da arma
        const ang = t * 2.2 + (i / quantas) * Math.PI * 2;
        particulaDeEfeito(ctx, e.tipo, e.cor, cx + Math.cos(ang) * 6, cy - alto / 2 + Math.sin(ang) * alto / 2, p, t, i);
      } else {
        particulaDeEfeito(ctx, e.tipo, e.cor, cx - 3 + ((i * 5) % 7), cy - ((i * 7) % alto), p, t, i);
      }
    }
  });
}

function baseDoItem(item) {
  return VARIACOES_ITEM[item]?.base || item;
}

// As escolhas completas: quem não escolheu vocação (avatares antigos e moradores) ganha a que combina com o item.
// A arma não é trocada: um troféu equipado (como a Lâmina Rúnica) vale para qualquer vocação.
function escolhasCompletas(escolhas) {
  const a = { ...AVATAR_PADRAO, ...(escolhas || {}) };
  if (!escolhas?.kit) a.kit = kitDoItem(a.item);
  return a;
}

// O desenho do corpo muda um pouco com o tipo de corpo: ombros, cintura e onde ficam os braços.
// Ombros largos e cintura marcada deixam o corpo de adulto (no feminino, ombros mais estreitos e quadril).
function formaDoCorpo(a) {
  const fem = a.corpo === "feminino";
  return {
    fem,
    tronco: (y) => (fem
      ? (y <= 26 ? [9, 22] : y <= 29 ? [10, 21] : [9, 22])
      : (y <= 28 ? [8, 23] : [9, 22])),
    bracos: fem ? [6, 23] : [5, 24],
  };
}

// ---------- cabeça e rosto ----------

const CABECA_FRENTE = [
  "...........SSSSSSSSSS...........",
  "..........STSSSSSSSSSS..........",
  ".........STSSSSSSSSSSss.........",
  ".........SSSSSSSSSSSSSs.........",
  ".........SSSSSSSSSSSSSs.........",
  ".........SSSSSSSSSSSSSs.........",
  "........sSSSSSSSSSSSSSss........",
  "........SSSSSSSSSSSSSSss........",
  ".........SSSSSSSSSSSSSs.........",
  ".........SSSSSSSSSSSSSs.........",
  "..........SSSSSSSSSSSs..........",
  "...........sSSSSSSSss...........",
  "............ssssssss............",
  "..............ssss..............",
  "..............ssss..............",
];

const CABECA_LADO = [
  "............SSSSSSSS............",
  "...........STSSSSSSSS...........",
  "..........STSSSSSSSSSS..........",
  "..........SSSSSSSSSSSS..........",
  "..........SSSSSSSSSSSS..........",
  "..........SSSSSSSSSSSS..........",
  "..........SSSsSSSSSSSS..........",
  "..........SSsSsSSSSSSSS.........",
  "..........SSSsSSSSSSSSS.........",
  "..........sSSSSSSSSSSss.........",
  "...........sSSSSSSSSSs..........",
  "............sSSSSSSSs...........",
  "..............ssssss............",
  "..............ssss..............",
  "..............ssss..............",
];

// Olho de adulto: pálpebra de cima escura e a íris (cor dos olhos) com a pupila do lado de dentro, sem o
// brilho grande de desenho infantil.
function olhoAberto(d, x1, x2, alto, cilio) {
  d.fx(x1, x2, 15 + alto, "E");
  if (cilio !== null) d.px(cilio, 15 + alto, "E");
  if (alto) d.fx(x1, x2, 15, "N");
  const dentro = x1 < 16 ? x2 : x1; // a pupila fica perto do nariz
  d.px(dentro === x2 ? x1 : x2, 16, "N");
  d.px(dentro, 16, "k");
}

// olho fechado sorrindo: um "^" de 4 pixels
function olhoFechado(d, x1) {
  d.px(x1 - 1, 17, "E");
  d.fx(x1, x1 + 1, 16, "E");
  d.px(x1 + 2, 17, "E");
}

function rostoFrente(d, a, f, pisca = false) {
  const r = a.rosto;
  const alto = r === "surpreso" ? -1 : 0;
  const esquerdo = f.fem ? 10 : null;
  const direito = f.fem ? 21 : null;
  if (pisca) {
    // piscando: os olhos viram uma linha
    d.fx(10, 12, 16, "E");
    d.fx(19, 21, 16, "E");
  } else if (r === "alegre") {
    olhoFechado(d, 11);
    olhoFechado(d, 19);
  } else {
    olhoAberto(d, 11, 12, alto, esquerdo);
    if (r === "piscadela") olhoFechado(d, 19);
    else olhoAberto(d, 19, 20, alto, direito);
  }
  // sobrancelhas de adulto: grossas no masculino, finas e arqueadas no feminino
  if (r === "bravo") {
    d.fx(10, 12, 14, "h");
    d.fx(19, 21, 14, "h");
    d.px(12, 15, "j");
    d.px(19, 15, "j");
  } else if (r === "surpreso") {
    d.fx(10, 12, 13, "h");
    d.fx(19, 21, 13, "h");
  } else if (r === "confiante") {
    d.fx(10, 12, 14, "h");
    d.fx(19, 21, 13, "h");
  } else if (f.fem) {
    d.px(10, 14, "h");
    d.px(11, 13, "h");
    d.px(12, 13, "h");
    d.px(19, 13, "h");
    d.px(20, 13, "h");
    d.px(21, 14, "h");
  } else {
    d.fx(10, 12, 14, "h");
    d.fx(19, 21, 14, "h");
    d.px(11, 13, "h");
    d.px(20, 13, "h");
  }
  // nariz: a sombra de um lado e a ponta
  d.px(16, 16, "s");
  d.px(16, 17, "s");
  d.px(15, 18, "z");
  d.px(16, 18, "s");
  // bochecha corada só na cara tímida; nos outros, só a sombra da maçã do rosto
  if (r === "timido") [[10, 18], [11, 18], [20, 18], [21, 18]].forEach(([x, y]) => d.px(x, y, "P"));
  else [[21, 18], [22, 17]].forEach(([x, y]) => d.px(x, y, "s"));
  // boca mais larga, com dentes no sorriso aberto
  const labio = f.fem ? "l" : "R";
  const boca = {
    sorriso: [[13, 19, "E"], [18, 19, "E"], [14, 20, "E"], [15, 20, "W"], [16, 20, "W"], [17, 20, "E"], [15, 21, labio], [16, 21, labio]],
    alegre: [[13, 19, "E"], [14, 19, "E"], [15, 19, "E"], [16, 19, "E"], [17, 19, "E"], [18, 19, "E"], [14, 20, "W"], [15, 20, "W"], [16, 20, "W"], [17, 20, "W"], [15, 21, labio], [16, 21, labio]],
    confiante: [[13, 20, "E"], [14, 20, "E"], [15, 20, "E"], [16, 20, "E"], [17, 19, "E"], [18, 19, "E"]],
    serio: [[14, 20, "E"], [15, 20, "E"], [16, 20, "E"], [17, 20, "E"]],
    bravo: [[13, 21, "E"], [14, 20, "E"], [15, 20, "E"], [16, 20, "E"], [17, 20, "E"], [18, 21, "E"]],
    surpreso: [[15, 19, "E"], [16, 19, "E"], [14, 20, "E"], [17, 20, "E"], [15, 21, "E"], [16, 21, "E"], [15, 20, labio], [16, 20, labio]],
    piscadela: [[13, 19, "E"], [14, 20, "E"], [15, 20, "E"], [16, 20, "E"], [17, 20, "E"], [18, 19, "E"]],
    timido: [[15, 20, labio], [16, 20, labio]],
  }[r] || [];
  boca.forEach(([x, y, c]) => d.px(x, y, c));
  if (f.fem && (r === "serio" || r === "confiante")) [[15, 21], [16, 21]].forEach(([x, y]) => d.px(x, y, "l"));
  // mandíbula marcada no masculino: a sombra nos cantos de baixo do rosto
  if (!f.fem) {
    d.px(11, 20, "z");
    d.px(20, 20, "z");
    d.px(12, 21, "z");
    d.px(19, 21, "z");
  }
}

function rostoLado(d, a, f, pisca = false) {
  const r = a.rosto;
  const alto = r === "surpreso" ? -1 : 0;
  if (pisca) d.fx(19, 21, 16, "E");
  else if (r === "alegre") {
    d.px(18, 17, "E");
    d.fx(19, 20, 16, "E");
    d.px(21, 17, "E");
  } else {
    d.fx(19, 20, 15 + alto, "E");
    if (f.fem) d.px(21, 14 + alto, "E");
    d.px(19, 16, "N");
    d.px(20, 16, "k");
  }
  d.fx(18, 20, r === "bravo" ? 14 : 13, "h");
  if (!f.fem) d.px(19, 14, "h"); // sobrancelha grossa
  if (r === "timido") {
    d.px(19, 18, "P");
    d.px(20, 18, "P");
  } else d.px(19, 18, "s");
  d.px(21, 19, r === "surpreso" ? (f.fem ? "l" : "R") : "E");
  if (r === "sorriso" || r === "alegre") d.px(20, 19, "E");
}

// ---------- cabelo ----------

// A "touca" de cabelo de cada direção (o corte curto); os outros estilos somam mechas por cima dela.
const TOUCA = {
  frente: [
    "......hHHHHh......",
    "....hHHHIIHHHh....",
    "...hHHHIIHHHHHh...",
    "..hHHHIIHHHHHHHh..",
    ".hHHHIIHHHHHHHHHh.",
    ".hHHHIHHHHHHHHHHh.",
    ".hHHHHHHhhHHHHHHh.",
    ".hHHhHHh..hHHhHHh.",
    ".hHh..h....h..hHh.",
  ],
  costas: [
    "......hHHHHh......",
    "....hHHHIIHHHh....",
    "...hHHHIIHHHHHh...",
    "..hHHHIIHHHHHHHh..",
    ".hHHHIIHHHHHHHHHh.",
    ".hHHHIHHHHHHHHHHh.",
    ".hHHHHHHHHHHHHHHh.",
    ".hHHHHHHHHHHHHHHh.",
    ".hHHHHHHHHHHHHHhh.",
    ".hHHHHhHHHHhHHHhh.",
    ".hhHHhHHHHHHhHhhh.",
    "..hhHHhHHhHHhhhh..",
    "...hhhHhhHhhhhh...",
    "....hhhhhhhhhh....",
    "....hhhhhhhhhh....",
    ".....hhhhhhhh.....",
  ],
  lado: [
    "......hHHHHh......",
    "....hHHHIIHHHh....",
    "...hHHHIIHHHHHh...",
    "..hHHHIIHHHHHHHh..",
    "..hHHIIHHHHHHHHHh.",
    "..hHHHHHHHHHHHHHh.",
    "..hHHHHHHHHHHhHHh.",
    "..hHHHHHHHHh.hHh..",
    "..hHHHHHHh...h....",
    "..hHHh............",
    "..hHHh............",
    "..hhHh............",
    "...hh.............",
  ],
};

// franja lateral: a mecha varre a testa de um lado para o outro
const FRANJA_LATERAL = [
  "......hHHHHh......",
  "....hHHHIIHHHh....",
  "...hHHHIIHHHHHh...",
  "..hHHHIIHHHHHHHh..",
  ".hHHHIIHHHHHHHHHh.",
  ".hHIIHHHHHHHHHHHh.",
  ".hHHHHHHHHHHHHHhh.",
  ".hHHHHHHHHHhhh.Hh.",
  ".hHHHHhhh......hh.",
];

const ESPETOS = [
  ".........H........",
  "....h...HH....h...",
  "....HH..HI...HH...",
  "..h.HHHhHIH.HHH.h.",
  "..hHHIHHHIHHHHHHh.",
];

// estilos que crescem para cima: somem debaixo de chapéus de verdade
const CHAPEUS_ABERTOS = ["nenhum", "tiara", "bandana"];

function tranca(d, x, y1, y2) {
  for (let y = y1; y <= y2; y++) {
    const fase = (y - y1) % 3;
    d.fx(x, x + 2, y, fase === 2 ? "h" : "H");
    d.px(fase === 0 ? x : x + 2, y, "I");
  }
  d.fx(x, x + 2, y2 + 1, "D");
  d.fx(x, x + 2, y2 + 2, "H");
  d.px(x + 1, y2 + 3, "h");
}

function chiquinha(d, x, y) {
  d.grade([".hHHh.", "hHIHHh", "HIHHHh", "HHHHHh", "hHHHhh", ".hHhh.", "..hh.."], x, y);
}

// o que fica atrás da cabeça (volume do cacheado, rabo de cavalo, cabelo longo pelas costas)
function cabeloAtras(d, a, dir) {
  const c = a.cabelo;
  if (c === "cacheado") {
    for (let y = 4; y <= (dir === "costas" ? 22 : 20); y++) {
      const meia = Math.round(Math.sqrt(Math.max(0, 110 - (y - 12) ** 2))) + 1;
      for (let x = Math.max(4, 16 - meia); x <= Math.min(27, 15 + meia); x++) {
        d.px(x, y, (x + y * 2) % 5 === 0 ? "I" : (x * 3 + y) % 4 === 0 ? "h" : "H");
      }
    }
  }
  if (c === "rabo" && dir === "frente") {
    for (let y = 11; y <= 24; y++) d.fx(23, 25 - (y > 21 ? 1 : 0), y, y % 4 === 0 ? "I" : "H");
  }
  if (c === "rabo" && dir === "lado") {
    d.fx(8, 9, 10, "D");
    for (let y = 11; y <= 26; y++) d.fx(5 + (y > 20 ? 1 : 0), 8, y, y % 4 === 0 ? "I" : y % 3 ? "H" : "h");
  }
  if (c === "longo" && dir === "lado") for (let y = 18; y <= 30; y++) d.fx(9, 13, y, y % 3 ? "H" : "h");
}

function cabeloHeroi(d, a, dir) {
  const c = a.cabelo;
  const topoLivre = CHAPEUS_ABERTOS.includes(VARIACOES_CHAPEU[a.chapeu]?.base || a.chapeu);
  if (c === "raspado" || c === "moicano") {
    d.fx(11, 20, 9, "h");
    d.fx(10, 21, 10, "h");
    if (dir !== "lado") [12, 15, 18].forEach((x) => d.px(x, 10, "j"));
    else d.fx(9, 12, 11, "h");
    if (c === "moicano" && topoLivre) {
      const x0 = dir === "lado" ? 12 : 14;
      for (let y = 2; y <= 10; y++) d.fx(x0, x0 + 3, y, y < 4 ? "h" : "H");
      for (let y = 3; y <= 8; y++) d.px(x0 + 1, y, "I");
    }
    return;
  }
  if (c === "espetado" && topoLivre) d.grade(ESPETOS, 7, 1);
  if (c === "coque" && topoLivre) d.grade(["..hHHh..", ".hHIIHh.", ".hHHHHh.", "..DDDD.."], 12, 2);
  d.grade(c === "franja" && dir === "frente" ? FRANJA_LATERAL : TOUCA[dir], 7, 6);

  if (c === "longo") {
    if (dir === "frente") {
      // mechas na frente dos ombros, cobrindo as orelhas
      for (let y = 14; y <= 29; y++) {
        const ponta = y >= 28;
        d.fx(ponta ? 8 : 7, 9, y, "H");
        d.px(ponta ? 8 : 7, y, "h");
        if (y % 5 === 2) d.px(9, y, "I");
        d.fx(22, ponta ? 23 : 24, y, "H");
        d.px(ponta ? 23 : 24, y, "h");
        d.px(22, y, y % 4 === 1 ? "h" : "H");
      }
    }
    if (dir === "costas") for (let y = 20; y <= 32; y++) d.fx(y > 30 ? 10 : 9, y > 30 ? 21 : 22, y, y % 3 ? "H" : "h");
  }
  if (c === "rabo" && dir === "costas") {
    d.fx(14, 17, 10, "D");
    for (let y = 11; y <= 29; y++) d.fx(14 + (y > 25 ? 1 : 0), 17 - (y > 25 ? 1 : 0), y, y % 4 === 0 ? "I" : y % 3 ? "H" : "h");
  }
  if (c === "trancas") {
    if (dir === "frente") {
      tranca(d, 7, 15, 28);
      tranca(d, 22, 15, 28);
    } else if (dir === "costas") {
      tranca(d, 10, 20, 30);
      tranca(d, 19, 20, 30);
    } else tranca(d, 9, 17, 28);
  }
  if (c === "chiquinhas") {
    if (dir === "lado") chiquinha(d, 4, 9);
    else {
      chiquinha(d, 3, 9);
      chiquinha(d, 23, 9);
    }
  }
  if (c === "cacheado" && dir === "frente") {
    for (let y = 12; y <= 18; y++) {
      d.fx(6, 8, y, y % 2 ? "H" : "h");
      d.fx(23, 25, y, y % 2 ? "h" : "H");
    }
  }
}

// ---------- chapéus ----------

function capacete(d, dir, comChifres) {
  d.grade([
    "......aAAAAa......",
    "....aAAwwAAAAa....",
    "...aAAwAAAAAAAa...",
    "..aAAwAAAAAAAAAa..",
    "..aAAAAAAAAAAAAa..",
    ".aAAAAAAAAAAAAAAa.",
    comChifres ? ".yYYYYYYYYYYYYYYy." : ".aaaaaaaaaaaaaaaa.",
    ".aAAAAAAaaAAAAAAa.",
    ...(dir === "costas" ? [
      ".aAAAAAAAAAAAAAAa.", ".aAAAAAAAAAAAAAAa.", ".aAAAAAAAAAAAAAAa.", ".aAAAAAAAAAAAAAAa.",
      ".aaAAAAAAAAAAAAaa.", "..aaaaaaaaaaaaaa..", "...aaaaaaaaaaaa...",
    ] : dir === "lado" ? [
      ".aAAAAAAAAAa......", ".aAAAAAAAAa.......", ".aAAAAAAAAa.......", ".aAAAAAAAAa.......",
      ".aAAAAAAAAAa......", "..aAAAAAAAa.......", "...aaaaaa.........",
    ] : [
      ".aAa....aa....aAa.", ".aAa....aa....aAa.", ".aAa..........aAa.", ".aAa..........aAa.",
      ".aAAa........aAAa.", "..aAa........aAa..", "...aa........aa...",
    ]),
  ], 7, 5);
  if (comChifres) {
    // chifres de dragão e a crista vermelha
    [[7, 10], [6, 9], [5, 8], [5, 7], [5, 6], [6, 5]].forEach(([x, y], i) => {
      d.px(x, y, i > 3 ? "W" : "Z");
      if (dir !== "lado") d.px(31 - x, y, i > 3 ? "W" : "Z");
    });
    d.fx(14, 17, 4, "R");
    d.fx(15, 16, 3, "R");
    d.px(16, 2, "R");
  } else {
    // elmo de ferro: rebites e a crista de couro
    [9, 12, 19, 22].forEach((x) => d.px(x, 11, "w"));
    d.fx(15, 16, 3, "B");
    d.fx(15, 16, 4, "b");
  }
}

function chapeuHeroi(d, a, dir) {
  const variacao = VARIACOES_CHAPEU[a.chapeu];
  if (variacao) return chapeuHeroi(d.trocar(variacao.cores), { ...a, chapeu: variacao.base }, dir);
  switch (a.chapeu) {
    case "pontudo": {
      // cone que dobra na ponta (para trás quando o herói está de lado)
      const lado = dir === "lado" ? -1 : 1;
      for (let r = 1; r <= 9; r++) {
        const centro = 15.5 + (9 - r) * 0.5 * lado;
        const meia = 0.5 + (r - 1) * 0.85;
        const x1 = Math.round(centro - meia);
        const x2 = Math.round(centro + meia);
        const faixa = r >= 8;
        d.fx(x1, x2, r, faixa ? (r === 8 ? "D" : "d") : "M");
        if (!faixa) {
          d.px(x1, r, "n");
          d.px(x2, r, "m");
          if (x2 - x1 > 3) d.px(x2 - 1, r, "m");
        }
        if (r === 1) d.px(lado > 0 ? x2 + 1 : x1 - 1, 0, "m");
      }
      if (dir === "frente") {
        d.fx(15, 16, 8, "G");
        d.px(15, 9, "X");
        d.px(16, 9, "G");
      }
      d.px(dir === "lado" ? 14 : 16, 4, "Q");
      d.px(dir === "lado" ? 16 : 13, 6, "Q");
      d.fx(4, 27, 10, "M");
      d.fx(4, 7, 10, "n");
      d.fx(24, 27, 10, "m");
      d.fx(5, 26, 11, "m");
      d.fx(7, 24, 12, "V");
      break;
    }
    case "capuz":
      d.fx(12, 19, 7, "M");
      d.fx(10, 21, 8, "M");
      d.fx(9, 22, 9, "M");
      d.fx(8, 23, 10, "M");
      d.fx(8, 23, 11, "M");
      d.fx(9, 12, 8, "n");
      d.fx(8, 10, 9, "n");
      if (dir === "costas") {
        for (let y = 12; y <= 25; y++) d.fx(8, 23, y, y > 22 ? "m" : "M");
        for (let y = 9; y <= 24; y++) d.px(15, y, "m");
        break;
      }
      if (dir === "lado") {
        for (let y = 12; y <= 24; y++) d.fx(8, 14, y, y > 22 ? "m" : "M");
        d.fx(15, 21, 11, "D");
        for (let y = 12; y <= 21; y++) d.px(15, y, "D");
        break;
      }
      d.fx(10, 21, 11, "D");
      for (let y = 12; y <= 22; y++) {
        d.fx(7, 9, y, "M");
        d.px(7, y, "n");
        d.px(9, y, "D");
        d.fx(22, 24, y, "M");
        d.px(22, y, "D");
        d.px(24, y, "m");
      }
      d.fx(9, 22, 23, "M");
      d.fx(8, 23, 24, "M");
      d.fx(9, 22, 25, "m");
      d.fx(15, 16, 24, "Y");
      break;
    case "elmo":
      capacete(d, dir, true);
      break;
    case "elmoFerro":
      capacete(d, dir, false);
      break;
    case "bandana":
      d.fx(9, 22, 11, "D");
      d.fx(9, 22, 12, "d");
      [11, 15, 19].forEach((x) => d.px(x, 11, "Q"));
      // as pontas do nó balançando atrás da cabeça
      if (dir === "lado") d.grade(["DD..", "dDD.", ".dDD", "..dd"], 6, 11);
      else if (dir === "costas") d.grade(["..DD..", ".DddD.", "DD..DD", "d....d"], 13, 12);
      else d.grade(["DD.", "dDD", ".dD"], 23, 12);
      break;
    case "cacador": {
      // chapéu de caçador: copa inclinada, aba virada e uma pena comprida
      const pena = dir === "lado" ? 6 : 22;
      for (let y = 2; y <= 9; y++) {
        const x = pena + (dir === "lado" ? (9 - y) * -0.5 : (9 - y) * 0.6);
        d.px(Math.round(x), y, y % 2 ? "Q" : "D");
        d.px(Math.round(x) + (dir === "lado" ? 1 : -1), y + 1, "d");
      }
      d.fx(12, 19, 6, "M");
      d.fx(10, 21, 7, "M");
      d.fx(9, 22, 8, "M");
      d.fx(9, 22, 9, "M");
      d.fx(10, 13, 7, "n");
      d.fx(9, 22, 10, "b");
      d.px(20, 10, "Y");
      d.fx(5, 26, 11, "M");
      d.fx(5, 8, 11, "n");
      d.fx(6, 25, 12, "m");
      if (dir === "frente") d.fx(23, 27, 10, "m");
      break;
    }
    case "cartola":
      // cartola do ilusionista: copa alta, faixa colorida e aba larga
      for (let y = 2; y <= 9; y++) {
        d.fx(11, 20, y, "u");
        d.px(11, y, "U");
        d.px(12, y, "U");
      }
      d.fx(11, 20, 8, "D");
      d.fx(11, 20, 9, "d");
      d.px(19, 8, "Q");
      d.fx(7, 24, 10, "u");
      d.fx(8, 23, 11, "U");
      d.fx(8, 10, 10, "U");
      break;
    case "flores":
      // coroa de folhas com flores coloridas
      d.fx(9, 22, 11, "v");
      d.fx(10, 21, 10, "v");
      [[10, "R"], [13, "Y"], [16, "P"], [19, "W"], [22, "Y"]].forEach(([x, c]) => {
        if (dir === "costas" && x > 20) return;
        d.grade([".c.", "cCc", ".c."].map((l) => l.replace(/c/g, c === "W" ? "W" : c).replace("C", "Y")), x - 1, 8);
      });
      break;
    case "tiara":
      d.fx(9, 22, 11, "Y");
      d.px(9, 11, "y");
      d.px(22, 11, "y");
      if (dir !== "costas") d.grade([".g.", "gGX", ".X."], 14, 9);
      break;
    case "boina":
      d.fx(11, 21, 6, "M");
      d.fx(9, 23, 7, "M");
      d.fx(8, 24, 8, "M");
      d.fx(8, 24, 9, "M");
      d.fx(9, 23, 10, "m");
      d.fx(10, 13, 7, "n");
      d.px(16, 5, "D");
      break;
    case "coroa":
      [9, 13, 18, 22].forEach((x) => d.px(x, 5, "Y"));
      d.fx(9, 22, 6, "Y");
      d.fx(9, 22, 7, "Y");
      d.fx(9, 22, 8, "y");
      [11, 15, 16, 20].forEach((x) => d.px(x, 7, x === 15 || x === 16 ? "G" : "R"));
      break;
    default:
      break;
  }
}

// ---------- acessórios ----------

function acessorioHeroi(d, a, dir) {
  if (dir === "costas") {
    if (a.acessorio === "cachecol") {
      d.fx(10, 21, 22, "D");
      d.fx(10, 21, 23, "d");
    }
    if (a.acessorio === "tapaolho") d.fx(9, 22, 12, "E");
    return;
  }
  const lado = dir === "lado";
  switch (a.acessorio) {
    case "barba":
      if (lado) {
        for (let y = 17; y <= 22; y++) d.fx(15, 22 - Math.max(0, y - 19), y, y > 20 ? "h" : "H");
        d.px(21, 19, "E");
        break;
      }
      d.grade([
        "H............H",
        "HH..........HH",
        "HHHHHHEEHHHHHH",
        ".HHHHHRRHHHHH.",
        "..HHHHHHHHHH..",
        "...hHHHHHHh...",
        "....hhhhhh....",
        ".....hhhh.....",
      ], 9, 16);
      d.fx(13, 14, 19, "I");
      break;
    case "bigode":
      if (lado) {
        d.fx(19, 22, 18, "H");
        d.px(22, 19, "h");
        break;
      }
      d.fx(13, 18, 18, "H");
      d.px(12, 19, "h");
      d.px(19, 19, "h");
      d.fx(14, 15, 18, "I");
      break;
    case "cavanhaque":
      if (lado) {
        d.fx(19, 21, 20, "H");
        d.px(20, 21, "h");
        break;
      }
      d.fx(14, 17, 21, "H");
      d.fx(15, 16, 22, "h");
      d.fx(14, 17, 18, "h");
      break;
    case "oculos":
      // armação dourada: aparece até em pele e cabelo escuros
      if (lado) {
        d.fx(18, 21, 14, "y");
        d.fx(18, 21, 18, "y");
        [15, 16, 17].forEach((y) => d.px(18, y, "y"));
        d.fx(12, 17, 15, "y");
        break;
      }
      [[10, 13], [18, 21]].forEach(([x1, x2]) => {
        d.fx(x1, x2, 14, "y");
        d.fx(x1, x2, 18, "y");
        for (let y = 15; y <= 17; y++) {
          d.px(x1, y, "y");
          d.px(x2, y, "y");
        }
      });
      d.fx(14, 17, 15, "y");
      break;
    case "tapaolho":
      if (lado) {
        d.fx(19, 20, 15, "E");
        d.fx(19, 20, 16, "E");
        d.fx(19, 20, 17, "E");
        d.fx(12, 18, 14, "E");
        break;
      }
      for (let y = 15; y <= 17; y++) d.fx(18, 21, y, "E");
      d.px(19, 15, "u");
      d.fx(9, 17, 14, "E");
      d.px(22, 14, "E");
      break;
    case "sardas":
      (lado ? [[18, 18], [20, 19], [19, 19]] : [[10, 19], [12, 19], [11, 18], [19, 19], [21, 19], [20, 18]]).forEach(([x, y]) => d.px(x, y, "z"));
      break;
    case "cicatriz":
      (lado ? [[18, 17], [19, 18], [20, 19]] : [[18, 17], [19, 18], [20, 19], [21, 20]]).forEach(([x, y]) => d.px(x, y, "r"));
      break;
    case "cachecol":
      d.fx(11, 20, 22, "D");
      d.fx(10, 21, 23, "D");
      d.fx(10, 21, 24, "d");
      if (!lado) for (let y = 25; y <= 29; y++) d.fx(18, 19, y, y % 2 ? "D" : "d");
      break;
    case "brinco":
      d.grade(["G", "g"], lado ? 13 : 8, 17);
      break;
    default:
      break;
  }
}

// ---------- pernas ----------

function perna(d, a, x, sobe, interno, pe, escura) {
  const kit = a.kit;
  const calca = escura ? "u" : "U";
  const E = PERNA_EXTRA; // a coxa mais comprida empurra joelho, bota e pé para baixo
  const ate = (kit === "mago" ? 38 : 37) + E;
  for (let y = 36; y <= ate; y++) {
    d.fx(x, x + 4, y + sobe, calca);
    d.px(interno, y + sobe, "u");
  }
  if (!escura) d.px(interno === x ? x + 4 : x, 37 + sobe, "u"); // dobra do joelho
  if (kit === "guerreiro") {
    // grevas de metal, com a joelheira por cima
    for (let y = 38 + E; y <= 41 + E; y++) {
      d.fx(x, x + 4, y + sobe, escura ? "a" : "A");
      d.px(interno, y + sobe, "a");
      if (!escura) d.px(interno === x ? x + 4 : x, y + sobe, "w");
    }
    d.fx(x, x + 4, 39 + E + sobe, "a");
    d.fx(x + 1, x + 3, 37 + E + sobe, escura ? "a" : "A");
  } else {
    d.fx(x, x + 4, ate + 1 + sobe, escura ? "B" : "J");
    for (let y = ate + 2; y <= 41 + E; y++) {
      d.fx(x, x + 4, y + sobe, escura ? "b" : "B");
      d.px(interno, y + sobe, "b");
    }
  }
  const [p1, p2] = pe < 0 ? [x - 1, x + 4] : [x, x + 5];
  const bota = kit === "guerreiro" ? (escura ? "a" : "A") : escura ? "b" : "B";
  d.fx(p1, p2, 42 + E + sobe, bota);
  if (!escura) d.px(pe < 0 ? p1 + 1 : p2 - 1, 42 + E + sobe, kit === "guerreiro" ? "w" : "J");
  d.fx(p1, p2, 43 + E + sobe, "b");
}

// ---------- tronco de frente e de costas ----------

function baseTronco(d, f) {
  for (let y = 24; y <= 35; y++) {
    const [x1, x2] = f.tronco(y);
    d.fx(x1, x2, y, "M");
    d.px(x1, y, "n");
    d.px(x2, y, "m");
    if (y >= 27) d.px(x2 - 1, y, "m");
  }
}

function barra(d, f, y, cor = "D") {
  const [x1, x2] = f.tronco(y);
  d.fx(x1, x2, y, cor);
  [x1 + 1, 13, 18, x2 - 1].forEach((x) => d.px(x, y, "Q"));
}

function cinto(d, f, fivela = true) {
  const [x1, x2] = f.tronco(30);
  d.fx(x1, x2, 30, "b");
  if (fivela) {
    d.fx(15, 16, 30, "Y");
    d.px(16, 30, "y");
  }
}

function troncoMago(d, f, costas, vento = 0) {
  baseTronco(d, f);
  cinto(d, f, !costas);
  if (costas) {
    d.fx(12, 19, 24, "D");
    d.fx(13, 18, 25, "d");
    // runa bordada nas costas
    [[15, 26], [16, 26], [14, 27], [17, 27], [15, 28], [16, 28]].forEach(([x, y]) => d.px(x, y, "D"));
    for (let y = 31; y <= 34; y++) {
      d.px(15, y, "m");
      d.px(16, y, "V");
    }
  } else {
    // gola aberta mostrando a camisa, lapelas bordadas
    d.px(14, 24, "D");
    d.fx(15, 16, 24, "c");
    d.px(17, 24, "D");
    for (let y = 25; y <= 29; y++) {
      d.px(13, y, "D");
      d.fx(14, 17, y, "c");
      d.px(17, y, "C");
      d.px(18, y, "D");
    }
    d.px(15, 26, "C");
    d.px(15, 28, "C");
    for (let y = 31; y <= 34; y++) {
      d.px(14, y, "D");
      d.fx(15, 16, y, f.fem ? "c" : "U");
      d.px(17, y, "D");
    }
    // bolsinha de couro no cinto
    d.fx(19, 20, 31, "B");
    d.fx(19, 20, 32, "b");
    d.px(19, 31, "J");
  }
  d.px(11, 33, "m");
  d.px(11, 34, "m");
  barra(d, f, 35);
  if (!costas) d.fx(15, 16, 35, f.fem ? "C" : "U");
  // as abas do sobretudo descem até o joelho, com o debrum dourado na borda; andando, a barra balança
  // para o lado contrário do passo (vento = -1, 0 ou 1)
  const [b1, b2] = f.tronco(35);
  const fim = 37 + PERNA_EXTRA;
  for (let y = 36; y <= fim; y++) {
    const dx = y >= fim - 1 ? vento : 0;
    const x1 = b1 + dx;
    const x2 = b2 + dx;
    if (costas) {
      d.fx(x1, x2, y, "M");
      d.px(x2, y, "m");
      d.px(15 + dx, y, "m");
      d.px(16 + dx, y, "V");
    } else {
      d.fx(x1, x1 + 3, y, "M");
      d.fx(x2 - 3, x2, y, "M");
      d.px(x1 + 3, y, "D");
      d.px(x2 - 3, y, "D");
      d.px(x2, y, "m");
    }
  }
  if (costas) d.fx(b1 + vento, b2 + vento, fim, "D");
  else {
    d.fx(b1 + vento, b1 + 3 + vento, fim, "D");
    d.fx(b2 - 3 + vento, b2 + vento, fim, "D");
  }
}

// a capa atrás do corpo; andando, a ponta de baixo balança para o lado contrário do passo
function capaGuerreiro(d, vento = 0) {
  const fim = 41 + PERNA_EXTRA;
  for (let y = 24; y <= fim; y++) {
    const dx = y >= fim - 4 ? vento : 0;
    d.fx(7 + dx, 24 + dx, y, y % 6 === 0 ? "V" : "m");
  }
}

function troncoGuerreiro(d, f, costas, vento = 0) {
  if (costas) {
    // a capa cobre as costas inteiras (a barra balança andando)
    const barraCapa = 41 + PERNA_EXTRA;
    for (let y = 24; y <= barraCapa; y++) {
      const solta = y >= barraCapa - 4 ? vento : 0;
      const [x1, x2] = (y <= 35 ? f.tronco(y) : [9, 22]).map((x) => x + solta);
      d.fx(x1 - 1, x2 + 1, y, "M");
      d.px(x1 - 1, y, "n");
      d.px(x2 + 1, y, "m");
      [12, 16, 19].forEach((x) => d.px(x, y, y > 28 ? "m" : "M"));
    }
    d.fx(8 + vento, 23 + vento, barraCapa, "D");
    [9, 13, 18, 22].forEach((x) => d.px(x + vento, barraCapa, "Q"));
    d.fx(11, 20, 24, "a");
    d.fx(12, 19, 23, "A");
    return;
  }
  baseTronco(d, f);
  // peitoral de metal com brilho, sobreveste na cor da roupa por cima
  for (let y = 24; y <= 29; y++) {
    const [x1, x2] = f.tronco(y);
    d.fx(x1, x2, y, "A");
    d.px(x2, y, "a");
    d.px(x2 - 1, y, "a");
    d.px(x1, y, "w");
  }
  d.fx(11, 13, 25, "w");
  d.px(11, 26, "w");
  d.fx(12, 19, 23, "A");
  d.fx(12, 19, 24, "a");
  for (let y = 26; y <= 35; y++) {
    d.fx(13, 18, y, "M");
    d.px(13, y, "n");
    d.px(18, y, "m");
  }
  [[15, 27], [16, 27], [14, 28], [17, 28], [15, 29], [16, 29]].forEach(([x, y]) => d.px(x, y, "D"));
  d.fx(15, 16, 28, "Y");
  cinto(d, f);
  // saiote de placas dos dois lados da sobreveste
  for (let y = 31; y <= 35; y++) {
    const [x1, x2] = f.tronco(y);
    for (let x = x1; x <= 12; x++) d.px(x, y, (x - x1) % 2 ? "a" : "A");
    for (let x = 19; x <= x2; x++) d.px(x, y, (x2 - x) % 2 ? "A" : "a");
  }
  d.fx(13, 18, 35, "D");
  d.px(15, 35, "Q");
}

function aljavaFrente(d) {
  // as penas das flechas aparecem por cima do ombro
  [[22, 19, "W"], [23, 18, "W"], [24, 19, "R"], [25, 18, "R"], [23, 20, "b"], [25, 20, "b"], [24, 21, "B"], [26, 19, "W"]].forEach(([x, y, c]) => d.px(x, y, c));
}

function troncoArqueiro(d, f, costas) {
  baseTronco(d, f);
  cinto(d, f, !costas);
  if (costas) {
    // aljava de couro na diagonal, cheia de flechas
    for (let i = 0; i <= 10; i++) {
      const x = 18 - Math.round(i * 0.5);
      d.fx(x, x + 3, 22 + i, i === 0 || i === 10 ? "b" : "B");
      d.px(x, 22 + i, "J");
      d.px(x + 3, 22 + i, "b");
    }
    [[18, 20, "W"], [19, 19, "R"], [20, 20, "W"], [21, 19, "R"], [19, 21, "Z"], [21, 21, "Z"]].forEach(([x, y, c]) => d.px(x, y, c));
    d.fx(18, 21, 26, "D");
    for (let y = 31; y <= 34; y++) d.px(15, y, "V");
  } else {
    // colete de couro aberto sobre a túnica, com cordão cruzado
    for (let y = 24; y <= 30; y++) {
      const [x1, x2] = f.tronco(y);
      d.fx(x1, 12, y, "B");
      d.fx(19, x2, y, "B");
      d.px(x1, y, "J");
      d.px(12, y, "b");
      d.px(19, y, "J");
      d.px(x2, y, "b");
    }
    d.fx(14, 17, 24, "m");
    d.fx(15, 16, 24, "s");
    [[14, 26], [17, 26], [15, 27], [16, 27], [14, 28], [17, 28]].forEach(([x, y]) => d.px(x, y, "Z"));
    // alça da aljava atravessando o peito
    for (let i = 0; i <= 6; i++) d.px(20 - Math.round(i * 1.4), 24 + i, "b");
    cinto(d, f, false);
    d.px(15, 30, "y");
    for (let y = 31; y <= 35; y++) {
      d.px(12, y, "V");
      d.px(19, y, "V");
    }
  }
  barra(d, f, 35);
}

// passoArma: o braço que segura a arma balança mais (a arma sobe e desce com peso na caminhada)
// De frente, cada braço balança como um pêndulo preso no ombro: o ombro fica parado e, quanto mais
// para baixo, mais o braço vai para o lado (a mão é a que mais anda). Os dois braços vão para lados
// opostos, como alguém andando de verdade (antes o braço inteiro subia e descia em bloco).
// O quanto a mão anda de lado, para quem desenha a arma ou o escudo na mão:
const desvioDaMao = (balanco) => Math.round(balanco * 0.9);
function bracosFrente(pincel, a, f, passo, passoArma = passo) {
  const [esq, dir] = f.bracos;
  [[esq, passo, false], [dir, -passoArma, true]].forEach(([x, balanco, direito]) => {
    // cada linha do braço desloca de lado conforme a distância do ombro (linha 24): o pêndulo
    const lado = (y) => Math.round((balanco * (y - 24)) / 10);
    const d = { ...pincel, px: (x1, y, c) => pincel.px(x1 + lado(y), y, c), fx: (x1, x2, y, c) => pincel.fx(x1 + lado(y), x2 + lado(y), y, c) };
    const dy = 0;
    d.fx(direito ? x : x + 1, direito ? x + 1 : x + 2, 24 + dy, "M");
    for (let y = 25; y <= 31; y++) {
      d.fx(x, x + 2, y + dy, "M");
      d.px(x, y + dy, direito ? "M" : "n");
      d.px(x + 2, y + dy, "m");
    }
    d.px(x + 1, 28 + dy, "m");
    if (a.kit === "guerreiro") {
      // cota de malha no braço, ombreira redonda e braçadeira de couro
      for (let y = 26; y <= 30; y++) {
        d.fx(x, x + 2, y + dy, (y % 2) ? "a" : "A");
        d.px(x + 2, y + dy, "a");
      }
      d.fx(x, x + 2, 23 + dy, "A");
      d.fx(x - 1, x + 3, 24 + dy, "A");
      d.fx(x - 1, x + 3, 25 + dy, "A");
      d.fx(x - 1, x + 3, 26 + dy, "a");
      d.px(direito ? x + 2 : x, 24 + dy, "w");
      d.fx(x, x + 2, 31 + dy, "B");
      d.fx(x, x + 2, 32 + dy, "b");
    } else if (a.kit === "arqueiro") {
      // manga curta e braçadeira de arqueiro
      for (let y = 29; y <= 31; y++) {
        d.fx(x, x + 2, y + dy, "B");
        d.px(x + 2, y + dy, "b");
      }
      d.px(x, 29 + dy, "J");
      d.fx(x, x + 2, 32 + dy, "b");
      d.fx(x, x + 2, 28 + dy, "D");
    } else {
      d.fx(x, x + 2, 32 + dy, "D");
      d.px(x + 2, 32 + dy, "d");
    }
    d.fx(x, x + 2, 33 + dy, "S");
    d.px(x + 2, 33 + dy, "s");
    d.fx(x, x + 2, 34 + dy, "s");
    d.px(x + 1, 34 + dy, "S");
  });
}

// ---------- tronco de lado ----------

function troncoLado(d, a) {
  if (a.kit === "guerreiro") for (let y = 24; y <= 41 + PERNA_EXTRA; y++) d.fx(9, 12, y, y > 38 + PERNA_EXTRA ? "m" : "M");
  if (a.kit === "arqueiro") {
    for (let y = 21; y <= 33; y++) d.fx(8, 11, y, y === 21 ? "b" : "B");
    [[8, 19, "W"], [9, 18, "R"], [10, 19, "W"], [11, 18, "R"], [9, 20, "Z"], [11, 20, "Z"]].forEach(([x, y, c]) => d.px(x, y, c));
  }
  d.fx(13, 18, 24, "M");
  for (let y = 25; y <= 34; y++) {
    d.fx(12, 19, y, "M");
    d.px(12, y, "n");
  }
  if (a.kit === "guerreiro") {
    for (let y = 24; y <= 29; y++) {
      d.fx(12, 19, y, "A");
      d.px(12, y, "w");
      d.px(19, y, "a");
    }
    for (let y = 26; y <= 35; y++) d.fx(18, 19, y, "M");
    d.fx(14, 18, 23, "A");
  } else if (a.kit === "arqueiro") {
    for (let y = 24; y <= 30; y++) {
      d.fx(13, 17, y, "B");
      d.px(13, y, "J");
    }
    d.px(19, 24, "s");
  } else {
    for (let y = 25; y <= 29; y++) {
      d.px(18, y, "c");
      d.px(19, y, "D");
    }
    for (let y = 31; y <= 34; y++) d.px(19, y, "D");
  }
  d.fx(12, 19, 30, "b");
  d.px(19, 30, "Y");
  d.px(14, 32, "m");
  d.px(14, 33, "m");
  d.fx(12, 19, 35, "D");
  d.px(13, 35, "Q");
  d.px(17, 35, "Q");
}

// A barra da roupa de lado, atrás do corpo: andando ela fica para trás (vento 1) e, quando o pé pisa,
// volta para perto das pernas (vento 0). No guerreiro é a ponta da capa que balança.
function barraAoVentoLado(d, a, vento) {
  if (a.kit === "guerreiro") {
    for (let y = 36 + PERNA_EXTRA - vento * 3; y <= 41 + PERNA_EXTRA; y++) d.px(8, y, "M");
    if (vento) for (let y = 39 + PERNA_EXTRA; y <= 41 + PERNA_EXTRA; y++) d.px(7, y, "m");
    return;
  }
  d.px(11, 35, "D");
  if (!vento) return;
  for (let y = 32; y <= 34; y++) d.px(11, y, "M");
  d.fx(10, 11, 35, "D");
  d.px(10, 34, "m");
}

// A arma na mão, de lado, inclinada: desenhada numa folha à parte (com a mão fechada em volta do cabo) e
// colada linha a linha, cada linha deslocada conforme a distância da mão (o pivô): inclina = quantos
// pixels o topo anda para o lado (positivo, para a frente).
function itemInclinado(ctx, p, a, ax, ay, inclina) {
  const folha = criarTela(LARGURA_HEROI, ALTURA_HEROI);
  folha.ctx.setTransform(ctx.getTransform());
  const d = pincelHeroi(folha.ctx, p);
  itemHeroi(d, a, ax, ay);
  if (baseDoItem(a.item) !== "orbe") punho(d, ax - 1, ay);
  const pivo = ay + ctx.getTransform().f;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let y = 0; y < ALTURA_HEROI; y++) {
    const desloca = inclina ? Math.round((inclina * (pivo - y)) / 26) : 0;
    ctx.drawImage(folha.canvas, 0, y, LARGURA_HEROI, 1, desloca, y, LARGURA_HEROI, 1);
  }
  ctx.restore();
}

// O braço de lado estendido para a frente, segurando a arma: o ombro no tronco (x 14 a 16), o braço desce
// em diagonal até a mão (coluna "mao", linha 33). Manga na cor da roupa, punho/braçadeira de cada vocação.
function bracoLadoEstendido(d, a, mao, dy = 0) {
  const ombro = 15;
  for (let y = 25; y <= 32; y++) {
    // a linha do braço vai do ombro até a mão, em diagonal
    const k = (y - 25) / 7;
    const x = Math.round(ombro + (mao - 1 - ombro) * k);
    const yy = y + (y >= 30 ? dy : 0);
    const manga = a.kit === "guerreiro" ? (y % 2 ? "a" : "A") : a.kit === "arqueiro" && y >= 29 ? "B" : "M";
    d.fx(x - 1, x + 1, yy, manga);
    d.px(x - 1, yy, a.kit === "guerreiro" ? "w" : "n");
    d.px(x + 1, yy, a.kit === "guerreiro" ? "a" : "m");
  }
  if (a.kit === "guerreiro") {
    d.fx(13, 17, 23, "A");
    d.fx(13, 17, 24, "A");
    d.fx(13, 17, 25, "a");
    d.px(14, 23, "w");
  }
  // o punho da manga (bordado do mago, braçadeira de couro do guerreiro e do arqueiro)
  d.fx(mao - 2, mao, 32 + dy, a.kit === "mago" ? "D" : "b");
}

function bracoLado(d, a, dx, dy = 0) {
  if (dy) {
    // o braço da arma sobe ao ir para a frente: desenha o mesmo braço deslocado
    const original = d;
    d = { ...d, px: (x, y, c) => original.px(x, y + dy, c), fx: (x1, x2, y, c) => original.fx(x1, x2, y + dy, c) };
  }
  const x = 14 + dx;
  for (let y = 25; y <= 31; y++) {
    d.fx(x, x + 2, y, "M");
    d.px(x, y, "n");
    d.px(x + 2, y, "m");
  }
  d.px(x + 1, 28, "m");
  if (a.kit === "guerreiro") {
    d.fx(x - 1, x + 3, 23, "A");
    d.fx(x - 1, x + 3, 24, "A");
    d.fx(x - 1, x + 3, 25, "a");
    d.px(x, 23, "w");
    for (let y = 26; y <= 30; y++) d.fx(x, x + 2, y, y % 2 ? "a" : "A");
    d.fx(x, x + 2, 31, "B");
    d.fx(x, x + 2, 32, "b");
  } else if (a.kit === "arqueiro") {
    for (let y = 29; y <= 31; y++) d.fx(x, x + 2, y, "B");
    d.fx(x, x + 2, 32, "b");
  } else d.fx(x, x + 2, 32, "D");
  d.fx(x, x + 2, 33, "S");
  d.px(x + 2, 33, "s");
  d.fx(x + 1, x + 2, 34, "s");
}

// ---------- itens (ax = coluna do meio da mão, ay = linha de cima da mão) ----------
// O cabo passa por dentro da mão: o item é desenhado e depois a mão fechada (punho) por cima dele.

function punho(d, x, y) {
  d.fx(x, x + 2, y, "S");
  d.px(x, y, "T");
  d.px(x + 2, y, "s");
  d.fx(x, x + 2, y + 1, "s");
  d.px(x + 1, y + 1, "S");
}

// A espada: lâmina de três colunas (o fio claro à esquerda, a canaleta no meio e a sombra à direita), a
// ponta afinando, a guarda curva com uma gema no meio, o cabo trançado e o pomo com outra gema.
// runas: a Lâmina Rúnica (guarda de ouro e runas acesas na canaleta).
function espadaComum(d, ax, ay, runas) {
  d.px(ax, ay - 24, "w");
  d.fx(ax - 1, ax, ay - 23, "w");
  d.px(ax + 1, ay - 23, "a");
  for (let y = ay - 22; y <= ay - 3; y++) {
    d.px(ax - 1, y, "w");
    d.px(ax, y, runas && (ay - y) % 4 === 1 ? "G" : (ay - y) % 7 === 3 ? "A" : "A");
    d.px(ax + 1, y, "a");
  }
  // o brilho que corre pela lâmina
  [-19, -18, -11].forEach((dy) => d.px(ax, ay + dy, runas ? "g" : "W"));
  const guarda = runas ? "Y" : "A";
  const guardaEscura = runas ? "y" : "a";
  d.fx(ax - 3, ax + 3, ay - 2, guarda);
  d.fx(ax - 2, ax + 2, ay - 1, guardaEscura);
  d.px(ax - 4, ay - 3, guarda);
  d.px(ax + 4, ay - 3, guardaEscura);
  d.px(ax, ay - 2, runas ? "G" : "R");
  // o cabo trançado (couro em dois tons) e o pomo
  for (let y = ay; y <= ay + 2; y++) d.fx(ax - 1, ax + 1, y, (y + ax) % 2 ? "b" : "B");
  d.fx(ax - 1, ax + 1, ay + 3, guarda);
  d.px(ax, ay + 3, runas ? "G" : "R");
  d.px(ax, ay + 4, guardaEscura);
}

// O escudo de cavaleiro: borda de metal, o campo na cor da roupa com o brasão em cruz no tom do detalhe,
// o miolo dourado no cruzamento e o brilho na quina de cima.
function escudo(d, cx, cy) {
  d.grade([
    "AAAAAAAAAAA",
    "AwnMMDMMmaA",
    "AnMMMDMMMmA",
    "AnMMMDMMMmA",
    "ADDDDYDDDDA",
    "AnMMMDMMMmA",
    "AnMMMDMMMmA",
    ".AnMMDMMmA.",
    ".AmMMDMMmA.",
    "..AmMDMmA..",
    "...AmDmA...",
    "....AaA....",
    ".....a.....",
  ], cx - 5, cy - 6);
  d.px(cx, cy - 2, "y");
}

function itemHeroi(d, a, ax, ay) {
  const variacao = VARIACOES_ITEM[a.item];
  if (variacao) return itemHeroi(d.trocar(variacao.cores), { ...a, item: variacao.base }, ax, ay);
  switch (a.item) {
    case "cajado":
      // o cabo de madeira, com o veio (um pixel claro de vez em quando) e anéis de bordado
      for (let y = ay - 27; y <= ay + 8; y++) {
        d.px(ax, y, (ay - y) % 5 === 2 ? "D" : "B");
        d.px(ax + 1, y, (ay - y) % 5 === 2 ? "d" : "b");
      }
      // a fita vermelha amarrada embaixo da cabeça, caindo para o lado
      [[2, -26, "R"], [2, -25, "R"], [3, -24, "P"], [3, -23, "R"], [2, -22, "R"]].forEach(([dx, dy, c]) => d.px(ax + dx, ay + dy, c));
      // a ponteira de metal
      d.fx(ax, ax + 1, ay + 9, "A");
      d.px(ax, ay + 10, "w");
      // a cabeça: garras de madeira curvas abraçando a gema, com o colar dourado embaixo
      d.grade([
        ".B.gg.b.",
        ".BgWGXb.",
        "B.GGgX.b",
        "B.GGXX.b",
        ".BXGXXb.",
        "..BXXb..",
        "...Bb...",
        "..DDDD..",
      ], ax - 3, ay - 35);
      // as faíscas da gema
      [[-4, -37], [5, -34], [-3, -30], [6, -38]].forEach(([dx, dy]) => d.px(ax + dx, ay + dy, "g"));
      break;
    case "cajadoCristal":
      // cabo claro com anéis de prata e um cristal comprido facetado, com lascas flutuando em volta
      for (let y = ay - 25; y <= ay + 8; y++) {
        d.px(ax, y, (ay - y) % 6 === 3 ? "A" : "c");
        d.px(ax + 1, y, (ay - y) % 6 === 3 ? "a" : "C");
      }
      d.fx(ax, ax + 1, ay + 9, "A");
      d.grade([
        "..gg..",
        ".gWGX.",
        ".gWGX.",
        "gGWGGX",
        "gGgGXX",
        ".GGGX.",
        ".GGXX.",
        "..GX..",
        ".AddA.",
        "..AA..",
      ], ax - 2, ay - 35);
      [[-4, -32], [5, -30], [-3, -26], [5, -36], [4, -24]].forEach(([dx, dy], i) => d.px(ax + dx, ay + dy, i % 2 ? "W" : "g"));
      break;
    case "varinha":
      // a varinha na diagonal: cabo escuro com anel de ouro e a estrela brilhando na ponta
      [[0, 2, "b"], [0, 1, "b"], [1, 0, "Y"], [1, -1, "B"], [2, -2, "B"], [2, -3, "J"], [3, -4, "B"], [3, -5, "J"], [4, -6, "B"]].forEach(([dx, dy, c]) => d.px(ax + dx, ay + dy, c));
      d.grade(["..g..", ".gGg.", "gGWGg", ".gGg.", "..g.."], ax + 2, ay - 11);
      [[7, -12], [1, -10], [8, -7]].forEach(([dx, dy]) => d.px(ax + dx, ay + dy, "g"));
      break;
    case "grimorio": {
      // o livro de verdade: capa de couro com cantos de ouro, as páginas na lateral, a runa acesa no
      // meio da capa e o fecho dourado
      d.grade([
        "YbbbbbbY",
        "bRRRRRRZ",
        "bRPgPRRZ",
        "bRgGgRRZ",
        "bRPgPRRZ",
        "bRRRRRRZ",
        "bRRDDRRZ",
        "bRRRRRRZ",
        "YbbbbbbY",
      ], ax - 2, ay - 4);
      d.px(ax + 3, ay - 6, "g");
      d.px(ax - 3, ay - 2, "g");
      break;
    }
    case "orbe":
      // a esfera com o redemoinho de luz por dentro, presa num berço de garras douradas
      d.grade([
        "..gGg..",
        ".gWGGX.",
        "gWGgGGX",
        "gGgGGXX",
        "GGGGXXX",
        ".GGXXX.",
        "..XXX..",
        ".y.Y.y.",
        "..yYy..",
      ], ax - 3, ay - 9);
      [[5, -11], [-4, -7]].forEach(([dx, dy]) => d.px(ax + dx, ay + dy, "g"));
      break;
    case "espada":
      espadaComum(d, ax, ay, true);
      break;
    case "espadaFerro":
    case "espadaEscudo":
      espadaComum(d, ax, ay, false);
      break;
    case "espadaFlamejante":
      // lâmina em brasa (o miolo amarelo e branco), labaredas saindo pelas bordas e subindo da ponta
      espadaComum(d, ax, ay, false);
      for (let y = ay - 22; y <= ay - 3; y++) {
        d.px(ax - 1, y, (ay - y) % 3 ? "O" : "o");
        d.px(ax, y, (ay - y) % 4 ? "o" : "W");
        d.px(ax + 1, y, "O");
        if ((ay - y) % 4 === 0) d.px(ax - 2, y, "O");
        if ((ay - y) % 5 === 2) d.px(ax + 2, y, "o");
      }
      [[0, -25, "o"], [1, -26, "O"], [-1, -27, "O"], [0, -28, "Y"]].forEach(([dx, dy, c]) => d.px(ax + dx, ay + dy, c));
      d.fx(ax - 3, ax + 3, ay - 2, "Y");
      break;
    case "machado":
      // o cabo com a faixa de couro, a lâmina larga em meia-lua com o fio brilhante e a ponta de trás
      for (let y = ay - 17; y <= ay + 6; y++) {
        d.px(ax, y, (ay - y) % 6 === 4 ? "D" : "B");
        d.px(ax + 1, y, (ay - y) % 6 === 4 ? "d" : "b");
      }
      d.grade([
        "...bB.....",
        "...bB.AAw.",
        "..abBAAAAw",
        ".aabBAAAAw",
        "..abBAAAAw",
        "...bBAaAAw",
        "...bB.AAw.",
        "...DD.....",
      ], ax - 3, ay - 20);
      d.px(ax + 1, ay - 21, "a");
      break;
    case "martelo":
      // o martelo de guerra: cabeça chanfrada com a runa no meio, a ponta no alto e faixas no cabo
      for (let y = ay - 11; y <= ay + 6; y++) {
        d.px(ax, y, (ay - y) % 5 === 3 ? "D" : "B");
        d.px(ax + 1, y, (ay - y) % 5 === 3 ? "d" : "b");
      }
      d.grade([
        "...ww...",
        "...Aa...",
        "wAAAAAAa",
        "wAADDAAa",
        "wAAGDAAa",
        "wAAAAAAa",
        "aaaaaaaa",
        "...Bb...",
      ], ax - 3, ay - 19);
      break;
    case "arco":
    case "arcoElfico":
    case "arcoDourado": {
      const elfico = a.item === "arcoElfico";
      const dourado = a.item === "arcoDourado";
      // a corda clara, rente ao corpo
      for (let y = ay - 12; y <= ay + 12; y++) d.px(ax - 3, y, elfico ? "g" : "W");
      // os braços do arco curvos, em dois tons, com as pontas virando para trás
      for (let dy = -13; dy <= 13; dy++) {
        const curva = Math.round(3.2 - (dy * dy) / 52);
        const frente = elfico ? (Math.abs(dy) % 4 === 0 ? "G" : "c") : dourado ? (Math.abs(dy) % 4 === 0 ? "W" : "Y") : Math.abs(dy) % 5 === 0 ? "J" : "B";
        d.px(ax - 3 + curva, ay + dy, frente);
        d.px(ax - 2 + curva, ay + dy, elfico ? "C" : dourado ? "y" : "b");
      }
      d.px(ax - 4, ay - 14, elfico ? "C" : dourado ? "y" : "b");
      d.px(ax - 4, ay + 14, elfico ? "C" : dourado ? "y" : "b");
      // a empunhadura enrolada na cor do detalhe
      for (let y = ay - 2; y <= ay + 3; y++) d.fx(ax - 1, ax + 1, y, y % 2 ? "D" : "d");
      if (dourado) {
        d.grade(["R", "Y"], ax - 3, ay - 16);
        d.grade(["Y", "R"], ax - 3, ay + 15);
      }
      if (elfico) {
        // folhinhas crescendo nos braços
        [[-9, 2], [-5, 3], [6, 3], [10, 2]].forEach(([dy, dx]) => d.px(ax - 3 + dx + 2, ay + dy, "v"));
        d.px(ax - 3, ay - 15, "g");
        d.px(ax - 3, ay + 15, "g");
      }
      break;
    }
    case "besta":
      // a coronha de madeira, os braços de metal, a corda, o gatilho e o virote com penas vermelhas
      for (let y = ay - 8; y <= ay + 4; y++) {
        d.px(ax, y, y % 3 ? "B" : "J");
        d.px(ax + 1, y, "b");
      }
      d.px(ax + 2, ay + 1, "a");
      d.grade([
        "a..........a",
        "Aa........aA",
        ".AAAAAAAAAA.",
        "..ZZZZZZZZ..",
      ], ax - 5, ay - 9);
      for (let y = ay - 15; y <= ay - 8; y++) d.px(ax, y, "c");
      d.px(ax, ay - 16, "w");
      d.fx(ax - 1, ax + 1, ay - 9, "R");
      d.px(ax - 1, ay - 10, "R");
      d.px(ax + 1, ay - 10, "P");
      break;
    default:
      break;
  }
}

// ---------- montagem ----------

// marca o desenho como gente: os cenários em alta resolução não passam filtro nele e desenham no
// tamanho certo de personagem
function marcarPersonagem(canvas) {
  canvas.personagem = true;
  return canvas;
}

// Quanto a ponta de cada chapéu balança na caminhada (em pixels): o chapéu de mago, alto e mole, mais;
// os de pano e de aba, um pouco; elmos, coroas e tiaras são rígidos e ficam firmes na cabeça.
const BALANCO_CHAPEU = { pontudo: 2, cartola: 1, cacador: 1, capuz: 1, bandana: 1, boina: 1 };

// Desenha o chapéu numa folha à parte e cola de volta com a parte de cima deslocada para o lado (o terço de
// cima anda "ondaX", o do meio metade). Assim a ponta fica para trás e acompanha o passo com atraso,
// como pano de verdade, sem descolar a aba da cabeça.
function chapeuBalancando(ctx, p, a, dir, ondaX) {
  const base = VARIACOES_CHAPEU[a.chapeu]?.base || a.chapeu;
  const amplitude = BALANCO_CHAPEU[base] || 0;
  const dx = Math.max(-amplitude, Math.min(amplitude, ondaX));
  if (!dx) return chapeuHeroi(pincelHeroi(ctx, p), a, dir);
  const folha = criarTela(LARGURA_HEROI, ALTURA_HEROI);
  folha.ctx.setTransform(ctx.getTransform());
  chapeuHeroi(pincelHeroi(folha.ctx, p), a, dir);
  const dados = folha.ctx.getImageData(0, 0, LARGURA_HEROI, ALTURA_HEROI).data;
  let topo = -1;
  let fundo = -1;
  for (let y = 0; y < ALTURA_HEROI; y++) {
    for (let x = 0; x < LARGURA_HEROI; x++) {
      if (dados[(y * LARGURA_HEROI + x) * 4 + 3]) {
        if (topo < 0) topo = y;
        fundo = y;
        break;
      }
    }
  }
  if (topo < 0) return;
  const terco = Math.max(1, Math.round((fundo - topo + 1) / 3));
  const faixas = [[topo, terco, dx], [topo + terco, terco, Math.trunc(dx / 2)], [topo + terco * 2, ALTURA_HEROI - topo - terco * 2, 0]];
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  faixas.forEach(([y, h, desloca]) => h > 0 && ctx.drawImage(folha.canvas, 0, y, LARGURA_HEROI, h, desloca, y, LARGURA_HEROI, h));
  ctx.restore();
}

// ---------- acabamento dos materiais: metal polido, gema acesa, trama do tecido, veio do couro ----------
// Cada pixel é reconhecido pela letra da paleta que o pintou (inclusive as cores trocadas das variações
// de arma e chapéu). Metal e ouro ganham o brilho na quina de cima e a sombra no canto de baixo (o
// "bisel" de metal polido); gema e magia acendem no miolo; o tecido do manto ganha uma trama bem sutil;
// couro e madeira, um veio. Vale para todas as roupas e armas, inclusive as que forem criadas depois.
const LETRAS_MATERIAL = {
  metal: ["A", "a", "Y", "y", "Z", "w"],
  gema: ["G", "g", "X"],
  tecido: ["M", "m", "n", "V", "U", "u"],
  couro: ["B", "b", "J"],
};
const rgbChave = (r, g, b) => (r << 16) | (g << 8) | b;
function chaveDaCor(cor) {
  if (typeof cor !== "string" || !cor.startsWith("#")) return null;
  const h = cor.length === 4 ? cor.replace(/^#(.)(.)(.)$/, "#$1$1$2$2$3$3") : cor;
  const n = parseInt(h.slice(1, 7), 16);
  return Number.isNaN(n) ? null : n;
}
function materiaisDoHeroi(a, p) {
  const mapa = new Map();
  const variacoes = [VARIACOES_ITEM[a.item]?.cores, VARIACOES_CHAPEU[a.chapeu]?.cores].filter(Boolean);
  Object.entries(LETRAS_MATERIAL).forEach(([material, letras]) => {
    letras.forEach((letra) => {
      [p, ...variacoes].forEach((paleta) => {
        const chave = chaveDaCor(paleta[letra]);
        // a pele e o cabelo nunca viram "metal", mesmo que a cor coincida
        if (chave !== null && chave !== chaveDaCor(p.S) && chave !== chaveDaCor(p.H)) mapa.set(chave, material);
      });
    });
  });
  return mapa;
}
function detalharMateriais(canvas, a, p) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;
  const imagem = ctx.getImageData(0, 0, w, h);
  const px = imagem.data;
  const original = new Uint8ClampedArray(px);
  const materiais = materiaisDoHeroi(a, p);
  const materialEm = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return null;
    const i = (y * w + x) * 4;
    if (!original[i + 3]) return null;
    return materiais.get(rgbChave(original[i], original[i + 1], original[i + 2])) || "outro";
  };
  const mexer = (i, fator, soma = 0) => {
    px[i] = Math.max(0, Math.min(255, original[i] * fator + soma));
    px[i + 1] = Math.max(0, Math.min(255, original[i + 1] * fator + soma));
    px[i + 2] = Math.max(0, Math.min(255, original[i + 2] * fator + soma));
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const m = materialEm(x, y);
      if (!m || m === "outro") continue;
      const i = (y * w + x) * 4;
      const igual = (dx, dy) => materialEm(x + dx, y + dy) === m;
      if (m === "metal") {
        // quina de cima/esquerda: o brilho; canto de baixo/direita: a sombra do bisel
        if (!igual(0, -1) && !igual(-1, 0)) mexer(i, 1.05, 70);
        else if (!igual(0, -1)) mexer(i, 1.04, 32);
        else if (!igual(0, 1) && !igual(1, 0)) mexer(i, 0.72);
        // um reflexo em diagonal (de 2 pixels, o segundo mais fraco) que atravessa as peças de metal maiores
        else if ((x + y) % 7 === 0 && igual(1, 1) && igual(-1, -1)) mexer(i, 1.02, 48);
        else if ((x + y) % 7 === 1 && igual(1, 1) && igual(-1, -1)) mexer(i, 1.01, 22);
      } else if (m === "gema") {
        // a lapidação: a quina de cima à esquerda quase branca (o brilho da facha), o miolo aceso e a
        // quina de baixo à direita funda
        if (!igual(0, -1) && !igual(-1, 0)) mexer(i, 1, 110);
        else if (igual(0, -1) && igual(0, 1) && igual(-1, 0) && igual(1, 0)) mexer(i, 1.12, 50);
        else if (!igual(0, 1) && !igual(1, 0)) mexer(i, 0.7);
        else if (!igual(0, -1)) mexer(i, 1.04, 25);
      } else if (m === "tecido") {
        // a trama: um pixel mais escuro a cada poucos, em diagonal, e a barra de cima do tecido clareia
        if ((x + y * 2) % 5 === 0 && igual(0, 1) && igual(0, -1)) mexer(i, 0.92);
        else if (!igual(0, -1)) mexer(i, 1.06, 6);
      } else if (m === "couro") {
        // o veio do couro e da madeira: riscos curtos na vertical
        if ((x * 3 + Math.floor(y / 2)) % 5 === 0 && igual(0, 1)) mexer(i, 0.86);
      }
    }
  }
  ctx.putImageData(imagem, 0, 0);
  return canvas;
}
// o acabamento completo de um desenho do herói (ou de uma peça solta da loja): materiais e volume
function acabamentoDoHeroi(canvas, escolhas, direcao = "baixo") {
  const a = escolhasCompletas(escolhas);
  detalharMateriais(canvas, a, paletaHeroi(a));
  return iluminarVolume(canvas, direcao);
}

// ---------- volume: luz e sombra como num boneco 3D ----------
// Depois de desenhado (e antes do contorno), cada quadro ganha luz de cima à esquerda. Cada pedaço do
// corpo em cada linha (cabeça, tronco, braço, perna, cada um separado pelo vazio) é tratado como um
// cilindro: o lado da luz clareia, o outro escurece puxando para o roxo, e as beiradas de cima e de baixo
// de cada volume arredondam (o alto da cabeça e dos ombros pega luz, a barra da roupa e o queixo fazem
// sombra). Tudo em poucos degraus, para continuar pixel art e não virar degradê.
const LUZ_VOLUME = (() => {
  const l = [-0.55, -0.5, 0.67];
  const n = Math.hypot(...l);
  return l.map((v) => v / n);
})();
function iluminarVolume(canvas, direcao) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;
  const imagem = ctx.getImageData(0, 0, w, h);
  const px = imagem.data;
  const cheio = (x, y) => x >= 0 && y >= 0 && x < w && y < h && px[(y * w + x) * 4 + 3] > 0;
  // de lado a luz vem um pouco mais de frente (o rosto fica para a direita do quadro)
  const [lx, ly, lz] = direcao === "lado" ? [-0.35, -0.55, 0.76] : LUZ_VOLUME;
  const plano = lz; // a luz que uma superfície reta de frente recebe
  const ajuste = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (!cheio(x, y)) {
        x++;
        continue;
      }
      let fim = x;
      while (fim + 1 < w && cheio(fim + 1, y)) fim++;
      const centro = (x + fim) / 2;
      const raio = (fim - x + 1) / 2;
      for (let i = x; i <= fim; i++) {
        // fio fino (cabo de cajado, corda de arco) não vira cilindro: só a luz de cima e de baixo
        const u = raio >= 1.5 ? Math.max(-0.95, Math.min(0.95, (i - centro) / raio)) : 0;
        // as beiradas de cima e de baixo: até 2 pixels do vazio
        const acima = !cheio(i, y - 1) ? 1 : !cheio(i, y - 2) ? 0.5 : 0;
        const abaixo = !cheio(i, y + 1) ? 1 : !cheio(i, y + 2) ? 0.5 : 0;
        const ny = (abaixo - acima) * 0.55;
        const nx = u * 0.85;
        const nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny));
        ajuste[y * w + i] = nx * lx + ny * ly + nz * lz - plano;
      }
      x = fim + 1;
    }
  }
  // A luz em 6 tons (como os monstros do bestiário): sombra funda, sombra, meia-sombra, a cor, luz e brilho,
  // com o pontilhado 2 x 2 na passagem de um tom para o outro (o degradê de pixel art). E um fio de luz fria
  // na borda de trás de cada volume (a luz que vem de trás e recorta o corpo do fundo).
  const TONS_VOLUME = [[0.62, 18], [0.72, 13], [0.85, 7], [1, 0], [1.1, -1], [1.2, -2]];
  const BAYER = [[0, 2], [3, 1]];
  for (let i = 0; i < w * h; i++) {
    const a = px[i * 4 + 3];
    if (!a) continue;
    const v = ajuste[i];
    const r = px[i * 4];
    const g = px[i * 4 + 1];
    const b = px[i * 4 + 2];
    // o branco dos olhos e o brilho deles ficam como estão
    if (r > 235 && g > 235 && b > 235) continue;
    const x = i % w;
    const y = Math.floor(i / w);
    const nivel = 3 + v * 4.2 + (BAYER[y & 1][x & 1] - 1.5) * 0.22;
    const [fator, frio] = TONS_VOLUME[Math.max(0, Math.min(5, Math.round(nivel)))];
    // a borda de trás (do lado da sombra, colada no vazio): o fio de luz que recorta
    const bordaDeTras = v < -0.3 && !cheio(x + (lx < 0 ? 1 : -1), y) && cheio(x - (lx < 0 ? 1 : -1), y);
    if (fator === 1 && !bordaDeTras) continue;
    if (bordaDeTras) {
      px[i * 4] = Math.min(255, r * 0.95 + 18);
      px[i * 4 + 1] = Math.min(255, g * 0.95 + 22);
      px[i * 4 + 2] = Math.min(255, b * 0.95 + 34);
      continue;
    }
    // a luz esquenta um pouco; a sombra esfria (puxa para o azul-roxo), como luz de verdade
    const quente = frio < 0;
    px[i * 4] = Math.max(0, Math.min(255, r * fator + (quente ? 6 - frio * 2 : -frio * 0.6)));
    px[i * 4 + 1] = Math.max(0, Math.min(255, g * fator + (quente ? 3 - frio : -frio * 0.3)));
    px[i * 4 + 2] = Math.max(0, Math.min(255, b * fator + (quente ? -2 : frio)));
  }
  ctx.putImageData(imagem, 0, 0);
  return canvas;
}

// ---------- o giro: o boneco vira como um corpo redondo, não como papel ----------
// heroiGirado(sprite, graus) devolve o quadro "embrulhado" num cilindro e girado: com graus positivos o
// que está no meio (rosto, fivela, emblema) escorrega para a direita e encolhe na curva, e o lado que
// chega aparece. É o ângulo de 3/4 entre a frente e o lado. Fica guardado por quadro e por ângulo.
const cacheGiro = new WeakMap();
function heroiGirado(sprite, graus) {
  const g = Math.round(graus / 10) * 10;
  if (!g || !sprite) return sprite;
  let porAngulo = cacheGiro.get(sprite);
  if (!porAngulo) {
    porAngulo = new Map();
    cacheGiro.set(sprite, porAngulo);
  }
  if (porAngulo.has(g)) return porAngulo.get(g);
  const w = sprite.width;
  const h = sprite.height;
  const leitor = criarTela(w, h);
  leitor.ctx.drawImage(sprite, 0, 0);
  const origem = leitor.ctx.getImageData(0, 0, w, h).data;
  const { canvas, ctx } = criarTela(w, h);
  const saida = ctx.createImageData(w, h);
  const destino = saida.data;
  const teta = (g * Math.PI) / 180;
  const copiar = (de, para, escurece = 1) => {
    destino[para] = origem[de] * escurece;
    destino[para + 1] = origem[de + 1] * escurece;
    destino[para + 2] = origem[de + 2] * (escurece < 1 ? Math.min(1, escurece + 0.08) : 1);
    destino[para + 3] = origem[de + 3];
  };
  for (let y = 0; y < h; y++) {
    let x0 = -1;
    let x1 = -1;
    for (let x = 0; x < w; x++) {
      if (origem[(y * w + x) * 4 + 3]) {
        if (x0 < 0) x0 = x;
        x1 = x;
      }
    }
    if (x0 < 0) continue;
    const centro = (x0 + x1 + 1) / 2;
    const raio = Math.max(1, (x1 - x0 + 1) / 2);
    for (let x = x0; x <= x1; x++) {
      const para = (y * w + x) * 4;
      // as beiradas (o contorno escuro) ficam onde estão, para o boneco não perder a linha de fora
      if (x === x0 || x === x1) {
        copiar((y * w + x) * 4, para);
        continue;
      }
      const angulo = Math.asin(Math.max(-1, Math.min(1, (x + 0.5 - centro) / raio)));
      let deOnde = angulo - teta;
      let escurece = 1;
      // o pedaço que vem de trás do corpo: repete a beirada, mais escura (é o flanco na sombra)
      if (deOnde < -Math.PI / 2 || deOnde > Math.PI / 2) {
        deOnde = Math.sign(deOnde) * (Math.PI / 2 - 0.15);
        escurece = 0.72;
      }
      const sx = Math.min(x1 - 1, Math.max(x0 + 1, Math.floor(centro + raio * Math.sin(deOnde))));
      copiar((y * w + sx) * 4, para, escurece);
    }
  }
  ctx.putImageData(saida, 0, 0);
  const pronto = marcarPersonagem(canvas);
  porAngulo.set(g, pronto);
  return pronto;
}

// O herói visto de qualquer ângulo: 0 = de frente, 90 = virado para a direita, 180 = de costas,
// -90 = para a esquerda. Entre eles usa o quadro mais perto, girado no cilindro (3/4 de frente, 3/4 de
// costas). pegar(direcao, quadro) devolve o quadro ("baixo", "lado" ou "cima"). Só no ângulo exato a
// caminhada anda; no meio do giro fica o quadro parado.
function heroiNoAngulo(pegar, angulo, quadro = 0) {
  const a = ((((angulo + 180) % 360) + 360) % 360) - 180;
  const abs = Math.abs(a);
  if (abs <= 50) return { sprite: heroiGirado(pegar("baixo", abs < 5 ? quadro : 0), a), espelhado: false, direcao: "baixo" };
  // virado para a direita, a arma (na mão esquerda) fica do outro lado do corpo ("ladoOposto"); para a
  // esquerda, ela fica na mão de perto ("lado" espelhado). Quem não tem o "ladoOposto" usa o "lado".
  if (abs < 130) {
    const qual = a > 0 ? "ladoOposto" : "lado";
    const q = Math.abs(abs - 90) < 5 ? quadro : 0;
    return { sprite: heroiGirado(pegar(qual, q) || pegar("lado", q), abs - 90), espelhado: a < 0, direcao: "lado" };
  }
  const g = a > 0 ? a - 180 : a + 180;
  return { sprite: heroiGirado(pegar("cima", Math.abs(g) < 5 ? quadro : 0), g), espelhado: false, direcao: "cima" };
}

function quadroHeroi(escolhas, direcao, quadro) {
  const a = escolhasCompletas(escolhas);
  const p = paletaHeroi(a);
  const f = formaDoCorpo(a);
  const { canvas, ctx } = criarTela(LARGURA_HEROI, ALTURA_HEROI);
  const passo = PASSOS[quadro];
  ctx.translate(0, 2);
  const d = pincelHeroi(ctx, p);
  // a perna que está indo para a frente sobe ao cruzar a outra (o seno subindo = a da frente avançando)
  const proxima = PASSOS[(quadro + 1) % QUADROS_ANDAR].perna;
  const andando = quadro < QUADROS_ANDAR;
  const frenteAvanca = andando && proxima > passo.perna;
  const levanta = andando ? Math.round((1 - Math.abs(passo.perna)) * 2) : 0; // 2 ao cruzar, 0 ao pisar
  // o chapéu segue o passo com um quadro de atraso (inércia): a ponta vai para o lado contrário
  const atraso = andando ? PASSOS[(quadro + QUADROS_ANDAR - 1) % QUADROS_ANDAR].perna : 0;

  // (as auras de visual não são mais pintadas no corpo: são animadas em volta dele, desenharAuraVisual no mundo.js)

  // o tronco (e tudo acima dele) desce ao respirar e ao pisar; as pernas ficam presas no chão
  const respira = (passo.respira || 0) + passo.corpo;
  // "lado" e "ladoOposto" são os dois desenhos de lado (ambos virados para a direita do quadro): no "lado"
  // a arma está na mão de PERTO da câmera; no "ladoOposto", na mão de LONGE (do outro lado do corpo,
  // meio escondida atrás dele), e a mão de perto balança vazia. De frente a arma está na mão esquerda do
  // herói: virado para a direita, a mão esquerda fica longe ("ladoOposto"); para a esquerda, perto ("lado"
  // espelhado). Assim a arma fica sempre na mesma mão, para qualquer lado que ele ande.
  if (direcao === "lado" || direcao === "ladoOposto") {
    const outraMao = direcao === "ladoOposto";
    // passada larga: os pés abrem até 3 pixels cada um, a perna que vem para a frente sobe ao cruzar
    // a outra e o braço balança para o lado contrário, sempre em 8 quadros (sem pulo de 3 pixels)
    const dx = Math.round(passo.perna * 3);
    perna(d, a, 13 - dx, frenteAvanca ? 0 : -levanta, 13 - dx, 1, true);
    ctx.translate(0, respira);
    if (outraMao) {
      // o braço de longe (mais escuro, na sombra do corpo) balança ao contrário do de perto e segura a
      // arma do outro lado: desenhados antes do tronco, o corpo e a cabeça tapam o meio deles
      // a mão de longe fica sempre logo à frente do tronco (de 20 a 24; o tronco vai até 19), então a arma
      // aparece inteira ao lado do corpo o passo todo, sem sumir e voltar
      const balancoLonge = andando ? Math.round(passo.perna * 3) : 0;
      const maoLonge = 21 + balancoLonge;
      const sombra = d.trocar({ M: p.m, n: p.m, m: p.V, A: p.a, w: p.a, B: p.b });
      bracoLadoEstendido(sombra, a, maoLonge, 0);
      itemInclinado(ctx, p, a, maoLonge, 33, -balancoLonge);
    }
    // a barra da roupa (ou a capa) fica para trás quando o corpo avança e volta quando o pé pisa
    barraAoVentoLado(d, a, passo.corpo ? 0 : 1);
    troncoLado(d, a);
    // De lado, o braço de perto balança como um pêndulo preso no ombro, para a frente e para trás, ao
    // contrário da perna da frente (como alguém andando de verdade). Parado, a mão descansa um pouco à
    // frente do corpo, segurando a arma. A arma acompanha a mão e inclina (o topo fica para trás quando a
    // mão vai para a frente, e vice-versa), e passa NA FRENTE do rosto quando a mão está na frente, ou POR
    // TRÁS da cabeça quando a mão está atrás.
    // A arma na mão de perto fica SEMPRE na frente (antes ela trocava de camada no meio do passo, passando
    // por trás da cabeça quando a mão ia para trás, e parecia entrar e sair do corpo). Para não cruzar o
    // rosto, a mão balança um pouco menos e mais à frente (de 20 a 24, o rosto vai até 22).
    // Com a arma na outra mão, a de perto fica mais solta, junto do corpo, e balança mais.
    const balanco = andando ? -Math.round(passo.perna * 3) : 0;
    const mao = (outraMao ? 17 : 20) + balanco;
    const inclina = -balanco;
    // a arma na mão de perto fica sempre na frente da cabeça (o movimento do braço é o mesmo; só não troca
    // mais de camada, então a ponta de cima nunca entra na cabeça)
    const naFrente = !outraMao;
    bracoLadoEstendido(d, a, mao, 0);
    if (outraMao) {
      // a mão de perto, vazia: a pele da mão no fim do braço
      d.fx(mao - 2, mao, 33, "S");
      d.px(mao - 2, 33, "T");
      d.fx(mao - 2, mao, 34, "s");
    } else if (!naFrente) itemInclinado(ctx, p, a, mao, 33, inclina);
    cabeloAtras(d, a, "lado");
    d.grade(CABECA_LADO, 0, 9);
    rostoLado(d, a, f, passo.pisca);
    cabeloHeroi(d, a, "lado");
    acessorioHeroi(d, a, "lado");
    // de lado a ponta fica para trás enquanto anda e quica 1 pixel a cada pisada
    chapeuBalancando(ctx, p, a, "lado", andando ? (passo.corpo ? -1 : -2) : 0);
    if (naFrente) itemInclinado(ctx, p, a, mao, 33, inclina);
    ctx.translate(0, -respira);
    // (o detalhamento e o volume de lado valem para os dois desenhos)
    perna(d, a, 15 + dx, frenteAvanca ? -levanta : 0, 15 + dx, 1, false);
    detalharMateriais(canvas, a, p);
    return marcarPersonagem(contornar(iluminarVolume(canvas, "lado"), "auto"));
  }

  const costas = direcao === "cima";
  const dir = costas ? "costas" : "frente";
  const ax = f.bracos[1] + 1;
  // o escudo e as costas do capuz usam as cores da variação, se houver
  const dChapeu = VARIACOES_CHAPEU[a.chapeu] ? d.trocar(VARIACOES_CHAPEU[a.chapeu].cores) : d;
  const dItem = VARIACOES_ITEM[a.item] ? d.trocar(VARIACOES_ITEM[a.item].cores) : d;
  const comEscudo = baseDoItem(a.item) === "espadaEscudo";
  if ((VARIACOES_CHAPEU[a.chapeu]?.base || a.chapeu) === "capuz") for (let y = 8; y <= 24; y++) dChapeu.fx(8, 23, y, "V");
  const vento = -Math.round(passo.perna); // roupa e capa balançam para o lado contrário da perna que avança
  if (a.kit === "guerreiro" && !costas) capaGuerreiro(d, vento);
  if (a.kit === "arqueiro" && !costas) aljavaFrente(d);
  // os braços balançam 2 pixels (o dobro do passo) e a perna que avança sobe 2
  const balanco = Math.round(passo.perna * 2);
  // a mão da arma balança 3 (ela pesa: o cajado, a espada e o arco sobem e descem bem marcados)
  const balancoArma = Math.round(passo.perna * 3);
  if (costas) {
    // de costas a mão do item fica do outro lado: desenha o item espelhado (o lado da mão inverte junto)
    ctx.save();
    ctx.translate(31, respira);
    ctx.scale(-1, 1);
    itemHeroi(d, a, ax - desvioDaMao(balancoArma), 33);
    ctx.restore();
  }
  // de frente a perna que dá o passo sobe (até 2 pixels no meio da passada)
  perna(d, a, 10, passo.perna > 0 ? -Math.round(passo.perna * 2) : 0, 14, -1, false);
  perna(d, a, 17, passo.perna < 0 ? -Math.round(-passo.perna * 2) : 0, 17, 1, false);
  // respirando: tudo acima das pernas desce um pixel
  ctx.translate(0, respira);
  if (a.kit === "guerreiro") troncoGuerreiro(d, f, costas, vento);
  else if (a.kit === "arqueiro") troncoArqueiro(d, f, costas);
  else troncoMago(d, f, costas, vento);
  if (costas && comEscudo) escudo(dItem, 15, 29);
  // de costas a arma está na mão do outro lado (a da esquerda do quadro)
  if (costas) bracosFrente(d, a, f, balancoArma, balanco);
  else bracosFrente(d, a, f, balanco, balancoArma);
  cabeloAtras(d, a, dir);
  d.grade(CABECA_FRENTE, 0, 9);
  if (f.fem) d.fx(12, 19, 21, "s");
  if (!costas) rostoFrente(d, a, f, passo.pisca);
  cabeloHeroi(d, a, dir);
  acessorioHeroi(d, a, dir);
  chapeuBalancando(ctx, p, a, dir, -Math.round(atraso * 2));
  if (!costas) {
    // a arma e o escudo vão para os lados junto com a mão que balança (o pêndulo do braço)
    const maoArma = desvioDaMao(-balancoArma);
    itemHeroi(d, a, ax + maoArma, 33);
    if (baseDoItem(a.item) !== "orbe") punho(d, f.bracos[1] + maoArma, 33);
    if (comEscudo) escudo(dItem, f.bracos[0] + 1 + desvioDaMao(balanco), 31);
  }
  detalharMateriais(canvas, a, p);
  return marcarPersonagem(contornar(iluminarVolume(canvas, direcao), "auto"));
}

const cacheHerois = new Map();

function spritesHeroi(escolhas) {
  const chave = JSON.stringify(escolhas || {});
  if (!cacheHerois.has(chave)) {
    const conjunto = {};
    ["baixo", "cima", "lado", "ladoOposto"].forEach((direcao) => {
      conjunto[direcao] = PASSOS.map((_, q) => quadroHeroi(escolhas, direcao, q));
    });
    cacheHerois.set(chave, conjunto);
  }
  return cacheHerois.get(chave);
}

// Só o quadro parado, de frente: para quem não anda (moradores, retratos, estátuas).
// Bem mais barato que spritesHeroi, que desenha os 12 quadros da caminhada.
const cacheParados = new Map();
function heroiParado(escolhas) {
  const chave = JSON.stringify(escolhas || {});
  if (cacheHerois.has(chave)) return cacheHerois.get(chave).baixo[0];
  if (!cacheParados.has(chave)) cacheParados.set(chave, quadroHeroi(escolhas, "baixo", 0));
  return cacheParados.get(chave);
}
