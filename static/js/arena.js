// O cenário de fundo da batalha em pixel art (384 x 144), que muda com a região do monstro: os campos,
// a floresta, o pântano, o deserto e as montanhas do Reino, e as seis regiões de Umbraterra. Em camadas,
// como nos cenários de RPG: céu em faixas (com xadrez na passagem de uma cor para a outra), montanhas ao
// longe, a vegetação da região, o chão com textura e uma clareira mais clara no meio, onde os lutadores
// ficam. Tudo gerado por código com um sorteio fixo por região (a mesma região, sempre o mesmo fundo).
// arenaDaRegiao(regiao, { chefe }) devolve a imagem (data URL) pronta para o CSS.
// Tudo fica dentro de um escopo próprio (só arenaDaRegiao sai): os nomes das peças (pinheiro,
// ceuEmFaixas...) já existem em outros arquivos do jogo.

const arenaDaRegiao = (() => {
const ARENA_L = 384;
const ARENA_A = 144;
const ARENA_HORIZONTE = 84;

function sorteioFixo(texto) {
  let s = [...texto].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ruído suave (soma de senos com fases sorteadas), de -1 a 1
function ruidoArena(rnd, oitavas = 3, escala = 1) {
  const ondas = Array.from({ length: oitavas }, (_, i) => ({ f: (0.012 + rnd() * 0.02) * (i + 1) * 1.8 * escala, fase: rnd() * 100, a: 1 / (i + 1) }));
  const soma = ondas.reduce((s, o) => s + o.a, 0);
  return (x) => ondas.reduce((s, o) => s + Math.sin(x * o.f + o.fase) * o.a, 0) / soma;
}

function pintor(ctx) {
  const px = (x, y, cor) => {
    ctx.fillStyle = cor;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  const ret = (x, y, w, h, cor) => {
    ctx.fillStyle = cor;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  const bola = (cx, cy, r, cor, achatar = 1) => {
    ctx.fillStyle = cor;
    for (let dy = -Math.ceil(r * achatar); dy <= Math.ceil(r * achatar); dy++) {
      const meia = Math.round(Math.sqrt(Math.max(0, r * r - (dy / achatar) ** 2)));
      ctx.fillRect(Math.round(cx - meia), Math.round(cy + dy), meia * 2 + 1, 1);
    }
  };
  const transparente = (alfa, desenho) => {
    ctx.save();
    ctx.globalAlpha = alfa;
    desenho();
    ctx.restore();
  };
  return { ctx, px, ret, bola, transparente };
}

// ---------- peças do cenário ----------

function ceuEmFaixas({ ctx }, cores, ate = ARENA_HORIZONTE + 4) {
  const faixa = ate / cores.length;
  for (let y = 0; y < ate; y++) {
    const i = Math.min(cores.length - 1, Math.floor(y / faixa));
    ctx.fillStyle = cores[i];
    ctx.fillRect(0, y, ARENA_L, 1);
    // nas duas últimas linhas da faixa, a próxima cor entra em xadrez
    if (i < cores.length - 1 && y - i * faixa > faixa - 3) {
      ctx.fillStyle = cores[i + 1];
      for (let x = (y % 2); x < ARENA_L; x += 2) ctx.fillRect(x, y, 1, 1);
    }
  }
}

function estrelasArena(p, rnd, n, cores = ["#ffffff", "#c8d4ff", "#fff3b0"]) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * ARENA_L;
    const y = rnd() * (ARENA_HORIZONTE - 20);
    const cor = cores[i % cores.length];
    p.px(x, y, cor);
    if (i % 9 === 0) { p.px(x - 1, y, cor); p.px(x + 1, y, cor); p.px(x, y - 1, cor); p.px(x, y + 1, cor); }
  }
}

function astro(p, x, y, r, cor, halo) {
  p.transparente(0.18, () => p.bola(x, y, r * 2.4, halo));
  p.transparente(0.3, () => p.bola(x, y, r * 1.6, halo));
  p.bola(x, y, r, cor);
}

function nuvem(p, x, y, w, cor, sombra) {
  const partes = [[0, 0, w * 0.22], [w * 0.22, -w * 0.08, w * 0.26], [w * 0.5, -w * 0.02, w * 0.2], [w * 0.7, 0.02 * w, w * 0.16]];
  partes.forEach(([dx, dy, r]) => p.bola(x + dx, y + dy + 1, r, sombra, 0.55));
  partes.forEach(([dx, dy, r]) => p.bola(x + dx, y + dy, r, cor, 0.55));
}

// uma cordilheira de picos (montanhas, vulcão, espinhos): o lado esquerdo de cada pico pega luz
function picos(p, rnd, { base, n, altMin, altMax, larg, cor, luz = null, neve = null, xs = null }) {
  const lista = Array.from({ length: n }, (_, i) => ({
    x: xs ? xs[i] : rnd() * ARENA_L, h: altMin + rnd() * (altMax - altMin), w: larg * (0.7 + rnd() * 0.6),
  }));
  const aspereza = ruidoArena(rnd, 2, 4);
  for (let x = 0; x < ARENA_L; x++) {
    let melhor = null;
    let alto = 0;
    lista.forEach((pico) => {
      const h = pico.h * (1 - Math.abs(x - pico.x) / pico.w);
      if (h > alto) { alto = h; melhor = pico; }
    });
    if (!melhor) continue;
    alto += aspereza(x) * 1.5;
    const topo = Math.round(base - alto);
    p.ret(x, topo, 1, base - topo + 2, luz && x < melhor.x ? luz : cor);
    if (neve && alto > melhor.h * 0.6) p.ret(x, topo, 1, Math.max(1, Math.round((alto - melhor.h * 0.6) * 0.8 + (x % 3))), neve);
  }
}

// morros suaves (colinas, dunas)
function morros(p, rnd, { base, alt, cor, luz = null }) {
  const n = ruidoArena(rnd, 3);
  let antes = 0;
  for (let x = 0; x < ARENA_L; x++) {
    const v = n(x);
    const topo = Math.round(base - alt * (v + 1) / 2);
    p.ret(x, topo, 1, ARENA_A - topo, luz && v > antes ? luz : cor);
    antes = v;
  }
}

function pinheiro(p, x, base, alt, escuro, claro, tronco = "#3a2416") {
  p.ret(x - 1, base - alt * 0.18, 2, alt * 0.18, tronco);
  for (let camada = 0; camada < 3; camada++) {
    const topo = base - alt + camada * alt * 0.24;
    const altura = alt * 0.42;
    for (let y = 0; y < altura; y++) {
      const meia = Math.round((y / altura) * alt * (0.2 + camada * 0.05));
      p.ret(x - meia, topo + y, meia, 1, claro);
      p.ret(x, topo + y, meia + 1, 1, escuro);
    }
  }
}

function arvoreRedonda(p, x, base, r, [claro, medio, escuro], tronco = "#4a2e1a") {
  p.ret(x - 1, base - r * 1.2, 3, r * 1.2, tronco);
  p.bola(x + r * 0.2, base - r * 1.6, r, escuro);
  p.bola(x, base - r * 1.7, r * 0.9, medio);
  p.bola(x - r * 0.3, base - r * 2, r * 0.45, claro);
}

function arvoreMorta(p, rnd, x, base, alt, cor) {
  p.ret(x, base - alt, 2, alt, cor);
  for (let i = 0; i < 4; i++) {
    const y = base - alt * (0.45 + rnd() * 0.5);
    const lado = i % 2 ? 1 : -1;
    const comp = 4 + rnd() * 7;
    for (let k = 0; k < comp; k++) p.px(x + (lado > 0 ? 2 : -1) + lado * k, y - k * 0.6, cor);
  }
}

function cristal(p, x, base, alt, larg, [claro, escuro, brilho]) {
  for (let y = 0; y < alt; y++) {
    const meia = Math.max(0, Math.round(larg * Math.min(1, (y + 1) / (alt * 0.3))));
    p.ret(x - meia, base - alt + y, meia, 1, claro);
    p.ret(x, base - alt + y, meia + 1, 1, escuro);
  }
  p.ret(x - 1, base - alt + 3, 1, alt * 0.5, brilho);
}

function cacto(p, x, base, alt, [claro, escuro]) {
  p.ret(x - 2, base - alt, 2, alt, claro);
  p.ret(x, base - alt, 2, alt, escuro);
  p.ret(x - 6, base - alt * 0.6, 2, alt * 0.3, claro);
  p.ret(x - 6, base - alt * 0.32, 5, 2, claro);
  p.ret(x + 4, base - alt * 0.75, 2, alt * 0.35, escuro);
  p.ret(x + 1, base - alt * 0.42, 5, 2, escuro);
}

function chaoEmFaixas(p, cores) {
  const altura = ARENA_A - ARENA_HORIZONTE;
  for (let y = ARENA_HORIZONTE; y < ARENA_A; y++) {
    const t = (y - ARENA_HORIZONTE) / altura;
    const i = Math.min(cores.length - 1, Math.floor(t * cores.length));
    p.ret(0, y, ARENA_L, 1, cores[i]);
    if (i < cores.length - 1 && t * cores.length - i > 0.82) {
      p.ctx.fillStyle = cores[i + 1];
      for (let x = y % 2; x < ARENA_L; x += 2) p.ctx.fillRect(x, y, 1, 1);
    }
  }
}

// a clareira onde os lutadores pisam: um oval mais claro no chão
function clareira(p, cor, alfa = 0.22) {
  // três ovais sobrepostos, cada um mais fraco: a luz some aos poucos, sem borda dura
  [[160, 0.13], [125, 0.11], [90, 0.09]].forEach(([r, achatar]) => p.transparente(alfa * 0.45, () => p.bola(ARENA_L / 2, 122, r, cor, achatar)));
}

// tufos, pedrinhas, flores... espalhados no chão (mais densos e maiores perto da frente)
function salpicar(p, rnd, n, desenho) {
  for (let i = 0; i < n; i++) {
    const y = ARENA_HORIZONTE + 2 + Math.pow(rnd(), 0.8) * (ARENA_A - ARENA_HORIZONTE - 3);
    const perto = (y - ARENA_HORIZONTE) / (ARENA_A - ARENA_HORIZONTE);
    desenho(rnd() * ARENA_L, y, perto, i);
  }
}

function tufo(p, x, y, perto, claro, escuro) {
  const h = 1 + Math.round(perto * 3);
  p.ret(x, y - h, 1, h, claro);
  p.ret(x + 1, y - h + 1, 1, h - 1, escuro);
  if (perto > 0.5) p.ret(x - 1, y - h + 1, 1, h - 1, escuro);
}

function nevoa(p, rnd, cor, y, alt, alfa) {
  const n = ruidoArena(rnd, 2);
  p.transparente(alfa, () => {
    for (let x = 0; x < ARENA_L; x++) {
      const h = Math.round(alt * (0.6 + 0.4 * n(x)));
      p.ret(x, y - h / 2, 1, h, cor);
    }
  });
}

// moldura da frente: arbustos ou pedras nos cantos de baixo, para dar profundidade
function cantosDaFrente(p, rnd, [claro, escuro]) {
  [[0, 1], [ARENA_L, -1]].forEach(([x0, lado]) => {
    for (let i = 0; i < 5; i++) {
      const x = x0 + lado * (6 + i * 9 + rnd() * 4);
      const r = 9 - i * 1.2 + rnd() * 3;
      p.bola(x, ARENA_A - 2 + i * 0.5, r, escuro, 0.8);
      p.bola(x - lado * 1.5, ARENA_A - 4 + i * 0.5, r * 0.7, claro, 0.8);
    }
  });
}

// ---------- as regiões ----------

const CENAS_ARENA = {
  campos(p, rnd) {
    ceuEmFaixas(p, ["#3f7fd6", "#5596e4", "#77b0ee", "#9fcaf4", "#cbe5f8"]);
    astro(p, 330, 20, 9, "#fff3b0", "#fff9d8");
    [[40, 22, 46], [150, 14, 38], [250, 30, 30], [90, 40, 24]].forEach(([x, y, w]) => nuvem(p, x, y, w, "#ffffff", "#c8dcf0"));
    picos(p, rnd, { base: ARENA_HORIZONTE, n: 6, altMin: 12, altMax: 26, larg: 60, cor: "#8cb4cc", luz: "#a8c8dc" });
    morros(p, rnd, { base: ARENA_HORIZONTE + 2, alt: 14, cor: "#4f9a50", luz: "#62ad5c" });
    for (let i = 0; i < 9; i++) arvoreRedonda(p, 20 + i * 42 + rnd() * 16, ARENA_HORIZONTE - 2 + rnd() * 4, 3 + rnd() * 2, ["#8ad070", "#4f9a46", "#2f6e2e"]);
    chaoEmFaixas(p, ["#7ccc5a", "#6cbf4c", "#5aae43", "#4c9c3a", "#3f8a32"]);
    // a trilha de terra que vem do horizonte
    for (let y = ARENA_HORIZONTE; y < ARENA_A; y++) {
      const t = (y - ARENA_HORIZONTE) / (ARENA_A - ARENA_HORIZONTE);
      const meia = 4 + t * 46;
      p.ret(ARENA_L / 2 - meia + Math.sin(t * 3) * 10, y, meia * 2, 1, t > 0.5 ? "#c9a468" : "#d9b77a");
    }
    clareira(p, "#fff3b0", 0.14);
    salpicar(p, rnd, 260, (x, y, perto) => tufo(p, x, y, perto, "#9ae070", "#3a7a2e"));
    salpicar(p, rnd, 50, (x, y, perto, i) => p.px(x, y - 1, ["#ff6b7a", "#ffd166", "#ffffff", "#b38cff"][i % 4]));
    cantosDaFrente(p, rnd, ["#4f9a46", "#2f6e2e"]);
  },
  floresta(p, rnd) {
    ceuEmFaixas(p, ["#1f3d2e", "#2a5038", "#3f6e46", "#6f9a5a", "#c8d08a"]);
    for (let i = 0; i < 34; i++) pinheiro(p, i * 12 + rnd() * 8, ARENA_HORIZONTE + 2, 26 + rnd() * 18, "#25443a", "#2f5546");
    for (let i = 0; i < 22; i++) pinheiro(p, i * 18 + rnd() * 10, ARENA_HORIZONTE + 6, 34 + rnd() * 20, "#1a3428", "#24432f");
    // raios de luz entre as copas
    p.transparente(0.1, () => {
      for (let r = 0; r < 4; r++) {
        const x0 = 60 + r * 90 + rnd() * 30;
        for (let y = 0; y < ARENA_A; y++) p.ret(x0 + y * 0.5, y, 10 + r * 2, 1, "#fff3b0");
      }
    });
    chaoEmFaixas(p, ["#5a8a3a", "#4c7c32", "#406c2a", "#355c23", "#2b4c1c"]);
    clareira(p, "#e8f0a0", 0.16);
    salpicar(p, rnd, 240, (x, y, perto) => tufo(p, x, y, perto, "#7aa84a", "#2a4a1c"));
    salpicar(p, rnd, 14, (x, y, perto) => {
      const r = 1 + Math.round(perto * 2);
      p.ret(x, y - r, 1, r, "#e8e0c8");
      p.bola(x, y - r - 1, r, "#d9304a", 0.6);
      p.px(x - Math.max(0, r - 1), y - r - 1, "#ffffff");
    });
    // troncos grossos nas bordas
    [[0, 16], [ARENA_L - 14, 14]].forEach(([x, w]) => {
      p.ret(x, 0, w, ARENA_A, "#2a1a10");
      p.ret(x + (x ? 2 : w - 4), 0, 2, ARENA_A, "#4a2e1a");
    });
    cantosDaFrente(p, rnd, ["#3f6e2a", "#1f3a16"]);
  },
  pantano(p, rnd) {
    ceuEmFaixas(p, ["#2a3530", "#36463c", "#4a5e4c", "#6a8066", "#98a88a"]);
    astro(p, 90, 26, 7, "#e0e8c8", "#c8d4b0");
    morros(p, rnd, { base: ARENA_HORIZONTE, alt: 12, cor: "#3a4a3c" });
    for (let i = 0; i < 9; i++) arvoreMorta(p, rnd, 10 + i * 44 + rnd() * 20, ARENA_HORIZONTE + 2, 22 + rnd() * 22, "#1e241c");
    chaoEmFaixas(p, ["#4a5a38", "#404f30", "#36442a", "#2d3a23", "#25301c"]);
    salpicar(p, rnd, 12, (x, y, perto) => {
      const w = 8 + perto * 28;
      p.bola(x, y, w, "#3e5e52", 0.18);
      p.ret(x - w * 0.4, y - 1, w * 0.5, 1, "#8fb0a0");
    });
    nevoa(p, rnd, "#c8d4c0", ARENA_HORIZONTE + 2, 12, 0.28);
    clareira(p, "#c8d4a0", 0.12);
    salpicar(p, rnd, 70, (x, y, perto) => {
      const h = 3 + perto * 9;
      p.ret(x, y - h, 1, h, "#6a7a32");
      p.ret(x, y - h - 2, 1, 3, "#6a4a2a");
    });
    nevoa(p, rnd, "#d8e2d0", ARENA_A - 10, 10, 0.18);
    cantosDaFrente(p, rnd, ["#4a5a32", "#2a3420"]);
  },
  deserto(p, rnd) {
    ceuEmFaixas(p, ["#e8904a", "#f0a858", "#f5c072", "#f9d896", "#fcecc4"]);
    astro(p, 300, 46, 15, "#fff6d0", "#ffe8a0");
    morros(p, rnd, { base: ARENA_HORIZONTE, alt: 16, cor: "#e2a868", luz: "#eebe80" });
    // colunas em ruínas
    [[70, 30], [96, 18], [290, 24]].forEach(([x, h]) => {
      p.ret(x, ARENA_HORIZONTE - h, 6, h, "#c8a070");
      p.ret(x + 4, ARENA_HORIZONTE - h, 2, h, "#a07848");
      p.ret(x - 1, ARENA_HORIZONTE - h, 8, 2, "#d8b488");
    });
    morros(p, rnd, { base: ARENA_HORIZONTE + 6, alt: 10, cor: "#d99a58", luz: "#e8b878" });
    chaoEmFaixas(p, ["#f2cf88", "#ebc47c", "#e2b870", "#d8ab64", "#cc9e58"]);
    clareira(p, "#fff3c8", 0.16);
    salpicar(p, rnd, 150, (x, y, perto) => {
      const w = 2 + perto * 6;
      p.ret(x, y, w, 1, "#c8955a");
      p.ret(x + 1, y - 1, w - 1, 1, "#f8e0a8");
    });
    [[30, 112, 22], [350, 126, 30], [140, 92, 10]].forEach(([x, y, h]) => cacto(p, x, y, h, ["#5a9a4a", "#3a6e34"]));
    salpicar(p, rnd, 6, (x, y) => { p.ret(x, y - 1, 4, 1, "#f4f0e0"); p.px(x - 1, y - 2, "#f4f0e0"); p.px(x + 4, y - 2, "#f4f0e0"); });
    cantosDaFrente(p, rnd, ["#d8a860", "#b8884a"]);
  },
  montanhas(p, rnd) {
    ceuEmFaixas(p, ["#5a78c0", "#7290d0", "#92aee0", "#b8cdec", "#e0ebf8"]);
    picos(p, rnd, { base: ARENA_HORIZONTE, n: 5, altMin: 34, altMax: 58, larg: 70, cor: "#9aaccc", luz: "#bccae0", neve: "#ffffff" });
    picos(p, rnd, { base: ARENA_HORIZONTE + 2, n: 7, altMin: 16, altMax: 32, larg: 44, cor: "#6a7aa0", luz: "#8494b8", neve: "#eef4ff" });
    for (let i = 0; i < 18; i++) pinheiro(p, i * 22 + rnd() * 12, ARENA_HORIZONTE + 3, 12 + rnd() * 10, "#2a4848", "#355a58");
    chaoEmFaixas(p, ["#f2f6ff", "#e4ecf8", "#d6e0f2", "#c8d4ea", "#bac8e2"]);
    clareira(p, "#ffffff", 0.2);
    salpicar(p, rnd, 18, (x, y, perto) => {
      const r = 2 + perto * 5;
      p.bola(x, y, r, "#5a6478", 0.6);
      p.bola(x - 1, y - 1, r * 0.7, "#7a8498", 0.6);
      p.ret(x - r * 0.6, y - r * 0.6, r, 1, "#ffffff");
    });
    salpicar(p, rnd, 60, (x, y) => p.px(x, y, "#a8b8d8"));
    for (let i = 0; i < 70; i++) p.px(rnd() * ARENA_L, rnd() * ARENA_A, "#ffffff");
    cantosDaFrente(p, rnd, ["#e4ecf8", "#a8b6d0"]);
  },
  fenda(p, rnd) {
    ceuEmFaixas(p, ["#0a0614", "#140a24", "#22103a", "#341a52", "#4a2470"]);
    estrelasArena(p, rnd, 70);
    // a fenda rasgando o céu
    let x = 250;
    for (let y = 4; y < 72; y++) {
      x += (rnd() - 0.5) * 3;
      const w = 2 + Math.sin(y / 10) * 1.5;
      p.transparente(0.25, () => p.ret(x - w * 4, y, w * 8, 1, "#a98bff"));
      p.ret(x - w, y, w * 2, 1, "#c08bff");
      p.ret(x - w / 3, y, Math.max(1, w * 0.6), 1, "#ffffff");
    }
    picos(p, rnd, { base: ARENA_HORIZONTE, n: 8, altMin: 10, altMax: 30, larg: 30, cor: "#1c1030", luz: "#2a1848" });
    [[60, 30, 7], [140, 46, 5], [330, 40, 6]].forEach(([fx, fy, r]) => { p.bola(fx, fy, r, "#2a1840", 0.6); p.ret(fx - r, fy - r * 0.6, r * 2, 1, "#8a5ad8"); });
    chaoEmFaixas(p, ["#2e1e40", "#261836", "#1e122c", "#170e23", "#120a1c"]);
    clareira(p, "#a98bff", 0.12);
    salpicar(p, rnd, 22, (cx, cy, perto) => {
      let lx = cx;
      for (let k = 0; k < 6 + perto * 14; k++) { lx += rnd() > 0.5 ? 1 : -1; p.px(lx + k, cy + (k % 3 === 0 ? 1 : 0), "#8a5ad8"); }
    });
    cantosDaFrente(p, rnd, ["#2a1a3a", "#120a1c"]);
  },
  cinzas(p, rnd) {
    ceuEmFaixas(p, ["#120404", "#240806", "#3e100a", "#6a2210", "#a03e18"]);
    picos(p, rnd, { base: ARENA_HORIZONTE, n: 1, altMin: 56, altMax: 60, larg: 120, cor: "#2a1410", luz: "#3a1c14", xs: [120] });
    p.transparente(0.35, () => p.bola(120, 30, 18, "#ff7a1a", 0.7));
    p.ret(114, 26, 12, 3, "#ffb347");
    for (let y = 29; y < ARENA_HORIZONTE; y++) p.ret(118 + Math.sin(y / 5) * 3 + (y - 29) * 0.3, y, 2, 1, y % 4 ? "#ff7a1a" : "#ffd166");
    picos(p, rnd, { base: ARENA_HORIZONTE + 2, n: 8, altMin: 8, altMax: 20, larg: 30, cor: "#1a0c0a" });
    chaoEmFaixas(p, ["#2e1c16", "#261510", "#1e100c", "#170c09", "#120907"]);
    // rios de lava
    for (let r = 0; r < 2; r++) {
      let y = ARENA_HORIZONTE + 12 + r * 26;
      for (let x2 = 0; x2 < ARENA_L; x2++) {
        y += Math.sin(x2 / 31 + r * 2) * 0.3;
        p.transparente(0.16, () => p.ret(x2, y - 2, 1, 5 + r, "#ff7a1a"));
        p.ret(x2, y, 1, 1 + r, "#e0581a");
        if (x2 % 4 === 0) p.px(x2, y, "#ffd166");
      }
    }
    clareira(p, "#ff9a5a", 0.1);
    for (let i = 0; i < 60; i++) p.px(rnd() * ARENA_L, rnd() * ARENA_A, i % 3 ? "#ff9a3c" : "#ffd166");
    cantosDaFrente(p, rnd, ["#2a1410", "#120907"]);
  },
  cristais(p, rnd) {
    ceuEmFaixas(p, ["#060a1c", "#0c1430", "#142048", "#1e2e62", "#2a3e7a"]);
    estrelasArena(p, rnd, 50, ["#6ef0ff", "#ffffff", "#ff9fe0"]);
    const cores = [["#6ef0ff", "#2e7bd0", "#e6fdff"], ["#ff7ad9", "#a8329a", "#ffe0f6"], ["#a98bff", "#5a3aa6", "#efe6ff"]];
    for (let i = 0; i < 12; i++) {
      const c = cores[i % 3];
      p.transparente(0.2, () => p.bola(15 + i * 32, ARENA_HORIZONTE - 14, 14, c[0]));
      cristal(p, 15 + i * 32 + rnd() * 12, ARENA_HORIZONTE + 2, 18 + rnd() * 36, 3 + rnd() * 3, c);
    }
    chaoEmFaixas(p, ["#2e3a62", "#263254", "#1e2846", "#182038", "#121a2e"]);
    clareira(p, "#6ef0ff", 0.12);
    salpicar(p, rnd, 26, (x, y, perto, i) => cristal(p, x, y, 3 + perto * 9, 1 + perto * 2, cores[i % 3]));
    cantosDaFrente(p, rnd, ["#2a3a6a", "#121a2e"]);
  },
  abismo(p, rnd) {
    ceuEmFaixas(p, ["#02060c", "#04101c", "#06182a", "#0a243a", "#0e3048"]);
    estrelasArena(p, rnd, 30, ["#2ad0c0", "#8af0e0"]);
    for (let i = 0; i < 10; i++) {
      const x = 10 + i * 40 + rnd() * 16;
      const h = 30 + rnd() * 30;
      for (let y = 0; y < h; y++) p.ret(x + Math.sin(y / 6 + i) * 3, ARENA_HORIZONTE - y, Math.max(1, 5 - y / 10), 1, "#06141f");
    }
    chaoEmFaixas(p, ["#0f2e3a", "#0b2530", "#091d26", "#07161d", "#051015"]);
    salpicar(p, rnd, 10, (x, y, perto) => {
      const w = 6 + perto * 24;
      p.transparente(0.35, () => p.bola(x, y, w * 1.3, "#2ad0c0", 0.2));
      p.bola(x, y, w, "#0e4a52", 0.2);
      p.ret(x - w * 0.3, y - 1, w * 0.4, 1, "#8af0e0");
    });
    clareira(p, "#2ad0c0", 0.1);
    cantosDaFrente(p, rnd, ["#0a2a30", "#041014"]);
  },
  geleira(p, rnd) {
    ceuEmFaixas(p, ["#08142e", "#0e2048", "#1a3a6a", "#2e5a8e", "#4a7ab0"]);
    estrelasArena(p, rnd, 50);
    // a aurora
    [["#7dffb0", 18, 0.3], ["#6ef0ff", 26, 0.22]].forEach(([cor, y0, alfa], k) => {
      p.transparente(alfa, () => {
        for (let x = 0; x < ARENA_L; x++) {
          const y = y0 + Math.sin(x / 30 + k) * 8;
          p.ret(x, y, 1, 6 + Math.sin(x / 11) * 3, cor);
        }
      });
    });
    picos(p, rnd, { base: ARENA_HORIZONTE, n: 6, altMin: 24, altMax: 48, larg: 50, cor: "#7aa4d0", luz: "#a8c8e8", neve: "#ffffff" });
    for (let i = 0; i < 9; i++) cristal(p, 20 + i * 42 + rnd() * 10, ARENA_HORIZONTE + 3, 10 + rnd() * 16, 2 + rnd() * 2, ["#e6fdff", "#8ab8e0", "#ffffff"]);
    chaoEmFaixas(p, ["#d6ecfa", "#c2dcf2", "#accbea", "#96b8de", "#84a6d2"]);
    salpicar(p, rnd, 30, (x, y, perto) => {
      for (let k = 0; k < 4 + perto * 10; k++) p.px(x + k, y + (k % 2), "#6a98c8");
    });
    clareira(p, "#ffffff", 0.2);
    for (let i = 0; i < 50; i++) p.px(rnd() * ARENA_L, rnd() * ARENA_A, "#ffffff");
    cantosDaFrente(p, rnd, ["#c2dcf2", "#7a9cc8"]);
  },
  trono(p, rnd) {
    ceuEmFaixas(p, ["#06030c", "#0e0618", "#180a26", "#260f36", "#341446"]);
    estrelasArena(p, rnd, 40);
    astro(p, 310, 24, 11, "#ff4d6d", "#a8323e");
    // o castelo do Trono, em silhueta, com janelas acesas
    const castelo = "#0a0510";
    [[120, 40, 16], [150, 58, 20], [184, 46, 16], [210, 34, 14]].forEach(([x, h, w]) => {
      p.ret(x, ARENA_HORIZONTE - h, w, h, castelo);
      for (let y = 0; y < 10; y++) p.ret(x + w / 2 - y * 0.6, ARENA_HORIZONTE - h - 10 + y, y * 1.2 + 1, 1, castelo);
      for (let j = 0; j < 3; j++) if (rnd() > 0.35) p.ret(x + 3 + (j % 2) * (w - 8), ARENA_HORIZONTE - h + 8 + j * 9, 2, 3, "#ffd166");
    });
    p.ret(110, ARENA_HORIZONTE - 18, 124, 18, castelo);
    chaoEmFaixas(p, ["#2e2640", "#261f36", "#1f192d", "#191424", "#140f1d"]);
    // lajotas em perspectiva
    p.transparente(0.5, () => {
      for (let i = -12; i <= 12; i++) {
        for (let y = ARENA_HORIZONTE; y < ARENA_A; y++) {
          const t = (y - ARENA_HORIZONTE) / (ARENA_A - ARENA_HORIZONTE);
          p.px(ARENA_L / 2 + i * (10 + t * 34), y, "#0e0a16");
        }
      }
      [2, 6, 12, 20, 31, 45].forEach((dy) => p.ret(0, ARENA_HORIZONTE + dy, ARENA_L, 1, "#0e0a16"));
    });
    clareira(p, "#ff4d6d", 0.08);
    cantosDaFrente(p, rnd, ["#241c32", "#0e0a16"]);
  },
};
CENAS_ARENA.vale = CENAS_ARENA.campos;

// ---------- as masmorras (o salão de luta dentro de cada dungeon) ----------
// Parede de tijolo com pilares, tochas acesas com halo na cor do tema, um arco escuro no fundo (o corredor
// de onde o monstro veio), estandartes, lajotas em perspectiva com poças de luz embaixo das tochas e a
// decoração de cada dungeon. As cores seguem as do labirinto (TEMAS_LABIRINTO em labirinto.js).
const MASMORRAS = {
  cripta: { parede: "#1e1a2a", tijolo: "#2e2842", topo: "#5b4f73", chao: "#3a3346", chao2: "#2f2a3b", tocha: "#ffaa5a", estandarte: "#5a2a8a" },
  bugs: { parede: "#161e14", tijolo: "#24321f", topo: "#4a6b3a", chao: "#2f3a2a", chao2: "#263022", tocha: "#96ff78", estandarte: "#2f5a22" },
  cofre: { parede: "#22190c", tijolo: "#362811", topo: "#8a6d32", chao: "#4a3a22", chao2: "#3d301c", tocha: "#ffd166", estandarte: "#8a1f2a" },
  forja: { parede: "#1a0d0a", tijolo: "#2c1611", topo: "#7a3a20", chao: "#3a2420", chao2: "#2e1c18", tocha: "#ff7828", estandarte: "#4a1a10" },
  "biblioteca-vazio": { parede: "#120e20", tijolo: "#201a38", topo: "#4a3f7a", chao: "#2a2440", chao2: "#221d36", tocha: "#c08bff", estandarte: "#3a2a6a" },
  cidadela: { parede: "#1a2232", tijolo: "#283550", topo: "#6a84a8", chao: "#3e4a5e", chao2: "#344052", tocha: "#a0dcff", estandarte: "#2a4a7a" },
};

function masmorra(p, rnd, id) {
  const c = MASMORRAS[id] || MASMORRAS.cripta;
  const H = ARENA_HORIZONTE + 6; // a linha onde a parede encontra o chão
  // a parede de tijolos, mais escura no alto
  p.ret(0, 0, ARENA_L, H, c.parede);
  for (let y = 0; y < H; y += 8) {
    const escurece = y < 24 ? 0.6 : y < 48 ? 0.8 : 1;
    for (let x = (y / 8) % 2 ? -8 : 0; x < ARENA_L; x += 16) {
      p.ret(x + 1, y + 1, 14, 6, tom(c.tijolo, escurece * (0.9 + rnd() * 0.25)));
      p.ret(x + 1, y + 1, 14, 1, tom(c.tijolo, escurece * 1.25));
    }
  }
  // o arco escuro do corredor, no meio
  const ax = ARENA_L / 2;
  for (let y = 26; y < H; y++) {
    const meia = y < 44 ? Math.round(Math.sqrt(Math.max(0, 18 * 18 - (44 - y) ** 2))) : 18;
    p.ret(ax - meia - 3, y, meia * 2 + 6, 1, tom(c.topo, 0.8));
    p.ret(ax - meia, y, meia * 2, 1, y > 60 ? "#040208" : "#07040e");
  }
  // estandartes entre os pilares
  [ax - 110, ax + 92].forEach((x) => {
    p.ret(x - 2, 12, 22, 2, "#5c3418");
    for (let y = 14; y < 56; y++) p.ret(x, y, 18 - (y > 48 ? Math.abs(52 - y) * 2 - 0 : 0), 1, y % 12 < 1 ? tom(c.estandarte, 1.4) : c.estandarte);
    p.ret(x + 6, 26, 6, 6, tom(c.tocha, 0.9));
    p.ret(x + 7, 27, 4, 4, tom(c.estandarte, 0.7));
  });
  // pilares com luz do lado esquerdo
  [36, 128, ARENA_L - 128 - 14, ARENA_L - 36 - 14].forEach((x) => {
    p.ret(x, 0, 14, H, tom(c.topo, 0.75));
    p.ret(x, 0, 4, H, tom(c.topo, 1.05));
    p.ret(x + 11, 0, 3, H, tom(c.topo, 0.5));
    p.ret(x - 3, 8, 20, 5, tom(c.topo, 0.95));
    p.ret(x - 3, H - 6, 20, 6, tom(c.topo, 0.85));
    p.ret(x - 3, H - 6, 20, 1, tom(c.topo, 1.2));
  });
  // as tochas, com halo
  [112, ARENA_L - 112].forEach((x) => {
    [[26, 0.1], [18, 0.14], [11, 0.2]].forEach(([r, a]) => p.transparente(a, () => p.bola(x, 38, r, c.tocha)));
    p.ret(x - 1, 40, 3, 8, "#5c3418");
    p.ret(x - 3, 40, 7, 2, "#3a2416");
    p.ret(x - 2, 33, 5, 7, c.tocha);
    p.ret(x - 1, 31, 3, 4, tom(c.tocha, 1.4));
    p.px(x, 30, "#ffffff");
  });
  // o rodapé (sombra onde a parede encontra o chão)
  p.ret(0, H - 2, ARENA_L, 2, "#05030a");
  // o chão de lajotas em perspectiva
  for (let y = H; y < ARENA_A; y++) {
    const t = (y - H) / (ARENA_A - H);
    const linha = Math.floor(Math.pow(t, 0.6) * 6);
    for (let i = -14; i <= 14; i++) {
      const x0 = ax + i * (12 + t * 32);
      const largura = 12 + t * 32;
      p.ret(x0, y, largura, 1, (i + linha) % 2 ? c.chao : c.chao2);
    }
  }
  p.transparente(0.6, () => {
    for (let i = -14; i <= 14; i++) {
      for (let y = H; y < ARENA_A; y++) {
        const t = (y - H) / (ARENA_A - H);
        p.px(ax + i * (12 + t * 32), y, tom(c.chao2, 0.6));
      }
    }
    [0.05, 0.16, 0.32, 0.52, 0.78].forEach((t) => p.ret(0, H + Math.round(Math.pow(t, 1 / 0.6) * (ARENA_A - H)), ARENA_L, 1, tom(c.chao2, 0.6)));
  });
  // poças de luz das tochas no chão e a clareira do meio
  [112, ARENA_L - 112].forEach((x) => p.transparente(0.14, () => p.bola(x, H + 10, 40, c.tocha, 0.25)));
  clareira(p, c.tocha, 0.12);
  // a decoração de cada dungeon
  if (id === "cripta") {
    [[0, 1], [ARENA_L, -1]].forEach(([x0, lado]) => {
      for (let k = 0; k < 14; k++) p.px(x0 + lado * k, k, "#8a84a6");
      for (let k = 0; k < 10; k++) p.px(x0 + lado * (k + 4), 0 + Math.round(k * 0.4), "#8a84a6");
      for (let k = 0; k < 10; k++) p.px(x0 + lado * 2, k + 2, "#6a6486");
    });
    [[60, 120], [300, 126], [150, 104]].forEach(([x, y]) => {
      p.bola(x, y, 3, "#d8d0c0");
      p.px(x - 1, y, "#1e1a2a"); p.px(x + 1, y, "#1e1a2a");
      p.ret(x - 6, y + 3, 12, 1, "#c8c0b0");
    });
    nevoa(p, rnd, "#8a6ac0", ARENA_A - 8, 10, 0.16);
  }
  if (id === "bugs") {
    for (let i = 0; i < 26; i++) {
      const x = rnd() * ARENA_L;
      const y = rnd() * (H - 10);
      p.transparente(0.7, () => p.bola(x, y, 2 + rnd() * 4, "#3f6e2a", 0.6));
    }
    for (let i = 0; i < 8; i++) {
      const x = 20 + rnd() * (ARENA_L - 40);
      for (let y = 0; y < 14 + rnd() * 26; y++) p.px(x + Math.sin(y / 4) * 1.5, y, y % 5 ? "#4f8a2e" : "#78c25e");
    }
    [[52, 128], [330, 120], [120, 110], [270, 104]].forEach(([x, y]) => {
      p.transparente(0.3, () => p.bola(x, y - 3, 8, "#96ff78"));
      p.ret(x, y - 3, 1, 4, "#e8e0c8");
      p.bola(x, y - 4, 3, "#7dff9a", 0.6);
    });
  }
  if (id === "cofre") {
    [[40, ARENA_A - 6, 26], [ARENA_L - 40, ARENA_A - 4, 30]].forEach(([x, y, r]) => {
      p.bola(x, y, r, "#c9952a", 0.45);
      p.bola(x - 2, y - 2, r * 0.75, "#f5c451", 0.45);
      for (let k = 0; k < 12; k++) p.px(x - r * 0.6 + rnd() * r * 1.2, y - r * 0.4 + rnd() * r * 0.3, "#fff3b0");
    });
    salpicar(p, rnd, 30, (x, y) => { p.ret(x, y, 2, 1, "#f5c451"); p.px(x, y - 1, "#fff3b0"); });
  }
  if (id === "forja") {
    let y = ARENA_A - 18;
    for (let x = 0; x < ARENA_L; x++) {
      y += Math.sin(x / 27) * 0.25;
      p.transparente(0.25, () => p.ret(x, y - 3, 1, 8, "#ff7a1a"));
      p.ret(x, y, 1, 3, "#e0581a");
      if (x % 3) p.px(x, y + 1, "#ffd166");
    }
    // a bigorna
    [[70, 118], [ARENA_L - 70, 118]].forEach(([x, by]) => {
      p.ret(x - 10, by - 10, 20, 4, "#4a4a55");
      p.ret(x - 14, by - 10, 6, 2, "#4a4a55");
      p.ret(x - 4, by - 6, 8, 6, "#3a3a44");
      p.ret(x - 8, by, 16, 3, "#2b2b35");
      p.ret(x - 10, by - 10, 20, 1, "#8a8b99");
    });
    for (let i = 0; i < 40; i++) p.px(rnd() * ARENA_L, rnd() * ARENA_A, i % 2 ? "#ff9a3c" : "#ffd166");
  }
  if (id === "biblioteca-vazio") {
    // estantes de livros na parede
    [[56, 30], [ARENA_L - 56 - 30, 30]].forEach(([x, w]) => {
      p.ret(x - 2, 54, w + 4, H - 54, "#2a1a10");
      for (let prateleira = 0; prateleira < 2; prateleira++) {
        const py = 58 + prateleira * 14;
        for (let bx = x; bx < x + w; bx += 3) p.ret(bx, py, 2, 10 - (bx % 4), ["#7a1f3d", "#2e5cb8", "#c9952a", "#2e8b57", "#5a3aa6"][(bx * 7) % 5]);
        p.ret(x - 2, py + 10, w + 4, 2, "#4a2e1a");
      }
    });
    for (let i = 0; i < 14; i++) {
      const x = 30 + rnd() * (ARENA_L - 60);
      const y = 10 + rnd() * 60;
      p.transparente(0.35, () => p.bola(x, y, 3, "#c08bff"));
      p.ret(x - 1, y - 1, 3, 3, i % 2 ? "#efe6ff" : "#a98bff");
    }
  }
  if (id === "cidadela") {
    salpicar(p, rnd, 16, (x, y, perto, i) => cristal(p, x, y, 4 + perto * 10, 1 + perto * 2, ["#e6fdff", "#8ab8e0", "#ffffff"]));
    // pingentes de gelo pendurados no alto da parede
    for (let x = 4; x < ARENA_L; x += 7 + Math.floor(rnd() * 6)) {
      const comp = 4 + Math.floor(rnd() * 10);
      for (let k = 0; k < comp; k++) {
        const meia = Math.max(0, Math.round((1 - k / comp) * 2));
        p.ret(x - meia, k, meia * 2 + 1, 1, k < 2 ? "#ffffff" : "#bfe6ff");
      }
    }
    for (let i = 0; i < 50; i++) p.px(rnd() * ARENA_L, rnd() * ARENA_A, "#ffffff");
  }
}
Object.keys(MASMORRAS).forEach((id) => { CENAS_ARENA[`masmorra:${id}`] = (p, rnd) => masmorra(p, rnd, id); });

const cacheArenas = new Map();
// chuva: o céu fica cinza-azulado e pesado, o chão escurece e brilha molhado, com poças.
// noite (0 a 1): tudo escurece puxando para o azul e o céu ganha estrelas.
function arenaDaRegiao(regiao, { chefe = false, chuva = false, noite = 0 } = {}) {
  const nome = CENAS_ARENA[regiao] ? regiao : "campos";
  const escuro = Math.round(Math.max(0, Math.min(1, noite)) * 4) / 4; // em 5 degraus (para guardar pronto)
  const chave = `${nome}:${chefe}:${chuva}:${escuro}`;
  if (cacheArenas.has(chave)) return cacheArenas.get(chave);
  const { canvas, ctx } = criarTela(ARENA_L, ARENA_A);
  const p = pintor(ctx);
  CENAS_ARENA[nome](p, sorteioFixo(nome));
  if (chuva) {
    const rnd = sorteioFixo(`${nome}:chuva`);
    p.transparente(0.42, () => { for (let y = 0; y < ARENA_HORIZONTE; y++) p.ret(0, y, ARENA_L, 1, y % 2 ? "#3a4560" : "#2e3850"); });
    p.transparente(0.28, () => p.ret(0, ARENA_HORIZONTE, ARENA_L, ARENA_A - ARENA_HORIZONTE, "#1a2236"));
    // nuvens pesadas no alto
    for (let i = 0; i < 9; i++) {
      const x = rnd() * ARENA_L;
      const y = 4 + rnd() * 22;
      p.transparente(0.5, () => p.ret(x, y, 40 + rnd() * 50, 6 + rnd() * 6, "#566078"));
    }
    // poças no chão, com o reflexo claro do céu
    for (let i = 0; i < 10; i++) {
      const x = rnd() * ARENA_L;
      const y = ARENA_HORIZONTE + 14 + rnd() * (ARENA_A - ARENA_HORIZONTE - 20);
      const w = 10 + rnd() * 18;
      p.transparente(0.45, () => p.ret(x, y, w, 2, "#7a8aa8"));
      p.transparente(0.6, () => p.ret(x + 2, y, Math.max(2, w / 3), 1, "#c8d6f0"));
    }
  }
  if (escuro > 0) {
    const rnd = sorteioFixo(`${nome}:noite`);
    p.transparente(0.55 * escuro, () => p.ret(0, 0, ARENA_L, ARENA_A, "#070b24"));
    if (!chuva) for (let i = 0; i < 50 * escuro; i++) p.px(rnd() * ARENA_L, rnd() * (ARENA_HORIZONTE - 20), i % 5 ? "#e8eef5" : "#fff3b0");
  }
  // o chefão: o céu puxa para o vermelho e as bordas escurecem
  if (chefe) {
    p.transparente(0.22, () => { for (let y = 0; y < ARENA_HORIZONTE; y++) p.ret(0, y, ARENA_L, 1, y % 2 ? "#a8102e" : "#6a0a1e"); });
    p.transparente(0.35, () => { p.ret(0, 0, 10, ARENA_A, "#000000"); p.ret(ARENA_L - 10, 0, 10, ARENA_A, "#000000"); });
  }
  const url = canvas.toDataURL();
  cacheArenas.set(chave, url);
  return url;
}

return arenaDaRegiao;
})();
