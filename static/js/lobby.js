// O Salão de Elyndor: o lobby do multijogador, um castelo enorme para encontrar outros aventureiros.
// cenarioSalao(estado) devolve o cenário para o motor de mundos (mundo.js). Não há monstros aqui.
//
// O mapa (84 x 56 tiles):
//   ao norte, a Sala de Estudos (oeste), o Grande Salão com o Palanque (meio), a Sala de Troféus e o
//   Mirante do Ninho dos dragões (leste); no meio, a Praça com a fonte, bancos, árvores e lampiões; a oeste,
//   a Galeria com o Quadro de Anotações enorme; a leste, o Coliseu dos duelos (arquibancada onde se senta,
//   muralha, braseiros e o camarote imperial); ao sul, o jardim e o portão de saída. Três dragões enormes
//   voam por cima de tudo e pousam nas torres.
// Quem fala de cima do palanque é ouvido no salão inteiro (o servidor confere a mesma área: salao.py).
//
// estado (lido a cada quadro, muda sem remontar o mapa): { recados: [...], ranking: [...], arena: [...] }
// Depende de pixel.js, avatar.js, heroi.js, academia_mapa.js (os móveis da Academia) e cenario_hd.js.

const SALAO_MAPA = { colunas: 84, linhas: 96 };
const T_SALAO = {
  FORA: 0, PEDRA: 1, MARMORE: 2, TAPETE: 3, PALCO: 4, AREIA: 5, GRAMA: 6, AGUA: 7, PAREDE: 8, ARQUIBANCADA: 9,
  PARAPEITO: 10, MURALHA: 11, NINHO: 12, CASA_RUNA: 13, CASA_ACO: 14, CASA_FLECHA: 15, FENDA: 16,
};
// O Distrito das Casas (ao sul do jardim, pela passagem do muro): a Praça das Bandeiras com a Taça das Casas,
// os três salões e o Círculo da Fenda (os chefões em grupo). As cores e os nomes das Casas vêm do servidor
// (salao.py, CASAS); aqui ficam o lugar e o desenho de cada uma.
const CASAS_DO_MAPA = {
  runa: { tipo: 13, x0: 3, y0: 73, x1: 22, y1: 89, porta: [11, 14], cor: "#6c48c9", escura: "#3b1f66", clara: "#b9a2ff" },
  aco: { tipo: 14, x0: 27, y0: 73, x1: 44, y1: 89, porta: [34, 37], cor: "#b8322a", escura: "#5c1010", clara: "#ff9a8a" },
  flecha: { tipo: 15, x0: 49, y0: 73, x1: 66, y1: 89, porta: [56, 59], cor: "#2f8a3a", escura: "#1b4d22", clara: "#9ae08a" },
};
const PRACA_DAS_BANDEIRAS = { x0: 22, y0: 59, x1: 49, y1: 69 };
const CIRCULO_DA_FENDA = { cx: 75.5, cy: 78, raio: 6.5 };
// o palanque (tiles), igual ao PALANQUE do salao.py
const PALANQUE_SALAO = { x0: 30, y0: 8, x1: 41, y1: 12 };
// O Coliseu: a areia no meio, o parapeito, a arquibancada em anéis de pedra (dá para sentar) e a muralha
// com quatro portões. O portão oeste é o dos duelistas: um túnel de areia até o meio.
const ARENA_SALAO = { cx: 66.5, cy: 32.5, raio: 5.6, parapeito: 6.4, arquibancada: 10.6, muralha: 12 };
// onde os dois duelistas ficam na arena (em unidades do mundo)
const LADOS_DA_ARENA = [
  { x: 63 * 16 + 8, y: 33 * 16 + 4, direcao: "dir" },
  { x: 70 * 16 + 8, y: 33 * 16 + 4, direcao: "esq" },
];
const CHEGADA_SALAO = { x: 36 * 16 + 8, y: 47 * 16 + 8 };
const CORES_DOS_RECADOS = { amarelo: "#ffe58a", rosa: "#ffb3cf", azul: "#a8d8ff", verde: "#b6f0a8", lilas: "#d5c2ff" };

let gradeSalao = null;
function gradeDoSalao() {
  if (gradeSalao) return gradeSalao;
  const { colunas, linhas } = SALAO_MAPA;
  const g = new Uint8Array(colunas * linhas);
  const pintar = (x0, y0, x1, y1, tipo) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < colunas && y < linhas) g[y * colunas + x] = tipo;
  };
  const { PEDRA, MARMORE, TAPETE, PALCO, AREIA, GRAMA, PAREDE, ARQUIBANCADA, PARAPEITO, MURALHA, NINHO } = T_SALAO;
  // a muralha de fora e a fachada do norte
  pintar(0, 0, colunas - 1, linhas - 1, PAREDE);
  // o jardim do sul e o caminho até o portão
  pintar(2, 48, 81, 53, GRAMA);
  pintar(32, 48, 39, 53, PEDRA);
  // a praça
  pintar(21, 17, 49, 47, PEDRA);
  // o Grande Salão com o palanque e o tapete até a fonte
  pintar(21, 4, 49, 16, MARMORE);
  pintar(PALANQUE_SALAO.x0, PALANQUE_SALAO.y0, PALANQUE_SALAO.x1, PALANQUE_SALAO.y1, PALCO);
  pintar(34, 13, 37, 27, TAPETE);
  pintar(21, 33, 49, 34, PEDRA);
  // Sala de Estudos (noroeste) e Sala de Troféus (nordeste), com as portas para a praça
  pintar(2, 4, 19, 16, MARMORE);
  pintar(9, 17, 12, 17, MARMORE);
  pintar(51, 4, 69, 16, MARMORE);
  pintar(58, 17, 61, 17, MARMORE);
  // a Galeria do Quadro (oeste), com duas passagens para a praça
  pintar(2, 18, 19, 47, MARMORE);
  pintar(20, 25, 20, 28, PEDRA);
  pintar(20, 37, 20, 40, PEDRA);
  // o Mirante do Ninho (nordeste): o terraço onde os dragões do castelo pousam, com o ninho no meio
  pintar(71, 4, 81, 16, PEDRA);
  pintar(74, 17, 77, 17, PEDRA);
  pintar(75, 8, 78, 10, NINHO);
  // o Coliseu (leste): o pátio de pedra em volta e, dentro da muralha, os anéis da arquibancada
  pintar(51, 18, 81, 47, PEDRA);
  pintar(50, 31, 50, 34, PEDRA);
  const { cx, cy, raio, parapeito, arquibancada, muralha } = ARENA_SALAO;
  for (let y = 18; y <= 47; y++) {
    for (let x = 51; x <= 81; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d >= muralha) continue;
      // o túnel dos duelistas (oeste) atravessa tudo até a areia; os outros três portões levam aos degraus
      const tunel = dx < 0 && Math.abs(dy) < 1.5;
      // (no norte fica o camarote imperial, sem portão)
      const portao = (Math.abs(dx) < 1.5 && dy > 2) || (dx > 2 && Math.abs(dy) < 1.5);
      let tipo;
      if (d < raio || tunel) tipo = AREIA;
      else if (d < parapeito) tipo = PARAPEITO;
      else if (d < arquibancada) tipo = ARQUIBANCADA;
      else tipo = portao ? PEDRA : MURALHA;
      g[y * colunas + x] = tipo;
    }
  }
  // ---- o Distrito das Casas ----
  pintar(2, 56, 81, 93, GRAMA);
  pintar(34, 54, 37, 58, PEDRA); // a passagem no muro do jardim
  const p = PRACA_DAS_BANDEIRAS;
  pintar(p.x0, p.y0, p.x1, p.y1, PEDRA);
  pintar(50, 63, 70, 65, PEDRA); // o caminho até o Círculo da Fenda
  pintar(12, 66, 21, 68, PEDRA); // até o salão da Runa
  pintar(12, 68, 13, 72, PEDRA);
  pintar(50, 66, 57, 68, PEDRA); // até o salão da Flecha
  pintar(57, 68, 58, 72, PEDRA);
  pintar(35, 70, 36, 72, PEDRA); // até o salão do Aço
  Object.values(CASAS_DO_MAPA).forEach((c) => {
    pintar(c.x0, c.y0, c.x1, c.y1, PAREDE);
    pintar(c.x0 + 1, c.y0 + 1, c.x1 - 1, c.y1 - 1, c.tipo);
    pintar(c.porta[0], c.y0, c.porta[1], c.y0, c.tipo);
    // o tapete do meio, da porta até o estandarte
    pintar(c.porta[0] + 1, c.y0 + 1, c.porta[1] - 1, c.y1 - 3, TAPETE);
  });
  // o Círculo da Fenda: o pátio de pedra e, no meio, o chão rúnico onde a Fenda se abre
  pintar(69, 59, 81, 93, PEDRA);
  for (let y = 59; y <= 93; y++) {
    for (let x = 69; x <= 81; x++) {
      if (Math.hypot(x + 0.5 - CIRCULO_DA_FENDA.cx, y + 0.5 - CIRCULO_DA_FENDA.cy) < CIRCULO_DA_FENDA.raio) g[y * colunas + x] = T_SALAO.FENDA;
    }
  }
  gradeSalao = g;
  return g;
}
const tipoNoSalao = (tx, ty) => (tx < 0 || ty < 0 || tx >= SALAO_MAPA.colunas || ty >= SALAO_MAPA.linhas ? T_SALAO.FORA : gradeDoSalao()[ty * SALAO_MAPA.colunas + tx]);

