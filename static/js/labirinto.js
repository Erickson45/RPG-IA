// As dungeons por dentro: um labirinto subterrâneo de verdade para explorar, no motor de mundos (mundo.js).
// Cada corrida sorteia um labirinto novo (corredores largos, becos e voltas), no tema da dungeon (pedra
// roxa da Cripta, musgo dos Bugs, ouro do Cofre, brasa da Forja...). É escuro: só a tocha do herói e as
// tochas das paredes iluminam. Lá dentro:
//   - os guardiões: um por sala da dungeon (as perguntas da sala), andando pelos corredores;
//   - monstros errantes: correm atrás do herói e fazem uma pergunta solta (não contam para a vitória);
//   - baús: moedas ou itens sorteados pelo servidor; um deles guarda a chave do portão;
//   - o portão de ferro, que fecha o salão do chefão (o último guardião), no ponto mais longe da entrada;
//   - a escada de volta à superfície.
// Quem corrige as respostas, tira vida, abre baús e confere a vitória é o servidor (jogador.py).
// Depende de pixel.js, reino.js (sprites, desenhar, SPRITES_PONTOS), cenario_hd.js, umbra.js (tingir),
// mundo.js, cenas_historia.js (entradaDoChefe) e app.js (palco, acaoJogador, telas de vitória e desmaio).

const CELULA_LAB = 4; // cada célula do labirinto: 3 tiles de chão + 1 de parede
const COLUNAS_CEL = 11;
const LINHAS_CEL = 8;

// o tema de cada dungeon: as cores da pedra e do chão, a luz das tochas e quem mora lá dentro
const TEMAS_LABIRINTO = {
  // (os bichos são os do bestiário, com volume e animação: cada função devolve os quadros; os lobos usam os
  // quadros de corrida do Reino e o chefão de Malakar continua sendo ele mesmo)
  cripta: {
    chao: "#3a3346", chao2: "#2f2a3b", parede: "#1e1a2a", topo: "#5b4f73", tocha: "255, 170, 90", regiao: "abismo",
    guardiao: () => assombracaoArte("#dfe9ff"), errante: () => morcegoArte("#3d2c5c"), erranteVoa: true,
    chefe: () => esqueletoArte({ escala: 2.3, coroa: true, osso: "#d8cfee", olho: "#c08bff" }),
  },
  bugs: {
    chao: "#2f3a2a", chao2: "#263022", parede: "#161e14", topo: "#4a6b3a", tocha: "150, 255, 120", regiao: "deserto",
    guardiao: () => escorpiaoArte(), errante: () => slimeArte("#9acd32"),
    chefe: () => escorpiaoArte("#5a2a8a", "#3d1d63", "#f5c451", { escala: 2.2, coroa: true }),
  },
  cofre: {
    chao: "#4a3a22", chao2: "#3d301c", parede: "#22190c", topo: "#8a6d32", tocha: "255, 209, 102", regiao: "montanhas",
    guardiao: () => quadrosLobo("#3d3a4a"), errante: () => morcegoArte("#4a2a3a"), erranteVoa: true,
    chefe: () => quadrosDragao("#c0392b", { escala: 1.7, coroa: true }),
  },
  forja: {
    chao: "#3a2420", chao2: "#2e1c18", parede: "#1a0d0a", topo: "#7a3a20", tocha: "255, 120, 40", regiao: "cinzas",
    guardiao: () => esqueletoArte({ osso: "#e8b088", olho: "#ff7a1a" }), errante: () => sapoArte("#ff5a1f", "#ffd166"),
    chefe: () => esqueletoArte({ escala: 2.5, coroa: true, osso: "#e8a070", olho: "#ff5a1f" }),
  },
  "biblioteca-vazio": {
    chao: "#2a2440", chao2: "#221d36", parede: "#120e20", topo: "#4a3f7a", tocha: "192, 139, 255", regiao: "abismo",
    guardiao: () => assombracaoArte("#b8a8ff"), errante: () => fogoFatuoArte("#c08bff"), erranteVoa: true,
    chefe: () => ampliarSprite(tingir(heroiParado(VISUAL_MALAKAR), "hue-rotate(200deg) brightness(0.6) saturate(1.5)"), 2.2),
  },
  cidadela: {
    chao: "#3e4a5e", chao2: "#344052", parede: "#1a2232", topo: "#6a84a8", tocha: "160, 220, 255", regiao: "geleira",
    guardiao: () => quadrosLobo("#bfe6ff", "#6ef0ff"), errante: () => assombracaoArte("#bfe6ff"), erranteVoa: true,
    chefe: () => esqueletoArte({ escala: 2.4, coroa: true, osso: "#cfeaff", olho: "#6ef0ff" }),
  },
};

// os escombros de cada dungeon: [tipo da decoração pintada (arvores_arte.js), filtro de cor]
const ESCOMBROS_LABIRINTO = {
  cripta: [["osso", null], ["rocha", "brightness(0.6) hue-rotate(220deg)"], ["cogumelo", "hue-rotate(200deg) brightness(0.8)"]],
  bugs: [["cogumelo", "hue-rotate(80deg)"], ["rocha", "brightness(0.55) sepia(0.4) hue-rotate(50deg)"], ["osso", null]],
  cofre: [["rocha", "sepia(0.7) brightness(0.75)"], ["osso", null], ["rocha", "sepia(0.5) brightness(0.6)"]],
  forja: [["rocha", "brightness(0.45) sepia(0.6) hue-rotate(-20deg)"], ["osso", "sepia(0.6)"], ["rocha", "brightness(0.5)"]],
  "biblioteca-vazio": [["cristal", null], ["rocha", "brightness(0.5) hue-rotate(230deg)"], ["cogumelo", "hue-rotate(230deg)"]],
  cidadela: [["rochaNeve", null], ["cristal", "hue-rotate(-60deg) saturate(0.6)"], ["osso", "brightness(1.2)"]],
};

// o bicho do tema pronto para o motor: os quadros (do bestiário ou do Reino) ou o desenho parado de sempre
function bichoDoLabirinto(chave, criar) {
  const arte = lembrarBestiario(`lab|${chave}`, criar);
  if (Array.isArray(arte)) return { sprite: arte[0], quadros: arte, vivo: true };
  return { sprite: arte };
}

// o que flutua no ar de cada dungeon (cores, velocidade e se sobe ou desce)
const PARTICULAS_LABIRINTO = {
  cripta: { cores: ["#c8c0d8", "#8a84a6"], velocidade: 0.04, sobe: false },
  bugs: { cores: ["#96ff78", "#c8ffd6"], velocidade: 0.05, sobe: true },
  cofre: { cores: ["#ffd166", "#fff3b0"], velocidade: 0.035, sobe: false },
  forja: { cores: ["#ff9a3c", "#ffd166", "#ff5a1f"], velocidade: 0.12, sobe: true },
  "biblioteca-vazio": { cores: ["#c08bff", "#efe6ff"], velocidade: 0.05, sobe: true },
  cidadela: { cores: ["#ffffff", "#bfe6ff"], velocidade: 0.08, sobe: false },
};

