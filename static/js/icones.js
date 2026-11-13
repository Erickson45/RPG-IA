// Ícones de RPG em pixel art (no lugar dos emojis do HUD): moeda, árvore arcana, pergaminho de missões,
// mochila, as 5 habilidades do mapa e os do placar das dungeons. Cada um é uma grade de texto-pixel
// (pixel.js) com contorno automático; iconeRpg(nome) devolve a imagem pronta (data URL, em cache).

const PALETA_ICONES = {
  Y: "#fff3b0", G: "#f5c451", g: "#b8862a", o: "#7a5212",
  W: "#ffffff", w: "#c9c3d9", s: "#8a8aa0", S: "#5a5a70",
  B: "#8a5a2a", b: "#5e3a18", L: "#c08a4a",
  V: "#4caf50", v: "#2e7d32", l: "#9be37a",
  R: "#e04050", r: "#8a1a2a",
  P: "#a98bff", p: "#6a4fc0", C: "#6ec8ff", c: "#2a6fd6",
  E: "#ffe8a0", e: "#d8b878", F: "#ff9f43", f: "#ff5a1f", K: "#1b1533",
};

const ICONES_RPG = {
  moeda: [
    "...gggggg...",
    "..gYYYYYYg..",
    ".gYGGGGGGGo.",
    "gYGgggggGGGo",
    "gYgGGGGGgGGo",
    "gYgGYGGGgGGo",
    "gYgGGGGGgGGo",
    "gYgGGGGGgGGo",
    "gGGgggggGGGo",
    ".gGGGGGGGGo.",
    "..ooGGGGoo..",
    "...oooooo...",
  ],
  arvore: [
    "....pPPp....",
    "..pPPPCPPp..",
    ".pPCPPPPPPp.",
    "pPPPPPPPCPPp",
    "pPPPPCPPPPPp",
    ".pPPPPPPPPp.",
    "..ppPBBPpp..",
    ".....BB.....",
    ".....Bb.....",
    "....BBbb....",
    "...bB..Bb...",
  ],
  pergaminho: [
    ".bLLLLLLLLb.",
    "bLEEEEEEEELb",
    ".beeeeeeeeb.",
    "..EEEEEEEE..",
    "..EssssssE..",
    "..EEEEEEEE..",
    "..EsssssEE..",
    "..EEEEEEEE..",
    "..EsssEERE..",
    ".beeeeeRrRb.",
    "bLEEEEEERLb.",
    ".bLLLLLLLb..",
  ],
  mochila: [
    "....bbbb....",
    "...b....b...",
    "..bBBBBBBb..",
    ".bBLLLLLLBb.",
    ".bBBBBBBBBb.",
    ".bBGBBBBGBb.",
    ".bBBBBBBBBb.",
    ".bBbbbbbbBb.",
    ".bBLBGGBLBb.",
    ".bBLBBBBLBb.",
    ".bBBBBBBBBb.",
    "..bbbbbbbb..",
  ],
  corrida: [
    ".W....BB....",
    "WwW..BLLB...",
    ".WwW.BLLB...",
    "..WwWBLLB...",
    "...WwBLLB...",
    "....WBLLBB..",
    ".....BLLLBBb",
    "....bBLLLLLB",
    "....bBBBBBBB",
    "....bbbbbbbb",
  ],
  luz: [
    ".....Y.....",
    ".Y...G...Y.",
    "..G.....G..",
    "....GGG....",
    "...GYYYG...",
    "YG.GYWYG.GY",
    "...GYYYG...",
    "....GGG....",
    "..G.....G..",
    ".Y...G...Y.",
    ".....Y.....",
  ],
  cura: [
    "....bb....",
    "....LL....",
    "....ww....",
    "...wllw...",
    "..wVlVVw..",
    ".wVlVVVVw.",
    ".wVVVVVVw.",
    ".wVVVVVvw.",
    ".wvVVVVvw.",
    "..wvvvvw..",
    "...wwww...",
  ],
  teleporte: [
    "...ppppp...",
    ".ppPPPPPpp.",
    ".pPCCCCCPp.",
    "pPCpppppCPp",
    "pPCpCCCpCPp",
    "pPCpCWCpCPp",
    "pPCpCCpCCPp",
    "pPCppppCPPp",
    ".pPCCCCCPp.",
    ".ppPPPPPpp.",
    "...ppppp...",
  ],
  golpe: [
    "..........F",
    "........fF.",
    ".......fF..",
    ".....ffF...",
    "....fFF....",
    "..GFFf.....",
    ".GYYF......",
    "GYWYG......",
    "GYYYG......",
    ".GGG.......",
  ],
  espada: [
    ".........ww",
    "........wWw",
    ".......wWw.",
    "......wWw..",
    ".....wWw...",
    "..g.wWw....",
    "..GgWw.....",
    "...GGg.....",
    "..bGgGG....",
    ".bb..g.....",
    "bb.........",
  ],
  caveira: [
    "..wwwwww..",
    ".wWWWWWWw.",
    "wWWWWWWWWw",
    "wWKKWWKKWw",
    "wWKKWWKKWw",
    "wWWWWKWWWw",
    ".wWWWWWWw.",
    "..wKwKwK..",
    "..wwwwww..",
  ],
  bau: [
    "..bbbbbbbb..",
    ".bLLLLLLLLb.",
    "bLBBBGGBBBLb",
    "bBBBBGGBBBBb",
    "bgggggggggGb",
    "bBBBBYYBBBBb",
    "bBBBBGGBBBBb",
    "bBBBBBBBBBBb",
    "bbbbbbbbbbbb",
  ],
  coroa: [
    "G....G....G",
    "GG..GGG..GG",
    "GGG.GRG.GGG",
    "GGGGGGGGGGG",
    "GYGGRGRGGYG",
    "GGGGGGGGGGG",
    "ggggggggggg",
  ],
  // o Currículo do Herói: um tomo roxo com a estrela dourada na capa e as páginas na lateral
  curriculo: [
    "bbbbbbbbbbb.",
    "bPPPPPPPPPWb",
    "bPpPPGPPPpWb",
    "bPPPGYGPPPWb",
    "bPPGYYYGPPWb",
    "bPPPGYGPPPWb",
    "bPpPPGPPPpWb",
    "bPPPPPPPPPWb",
    "bPpppppppPWb",
    "bPPPPPPPPPWb",
    "bbbbbbbbbbWb",
    ".wwwwwwwwwww",
  ],
};