// um "número da sorte" fixo por tile (as variações do chão saem sempre iguais)
const sorteDoTile = (x, y, k = 0) => {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

let chaoDoSalao = null;
function pintarChaoDoSalao() {
  const { colunas, linhas } = SALAO_MAPA;
  const T = 16;
  const { canvas, ctx } = criarTela(colunas * T, linhas * T);
  retangulo(ctx, 0, 0, canvas.width, canvas.height, "#1b1533");
  for (let ty = 0; ty < linhas; ty++) {
    for (let tx = 0; tx < colunas; tx++) {
      const x = tx * T;
      const y = ty * T;
      const s = sorteDoTile(tx, ty);
      switch (tipoNoSalao(tx, ty)) {
        case T_SALAO.PEDRA: {
          // lajes irregulares da praça: duas ou três pedras por tile, com o rejunte escuro
          const tons = ["#8f8aa6", "#86819d", "#9893ad", "#8a86a0"];
          retangulo(ctx, x, y, T, T, "#6d6886");
          if (s < 0.5) {
            retangulo(ctx, x + 1, y + 1, 14, 6, tons[Math.floor(s * 8) % 4]);
            retangulo(ctx, x + 1, y + 8, 6, 7, tons[(Math.floor(s * 16) + 1) % 4]);
            retangulo(ctx, x + 8, y + 8, 7, 7, tons[(Math.floor(s * 32) + 2) % 4]);
          } else {
            retangulo(ctx, x + 1, y + 1, 7, 14, tons[Math.floor(s * 8) % 4]);
            retangulo(ctx, x + 9, y + 1, 6, 8, tons[(Math.floor(s * 16) + 3) % 4]);
            retangulo(ctx, x + 9, y + 10, 6, 5, tons[(Math.floor(s * 32) + 1) % 4]);
          }
          if (s > 0.8) retangulo(ctx, x + 4, y + 3, 2, 1, "#a9a4bf");
          if (s < 0.06) retangulo(ctx, x + 10, y + 12, 3, 1, "#5fa84a"); // um tufinho de musgo
          break;
        }
        case T_SALAO.MARMORE: {
          const escuro = (tx + ty) % 2;
          retangulo(ctx, x, y, T, T, escuro ? "#5d5279" : "#6b5f8a");
          if ((tx * 7 + ty * 3) % 5 === 0) retangulo(ctx, x + 3, y + 5, 6, 1, escuro ? "#685c87" : "#786c97");
          break;
        }
        case T_SALAO.TAPETE: {
          retangulo(ctx, x, y, T, T, "#8e1c3c");
          if ((ty % 2) === 0) retangulo(ctx, x + 7, y + 6, 2, 3, "#b8325a");
          if (tipoNoSalao(tx - 1, ty) !== T_SALAO.TAPETE) retangulo(ctx, x, y, 1, T, "#f5c451");
          if (tipoNoSalao(tx + 1, ty) !== T_SALAO.TAPETE) retangulo(ctx, x + T - 1, y, 1, T, "#f5c451");
          break;
        }
        case T_SALAO.PALCO: {
          // tábuas do palanque, com a beirada da frente mais escura (o degrau)
          retangulo(ctx, x, y, T, T, "#9a6534");
          for (let i = 0; i < 4; i++) retangulo(ctx, x, y + i * 4, T, 1, "#7a4d24");
          retangulo(ctx, x + ((tx * 5 + ty * 3) % 12), y + 1 + (ty % 4), 1, 3, "#7a4d24");
          if (s > 0.7) retangulo(ctx, x + 3, y + 2, 4, 1, "#b47a42");
          if (ty === PALANQUE_SALAO.y1) {
            retangulo(ctx, x, y + 12, T, 4, "#5c3418");
            retangulo(ctx, x, y + 12, T, 1, "#c48a4e");
          }
          break;
        }
        case T_SALAO.AREIA: {
          retangulo(ctx, x, y, T, T, "#d9b77c");
          for (let i = 0; i < 4; i++) retangulo(ctx, x + Math.floor(sorteDoTile(tx, ty, i) * 15), y + Math.floor(sorteDoTile(tx, ty, i + 9) * 15), 1, 1, i % 2 ? "#c49d62" : "#ecd3a2");
          break;
        }
        case T_SALAO.GRAMA: {
          retangulo(ctx, x, y, T, T, (tx + ty) % 2 ? "#4f9a3e" : "#55a243");
          for (let i = 0; i < 3; i++) {
            const gx = x + Math.floor(sorteDoTile(tx, ty, i) * 14);
            const gy = y + Math.floor(sorteDoTile(tx, ty, i + 5) * 13);
            retangulo(ctx, gx, gy, 1, 2, "#78c25e");
          }
          if (s < 0.08) {
            retangulo(ctx, x + 6, y + 6, 2, 2, ["#ff9fe0", "#ffd166", "#ffffff"][Math.floor(s * 37) % 3]);
          }
          break;
        }
        case T_SALAO.ARQUIBANCADA: {
          // Os degraus de pedra do coliseu, em anéis: cada anel é um degrau (o de fora é o mais alto, mais
          // claro), com o espelho escuro na frente, almofadas de cor em alguns assentos e os corredores de
          // escada a cada 45 graus
          const { cx, cy, parapeito } = ARENA_SALAO;
          for (let py = 0; py < T; py += 2) {
            for (let px = 0; px < T; px += 2) {
              const dx = tx + (px + 1) / T - cx;
              const dy = ty + (py + 1) / T - cy;
              const dd = Math.hypot(dx, dy);
              const anel = Math.floor((dd - parapeito) / 1.05);
              const frac = ((dd - parapeito) % 1.05) / 1.05;
              const angulo = Math.atan2(dy, dx);
              const corredor = Math.abs(((angulo + Math.PI) % (Math.PI / 4)) - Math.PI / 8) > Math.PI / 8 - 0.09;
              const tons = ["#6f6a86", "#7d7894", "#8b86a2", "#9994ae"];
              let cor = tons[Math.min(3, Math.max(0, anel))];
              if (corredor) cor = Math.floor(dd * 3) % 2 ? "#a9a4bf" : "#8a85a0";
              else if (frac < 0.2) cor = "#3e3956";
              else if (frac < 0.3) cor = "#57526e";
              else if (sorteDoTile(Math.floor(angulo * 9), anel, 3) < 0.18 && frac > 0.45) cor = ["#8e1c3c", "#2e5cb8", "#b8862a"][anel % 3];
              retangulo(ctx, x + px, y + py, 2, 2, cor);
            }
          }
          break;
        }
        case T_SALAO.PARAPEITO: {
          // o muro baixo entre a areia e a plateia, de pedra clara com friso dourado
          retangulo(ctx, x, y, T, T, "#a3a6c2");
          for (let py = 0; py < T; py += 2) {
            for (let px = 0; px < T; px += 2) {
              const dd = Math.hypot(tx + (px + 1) / T - ARENA_SALAO.cx, ty + (py + 1) / T - ARENA_SALAO.cy);
              const f = (dd - ARENA_SALAO.raio) / (ARENA_SALAO.parapeito - ARENA_SALAO.raio);
              retangulo(ctx, x + px, y + py, 2, 2, f < 0.25 ? "#5d5e6b" : f < 0.45 ? "#c9cbe0" : f < 0.6 ? "#f5c451" : "#8a8b99");
            }
          }
          break;
        }
        case T_SALAO.MURALHA: {
          // a muralha alta do coliseu vista de cima: blocos grandes, o topo com as ameias do lado de fora
          retangulo(ctx, x, y, T, T, "#4a4170");
          for (let py = 0; py < T; py += 2) {
            for (let px = 0; px < T; px += 2) {
              const dx = tx + (px + 1) / T - ARENA_SALAO.cx;
              const dy = ty + (py + 1) / T - ARENA_SALAO.cy;
              const dd = Math.hypot(dx, dy);
              const ang = Math.atan2(dy, dx);
              const f = (dd - ARENA_SALAO.arquibancada) / (ARENA_SALAO.muralha - ARENA_SALAO.arquibancada);
              const bloco = (Math.floor(ang * 14) + Math.floor(f * 3)) % 2;
              let cor = bloco ? "#5d5488" : "#544b7c";
              if (f < 0.15) cor = "#2b2548";
              else if (f > 0.72) cor = Math.floor(ang * 40) % 2 ? "#7a72a8" : "#2b2548";
              retangulo(ctx, x + px, y + py, 2, 2, cor);
            }
          }
          break;
        }
        case T_SALAO.CASA_RUNA:
        case T_SALAO.CASA_ACO:
        case T_SALAO.CASA_FLECHA: {
          // o chão dos salões das Casas: mármore em xadrez na cor da casa, com um losango a cada tanto
          const casa = Object.values(CASAS_DO_MAPA).find((c) => c.tipo === tipoNoSalao(tx, ty));
          const escuro = (tx + ty) % 2;
          retangulo(ctx, x, y, T, T, escuro ? tom(casa.escura, 1.25) : tom(casa.escura, 1.55));
          if ((tx * 5 + ty * 7) % 9 === 0) {
            retangulo(ctx, x + 7, y + 4, 2, 2, casa.clara);
            retangulo(ctx, x + 6, y + 6, 4, 2, casa.clara);
            retangulo(ctx, x + 7, y + 8, 2, 2, casa.clara);
          }
          break;
        }
        case T_SALAO.FENDA: {
          // o chão rúnico da Fenda: pedra quase preta, com rachaduras roxas
          retangulo(ctx, x, y, T, T, (tx + ty) % 2 ? "#1d1430" : "#231a3a");
          if (s < 0.35) retangulo(ctx, x + Math.floor(s * 30), y + 3, 1, Math.floor(4 + s * 20), "#5a2f8a");
          if (s > 0.85) retangulo(ctx, x + 4, y + 9, 6, 1, "#7a3fd1");
          break;
        }
        case T_SALAO.NINHO: {
          // galhos trançados do ninho dos dragões
          retangulo(ctx, x, y, T, T, "#5c3418");
          for (let i = 0; i < 7; i++) {
            const gy = y + Math.floor(sorteDoTile(tx, ty, i) * 15);
            const gx = x + Math.floor(sorteDoTile(tx, ty, i + 7) * 10);
            retangulo(ctx, gx, gy, 6, 1, i % 2 ? "#8b5a2b" : "#3a1f0c");
          }
          break;
        }
        default: {
          // parede de pedra (os blocos), com o topo iluminado
          retangulo(ctx, x, y, T, T, "#3a3360");
          const des = ty % 2 ? 0 : 8;
          retangulo(ctx, x, y + 7, T, 1, "#2b2548");
          retangulo(ctx, x + ((des + 7) % 16), y, 1, 7, "#2b2548");
          retangulo(ctx, x + ((des + 15) % 16), y + 8, 1, 8, "#2b2548");
          retangulo(ctx, x + 2, y + 1, 4, 1, "#4a4170");
          if (tipoNoSalao(tx, ty + 1) !== T_SALAO.PAREDE && ty + 1 < linhas) retangulo(ctx, x, y + T - 3, T, 3, "#231d3d");
          break;
        }
      }
    }
  }
  // a areia da arena: o círculo pintado no meio e o brasão das duas espadas
  const ax = ARENA_SALAO.cx * T;
  const ay = ARENA_SALAO.cy * T;
  ctx.fillStyle = "#c49d62";
  for (let a = 0; a < 360; a += 3) {
    const r = 3.2 * T;
    ctx.fillRect(Math.round(ax + Math.cos((a * Math.PI) / 180) * r), Math.round(ay + Math.sin((a * Math.PI) / 180) * r * 0.9), 2, 2);
  }
  for (let i = -10; i <= 10; i++) {
    retangulo(ctx, Math.round(ax + i), Math.round(ay + i), 2, 2, "#a8803f");
    retangulo(ctx, Math.round(ax - i), Math.round(ay + i), 2, 2, "#a8803f");
  }
  // a fachada do norte: muralha alta com janelas em arco, estandartes e as ameias
  paredeDePedra(ctx, 0, 0, canvas.width, 4 * T);
  retangulo(ctx, 0, 4 * T - 4, canvas.width, 4, "#2b2548");
  for (let x = 0; x < canvas.width; x += 12) retangulo(ctx, x, 0, 7, 4, "#5d5488");
  [40, 120, 260, 420, 700, 860, 980, 1080].forEach((x) => janelaArco(ctx, x, 10, 26, 44));
  [400, 470, 650, 720].forEach((x) => estandarte(ctx, x, 12));
  // o muro entre o jardim e o Distrito das Casas (com a passagem) e o muro do sul
  for (let x = 0; x < canvas.width; x += 12) {
    if (x + 7 < 34 * T || x > 38 * T) retangulo(ctx, x, 54 * T, 7, 3, "#5d5488");
    retangulo(ctx, x, 94 * T, 7, 3, "#5d5488");
  }
  // o círculo de runas da Fenda: um anel de pontos brilhantes e os símbolos nos quatro cantos
  const fx = CIRCULO_DA_FENDA.cx * T;
  const fy = CIRCULO_DA_FENDA.cy * T;
  for (let a = 0; a < 360; a += 4) {
    const r = (CIRCULO_DA_FENDA.raio - 0.6) * T;
    retangulo(ctx, Math.round(fx + Math.cos((a * Math.PI) / 180) * r), Math.round(fy + Math.sin((a * Math.PI) / 180) * r), 2, 2, a % 12 ? "#7a3fd1" : "#d07bff");
  }
  [0, 90, 180, 270].forEach((g) => {
    const r = (CIRCULO_DA_FENDA.raio - 2) * T;
    const rx = Math.round(fx + Math.cos((g * Math.PI) / 180) * r);
    const ry = Math.round(fy + Math.sin((g * Math.PI) / 180) * r);
    desenharTexto(ctx, ["P.P.P", ".PPP.", "PPPPP", ".PPP.", "P.P.P"], { P: "#a98bff" }, rx - 2, ry - 2);
  });
  return canvas;
}

const SPRITES_SALAO = {};
function spriteSalao(nome, criar) {
  if (!SPRITES_SALAO[nome]) SPRITES_SALAO[nome] = criar();
  return SPRITES_SALAO[nome];
}

// (com arvores_arte.js, a árvore de vaso é a pintada com o pincel do bestiário; esta é a antiga, de reserva)
const arvoreDoSalao = (variante = 0) => (typeof arvorePintada === "function" ? arvorePintada("vaso", variante) : spriteSalao(`arvore-${variante}`, () => spriteDe(32, 46, (ctx) => {
  // o vaso de pedra, o tronco e a copa redonda em três tons
  retangulo(ctx, 8, 38, 16, 8, "#8a8b99");
  retangulo(ctx, 7, 37, 18, 2, "#a3a6c2");
  retangulo(ctx, 14, 26, 4, 12, "#6b3e1f");
  const tons = variante ? ["#2f6e3a", "#3f8a48", "#5fb86b"] : ["#2a5a28", "#3b7d2e", "#6fae58"];
  [[16, 16, 13], [9, 20, 8], [23, 20, 8], [16, 9, 9]].forEach(([cx, cy, r], i) => {
    for (let y = -r; y <= r; y++) {
      const meia = Math.round(Math.sqrt(r * r - y * y));
      retangulo(ctx, cx - meia, cy + y, meia * 2 + 1, 1, tons[i === 3 ? 1 : 0]);
    }
  });
  [[12, 8], [18, 6], [10, 15], [20, 13], [15, 19], [24, 18]].forEach(([x, y]) => retangulo(ctx, x, y, 2, 2, tons[2]));
  if (variante === 2) [[9, 12], [21, 9], [14, 22], [25, 21]].forEach(([x, y]) => retangulo(ctx, x, y, 2, 2, "#ff9fe0"));
})));

// (com arvores_arte.js, o poste é o pintado, com a lanterna de vidro; este é o antigo, de reserva)
const posteDoSalao = () => (typeof postePintado === "function" ? postePintado(20, 80, "#ffd98a") : spriteSalao("poste", () => spriteDe(10, 40, (ctx) => {
  retangulo(ctx, 3, 36, 4, 4, "#2b2540");
  retangulo(ctx, 4, 8, 2, 28, "#3a3360");
  retangulo(ctx, 1, 2, 8, 7, "#2b2540");
  retangulo(ctx, 2, 3, 6, 5, "#ffd98a");
  retangulo(ctx, 0, 1, 10, 1, "#4a4170");
})));

const mesaDeEstudo = () => spriteSalao("mesa", () => spriteDe(32, 22, (ctx) => {
  retangulo(ctx, 0, 6, 32, 6, "#7a4d24");
  retangulo(ctx, 0, 6, 32, 1, "#a8703a");
  retangulo(ctx, 2, 12, 3, 10, "#5c3418");
  retangulo(ctx, 27, 12, 3, 10, "#5c3418");
  // livros abertos, um tinteiro e a vela
  retangulo(ctx, 5, 3, 10, 4, "#f3ead2");
  retangulo(ctx, 10, 3, 1, 4, "#c9b48a");
  retangulo(ctx, 18, 2, 4, 5, "#2e5cb8");
  retangulo(ctx, 22, 3, 3, 4, "#a8323e");
  retangulo(ctx, 27, 2, 2, 5, "#e9e4d4");
}));

const pedestalTrofeu = (cor) => spriteSalao(`trofeu-${cor}`, () => spriteDe(16, 30, (ctx) => {
  retangulo(ctx, 1, 18, 14, 12, "#8a8b99");
  retangulo(ctx, 1, 18, 14, 2, "#c9cbe0");
  retangulo(ctx, 4, 14, 8, 4, cor);
  retangulo(ctx, 3, 4, 10, 8, cor);
  retangulo(ctx, 0, 5, 3, 4, cor);
  retangulo(ctx, 13, 5, 3, 4, cor);
  retangulo(ctx, 6, 12, 4, 2, cor);
  retangulo(ctx, 5, 5, 2, 5, "#ffffff");
}));

const pulpito = () => spriteSalao("pulpito", () => spriteDe(20, 26, (ctx) => {
  retangulo(ctx, 2, 8, 16, 18, "#5c3418");
  retangulo(ctx, 2, 8, 16, 2, "#a8703a");
  retangulo(ctx, 0, 4, 20, 5, "#7a4d24");
  retangulo(ctx, 0, 4, 20, 1, "#c48a4e");
  retangulo(ctx, 6, 13, 8, 8, "#5a3aa6");
  desenharTexto(ctx, ["Y.Y", ".Y.", "Y.Y"], { Y: "#f5c451" }, 8, 15);
}));

// o Quadro de Anotações enorme: moldura de madeira, cortiça e o letreiro; os recados são desenhados por cima
const LARGURA_QUADRO = 224;
const ALTURA_QUADRO = 82;
const quadroDeAnotacoes = () => spriteSalao("quadro", () => spriteDe(LARGURA_QUADRO, ALTURA_QUADRO, (ctx) => {
  // os pés
  [[14, 70], [LARGURA_QUADRO - 20, 70]].forEach(([x, y]) => retangulo(ctx, x, y, 6, 12, "#4a2a12"));
  retangulo(ctx, 0, 8, LARGURA_QUADRO, 64, "#6b3e1f");
  retangulo(ctx, 0, 8, LARGURA_QUADRO, 2, "#a8703a");
  retangulo(ctx, 4, 14, LARGURA_QUADRO - 8, 54, "#b8834e");
  // a textura da cortiça
  for (let i = 0; i < 520; i++) {
    const x = 4 + ((i * 53) % (LARGURA_QUADRO - 9));
    const y = 14 + ((i * 29) % 53);
    retangulo(ctx, x, y, 1, 1, i % 3 ? "#a87443" : "#c99561");
  }
  // o letreiro em cima
  retangulo(ctx, LARGURA_QUADRO / 2 - 46, 0, 92, 12, "#3a1f0c");
  retangulo(ctx, LARGURA_QUADRO / 2 - 45, 1, 90, 10, "#5c3418");
  retangulo(ctx, LARGURA_QUADRO / 2 - 45, 1, 90, 1, "#f5c451");
}));

const muralDosCampeoes = () => spriteSalao("campeoes", () => spriteDe(120, 64, (ctx) => {
  retangulo(ctx, 0, 0, 120, 64, "#3a1f0c");
  retangulo(ctx, 2, 2, 116, 60, "#1b1533");
  retangulo(ctx, 2, 2, 116, 1, "#f5c451");
  retangulo(ctx, 2, 61, 116, 1, "#f5c451");
  retangulo(ctx, 2, 2, 1, 60, "#f5c451");
  retangulo(ctx, 117, 2, 1, 60, "#f5c451");
  [[4, 4], [112, 4], [4, 56], [112, 56]].forEach(([x, y]) => retangulo(ctx, x, y, 4, 4, "#f5c451"));
}));

// letreiro em pixel (fonte do jogo) dentro do desenho do mundo
function letreiroNoMundo(ctx, texto, x, y, { tamanho = 7, cor = "#f5e6b8", alinhar = "center", borda = "#1b1205" } = {}) {
  ctx.font = `${tamanho}px 'Jersey 10', monospace`;
  ctx.textAlign = alinhar;
  ctx.textBaseline = "alphabetic";
  ctx.lineWidth = Math.max(1, tamanho / 5);
  ctx.strokeStyle = borda;
  ctx.strokeText(texto, x, y);
  ctx.fillStyle = cor;
  ctx.fillText(texto, x, y);
}

// os recados pregados no quadro: até 36 papeizinhos coloridos (o mais novo no canto de cima); o texto
// inteiro se lê na janela do quadro (E)
function desenharRecadosNoQuadro(ctx, x0, y0, t, recados) {
  letreiroNoMundo(ctx, "QUADRO DE ANOTAÇÕES", x0 + LARGURA_QUADRO / 2, y0 + 9, { tamanho: 8, cor: "#ffd166" });
  const lista = (recados || []).slice(0, 36);
  if (!lista.length) {
    letreiroNoMundo(ctx, "Ninguém escreveu ainda: sê o primeiro!", x0 + LARGURA_QUADRO / 2, y0 + 44, { tamanho: 7 });
    return;
  }
  lista.forEach((r, i) => {
    const coluna = i % 12;
    const linha = Math.floor(i / 12);
    const sorte = sorteDoTile(r.id, 7);
    const px = x0 + 8 + coluna * 17.5 + Math.round(sorte * 3);
    const py = y0 + 17 + linha * 17 + Math.round(sorteDoTile(r.id, 3) * 3);
    // o recado novo chega balançando
    const idade = (Date.now() - (r.chegouEm || 0)) / 1000;
    const balanca = idade < 1.2 ? Math.round(Math.sin(idade * 18) * 2 * (1 - idade / 1.2)) : 0;
    retangulo(ctx, px + 1, py + 1, 14, 13, "rgba(40, 20, 5, 0.35)");
    retangulo(ctx, px + balanca, py, 14, 13, CORES_DOS_RECADOS[r.cor] || CORES_DOS_RECADOS.amarelo);
    for (let l = 0; l < 3; l++) retangulo(ctx, px + 2 + balanca, py + 4 + l * 3, 8 + Math.round(sorteDoTile(r.id, l) * 3), 1, "rgba(60, 40, 30, 0.45)");
    retangulo(ctx, px + 6 + balanca, py - 1, 2, 2, ["#e63946", "#2e5cb8", "#2a9d5c"][r.id % 3]);
    if (r.meu) retangulo(ctx, px + 11 + balanca, py + 10, 2, 2, "#f5c451");
  });
}

function desenharCampeoes(ctx, x0, y0, t, ranking) {
  letreiroNoMundo(ctx, "CAMPEÕES DA ARENA", x0 + 60, y0 + 12, { tamanho: 8, cor: "#ffd166" });
  const lista = (ranking || []).slice(0, 5);
  if (!lista.length) letreiroNoMundo(ctx, "A arena espera o primeiro campeão", x0 + 60, y0 + 36, { tamanho: 6 });
  const medalhas = ["#ffd166", "#d8dde8", "#d08a4a", "#a98bff", "#a98bff"];
  lista.forEach((c, i) => {
    const y = y0 + 22 + i * 8;
    retangulo(ctx, x0 + 8, y - 5, 5, 5, medalhas[i]);
    letreiroNoMundo(ctx, `${String(c.nome).slice(0, 18)}`, x0 + 16, y, { tamanho: 6, alinhar: "left", cor: i ? "#f5e6b8" : "#fff3b0" });
    letreiroNoMundo(ctx, `${c.vitorias} ⚔`, x0 + 112, y, { tamanho: 6, alinhar: "right", cor: "#ffd166" });
  });
  // um brilho passando pela moldura
  const k = (t * 0.3) % 1;
  retangulo(ctx, x0 + 2 + Math.round(k * 116), y0 + 2, 3, 1, "#fff3b0");
}

// O placar flutuante em cima da arena: quem está duelando, os pontos (ou as vidas) e a rodada; todo mundo vê
function desenharPlacarDaArena(ctx, camera, t, arena) {
  const duelo = (arena || [])[0];
  const cx = ARENA_SALAO.cx * 16 - camera.x;
  const topo = (ARENA_SALAO.cy - 15.2) * 16 - camera.y; // em cima do camarote imperial
  // a luz dos holofotes no chão da arena
  if (duelo) {
    LADOS_DA_ARENA.forEach((l, i) => brilhoRedondo(ctx, Math.round(l.x - camera.x), Math.round(l.y - camera.y - 2), 22, i ? "255, 120, 120" : "120, 200, 255", 0.08 + Math.sin(t * 3 + i) * 0.03));
  }
  const largura = 210;
  const x = Math.round(cx - largura / 2);
  const y = Math.round(topo + Math.sin(t * 1.4) * 1.5);
  retangulo(ctx, x - 1, y - 1, largura + 2, 30, "#05030a");
  retangulo(ctx, x, y, largura, 28, "#1b1533");
  retangulo(ctx, x, y, largura, 1, "#f5c451");
  retangulo(ctx, x, y + 27, largura, 1, "#f5c451");
  if (!duelo) {
    letreiroNoMundo(ctx, "⚔ ARENA DE DUELOS ⚔", cx, y + 12, { tamanho: 8, cor: "#ffd166" });
    const campeao = SALAO?.estado?.campeao;
    letreiroNoMundo(ctx, campeao ? `👑 Campeão da Semana: ${campeao.nome}` : "Fala com o Mestre da Arena para desafiar alguém", cx, y + 22, { tamanho: 6, cor: campeao ? "#fff3b0" : undefined });
    return;
  }
  const rodada = duelo.total ? `Rodada ${duelo.rodada}/${duelo.total}` : `Rodada ${duelo.rodada}`;
  letreiroNoMundo(ctx, `${duelo.nomeModo} · ${rodada}`, cx, y + 8, { tamanho: 6, cor: "#cfc6e8" });
  letreiroNoMundo(ctx, String(duelo.a.nome).slice(0, 18), x + 6, y + 18, { tamanho: 7, alinhar: "left", cor: "#9fd8ff" });
  letreiroNoMundo(ctx, String(duelo.b.nome).slice(0, 18), x + largura - 6, y + 18, { tamanho: 7, alinhar: "right", cor: "#ffb0b0" });
  if (duelo.a.vidas !== null && duelo.a.vidas !== undefined) {
    [duelo.a, duelo.b].forEach((lado, i) => {
      for (let k = 0; k < 3; k++) {
        const hx = i ? x + largura - 12 - k * 6 : x + 6 + k * 6;
        retangulo(ctx, hx, y + 21, 4, 3, k < lado.vidas ? "#ff4d6d" : "#3a2a4a");
      }
    });
  }
  letreiroNoMundo(ctx, `${duelo.a.pontos} × ${duelo.b.pontos}`, cx, y + 20, { tamanho: 9, cor: "#fff3b0" });
}

// ---------- os dragões do castelo ----------
// (Agora: dois dragões PEQUENOS que só voam, SO_VOANDO; o texto abaixo descreve o modo com pouso.)
// Dois dragões enormes vivem no Salão. Passam quase o tempo todo pousados (40 a 80 s em cada lugar): nas
// torres do coliseu, no alto da fachada e também no chão (a praça, o jardim, o ninho do mirante e a areia
// do coliseu quando não tem duelo). Parados, respiram, piscam, olham em volta, balançam a cauda, esticam as
// asas, às vezes cochilam e rugem soltando fogo. De vez em quando levantam voo, cruzam o céu do castelo (com a
// sombra correndo no chão) e pousam em outro lugar: chegam desacelerando, empinam o corpo, abrem as asas e
// batem devagar, descem as patas, levantam poeira ao tocar o chão e dobram as asas. São só enfeite (não fazem
// perguntas), e cada navegador tem os seus. O desenho é feito numa tela pequena em alta resolução, com
// contorno escuro, e ampliado sem suavizar: continua pixel art mesmo enorme.
const PALETAS_DRAGAO = [
  { corpo: "#b8322a", asaTras: "#6e1a16", barriga: "#f5c451", chifre: "#f4ecd8", membrana: "#ff8a6a", contorno: "#2a0806", fogo: ["#fff3b0", "#ffd166", "#ff7a1a", "#e63946"] },
  { corpo: "#3b1f66", asaTras: "#1b0f33", barriga: "#a98bff", chifre: "#e6dcf5", membrana: "#d07bff", contorno: "#0a0414", fogo: ["#ffffff", "#f0d6ff", "#d07bff", "#7a3fd1"] },
];
const PIXELS_DO_DRAGAO = 4; // pixels da tela pequena por unidade do desenho original
const ORIGEM_DRAGAO = { x: 48 * PIXELS_DO_DRAGAO, y: 44 * PIXELS_DO_DRAGAO };
const TELA_DRAGAO = { w: 126 * PIXELS_DO_DRAGAO, h: 60 * PIXELS_DO_DRAGAO };
const DRAGOES_DO_SALAO = [];
// os dragões só voam (o código do pouso fica, caso um dia voltem a pousar)
const SO_VOANDO = true;
let relogioDosDragoes = null;
let heroiPerto = null;
const suaveDragao = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const misturarDragao = (a, b, k) => a + (b - a) * k;

function poleirosDoSalao() {
  const { cx, cy } = ARENA_SALAO;
  const naMuralha = (graus) => ({ x: (cx + Math.cos((graus * Math.PI) / 180) * 11.3) * 16, y: (cy + Math.sin((graus * Math.PI) / 180) * 11.3) * 16, altura: 24 });
  return [
    { ...naMuralha(225), nome: "torre" }, { ...naMuralha(315), nome: "torre" },
    { x: 14 * 16, y: 3 * 16 + 12, altura: 34, nome: "fachada" },
    { x: 75.5 * 16, y: 9.6 * 16, altura: 0, nome: "ninho" },
    { x: 66 * 16, y: 51 * 16, altura: 0, nome: "jardim" },
    { x: 30 * 16, y: 44 * 16, altura: 0, nome: "praça" },
    { x: 12 * 16, y: 51 * 16, altura: 0, nome: "jardim-oeste" },
    // (dentro do coliseu eles não pousam: a areia é dos duelistas)
  ];
}
const arenaOcupada = (estado) => Boolean(estado?.arena?.length);

function pontoNoCeu(estado) {
  // com duelo na arena, de vez em quando o dragão passa rasante por cima dela
  if (arenaOcupada(estado) && Math.random() < 0.4) return { x: ARENA_SALAO.cx * 16 + (Math.random() - 0.5) * 120, y: ARENA_SALAO.cy * 16, cruzeiro: 75, rasante: true };
  // (só voando, eles passam mais baixo, como os dragões das Montanhas no Reino)
  return { x: 100 + Math.random() * (SALAO_MAPA.colunas * 16 - 200), y: 100 + Math.random() * (SALAO_MAPA.linhas * 16 - 200), cruzeiro: SO_VOANDO ? 34 + Math.random() * 26 : 140 + Math.random() * 60 };
}

function poleiroLivre(estado, ocupados) {
  const livres = poleirosDoSalao().filter((p) => !ocupados.some((o) => o && o.nome === p.nome && o.x === p.x) && !(p.nome === "arena" && arenaOcupada(estado)));
  // o chão é o preferido (é onde dá para chegar perto deles)
  const noChao = livres.filter((p) => p.altura === 0);
  const lista = noChao.length && Math.random() < 0.7 ? noChao : livres;
  return lista[Math.floor(Math.random() * lista.length)] || null;
}

function iniciarDragoes() {
  if (DRAGOES_DO_SALAO.length) return;
  const ocupados = [];
  // (decisão do Erickson: só dois dragões pequenos, sempre voando pelo céu do castelo, sem pousar)
  PALETAS_DRAGAO.forEach((paleta, i) => {
    const alvo = pontoNoCeu(null);
    const inicio = pontoNoCeu(null);
    DRAGOES_DO_SALAO.push({
      paleta, escala: [0.8, 0.9][i], x: inicio.x, y: inicio.y, alt: inicio.cruzeiro, dir: alvo.x > inicio.x ? 1 : -1,
      estado: "voando", desde: 0, ate: 0, poleiro: null, alvo, voltas: 0,
      asas: Math.random() * 10, inclina: 0, somEm: 0, fogoAte: 0, rugirEm: 15 + Math.random() * 20,
      piscarEm: 2, olhar: 0, olharAlvo: 0, esticarEm: 10 + Math.random() * 10, dormindo: false, poeira: [], tela: null,
    });
  });
}

function somDoDragao(d, efeito, t, intervalo, volume = 1) {
  if (typeof Som === "undefined" || !heroiPerto || t - d.somEm < intervalo) return;
  const distancia = Math.hypot(heroiPerto.x - d.x, heroiPerto.y - d.y);
  if (distancia > 420) return;
  d.somEm = t;
  Som.efeito(efeito, Math.max(0.1, (1 - distancia / 420) * volume));
}

// a nuvem de poeira quando o dragão toca o chão (ou bate as asas para subir)
function levantarPoeira(d, quantas, forca) {
  if (d.poleiro && d.poleiro.altura > 0) return;
  for (let i = 0; i < quantas; i++) {
    const a = (i / quantas) * Math.PI * 2 + Math.random() * 0.3;
    const v = forca * (0.6 + Math.random() * 0.6);
    d.poeira.push({ x: d.x + Math.cos(a) * 10 * d.escala, y: d.y + Math.sin(a) * 3 * d.escala, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.35 - 4, vida: 0.9 + Math.random() * 0.6, total: 1.5, tam: 2 + Math.random() * 3 });
  }
}

function moverDragoes(t, estado) {
  const dt = relogioDosDragoes === null ? 0 : Math.min(0.05, Math.max(0, t - relogioDosDragoes));
  relogioDosDragoes = t;
  const ocupados = DRAGOES_DO_SALAO.map((d) => d.poleiro);
  DRAGOES_DO_SALAO.forEach((d) => {
    d.poeira = d.poeira.filter((p) => (p.vida -= dt) > 0);
    d.poeira.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 2.2;
      p.vy *= 1 - dt * 2.2;
    });
    const rumo = (alvo, velocidade) => {
      const dx = alvo.x - d.x;
      const dy = alvo.y - d.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.5) {
        const passo = Math.min(dist, velocidade * dt);
        d.x += (dx / dist) * passo;
        d.y += (dy / dist) * passo;
        if (Math.abs(dx) > 6) d.dir = dx > 0 ? 1 : -1;
        d.inclina += ((dy / dist) * 0.15 - d.inclina) * Math.min(1, dt * 2.5);
      }
      return dist;
    };
    const mudar = (estadoNovo) => {
      d.estado = estadoNovo;
      d.desde = t;
    };
    // a Pergunta do Dragão chamou este dragão: ele passa voando baixo por cima da praça (não pousa mais)
    if (d.chamado && SO_VOANDO) {
      d.alvo = { x: d.chamado.x, y: d.chamado.y, cruzeiro: 90, rasante: true };
      d.chamado = null;
    }
    if (d.chamado) {
      if (d.estado === "pousado" || d.estado === "assentando") {
        d.alvo = { x: d.chamado.x, y: d.chamado.y, cruzeiro: 110 };
        d.dir = d.alvo.x > d.x ? 1 : -1;
        d.dormindo = false;
        mudar("preparando");
      } else if (d.estado === "voando" || d.estado === "decolando") {
        d.alvo = { x: d.chamado.x, y: d.chamado.y, cruzeiro: 110 };
      } else if (d.estado === "chegando") {
        d.poleiro = d.chamado;
        d.chamado = null;
      }
    }
    if (d.estado === "pousado") {
      // a vida de quem está parado: respirar, piscar, olhar em volta, esticar as asas, cochilar, rugir
      if (t > d.piscarEm) d.piscarEm = t + 2 + Math.random() * 4;
      if (Math.random() < dt * 0.25) d.olharAlvo = Math.random() < 0.5 ? 0 : (Math.random() - 0.5) * 2;
      d.olhar += (d.olharAlvo - d.olhar) * Math.min(1, dt * 2);
      if (!d.dormindo && t - d.desde > 25 && Math.random() < dt * 0.02) d.dormindo = true;
      if (d.dormindo && Math.random() < dt * 0.04) d.dormindo = false;
      if (!d.dormindo && t > d.esticarEm) d.esticarEm = t + 14 + Math.random() * 14;
      if (!d.dormindo && t > d.rugirEm) {
        d.fogoAte = t + 1.6;
        d.rugirEm = t + 22 + Math.random() * 20;
        somDoDragao(d, "rugido", t, 0, 0.8);
      }
      // hora de ir (ou a arena começou um duelo e ele estava na areia)
      if (t > d.ate || (d.poleiro?.nome === "arena" && arenaOcupada(estado))) {
        d.dormindo = false;
        d.alvo = pontoNoCeu(estado);
        d.dir = d.alvo.x > d.x ? 1 : -1;
        mudar("preparando");
      }
    } else if (d.estado === "preparando") {
      // agacha e abre as asas antes de pular
      if (t - d.desde > 0.8) {
        levantarPoeira(d, 18, 55);
        somDoDragao(d, "asas", t, 0, 1);
        d.poleiro = null;
        mudar("decolando");
      }
    } else if (d.estado === "decolando") {
      d.asas += dt * 1.6;
      rumo(d.alvo, 30 + (t - d.desde) * 30);
      d.alt += dt * misturarDragao(90, 55, Math.min(1, (t - d.desde) / 2));
      if (Math.random() < dt * 4 && d.alt < 40) levantarPoeira(d, 4, 30);
      somDoDragao(d, "asas", t, 0.9);
      if (d.alt >= (d.alvo.cruzeiro ?? 160) - 10) {
        d.voltas = 0;
        mudar("voando");
      }
    } else if (d.estado === "voando") {
      d.asas += dt * 0.9;
      const dist = rumo(d.alvo, 90);
      d.alt += ((d.alvo.cruzeiro ?? 160) + Math.sin(t * 0.8 + d.escala) * 10 - d.alt) * Math.min(1, dt * 0.8);
      if (d.alvo.rasante && dist < 160 && Math.random() < dt * 2) d.fogoAte = t + 1.3;
      somDoDragao(d, "asas", t, 3.5, 0.7);
      if (dist < 30 && SO_VOANDO) {
        d.alvo = pontoNoCeu(estado);
      } else if (dist < 30) {
        d.voltas += 1;
        const poleiro = d.chamado || (d.voltas >= 2 || Math.random() < 0.8 ? poleiroLivre(estado, ocupados) : null);
        d.chamado = null;
        if (poleiro) {
          d.poleiro = poleiro;
          ocupados.push(poleiro);
          mudar("chegando");
        } else d.alvo = pontoNoCeu(estado);
      }
    } else if (d.estado === "chegando") {
      // vai até o poleiro descendo aos poucos; perto, entra no pouso
      d.asas += dt * 1;
      const dist = rumo(d.poleiro, 85);
      d.alt += (d.poleiro.altura + Math.min(150, 40 + dist * 0.5) - d.alt) * Math.min(1, dt * 1.5);
      somDoDragao(d, "asas", t, 2.5, 0.8);
      if (dist < 90) {
        d.pousoDe = { x: d.x, y: d.y, alt: d.alt };
        d.dir = d.poleiro.x > d.x ? 1 : -1;
        mudar("pousando");
      }
    } else if (d.estado === "pousando") {
      // o pouso: desacelera em curva suave, o corpo empina, as asas batem largo e devagar
      const k = Math.min(1, (t - d.desde) / 2.2);
      const e = 1 - (1 - k) ** 3;
      d.x = misturarDragao(d.pousoDe.x, d.poleiro.x, e);
      d.y = misturarDragao(d.pousoDe.y, d.poleiro.y, e);
      d.alt = misturarDragao(d.pousoDe.alt, d.poleiro.altura, suaveDragao(k));
      d.asas += dt * misturarDragao(1, 0.45, k);
      somDoDragao(d, "asas", t, 0.75, 1);
      if (k >= 1) {
        levantarPoeira(d, 26, 70);
        somDoDragao(d, "impacto", t, 0, 0.7);
        Object.assign(d, { alt: d.poleiro.altura, x: d.poleiro.x, y: d.poleiro.y, inclina: 0 });
        mudar("assentando");
      }
    } else if (d.estado === "assentando") {
      // dobra as asas devagar e se ajeita
      if (t - d.desde > 1) {
        Object.assign(d, { ate: t + 40 + Math.random() * 40, rugirEm: t + 4 + Math.random() * 6, esticarEm: t + 12 + Math.random() * 10 });
        // pousou olhando para o meio do castelo
        d.dir = d.x < SALAO_MAPA.colunas * 8 ? 1 : -1;
        mudar("pousado");
      }
    }
  });
}