// sorteio com semente (o labirinto de uma corrida é sempre o mesmo, mesmo depois de cada luta)
function sorteioLab(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Gera o labirinto: busca em profundidade nas células (todo canto alcançável), depois algumas paredes a
// menos para criar voltas (fora do caminho do salão do chefão, que continua com uma porta só).
function gerarLabirinto(semente) {
  const r = sorteioLab(semente);
  const W = COLUNAS_CEL * CELULA_LAB + 1;
  const H = LINHAS_CEL * CELULA_LAB + 1;
  const mapa = Array.from({ length: H }, () => new Uint8Array(W)); // 0 parede, 1 chão
  const abrirCelula = (cx, cy) => {
    for (let y = 0; y < CELULA_LAB - 1; y++) for (let x = 0; x < CELULA_LAB - 1; x++) mapa[cy * CELULA_LAB + 1 + y][cx * CELULA_LAB + 1 + x] = 1;
  };
  // a passagem entre duas células vizinhas (a parede entre elas vira chão, na largura do corredor)
  const abrirPassagem = (ax, ay, bx, by) => {
    if (ax !== bx) {
      const x = Math.max(ax, bx) * CELULA_LAB;
      for (let y = 0; y < CELULA_LAB - 1; y++) mapa[ay * CELULA_LAB + 1 + y][x] = 1;
    } else {
      const y = Math.max(ay, by) * CELULA_LAB;
      for (let x = 0; x < CELULA_LAB - 1; x++) mapa[y][ax * CELULA_LAB + 1 + x] = 1;
    }
  };
  const vizinhos = (cx, cy) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [cx + dx, cy + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < COLUNAS_CEL && y < LINHAS_CEL);
  const ligacoes = Array.from({ length: LINHAS_CEL }, () => Array.from({ length: COLUNAS_CEL }, () => []));
  const visto = Array.from({ length: LINHAS_CEL }, () => new Array(COLUNAS_CEL).fill(false));
  const entrada = [0, Math.floor(r() * LINHAS_CEL)];
  const pilha = [entrada];
  visto[entrada[1]][entrada[0]] = true;
  abrirCelula(...entrada);
  while (pilha.length) {
    const [cx, cy] = pilha[pilha.length - 1];
    const livres = vizinhos(cx, cy).filter(([x, y]) => !visto[y][x]);
    if (!livres.length) {
      pilha.pop();
      continue;
    }
    const [nx, ny] = livres[Math.floor(r() * livres.length)];
    visto[ny][nx] = true;
    abrirCelula(nx, ny);
    abrirPassagem(cx, cy, nx, ny);
    ligacoes[cy][cx].push([nx, ny]);
    ligacoes[ny][nx].push([cx, cy]);
    pilha.push([nx, ny]);
  }
  // a distância de cada célula até a entrada (pelas passagens)
  const distancia = (inicio) => {
    const d = Array.from({ length: LINHAS_CEL }, () => new Array(COLUNAS_CEL).fill(-1));
    d[inicio[1]][inicio[0]] = 0;
    const fila = [inicio];
    while (fila.length) {
      const [cx, cy] = fila.shift();
      ligacoes[cy][cx].forEach(([x, y]) => {
        if (d[y][x] < 0) {
          d[y][x] = d[cy][cx] + 1;
          fila.push([x, y]);
        }
      });
    }
    return d;
  };
  const dist = distancia(entrada);
  const celulas = [];
  for (let y = 0; y < LINHAS_CEL; y++) for (let x = 0; x < COLUNAS_CEL; x++) celulas.push([x, y]);
  const becos = celulas.filter(([x, y]) => ligacoes[y][x].length === 1 && !(x === entrada[0] && y === entrada[1]));
  // o salão do chefão: o beco mais longe da entrada, pelo caminho e em linha reta (para ninguém ver o
  // chefão pelas grades logo ao chegar); o portão fica na única passagem dele
  const longe = ([x, y]) => dist[y][x] + 2 * (Math.abs(x - entrada[0]) + Math.abs(y - entrada[1]));
  const chefe = becos.reduce((melhor, c) => (longe(c) > longe(melhor) ? c : melhor), becos[0]);
  const antesDoChefe = ligacoes[chefe[1]][chefe[0]][0];
  // voltas: algumas paredes caem (nunca perto do salão do chefão), para o labirinto ter mais de um caminho
  const perto = (c, alvo) => Math.abs(c[0] - alvo[0]) + Math.abs(c[1] - alvo[1]) <= 1;
  for (let i = 0; i < 9; i++) {
    const [cx, cy] = celulas[Math.floor(r() * celulas.length)];
    const [nx, ny] = vizinhos(cx, cy)[Math.floor(r() * vizinhos(cx, cy).length)];
    if (perto([cx, cy], chefe) || perto([nx, ny], chefe) || ligacoes[cy][cx].some(([x, y]) => x === nx && y === ny)) continue;
    abrirPassagem(cx, cy, nx, ny);
    ligacoes[cy][cx].push([nx, ny]);
    ligacoes[ny][nx].push([cx, cy]);
  }
  // os tiles do portão: a passagem entre o salão e a célula de antes
  const portao = [];
  if (antesDoChefe[0] !== chefe[0]) {
    const x = Math.max(antesDoChefe[0], chefe[0]) * CELULA_LAB;
    for (let y = 0; y < CELULA_LAB - 1; y++) portao.push([x, chefe[1] * CELULA_LAB + 1 + y]);
  } else {
    const y = Math.max(antesDoChefe[1], chefe[1]) * CELULA_LAB;
    for (let x = 0; x < CELULA_LAB - 1; x++) portao.push([chefe[0] * CELULA_LAB + 1 + x, y]);
  }
  const centro = ([cx, cy]) => [cx * CELULA_LAB + 2, cy * CELULA_LAB + 2];
  const livres = celulas.filter((c) => !(c[0] === chefe[0] && c[1] === chefe[1]) && !(c[0] === entrada[0] && c[1] === entrada[1]));
  const embaralhar = (lista) => lista.map((c) => [r(), c]).sort((a, b) => a[0] - b[0]).map(([, c]) => c);
  // os baús ficam nos becos (o baú 0, o da chave, é o beco mais longe depois do salão do chefão)
  const becosLivres = becos.filter((c) => !(c[0] === chefe[0] && c[1] === chefe[1])).sort((a, b) => dist[b[1]][b[0]] - dist[a[1]][a[0]]);
  const baus = becosLivres.slice(0, 5).map(centro);
  // os guardiões, espalhados pelo caminho (do mais perto ao mais longe da entrada)
  const porDistancia = embaralhar(livres).filter((c) => !becosLivres.slice(0, 5).some((b) => b[0] === c[0] && b[1] === c[1])).sort((a, b) => dist[a[1]][a[0]] - dist[b[1]][b[0]]);
  return {
    mapa, W, H, entrada: centro(entrada), chefe: centro(chefe), portao, baus, porDistancia: porDistancia.map(centro),
    maisLonge: Math.max(...celulas.map(([x, y]) => dist[y][x])), dist, celulas,
  };
}

// o chão e as paredes em pixel (32 px por tile): lajotas com variações e rachaduras, e paredes de tijolo
// com a face da frente iluminada onde dão para o chão
// O chão: cada tile vira 4 lajotas de tamanhos desencontrados (com luz em cima à esquerda, sombra
// embaixo à direita e rejunte escuro), sombra junto das paredes (o canto fica mais escuro, dando
// profundidade) e o enfeite de cada dungeon. As paredes: o topo escuro com tijolos apagados e, onde dão
// para o chão, uma face alta de tijolos iluminados de cima para baixo, com rodapé e um enfeite de vez em
// quando (estandarte, corrente, musgo, gelo...).
const ENFEITES_LABIRINTO = {
  cripta: { chao: ["osso", "caveira", "teia"], parede: ["corrente", "rachadura", "estandarte"], estandarte: "#5a2a8a" },
  bugs: { chao: ["musgo", "cogumelo", "musgo"], parede: ["cipo", "musgo", "rachadura"], estandarte: "#2f5a22" },
  cofre: { chao: ["moeda", "moeda", "joia"], parede: ["estandarte", "corrente", "ouro"], estandarte: "#8a1f2a" },
  forja: { chao: ["brasa", "fuligem", "brasa"], parede: ["rachadura", "corrente", "brasa"], estandarte: "#4a1a10" },
  "biblioteca-vazio": { chao: ["pagina", "runa", "pagina"], parede: ["estante", "estandarte", "runa"], estandarte: "#3a2a6a" },
  cidadela: { chao: ["gelo", "geada", "gelo"], parede: ["pingente", "estandarte", "pingente"], estandarte: "#2a4a7a" },
};

function enfeiteNoChao(ctx, tipo, x, y, r) {
  const px = (a, b, cor, w = 1, h = 1) => retangulo(ctx, x + a, y + b, w, h, cor);
  if (tipo === "osso") { px(0, 1, "#d8d0c0", 6, 1); px(-1, 0, "#e8e0d0"); px(-1, 2, "#e8e0d0"); px(6, 0, "#e8e0d0"); px(6, 2, "#e8e0d0"); }
  if (tipo === "caveira") { px(0, 0, "#e8e0d0", 5, 4); px(1, 4, "#c8c0b0", 3, 1); px(1, 1, "#1e1a2a"); px(3, 1, "#1e1a2a"); }
  if (tipo === "teia") for (let k = 0; k < 7; k++) { px(k, k, "#8a84a6"); px(k, 0, "#6a6486"); px(0, k, "#6a6486"); }
  if (tipo === "musgo") for (let k = 0; k < 9; k++) px(Math.floor(r() * 8), Math.floor(r() * 6), k % 3 ? "#3f6e2a" : "#5a9a3a", 2, 1);
  if (tipo === "cogumelo") { px(1, 3, "#e8e0c8", 1, 3); px(0, 1, "#7dff9a", 3, 2); px(1, 0, "#c8ffd6"); }
  if (tipo === "moeda") { px(0, 0, "#f5c451", 2, 2); px(0, 0, "#fff3b0"); px(3, 2, "#c9952a", 2, 1); }
  if (tipo === "joia") { px(1, 0, "#6ef0ff"); px(0, 1, "#2e7bd0", 3, 1); px(1, 2, "#2e7bd0"); }
  if (tipo === "brasa") { px(0, 0, "#ff7a1a", 3, 1); px(1, 0, "#ffd166"); px(4, 1, "#e0581a"); }
  if (tipo === "fuligem") for (let k = 0; k < 6; k++) px(Math.floor(r() * 8), Math.floor(r() * 5), "#140a08", 2, 1);
  if (tipo === "pagina") { px(0, 0, "#e8e0c8", 5, 4); px(1, 1, "#8a84a6", 3, 1); px(1, 2, "#8a84a6", 2, 1); }
  if (tipo === "runa") { px(1, 0, "#a98bff", 3, 1); px(0, 1, "#a98bff", 1, 3); px(4, 1, "#a98bff", 1, 3); px(1, 4, "#a98bff", 3, 1); px(2, 2, "#efe6ff"); }
  if (tipo === "gelo") { px(1, 0, "#e6fdff", 1, 4); px(0, 2, "#8ab8e0"); px(2, 1, "#bfe6ff", 1, 3); }
  if (tipo === "geada") for (let k = 0; k < 8; k++) px(Math.floor(r() * 9), Math.floor(r() * 6), "#c8e6f8");
}

function enfeiteNaParede(ctx, tipo, x, y, tema, cores) {
  const px = (a, b, cor, w = 1, h = 1) => retangulo(ctx, x + a, y + b, w, h, cor);
  if (tipo === "corrente") for (let k = 0; k < 12; k += 3) { px(14, k, "#8a8b99", 2, 2); px(15, k + 2, "#4a4a55"); }
  if (tipo === "rachadura") { let cx = 8; for (let k = 0; k < 12; k++) { px(cx, k, tom(tema.topo, 0.45)); cx += k % 3 === 0 ? 1 : 0; } }
  if (tipo === "estandarte") { px(9, 0, "#5c3418", 14, 1); for (let k = 1; k < 13; k++) px(10, k, cores.estandarte, 12 - (k > 10 ? (k - 10) * 4 : 0), 1); px(14, 4, "#f5c451", 4, 3); }
  if (tipo === "musgo" || tipo === "cipo") for (let k = 0; k < (tipo === "cipo" ? 14 : 8); k++) px(4 + ((k * 7) % 22), tipo === "cipo" ? k : (k * 3) % 8, k % 2 ? "#3f6e2a" : "#5a9a3a", 2, tipo === "cipo" ? 2 : 1);
  if (tipo === "ouro") { px(4, 3, "#c9952a", 24, 2); px(4, 3, "#fff3b0", 24, 1); }
  if (tipo === "brasa") { px(6, 8, "#ff7a1a", 3, 2); px(20, 4, "#e0581a", 2, 2); px(7, 8, "#ffd166"); }
  if (tipo === "estante") { px(3, 1, "#2a1a10", 26, 12); for (let k = 4; k < 28; k += 3) px(k, 2, ["#7a1f3d", "#2e5cb8", "#c9952a", "#2e8b57", "#5a3aa6"][k % 5], 2, 9 - (k % 3)); px(3, 11, "#4a2e1a", 26, 2); }
  if (tipo === "runa") { px(12, 2, "#a98bff", 8, 1); px(12, 2, "#a98bff", 1, 8); px(19, 2, "#a98bff", 1, 8); px(12, 9, "#a98bff", 8, 1); px(15, 5, "#efe6ff", 2, 2); }
  if (tipo === "pingente") for (let i = 0; i < 4; i++) { const ix = 3 + i * 8; for (let k = 0; k < 5 + (i % 2) * 3; k++) px(ix + (k > 3 ? 1 : 0), k, k < 2 ? "#ffffff" : "#bfe6ff", k > 3 ? 1 : 2, 1); }
}

function desenharLabirinto(lab, tema, semente, idDungeon) {
  const T = 32;
  const r = sorteioLab(semente ^ 0x9e3779b9);
  const enfeites = ENFEITES_LABIRINTO[idDungeon] || ENFEITES_LABIRINTO.cripta;
  const { canvas, ctx } = criarTela(lab.W * T, lab.H * T);
  const chao = (x, y) => Boolean(lab.mapa[y]?.[x]);
  const rejunte = tom(tema.chao2, 0.55);
  for (let y = 0; y < lab.H; y++) {
    for (let x = 0; x < lab.W; x++) {
      const px = x * T;
      const py = y * T;
      if (chao(x, y)) {
        retangulo(ctx, px, py, T, T, rejunte);
        // 4 lajotas com o corte desencontrado
        const cx = 12 + Math.floor(r() * 8);
        const cy = 12 + Math.floor(r() * 8);
        [[0, 0, cx, cy], [cx, 0, T - cx, cy], [0, cy, cx, T - cy], [cx, cy, T - cx, T - cy]].forEach(([lx, ly, lw, lh]) => {
          const cor = tom(r() < 0.5 ? tema.chao : tema.chao2, 0.9 + r() * 0.22);
          retangulo(ctx, px + lx + 1, py + ly + 1, lw - 1, lh - 1, cor);
          retangulo(ctx, px + lx + 1, py + ly + 1, lw - 1, 1, tom(cor, 1.22));
          retangulo(ctx, px + lx + 1, py + ly + 1, 1, lh - 1, tom(cor, 1.12));
          retangulo(ctx, px + lx + 1, py + ly + lh - 1, lw - 1, 1, tom(cor, 0.78));
          if (r() < 0.18) {
            // rachadura
            let rx = px + lx + 3 + Math.floor(r() * Math.max(1, lw - 6));
            for (let k = 2; k < lh - 2; k++) {
              retangulo(ctx, rx, py + ly + k, 1, 1, tom(cor, 0.6));
              rx += r() < 0.3 ? 1 : 0;
            }
          }
        });
        // sombra junto das paredes: a de cima é a mais forte (a parede tem altura)
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        if (!chao(x, y - 1)) for (let k = 0; k < 8; k++) { ctx.globalAlpha = 0.5 * (1 - k / 8); ctx.fillRect(px, py + k, T, 1); }
        if (!chao(x - 1, y)) for (let k = 0; k < 5; k++) { ctx.globalAlpha = 0.35 * (1 - k / 5); ctx.fillRect(px + k, py, 1, T); }
        if (!chao(x + 1, y)) for (let k = 0; k < 5; k++) { ctx.globalAlpha = 0.35 * (1 - k / 5); ctx.fillRect(px + T - 1 - k, py, 1, T); }
        // o desgaste: manchas de sujeira e umidade que atravessam as lajotas, e o meio do corredor mais gasto
        for (let cy = 0; cy < T; cy += 4) {
          for (let cx = 0; cx < T; cx += 4) {
            const n = ruidoDoMundo((px + cx) / 70, (py + cy) / 70, 31) * 0.7 + ruidoDoMundo((px + cx) / 22, (py + cy) / 22, 32) * 0.3;
            if (Math.abs(n) < 0.25) continue;
            ctx.globalAlpha = Math.min(0.32, (Math.abs(n) - 0.25) * 1.2);
            ctx.fillStyle = n > 0 ? tom(tema.chao, 1.35) : "#05030c";
            ctx.fillRect(px + cx, py + cy, 4, 4);
          }
        }
        // pedrinhas soltas
        for (let k = 0; k < 2; k++) {
          if (hashTile(x, y, 20 + k) < 0.6) continue;
          const sx = px + 3 + Math.floor(hashTile(x, y, 22 + k) * 26);
          const sy = py + 3 + Math.floor(hashTile(x, y, 24 + k) * 26);
          ctx.globalAlpha = 1;
          retangulo(ctx, sx, sy, 2, 2, tom(tema.chao, 1.3));
          retangulo(ctx, sx, sy + 2, 2, 1, tom(tema.chao, 0.6));
        }
        ctx.globalAlpha = 1;
        if (r() < 0.16) enfeiteNoChao(ctx, enfeites.chao[Math.floor(r() * enfeites.chao.length)], px + 6 + Math.floor(r() * 18), py + 8 + Math.floor(r() * 16), r);
      } else {
        // o topo da parede: escuro, com os tijolos quase apagados
        retangulo(ctx, px, py, T, T, tema.parede);
        for (let ty = 0; ty < T; ty += 8) for (let tx = (ty / 8) % 2 ? -8 : 0; tx < T; tx += 16) retangulo(ctx, px + tx + 1, py + ty + 1, 14, 6, tom(tema.parede, 1.18));
        // a borda do topo da parede: pedras de capa com a quina acesa onde a parede termina
        if (chao(x, y + 1) || chao(x, y - 1) || chao(x - 1, y) || chao(x + 1, y)) {
          for (let ty = 0; ty < T; ty += 6) {
            for (let tx = (ty / 6) % 2 ? -5 : 0; tx < T; tx += 10) {
              const cor = tom(tema.parede, 1.08 + (hashTile(x * 4 + tx, y * 6 + ty, 3) - 0.5) * 0.18);
              retangulo(ctx, px + tx + 1, py + ty + 1, 8, 4, cor);
              retangulo(ctx, px + tx + 1, py + ty + 1, 8, 1, tom(cor, 1.18));
            }
          }
          if (chao(x, y - 1)) retangulo(ctx, px, py, T, 2, tom(tema.topo, 0.85));
          if (chao(x - 1, y)) retangulo(ctx, px, py, 2, T, tom(tema.topo, 0.8));
          if (chao(x + 1, y)) retangulo(ctx, px + T - 2, py, 2, T, tom(tema.parede, 0.7));
        }
        // a face da frente (quando embaixo é chão): pedra de cantaria em fileiras, cada bloco com luz em cima,
        // sombra embaixo e argamassa funda; escurece de cima para baixo e termina num rodapé
        if (chao(x, y + 1)) {
          const altura = 20;
          const face = py + T - altura;
          const argamassa = tom(tema.topo, 0.42);
          retangulo(ctx, px, face, T, altura, argamassa);
          for (let fila = 0, ty = 0; ty < altura - 3; fila++, ty += 6) {
            const luz = 1.18 - (ty / altura) * 0.5;
            let tx = fila % 2 ? -5 : 0;
            while (tx < T) {
              const larg = 8 + Math.floor(hashTile(x * 9 + tx, y * 5 + fila, 4) * 7);
              const cor = tom(tema.topo, luz * (0.92 + hashTile(x * 3 + tx, y + fila, 5) * 0.16));
              const x0 = Math.max(0, tx + 1);
              const x1 = Math.min(T, tx + larg);
              if (x1 > x0) {
                retangulo(ctx, px + x0, face + ty + 1, x1 - x0, 4, cor);
                retangulo(ctx, px + x0, face + ty + 1, x1 - x0, 1, tom(cor, 1.22));
                retangulo(ctx, px + x0, face + ty + 4, x1 - x0, 1, tom(cor, 0.78));
                if (x0 === tx + 1) retangulo(ctx, px + x0, face + ty + 1, 1, 4, tom(cor, 1.1));
              }
              tx += larg + 1;
            }
          }
          retangulo(ctx, px, face, T, 2, tom(tema.topo, 1.4));
          // o rodapé e a sombra que a parede faz no pé
          retangulo(ctx, px, py + T - 3, T, 3, tom(tema.parede, 0.75));
          retangulo(ctx, px, py + T - 3, T, 1, tom(tema.topo, 0.6));
          // gotas e manchas de umidade escorrendo
          if (hashTile(x, y, 6) > 0.7) {
            const gx = px + 4 + Math.floor(hashTile(x, y, 7) * 22);
            for (let k = 0; k < 8 + Math.floor(hashTile(x, y, 8) * 8); k++) retangulo(ctx, gx, face + 2 + k, 1, 1, tom(tema.topo, 0.55));
          }
          if (r() < 0.22) enfeiteNaParede(ctx, enfeites.parede[Math.floor(r() * enfeites.parede.length)], px, face + 1, tema, enfeites);
        }
      }
    }
  }
  canvas.res = 2;
  return canvas;
}

// o portão de ferro do salão do chefão
function spritePortao(largura) {
  return desenhar(largura, 30, (ctx) => {
    retangulo(ctx, 0, 0, largura, 4, "#4a4a58");
    retangulo(ctx, 0, 26, largura, 4, "#4a4a58");
    for (let x = 2; x < largura - 1; x += 5) {
      retangulo(ctx, x, 2, 2, 26, "#8a8b99");
      retangulo(ctx, x, 2, 1, 26, "#c9cad8");
    }
    retangulo(ctx, largura / 2 - 3, 12, 6, 6, "#c9a227");
    retangulo(ctx, largura / 2 - 1, 14, 2, 3, "#1b1533");
  });
}

// a escada de volta à superfície
function spriteEscada() {
  return desenhar(28, 22, (ctx) => {
    for (let i = 0; i < 5; i++) {
      retangulo(ctx, i * 2, 18 - i * 4, 28 - i * 4, 4, i % 2 ? "#6b6c7a" : "#8a8b99");
      retangulo(ctx, i * 2, 18 - i * 4, 28 - i * 4, 1, "#b8bacb");
    }
    retangulo(ctx, 12, 0, 4, 3, "#ffd166");
  });
}

// A corrida aberta: o labirinto sorteado, onde o herói está e o que já foi feito (guardiões, baús, chave).
let corridaLab = null;

// Entra na dungeon: o servidor confere a entrada (e gasta o amuleto); depois, o labirinto.
async function telaDungeon(id, usarAmuleto) {
  const d = await api(`/api/dungeons/${id}`);
  await acaoJogador(`dungeons/${id}/entrar`, { amuleto: Boolean(usarAmuleto) });
  const semente = Math.floor(Math.random() * 2 ** 31);
  corridaLab = { d, semente, lab: gerarLabirinto(semente), vencidos: new Set(), baus: new Set(), chave: false, portaAberta: false, posicao: null, moedasSalas: 0 };
  Som.efeito("porta");
  transicaoPixel(`${d.icone} ${d.nome}`, "#0b0818", () => telaLabirinto(), {
    forma: "circulo", duracao: 520, espera: 500,
    carregar: { tema: "masmorra", titulo: d.nome, sobretitulo: "Descendo para", icone: d.icone, avatar: progresso.avatar, minimo: 1500 },
  });
}

function telaLabirinto() {
  const c = corridaLab;
  if (!c) return telaMapa();
  const { d, lab } = c;
  const tema = TEMAS_LABIRINTO[d.id] || TEMAS_LABIRINTO.cripta;
  Som.musica("misterio");
  window.scrollTo(0, 0);
  const guardioes = d.salas.length - 1; // a última sala é a do chefão
  const secao = criar(`
    <section class="tela-mundo labirinto">
      <div class="cabecalho-mapa">
        <div>
          <h2 class="titulo-pixel">${d.icone} ${escapar(d.nome)}</h2>
          <p>Explora o labirinto. Encosta nos guardiões para lutar, abre os baús e acha a chave do portão do chefão.</p>
        </div>
        <div class="painel-labirinto">
          <span>⚔️ Guardiões <b>${[...c.vencidos].filter((v) => v.startsWith("guardiao")).length}/${guardioes}</b></span>
          <span>🧰 Baús <b>${c.baus.size}/${lab.baus.length}</b></span>
          <span>${c.chave ? "🗝️ <b>Tens a chave</b>" : "🔒 <b>Sem a chave</b>"}</span>
        </div>
      </div>
      <div class="mapa-reino" data-mundo></div>
    </section>`);
  tela.replaceChildren(secao);
  atualizarModoMundo();
  const T16 = 16;
  const ponto = ([tx, ty]) => ({ x: tx * T16 + 8, y: ty * T16 + 12 });
  const lugares = [];
  // a escada de saída, na entrada
  const [ex, ey] = lab.entrada;
  lugares.push({
    id: "escada", nome: "Voltar à superfície", icone: "🪜", acao: "Subir", sprite: spriteHD("lab-escada", () => dobradoHD(spriteEscada(), 3)),
    px: ex * T16 + 8, py: (ey + 1) * T16 - 4, entrada: { x: ex * T16 + 8, y: (ey + 1) * T16 + 6 }, sobrepoe: true, semRotulo: true, tilesBloqueados: [],
  });
  // os baús
  lab.baus.forEach(([bx, by], i) => {
    const aberto = c.baus.has(i);
    const sprite = spriteHD(`lab-bau-${aberto}`, () => dobradoHD(SPRITES_PONTOS.bau(aberto), 7));
    lugares.push({
      id: `bau-${i}`, bau: i, nome: aberto ? "Baú vazio" : "Baú", icone: "🧰", acao: aberto ? "Ver" : "Abrir", sprite, sobrepoe: true, semRotulo: true,
      px: bx * T16 + 8, py: (by + 1) * T16, entrada: { x: bx * T16 + 8, y: (by + 1) * T16 + 8 }, tilesBloqueados: [`${bx},${by}`],
      animar: aberto ? null : (ctx, x, y, t) => {
        const brilho = 0.4 + Math.sin(t * 3 + i) * 0.3;
        ctx.fillStyle = `rgba(255, 220, 120, ${brilho})`;
        ctx.fillRect(x + 4 + (Math.floor(t * 2 + i) % 8), y - 2, 1, 1);
      },
    });
  });
  // o portão do salão do chefão (some depois de aberto com a chave)
  if (!c.portaAberta) {
    const xs = lab.portao.map(([x]) => x);
    const ys = lab.portao.map(([, y]) => y);
    const horizontal = new Set(ys).size === 1;
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = Math.max(...ys);
    lugares.push({
      id: "portao", nome: "Portão do chefão", icone: "🔒", acao: c.chave ? "Destrancar" : "Trancado",
      sprite: spriteHD(`lab-portao-${horizontal}`, () => dobradoHD(spritePortao(horizontal ? 46 : 14), 5)), sobrepoe: true, semRotulo: true,
      px: cx * T16 + 8, py: (cy + 1) * T16, entrada: { x: cx * T16 + 8, y: (cy + 1) * T16 + (horizontal ? 10 : 0) }, tilesBloqueados: lab.portao.map(([x, y]) => `${x},${y}`),
    });
  }
  // os guardiões (um por sala), os errantes e o chefão
  const monstros = [];
  const pontosGuardioes = lab.porDistancia.filter((_, i, todos) => i === Math.floor(todos.length * 0.35) || i === Math.floor(todos.length * 0.7));
  for (let s = 0; s < guardioes; s++) {
    const [gx, gy] = pontosGuardioes[s % pontosGuardioes.length];
    const id = `guardiao-${s}`;
    monstros.push({
      id, tipoId: `lab-guardiao`, nome: d.salas[s].inimigo.nome, sala: s, ...bichoDoLabirinto(`${d.id}-guardiao`, tema.guardiao), velocidade: 18, agressivo: false,
      vida: d.salas[s].perguntas.length, casa: [gx, gy], ...ponto([gx, gy]), alvo: null, espera: 0, brilho: tema.tocha,
      derrotado: () => c.vencidos.has(id),
    });
  }
  lab.porDistancia.filter((_, i) => i % 5 === 2).slice(0, 5).forEach(([wx, wy], i) => {
    const id = `errante-${i}`;
    monstros.push({
      id, tipoId: "lab-errante", nome: "Sombra do labirinto", extra: true, ...bichoDoLabirinto(`${d.id}-errante`, tema.errante), velocidade: 30, agressivo: true, voa: Boolean(tema.erranteVoa),
      casa: [wx, wy], ...ponto([wx, wy]), alvo: null, espera: 0, derrotado: () => c.vencidos.has(id),
    });
  });
  const [chx, chy] = lab.chefe;
  monstros.push({
    id: "chefe", tipoId: `lab-chefe-${d.id}`, nome: d.salas[guardioes].inimigo.nome, sala: guardioes, chefe: true, parado: true,
    ...bichoDoLabirinto(`${d.id}-chefe`, tema.chefe), vida: d.salas[guardioes].perguntas.length, casa: [chx, chy], ...ponto([chx, chy]), alvo: null, espera: 0,
    derrotado: () => c.vencidos.has("chefe"),
  });

  // as tochas: nas paredes que dão para o chão, de tempos em tempos
  const tochas = [];
  for (let y = 1; y < lab.H - 1; y++) for (let x = 1; x < lab.W - 1; x++) {
    if (!lab.mapa[y][x] && lab.mapa[y + 1][x] && (x * 7 + y * 13) % 9 === 0) tochas.push([x * T16 + 8, y * T16 + 10]);
  }
  const escuro = document.createElement("canvas");
  const ctxEscuro = escuro.getContext("2d");
  const chao = desenharLabirinto(lab, tema, c.semente, d.id);
  // escombros e enfeites pintados encostados nas paredes (pedras, ossos, cogumelos, cristais...), na cor da
  // dungeon; não bloqueiam a passagem
  const props = [];
  if (typeof arvorePintada === "function") {
    const lista = ESCOMBROS_LABIRINTO[d.id] || ESCOMBROS_LABIRINTO.cripta;
    const r = sorteioLab(c.semente ^ 0x51ed);
    const ocupado = new Set([...lab.baus, lab.entrada, lab.chefe, ...lab.portao].map(([x, y]) => `${x},${y}`));
    for (let y = 1; y < lab.H - 1; y++) {
      for (let x = 1; x < lab.W - 1; x++) {
        if (!lab.mapa[y][x] || lab.mapa[y - 1][x] || ocupado.has(`${x},${y}`) || r() > 0.2) continue;
        const [tipo, filtro] = lista[Math.floor(r() * lista.length)];
        const v = Math.floor(r() * 3);
        const sprite = lembrarBestiario(`lab-escombro|${d.id}|${tipo}|${v}`, () => {
          const base = arvorePintada(tipo, v);
          // (sempre uma cópia: a pintada original é a do Reino) e menor, do tamanho de um corredor de masmorra
          const tingido = tingir(base, filtro || "none");
          tingido.res = tipo === "cristal" ? 3.6 : 3;
          tingido.acabado = true;
          tingido.folhas = [];
          return tingido;
        });
        props.push({ x: x * T16 + 4 + r() * 8, y: y * T16 + 9, sprite, tilesBloqueados: [] });
      }
    }
  }
  const cenario = {
    colunas: lab.W, linhas: lab.H, chao, props, lugares, monstros, corFundo: tema.parede, resolucao: 2,
    andavel: (tx, ty) => Boolean(lab.mapa[ty]?.[tx]),
    spawn: { x: ex * T16 + 8, y: (ey + 1) * T16 + 8 },
    ambiente: () => tema.regiao === "cinzas" ? "cinzas" : tema.regiao === "geleira" ? "geleira" : "abismo",
    chaoDoPasso: () => "pedra",
    noite: () => true,
    // as chamas das tochas tremulando
    animarChao(ctx, camera, w, h, t) {
      tochas.forEach(([x, y], i) => {
        if (x < camera.x - 20 || x > camera.x + w + 20 || y < camera.y - 20 || y > camera.y + h + 20) return;
        const px = x - camera.x;
        const py = y - camera.y;
        retangulo(ctx, px - 1, py, 2, 6, "#5c3418");
        const altura = 3 + Math.round(Math.abs(Math.sin(t * 9 + i)) * 2);
        retangulo(ctx, px - 1, py - altura, 3, altura, "#ff9a3c");
        retangulo(ctx, px, py - altura + 1, 1, altura - 1, "#ffe08a");
      });
    },
    // a escuridão: só a tocha do herói e as das paredes iluminam
    animarPorCima(ctx, camera, w, h, t, heroi) {
      if (!heroi) return;
      escuro.width = Math.ceil(w);
      escuro.height = Math.ceil(h);
      ctxEscuro.globalCompositeOperation = "source-over";
      ctxEscuro.fillStyle = "rgba(3, 2, 8, 0.84)";
      ctxEscuro.fillRect(0, 0, escuro.width, escuro.height);
      ctxEscuro.globalCompositeOperation = "destination-out";
      const luz = (x, y, raio) => {
        const g = ctxEscuro.createRadialGradient(x, y, raio * 0.15, x, y, raio);
        g.addColorStop(0, "rgba(0, 0, 0, 1)");
        g.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctxEscuro.fillStyle = g;
        ctxEscuro.fillRect(x - raio, y - raio, raio * 2, raio * 2);
      };
      luz(heroi.x - camera.x, heroi.y - camera.y - 10, 105 + Math.sin(t * 6) * 3);
      tochas.forEach(([x, y], i) => luz(x - camera.x, y - camera.y, 46 + Math.sin(t * 8 + i) * 3));
      if (!c.vencidos.has("chefe")) luz(chx * T16 + 8 - camera.x, chy * T16 - camera.y, 40);
      ctx.drawImage(escuro, 0, 0, w, h);
      // o brilho quente das tochas por cima do escuro
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      tochas.forEach(([x, y], i) => {
        brilhoRedondo(ctx, x - camera.x, y - camera.y, 16, tema.tocha, 0.05 + Math.sin(t * 8 + i) * 0.015);
        brilhoRedondo(ctx, x - camera.x, y - camera.y + 14, 26, tema.tocha, 0.025);
      });
      // o ar da masmorra: poeira, esporos, faíscas, brasas, runas ou neve, conforme a dungeon. Cada
      // partícula só aparece perto de uma luz (do herói ou de uma tocha), como no escuro de verdade
      const ar = PARTICULAS_LABIRINTO[d.id] || PARTICULAS_LABIRINTO.cripta;
      const luzes = [[heroi.x - camera.x, heroi.y - camera.y - 10, 80], ...tochas.map(([x, y]) => [x - camera.x, y - camera.y, 44])];
      for (let i = 0; i < 46; i++) {
        const vida = (t * ar.velocidade + i * 0.137) % 1;
        const x = ((i * 97.3 + Math.sin(t * 0.7 + i) * 10 + camera.x * -0.05) % w + w) % w;
        const y = ar.sobe ? h - vida * (h + 10) : vida * (h + 10) - 5;
        let perto = 0;
        luzes.forEach(([lx, ly, raio]) => { perto = Math.max(perto, 1 - Math.hypot(x - lx, y - ly) / raio); });
        if (perto <= 0) continue;
        ctx.globalAlpha = Math.min(1, perto * 1.6) * (0.5 + Math.sin(t * 3 + i) * 0.3);
        ctx.fillStyle = ar.cores[i % ar.cores.length];
        ctx.fillRect(Math.round(x), Math.round(y), i % 5 ? 1 : 2, 1);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    },
  };
  const mundo = montarMundo(secao.querySelector("[data-mundo]"), cenario, {
    avatar: progresso.avatar,
    nomeHeroi: nomeAluno(),
    tituloHeroi: principalDoHeroi() ? seloDoTitulo() : "",
    aura: auraDoHeroi(),
    posicao: c.posicao,
    aoMover: (pos) => { c.posicao = pos; },
    aoEntrar: (lugar) => {
      if (lugar.id === "escada") return sairDoLabirinto();
      if (lugar.id === "portao") return abrirPortao();
      if (lugar.bau !== undefined) return abrirBauDoLabirinto(lugar.bau);
    },
    aoEncontro: (monstro) => {
      c.posicao = { x: mundo.heroi.x, y: mundo.heroi.y };
      if (monstro.chefe) {
        return entradaDoChefe({ ...monstro, tipoId: `dungeon-${d.id}`, regiao: tema.regiao, fases: [{ fala: d.entrada }] }, () => lutaNoLabirinto(monstro));
      }
      lutaNoLabirinto(monstro);
    },
  });
}

function sairDoLabirinto() {
  falarCom("Escada para a superfície", VISUAL_ZETSU, "Subir agora deixa a dungeon pela metade: na próxima vez, o labirinto será outro. Sair mesmo?", [
    { texto: "🪜 Sair da dungeon", acao: () => { corridaLab = null; telaMapa(); } },
  ]);
}

async function abrirBauDoLabirinto(numero) {
  const c = corridaLab;
  if (c.baus.has(numero)) return avisoFlutuante("🧰", "Baú vazio", "Tu já pegaste o que tinha aqui.");
  try {
    const r = await acaoJogador(`dungeons/${c.d.id}/bau`, { bau: numero });
    c.baus.add(numero);
    Som.efeito("moeda");
    chuvaDeEstrelas(14);
    avisoFlutuante("🧰", "Baú aberto!", r.ganhos.map((g) => `${g.icone} ${g.texto}`).join("  "));
    if (r.chave) {
      c.chave = true;
      setTimeout(() => {
        Som.efeito("evolucao");
        avisoFlutuante("🗝️", "A chave do portão!", "Agora o salão do chefão pode ser aberto.");
      }, 700);
    }
  } catch (erro) {
    avisoFlutuante("⚠️", "Não deu", erro.message);
  }
  telaLabirinto();
}

function abrirPortao() {
  const c = corridaLab;
  if (!c.chave) return avisoFlutuante("🔒", "Portão trancado", "A chave está escondida num dos baús do labirinto.");
  const vivos = c.d.salas.length - 1 - [...c.vencidos].filter((v) => v.startsWith("guardiao")).length;
  if (vivos > 0) return avisoFlutuante("⚔️", "O portão não cede", `Ainda há ${vivos} guardião(ões) de pé no labirinto. Vence todos primeiro.`);
  c.portaAberta = true;
  Som.efeito("porta");
  Som.efeito("rugido");
  avisoFlutuante("🔓", "O portão se abre!", "Um rugido ecoa do fundo do salão...");
  telaLabirinto();
}

// A luta com um monstro do labirinto, no palco de sempre: guardiões e o chefão fazem as perguntas da sala
// deles (errou, a pergunta volta para o fim da fila); o errante faz uma pergunta solta. O servidor corrige
// e tira vida a cada erro. Vencer volta para o labirinto (ou, no chefão, para a vitória da dungeon).
async function lutaNoLabirinto(monstro) {
  const c = corridaLab;
  const { d } = c;
  Som.musica(monstro.chefe ? "chefao" : "batalha");
  window.scrollTo(0, 0);
  const sala = d.salas[monstro.sala ?? Math.floor(Math.random() * (d.salas.length - 1))];
  const salaIndice = d.salas.indexOf(sala);
  // a luta usa o mesmo palco da batalha do Reino (classe "encontro"): arena alta com o salão da masmorra
  // ao fundo (arena.js), o cartão da pergunta entre os lutadores e a placa do monstro em cima da vida dele
  const secao = criar(`
    <section class="dungeon encontro luta-masmorra ${monstro.chefe ? "chefao" : ""}">
      <div class="hud-dungeon">
        <h2><small>${escapar(d.nome)}</small>${monstro.chefe ? "👑" : monstro.extra ? "👁️" : "⚔️"} ${escapar(monstro.extra ? monstro.nome : sala.inimigo.nome)}</h2>
        <div class="vidas" data-vidas></div>
      </div>
      <div data-palco></div>
    </section>`);
  const areaVidas = secao.querySelector("[data-vidas]");
  const desenharVidas = () => { areaVidas.innerHTML = coracoesHtml(); };
  tela.replaceChildren(secao);
  desenharVidas();
  const retrato = `
    <div class="inimigo ${monstro.chefe ? "chefe" : ""}">
      <img class="pixel corpo-inimigo" src="${monstro.sprite.toDataURL()}" alt="">
      <div class="vida-inimigo"><div></div></div>
    </div>`;
  const palco = criarZetsu({ nome: monstro.extra ? monstro.nome : sala.inimigo.nome, retrato, voz: monstro.chefe ? 0.6 : 1.1 });
  palco.elemento.classList.add("palco-dungeon");
  const arena = palco.elemento.querySelector(".dialogo");
  arena.style.setProperty("--arte-cenario", `url(${arenaDaRegiao(`masmorra:${d.id}`, { chefe: monstro.chefe })})`);
  arena.prepend(palco.elemento.querySelector(".quadro"));
  secao.querySelector("[data-palco]").replaceWith(palco.elemento);
  const inimigo = palco.elemento.querySelector(".inimigo");
  const placa = secao.querySelector(".hud-dungeon h2");
  placa.classList.add("placa-inimigo");
  inimigo.querySelector(".vida-inimigo").before(placa);
  const barraVida = palco.elemento.querySelector(".vida-inimigo div");
  const avatarJogador = palco.elemento.querySelector(".ator-jogador");
  const corpoInimigo = inimigo.querySelector(".corpo-inimigo");
  const heroiEl = avatarJogador.querySelector("img");
  animarArena(palco.elemento, heroiEl, corpoInimigo, { tipoId: monstro.tipoId, chefe: monstro.chefe, sprite: monstro.sprite, quadros: monstro.quadros });
  setTimeout(() => typeof auraNaBatalha === "function" && auraNaBatalha(avatarJogador, progresso.avatar), 400);
  const fx = criarFxBatalha(palco.elemento);
  const kit = escolhasCompletas(progresso.avatar).kit;
  palco.mostrarCena({ tipo: "destaque", titulo: monstro.extra ? "Uma sombra te alcança!" : sala.titulo, icone: monstro.chefe ? "👑" : "⚔️", efeito: monstro.chefe ? "CHEFÃO!" : "!!", texto: `**${monstro.extra ? monstro.nome : sala.inimigo.nome}** bloqueia o caminho!` });
  palco.dizer(monstro.chefe ? d.entrada : sortear(PROVOCACOES));
  await palco.escolher([{ texto: monstro.chefe ? "Vem, chefão! ⚔️" : "Em guarda! ⚔️" }], { silencioso: true });
  // o errante faz uma pergunta só; guardiões e chefão, todas as da sala
  const indices = monstro.extra ? [Math.floor(Math.random() * sala.perguntas.length)] : sala.perguntas.map((_, k) => k);
  const fila = [...indices];
  const total = indices.length;
  let vida = total;
  while (fila.length) {
    if (!tela.contains(secao)) return;
    const k = fila.shift();
    const pergunta = sala.perguntas[k];
    if (pergunta.codigo) palco.mostrarCena({ tipo: "codigo", titulo: "O feitiço do inimigo", codigo: pergunta.codigo });
    else palco.esconderCena();
    palco.dizer(pergunta.pergunta);
    const promessa = palco.escolher(pergunta.opcoes.map((o) => ({ texto: o })));
    let usouPocao = false;
    const montarItens = () => palco.definirItens([
      { icone: iconeDoItem("pocao", "🧪"), nome: "Poção da Clareza: some com 2 respostas erradas", quantidade: usouPocao ? 0 : quantidade("pocao"),
        usar: async () => {
          if (usouPocao || !(await gastarItem("pocao"))) return;
          usouPocao = true;
          palco.removerOpcoes((await api(`/api/dungeons/${d.id}/pocao`, { sala: salaIndice, pergunta: k })).remover);
          montarItens();
        } },
      { icone: iconeDoItem("pergaminho", "📜"), nome: "Pergaminho do Sábio: mostra uma dica", quantidade: quantidade("pergaminho"),
        usar: async () => {
          if (!(await gastarItem("pergaminho"))) return;
          const r = await api(`/api/dungeons/${d.id}/pergaminho`, { sala: salaIndice, pergunta: k });
          palco.mostrarCena({ tipo: "destaque", titulo: "Sussurro do Zetsu", icone: "📜", texto: r.dica });
          montarItens();
        } },
      { icone: "❤️", nome: "Elixir de Vida: recupera 2 corações", quantidade: vidaAtual() < vidaMaxima() ? quantidade("elixir") : 0,
        usar: async () => {
          if (vidaAtual() >= vidaMaxima() || !(await gastarItem("elixir"))) return;
          desenharVidas();
          montarItens();
        } },
    ]);
    montarItens();
    const escolhida = await promessa;
    palco.definirItens([]);
    const r = await acaoJogador(`dungeons/${d.id}/responder`, { sala: salaIndice, pergunta: k, resposta: escolhida, extra: Boolean(monstro.extra) });
    palco.marcarResposta(r.correta);
    if (r.correta) {
      vida -= 1;
      if (kit !== "guerreiro") animar(avatarJogador, "atacando");
      await fx.ataque(kit, heroiEl, corpoInimigo, { cor: progresso.avatar?.magia || "#6ef0ff" });
      animar(inimigo, "atingido");
      barraVida.style.width = `${(vida / total) * 100}%`;
      fx.numero(corpoInimigo, "−1");
      palco.mostrarCena({ tipo: "destaque", titulo: "Golpe certeiro!", icone: "⚔️", efeito: "POW!", texto: r.explicacao });
      palco.dizer(sortear(DOR), { manterJogador: true });
    } else {
      fila.push(k);
      animar(inimigo, "atacando");
      animar(document.body, "tremor");
      fx.golpeNoHeroi(heroiEl, 1);
      desenharVidas();
      palco.mostrarCena({ tipo: "destaque", titulo: "Tu foste atingido!", icone: "💥", efeito: "OUCH!", texto: `A certa era: **${pergunta.opcoes[r.resposta_certa]}**. ${r.explicacao}` });
      palco.dizer(sortear(RISADA), { manterJogador: true });
      if (r.desmaiou) {
        Som.efeito("derrota");
        await palco.escolher([{ texto: "Argh... não..." }], { silencioso: true });
        corridaLab = null;
        return telaDesmaio(`${monstro.nome} te venceu no labirinto da ${d.nome}.`, r.perda);
      }
    }
    await palco.escolher([{ texto: fila.length ? "Próximo ataque! ⚔️" : "Golpe final!" }], { silencioso: true });
  }
  fx.morte(corpoInimigo);
  await new Promise((resolver) => setTimeout(resolver, 400));
  Som.efeito(monstro.chefe ? "vitoria" : "moeda");
  c.vencidos.add(monstro.id);
  palco.esconderCena();
  palco.dizer(monstro.chefe ? d.vitoria : sortear(QUEDA));
  await palco.escolher([{ texto: monstro.chefe ? "VITÓRIA! 🏆" : "Voltar ao labirinto ▸" }], { silencioso: true });
  if (monstro.chefe) {
    // o resumo da corrida vai para a tela de vitória (o placar da masmorra)
    const corrida = {
      tema: TEMAS_LABIRINTO[d.id], chefe: monstro.nome,
      guardioes: [...c.vencidos].filter((id) => id.startsWith("guardiao")).length,
      errantes: [...c.vencidos].filter((id) => id.startsWith("errante")).length,
      baus: c.baus.size, totalBaus: c.lab.baus.length,
    };
    corridaLab = null;
    return telaVitoriaDungeon(d, corrida);
  }
  telaLabirinto();
}
