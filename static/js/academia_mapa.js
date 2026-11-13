// A Academia por dentro: o lobby, as salas dos professores e a biblioteca, como cenários do motor de mundos (mundo.js).
// cenarioLobby({ origem, alunos, portas }), cenarioSala({ origem, licoes, professor }) e
// cenarioBiblioteca({ origem, estantes }) devolvem o que o motor precisa.
// Depende de pixel.js, avatar.js e heroi.js.

const T16 = 16;

// ---------- pequenos pintores de objetos ----------

function spriteDe(largura, altura, pintar, contorno = "auto") {
  const { canvas, ctx } = criarTela(largura + 2, altura + 2);
  ctx.translate(1, 1);
  pintar(ctx);
  return contorno ? contornar(canvas, contorno) : canvas;
}

function paredeDePedra(ctx, x0, y0, largura, altura, base = "#4a4170") {
  retangulo(ctx, x0, y0, largura, altura, base);
  for (let y = y0; y < y0 + altura; y += 8) {
    retangulo(ctx, x0, y, largura, 1, "#3a3360");
    const desloca = ((y - y0) / 8) % 2 ? 0 : 8;
    for (let x = x0 + desloca; x < x0 + largura; x += 16) retangulo(ctx, x, y, 1, 8, "#3a3360");
    for (let x = x0 + desloca + 3; x < x0 + largura; x += 16) retangulo(ctx, x, y + 1, 6, 1, "#5d5488");
  }
}

function janelaArco(ctx, x, y, largura, altura) {
  retangulo(ctx, x, y + 6, largura, altura - 6, "#6b5a8a");
  retangulo(ctx, x + 3, y + 2, largura - 6, 4, "#6b5a8a");
  retangulo(ctx, x + 2, y + 6, largura - 4, altura - 8, "#1a1240");
  retangulo(ctx, x + 4, y + 4, largura - 8, 2, "#1a1240");
  retangulo(ctx, x + largura / 2 - 1, y + 4, 2, altura - 6, "#6b5a8a");
  retangulo(ctx, x + 2, y + Math.floor(altura / 2), largura - 4, 2, "#6b5a8a");
  [[3, 8], [largura - 5, 12], [4, altura - 8], [largura - 6, altura - 12]].forEach(([dx, dy]) => retangulo(ctx, x + dx, y + dy, 1, 1, "#ffffff"));
}

function estandarte(ctx, x, y) {
  retangulo(ctx, x - 1, y, 12, 2, "#f5c451");
  retangulo(ctx, x, y + 2, 10, 26, "#5a3aa6");
  retangulo(ctx, x + 8, y + 2, 2, 26, "#4a2f93");
  retangulo(ctx, x, y + 28, 5, 3, "#5a3aa6");
  retangulo(ctx, x + 5, y + 28, 5, 2, "#4a2f93");
  desenharTexto(ctx, ["YYYYY", "...Y.", "..Y..", ".Y...", "YYYYY"], { Y: "#f5c451" }, x + 2, y + 10);
}

const SPRITES_ACADEMIA = {};
function spriteAcademia(nome, criar) {
  if (!SPRITES_ACADEMIA[nome]) SPRITES_ACADEMIA[nome] = criar();
  return SPRITES_ACADEMIA[nome];
}

const pilar = () => spriteAcademia("pilar", () => spriteDe(16, 52, (ctx) => {
  retangulo(ctx, 0, 46, 16, 6, "#8a8b99");
  retangulo(ctx, 0, 46, 16, 1, "#a3a6c2");
  retangulo(ctx, 2, 8, 12, 38, "#a3a6c2");
  retangulo(ctx, 10, 8, 4, 38, "#8a8b99");
  retangulo(ctx, 4, 8, 1, 38, "#c9cbe0");
  retangulo(ctx, 0, 2, 16, 6, "#8a8b99");
  retangulo(ctx, 0, 2, 16, 1, "#c9cbe0");
  retangulo(ctx, 1, 0, 14, 2, "#a3a6c2");
}));

const estante = () => spriteAcademia("estante", () => spriteDe(32, 40, (ctx) => {
  retangulo(ctx, 0, 0, 32, 40, "#5c3418");
  const cores = ["#a8323e", "#2e5cb8", "#1f7a5c", "#c46a1b", "#6c48c9", "#e2b04a"];
  for (let prateleira = 0; prateleira < 3; prateleira++) {
    const y = 3 + prateleira * 12;
    retangulo(ctx, 2, y, 28, 10, "#2b1608");
    let x = 3;
    let i = prateleira * 3;
    while (x < 29) {
      const largura = 2 + (i % 3);
      const alturaLivro = 7 + (i % 3);
      retangulo(ctx, x, y + 10 - alturaLivro, largura, alturaLivro, cores[i % cores.length]);
      retangulo(ctx, x, y + 10 - alturaLivro + 2, largura, 1, "#f5c451");
      x += largura + 1;
      i++;
    }
    retangulo(ctx, 0, y + 10, 32, 2, "#8b5a2b");
  }
}));

const planta = () => spriteAcademia("planta", () => spriteDe(16, 24, (ctx) => {
  retangulo(ctx, 3, 16, 10, 8, "#b5532a");
  retangulo(ctx, 2, 15, 12, 2, "#c46a1b");
  [[8, 6, 5], [4, 10, 4], [12, 10, 4], [8, 2, 3]].forEach(([cx, cy, r]) => {
    ctx.fillStyle = "#2f7d46";
    for (let y = -r; y <= r; y++) {
      const meia = Math.round(Math.sqrt(r * r - y * y));
      ctx.fillRect(cx - meia, cy + y, meia * 2 + 1, 1);
    }
  });
  [[6, 4], [10, 8], [5, 10], [9, 3]].forEach(([x, y]) => retangulo(ctx, x, y, 1, 1, "#5fb86b"));
}));

const banco = () => spriteAcademia("banco", () => spriteDe(32, 14, (ctx) => {
  retangulo(ctx, 0, 4, 32, 4, "#8b5a2b");
  retangulo(ctx, 0, 4, 32, 1, "#a8703a");
  retangulo(ctx, 0, 0, 32, 3, "#7a4d24");
  [[2], [28]].forEach(([x]) => retangulo(ctx, x, 8, 2, 6, "#5c3418"));
}));

const tocha = () => spriteAcademia("tocha", () => spriteDe(6, 12, (ctx) => {
  retangulo(ctx, 1, 4, 4, 8, "#5c3418");
  retangulo(ctx, 0, 4, 6, 2, "#8a8b99");
}));

function animarChama(ctx, x, y, t, fase = 0) {
  const pisca = Math.sin(t * 12 + fase) > 0;
  retangulo(ctx, x + 1, y + 1, 4, 3, "#ff7a1a");
  retangulo(ctx, x + 2, y - 1, 2, 2, "#ffd166");
  if (pisca) retangulo(ctx, x + 2, y - 3, 1, 2, "#ffd166");
  brilhoRedondo(ctx, x + 3, y + 1, 10, "255, 170, 60", 0.05);
}

// (com arvores_arte.js, a fonte da Academia e do Salão é a pintada; esta é a antiga, de reserva)
const fonte = () => (typeof fontePintada === "function" ? fontePintada(128, 88) : spriteAcademia("fonte", () => spriteDe(64, 44, (ctx) => {
  // bacia octogonal de pedra
  for (let y = 18; y < 44; y++) {
    const recuo = y < 22 ? 22 - y : y > 39 ? y - 39 : 0;
    retangulo(ctx, recuo * 2, y, 64 - recuo * 4, 1, y < 24 ? "#c9cbe0" : y > 40 ? "#6b6c7a" : "#8a8b99");
  }
  for (let y = 24; y < 36; y++) {
    const recuo = y < 27 ? 27 - y : y > 33 ? y - 33 : 0;
    retangulo(ctx, 6 + recuo * 2, y - 2, 52 - recuo * 4, 1, "#2f7fbf");
  }
  // pilar central
  retangulo(ctx, 28, 6, 8, 22, "#a3a6c2");
  retangulo(ctx, 33, 6, 3, 22, "#8a8b99");
  retangulo(ctx, 24, 4, 16, 3, "#c9cbe0");
  retangulo(ctx, 26, 26, 12, 3, "#8a8b99");
})));

function animarFonte(ctx, x, y, t) {
  if (typeof fontePintada === "function") return animarFontePintada(ctx, x, y, t, fonte());
  // água brilhando e cristal flutuando
  for (let i = 0; i < 6; i++) {
    const fase = (t * 1.5 + i / 6) % 1;
    retangulo(ctx, x + 12 + ((i * 9) % 40), y + 25 + ((i * 5) % 8), 3, 1, fase < 0.5 ? "#a7dcff" : "#7fc3e8");
  }
  for (let i = 0; i < 4; i++) {
    const fase = (t * 1.2 + i / 4) % 1;
    retangulo(ctx, x + 30 + (i % 2 ? 6 : -4), y + 8 + Math.round(fase * 14), 1, 2, "#a7dcff");
  }
  const flutua = Math.round(Math.sin(t * 2) * 2);
  const cy = y - 6 + flutua;
  [[32, cy - 4, 2, 1], [31, cy - 3, 4, 1], [30, cy - 2, 6, 3], [31, cy + 1, 4, 1], [32, cy + 2, 2, 1]].forEach(([cx, yy, w, h]) => {
    retangulo(ctx, x + cx + 1, yy, w, h, "#6ef0ff");
  });
  retangulo(ctx, x + 32, cy - 2, 1, 2, "#e6fdff");
  brilhoRedondo(ctx, x + 34, cy, 10, "110, 240, 255", 0.07 + Math.sin(t * 3) * 0.03);
}