// O dragão no chão (ou numa torre), de lado e olhando para a direita, com as patas no ponto (0, 10).
// pose: { abertura (0 asas dobradas, 1 abertas), bater (fase das asas abertas), agachar (0 a 1),
// empinar (o corpo levanta o peito, no pouso), patas (0 recolhidas, 1 esticadas para baixo, no ar),
// rugindo, dormindo, piscando, olhar (-1 a 1: a cabeça vira) e esticar (as asas abrem um pouco parado) }
function desenharDragaoParado(c, t, p, poseDada) {
  // o que a pose não disser fica no padrão (um campo faltando virava NaN e sumia com a cabeça)
  const pose = { abertura: 0, bater: 0, agachar: 0, empinar: 0, patas: 0, olhar: 0, esticar: 0, ...poseDada };
  const claro = tom(p.corpo, 1.28);
  const escuro = tom(p.corpo, 0.72);
  const resp = Math.sin(t * (pose.dormindo ? 1.1 : 2.2));
  const desce = pose.agachar * 2.5;
  const cab = (pose.rugindo ? -4 : pose.dormindo ? 5 : Math.sin(t * 0.7) * 1.2) + desce;
  const olhar = pose.olhar || 0;
  c.lineCap = "round";
  c.lineJoin = "round";
  const poligono = (cor, pontos) => {
    c.fillStyle = cor;
    c.beginPath();
    pontos.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fill();
  };
  const elipse = (cor, x, y, rx, ry, rot = 0) => {
    c.fillStyle = cor;
    c.beginPath();
    c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    c.fill();
  };
  c.save();
  // voando, o corpo inclina para a frente (o pescoço vai na frente, a cauda esticada atrás)
  if (pose.voo) {
    c.translate(0, -2);
    c.rotate(0.16);
  }
  // no pouso o corpo empina (gira em volta das patas de trás)
  if (pose.empinar) {
    c.translate(-5, 8);
    c.rotate(-pose.empinar * 0.45);
    c.translate(5, -8);
  }
  c.translate(0, desce + (pose.patas || 0) * 3);
  // as asas: dobradas, abertas (no pouso e na decolagem) ou esticando um pouco parado
  const abertura = Math.max(pose.abertura || 0, pose.esticar || 0);
  const b = Math.sin(pose.bater || 0);
  const asa = (cor, dx, atras) => {
    const dobrada = [[0, -6], [-5, -14], [-11, -19.5], [-15, -12], [-17.5, -4], [-4, 2]];
    const sobe = (1 - b) * 0.5; // 0 = no alto, 1 = embaixo
    const aberta = [[0, -6], [-3, misturarDragao(-34, -12, sobe)], [-20, misturarDragao(-42, -4, sobe)], [-38, misturarDragao(-26, 6, sobe)], [-30, misturarDragao(-6, 8, sobe)], [-4, 2]];
    const pontos = dobrada.map(([x, y], i) => [misturarDragao(x, aberta[i][0], abertura) + dx, misturarDragao(y, aberta[i][1], abertura) - (atras ? 0 : resp * 0.6 * (1 - abertura))]);
    poligono(cor, pontos);
    if (!atras) {
      // os ossos da asa e a membrana
      c.strokeStyle = p.membrana;
      c.lineWidth = 0.7;
      c.beginPath();
      [2, 3, 4].forEach((i) => {
        c.moveTo(pontos[1][0], pontos[1][1]);
        c.lineTo(misturarDragao(pontos[i][0], pontos[5][0], 0.15), misturarDragao(pontos[i][1], pontos[5][1], 0.15));
      });
      c.stroke();
      c.strokeStyle = claro;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(pontos[0][0], pontos[0][1]);
      c.lineTo(pontos[1][0], pontos[1][1]);
      c.lineTo(pontos[2][0], pontos[2][1]);
      c.stroke();
    }
  };
  // a cauda: sai para trás e se enrola no chão, à frente das patas (parado), ou fica solta para trás (no
  // ar); a pontinha balança devagar
  c.strokeStyle = p.corpo;
  let ax = -8;
  let ay = 6;
  let angulo = Math.PI - 0.15;
  const noAr = pose.patas || 0;
  for (let i = 1; i <= 10; i++) {
    angulo += misturarDragao(i < 3 ? 0.08 : 0.34, 0.03, noAr) + Math.sin(t * 1.1 - i * 0.6) * 0.03 * i * 0.3;
    const passo = 3.1 - i * 0.12;
    const nx = ax + Math.cos(angulo) * passo;
    const ny = ay + Math.sin(angulo) * passo * 0.55;
    c.lineWidth = Math.max(1.1, 5.2 - i * 0.45);
    c.beginPath();
    c.moveTo(ax, ay);
    c.lineTo(nx, ny);
    c.stroke();
    ax = nx;
    ay = ny;
  }
  // a ponta em folha, virada para onde a cauda vai
  const px = Math.cos(angulo);
  const py = Math.sin(angulo) * 0.55;
  poligono(escuro, [[ax + px * 4, ay + py * 4], [ax - py * 2.4, ay + px * 2.4], [ax - px * 1.2, ay - py * 1.2], [ax + py * 2.4, ay - px * 2.4]]);
  asa(p.asaTras, 4, true);
  // As pernas saem de dentro do corpo: as do lado de lá (mais escuras) vão antes, atrás do corpo; as do lado
  // de cá vão depois, com o ombro e a coxa por cima. Cada pata termina em dedos com garras claras.
  // perna(x do ombro, y do ombro, comprimento, inclinação, cor, grossura)
  const perna = (x, y, comprimento, inclinar, cor, grossura) => {
    const pe = [x + inclinar, y + comprimento];
    poligono(cor, [[x - grossura / 2, y], [x + grossura / 2, y], [pe[0] + grossura * 0.35, pe[1]], [pe[0] - grossura * 0.45, pe[1]]]);
    elipse(cor, pe[0] + 0.6, pe[1], grossura * 0.75, 0.9);
    c.fillStyle = p.chifre;
    [-0.6, 0.8, 2.1].forEach((dx) => c.fillRect(pe[0] + dx, pe[1] + 0.5, 0.7, 0.8));
  };
  const corpoY = -1 - resp * 0.3;
  if (!pose.voo) {
    perna(10, 1, 7.6 + noAr * 3, 0.6, escuro, 2.4); // a da frente, do lado de lá
    perna(-8, 5, 4.4 + noAr * 2, -1, escuro, 2.6); // a de trás, do lado de lá
  }
  elipse(p.corpo, 1, corpoY, 10.5, 6.8, -0.45);
  elipse(claro, -1, -4.5 - resp * 0.3, 7, 2.2, -0.45);
  // a barriga clara fica DENTRO do contorno do corpo (antes ela escapava como um remendo no peito), com as
  // placas de escama atravessadas
  c.save();
  c.beginPath();
  c.ellipse(1, corpoY, 10.5, 6.8, -0.45, 0, Math.PI * 2);
  c.clip();
  elipse(tom(p.barriga, 0.92), 6.5, 2.5 + corpoY, 4.6, 7.5, -0.5);
  elipse(p.barriga, 6.8, 2 + corpoY, 3.4, 6.2, -0.5);
  c.strokeStyle = tom(p.barriga, 0.72);
  c.lineWidth = 0.55;
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    c.moveTo(3.5 + i * 0.75, -5 + i * 2 + corpoY);
    c.lineTo(8.8 + i * 0.75, -6.6 + i * 2 + corpoY);
    c.stroke();
  }
  c.restore();
  // a coxa de trás (grande, por cima do corpo) e as pernas do lado de cá
  if (pose.voo) {
    // voando: as patas recolhidas junto da barriga
    elipse(p.corpo, -5, 3.5, 5.5, 4);
    c.fillStyle = p.corpo;
    c.fillRect(-10, 5.5, 6, 2.2);
    c.fillRect(5, 3, 4.5, 2.2);
    c.fillStyle = p.chifre;
    c.fillRect(-11, 6.1, 1, 1);
    c.fillRect(9.5, 3.6, 1, 1);
  } else {
    elipse(p.corpo, -5, 4, 6.2, 5.2);
    elipse(claro, -6, 1.5, 3.4, 1.3, -0.2);
    perna(-3.5, 7, 2.8 + noAr * 2, -2.8, p.corpo, 3.2); // a pata de trás, saindo da coxa
    perna(7.5, 0, 8.6 + noAr * 3, 0.4, p.corpo, 2.8); // a da frente, saindo do peito
    elipse(claro, 7.3, 1.2, 1.2, 1.8, -0.2); // o ombro iluminado
  }
  // o pescoço e a cabeça (que vira um pouco para olhar em volta)
  const hx = 12 + olhar * 1.5;
  c.strokeStyle = p.corpo;
  c.lineWidth = 4.2;
  c.beginPath();
  c.moveTo(5, -5);
  c.quadraticCurveTo(9, -12 + desce * 0.5, hx, -16 + cab);
  c.stroke();
  c.strokeStyle = claro;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(5.5, -7.5);
  c.quadraticCurveTo(8.5, -13 + desce * 0.5, hx - 0.5, -18 + cab);
  c.stroke();
  const ox = hx - 12;
  const focinho = 1 - Math.abs(olhar) * 0.25; // virando a cabeça, o focinho parece mais curto
  poligono(p.corpo, [[9.5 + ox, -19 + cab], [16 + ox, -20.5 + cab], [16 + ox + 6.5 * focinho, -17.5 + cab], [16 + ox + 5.5 * focinho, -15.5 + cab], [14 + ox, -14.5 + cab], [10 + ox, -16 + cab]]);
  poligono(claro, [[10.5 + ox, -19 + cab], [16 + ox, -20.3 + cab], [16 + ox + 4 * focinho, -19 + cab], [12 + ox, -18.2 + cab]]);
  if (pose.rugindo) {
    poligono("#5c1010", [[14 + ox, -14.5 + cab], [22 + ox, -15 + cab], [21 + ox, -11 + cab], [14 + ox, -12.5 + cab]]);
    poligono(p.corpo, [[14 + ox, -12.8 + cab], [21.5 + ox, -11.2 + cab], [20.5 + ox, -10 + cab], [14 + ox, -11.5 + cab]]);
    c.fillStyle = "#ffffff";
    c.fillRect(16 + ox, -14.6 + cab, 0.8, 1);
    c.fillRect(19 + ox, -14.4 + cab, 0.8, 1);
  }
  c.strokeStyle = p.chifre;
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(12 + ox, -19 + cab);
  c.lineTo(7 + ox, -23.5 + cab);
  c.moveTo(14.5 + ox, -19.8 + cab);
  c.lineTo(11 + ox, -25 + cab);
  c.stroke();
  // o olho: aceso, fechado (piscando ou dormindo)
  if (pose.dormindo || pose.piscando) {
    c.fillStyle = escuro;
    c.fillRect(16.5 + ox, -18 + cab, 2, 0.7);
  } else {
    c.fillStyle = "rgba(255, 209, 102, 0.35)";
    c.fillRect(16 + ox, -19.5 + cab, 3, 3);
    c.fillStyle = "#ffd166";
    c.fillRect(17 + ox, -18.5 + cab, 1, 1);
  }
  // os espinhos das costas
  [[-7, -4], [-3, -6.5], [1, -8.5], [5, -10]].forEach(([x, y]) => poligono(p.asaTras, [[x, y], [x + 1.4, y - 2.8], [x + 2.8, y]]));
  asa(p.corpo, 0, false);
  // o fogo sai da boca aberta (na mesma inclinação do corpo)
  if (pose.rugindo) fogoDoDragao(c, t, p, 22 + ox, -12.5 + cab, pose.voo ? 0.35 : 0.12);
  c.restore();
}