const cacheIconesRpg = new Map();
function iconeRpg(nome) {
  if (!ICONES_RPG[nome]) return "";
  if (!cacheIconesRpg.has(nome)) {
    const grade = ICONES_RPG[nome];
    const largura = Math.max(...grade.map((l) => l.length));
    const { canvas, ctx } = criarTela(largura + 2, grade.length + 2);
    desenharTexto(ctx, grade, PALETA_ICONES, 1, 1);
    cacheIconesRpg.set(nome, contornar(canvas, "auto").toDataURL());
  }
  return cacheIconesRpg.get(nome);
}

// <img> pronto do ícone (o tamanho vem do CSS de quem usa)
function imgIconeRpg(nome, classe = "") {
  const src = iconeRpg(nome);
  return src ? `<img class="icone-rpg ${classe}" src="${src}" alt="" draggable="false">` : "";
}

// ---------- molduras de janela em pixel (9-slice) ----------
// Cada moldura é um quadradinho em pixel art (anéis de fora para dentro, com luz em cima/esquerda e sombra
// embaixo/direita, rebites nos cantos e o miolo liso) que o CSS estica com border-image: os cantos ficam
// intactos e as bordas se repetem, como as janelas dos RPGs de 16 bits. Viram as variáveis --px-<nome>
// no :root (painel, pergaminho, dialogo, botao, botao-luz, botao-escuro, slot).
const MOLDURAS_PIXEL = {
  // a janela escura com aro de ouro (HUD, menus, painéis)
  painel: { tam: 24, aneis: [["#0b0816"], ["#ffe08a", "#9a6c1c"], ["#c9952a", "#6b4a12"], ["#0b0816"], ["#3d3170", "#100b20"]], fundo: "#1c1634", rebite: ["#fff3b0", "#b8862a"] },
  // o pergaminho (missões, provas, livros)
  pergaminho: { tam: 24, aneis: [["#2a1a06"], ["#e0b860", "#8a6d12"], ["#2a1a06"], ["#fff6dc", "#c9a86a"]], fundo: "#f0dca8", rebite: ["#a8323e", "#5a1218"] },
  // a caixa de diálogo clássica: azul-noite com aro claro
  dialogo: { tam: 24, aneis: [["#05030a"], ["#ffffff", "#9aa6d8"], ["#c9d2f5", "#5a64a0"], ["#05030a"], ["#2c3a8c", "#0c1238"]], fundo: "#172064", rebite: null },
  // botões: placa de ouro, ouro aceso (passar o mouse) e placa escura
  botao: { tam: 12, aneis: [["#2a1a06"], ["#fff3b0", "#a8741e"], ["#ffd77a", "#d39a2c"]], fundo: "#f2b840", rebite: null },
  "botao-luz": { tam: 12, aneis: [["#2a1a06"], ["#ffffff", "#c9952a"], ["#fff1b8", "#f0b93e"]], fundo: "#ffd166", rebite: null },
  "botao-escuro": { tam: 12, aneis: [["#0b0816"], ["#c9952a", "#5a4416"], ["#4a3d80", "#140e2a"]], fundo: "#271e4a", rebite: null },
  // espaço de inventário (carta de escolha, ícone de item)
  slot: { tam: 12, aneis: [["#0b0816"], ["#8a7fb8", "#2a2048"], ["#0b0816"]], fundo: "#140f28", rebite: null },
};