const portaGrande = () => spriteAcademia("portaGrande", () => spriteDe(48, 56, (ctx) => {
  // moldura de pedra em arco
  retangulo(ctx, 0, 10, 48, 46, "#8a8b99");
  for (let i = 0; i < 10; i++) retangulo(ctx, 10 - i, i, 28 + i * 2, 1, "#8a8b99");
  retangulo(ctx, 6, 14, 36, 42, "#5c3418");
  for (let i = 0; i < 8; i++) retangulo(ctx, 14 - i, 6 + i, 20 + i * 2, 1, "#5c3418");
  // tábuas, ferragens e o Z dourado
  for (let x = 8; x < 42; x += 6) retangulo(ctx, x, 8, 1, 48, "#3a1f0c");
  retangulo(ctx, 23, 6, 2, 50, "#2b1608");
  [24, 44].forEach((y) => retangulo(ctx, 6, y, 36, 2, "#6d6d7a"));
  desenharTexto(ctx, ["YYYYY", "...Y.", "..Y..", ".Y...", "YYYYY"], { Y: "#f5c451" }, 21, 30);
  retangulo(ctx, 19, 38, 2, 3, "#f5c451");
  retangulo(ctx, 27, 38, 2, 3, "#f5c451");
}));

const portaPequena = (cor) => spriteAcademia(`porta-${cor}`, () => spriteDe(28, 40, (ctx) => {
  retangulo(ctx, 0, 6, 28, 34, "#8a8b99");
  for (let i = 0; i < 6; i++) retangulo(ctx, 6 - i, i, 16 + i * 2, 1, "#8a8b99");
  retangulo(ctx, 4, 8, 20, 32, cor);
  for (let i = 0; i < 4; i++) retangulo(ctx, 8 - i, 4 + i, 12 + i * 2, 1, cor);
  for (let x = 7; x < 24; x += 5) retangulo(ctx, x, 6, 1, 34, tom(cor, 0.6));
  retangulo(ctx, 19, 24, 2, 2, "#f5c451");
}));

// porta da sala de um professor; trancada, ganha correntes em X e um cadeado
const portaProfessor = (cor, trancada) => spriteAcademia(`portaProfessor-${cor}-${trancada}`, () => spriteDe(30, 44, (ctx) => {
  retangulo(ctx, 0, 8, 30, 36, "#8a8b99");
  for (let i = 0; i < 8; i++) retangulo(ctx, 7 - i, i, 16 + i * 2, 1, "#8a8b99");
  retangulo(ctx, 0, 8, 30, 1, "#a3a6c2");
  const madeira = trancada ? tom(cor, 0.55) : cor;
  retangulo(ctx, 4, 10, 22, 34, madeira);
  for (let i = 0; i < 6; i++) retangulo(ctx, 9 - i, 4 + i, 12 + i * 2, 1, madeira);
  for (let x = 8; x < 26; x += 5) retangulo(ctx, x, 6, 1, 38, tom(madeira, 0.7));
  // brasão do professor
  retangulo(ctx, 11, 14, 8, 8, "#f5c451");
  retangulo(ctx, 12, 22, 6, 1, "#f5c451");
  retangulo(ctx, 13, 23, 4, 1, "#f5c451");
  retangulo(ctx, 14, 24, 2, 1, "#f5c451");
  retangulo(ctx, 12, 15, 6, 6, tom(cor, trancada ? 0.9 : 1.45));
  if (trancada) {
    for (let i = 0; i < 21; i++) {
      const elo = i % 2 ? "#6b6c7a" : "#c9cbe0";
      retangulo(ctx, 4 + i, 12 + Math.round(i * 1.3), 2, 2, elo);
      retangulo(ctx, 24 - i, 12 + Math.round(i * 1.3), 2, 2, elo);
    }
    retangulo(ctx, 12, 24, 6, 4, "#8a8b99");
    retangulo(ctx, 13, 25, 4, 3, madeira);
    retangulo(ctx, 10, 27, 10, 8, "#c9a227");
    retangulo(ctx, 10, 27, 10, 1, "#f5d66b");
    retangulo(ctx, 14, 29, 2, 4, "#3a2406");
  } else {
    retangulo(ctx, 21, 27, 2, 2, "#f5c451");
  }
}));

// porta numa parede lateral, vista de lado: moldura de pedra e a folha de madeira em perspectiva
const portaLateral = (cor) => spriteAcademia(`portaLateral-${cor}`, () => spriteDe(18, 46, (ctx) => {
  retangulo(ctx, 0, 4, 18, 42, "#8a8b99");
  retangulo(ctx, 0, 4, 18, 2, "#a3a6c2");
  for (let i = 0; i < 4; i++) retangulo(ctx, 3 - i, i, 12 + i * 2, 1, "#8a8b99");
  retangulo(ctx, 3, 7, 12, 39, "#1b1533");
  // a folha aberta para dentro do salão
  for (let y = 8; y < 46; y++) retangulo(ctx, 5, y, 9, 1, (y % 6) < 1 ? tom(cor, 0.6) : y < 10 ? tom(cor, 1.2) : cor);
  for (let x = 7; x < 14; x += 3) retangulo(ctx, x, 9, 1, 37, tom(cor, 0.7));
  retangulo(ctx, 11, 26, 2, 2, "#f5c451");
  retangulo(ctx, 6, 14, 6, 5, "#f5c451");
  retangulo(ctx, 7, 15, 4, 3, tom(cor, 1.4));
}));

// estátua de pedra de um dragão de asas abertas, sobre um pedestal
const estatuaDragao = () => spriteAcademia("estatuaDragao", () => spriteDe(25, 23, (ctx) => {
  desenharTexto(ctx, [
    "..........S...S..........",
    "..........SS.SS..........",
    "...........SSS...........",
    "..........SSSSS..........",
    "..........SdSdS..........",
    "...........SSS...........",
    "..S.......sSSSs.......S..",
    "..SS.....sSSSSSs.....SS..",
    "..SSS...sSSSSSSSs...SSS..",
    "..SSSS.sSSSSSSSSSs.SSSS..",
    "...SSSSSSSdSSSdSSSSSSS...",
    "....SSSSSSdSSSdSSSSSS....",
    ".....SSSSSdSSSdSSSSS.....",
    "......sSSSSSSSSSSSs......",
    ".......sSSSSSSSSSs.......",
    "......sSS.SSSSS.SSs......",
    "......sSS.sSSSs.SSs......",
    ".....dddd.......dddd.....",
    "...ddddddddddddddddddd...",
    "...dsssssssssssssssssd...",
    "...dsssssssssssssssssd...",
    "...dsssssssssssssssssd...",
    "...ddddddddddddddddddd...",
  ], { S: "#a3a6c2", s: "#8a8b99", d: "#6b6c7a" });
}));

// os olhos da estátua brilham devagar
function animarOlhosDragao(ctx, x, y, t, fase) {
  const forca = 0.5 + Math.sin(t * 1.5 + fase) * 0.5;
  [[11, 5], [13, 5]].forEach(([dx, dy]) => retangulo(ctx, x + dx, y + dy, 1, 1, forca > 0.4 ? "#ff4d4d" : "#8a1f1f"));
  if (forca > 0.6) brilhoRedondo(ctx, x + 13, y + 6, 4, "255, 77, 77", 0.08);
}