// A Pergunta do Dragão: um dos dragões vem pousar perto da fonte da praça (o que estiver voando vai direto;
// se todos estiverem pousados, o primeiro decola e vem)
function chamarDragaoParaAPraca() {
  iniciarDragoes();
  const praca = { x: 40 * 16, y: 37 * 16, altura: 0, nome: "praça-da-fonte" };
  if (DRAGOES_DO_SALAO.some((d) => d.poleiro?.nome === praca.nome && d.estado === "pousado")) return;
  const escolhido = DRAGOES_DO_SALAO.find((d) => d.estado === "voando") || DRAGOES_DO_SALAO[0];
  escolhido.chamado = praca;
}

// as labaredas saindo da boca (no desenho do dragão: a boca fica em bx, by)
function fogoDoDragao(c, t, p, bx, by, inclinar) {
  for (let i = 0; i < 18; i++) {
    const k = (t * 12 + i * 0.57) % 10;
    c.globalAlpha = Math.max(0, 1 - k / 10.5);
    c.fillStyle = p.fogo[Math.min(3, Math.floor(k / 2.5))];
    const tam = 1.5 + k * 0.5;
    c.fillRect(bx + k * 3, by + k * inclinar + Math.sin(t * 22 + i) * (0.4 + k * 0.35) - tam / 2, tam, tam);
  }
  c.globalAlpha = 1;
}