function molduraPixel(nome) {
  const m = MOLDURAS_PIXEL[nome];
  const { canvas, ctx } = criarTela(m.tam, m.tam);
  const n = m.tam;
  m.aneis.forEach(([luz, sombra = luz], k) => {
    // o anel k: lado de cima e da esquerda na luz, de baixo e da direita na sombra
    ctx.fillStyle = luz;
    ctx.fillRect(k, k, n - 2 * k, 1);
    ctx.fillRect(k, k, 1, n - 2 * k);
    ctx.fillStyle = sombra;
    ctx.fillRect(k, n - 1 - k, n - 2 * k, 1);
    ctx.fillRect(n - 1 - k, k, 1, n - 2 * k);
  });
  const k = m.aneis.length;
  ctx.fillStyle = m.fundo;
  ctx.fillRect(k, k, n - 2 * k, n - 2 * k);
  // os cantos cortados (o pixel de fora some: a janela não tem quina de caixa)
  ctx.clearRect(0, 0, 1, 1);
  ctx.clearRect(n - 1, 0, 1, 1);
  ctx.clearRect(0, n - 1, 1, 1);
  ctx.clearRect(n - 1, n - 1, 1, 1);
  if (m.rebite) {
    // um rebite em losango em cada canto, em cima do aro
    [[2, 2], [n - 5, 2], [2, n - 5], [n - 5, n - 5]].forEach(([x, y]) => {
      ctx.fillStyle = m.rebite[1];
      ctx.fillRect(x + 1, y, 1, 3);
      ctx.fillRect(x, y + 1, 3, 1);
      ctx.fillStyle = m.rebite[0];
      ctx.fillRect(x + 1, y + 1, 1, 1);
    });
  }
  return canvas.toDataURL();
}

(function instalarMolduras() {
  Object.keys(MOLDURAS_PIXEL).forEach((nome) => document.documentElement.style.setProperty(`--px-${nome}`, `url("${molduraPixel(nome)}")`));
})();

// Baú grande da tela de vitória (26 x 22), fechado ou aberto com o ouro brilhando lá dentro.
function bauPixelCanvas(aberto) {
  const { canvas, ctx } = criarTela(28, 26);
  ctx.translate(1, 1);
  const r = (x, y, w, h, c) => retangulo(ctx, x, y, w, h, PALETA_ICONES[c] || c);
  // o corpo
  r(1, 12, 24, 11, "B");
  for (let y = 14; y < 23; y += 3) r(1, y, 24, 1, "b");
  r(1, 22, 24, 1, "b");
  r(1, 12, 24, 1, "L");
  [3, 20].forEach((x) => { r(x, 12, 3, 11, "G"); r(x + 2, 12, 1, 11, "g"); });
  r(1, 12, 24, 2, "G");
  r(1, 13, 24, 1, "g");
  // a fechadura
  r(10, 13, 6, 6, "G");
  r(10, 18, 6, 1, "g");
  r(12, 15, 2, 2, "K");
  r(12, 17, 2, 1, "K");
  if (!aberto) {
    // a tampa abaulada
    r(5, 4, 16, 1, "L");
    r(3, 5, 20, 1, "B");
    r(2, 6, 22, 6, "B");
    r(2, 6, 22, 1, "L");
    for (let y = 8; y < 12; y += 2) r(2, y, 22, 1, "b");
    [3, 20].forEach((x) => { r(x, 5, 3, 7, "G"); r(x + 2, 5, 1, 7, "g"); });
    r(2, 11, 22, 1, "g");
    r(11, 9, 4, 3, "G");
    r(11, 11, 4, 1, "g");
  } else {
    // a tampa aberta para trás e o tesouro dentro
    r(2, 0, 22, 4, "b");
    r(2, 0, 22, 1, "B");
    [3, 20].forEach((x) => r(x, 0, 3, 4, "g"));
    r(2, 4, 22, 2, "K");
    r(2, 6, 22, 6, "o");
    [[3, 8], [5, 7], [7, 9], [9, 6], [11, 8], [13, 7], [15, 9], [17, 6], [19, 8], [21, 7]].forEach(([x, y]) => {
      r(x, y, 3, 12 - y, "G");
      r(x, y, 2, 1, "Y");
    });
    r(8, 5, 2, 2, "C");
    r(16, 5, 2, 2, "R");
    r(12, 4, 2, 2, "W");
  }
  return contornar(canvas, "auto");
}