// O dragão vermelho do lobby: o mesmo dragão da tela inicial (asas de morcego batendo, cauda ondulando,
// olho aceso), mas em cores (barriga dourada, membrana e chifre claros). Voa num oval em volta da fonte,
// inclinando nas curvas, com a sombra correndo no chão e, de vez em quando, uma baforada de fogo. É só
// enfeite: não é monstro, não chama para combate.
const CORES_DRAGAO_ACADEMIA = { corpo: "#b8322a", asaTras: "#6e1a16", barriga: "#f5c451", chifre: "#f4ecd8", membrana: "#ff8a6a" };
function animarDragaoVoando(ctx, cx, cy, t) {
  const ang = t * 0.42;
  const dx = Math.cos(ang) * 150;
  const dy = Math.sin(ang) * 46 + Math.sin(t * 2.3) * 3;
  const direita = -Math.sin(ang) > 0;
  const bate = Math.sin(t * 5.5);
  // a sombra no chão, bem embaixo e mais larga quando ele desce
  ctx.fillStyle = "rgba(10, 6, 24, 0.22)";
  ctx.beginPath();
  ctx.ellipse(Math.round(cx + dx), Math.round(cy + Math.sin(ang) * 46 + 66), 18, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(Math.round(cx + dx), Math.round(cy + dy));
  ctx.scale((direita ? 1 : -1) * 0.9, 0.9);
  // inclina o corpo conforme sobe ou desce na curva
  ctx.rotate(Math.cos(ang) * (direita ? -0.12 : 0.12));
  desenharDragaoVoando(ctx, 0, 0, t, bate, CORES_DRAGAO_ACADEMIA);
  // a baforada de fogo
  if (Math.sin(t * 0.8) > 0.9) {
    for (let i = 0; i < 9; i++) {
      const k = (t * 14 + i) % 9;
      ctx.fillStyle = k < 3 ? "#fff3b0" : k < 6 ? "#ffd166" : "#ff7a1a";
      ctx.globalAlpha = 1 - k / 10;
      ctx.fillRect(23 + k * 2.4, -6.5 + Math.sin(t * 20 + i) * (0.5 + k * 0.25), 2 + k * 0.3, 2 + k * 0.3);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// o bardo toca alaúde e as notas sobem coloridas
const NOTA_MUSICAL = ["..XX", "..X.", "..X.", "XXX.", "XX.."];
function animarBardo(ctx, x, y, t) {
  // alaúde no peito
  retangulo(ctx, x + 8, y + 20, 7, 6, "#a8703a");
  retangulo(ctx, x + 9, y + 19, 5, 1, "#a8703a");
  retangulo(ctx, x + 10, y + 22, 2, 2, "#3a2412");
  for (let i = 0; i < 6; i++) retangulo(ctx, x + 14 + i, y + 19 - i, 1, 1, "#5c3418");
  retangulo(ctx, x + 11 + (Math.floor(t * 8) % 2), y + 24, 2, 1, "#f1c9a5");
  const cores = ["#ffd166", "#7dff9a", "#ff7ad9", "#6ef0ff"];
  for (let i = 0; i < 3; i++) {
    const fase = (t * 0.6 + i / 3) % 1;
    if (fase > 0.85) continue;
    desenharTexto(ctx, NOTA_MUSICAL, { X: cores[(i + Math.floor(t * 0.6)) % cores.length] },
      x + 20 + Math.round(Math.sin(t * 2 + i) * 4) + i * 3, y + 10 - Math.round(fase * 30));
  }
}

const portoes = () => spriteAcademia("portoes", () => spriteDe(40, 40, (ctx) => {
  retangulo(ctx, 0, 0, 40, 40, "#4a4170");
  retangulo(ctx, 4, 4, 32, 36, "#3a1f0c");
  for (let x = 6; x < 36; x += 5) retangulo(ctx, x, 4, 2, 36, "#5c3418");
  [12, 28].forEach((y) => retangulo(ctx, 4, y, 32, 2, "#6d6d7a"));
  retangulo(ctx, 19, 4, 2, 36, "#2b1608");
}));

const pedestal = (estado) => spriteAcademia(`pedestal-${estado}`, () => spriteDe(22, 22, (ctx) => {
  retangulo(ctx, 2, 18, 18, 4, "#6b6c7a");
  retangulo(ctx, 5, 6, 12, 12, "#8a8b99");
  retangulo(ctx, 13, 6, 4, 12, "#6b6c7a");
  retangulo(ctx, 3, 3, 16, 3, "#a3a6c2");
  if (estado === "bloqueada") {
    retangulo(ctx, 4, 9, 14, 1, "#3d3d4a");
    retangulo(ctx, 4, 13, 14, 1, "#3d3d4a");
  }
}));

// grimório flutuando sobre o pedestal, na cor do estado da lição
const CORES_LICAO = { disponivel: "#f5c451", concluida: "#4fd1a5", opcional: "#a98bff", bloqueada: "#6b6c7a" };
function animarGrimorio(ctx, x, y, t, estado, fase) {
  const cor = CORES_LICAO[estado];
  const flutua = estado === "bloqueada" ? 0 : Math.round(Math.sin(t * 2 + fase) * 2);
  const by = y - 10 + flutua;
  if (estado === "disponivel") brilhoRedondo(ctx, x + 12, by + 4, 12, "245, 196, 81", 0.1 + Math.sin(t * 4 + fase) * 0.05);
  retangulo(ctx, x + 4, by, 7, 9, tom(cor, 0.55));
  retangulo(ctx, x + 12, by, 7, 9, tom(cor, 0.55));
  retangulo(ctx, x + 5, by + 1, 5, 7, "#f2ebdc");
  retangulo(ctx, x + 13, by + 1, 5, 7, "#f2ebdc");
  retangulo(ctx, x + 11, by, 1, 9, "#5c3418");
  [[6, 3], [6, 5], [14, 3], [14, 5]].forEach(([dx, dy]) => retangulo(ctx, x + dx, by + dy, 3, 1, "#8a7d55"));
  if (estado !== "bloqueada") {
    const brilho = (t * 2 + fase) % 3;
    retangulo(ctx, x + 2 + Math.round(brilho * 6), by - 3 - Math.round(brilho), 1, 1, cor);
  }
}

function spriteAluno(visual) {
  return heroiParado(visual);
}

function animarBalaoFala(ctx, x, y, t, largura) {
  if (Math.floor(t * 1.5) % 3 === 0) return;
  const bx = x + largura - 8;
  retangulo(ctx, bx, y - 6, 9, 6, "#ffffff");
  retangulo(ctx, bx + 1, y, 2, 1, "#ffffff");
  [1, 4, 7].forEach((dx) => retangulo(ctx, bx + dx, y - 3, 1, 1, "#1b1533"));
}

// ---------- o lobby ----------

const LOBBY = { colunas: 34, linhas: 26 };
// onde o herói aparece ao voltar de cada sala (na frente da porta, fora dos pilares)
const CHEGADAS_LOBBY = {
  sala: { x: 17 * T16, y: 5 * T16 + 8 },
  "sala-kaela": { x: 11 * T16 + 6, y: 6 * T16 + 8 },
  "sala-orion": { x: 23 * T16 - 6, y: 6 * T16 + 8 },
  biblioteca: { x: 30 * T16 + 6, y: 6 * T16 + 8 },
  carreira: { x: 3 * T16 + 8, y: 13 * T16 + 8 },
};

let chaoLobby = null;
function pintarChaoLobby() {
  const { canvas, ctx } = criarTela(LOBBY.colunas * T16, LOBBY.linhas * T16);
  retangulo(ctx, 0, 0, canvas.width, canvas.height, "#1b1533");
  // chão de pedra polida em xadrez, com veios
  for (let ty = 4; ty < 25; ty++) {
    for (let tx = 1; tx < 33; tx++) {
      const escuro = (tx + ty) % 2;
      retangulo(ctx, tx * T16, ty * T16, T16, T16, escuro ? "#5d5279" : "#6b5f8a");
      if ((tx * 7 + ty * 3) % 5 === 0) retangulo(ctx, tx * T16 + 3, ty * T16 + 5, 6, 1, escuro ? "#685c87" : "#786c97");
    }
  }
  // feixes de luz das janelas
  ctx.fillStyle = "rgba(255, 236, 190, 0.07)";
  [[40, 64], [480, 64]].forEach(([x, y]) => {
    for (let i = 0; i < 90; i++) ctx.fillRect(x + i * 0.6, y + i, 36, 1);
  });
  // tapete vermelho em cruz
  const tapete = (x, y, w, h) => {
    retangulo(ctx, x, y, w, h, "#8e1c3c");
    for (let i = 0; i < Math.max(w, h); i += 8) {
      if (w > h) retangulo(ctx, x + i + 3, y + Math.floor(h / 2), 2, 1, "#b8325a");
      else retangulo(ctx, x + Math.floor(w / 2), y + i + 3, 1, 2, "#b8325a");
    }
  };
  tapete(15 * T16 + 4, 4 * T16, 2 * T16 + 24, 21 * T16);
  // o tapete atravessa o salão até a porta da Sala da Carreira, na parede esquerda
  tapete(T16, 12 * T16 + 4, 30 * T16, 2 * T16 + 8);
  [[15 * T16 + 4, 4 * T16, 1, 21 * T16], [17 * T16 + 12, 4 * T16, 1, 21 * T16], [T16, 12 * T16 + 4, 30 * T16, 1], [T16, 14 * T16 + 11, 30 * T16, 1]]
    .forEach(([x, y, w, h]) => retangulo(ctx, x, y, w, h, "#f5c451"));
  // paredes
  paredeDePedra(ctx, 0, 0, canvas.width, 4 * T16);
  retangulo(ctx, 0, 4 * T16 - 4, canvas.width, 4, "#2b2548");
  paredeDePedra(ctx, 0, 4 * T16, T16, 22 * T16, "#3a3360");
  paredeDePedra(ctx, 33 * T16, 4 * T16, T16, 22 * T16, "#3a3360");
  paredeDePedra(ctx, 0, 25 * T16, canvas.width, T16, "#3a3360");
  retangulo(ctx, T16, 4 * T16, canvas.width - 2 * T16, 3, "rgba(0, 0, 0, 0.3)");
  janelaArco(ctx, 18, 6, 26, 50);
  janelaArco(ctx, 31 * T16 + 6, 6, 26, 50);
  [231, 302].forEach((x) => estandarte(ctx, x, 10));
  return canvas;
}

// portas: as salas dos professores ao lado da do Zetsu, [{ id, nome, icone, cor, liberada }] (esquerda, direita)
function cenarioLobby({ origem, alunos, portas = [] }) {
  if (!chaoLobby) chaoLobby = pintarChaoLobby();
  const props = [];
  const bloquear = (tx, ty, w = 1, h = 1) => {
    const lista = [];
    for (let x = tx; x < tx + w; x++) for (let y = ty; y < ty + h; y++) lista.push(`${x},${y}`);
    return lista;
  };
  [[4, 6], [10, 6], [23, 6], [29, 6], [4, 19], [10, 19], [23, 19], [29, 19]].forEach(([tx, ty]) => {
    props.push({ x: tx * T16 + 8, y: (ty + 1) * T16, sprite: pilar(), tilesBloqueados: bloquear(tx, ty) });
  });
  [[6, 4], [26, 4]].forEach(([tx, ty]) => {
    props.push({ x: tx * T16 + 16, y: (ty + 1) * T16, sprite: estante(), tilesBloqueados: bloquear(tx, ty, 2) });
  });
  const estatua = heroiParado({ pele: "#a3a6c2", corCabelo: "#8a8b99", manto: "#8a8b99", detalhe: "#c9cbe0", chapeu: "pontudo", item: "cajado", magia: "#6ef0ff", acessorio: "barba", cabelo: "longo" });
  [[13, 4], [20, 4]].forEach(([tx, ty]) => {
    props.push({ x: tx * T16 + 8, y: (ty + 1) * T16, sprite: estatua, tilesBloqueados: bloquear(tx, ty) });
  });
  [[2, 5], [31, 5], [2, 23], [31, 23]].forEach(([tx, ty]) => props.push({ x: tx * T16 + 8, y: (ty + 1) * T16, sprite: planta(), tilesBloqueados: bloquear(tx, ty) }));
  [[6, 16], [26, 16], [6, 9], [26, 9]].forEach(([tx, ty]) => props.push({ x: tx * T16 + 16, y: (ty + 1) * T16, sprite: banco(), tilesBloqueados: bloquear(tx, ty, 2) }));
  [88, 140, 400, 456].forEach((x, i) => props.push({
    x, y: 3 * T16 + 6, sprite: tocha(),
    animar: (ctx, x, y, t) => animarChama(ctx, x, y - 2, t, i),
  }));
  props.push({ x: 17 * T16, y: 15 * T16, sprite: fonte(), tilesBloqueados: bloquear(15, 12, 4, 3), animar: animarFonte });
  // estátuas de dragão guardando os portões
  [[13, 23], [21, 23]].forEach(([tx, ty], i) => props.push({
    x: tx * T16 + 8, y: (ty + 1) * T16, sprite: estatuaDragao(), tilesBloqueados: bloquear(tx, ty),
    animar: (ctx, x, y, t) => animarOlhosDragao(ctx, x, y, t, i * 2),
  }));
  // velas flutuando no salão
  const nada = spriteDe(2, 2, () => {}, null);
  [[6, 7], [12, 8], [22, 8], [28, 7], [9, 20], [25, 20]].forEach(([tx, ty], i) => props.push({
    x: tx * T16, y: ty * T16, sprite: nada, animar: (ctx, x, y, t) => animarVelaFlutuante(ctx, x, y, t, i * 1.3),
  }));
  // o dragãozinho voando em volta da fonte, por cima de tudo
  props.push({ x: 17 * T16, y: 10 * T16, porCima: true, animar: animarDragaoVoando });

  const lugares = [
    { id: "sala", nome: "Sala do Zetsu", icone: "📚", acao: "Entrar", sprite: portaGrande(), px: 17 * T16, py: 4 * T16, destaque: true },
    { id: "enfermaria", nome: "Enfermaria", icone: "🛏️", acao: "Descansar", sprite: portaPequena("#7b241c"), px: 4 * T16, py: 4 * T16, sobrepoe: true },
    { id: "biblioteca", nome: "Biblioteca", icone: "📖", acao: "Entrar", sprite: portaPequena("#1f5c4a"), px: 30 * T16, py: 4 * T16 },
    { id: "portoes", nome: "Reino de Elyndor", icone: "🗺️", acao: "Sair para o", sprite: portoes(), px: 17 * T16, py: 26 * T16, semTransicao: true },
    {
      id: "carreira", nome: "Sala da Carreira", icone: "💼", acao: "Entrar", sprite: portaLateral("#c46a1b"), px: 10, py: 14 * T16 + 4,
      entrada: { x: T16 + 12, y: 13 * T16 + 8 }, destaque: true, deslocarRotulo: 34,
    },
    ...portas.slice(0, 2).map((p, i) => ({
      id: p.id, nome: p.nome, icone: p.icone, acao: p.liberada ? "Entrar" : "Ver", liberada: p.liberada,
      sprite: portaProfessor(p.cor, !p.liberada), px: [11, 23][i] * T16, py: 4 * T16, sobrepoe: !p.liberada,
    })),
  ].map((l) => ({ ...l, entrada: l.entrada || { x: l.px, y: l.py > 20 * T16 ? 24 * T16 + 8 : 4 * T16 + 8 } }));

  alunos.forEach((aluno) => {
    const sprite = spriteAluno(aluno.visual);
    lugares.push({
      ...aluno, acao: "Falar", sprite, px: aluno.tx * T16 + 8, py: (aluno.ty + 1) * T16, sobrepoe: true, semRotulo: true,
      // o bardo fica tocando no lugar; os outros alunos passeiam um pouco pelo saguão
      ...(aluno.bardo ? {} : { visual: aluno.visual, passeia: 22 }),
      entrada: { x: aluno.tx * T16 + 8, y: (aluno.ty + 1) * T16 + 8 }, tilesBloqueados: [`${aluno.tx},${aluno.ty}`],
      animar: aluno.bardo
        ? (ctx, x, y, t) => animarBardo(ctx, x, y, t)
        : (ctx, x, y, t) => animarBalaoFala(ctx, x, y, t, sprite.width),
    });
  });

  return salaEmHD({
    colunas: LOBBY.colunas, linhas: LOBBY.linhas, chao: chaoLobby, corFundo: "#1b1533", props, lugares,
    andavel: (tx, ty) => tx >= 1 && tx <= 32 && ty >= 4 && ty <= 24,
    spawn: CHEGADAS_LOBBY[origem] || { x: 17 * T16, y: 21 * T16 + 8 },
  }, "lobby");
}

// ---------- a sala do Zetsu ----------

const SALA = { colunas: 24, linhas: 16 };

// letras de 3x5 pixels para o quadro-negro de cada professor
const LETRAS_QUADRO = {
  P: ["WWW", "W.W", "WWW", "W..", "W.."], C: ["WWW", "W..", "W..", "W..", "WWW"],
  T: ["WWW", ".W.", ".W.", ".W.", ".W."], F: ["WWW", "W..", "WW.", "W..", "W.."],
  A: [".W.", "W.W", "WWW", "W.W", "W.W"], I: ["WWW", ".W.", ".W.", ".W.", "WWW"],
  R: ["WW.", "W.W", "WW.", "W.W", "W.W"], G: ["WWW", "W..", "W.W", "W.W", "WWW"],
};

const chaoSalas = {};
function pintarChaoSala(professor) {
  const { canvas, ctx } = criarTela(SALA.colunas * T16, SALA.linhas * T16);
  retangulo(ctx, 0, 0, canvas.width, canvas.height, "#1b1533");
  // assoalho de madeira
  for (let y = 4 * T16; y < 15 * T16; y += 4) {
    retangulo(ctx, T16, y, canvas.width - 2 * T16, 4, (y / 4) % 2 ? "#8b5a2b" : "#7f5226");
    retangulo(ctx, T16, y + 3, canvas.width - 2 * T16, 1, "#6b4423");
    for (let x = T16 + ((y / 4) % 3) * 13; x < canvas.width - T16; x += 38) retangulo(ctx, x, y, 1, 3, "#6b4423");
  }
  // tapete redondo no centro
  for (let y = -3 * T16; y <= 3 * T16; y++) {
    const meia = Math.round(Math.sqrt(Math.max(0, 1 - (y / (3 * T16)) ** 2)) * 7 * T16);
    retangulo(ctx, 12 * T16 - meia, 11 * T16 + y, meia * 2, 1, Math.abs(y) > 2.6 * T16 ? "#f5c451" : professor.cor);
  }
  paredeDePedra(ctx, 0, 0, canvas.width, 4 * T16, professor.parede);
  retangulo(ctx, 0, 4 * T16 - 4, canvas.width, 4, "#2b2548");
  paredeDePedra(ctx, 0, 4 * T16, T16, 12 * T16, "#3a3360");
  paredeDePedra(ctx, 23 * T16, 4 * T16, T16, 12 * T16, "#3a3360");
  paredeDePedra(ctx, 0, 15 * T16, canvas.width, T16, "#3a3360");
  retangulo(ctx, 11 * T16, 15 * T16, 2 * T16, T16, "#5d5279");
  // lousa com a sigla da matéria do professor (P-C-T-F, API, RAG...)
  retangulo(ctx, 7 * T16 - 3, 6, 10 * T16 + 6, 44, "#8b5a2b");
  retangulo(ctx, 7 * T16, 9, 10 * T16, 38, "#1f3b2f");
  const letras = [...professor.quadro];
  const inicio = 7 * T16 + Math.round((10 * T16 - ((letras.length - 1) * 34 + 3)) / 2);
  letras.forEach((l, i) => desenharTexto(ctx, LETRAS_QUADRO[l], { W: "#e9f5ee" }, inicio + i * 34, 16));
  letras.slice(1).forEach((_, i) => retangulo(ctx, inicio + 10 + i * 34, 18, 10, 1, "#b8d8c4"));
  for (let i = 0; i < 6; i++) retangulo(ctx, 7 * T16 + 14 + i * 24, 34 + (i % 2) * 3, 14, 1, "#9cc2ab");
  retangulo(ctx, 7 * T16 + 6, 44, 10, 2, "#e9f5ee");
  janelaArco(ctx, 2 * T16, 6, 24, 46);
  janelaArco(ctx, 20 * T16 + 8, 6, 24, 46);
  return canvas;
}

// professor: { id, nome, visual, cor, parede, quadro }; licoes: [{ id, icone, estado, atual }]
function cenarioSala({ origem, licoes, professor }) {
  if (!chaoSalas[professor.id]) chaoSalas[professor.id] = pintarChaoSala(professor);
  const props = [];
  [[5, 4], [17, 4]].forEach(([tx, ty]) => props.push({ x: tx * T16 + 16, y: (ty + 1) * T16, sprite: estante(), tilesBloqueados: [`${tx},${ty}`, `${tx + 1},${ty}`] }));
  [[1, 5], [22, 5], [1, 14], [22, 14]].forEach(([tx, ty]) => props.push({ x: tx * T16 + 8, y: (ty + 1) * T16, sprite: planta(), tilesBloqueados: [`${tx},${ty}`] }));
  [4, 19].forEach((tx, i) => props.push({ x: tx * T16 + 8, y: 3 * T16 + 6, sprite: tocha(), animar: (ctx, x, y, t) => animarChama(ctx, x, y - 2, t, i) }));
  // púlpito na frente do Zetsu
  props.push({
    x: 12 * T16, y: 8 * T16,
    sprite: spriteAcademia("pulpito", () => spriteDe(28, 16, (ctx) => {
      retangulo(ctx, 2, 4, 24, 12, "#5c3418");
      retangulo(ctx, 0, 2, 28, 3, "#8b5a2b");
      retangulo(ctx, 6, 0, 7, 3, "#e9e4d4");
      retangulo(ctx, 14, 0, 7, 3, "#d9d3c4");
      retangulo(ctx, 12, 7, 4, 4, "#f5c451");
    })),
    tilesBloqueados: ["11,7", "12,7"],
  });

  const mestre = heroiParado(professor.visual);
  const lugares = [
    {
      id: "professor", nome: professor.nome, icone: professor.icone, acao: "Falar", sprite: mestre, visual: professor.visual, px: 12 * T16, py: 7 * T16, sobrepoe: true, destaque: true,
      entrada: { x: 12 * T16, y: 9 * T16 + 10 }, tilesBloqueados: ["11,6", "12,6"],
      animar: (ctx, x, y, t) => animarBalaoFala(ctx, x, y, t, mestre.width),
    },
    { id: "saida", nome: "Lobby", icone: "🚪", acao: "Voltar ao", sprite: spriteDe(32, 8, () => {}, null), px: 12 * T16, py: 16 * T16, entrada: { x: 12 * T16, y: 14 * T16 + 8 }, semRotulo: true },
  ];

  // as lições são grimórios em pedestais, dos dois lados do corredor que leva ao professor
  const posicoes = licoes.length > 4
    ? [[5, 9], [9, 9], [15, 9], [19, 9], [8, 12], [16, 12]]
    : [[5, 10], [9, 10], [15, 10], [19, 10]];
  licoes.slice(0, posicoes.length).forEach((licao, i) => {
    const [tx, ty] = posicoes[i];
    const estado = licao.estado;
    const sprite = pedestal(estado);
    lugares.push({
      id: `licao-${licao.id}`, licao, nome: `Lição ${i + 1}`, icone: licao.icone,
      acao: estado === "concluida" ? "Revisar" : estado === "bloqueada" ? "Ver" : "Estudar",
      liberada: estado !== "bloqueada", vencida: estado === "concluida", destaque: licao.atual,
      sprite, px: tx * T16 + 8, py: (ty + 1) * T16, sobrepoe: true, alturaRotulo: sprite.height + 18,
      entrada: { x: tx * T16 + 8, y: (ty + 1) * T16 + 10 }, tilesBloqueados: [`${tx},${ty}`],
      animar: (ctx, x, y, t) => animarGrimorio(ctx, x, y, t, estado, i),
    });
  });

  return salaEmHD({
    colunas: SALA.colunas, linhas: SALA.linhas, chao: chaoSalas[professor.id], corFundo: "#1b1533", props, lugares,
    andavel: (tx, ty) => tx >= 1 && tx <= 22 && ty >= 4 && ty <= 14,
    spawn: origem === "lobby" ? { x: 12 * T16, y: 13 * T16 + 8 } : { x: 12 * T16, y: 10 * T16 + 12 },
  }, `sala-${professor.id}`);
}

// ---------- a biblioteca ----------

const BIBLIOTECA_MAPA = { colunas: 26, linhas: 18 };

// estante alta de uma área de estudo, com os livros puxados para a cor da área
const estanteGrande = (cor) => spriteAcademia(`estanteGrande-${cor}`, () => spriteDe(44, 58, (ctx) => {
  retangulo(ctx, 0, 6, 44, 52, "#5c3418");
  retangulo(ctx, 2, 0, 40, 7, "#7a4d24");
  retangulo(ctx, 2, 0, 40, 1, "#a8703a");
  retangulo(ctx, 16, 1, 12, 5, cor); // plaquinha da área
  retangulo(ctx, 17, 2, 10, 3, tom(cor, 1.5));
  const tons = [cor, tom(cor, 0.7), tom(cor, 1.35), "#e9e4d4", tom(cor, 0.85)];
  for (let prateleira = 0; prateleira < 4; prateleira++) {
    const y = 9 + prateleira * 12;
    retangulo(ctx, 3, y, 38, 10, "#2b1608");
    let x = 4;
    let i = prateleira * 2;
    while (x < 39) {
      const largura = 2 + (i % 3);
      const alturaLivro = 7 + ((i * 2) % 3);
      if (i % 7 === 5) {
        // um livro deitado de vez em quando
        retangulo(ctx, x, y + 7, 7, 3, tons[(i + 1) % tons.length]);
        x += 8;
      } else {
        retangulo(ctx, x, y + 10 - alturaLivro, largura, alturaLivro, tons[i % tons.length]);
        retangulo(ctx, x, y + 10 - alturaLivro + 2, largura, 1, "#f5c451");
        x += largura + 1;
      }
      i++;
    }
    retangulo(ctx, 1, y + 10, 42, 2, "#8b5a2b");
  }
}));

const mesaLeitura = () => spriteAcademia("mesaLeitura", () => spriteDe(40, 22, (ctx) => {
  retangulo(ctx, 0, 6, 40, 6, "#8b5a2b");
  retangulo(ctx, 0, 6, 40, 1, "#a8703a");
  retangulo(ctx, 3, 12, 3, 10, "#5c3418");
  retangulo(ctx, 34, 12, 3, 10, "#5c3418");
  // livro aberto e uma pilha
  retangulo(ctx, 8, 2, 8, 5, "#f2ebdc");
  retangulo(ctx, 16, 2, 8, 5, "#e9e4d4");
  retangulo(ctx, 15, 2, 1, 5, "#8a7d55");
  [[10, 3], [10, 5], [18, 3], [18, 5]].forEach(([x, y]) => retangulo(ctx, x, y, 4, 1, "#8a7d55"));
  retangulo(ctx, 27, 3, 9, 2, "#2e5cb8");
  retangulo(ctx, 28, 1, 8, 2, "#a8323e");
  retangulo(ctx, 3, 3, 2, 3, "#e9e4d4"); // vela
}));

const balcao = () => spriteAcademia("balcao", () => spriteDe(56, 28, (ctx) => {
  retangulo(ctx, 0, 10, 56, 18, "#5c3418");
  retangulo(ctx, 0, 8, 56, 4, "#8b5a2b");
  retangulo(ctx, 0, 8, 56, 1, "#a8703a");
  for (let x = 6; x < 56; x += 12) retangulo(ctx, x, 14, 8, 10, "#4a2a12");
  retangulo(ctx, 6, 5, 10, 3, "#6c48c9"); // livros sobre o balcão
  retangulo(ctx, 7, 3, 8, 2, "#1f7a5c");
  retangulo(ctx, 40, 1, 6, 6, "#4cc9f0"); // globo de cristal
  retangulo(ctx, 41, 0, 4, 1, "#a7ecff");
  retangulo(ctx, 41, 2, 2, 2, "#e6fdff");
  retangulo(ctx, 42, 7, 2, 1, "#8a8b99");
}));

function animarVelaFlutuante(ctx, x, y, t, fase) {
  const vy = y - 34 + Math.round(Math.sin(t * 1.6 + fase) * 3);
  retangulo(ctx, x, vy, 3, 6, "#e9e4d4");
  retangulo(ctx, x + 1, vy - 2, 1, 2, Math.sin(t * 10 + fase) > 0 ? "#ffd166" : "#ff9a3c");
  brilhoRedondo(ctx, x + 1, vy - 1, 6, "255, 200, 100", 0.06);
}

function animarPoeiraMagica(ctx, x, y, t) {
  for (let i = 0; i < 5; i++) {
    const fase = (t * 0.4 + i / 5) % 1;
    retangulo(ctx, x - 20 + ((i * 13) % 40), y - 10 - Math.round(fase * 40), 1, 1, fase < 0.7 ? "#fff3b0" : "#a98bff");
  }
}

let chaoBiblioteca = null;
function pintarChaoBiblioteca() {
  const { colunas, linhas } = BIBLIOTECA_MAPA;
  const { canvas, ctx } = criarTela(colunas * T16, linhas * T16);
  retangulo(ctx, 0, 0, canvas.width, canvas.height, "#1b1533");
  // assoalho escuro de madeira
  for (let y = 4 * T16; y < 17 * T16; y += 4) {
    retangulo(ctx, T16, y, canvas.width - 2 * T16, 4, (y / 4) % 2 ? "#5c3a22" : "#543420");
    retangulo(ctx, T16, y + 3, canvas.width - 2 * T16, 1, "#45291a");
    for (let x = T16 + ((y / 4) % 3) * 11; x < canvas.width - T16; x += 34) retangulo(ctx, x, y, 1, 3, "#45291a");
  }
  // passadeira verde da porta até o balcão, e outra cruzando as estantes
  const passadeira = (x, y, w, h) => {
    retangulo(ctx, x, y, w, h, "#1f5c4a");
    retangulo(ctx, x + 2, y + 2, w - 4, h - 4, "#24705a");
    for (let i = 6; i < Math.max(w, h) - 6; i += 10) {
      if (w > h) retangulo(ctx, x + i, y + Math.floor(h / 2), 3, 1, "#f5c451");
      else retangulo(ctx, x + Math.floor(w / 2), y + i, 1, 3, "#f5c451");
    }
  };
  passadeira(12 * T16, 11 * T16 + 8, 2 * T16, 6 * T16 - 8);
  passadeira(3 * T16, 6 * T16, 20 * T16, T16 + 4);
  // parede do fundo forrada de estantes, com uma rosácea no meio
  paredeDePedra(ctx, 0, 0, canvas.width, 4 * T16);
  for (let x = T16; x < canvas.width - T16; x += 34) {
    if (Math.abs(x + 17 - 13 * T16) < 40) continue;
    ctx.drawImage(estante(), x, 4 * T16 - 44);
  }
  const rx = 13 * T16, ry = 22;
  for (let y = -16; y <= 16; y++) {
    const meia = Math.round(Math.sqrt(256 - y * y));
    retangulo(ctx, rx - meia, ry + y, meia * 2, 1, Math.abs(y) > 13 || meia > 13 ? "#6b5a8a" : "#1a1240");
  }
  const vitrais = ["#a8323e", "#2e5cb8", "#f5c451", "#1f7a5c", "#6c48c9", "#c46a1b"];
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    retangulo(ctx, rx + Math.round(Math.cos(ang) * 8) - 1, ry + Math.round(Math.sin(ang) * 8) - 1, 3, 3, vitrais[i % vitrais.length]);
  }
  retangulo(ctx, rx - 2, ry - 2, 4, 4, "#fff3b0");
  retangulo(ctx, 0, 4 * T16 - 4, canvas.width, 4, "#2b2548");
  paredeDePedra(ctx, 0, 4 * T16, T16, 14 * T16, "#3a3360");
  paredeDePedra(ctx, 25 * T16, 4 * T16, T16, 14 * T16, "#3a3360");
  paredeDePedra(ctx, 0, 17 * T16, canvas.width, T16, "#3a3360");
  retangulo(ctx, 12 * T16, 17 * T16, 2 * T16, T16, "#24705a");
  retangulo(ctx, T16, 4 * T16, canvas.width - 2 * T16, 3, "rgba(0, 0, 0, 0.3)");
  return canvas;
}

// estantes: [{ id, nome, icone, cor }] (até 6, da esquerda para a direita, na parede do fundo)
function cenarioBiblioteca({ origem, estantes }) {
  if (!chaoBiblioteca) chaoBiblioteca = pintarChaoBiblioteca();
  const props = [];
  const bloquear = (tx, ty, w = 1) => Array.from({ length: w }, (_, i) => `${tx + i},${ty}`);
  // corredores de estantes baixas e mesas de leitura
  [[2, 13], [4, 13], [20, 13], [22, 13]].forEach(([tx, ty]) => props.push({ x: tx * T16 + 16, y: (ty + 1) * T16, sprite: estante(), tilesBloqueados: bloquear(tx, ty, 2) }));
  [[5, 9], [21, 9]].forEach(([tx, ty], i) => props.push({
    x: tx * T16 + 8, y: (ty + 1) * T16, sprite: mesaLeitura(), tilesBloqueados: bloquear(tx - 1, ty, 3),
    animar: (ctx, x, y, t) => animarChama(ctx, x + 2, y, t, i),
  }));
  [[1, 5], [24, 5], [1, 16], [24, 16]].forEach(([tx, ty]) => props.push({ x: tx * T16 + 8, y: (ty + 1) * T16, sprite: planta(), tilesBloqueados: bloquear(tx, ty) }));
  // velas que flutuam pela sala (só a animação, sem corpo no chão)
  const nada = spriteDe(2, 2, () => {}, null);
  [[4, 8], [9, 7], [17, 7], [22, 8], [8, 12], [18, 12]].forEach(([tx, ty], i) => props.push({
    x: tx * T16, y: ty * T16, sprite: nada, animar: (ctx, x, y, t) => animarVelaFlutuante(ctx, x, y, t, i * 1.7),
  }));
  props.push({ x: 13 * T16, y: 11 * T16, sprite: balcao(), tilesBloqueados: bloquear(11, 10, 4), animar: (ctx, x, y, t) => animarPoeiraMagica(ctx, x + 28, y, t) });

  const bibliotecaria = heroiParado(BIBLIOTECARIA.visual);
  const lugares = [
    {
      id: "bibliotecaria", nome: "Mestra Lúmen", icone: "📚", acao: "Falar", sprite: bibliotecaria, visual: BIBLIOTECARIA.visual,
      px: 13 * T16, py: 10 * T16, sobrepoe: true, tilesBloqueados: bloquear(12, 9, 2),
      entrada: { x: 13 * T16, y: 11 * T16 + 10 },
      animar: (ctx, x, y, t) => animarBalaoFala(ctx, x, y, t, bibliotecaria.width),
    },
    { id: "saida", nome: "Lobby", icone: "🚪", acao: "Voltar ao", sprite: nada, px: 13 * T16, py: 18 * T16, entrada: { x: 13 * T16, y: 16 * T16 + 8 }, semRotulo: true },
  ];
  // com até 3 estantes elas ficam espaçadas; com mais, viram uma fileira de 6 ao longo da parede
  const colunasEstantes = estantes.length <= 3 ? [5, 13, 21] : [3, 7, 11, 15, 19, 23];
  estantes.slice(0, colunasEstantes.length).forEach((e, i) => {
    const cx = colunasEstantes[i] * T16;
    const sprite = estanteGrande(e.cor);
    lugares.push({
      id: `estante-${e.id}`, estante: e, nome: e.curto || e.nome, icone: e.icone, acao: "Ler", sprite, sobrepoe: true,
      px: cx, py: 5 * T16, entrada: { x: cx, y: 5 * T16 + 12 },
      tilesBloqueados: bloquear(Math.floor((cx - 22) / T16), 4, 4),
    });
  });

  return salaEmHD({
    colunas: BIBLIOTECA_MAPA.colunas, linhas: BIBLIOTECA_MAPA.linhas, chao: chaoBiblioteca, corFundo: "#1b1533", props, lugares,
    andavel: (tx, ty) => tx >= 1 && tx <= 24 && ty >= 4 && ty <= 16,
    spawn: origem === "lobby" ? { x: 13 * T16, y: 14 * T16 + 8 } : { x: 13 * T16, y: 12 * T16 + 8 },
  }, "biblioteca");
}

// ---------- a sala da carreira ----------

// os móveis da sala: cada um guarda um guia da Mentora de Carreira (3 tons por material e contorno colorido)
const MADEIRA = { clara: "#b07a45", base: "#8b5a2b", escura: "#5c3418", funda: "#3d220e" };
const MOVEIS_CARREIRA = {
  // cavalete com o mapa do caminho: trilha pontilhada subindo até a bandeira
  cavalete: () => spriteDe(28, 38, (ctx) => {
    [[3, 10], [23, 10]].forEach(([x, y]) => {
      retangulo(ctx, x, y, 2, 28, MADEIRA.escura);
      retangulo(ctx, x, y, 1, 28, MADEIRA.base);
    });
    retangulo(ctx, 13, 12, 2, 26, MADEIRA.funda);
    retangulo(ctx, 0, 0, 28, 26, MADEIRA.base);
    retangulo(ctx, 0, 0, 28, 1, MADEIRA.clara);
    retangulo(ctx, 2, 2, 24, 22, "#f2ebdc");
    retangulo(ctx, 2, 18, 24, 6, "#cfe8c4");
    retangulo(ctx, 2, 2, 24, 1, "#ffffff");
    [[5, 19], [8, 17], [11, 18], [14, 14], [17, 11], [20, 8]].forEach(([x, y]) => retangulo(ctx, x, y, 2, 1, "#c46a1b"));
    retangulo(ctx, 21, 3, 1, 6, MADEIRA.escura);
    retangulo(ctx, 22, 3, 3, 2, "#e63946");
    retangulo(ctx, 4, 19, 3, 3, "#2a9d8f");
    retangulo(ctx, 0, 25, 28, 2, MADEIRA.escura);
    retangulo(ctx, 0, 25, 28, 1, MADEIRA.clara);
  }),
  // quadro branco com os cartões das ferramentas e uma caneta no apoio
  quadro: () => spriteDe(34, 38, (ctx) => {
    [[4], [28]].forEach(([x]) => {
      retangulo(ctx, x, 22, 2, 16, "#4a4a55");
      retangulo(ctx, x, 22, 1, 16, "#8a8b99");
    });
    retangulo(ctx, 0, 0, 34, 25, "#8a8b99");
    retangulo(ctx, 0, 0, 34, 1, "#cfd6e6");
    retangulo(ctx, 2, 2, 30, 21, "#f4f7fb");
    retangulo(ctx, 2, 2, 30, 1, "#ffffff");
    const cores = ["#10a37f", "#d97757", "#4285f4", "#7f5af0", "#20808d", "#f4b400"];
    cores.forEach((cor, i) => {
      const x = 4 + (i % 3) * 10;
      const y = 4 + Math.floor(i / 3) * 9;
      retangulo(ctx, x, y, 8, 7, cor);
      retangulo(ctx, x, y, 8, 1, tom(cor, 1.4));
      retangulo(ctx, x + 1, y + 5, 6, 1, "#ffffff");
      retangulo(ctx, x + 3, y + 2, 2, 2, "#ffffff");
    });
    retangulo(ctx, 2, 23, 30, 2, "#6b6c7a");
    retangulo(ctx, 22, 22, 6, 1, "#e63946");
  }),
  // mesa redonda com notebook, caneca e papéis das áreas
  mesa: () => spriteDe(38, 26, (ctx) => {
    for (let y = 0; y < 10; y++) {
      const meia = Math.round(Math.sqrt(1 - ((y - 5) / 5.5) ** 2) * 19);
      retangulo(ctx, 19 - meia, 8 + y, meia * 2, 1, y < 2 ? MADEIRA.clara : y > 7 ? MADEIRA.escura : MADEIRA.base);
    }
    retangulo(ctx, 17, 17, 4, 9, MADEIRA.escura);
    retangulo(ctx, 17, 17, 1, 9, MADEIRA.base);
    retangulo(ctx, 11, 23, 16, 3, MADEIRA.funda);
    // notebook aberto, com a tela brilhando
    retangulo(ctx, 13, 1, 12, 8, "#3a3f4b");
    retangulo(ctx, 14, 2, 10, 6, "#6ef0ff");
    retangulo(ctx, 15, 3, 6, 1, "#e6fdff");
    retangulo(ctx, 15, 5, 4, 1, "#e6fdff");
    retangulo(ctx, 11, 9, 16, 2, "#8a8b99");
    retangulo(ctx, 11, 9, 16, 1, "#cfd6e6");
    // papéis e caneca
    retangulo(ctx, 3, 10, 7, 4, "#f2ebdc");
    retangulo(ctx, 4, 11, 4, 1, "#8a7d55");
    retangulo(ctx, 29, 9, 5, 5, "#e63946");
    retangulo(ctx, 34, 10, 1, 2, "#e63946");
    retangulo(ctx, 30, 9, 3, 1, "#5c3418");
  }),
  // arquivo de aço com as gavetas de modelos e uma planta em cima
  arquivo: () => spriteDe(24, 42, (ctx) => {
    retangulo(ctx, 0, 8, 24, 34, "#8a8b99");
    retangulo(ctx, 0, 8, 24, 2, "#cfd6e6");
    retangulo(ctx, 22, 8, 2, 34, "#6b6c7a");
    for (let i = 0; i < 3; i++) {
      retangulo(ctx, 2, 12 + i * 10, 18, 8, "#a3a6c2");
      retangulo(ctx, 2, 12 + i * 10, 18, 1, "#cfd6e6");
      retangulo(ctx, 8, 14 + i * 10, 6, 2, "#4a4a55");
      retangulo(ctx, 5, 17 + i * 10, 12, 1, "#f2ebdc");
    }
    retangulo(ctx, 8, 3, 8, 5, "#b5532a");
    retangulo(ctx, 8, 3, 8, 1, "#c46a1b");
    [[12, 0], [9, 1], [15, 1]].forEach(([x, y]) => retangulo(ctx, x, y, 2, 3, "#2f8a4c"));
  }),
  // mural de cortiça com as vagas presas por alfinetes
  mural: () => spriteDe(34, 38, (ctx) => {
    [[4], [28]].forEach(([x]) => retangulo(ctx, x, 22, 2, 16, MADEIRA.escura));
    retangulo(ctx, 0, 0, 34, 25, MADEIRA.base);
    retangulo(ctx, 0, 0, 34, 1, MADEIRA.clara);
    retangulo(ctx, 2, 2, 30, 21, "#c98d63");
    for (let i = 0; i < 18; i++) retangulo(ctx, 3 + ((i * 7) % 28), 3 + ((i * 5) % 19), 1, 1, "#b07a52");
    [[4, 4, "#f2ebdc"], [14, 3, "#ffd166"], [24, 5, "#f2ebdc"], [6, 13, "#a7dcff"], [17, 12, "#f2ebdc"], [25, 14, "#ffb3c1"]].forEach(([x, y, cor]) => {
      retangulo(ctx, x, y, 7, 8, cor);
      retangulo(ctx, x + 6, y + 1, 1, 7, tom(cor, 0.8));
      retangulo(ctx, x + 1, y + 3, 5, 1, "#8a7d55");
      retangulo(ctx, x + 1, y + 5, 4, 1, "#8a7d55");
      retangulo(ctx, x + 3, y, 1, 1, "#e63946");
    });
  }),
  // placa com a balança da ética, em moldura vinho
  placa: () => spriteDe(24, 36, (ctx) => {
    retangulo(ctx, 11, 20, 2, 16, MADEIRA.escura);
    retangulo(ctx, 6, 34, 12, 2, MADEIRA.funda);
    retangulo(ctx, 0, 0, 24, 22, "#7a1f3d");
    retangulo(ctx, 0, 0, 24, 1, "#a8325a");
    retangulo(ctx, 2, 2, 20, 18, "#f2ebdc");
    retangulo(ctx, 11, 4, 2, 12, "#8a6d12");
    retangulo(ctx, 4, 6, 16, 1, "#8a6d12");
    [[3, 7], [16, 7]].forEach(([x, y]) => {
      retangulo(ctx, x + 2, y, 1, 4, "#8a6d12");
      retangulo(ctx, x, y + 4, 5, 2, "#f5c451");
      retangulo(ctx, x, y + 4, 5, 1, "#ffe9a8");
    });
    retangulo(ctx, 8, 16, 8, 2, "#8a6d12");
    retangulo(ctx, 11, 3, 2, 1, "#f5c451");
  }),
};
const POSICOES_MOVEIS = { cavalete: [4, 4], quadro: [8, 4], arquivo: [16, 4], mural: [20, 4], mesa: [6, 11], placa: [18, 11] };
// nomes curtos para as placas do mapa (o título completo aparece no guia)
const ROTULOS_MOVEIS = { cavalete: "Começar", quadro: "Melhores IAs", arquivo: "Modelos", mural: "Vagas", mesa: "Tua área", placa: "Ética" };

// decoração da sala (sem guia): poltrona, globo, cafeteira e luminária
const ENFEITES_CARREIRA = {
  poltrona: () => spriteDe(22, 22, (ctx) => {
    retangulo(ctx, 2, 0, 18, 12, "#2e5cb8");
    retangulo(ctx, 2, 0, 18, 2, "#4a78d0");
    retangulo(ctx, 0, 8, 22, 9, "#2e5cb8");
    retangulo(ctx, 0, 8, 4, 9, "#244a96");
    retangulo(ctx, 18, 8, 4, 9, "#244a96");
    retangulo(ctx, 4, 10, 14, 5, "#4a78d0");
    retangulo(ctx, 6, 3, 10, 1, "#f5c451");
    [[1], [19]].forEach(([x]) => retangulo(ctx, x, 17, 2, 5, MADEIRA.escura));
  }),
  globo: () => spriteDe(16, 28, (ctx) => {
    for (let y = -6; y <= 6; y++) {
      const meia = Math.round(Math.sqrt(36 - y * y));
      retangulo(ctx, 8 - meia, 8 + y, meia * 2 + 1, 1, y < -2 ? "#4fa8ff" : "#2e7bd0");
    }
    [[5, 5, 3, 2], [9, 8, 3, 3], [4, 10, 2, 2]].forEach(([x, y, w, h]) => retangulo(ctx, x, y, w, h, "#4c9a2a"));
    retangulo(ctx, 5, 3, 2, 1, "#ffffff");
    retangulo(ctx, 1, 8, 1, 2, "#c9952a");
    retangulo(ctx, 14, 6, 1, 2, "#c9952a");
    retangulo(ctx, 7, 15, 2, 9, MADEIRA.escura);
    retangulo(ctx, 3, 24, 10, 3, MADEIRA.base);
    retangulo(ctx, 3, 24, 10, 1, MADEIRA.clara);
  }),
  cafeteira: () => spriteDe(26, 30, (ctx) => {
    retangulo(ctx, 0, 12, 26, 4, MADEIRA.clara);
    retangulo(ctx, 0, 16, 26, 14, MADEIRA.base);
    retangulo(ctx, 2, 18, 10, 10, MADEIRA.escura);
    retangulo(ctx, 14, 18, 10, 10, MADEIRA.escura);
    retangulo(ctx, 6, 22, 2, 2, "#c9952a");
    retangulo(ctx, 18, 22, 2, 2, "#c9952a");
    retangulo(ctx, 3, 2, 9, 10, "#3a3f4b");
    retangulo(ctx, 3, 2, 9, 1, "#8a8b99");
    retangulo(ctx, 5, 8, 5, 4, "#5c3418");
    retangulo(ctx, 7, 4, 2, 1, "#e63946");
    [[15, 8], [19, 9]].forEach(([x, y]) => {
      retangulo(ctx, x, y, 3, 4, "#f2ebdc");
      retangulo(ctx, x + 3, y + 1, 1, 2, "#f2ebdc");
    });
  }),
  luminaria: () => spriteDe(14, 40, (ctx) => {
    retangulo(ctx, 1, 0, 12, 8, "#f5c451");
    retangulo(ctx, 1, 0, 12, 1, "#ffe9a8");
    retangulo(ctx, 0, 7, 14, 1, "#c9952a");
    retangulo(ctx, 6, 8, 2, 29, "#4a4a55");
    retangulo(ctx, 3, 37, 8, 3, "#3a3f4b");
  }),
};

// fumacinha subindo da cafeteira e da caneca
function animarVapor(ctx, x, y, t, fase = 0) {
  for (let i = 0; i < 3; i++) {
    const vida = (t * 0.7 + i / 3 + fase) % 1;
    ctx.globalAlpha = 0.7 * (1 - vida);
    retangulo(ctx, x + Math.round(Math.sin(vida * 6 + i) * 2), y - Math.round(vida * 12), 1, 2, "#ffffff");
  }
  ctx.globalAlpha = 1;
}

// luz da luminária: um cone suave que pulsa devagar
function animarLuzLuminaria(ctx, x, y, t) {
  ctx.globalAlpha = 0.12 + Math.sin(t * 2) * 0.03;
  for (let i = 0; i < 14; i++) retangulo(ctx, x + 7 - i, y + 8 + i * 2, i * 2 + 1, 2, "#ffe9a8");
  ctx.globalAlpha = 1;
}

let chaoCarreira = null;
function pintarChaoCarreira() {
  const { canvas, ctx } = criarTela(SALA.colunas * T16, SALA.linhas * T16);
  retangulo(ctx, 0, 0, canvas.width, canvas.height, "#1b1533");
  // piso de taco em espinha de peixe: cada placa alterna tábuas deitadas e em pé
  for (let ty = 4; ty < 15; ty++) {
    for (let tx = 1; tx < 23; tx++) {
      const x0 = tx * T16;
      const y0 = ty * T16;
      retangulo(ctx, x0, y0, T16, T16, (tx * 3 + ty) % 5 ? "#7a4f2a" : "#734a27");
      for (let i = 0; i < 4; i++) {
        if ((tx + ty) % 2) {
          retangulo(ctx, x0, y0 + i * 4, T16, 1, "#5e3b1e");
          retangulo(ctx, x0 + ((i * 5 + tx) % 12), y0 + i * 4 + 2, 3, 1, "#8d5e33");
        } else {
          retangulo(ctx, x0 + i * 4, y0, 1, T16, "#5e3b1e");
          retangulo(ctx, x0 + i * 4 + 2, y0 + ((i * 5 + ty) % 12), 1, 3, "#8d5e33");
        }
      }
    }
  }
  // tapete azul com borda dourada e a rosa dos ventos da carreira no meio
  const [rx, ry, rw, rh] = [8 * T16, 9 * T16 + 6, 8 * T16, 4 * T16 + 4];
  retangulo(ctx, rx, ry, rw, rh, "#c9a227");
  retangulo(ctx, rx + 3, ry + 3, rw - 6, rh - 6, "#24346b");
  retangulo(ctx, rx + 6, ry + 6, rw - 12, rh - 12, "#2e4180");
  for (let x = rx + 8; x < rx + rw - 8; x += 8) {
    retangulo(ctx, x, ry + 4, 3, 1, "#f5c451");
    retangulo(ctx, x, ry + rh - 5, 3, 1, "#f5c451");
  }
  const [cx, cy] = [rx + rw / 2, ry + rh / 2];
  circuloPixel(ctx, cx, cy, 15, "#f5c451");
  circuloPixel(ctx, cx, cy, 13, "#24346b");
  for (let i = 1; i < 14; i++) {
    const largura = Math.max(1, Math.round((14 - i) / 4));
    retangulo(ctx, cx - Math.floor(largura / 2), cy - i, largura, 1, "#f5c451");
    retangulo(ctx, cx - Math.floor(largura / 2), cy + i, largura, 1, "#c9952a");
    retangulo(ctx, cx + i, cy - Math.floor(largura / 2), 1, largura, "#c9952a");
    retangulo(ctx, cx - i, cy - Math.floor(largura / 2), 1, largura, "#f5c451");
  }
  retangulo(ctx, cx - 1, cy - 1, 3, 3, "#e63946");
  // parede: papel listrado em cima, lambri de madeira embaixo, frisos dourados
  retangulo(ctx, 0, 0, canvas.width, 4 * T16, "#3b2a4f");
  for (let x = 0; x < canvas.width; x += 8) retangulo(ctx, x, 0, 3, 34, "#43305a");
  retangulo(ctx, 0, 33, canvas.width, 2, "#c9a227");
  retangulo(ctx, 0, 35, canvas.width, 4 * T16 - 35, "#5c3a1e");
  for (let x = 4; x < canvas.width - 20; x += 24) {
    retangulo(ctx, x, 39, 18, 18, "#6b4423");
    retangulo(ctx, x, 39, 18, 1, "#7a4f2a");
    retangulo(ctx, x, 56, 18, 1, "#4a2c14");
  }
  retangulo(ctx, 0, 4 * T16 - 4, canvas.width, 4, "#3a2412");
  janelaArco(ctx, 2 * T16, 4, 24, 28);
  janelaArco(ctx, 20 * T16 + 8, 4, 24, 28);
  // o gráfico da carreira subindo, numa moldura dourada
  retangulo(ctx, 9 * T16 - 2, 2, 6 * T16 + 4, 30, "#8a6d12");
  retangulo(ctx, 9 * T16, 4, 6 * T16, 26, "#c9a227");
  retangulo(ctx, 9 * T16 + 3, 6, 6 * T16 - 6, 22, "#f2ebdc");
  const alturas = [6, 10, 8, 14, 18];
  alturas.forEach((h, i) => {
    retangulo(ctx, 9 * T16 + 14 + i * 14, 26 - h, 9, h, ["#2a9d8f", "#3776ab", "#8e5cff", "#e76f51", "#34a853"][i]);
    retangulo(ctx, 9 * T16 + 14 + i * 14, 26 - h, 9, 1, "#ffffff");
  });
  // diplomas emoldurados dos dois lados
  [5, 7, 16, 18].forEach((tx) => {
    retangulo(ctx, tx * T16 + 1, 10, 14, 12, "#c9a227");
    retangulo(ctx, tx * T16 + 3, 12, 10, 8, "#f2ebdc");
    retangulo(ctx, tx * T16 + 5, 14, 6, 1, "#8a7d55");
    retangulo(ctx, tx * T16 + 7, 17, 2, 2, "#e63946");
  });
  paredeDePedra(ctx, 0, 4 * T16, T16, 12 * T16, "#3a3360");
  paredeDePedra(ctx, 23 * T16, 4 * T16, T16, 12 * T16, "#3a3360");
  paredeDePedra(ctx, 0, 15 * T16, canvas.width, T16, "#3a3360");
  retangulo(ctx, 11 * T16, 15 * T16, 2 * T16, T16, "#7a4f2a");
  return canvas;
}

// guias: [{ id, titulo, icone, movel }]; mentora: { nome, visual }
function cenarioCarreira({ origem, guias, mentora }) {
  if (!chaoCarreira) chaoCarreira = pintarChaoCarreira();
  const props = [];
  const bloquear = (tx, ty, w = 1) => Array.from({ length: w }, (_, i) => `${tx + i},${ty}`);
  [[1, 5], [22, 5], [1, 14], [22, 14]].forEach(([tx, ty]) => props.push({ x: tx * T16 + 8, y: (ty + 1) * T16, sprite: planta(), tilesBloqueados: [`${tx},${ty}`] }));
  // estantes cheias de livros de carreira, perto da porta
  [[3, 13], [19, 13]].forEach(([tx, ty]) => props.push({ x: tx * T16 + 16, y: (ty + 1) * T16, sprite: estante(), tilesBloqueados: bloquear(tx, ty, 2) }));
  // cantinho de conversa: poltronas e globo; cafeteira com vapor; luminária ao lado da mentora
  [[3, 8], [9, 13]].forEach(([tx, ty]) => props.push({ x: tx * T16 + 8, y: (ty + 1) * T16, sprite: spriteAcademia("poltrona", ENFEITES_CARREIRA.poltrona), tilesBloqueados: [`${tx},${ty}`] }));
  props.push({ x: 2 * T16 + 8, y: 11 * T16, sprite: spriteAcademia("globo", ENFEITES_CARREIRA.globo), tilesBloqueados: ["2,10"] });
  props.push({
    x: 21 * T16, y: 9 * T16, sprite: spriteAcademia("cafeteira", ENFEITES_CARREIRA.cafeteira), tilesBloqueados: bloquear(20, 8, 2),
    animar: (ctx, x, y, t) => {
      animarVapor(ctx, x + 7, y + 1, t);
      animarVapor(ctx, x + 17, y + 7, t, 0.5);
    },
  });
  props.push({
    x: 15 * T16, y: 8 * T16, sprite: spriteAcademia("luminaria", ENFEITES_CARREIRA.luminaria), tilesBloqueados: ["15,7"],
    animar: (ctx, x, y, t) => animarLuzLuminaria(ctx, x, y, t),
  });
  // arandelas acesas na parede
  const nada = spriteDe(2, 2, () => {}, null);
  [[4, 2], [8, 2], [16, 2], [20, 2]].forEach(([tx, ty], i) => props.push({
    x: tx * T16 - 2, y: ty * T16 + 8, sprite: nada, porCima: true,
    animar: (ctx, x, y, t) => {
      retangulo(ctx, x, y + 2, 5, 3, "#c9952a");
      animarChama(ctx, x, y - 2, t, i);
    },
  }));
  // mesa da mentora: tampo largo, monitor, papéis, caneca com vapor e um porta-retrato
  props.push({
    x: 12 * T16, y: 8 * T16,
    sprite: spriteAcademia("mesaMentora", () => spriteDe(44, 20, (ctx) => {
      retangulo(ctx, 0, 6, 44, 4, MADEIRA.clara);
      retangulo(ctx, 0, 6, 44, 1, "#c9925a");
      retangulo(ctx, 2, 10, 40, 10, MADEIRA.base);
      retangulo(ctx, 2, 10, 40, 1, MADEIRA.escura);
      [[5], [31]].forEach(([x]) => {
        retangulo(ctx, x, 12, 8, 6, MADEIRA.escura);
        retangulo(ctx, x + 3, 14, 2, 1, "#c9952a");
      });
      retangulo(ctx, 4, 0, 14, 7, "#3a3f4b");
      retangulo(ctx, 5, 1, 12, 5, "#6ef0ff");
      retangulo(ctx, 6, 2, 6, 1, "#e6fdff");
      retangulo(ctx, 22, 3, 7, 4, "#f2ebdc");
      retangulo(ctx, 23, 4, 4, 1, "#8a7d55");
      retangulo(ctx, 31, 2, 4, 5, "#e63946");
      retangulo(ctx, 35, 3, 1, 2, "#e63946");
      retangulo(ctx, 38, 1, 4, 6, "#c9a227");
      retangulo(ctx, 39, 2, 2, 4, "#a7dcff");
    })),
    tilesBloqueados: ["11,7", "12,7", "13,7"],
    animar: (ctx, x, y, t) => animarVapor(ctx, x + 32, y + 1, t, 0.3),
  });

  const sprite = heroiParado(mentora.visual);
  const lugares = [
    {
      id: "mentora", nome: mentora.nome.split(",")[0], icone: "💼", acao: "Falar", sprite, visual: mentora.visual, px: 12 * T16, py: 7 * T16, sobrepoe: true, destaque: true,
      entrada: { x: 12 * T16, y: 9 * T16 + 10 }, tilesBloqueados: ["11,6", "12,6"],
      animar: (ctx, x, y, t) => animarBalaoFala(ctx, x, y, t, sprite.width),
    },
    { id: "saida", nome: "Lobby", icone: "🚪", acao: "Voltar ao", sprite: nada, px: 12 * T16, py: 16 * T16, entrada: { x: 12 * T16, y: 14 * T16 + 8 }, semRotulo: true },
  ];
  guias.forEach((guia) => {
    const [tx, ty] = POSICOES_MOVEIS[guia.movel] || [12, 12];
    const movel = spriteAcademia(`movel-${guia.movel}`, MOVEIS_CARREIRA[guia.movel]);
    lugares.push({
      id: `guia-${guia.id}`, guia, nome: ROTULOS_MOVEIS[guia.movel] || guia.titulo, icone: guia.icone, acao: "Ler", sprite: movel, sobrepoe: true,
      px: tx * T16 + 8, py: (ty + 1) * T16, entrada: { x: tx * T16 + 8, y: (ty + 1) * T16 + 10 },
      tilesBloqueados: [`${tx},${ty}`, `${tx - 1},${ty}`, `${tx + 1},${ty}`],
    });
  });

  return salaEmHD({
    colunas: SALA.colunas, linhas: SALA.linhas, chao: chaoCarreira, corFundo: "#1b1533", props, lugares,
    andavel: (tx, ty) => tx >= 1 && tx <= 22 && ty >= 4 && ty <= 14,
    spawn: origem === "lobby" ? { x: 12 * T16, y: 13 * T16 + 8 } : { x: 12 * T16, y: 10 * T16 + 12 },
  }, "carreira");
}

// ---------- os portões se abrindo ----------

function portoesAbrindo(container) {
  const camada = document.createElement("div");
  camada.className = "portoes-abrindo";
  const folha = (lado) => {
    const sprite = spriteDe(60, 120, (ctx) => {
      retangulo(ctx, 0, 0, 60, 120, "#3a1f0c");
      for (let x = 2; x < 60; x += 8) retangulo(ctx, x, 0, 5, 120, "#5c3418");
      [20, 60, 100].forEach((y) => retangulo(ctx, 0, y, 60, 4, "#6d6d7a"));
      [6, 54].forEach((x) => [22, 62, 102].forEach((y) => retangulo(ctx, x, y, 2, 2, "#c9cbe0")));
      if (lado === "esq") {
        retangulo(ctx, 50, 54, 4, 10, "#f5c451");
        desenharTexto(ctx, ["YYYY", "..Y.", ".Y..", "YYYY"], { Y: "#f5c451" }, 52, 30);
      } else {
        retangulo(ctx, 6, 54, 4, 10, "#f5c451");
        desenharTexto(ctx, ["YYYY", ".Y..", "Y...", "YYYY"], { Y: "#f5c451" }, 4, 30);
      }
    }, null);
    const el = document.createElement("img");
    el.src = sprite.toDataURL();
    el.className = `pixel folha-portao folha-${lado}`;
    return el;
  };
  camada.append(folha("esq"), folha("dir"));
  container.append(camada);
  // a abertura usa animação CSS; a camada some sozinha no fim
  setTimeout(() => camada.classList.add("abrindo"), 250);
  setTimeout(() => camada.remove(), 2200);
}