// a pose de agora, conforme o momento do dragão
function poseDoDragao(d, t) {
  const pose = { abertura: 0, bater: 0, agachar: 0, empinar: 0, patas: 0, rugindo: t < d.fogoAte, dormindo: d.dormindo, piscando: t > d.piscarEm - 0.15, olhar: d.olhar, esticar: 0 };
  const passou = t - d.desde;
  if (d.estado === "pousado" && t > d.esticarEm - 1.6) pose.esticar = Math.sin(((t - (d.esticarEm - 1.6)) / 1.6) * Math.PI) * 0.55;
  if (d.estado === "preparando") {
    const k = Math.min(1, passou / 0.8);
    Object.assign(pose, { agachar: suaveDragao(k), abertura: suaveDragao(k), bater: Math.PI / 2 });
  }
  if (d.estado === "pousando") {
    const k = Math.min(1, passou / 2.2);
    Object.assign(pose, { abertura: 1, bater: d.asas * 5.5, empinar: suaveDragao(Math.min(1, k * 1.6)) * (1 - suaveDragao((k - 0.85) / 0.15)), patas: 1 - suaveDragao((k - 0.7) / 0.3) });
  }
  if (d.estado === "assentando") {
    const k = Math.min(1, passou / 1);
    Object.assign(pose, { abertura: 1 - suaveDragao(k), bater: Math.PI / 2, agachar: Math.sin(k * Math.PI) * 0.6 });
  }
  return pose;
}

// ---------- o acabamento do dragão: o mesmo nível de detalhe do herói ----------
// O dragão é desenhado com formas (elipses, curvas), que saem lisas e borradas nas beiradas. Depois de
// desenhado, cada quadro vira pixel art de verdade, como o herói: as beiradas ficam firmes, cada pixel volta
// para uma cor da paleta (sem as misturas do borrado), o corpo ganha escamas, a barriga as placas, os chifres e
// garras o brilho de osso polido, as asas a membrana fina, e por fim o volume (luz de cima à esquerda, o mesmo
// iluminarVolume do herói) e o contorno colorido ("auto"). Os quadros de voo ficam guardados (12 batidas de
// asa); parado ou cuspindo fogo, o desenho é refeito no máximo 12 vezes por segundo.
const FASES_DO_VOO = 12;
const RITMO_DO_DRAGAO_PARADO = 1 / 12;
const cacheVooDragao = new Map();

function telaDoDragao() {
  // tela grande, mas lida de volta a cada quadro: fica na memória do processador
  const canvas = document.createElement("canvas");
  canvas.width = TELA_DRAGAO.w;
  canvas.height = TELA_DRAGAO.h;
  return { canvas, ctx: canvas.getContext("2d", { willReadFrequently: true }) };
}

// as cores que o desenho do dragão usa, cada uma com o material dela
function paletaDoAcabamento(p) {
  if (p.acabamento) return p.acabamento;
  const corpo = [p.corpo, tom(p.corpo, 1.28), tom(p.corpo, 0.72)];
  const lista = [
    ...corpo.map((c) => [c, "escama"]),
    [p.barriga, "placa"], [tom(p.barriga, 0.92), "placa"], [tom(p.barriga, 0.72), "placa"],
    [p.chifre, "osso"], [p.membrana, "membrana"], [p.asaTras, "membrana"],
    ["#5c1010", "boca"], ["#ffffff", "osso"], ["#ffd166", "olho"],
    ...p.fogo.map((c) => [c, "fogo"]),
  ];
  p.acabamento = { cores: lista.map(([c, m]) => [...hexParaRgb(c), m]), memo: new Map() };
  return p.acabamento;
}

function acabamentoDoDragao(canvas, ctx, p) {
  const { cores, memo } = paletaDoAcabamento(p);
  const w = canvas.width;
  const h = canvas.height;
  const imagem = ctx.getImageData(0, 0, w, h);
  const px = imagem.data;
  const material = new Uint8Array(w * h); // 0 vazio; 1 escama, 2 placa, 3 osso, 4 membrana, 5 outro
  const CODIGO = { escama: 1, placa: 2, osso: 3, membrana: 4, boca: 5, olho: 5, fogo: 6 };
  // 1. beiradas firmes e cada pixel na cor mais próxima da paleta
  for (let i = 0, k = 0; i < px.length; i += 4, k++) {
    const a = px[i + 3];
    if (a < 110) {
      px[i + 3] = 0;
      continue;
    }
    px[i + 3] = 255;
    const chave = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
    let achada = memo.get(chave);
    if (achada === undefined) {
      let melhor = 0;
      let menor = Infinity;
      cores.forEach(([r, g, b], j) => {
        const d = (r - px[i]) ** 2 + (g - px[i + 1]) ** 2 + (b - px[i + 2]) ** 2;
        if (d < menor) {
          menor = d;
          melhor = j;
        }
      });
      achada = melhor;
      if (memo.size < 4096) memo.set(chave, achada);
    }
    const [r, g, b, m] = cores[achada];
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    material[k] = CODIGO[m];
  }
  // 2. a textura de cada material (em pixels de 1 unidade do desenho = PIXELS_DO_DRAGAO)
  const U = PIXELS_DO_DRAGAO;
  const de = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : material[y * w + x]);
  const mexer = (i, fator, soma = 0) => {
    px[i] = Math.max(0, Math.min(255, px[i] * fator + soma));
    px[i + 1] = Math.max(0, Math.min(255, px[i + 1] * fator + soma));
    px[i + 2] = Math.max(0, Math.min(255, px[i + 2] * fator + soma * 0.6));
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const m = material[y * w + x];
      if (!m) continue;
      const i = (y * w + x) * 4;
      if (m === 1) {
        // escamas: fileiras desencontradas de meias-luas (a borda de baixo escura, um brilho em cima)
        const S = Math.round(U * 1.5);
        const fileira = Math.floor(y / S);
        const sx = (x + (fileira % 2) * U) % (U * 2);
        const sy = y % S;
        // a meia-lua: o fundo escuro no meio e subindo nas pontas; o brilho no alto da escama
        if (sy === S - 1 && sx > 1 && sx < U * 2 - 2) mexer(i, 0.72);
        else if (sy === S - 2 && (sx === 1 || sx === U * 2 - 2)) mexer(i, 0.78);
        else if (sy === S - 3 && (sx === 0 || sx === U * 2 - 1)) mexer(i, 0.86);
        else if (sy === 1 && sx > U * 0.6 && sx < U * 1.4) mexer(i, 1.1, 20);
      } else if (m === 2) {
        // as placas da barriga: uma linha escura a cada unidade e meia, com a beirada de cima clara
        const sy = y % Math.round(U * 1.5);
        if (sy === 0) mexer(i, 0.8);
        else if (sy === 1) mexer(i, 1.06, 14);
      } else if (m === 3) {
        // chifres, garras e dentes: osso polido (brilho na quina de cima, sombra embaixo)
        if (de(x, y - 1) !== 3) mexer(i, 1.05, 40);
        else if (de(x, y + 1) !== 3) mexer(i, 0.72);
      } else if (m === 4) {
        // a membrana da asa: fina e meio translúcida, com nervuras em diagonal e a beirada de cima escura
        if (de(x, y - 1) !== 4) mexer(i, 0.8);
        else if ((x - y * 2) % (U * 4) === 0) mexer(i, 0.82);
        else if ((x + y) % (U * 3) < U) mexer(i, 1.05, 10);
      }
    }
  }
  ctx.putImageData(imagem, 0, 0);
  // 3. o volume (o mesmo do herói, de lado) e o contorno colorido
  iluminarVolume(canvas, "lado");
  return contornar(canvas, "auto");
}

function desenharQuadroDoDragao(tela, p, t, pose) {
  const { canvas, ctx: c } = tela;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.setTransform(PIXELS_DO_DRAGAO, 0, 0, PIXELS_DO_DRAGAO, ORIGEM_DRAGAO.x, ORIGEM_DRAGAO.y);
  desenharDragaoParado(c, t, p, pose);
  c.setTransform(1, 0, 0, 1, 0, 0);
  return acabamentoDoDragao(canvas, c, p);
}

function quadroDoDragao(d, t) {
  const voando = d.estado === "voando" || d.estado === "decolando" || d.estado === "chegando";
  const rugindo = t < d.fogoAte;
  // voando sem fogo: uma das 12 batidas de asa já prontas (o corpo é o mesmo em todas)
  if (voando && !rugindo) {
    const volta = Math.PI * 2;
    const fase = Math.round((((d.asas * 5.5) % volta + volta) % volta) / volta * FASES_DO_VOO) % FASES_DO_VOO;
    const chave = `${d.paleta.corpo}:${fase}`;
    if (!cacheVooDragao.has(chave)) {
      cacheVooDragao.set(chave, desenharQuadroDoDragao(telaDoDragao(), d.paleta, fase * 0.3, { voo: true, abertura: 1, bater: (fase / FASES_DO_VOO) * volta, patas: 1, olhar: 0 }));
    }
    return cacheVooDragao.get(chave);
  }
  if (!d.tela) d.tela = telaDoDragao();
  // parado (ou cuspindo fogo): refeito no máximo 12 vezes por segundo (a pose muda devagar)
  if (d.quadroEm !== undefined && t - d.quadroEm < RITMO_DO_DRAGAO_PARADO && t >= d.quadroEm && !d.mudouDeEstado) return d.tela.canvas;
  d.quadroEm = t;
  const pose = voando ? { voo: true, abertura: 1, bater: d.asas * 5.5, patas: 1, rugindo, olhar: 0 } : poseDoDragao(d, t);
  return desenharQuadroDoDragao(d.tela, d.paleta, t, pose);
}

// chamado no chão (antes de todo mundo): move os dragões e desenha as sombras e a poeira
function sombrasDosDragoes(ctx, camera, t, estado) {
  iniciarDragoes();
  moverDragoes(t, estado);
  DRAGOES_DO_SALAO.forEach((d) => {
    const k = Math.max(0.35, 1 - (d.alt - (d.poleiro?.altura || 0)) / 320);
    const rx = SO_VOANDO ? 9 : 18 * d.escala * k * (d.estado === "pousado" || d.estado === "assentando" ? 0.8 : 1.3);
    ctx.fillStyle = `rgba(10, 4, 24, ${(0.14 + 0.2 * k).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(Math.round(d.x - camera.x), Math.round(d.y - camera.y), rx, rx * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    d.poeira.forEach((p) => {
      ctx.globalAlpha = Math.max(0, (p.vida / p.total) * 0.75);
      ctx.fillStyle = "#e8dcc0";
      ctx.fillRect(Math.round(p.x - camera.x), Math.round(p.y - camera.y), p.tam, p.tam);
    });
    ctx.globalAlpha = 1;
  });
}

function desenharDragoesDoSalao(ctx, camera, w, h, t, heroi) {
  heroiPerto = heroi;
  // os mais ao fundo (mais acima no mapa) primeiro; quem está fora da tela não é desenhado
  [...DRAGOES_DO_SALAO].sort((a, b) => a.y - b.y).forEach((d) => {
    const sx = d.x - camera.x;
    const sy = d.y - d.alt - camera.y;
    if (sx < -60 * d.escala || sy < -30 * d.escala || sx > w + 60 * d.escala || sy > h + 40 * d.escala) return;
    // os dois do Salão são os dragões das Montanhas do Reino (o vermelho e o de gelo): o mesmo desenho, os
    // mesmos 6 quadros de asa e o mesmo tamanho (pixels do desenho na resolução dos personagens do Reino)
    if (SO_VOANDO && typeof quadrosDragao === "function") {
      const quadros = (d.quadrosReino ||= d.paleta === PALETAS_DRAGAO[0]
        ? quadrosDragao("#c0392b", { escala: 0.8 })
        : quadrosDragao("#4fa8ff", { escala: 0.8, barriga: "#e8f6ff" }));
      const q = quadros[Math.floor(t * 9 + d.escala * 7) % quadros.length];
      const res = typeof RESOLUCAO_REINO !== "undefined" ? RESOLUCAO_REINO : 2;
      ctx.save();
      ctx.translate(Math.round(sx), Math.round(sy));
      ctx.scale(1 / res, 1 / res);
      if (d.dir < 0) ctx.scale(-1, 1);
      ctx.rotate(d.inclina * 0.6);
      ctx.drawImage(q, -Math.round(q.width / 2), -q.height + 1);
      ctx.restore();
      return;
    }
    const tela = quadroDoDragao(d, t);
    const k = d.escala / PIXELS_DO_DRAGAO;
    ctx.save();
    ctx.translate(Math.round(sx), Math.round(sy - 10 * d.escala));
    if (d.dir < 0) ctx.scale(-1, 1);
    if (d.estado === "voando" || d.estado === "chegando" || d.estado === "decolando") ctx.rotate(d.inclina);
    const x = -ORIGEM_DRAGAO.x * k;
    const y = -ORIGEM_DRAGAO.y * k;
    const W = tela.width * k;
    const H = tela.height * k;
    // (o contorno já vem no desenho, colorido, como o do herói)
    ctx.drawImage(tela, x, y, W, H);
    ctx.restore();
    // dormindo, sobem os "z" da cabeça (desenhados por cima, sem espelhar o texto)
    if (d.dormindo && d.estado === "pousado") {
      for (let i = 0; i < 3; i++) {
        const q = (t * 0.35 + i / 3) % 1;
        ctx.globalAlpha = Math.sin(q * Math.PI);
        letreiroNoMundo(ctx, i === 2 ? "Z" : "z", Math.round(sx + d.dir * (16 + q * 10) * d.escala), Math.round(sy - (17 + q * 14) * d.escala), { tamanho: 7 + q * 5, cor: "#cfe0ff" });
      }
      ctx.globalAlpha = 1;
    }
  });
}

// ---------- o chão do Coliseu, redondo ----------
// O chão do castelo é pintado por tiles (e depois ganha o mármore e o tapete das salas, cenario_hd.js). No
// coliseu isso deixava os anéis serrilhados, então ele é pintado de novo por cima do chão já em alta
// resolução, ponto a ponto (1 unidade do mundo), pela distância ao centro: a areia com o brasão, o parapeito
// com friso dourado, os degraus com almofadas e corredores de escada, a muralha com as ameias, o túnel dos
// duelistas e os portões. Uma vez só (o chão pronto fica guardado).
function pintarColiseuHD(chao) {
  if (!chao?.getContext || chao.coliseuPintado) return;
  chao.coliseuPintado = true;
  const res = chao.res || 2;
  const { cx, cy, raio, parapeito, arquibancada, muralha } = ARENA_SALAO;
  const x0 = Math.max(0, Math.floor((cx - muralha - 0.5) * 16 * res));
  const y0 = Math.max(0, Math.floor((cy - muralha - 0.5) * 16 * res));
  const w = Math.min(chao.width - x0, Math.ceil((muralha * 2 + 1) * 16 * res));
  const h = Math.min(chao.height - y0, Math.ceil((muralha * 2 + 1) * 16 * res));
  const ctx = chao.getContext("2d");
  const imagem = ctx.getImageData(x0, y0, w, h);
  const px = imagem.data;
  const rgb = new Map();
  const corRgb = (hex) => {
    if (!rgb.has(hex)) rgb.set(hex, hexParaRgb(hex));
    return rgb.get(hex);
  };
  const DEGRAUS = ["#6f6a86", "#7d7894", "#8b86a2", "#9994ae"];
  const ALMOFADAS = ["#2e5cb8", "#b8862a", "#2a9d5c", "#6c48c9"];
  const corDoPonto = (u, v) => {
    // u, v: o ponto do mundo (unidades); dx, dy, d em tiles a partir do meio da arena
    const dx = (u + 0.5) / 16 - cx;
    const dy = (v + 0.5) / 16 - cy;
    const d = Math.hypot(dx, dy);
    if (d >= muralha) return null;
    const sorte = sorteDoTile(u, v, 5);
    const tunel = dx < 0 && Math.abs(dy) < 1.5;
    if (d < raio || (tunel && d < muralha)) {
      // a areia; mais escura colada no parapeito e nas paredes do túnel
      if (tunel && d >= raio && Math.abs(dy) > 1.3) return "#3e3956";
      if (Math.abs(d - 3.2) < 0.07) return "#c49d62";
      if (d < 0.75 && (Math.abs(dx - dy) < 0.07 || Math.abs(dx + dy) < 0.07)) return "#a8803f";
      if (!tunel && d > raio - 0.22) return "#b8955f";
      return sorte < 0.06 ? "#c49d62" : sorte > 0.95 ? "#ecd3a2" : sorte > 0.5 ? "#d9b77c" : "#d4b276";
    }
    if (d < parapeito) {
      const f = (d - raio) / (parapeito - raio);
      return f < 0.25 ? "#5d5e6b" : f < 0.45 ? "#c9cbe0" : f < 0.6 ? "#f5c451" : "#8a8b99";
    }
    if (d < arquibancada) {
      if (d > arquibancada - 0.14) return "#2b2548"; // a sombra da muralha nos degraus de cima
      const anel = Math.floor((d - parapeito) / 1.05);
      const frac = ((d - parapeito) % 1.05) / 1.05;
      const angulo = Math.atan2(dy, dx);
      const corredor = Math.abs(((angulo + Math.PI) % (Math.PI / 4)) - Math.PI / 8) > Math.PI / 8 - 0.07;
      if (corredor) return frac < 0.2 ? "#6d6886" : Math.floor(frac * 4) % 2 ? "#b3aec9" : "#9e99b5";
      if (frac < 0.18) return "#3e3956";
      if (frac < 0.28) return "#57526e";
      const setor = Math.floor(((angulo + Math.PI) / (Math.PI * 2)) * 72);
      if (frac > 0.4 && frac < 0.9 && sorteDoTile(setor, anel, 3) < 0.22) return ALMOFADAS[(setor + anel) % ALMOFADAS.length];
      return sorte < 0.04 ? "#a9a4bf" : DEGRAUS[Math.min(3, anel)];
    }
    // a muralha, com os portões do sul e do leste
    const portao = (Math.abs(dx) < 1.5 && dy > 2) || (dx > 2 && Math.abs(dy) < 1.5);
    if (portao) {
      const borda = Math.abs(dx) < 1.5 && dy > 2 ? Math.abs(dx) : Math.abs(dy);
      if (borda > 1.3) return "#2b2548";
      return (Math.floor(u / 8) + Math.floor(v / 8)) % 2 ? "#6d6886" : "#79749a";
    }
    const f = (d - arquibancada) / (muralha - arquibancada);
    const ang = Math.atan2(dy, dx);
    if (f < 0.12) return "#2b2548";
    if (f > 0.74) return Math.floor(ang * 46) % 2 ? "#8a83b8" : "#2b2548";
    const bloco = (Math.floor(ang * 16) + Math.floor(f * 3)) % 2;
    return sorte > 0.93 ? "#6a6196" : bloco ? "#5d5488" : "#544b7c";
  };
  for (let y = 0; y < h; y++) {
    const v = Math.floor((y0 + y) / res);
    for (let x = 0; x < w; x++) {
      const cor = corDoPonto(Math.floor((x0 + x) / res), v);
      if (!cor) continue;
      const [r, g, b] = corRgb(cor);
      const i = (y * w + x) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = 255;
    }
  }
  ctx.putImageData(imagem, x0, y0);
}

// ---------- o Distrito das Casas ----------
// os brasões das três Casas, em pixel (13 x 13): a lua partida com a estrela (Ordem da Lua Partida), a fênix
// de asas abertas com a cauda de fogo (Legião da Fênix Rubra) e a cabeça do lobo de olhos dourados (Clã do
// Lobo de Jade). X é a cor clara da Casa, G o dourado, W o branco e D o escuro.
const BRASAO_LADO = 13;
const BRASOES = {
  runa: [
    "....XXXXX....", "..XXXXX......", ".XXXX......G.", ".XXX......GWG", "XXX........G.", "XX.X.........", "X.XX.........",
    ".XXX.....G...", "XXX.....GWG..", "XXX......G...", ".XXX.........", "..XXXXX......", "....XXXXX....",
  ],
  aco: [
    "......G......", ".....GXG.....", "X....XWX....X", "XX...XXX...XX", "XXX..XXX..XXX", ".XXX.XXX.XXX.", "..XXXXXXXXX..",
    "...XXXXXXX...", "....XXXXX....", ".....XXX.....", "....G.X.G....", "...G..X..G...", "..G...G...G..",
  ],
  flecha: [
    "X...........X", "XD.........DX", "XDX.......XDX", "XXXXXXXXXXXXX", "XXXXXXXXXXXXX", "XXDGXXXXXGDXX", ".XXXXXXXXXXX.",
    ".XXXXXXXXXXX.", "..XXXXXXXXX..", "...XXXXXXX...", "....XXDXX....", ".....XXX.....", "......X......",
  ],
};
const CORES_FIXAS_DO_BRASAO = { G: "#f5c451", W: "#ffffff", D: "#1b1533" };

function brasaoNoCanvas(ctx, casaId, x, y, escala, cor) {
  BRASOES[casaId].forEach((linha, ly) => [...linha].forEach((ch, lx) => {
    if (ch !== ".") retangulo(ctx, x + lx * escala, y + ly * escala, escala, escala, ch === "X" ? cor : CORES_FIXAS_DO_BRASAO[ch]);
  }));
}

// o estandarte grande de uma Casa (no fundo do salão dela e em volta da Praça das Bandeiras)
const estandarteDaCasa = (casaId, grande = true) => spriteSalao(`estandarte-${casaId}-${grande}`, () => {
  const c = CASAS_DO_MAPA[casaId];
  const w = grande ? 30 : 16;
  const h = grande ? 54 : 34;
  return spriteDe(w + 4, h + 10, (ctx) => {
    retangulo(ctx, 0, 0, w + 4, 2, "#f5c451"); // a vara dourada
    retangulo(ctx, 2, 2, w, h, c.cor);
    retangulo(ctx, 2, 2, 2, h, c.escura);
    retangulo(ctx, w, 2, 2, h, c.escura);
    retangulo(ctx, 2, h - 2, w, 2, "#f5c451");
    // a ponta em "V" embaixo
    for (let i = 0; i < w / 2; i++) {
      retangulo(ctx, 2 + i, h + i * 0.5, 1, 6 - i * 0.5 > 0 ? 6 - i * 0.5 : 0, c.cor);
      retangulo(ctx, w + 1 - i, h + i * 0.5, 1, 6 - i * 0.5 > 0 ? 6 - i * 0.5 : 0, c.cor);
    }
    const escala = grande ? 2 : 1;
    brasaoNoCanvas(ctx, casaId, 2 + Math.round((w - BRASAO_LADO * escala) / 2), grande ? 12 : 8, escala, c.clara);
  });
});

const tacaDasCasas = () => spriteSalao("taca-das-casas", () => spriteDe(40, 58, (ctx) => {
  // o pedestal de três degraus e a taça dourada enorme com as três gemas
  retangulo(ctx, 0, 48, 40, 10, "#8a8b99");
  retangulo(ctx, 0, 48, 40, 2, "#c9cbe0");
  retangulo(ctx, 5, 40, 30, 8, "#a3a6c2");
  retangulo(ctx, 5, 40, 30, 1, "#e6e8f5");
  retangulo(ctx, 16, 30, 8, 10, "#c9952a");
  retangulo(ctx, 12, 36, 16, 4, "#f5c451");
  retangulo(ctx, 8, 6, 24, 24, "#f5c451");
  retangulo(ctx, 10, 28, 20, 3, "#c9952a");
  retangulo(ctx, 2, 9, 6, 12, "#f5c451");
  retangulo(ctx, 32, 9, 6, 12, "#f5c451");
  retangulo(ctx, 4, 11, 3, 8, "#1b1533");
  retangulo(ctx, 33, 11, 3, 8, "#1b1533");
  retangulo(ctx, 8, 4, 24, 3, "#fff3b0");
  retangulo(ctx, 11, 9, 3, 15, "#fff3b0");
  [[13, "#6c48c9"], [20, "#b8322a"], [27, "#2f8a3a"]].forEach(([x, cor]) => {
    retangulo(ctx, x - 2, 15, 4, 5, cor);
    retangulo(ctx, x - 1, 15, 1, 2, "#ffffff");
  });
}));

// o placar flutuante da Taça das Casas: os pontos da semana de cada casa, com barras
function desenharPlacarDasCasas(ctx, x0, y0, t, placar, casas) {
  const cx = x0 + 20;
  const topo = y0 - 30 + Math.sin(t * 1.3) * 1;
  const lista = Object.keys(CASAS_DO_MAPA).map((id) => ({ id, pontos: (placar || {})[id] || 0 }));
  const maximo = Math.max(1, ...lista.map((c) => c.pontos));
  const lider = lista.reduce((a, b) => (b.pontos > a.pontos ? b : a), lista[0]);
  retangulo(ctx, cx - 46, topo - 1, 92, 30, "#05030a");
  retangulo(ctx, cx - 45, topo, 90, 28, "#1b1533");
  retangulo(ctx, cx - 45, topo, 90, 1, "#f5c451");
  letreiroNoMundo(ctx, "TAÇA DAS CASAS · SEMANA", cx, topo + 7, { tamanho: 6, cor: "#ffd166" });
  lista.forEach((c, i) => {
    const y = topo + 10 + i * 6;
    const cor = CASAS_DO_MAPA[c.id].cor;
    brasaoNoCanvas(ctx, c.id, cx - 42, y - 1, 0.4, CASAS_DO_MAPA[c.id].clara);
    retangulo(ctx, cx - 36, y, 60, 3, "#0b0918");
    retangulo(ctx, cx - 36, y, Math.max(1, Math.round((c.pontos / maximo) * 60)), 3, cor);
    letreiroNoMundo(ctx, String(c.pontos), cx + 40, y + 4, { tamanho: 5, cor: c === lider && c.pontos ? "#fff3b0" : "#cfc6e8", alinhar: "right" });
  });
  if (lider.pontos) brilhoRedondo(ctx, x0 + 20, y0 + 18, 30, hexParaRgb(CASAS_DO_MAPA[lider.id].cor).join(", "), 0.06 + Math.sin(t * 2) * 0.02);
}

const altarDaFenda = () => spriteSalao("altar-fenda", () => spriteDe(30, 30, (ctx) => {
  retangulo(ctx, 2, 18, 26, 12, "#2b2548");
  retangulo(ctx, 2, 18, 26, 2, "#4a4170");
  retangulo(ctx, 6, 14, 18, 4, "#3a3360");
  retangulo(ctx, 11, 2, 8, 12, "#7a3fd1");
  retangulo(ctx, 13, 0, 4, 2, "#d07bff");
  retangulo(ctx, 12, 4, 2, 8, "#d07bff");
  desenharTexto(ctx, ["P.P", ".P.", "P.P"], { P: "#a98bff" }, 13, 22);
}));

const obeliscoDaFenda = () => spriteSalao("obelisco", () => spriteDe(12, 40, (ctx) => {
  retangulo(ctx, 0, 34, 12, 6, "#2b2548");
  retangulo(ctx, 2, 6, 8, 28, "#3a3360");
  retangulo(ctx, 3, 2, 6, 4, "#3a3360");
  retangulo(ctx, 5, 0, 2, 2, "#4a4170");
  retangulo(ctx, 8, 6, 2, 28, "#2b2548");
}));

const cristalDoOraculo = () => spriteSalao("cristal-dia", () => spriteDe(22, 36, (ctx) => {
  retangulo(ctx, 1, 28, 20, 8, "#8a8b99");
  retangulo(ctx, 1, 28, 20, 2, "#c9cbe0");
  retangulo(ctx, 7, 6, 8, 20, "#6ef0ff");
  retangulo(ctx, 9, 2, 4, 4, "#6ef0ff");
  retangulo(ctx, 5, 12, 2, 10, "#3fb6d6");
  retangulo(ctx, 15, 12, 2, 10, "#3fb6d6");
  retangulo(ctx, 9, 8, 2, 14, "#d8faff");
}));

const ARAUTOS = {
  runa: { kit: "mago", corpo: "feminino", pele: "#f1c9a5", cabelo: "longo", corCabelo: "#e8e4dc", chapeu: "pontudo", manto: "#6c48c9", detalhe: "#b9a2ff", item: "cajado", magia: "#b9a2ff", familiar: "nenhum" },
  aco: { kit: "guerreiro", corpo: "masculino", pele: "#c98d63", cabelo: "curto", corCabelo: "#2b1d14", chapeu: "elmoFerro", manto: "#b8322a", item: "espadaEscudo", familiar: "nenhum", acessorio: "barba" },
  flecha: { kit: "arqueiro", corpo: "feminino", pele: "#8d5a3b", cabelo: "longo", corCabelo: "#1b1205", chapeu: "cacador", manto: "#2f8a3a", item: "arco", familiar: "nenhum" },
};

// ---------- a Fenda no céu ----------
// Enquanto a Fenda junta heróis, um vórtice roxo gira no céu em cima do círculo, soltando raios; na batalha, o
// fragmento do Oráculo (o chefão) aparece enorme, flutuando, com a barra de vida e os escudos do grupo.
function desenharFendaNoMundo(ctx, camera, w, h, t, fenda) {
  const cx = CIRCULO_DA_FENDA.cx * 16 - camera.x;
  const chao = CIRCULO_DA_FENDA.cy * 16 - camera.y;
  if (cx < -200 || cx > w + 200 || chao < -260 || chao > h + 200) return;
  const ceu = chao - 92;
  const forca = fenda ? 1 : 0.25;
  // o vórtice: anéis de pontos girando em sentidos opostos
  for (let anel = 0; anel < 4; anel++) {
    const raio = 10 + anel * 9;
    const giro = t * (anel % 2 ? -1.2 : 1.5) * (fenda ? 1.6 : 0.6);
    for (let k = 0; k < 14 + anel * 4; k++) {
      const a = giro + (k / (14 + anel * 4)) * Math.PI * 2;
      ctx.globalAlpha = forca * (0.9 - anel * 0.17);
      retangulo(ctx, Math.round(cx + Math.cos(a) * raio), Math.round(ceu + Math.sin(a) * raio * 0.45), 2, 2, k % 3 ? "#7a3fd1" : "#d07bff");
    }
  }
  ctx.globalAlpha = 1;
  brilhoRedondo(ctx, cx, ceu, 44, "122, 63, 209", 0.08 * forca + 0.03);
  if (!fenda) return;
  // o raio de luz do vórtice até o chão do círculo
  ctx.globalAlpha = 0.18 + Math.sin(t * 6) * 0.05;
  retangulo(ctx, Math.round(cx - 3), Math.round(ceu), 6, Math.round(chao - ceu), "#d07bff");
  ctx.globalAlpha = 1;
  if (Math.sin(t * 2.3) > 0.85) {
    // um relâmpago em zigue-zague
    let x = cx;
    for (let y = ceu; y < chao - 20; y += 6) {
      const nx = x + (Math.random() - 0.5) * 10;
      retangulo(ctx, Math.round(Math.min(x, nx)), Math.round(y), Math.max(1, Math.round(Math.abs(nx - x))), 6, "#fff3ff");
      x = nx;
    }
  }
  if (fenda.estado === "reunindo") {
    letreiroNoMundo(ctx, `A FENDA CHAMA: ${fenda.membros.length}/${fenda.maximo}`, cx, ceu - 34, { tamanho: 8, cor: "#e2b6ff" });
    letreiroNoMundo(ctx, `começa em ${fenda.resta}s (ou com 4 heróis)`, cx, ceu - 25, { tamanho: 6 });
    return;
  }
  if (fenda.estado !== "batalha" || !fenda.tipo) return;
  // o chefão: o desenho do monstro, ampliado, flutuando no meio do círculo
  const tipo = typeof TIPOS_MONSTRO !== "undefined" && TIPOS_MONSTRO[fenda.tipo];
  const sprite = tipo ? spriteReino(`monstro-${fenda.tipo}`, tipo.sprite) : null;
  const flutua = Math.sin(t * 1.6) * 4;
  if (sprite) {
    const k = 0.9;
    const sw = sprite.width * k;
    const sh = sprite.height * k;
    brilhoRedondo(ctx, cx, chao - sh / 2 - 10 + flutua, sw * 0.7, fenda.furia ? "255, 60, 60" : "208, 123, 255", 0.12 + Math.sin(t * 4) * 0.04);
    ctx.drawImage(sprite, Math.round(cx - sw / 2), Math.round(chao - sh - 8 + flutua), Math.round(sw), Math.round(sh));
  }
  // a vida e os escudos
  const largura = 90;
  const topo = chao - (sprite ? sprite.height * 0.9 : 60) - 30;
  retangulo(ctx, cx - largura / 2 - 1, topo - 1, largura + 2, 8, "#05030a");
  retangulo(ctx, cx - largura / 2, topo, largura, 6, "#3a0a14");
  retangulo(ctx, cx - largura / 2, topo, Math.round((fenda.vida / Math.max(1, fenda.vidaMaxima)) * largura), 6, fenda.furia ? "#ff4d4d" : "#d07bff");
  letreiroNoMundo(ctx, `${fenda.nome}${fenda.furia ? " · FÚRIA" : ""}`, cx, topo - 3, { tamanho: 7, cor: fenda.furia ? "#ffb0b0" : "#f0d6ff" });
  for (let i = 0; i < fenda.escudos; i++) retangulo(ctx, Math.round(cx - fenda.escudos * 4 + i * 8), topo + 9, 6, 6, "#6ec8ff");
}

// ---------- o pódio da Sala de Troféus ----------
// Os três primeiros do ranking da arena (30 dias) ficam de pé no pódio, com o visual de cada um, o nome e o
// título; o 1º no meio, mais alto, com uma luz dourada. Lugar sem campeão ainda mostra a taça.
const PODIO_SALAO = [{ tx: 60, ty: 13 }, { tx: 57, ty: 13 }, { tx: 63, ty: 13 }];
const CORES_DO_PODIO = [
  { faixa: "#f5c451", brilho: "255, 209, 102", taca: "#f5c451", altura: 20 },
  { faixa: "#d8dde8", brilho: "216, 221, 232", taca: "#d8dde8", altura: 14 },
  { faixa: "#d08a4a", brilho: "208, 138, 74", taca: "#d08a4a", altura: 10 },
];

const pedestalDoPodio = (i) => spriteSalao(`podio-${i}`, () => {
  const { faixa, altura } = CORES_DO_PODIO[i];
  return spriteDe(22, altura + 4, (ctx) => {
    retangulo(ctx, 0, 4, 22, altura, "#8a8b99");
    retangulo(ctx, 0, 4, 22, 2, "#c9cbe0");
    retangulo(ctx, 0, 0, 22, 4, "#a3a6c2");
    retangulo(ctx, 0, 0, 22, 1, "#e6e8f5");
    retangulo(ctx, 18, 4, 4, altura, "#6b6c7a");
    retangulo(ctx, 0, 7, 22, 2, faixa);
    // o número da posição gravado na pedra
    const numeros = [["..Y..", ".YY..", "..Y..", "..Y..", ".YYY."], [".YY..", "Y..Y.", "..Y..", ".Y...", "YYYY."], ["YYY..", "...Y.", ".YY..", "...Y.", "YYY.."]];
    desenharTexto(ctx, numeros[i], { Y: faixa }, 8, Math.max(10, altura - 3));
  });
});

const tacaDoPodio = (cor) => spriteSalao(`taca-${cor}`, () => spriteDe(12, 14, (ctx) => {
  retangulo(ctx, 2, 0, 8, 6, cor);
  retangulo(ctx, 0, 1, 2, 3, cor);
  retangulo(ctx, 10, 1, 2, 3, cor);
  retangulo(ctx, 5, 6, 2, 4, cor);
  retangulo(ctx, 3, 10, 6, 2, cor);
  retangulo(ctx, 3, 1, 1, 4, "#ffffff");
}));

const RARIDADE_DO_SELO = ["#cfc6e8", "#cfc6e8", "#7dff9a", "#6ec8ff", "#d07bff", "#ffd166"];

function desenharCampeaoNoPodio(ctx, x0, y0, t, i, campeao) {
  const { brilho, taca } = CORES_DO_PODIO[i];
  const cx = x0 + 11;
  const topo = y0 + 2; // onde se pisa, em cima do pedestal
  if (!campeao?.avatar) {
    const s = tacaDoPodio(taca);
    ctx.drawImage(s, Math.round(cx - s.width / 2), topo - s.height + 1);
    if (Math.sin(t * 2.2 + i * 1.9) > 0.9) retangulo(ctx, cx - 2 + i, topo - 10, 1, 1, "#ffffff");
    return;
  }
  // a luz do campeão (mais forte no 1º) e brilhos subindo
  brilhoRedondo(ctx, cx, topo - 12, i ? 16 : 24, brilho, (i ? 0.07 : 0.12) + Math.sin(t * 2 + i) * 0.03);
  if (i === 0) {
    for (let k = 0; k < 5; k++) {
      const q = (t * 0.5 + k / 5) % 1;
      ctx.globalAlpha = Math.sin(q * Math.PI);
      retangulo(ctx, Math.round(cx + Math.sin(k * 2.4 + t) * 9), Math.round(topo - 4 - q * 30), 1, 1, k % 2 ? "#fff3b0" : "#ffd166");
    }
    ctx.globalAlpha = 1;
  }
  // o herói de pé no pedestal (desenhado na escala da gente do mapa: 2 pixels do desenho por unidade)
  const sprite = heroiParado(campeao.avatar);
  const respira = Math.floor(t * 1.4 + i) % 2;
  ctx.drawImage(sprite, cx - 8, topo - PE_HEROI / 2 - respira * 0.5, sprite.width / 2, sprite.height / 2);
  // o nome e o título em cima da cabeça
  const c = campeao.classe || {};
  const cabeca = topo - PE_HEROI / 2 + 4;
  letreiroNoMundo(ctx, `${c.icone || "🌱"} ${c.titulo || "Viajante"}`, cx, cabeca - 2, { tamanho: 5, cor: RARIDADE_DO_SELO[c.degrau] || "#cfc6e8" });
  letreiroNoMundo(ctx, String(campeao.nome).slice(0, 16), cx, cabeca - 8, { tamanho: 7, cor: i ? "#f5e6b8" : "#fff3b0" });
  letreiroNoMundo(ctx, `${["👑", "🥈", "🥉"][i]} ${campeao.vitorias}`, cx, cabeca - 15, { tamanho: 6, cor: "#ffd166" });
}

// ---------- os enfeites do Coliseu ----------

const braseiro = () => spriteSalao("braseiro", () => spriteDe(14, 18, (ctx) => {
  retangulo(ctx, 5, 8, 4, 10, "#3a3360");
  retangulo(ctx, 3, 16, 8, 2, "#2b2540");
  retangulo(ctx, 0, 4, 14, 5, "#8a5c32");
  retangulo(ctx, 1, 8, 12, 1, "#5c3418");
  retangulo(ctx, 0, 4, 14, 1, "#c08a52");
}));
// o fogo alto do braseiro, com brasas subindo
function animarBraseiro(ctx, x, y, t, fase) {
  const cores = ["#fff3b0", "#ffd166", "#ff7a1a", "#e63946"];
  for (let i = 0; i < 7; i++) {
    const k = (t * 1.6 + i / 7 + fase) % 1;
    const altura = 4 + k * 12;
    ctx.globalAlpha = 1 - k;
    retangulo(ctx, Math.round(x + 7 + Math.sin(t * 7 + i * 2 + fase) * (2 - k)), Math.round(y + 4 - altura), 2, 2, cores[Math.min(3, Math.floor(k * 4))]);
  }
  ctx.globalAlpha = 1;
  retangulo(ctx, x + 3, y + 1, 8, 3, Math.sin(t * 13 + fase) > 0 ? "#ff7a1a" : "#ffd166");
  retangulo(ctx, x + 5, y - 2 - Math.round(Math.abs(Math.sin(t * 9 + fase)) * 2), 4, 3, "#ffd166");
  brilhoRedondo(ctx, x + 7, y, 26, "255, 150, 60", 0.07 + Math.sin(t * 6 + fase) * 0.015);
}

const camaroteImperial = () => spriteSalao("camarote", () => spriteDe(80, 52, (ctx) => {
  // a base de pedra com arcos, o piso do camarote, os tronos e o toldo listrado
  retangulo(ctx, 4, 26, 72, 26, "#5d5488");
  for (let i = 0; i < 4; i++) {
    retangulo(ctx, 10 + i * 17, 34, 10, 18, "#1b1533");
    retangulo(ctx, 11 + i * 17, 32, 8, 2, "#1b1533");
  }
  retangulo(ctx, 0, 22, 80, 5, "#a3a6c2");
  retangulo(ctx, 0, 22, 80, 1, "#f5c451");
  [[24, "#a8323e"], [40, "#f5c451"], [56, "#a8323e"]].forEach(([x, cor], i) => {
    retangulo(ctx, x - 5, i === 1 ? 6 : 10, 10, i === 1 ? 16 : 12, cor);
    retangulo(ctx, x - 4, i === 1 ? 8 : 12, 8, 3, "#3a1f0c");
  });
  for (let x = 2; x < 78; x += 8) {
    retangulo(ctx, x, 0, 4, 6, "#8e1c3c");
    retangulo(ctx, x + 4, 0, 4, 6, "#f3ead2");
  }
  retangulo(ctx, 2, 6, 76, 1, "#b8862a");
  retangulo(ctx, 2, 0, 2, 22, "#b8862a");
  retangulo(ctx, 76, 0, 2, 22, "#b8862a");
}));

const mastroComEstandarte = (cor) => spriteSalao(`mastro-${cor}`, () => spriteDe(12, 52, (ctx) => {
  retangulo(ctx, 1, 0, 2, 52, "#8a8b99");
  retangulo(ctx, 0, 0, 4, 2, "#f5c451");
  retangulo(ctx, 3, 3, 9, 22, cor);
  retangulo(ctx, 3, 25, 4, 3, cor);
  retangulo(ctx, 8, 25, 4, 2, cor);
  desenharTexto(ctx, ["Y.Y", ".Y.", "Y.Y"], { Y: "#f5c451" }, 6, 10);
}));

const ovosDoNinho = () => spriteSalao("ovos", () => spriteDe(30, 16, (ctx) => {
  [[5, "#b8322a"], [14, "#4fa8ff"], [23, "#a98bff"]].forEach(([x, cor]) => {
    retangulo(ctx, x - 3, 4, 7, 10, cor);
    retangulo(ctx, x - 2, 2, 5, 2, cor);
    retangulo(ctx, x - 2, 5, 2, 3, "#ffffff");
    retangulo(ctx, x - 3, 12, 7, 2, "#3a1f0c");
  });
}));

const MESTRE_DA_ARENA = {
  nome: "Mestre da Arena Draven",
  visual: { kit: "guerreiro", item: "espadaEscudo", chapeu: "elmoFerro", manto: "#8a1010", corpo: "masculino", cabelo: "curto", corCabelo: "#2b1d14", pele: "#c98d63", familiar: "nenhum", acessorio: "barba" },
};
const GUARDA_DO_PORTAO = {
  nome: "Guarda do Portão",
  visual: { kit: "guerreiro", item: "espadaEscudo", chapeu: "elmoFerro", manto: "#2e5cb8", corpo: "feminino", cabelo: "longo", corCabelo: "#e2b04a", pele: "#f1c9a5", familiar: "nenhum" },
};

function cenarioSalao(estado) {
  if (!chaoDoSalao) chaoDoSalao = pintarChaoDoSalao();
  const T = 16;
  const props = [];
  const bloquear = (tx, ty, w = 1, h = 1) => {
    const lista = [];
    for (let x = tx; x < tx + w; x++) for (let y = ty; y < ty + h; y++) lista.push(`${x},${y}`);
    return lista;
  };
  const prop = (tx, ty, sprite, extra = {}) => props.push({ x: tx * T + 8, y: (ty + 1) * T, sprite, tilesBloqueados: bloquear(tx, ty), ...extra });
  // a praça: a fonte, os bancos em volta, as árvores nos vasos e os lampiões
  props.push({ x: 36 * T, y: 32 * T, sprite: fonte(), tilesBloqueados: bloquear(34, 29, 4, 3), animar: animarFonte });
  [[25, 22], [44, 22], [25, 41], [44, 41], [29, 36], [41, 36]].forEach(([tx, ty]) => props.push({ x: tx * T + 16, y: (ty + 1) * T, sprite: banco(), tilesBloqueados: bloquear(tx, ty, 2) }));
  [[22, 18], [48, 18], [22, 46], [48, 46], [22, 31], [48, 31]].forEach(([tx, ty], i) => prop(tx, ty, arvoreDoSalao(i % 3), { vazado: true, balanco: true }));
  [[27, 26], [44, 26], [27, 39], [44, 39]].forEach(([tx, ty], i) => prop(tx, ty, posteDoSalao(), {
    animar: (ctx, x, y, t) => { brilhoRedondo(ctx, x + 5, y + 6, 18, "255, 210, 130", 0.06 + Math.sin(t * 2 + i) * 0.015); if (typeof animarPostePintado === "function") animarPostePintado(ctx, x, y, t, posteDoSalao(), i); },
  }));
  // o jardim do sul
  [[4, 49], [8, 51], [13, 49], [18, 52], [24, 50], [28, 52], [43, 52], [47, 49], [52, 51], [57, 49], [62, 52], [71, 52], [75, 49], [79, 51]].forEach(([tx, ty], i) => prop(tx, ty, arvoreDoSalao(i % 3), { vazado: true, balanco: true }));
  [[31, 52], [40, 52]].forEach(([tx, ty], i) => prop(tx, ty, estatuaDragao(), { animar: (ctx, x, y, t) => animarOlhosDragao(ctx, x, y, t, i * 2) }));
  // as tochas da fachada e dos corredores
  [[24, 3], [28, 3], [43, 3], [47, 3], [5, 3], [15, 3], [55, 3], [65, 3]].forEach(([tx, ty], i) => props.push({
    x: tx * T + 8, y: (ty + 1) * T - 4, sprite: tocha(), animar: (ctx, x, y, t) => animarChama(ctx, x, y - 2, t, i),
  }));
  // o Grande Salão: pilares e o púlpito do palanque
  [[23, 6], [27, 6], [44, 6], [48, 6], [23, 13], [48, 13]].forEach(([tx, ty]) => prop(tx, ty, pilar()));
  // a Sala de Estudos: estantes, mesas e plantas, com velas flutuando
  [[3, 4], [6, 4], [13, 4], [16, 4]].forEach(([tx, ty]) => props.push({ x: tx * T + 16, y: (ty + 1) * T, sprite: estante(), tilesBloqueados: bloquear(tx, ty, 2) }));
  [[5, 9], [12, 9], [5, 13], [12, 13]].forEach(([tx, ty]) => props.push({ x: tx * T + 16, y: (ty + 1) * T, sprite: mesaDeEstudo(), tilesBloqueados: bloquear(tx, ty, 2) }));
  [[2, 15], [19, 15], [19, 5]].forEach(([tx, ty]) => prop(tx, ty, planta()));
  const nada = spriteDe(2, 2, () => {}, null);
  [[6, 7], [14, 7], [9, 11], [57, 8], [64, 8], [60, 12]].forEach(([tx, ty], i) => props.push({
    x: tx * T, y: ty * T, sprite: nada, animar: (ctx, x, y, t) => animarVelaFlutuante(ctx, x, y, t, i * 1.3),
  }));
  // a Sala de Troféus: duas taças de enfeite nos cantos e o PÓDIO dos campeões da arena na frente do quadro
  [[53, 8], [66, 8]].forEach(([tx, ty], i) => prop(tx, ty, pedestalTrofeu(["#f5c451", "#a98bff"][i]), {
    animar: (ctx, x, y, t) => { if (Math.sin(t * 2 + i * 1.7) > 0.92) retangulo(ctx, x + 4 + i, y + 5, 1, 1, "#ffffff"); },
  }));
  PODIO_SALAO.forEach((lugar, i) => props.push({
    x: lugar.tx * T + 8, y: (lugar.ty + 1) * T, sprite: pedestalDoPodio(i), tilesBloqueados: bloquear(lugar.tx, lugar.ty),
    animar: (ctx, x, y, t) => desenharCampeaoNoPodio(ctx, x, y, t, i, estado.ranking?.[i]),
  }));
  [[52, 15], [68, 15]].forEach(([tx, ty]) => prop(tx, ty, planta()));
  // a Galeria do Quadro: bancos para ler e plantas
  [[5, 30], [12, 30], [5, 42], [12, 42]].forEach(([tx, ty]) => props.push({ x: tx * T + 16, y: (ty + 1) * T, sprite: banco(), tilesBloqueados: bloquear(tx, ty, 2) }));
  [[2, 19], [19, 19], [2, 46], [19, 46]].forEach(([tx, ty]) => prop(tx, ty, planta()));
  // o Coliseu: braseiros em cima da muralha, o camarote imperial no norte, estandartes nos portões
  const { cx, cy } = ARENA_SALAO;
  [30, 60, 120, 150, 210, 240, 300, 330].forEach((graus, i) => {
    const a = (graus * Math.PI) / 180;
    props.push({
      x: (cx + Math.cos(a) * 11.3) * T, y: (cy + Math.sin(a) * 11.3) * T + 4, sprite: braseiro(),
      animar: (ctx, x, y, t) => animarBraseiro(ctx, x, y, t, i * 0.37),
    });
  });
  props.push({
    x: cx * T, y: (cy - 10.4) * T, sprite: camaroteImperial(), tilesBloqueados: bloquear(Math.floor(cx) - 2, Math.floor(cy - 11.6), 5, 2),
    // o Campeão da Liga da semana passada de pé no trono do meio, com a luz dourada
    animar: (ctx, x, y, t) => {
      const c = estado.campeao;
      if (!c?.avatar) return;
      const heroiCampeao = heroiParado(c.avatar);
      brilhoRedondo(ctx, x + 41, y + 12, 18, "255, 209, 102", 0.12 + Math.sin(t * 2) * 0.04);
      ctx.drawImage(heroiCampeao, x + 33, y + 22 - PE_HEROI / 2, heroiCampeao.width / 2, heroiCampeao.height / 2);
      letreiroNoMundo(ctx, `👑 ${String(c.nome).slice(0, 16)}`, x + 41, y - 3, { tamanho: 7, cor: "#fff3b0" });
    },
  });
  [[cx - 2, cy + 12.6, "#8e1c3c"], [cx + 2, cy + 12.6, "#2e5cb8"], [cx + 12.6, cy - 2, "#8e1c3c"], [cx + 12.6, cy + 2, "#2e5cb8"],
    [cx - 12.6, cy - 2, "#b8862a"], [cx - 12.6, cy + 2, "#b8862a"]].forEach(([tx, ty, cor]) => {
    props.push({ x: tx * T, y: ty * T, sprite: mastroComEstandarte(cor), tilesBloqueados: bloquear(Math.floor(tx), Math.floor(ty) - 1) });
  });
  // o Mirante do Ninho: os ovos dos dragões brilhando no meio dos galhos
  props.push({
    x: 77 * T, y: 9.8 * T, sprite: ovosDoNinho(), tilesBloqueados: bloquear(76, 9, 2, 1),
    animar: (ctx, x, y, t) => brilhoRedondo(ctx, x + 15, y + 8, 22, "255, 180, 120", 0.05 + Math.sin(t * 1.5) * 0.03),
  });
  [[72, 5], [80, 5], [72, 15], [80, 15]].forEach(([tx, ty], i) => prop(tx, ty, arvoreDoSalao(i % 3), { vazado: true, balanco: true }));
  // (o dragãozinho da Academia que voava em volta da fonte saiu: no Salão ficam só os dois dragões pequenos)

  // ---- o Distrito das Casas ----
  // a Praça das Bandeiras: estandartes das três casas em volta, lampiões e bancos
  [[23, 60, "runa"], [23, 68, "runa"], [48, 60, "flecha"], [48, 68, "flecha"], [30, 59, "aco"], [41, 59, "aco"]].forEach(([tx, ty, casa]) => {
    props.push({ x: tx * T + 8, y: (ty + 1) * T, sprite: estandarteDaCasa(casa, false), tilesBloqueados: bloquear(tx, ty) });
  });
  [[27, 65], [44, 65]].forEach(([tx, ty], i) => prop(tx, ty, posteDoSalao(), {
    animar: (ctx, x, y, t) => { brilhoRedondo(ctx, x + 5, y + 6, 18, "255, 210, 130", 0.06 + Math.sin(t * 2 + i) * 0.015); if (typeof animarPostePintado === "function") animarPostePintado(ctx, x, y, t, posteDoSalao(), i); },
  }));
  [[25, 67], [45, 67]].forEach(([tx, ty]) => props.push({ x: tx * T + 16, y: (ty + 1) * T, sprite: banco(), tilesBloqueados: bloquear(tx, ty, 2) }));
  // o jardim do distrito
  [[5, 58], [9, 62], [15, 59], [60, 58], [64, 61], [6, 70], [67, 70], [24, 72], [46, 71], [5, 91], [20, 92], [33, 91], [44, 92], [58, 91], [67, 92]].forEach(([tx, ty], i) => prop(tx, ty, arvoreDoSalao(i % 3), { vazado: true, balanco: true }));
  // os salões das Casas: o estandarte grande no fundo, dois braseiros na cor da casa e bancos
  Object.entries(CASAS_DO_MAPA).forEach(([casa, c]) => {
    const meio = (c.porta[0] + c.porta[1]) / 2 + 0.5;
    props.push({ x: meio * T, y: (c.y1 - 1) * T, sprite: estandarteDaCasa(casa, true), tilesBloqueados: bloquear(Math.floor(meio) - 1, c.y1 - 2, 2, 1) });
    [c.x0 + 2, c.x1 - 2].forEach((tx, i) => props.push({
      x: tx * T + 8, y: (c.y1 - 1) * T, sprite: braseiro(), tilesBloqueados: bloquear(tx, c.y1 - 2),
      animar: (ctx, x, y, t) => {
        animarBraseiro(ctx, x, y, t, i + c.tipo);
        brilhoRedondo(ctx, x + 7, y - 2, 16, hexParaRgb(c.clara).join(", "), 0.08);
      },
    }));
    [[c.x0 + 3, c.y0 + 5], [c.x1 - 4, c.y0 + 5], [c.x0 + 3, c.y0 + 10], [c.x1 - 4, c.y0 + 10]].forEach(([tx, ty]) => {
      props.push({ x: tx * T + 16, y: (ty + 1) * T, sprite: banco(), tilesBloqueados: bloquear(tx, ty, 2) });
    });
  });
  // o Círculo da Fenda: quatro obeliscos com runas acesas em volta
  [45, 135, 225, 315].forEach((graus, i) => {
    const a = (graus * Math.PI) / 180;
    const tx = Math.floor(CIRCULO_DA_FENDA.cx + Math.cos(a) * (CIRCULO_DA_FENDA.raio + 1.2));
    const ty = Math.floor(CIRCULO_DA_FENDA.cy + Math.sin(a) * (CIRCULO_DA_FENDA.raio + 1.2));
    prop(tx, ty, obeliscoDaFenda(), {
      animar: (ctx, x, y, t) => {
        const forca = estado.fenda ? 1 : 0.4;
        for (let k = 0; k < 4; k++) retangulo(ctx, x + 5, y + 9 + k * 6, 2, 3, Math.sin(t * 3 + k + i) > 0 ? "#d07bff" : "#7a3fd1");
        brilhoRedondo(ctx, x + 6, y + 18, 14, "208, 123, 255", (0.05 + Math.sin(t * 2 + i) * 0.02) * forca * 2);
      },
    });
  });

  const lugares = [
    {
      id: "quadro", nome: "Quadro de Anotações", icone: "📌", acao: "Ler e escrever", sobrepoe: true, semRotulo: true,
      sprite: quadroDeAnotacoes(), px: 11 * T, py: 23 * T, tilesBloqueados: bloquear(4, 20, 14, 3),
      entrada: { x: 11 * T, y: 24 * T + 8 }, animar: (ctx, x, y, t) => desenharRecadosNoQuadro(ctx, x, y, t, estado.recados),
    },
    {
      id: "campeoes", nome: "Campeões da Arena", icone: "🏆", acao: "Ver o ranking", sobrepoe: true, semRotulo: true,
      sprite: muralDosCampeoes(), px: 60 * T + 8, py: 8 * T, tilesBloqueados: bloquear(57, 5, 8, 3),
      entrada: { x: 60 * T + 8, y: 9 * T + 8 }, animar: (ctx, x, y, t) => desenharCampeoes(ctx, x, y, t, estado.ranking),
    },
    {
      id: "palanque", nome: "Palanque", icone: "📣", acao: "Subir", sobrepoe: true,
      sprite: pulpito(), px: 36 * T, py: 9 * T + 2, tilesBloqueados: bloquear(35, 8, 2, 1),
      entrada: { x: 36 * T, y: 10 * T + 8 },
    },
    {
      id: "mestre", nome: MESTRE_DA_ARENA.nome, icone: "⚔️", acao: "Duelar", sobrepoe: true, destaque: true,
      visual: MESTRE_DA_ARENA.visual, sprite: heroiParado(MESTRE_DA_ARENA.visual), px: 52 * T + 8, py: 30 * T,
      tilesBloqueados: ["52,29"], entrada: { x: 52 * T + 8, y: 31 * T + 4 },
      cumprimentos: ["⚔️ Queres testar teu saber?", "A arena está aberta!", "Quem acerta mais rápido, vence."],
      balbucios: ["Ninguém cai na minha arena sem aprender algo.", "Três modos de duelo, aventureiro.", "Escolhe teu oponente!"],
    },
    {
      id: "saida", nome: "Sair do Salão", icone: "🚪", acao: "Voltar", sobrepoe: true,
      visual: GUARDA_DO_PORTAO.visual, sprite: heroiParado(GUARDA_DO_PORTAO.visual), px: 35 * T, py: 53 * T + 6,
      tilesBloqueados: ["35,53"], entrada: { x: 35 * T, y: 52 * T + 8 },
      cumprimentos: ["Bem-vindo ao Salão de Elyndor!", "Aqui não há monstros. Só gente boa."],
    },
  ];

  // os lugares do Distrito: a Taça das Casas, os Arautos de cada salão, o Altar da Fenda e o Oráculo do Dia
  lugares.push(
    {
      id: "taca", nome: "Taça das Casas", icone: "🏆", acao: "Ver o placar", sobrepoe: true, destaque: true,
      sprite: tacaDasCasas(), px: 35.5 * T + 8, py: 64 * T, tilesBloqueados: bloquear(34, 62, 4, 2),
      entrada: { x: 35.5 * T + 8, y: 65 * T + 4 }, animar: (ctx, x, y, t) => desenharPlacarDasCasas(ctx, x, y, t, estado.casas?.placar),
    },
    ...Object.entries(CASAS_DO_MAPA).map(([casa, c]) => ({
      id: `arauto-${casa}`, casa, nome: ({ runa: "Arauto da Lua Partida", aco: "Arauto da Fênix", flecha: "Arauto do Lobo" })[casa], icone: "🛡️", acao: "Falar", sobrepoe: true,
      visual: ARAUTOS[casa], sprite: heroiParado(ARAUTOS[casa]), px: (c.porta[1] + 2) * T + 8, py: (c.y0 + 3) * T,
      tilesBloqueados: [`${c.porta[1] + 2},${c.y0 + 2}`], entrada: { x: (c.porta[1] + 2) * T + 8, y: (c.y0 + 3) * T + 8 },
      cumprimentos: ({
        runa: ["Bem-vindo à Ordem!", "Na noite mais escura, a pergunta acende a luz.", "A Taça desta semana é da Lua!"],
        aco: ["Bem-vindo à Legião!", "Cair, aprender, renascer!", "A Taça desta semana arde em vermelho!"],
        flecha: ["Bem-vindo ao Clã!", "Quem caça a resposta não caça sozinho.", "A Taça desta semana é da matilha!"],
      })[casa],
    })),
    {
      id: "altar-fenda", nome: "Altar da Fenda", icone: "🌀", acao: "Abrir a Fenda", sobrepoe: true, destaque: true,
      sprite: altarDaFenda(), px: CIRCULO_DA_FENDA.cx * T, py: (CIRCULO_DA_FENDA.cy - CIRCULO_DA_FENDA.raio - 1) * T,
      tilesBloqueados: bloquear(Math.floor(CIRCULO_DA_FENDA.cx) - 1, Math.floor(CIRCULO_DA_FENDA.cy - CIRCULO_DA_FENDA.raio - 2), 2, 1),
      entrada: { x: CIRCULO_DA_FENDA.cx * T, y: (CIRCULO_DA_FENDA.cy - CIRCULO_DA_FENDA.raio) * T + 4 },
      animar: (ctx, x, y, t) => brilhoRedondo(ctx, x + 15, y + 6, 20, "208, 123, 255", 0.1 + Math.sin(t * 3) * 0.04),
    },
    {
      id: "oraculo-dia", nome: "Oráculo do Dia", icone: "🔮", acao: "Desafio do Dia", sobrepoe: true, destaque: true,
      sprite: cristalDoOraculo(), px: 26 * T + 8, py: 61 * T, tilesBloqueados: ["26,60"], entrada: { x: 26 * T + 8, y: 62 * T },
      animar: (ctx, x, y, t) => {
        brilhoRedondo(ctx, x + 11, y + 14, 18, "110, 240, 255", 0.1 + Math.sin(t * 2.5) * 0.04);
        if (Math.sin(t * 3) > 0.7) retangulo(ctx, x + 10, y + 4 + Math.round(Math.sin(t) * 3), 1, 1, "#ffffff");
      },
    },
  );

  const BLOQUEIAM = new Set([T_SALAO.PAREDE, T_SALAO.FORA, T_SALAO.AGUA, T_SALAO.PARAPEITO, T_SALAO.MURALHA, T_SALAO.NINHO]);
  const andavel = (tx, ty) => !BLOQUEIAM.has(tipoNoSalao(tx, ty));
  const cenario = salaEmHD({
    colunas: SALAO_MAPA.colunas, linhas: SALAO_MAPA.linhas, chao: chaoDoSalao, corFundo: "#1b1533", props, lugares,
    andavel, spawn: CHEGADA_SALAO, quadrosPorSegundo: 60,
    chaoDoPasso: (tx, ty) => ({ [T_SALAO.PALCO]: "madeira", [T_SALAO.AREIA]: "areia", [T_SALAO.GRAMA]: "grama" })[tipoNoSalao(tx, ty)] || "pedra",
    // em qual Casa o herói está (para o chat mostrar "no salão da Runa", por exemplo)
    casaNoPonto: (x, y) => Object.entries(CASAS_DO_MAPA).find(([, c]) => x / 16 > c.x0 && x / 16 < c.x1 && y / 16 > c.y0 && y / 16 < c.y1)?.[0] || null,
    ambiente: () => "academia",
    balbucios: ["Que castelo enorme!", "Alguém pro x1?", "Já leste o quadro?", "Bora estudar junto?"],
    // na arquibancada, quem para senta virado para a arena; com duelo rolando, a plateia torce
    assento: (x, y) => assentoDoColiseu(x, y),
    torcida: () => Boolean(estado.arena?.length),
    // as sombras dos dragões correm no chão (embaixo de todo mundo); os dragões voam por cima de tudo
    animarChao: (ctx, camera, w, h, t) => sombrasDosDragoes(ctx, camera, t, estado),
    animarPorCima: (ctx, camera, w, h, t, heroi) => {
      desenharFendaNoMundo(ctx, camera, w, h, t, estado.fenda);
      desenharDragoesDoSalao(ctx, camera, w, h, t, heroi);
      desenharPlacarDaArena(ctx, camera, t, estado.arena);
    },
  }, "salao");
  pintarColiseuHD(cenario.chao);
  return cenario;
}

// Num degrau da arquibancada: para onde a pessoa sentada olha (para o meio da arena), ou null fora dela.
function assentoDoColiseu(x, y) {
  if (tipoNoSalao(Math.floor(x / 16), Math.floor(y / 16)) !== T_SALAO.ARQUIBANCADA) return null;
  const dx = ARENA_SALAO.cx * 16 - x;
  const dy = ARENA_SALAO.cy * 16 - y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "dir" : "esq") : dy > 0 ? "baixo" : "cima";
}

// o herói está em cima do palanque? (a fala dele vai para o salão inteiro)
function noPalanque(x, y) {
  return x >= PALANQUE_SALAO.x0 * 16 && x <= (PALANQUE_SALAO.x1 + 1) * 16 && y >= PALANQUE_SALAO.y0 * 16 && y <= (PALANQUE_SALAO.y1 + 1) * 16;
}
