// O retrato de busto (64 x 80 pixels) de quem fala nas conversas: bem maior e mais detalhado que o
// sprite do mapa, no estilo dos retratos de RPG (rosto com luz e sombra, olhos com brilho, cabelo em
// mechas com reflexo, roupa da vocação). Sai das mesmas escolhas do avatar (pele, cabelo, olhos, rosto,
// roupa, chapéu, acessório), então todo morador ganha o retrato dele sem desenho à mão.
// A luz vem de cima, à esquerda. retratoBustoUrl(visual, { boca: "falando" } | { olhos: "piscando" })
// devolve os quadros para a boca mexer e o olho piscar enquanto a pessoa fala.

const BUSTO_L = 64;
const BUSTO_A = 80;
const BUSTO_CX = 32; // o meio do rosto (entre as colunas 31 e 32)

function corEntre(c1, c2, t) {
  const a = hexParaRgb(c1);
  const b = hexParaRgb(c2);
  return rgbParaHex(a.map((v, i) => v + (b[i] - v) * t));
}

function coresDoBusto(a) {
  const olho = a.corOlhos || "#3d8bd9";
  const cab = a.corCabelo;
  return {
    pele: a.pele, peleLuz: tom(a.pele, 1.16), peleSombra: tom(a.pele, 0.84), peleFunda: tom(a.pele, 0.68),
    bochecha: corEntre(a.pele, "#ff6b7f", 0.3),
    cab, cabLuz: tom(cab, 1.25), cabBrilho: tom(cab, 1.65), cabSombra: tom(cab, 0.72), cabFundo: tom(cab, 0.5),
    sobrancelha: tom(cab, 0.55),
    olho, olhoEsc: tom(olho, 0.5), olhoClaro: tom(olho, 1.45), pupila: tom(olho, 0.25), branco: "#f4f1ea",
    cilio: corEntre(tom(cab, 0.35), "#1b1533", 0.6),
    boca: "#6e2633", labio: corEntre(a.pele, "#c95b6a", 0.55),
  };
}

// a forma da cabeça (oval com o queixo afinando) e a do tronco (ombros largos; no feminino, mais estreitos)
function geometriaBusto(fem) {
  const rx = fem ? 11.5 : 12;
  const cy = 27;
  const cabeca = (x, y) => {
    const dx = (x + 0.5 - BUSTO_CX) / rx;
    if (y < cy) {
      const dy = (y + 0.5 - cy) / 15;
      return dx * dx + dy * dy <= 1;
    }
    const t = (y + 0.5 - cy) / 16;
    if (t > 1) return false;
    return Math.abs(dx) <= 1 - Math.pow(t, 2.2) * (fem ? 0.74 : 0.66);
  };
  const ombro = fem ? 25 : 29;
  // o ombro desce arredondado (não em rampa reta)
  const tronco = (x, y) => y >= 46 && Math.abs(x + 0.5 - BUSTO_CX) <= 8 + (ombro - 8) * Math.sqrt(Math.min(1, (y - 45) / 11));
  return { rx, cy, cabeca, tronco, ombro };
}

// ---------- cabelo ----------

// franja = a linha de baixo da franja; pontas = o tamanho dos dentes das mechas; lado = até onde descem
// as mechas do lado do rosto; atras = o volume que fica atrás da cabeça
const ESTILOS_BUSTO = {
  curto: { franja: 20, pontas: 3, lado: 30 },
  espetado: { franja: 19, pontas: 4, lado: 28, espetos: true },
  franja: { franja: 18, pontas: 2, lado: 31, inclinada: true },
  longo: { franja: 20, pontas: 3, lado: 34, mechas: true, atras: "longo" },
  rabo: { franja: 20, pontas: 2, lado: 30, atras: "rabo" },
  trancas: { franja: 20, pontas: 1, lado: 33, risca: true, trancas: true, atras: "longo" },
  chiquinhas: { franja: 20, pontas: 3, lado: 30, atras: "chiquinhas" },
  coque: { franja: 19, pontas: 1, lado: 29, atras: "coque" },
  cacheado: { franja: 21, pontas: 3, lado: 34, atras: "volume", cachos: true },
  moicano: { moicano: true },
  raspado: { raspado: true },
};

function limiteFranja(e, x) {
  const dx = x + 0.5 - BUSTO_CX;
  let base = e.franja;
  if (e.inclinada) base = 20 + (BUSTO_CX - x) * 0.4; // varrida para o lado: desce na esquerda
  if (e.risca) base = e.franja - 2 + Math.abs(dx) * 0.35; // risca no meio
  const fase = ((x % 4) + 4) % 4;
  const ponta = [0, e.pontas, Math.round(e.pontas / 2), e.pontas > 2 ? 1 : 0][fase];
  return Math.round(base + ponta);
}

// o cabelo da frente: a calota (um pouco maior que a cabeça), a franja e as mechas do lado do rosto
function dentroDoCabelo(e, g, x, y) {
  const dx = x + 0.5 - BUSTO_CX;
  const rx = g.rx + (e.cachos ? 3.5 : 2);
  const topo = e.cachos ? 8 : 10;
  const cy = 26;
  const nx = dx / rx;
  const ny = (y + 0.5 - cy) / (cy - topo);
  if (y < cy && nx * nx + ny * ny > 1) return false;
  if (y >= cy && Math.abs(nx) > 1) return false;
  if (Math.abs(dx) >= g.rx - 2.5) return y <= e.lado;
  return y < limiteFranja(e, x);
}

function fundoDoCabelo(e, g, x) {
  return Math.abs(x + 0.5 - BUSTO_CX) >= g.rx - 2.5 ? e.lado : limiteFranja(e, x) - 1;
}

// a cor de um fio: o arco de brilho perto do alto, os fios mais escuros entre as mechas e a sombra à direita
function corDoFio(c, x, y, fundo) {
  const dx = x + 0.5 - BUSTO_CX;
  const arco = Math.round(15 + (dx * dx) / 40);
  if (dx < 6 && dx > -11) {
    if (y === arco && Math.floor(x / 2) % 3 !== 2) return c.cabBrilho;
    if (y === arco - 1 || y === arco + 1) return c.cabLuz;
  }
  if (dx > 7 || y >= fundo - 1) return c.cabSombra;
  if (x % 4 === 0 && y > 18) return c.cabSombra;
  if (dx < -8) return c.cabLuz;
  return c.cab;
}

// cabelo cacheado: cachinhos de 3 x 3 (luz em cima à esquerda, sombra embaixo à direita), em fileiras
// desencontradas; atrás da cabeça tudo um tom mais escuro
function corDoCacho(c, x, y, atras) {
  const linha = Math.floor(y / 3);
  const ix = (x + (linha % 2 ? 1 : 0) + 30) % 3;
  const iy = y % 3;
  const [luz, base, sombra] = atras ? [c.cab, c.cabSombra, c.cabFundo] : [c.cabLuz, c.cab, c.cabSombra];
  if (!atras && x + 0.5 - BUSTO_CX > 8) return ix === 0 && iy === 0 ? base : sombra;
  if (ix === 0 && iy === 0) return luz;
  if (ix === 2 || iy === 2) return sombra;
  return base;
}

// círculo cheio (para coque, rabo, chiquinhas)
function bolaBusto(px, cx, cy, r, cor) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r) px(x, y, cor(dx / r, dy / r));
    }
  }
}

function cabeloDeTras(d) {
  const { e, c, g, px, forma } = d;
  const tomTras = (nx, ny) => (nx > 0.35 || ny > 0.5 ? c.cabFundo : nx < -0.4 && ny < -0.2 ? c.cab : c.cabSombra);
  if (e.atras === "longo") {
    forma((x, y) => {
      const dx = Math.abs(x + 0.5 - BUSTO_CX);
      return y >= 16 && y <= 60 + (x % 3) * 2 && dx <= Math.min(17.5, 14 + (y - 16) * 0.2);
    }, (x) => (x > 38 ? c.cabFundo : c.cabSombra));
  }
  if (e.atras === "volume") {
    forma((x, y) => {
      const dx = x + 0.5 - BUSTO_CX;
      const dy = y + 0.5 - 27;
      const ang = Math.atan2(dy, dx);
      const r = 18.5 + 1.6 * Math.sin(ang * 9);
      return y < 50 && dx * dx + dy * dy <= r * r;
    }, (x, y) => corDoCacho(c, x, y, true));
  }
  if (e.atras === "rabo") {
    for (let t = 0; t <= 1; t += 0.04) {
      bolaBusto(px, 45 + 7 * Math.pow(t, 0.8), 18 + 30 * t, 5.5 - 3.5 * t, tomTras);
    }
    forma((x, y) => x >= 43 && x <= 47 && y >= 17 && y <= 19, (x, y) => (y === 17 ? d.p.Q : d.p.D));
  }
  if (e.atras === "chiquinhas") {
    [-1, 1].forEach((lado) => {
      for (let t = 0; t <= 1; t += 0.04) {
        bolaBusto(px, BUSTO_CX + lado * (16 + 5 * t), 22 + 24 * t, 5.5 - 3.2 * t, (nx, ny) => tomTras(nx * lado, ny));
      }
      forma((x, y) => Math.abs(x + 0.5 - (BUSTO_CX + lado * 15.5)) <= 2 && y >= 19 && y <= 21, (x, y) => (y === 19 ? d.p.Q : d.p.D));
    });
  }
  if (e.atras === "coque") {
    bolaBusto(px, BUSTO_CX, 9, 6.5, (nx, ny) => (nx < -0.3 && ny < -0.2 ? c.cabLuz : nx > 0.4 || ny > 0.5 ? c.cabSombra : c.cab));
    px(29, 6, c.cabBrilho); px(30, 5, c.cabBrilho);
  }
}

function cabeloDaFrente(d) {
  const { e, c, g, px, forma, chapeu } = d;
  const desde = chapeu.limite;
  if (e.raspado || e.moicano) {
    // raspado: só a sombra dos fios curtinhos na cabeça
    forma((x, y) => g.cabeca(x, y) && y < (e.moicano ? 22 : 20) && y >= desde,
      (x, y) => corEntre(c.pele, c.cabFundo, (x + y) % 2 ? 0.38 : 0.3));
    if (e.moicano) {
      forma((x, y) => {
        const dx = Math.abs(x + 0.5 - BUSTO_CX);
        return y >= Math.max(desde, 4 + Math.round(dx)) && y <= 19 && dx <= 3.5;
      }, (x, y) => (x <= 30 ? c.cabLuz : x >= 33 ? c.cabSombra : y % 3 === 0 ? c.cabBrilho : c.cab));
    }
    return;
  }
  // as mechas compridas que caem na frente dos ombros
  if (e.mechas) {
    forma((x, y) => {
      const dx = Math.abs(x + 0.5 - BUSTO_CX);
      return y >= Math.max(26, desde) && y <= 60 + (x % 3) * 2 && dx >= g.rx - 2.5 && dx <= g.rx + 4.5;
    }, (x, y) => (x > BUSTO_CX ? (x % 3 === 0 ? c.cabFundo : c.cabSombra) : x % 3 === 0 ? c.cabSombra : y % 9 === 0 ? c.cabLuz : c.cab));
  }
  if (e.espetos) {
    [21, 26, 31, 37, 42].forEach((bx, i) => {
      const alto = [7, 4, 2, 4, 7][i];
      for (let y = alto; y <= 13; y++) {
        const meia = (y - alto) * 0.45;
        const inclina = Math.round((13 - y) * 0.3);
        for (let x = Math.round(bx - meia) + inclina; x <= Math.round(bx + meia) + inclina; x++) {
          if (y >= desde) px(x, y, x > bx + inclina ? c.cabSombra : y < alto + 2 ? c.cabLuz : c.cab);
        }
      }
    });
  }
  forma((x, y) => y >= desde && dentroDoCabelo(e, g, x, y), (x, y) => {
    if (e.cachos) return corDoCacho(c, x, y, false);
    return corDoFio(c, x, y, fundoDoCabelo(e, g, x));
  });
  // a sombra que a franja faz na testa
  for (let x = 20; x <= 43; x++) {
    const y = limiteFranja(e, x);
    if (y < 24 && y >= desde && g.cabeca(x, y) && Math.abs(x + 0.5 - BUSTO_CX) < g.rx - 2.5) px(x, y, c.peleSombra);
  }
  if (e.trancas) {
    [-1, 1].forEach((lado) => {
      for (let y = 30; y <= 70; y++) {
        const seg = (y - 30) % 4;
        const meia = seg === 0 ? 1 : 2;
        const cx = BUSTO_CX + lado * 13.5 + (Math.floor((y - 30) / 4) % 2 ? 0.5 : -0.5);
        if (y >= 64 && y <= 65) {
          for (let x = Math.round(cx - 2); x <= Math.round(cx + 1); x++) px(x, y, y === 64 ? d.p.Q : d.p.D);
          continue;
        }
        const largura = y > 65 ? 1 : meia;
        for (let x = Math.round(cx - largura); x <= Math.round(cx + largura - 1); x++) {
          px(x, y, seg === 0 ? c.cabFundo : x < cx - 0.5 ? c.cabLuz : x > cx ? c.cabSombra : c.cab);
        }
      }
    });
  }
}

// ---------- corpo ----------

function sombraDaRoupa(g, x, y, claro, base, escuro, fundo) {
  const dx = (x + 0.5 - BUSTO_CX) / g.ombro;
  if (dx > 0.82) return fundo;
  if (dx > 0.45) return escuro;
  if (y <= 49 && Math.abs(dx) < 0.35) return escuro;
  if (dx < -0.6) return claro;
  return base;
}

function traseiraDoBusto(d) {
  const { a, g, px, forma, p } = d;
  if (a.kit === "guerreiro") {
    // a capa aparece além das ombreiras
    forma((x, y) => y >= 50 && Math.abs(x + 0.5 - BUSTO_CX) <= g.ombro + 3, (x) => (x > BUSTO_CX ? p.V : p.m));
  }
  if (a.kit === "arqueiro") {
    // as flechas da aljava atrás do ombro direito
    [46, 49, 52].forEach((x, i) => {
      for (let y = 36; y <= 52; y++) px(x, y, y < 41 ? ["#f4f7fb", "#a8323e", p.D][i] : "#8b5a2b");
      px(x - 1, 37, ["#d8dee9", "#7a1f2a", p.d][i]);
      px(x + 1, 37, ["#d8dee9", "#7a1f2a", p.d][i]);
      px(x - 1, 39, ["#d8dee9", "#7a1f2a", p.d][i]);
      px(x + 1, 39, ["#d8dee9", "#7a1f2a", p.d][i]);
    });
    forma((x, y) => x >= 44 && x <= 55 && y >= 46 && y <= 54, (x, y) => (y === 46 ? p.D : x > 51 ? "#5c3418" : "#8b5a2b"));
  }
}

function troncoDoBusto(d) {
  const { a, g, px, forma, p } = d;
  const metal = { claro: "#f4f7fb", base: "#c9cfdc", escuro: "#8a93a8", fundo: "#5c6478" };
  if (a.kit === "guerreiro") {
    forma(g.tronco, (x, y) => (x >= 21 && x <= 23 && y >= 52 && y <= 72 ? metal.claro : sombraDaRoupa(g, x, y, metal.base, metal.base, metal.escuro, metal.fundo)));
    // a sobreveste na cor do manto, com barra dourada
    forma((x, y) => g.tronco(x, y) && y >= 56 && Math.abs(x + 0.5 - BUSTO_CX) <= 8, (x, y) => {
      const dx = Math.abs(x + 0.5 - BUSTO_CX);
      if (dx > 7) return p.D;
      return x > BUSTO_CX + 2 ? p.m : p.M;
    });
    // o emblema
    [[31, 61], [30, 62], [31, 62], [32, 62], [33, 62], [31, 63], [32, 63], [32, 61], [31, 64], [32, 64]].forEach(([x, y]) => px(x, y, y === 61 ? p.Q : p.D));
    // as ombreiras
    const cxs = d.fem ? [15, 48] : [13, 50];
    cxs.forEach((cx) => {
      bolaBusto(px, cx + 0.5, 56, d.fem ? 8 : 9, (nx, ny) => {
        const r = Math.sqrt(nx * nx + ny * ny);
        if (r > 0.86) return ny > 0 ? p.d : p.D;
        if (nx < -0.2 && ny < -0.2) return r < 0.5 ? metal.claro : metal.base;
        return nx > 0.35 || ny > 0.45 ? metal.escuro : metal.base;
      });
      px(cx - 3, 56, p.D); px(cx + 4, 56, p.D);
    });
    return;
  }
  forma(g.tronco, (x, y) => {
    if (y > 60 && (x === 18 || x === 46)) return p.m; // dobras
    return sombraDaRoupa(g, x, y, p.n, p.M, p.m, p.V);
  });
  if (a.kit === "arqueiro") {
    // o colete de couro (com o cordão no meio) e a correia da aljava
    const couro = { claro: "#b07a45", base: "#8b5a2b", escuro: "#5c3418" };
    forma((x, y) => {
      const dx = Math.abs(x + 0.5 - BUSTO_CX);
      return g.tronco(x, y) && y >= 53 && dx >= 4 && dx <= g.ombro - 6;
    }, (x, y) => (x > BUSTO_CX + 12 ? couro.escuro : x < BUSTO_CX - 14 ? couro.claro : (x + y) % 9 === 0 ? couro.escuro : couro.base));
    for (let y = 55; y <= 79; y += 3) { px(29, y, "#d9b37a"); px(30, y + 1, "#d9b37a"); px(33, y + 1, "#d9b37a"); px(34, y, "#d9b37a"); }
    for (let y = 48; y <= 79; y++) {
      const x0 = Math.round(14 + (y - 48) * 0.98);
      px(x0, y, "#3d220e"); px(x0 + 1, y, "#8b5a2b"); px(x0 + 2, y, "#6b4a2a");
    }
    forma((x, y) => x >= 27 && x <= 31 && y >= 60 && y <= 63, (x, y) => (x === 29 && (y === 61 || y === 62) ? "#5c3418" : y === 60 ? p.Q : p.D));
    return;
  }
  // mago: gola alta, decote em V com a camisa, barra bordada na capa dos ombros e o broche de cristal
  const aberto = (x, y) => y >= 46 && y <= 64 && Math.abs(x + 0.5 - BUSTO_CX) <= (64 - y) * 0.42;
  forma((x, y) => aberto(x, y), (x) => (x > BUSTO_CX + 1 ? "#bdb3a0" : "#ece6d6"));
  forma((x, y) => g.tronco(x, y) && !aberto(x, y) && (aberto(x - 1, y) || aberto(x + 1, y)), () => p.D);
  forma((x, y) => g.tronco(x, y) && !aberto(x, y) && !aberto(x - 1, y) && !aberto(x + 1, y) && (aberto(x - 2, y) || aberto(x + 2, y)), () => p.d);
  for (let x = 3; x <= 60; x++) {
    const dx = (x + 0.5 - BUSTO_CX) / g.ombro;
    const y = Math.round(62 - 4 * dx * dx);
    if (!g.tronco(x, y) || aberto(x, y) || Math.abs(dx) > 1) continue;
    px(x, y, x % 3 === 0 ? p.Q : p.D);
    px(x, y + 1, p.d);
  }
  forma((x, y) => x >= 30 && x <= 33 && y >= 62 && y <= 65, (x, y) => {
    if (x === 30 || x === 33 || y === 62 || y === 65) return p.D;
    return x === 31 && y === 63 ? p.g : p.G;
  });
  // as abas da gola, em pé atrás do pescoço
  forma((x, y) => y >= 39 && y <= 48 && ((x >= 21 + (y - 39) * 0.4 && x <= 26) || (x <= 42 - (y - 39) * 0.4 && x >= 37)), (x, y) => {
    if (x <= 21 + (y - 39) * 0.4 + 1 || x >= 42 - (y - 39) * 0.4 - 1) return p.D;
    return x < BUSTO_CX ? p.n : p.m;
  });
}

function pescocoDoBusto({ fem, c, forma }) {
  const [x0, x1] = fem ? [28, 35] : [27, 36];
  forma((x, y) => x >= x0 && x <= x1 && y >= 38 && y <= 50, (x, y) => {
    if (y <= 44 || x >= x1 - 1) return c.peleFunda;
    return x === x0 ? c.pele : c.peleSombra;
  });
}

function gorjalDoGuerreiro({ a, forma, p }) {
  if (a.kit !== "guerreiro") return;
  forma((x, y) => y >= 44 && y <= 49 && Math.abs(x + 0.5 - BUSTO_CX) <= 9.5, (x, y) => {
    if ((x === 25 || x === 38) && y === 46) return p.D;
    if (y === 44) return "#f4f7fb";
    return x > 36 ? "#5c6478" : y % 2 ? "#8a93a8" : "#c9cfdc";
  });
}

function capuzDoArqueiro({ a, forma, p }) {
  if (a.kit !== "arqueiro") return;
  forma((x, y) => {
    const dx = x + 0.5 - BUSTO_CX;
    const fora = (dx / 14) ** 2 + ((y + 0.5 - 48) / 5.5) ** 2 <= 1;
    const dentro = (dx / 6.5) ** 2 + ((y + 0.5 - 45.5) / 3) ** 2 <= 1;
    return y >= 42 && fora && !dentro;
  }, (x, y) => (x % 4 === 0 ? p.m : x > 38 ? p.m : y < 46 && x < 28 ? p.n : p.M));
}

// ---------- cabeça e rosto ----------

function cabecaDoBusto({ g, c, forma, px }) {
  // as orelhas
  for (let y = 27; y <= 33; y++) {
    px(19, y, c.pele); px(44, y, c.peleSombra);
    if (y >= 28 && y <= 32) { px(18, y, c.pele); px(45, y, c.peleFunda); }
  }
  [29, 30, 31].forEach((y) => { px(19, y, c.peleSombra); px(44, y, c.peleFunda); });
  forma(g.cabeca, (x, y) => {
    const dx = (x + 0.5 - BUSTO_CX) / g.rx;
    if ((dx > 0 && !g.cabeca(x + 1, y)) || dx > 0.78) return c.peleFunda;
    if (!g.cabeca(x, y + 1)) return c.peleSombra;
    if (dx > 0.5 || y >= 41 || (dx > 0.3 && y > 34)) return c.peleSombra;
    if ((x >= 23 && x <= 28 && y >= 15 && y <= 19) || (x >= 21 && x <= 24 && y >= 31 && y <= 33)) return c.peleLuz;
    return c.pele;
  }, 8, 44, 14, 50);
}

// olho esquerdo, do canto de fora (coluna 0, x = 23) para dentro; o direito é o espelho
const OLHO_BUSTO = [".LLLL.", "LkkkkB", "BNWKNB", ".NooN.", "..ss.."];
const OLHO_FELIZ = ["......", "..LL..", ".L..L.", "L....L", "......"];
const OLHO_FECHADO = ["......", "......", "LLLLLL", ".ssss.", "......"];
const SOBRANCELHAS_BUSTO = {
  normal: [[24, 28, 25], [23, 23, 26]],
  bravo: [[23, 25, 25], [25, 27, 26], [27, 28, 27]],
  surpreso: [[24, 28, 23], [23, 23, 24]],
  timido: [[26, 28, 24], [23, 25, 25]],
};
const BOCAS_BUSTO = {
  sorriso: [[29, 29, 36, "z"], [34, 34, 36, "z"], [30, 33, 37, "b"], [31, 32, 38, "l"]],
  alegre: [[29, 29, 36, "z"], [34, 34, 36, "z"], [30, 33, 37, "b"], [30, 33, 38, "b"], [31, 32, 38, "l"], [31, 32, 39, "s"]],
  confiante: [[29, 32, 37, "z"], [33, 33, 36, "z"], [30, 31, 38, "s"]],
  serio: [[30, 33, 37, "z"], [31, 32, 39, "s"]],
  bravo: [[30, 33, 37, "b"], [29, 29, 38, "z"], [34, 34, 38, "z"]],
  surpreso: [[31, 32, 36, "b"], [30, 33, 37, "b"], [31, 32, 38, "b"]],
  timido: [[31, 32, 37, "z"]],
  falando: [[30, 33, 37, "b"], [30, 33, 38, "b"], [31, 32, 38, "l"], [31, 32, 39, "s"]],
};

function rostoDoBusto(d, boca, olhos) {
  const { a, c, px, fem } = d;
  const tipo = a.rosto || "sorriso";
  const corDe = { L: c.cilio, k: c.olhoEsc, N: c.olho, W: "#ffffff", K: c.pupila, o: c.olhoClaro, B: c.branco, s: c.peleSombra, z: c.peleFunda, b: c.boca, l: c.labio };
  let esq = tipo === "alegre" ? OLHO_FELIZ : OLHO_BUSTO;
  let dir = tipo === "alegre" || tipo === "piscadela" ? OLHO_FELIZ : OLHO_BUSTO;
  if (olhos === "piscando") {
    esq = esq === OLHO_FELIZ ? esq : OLHO_FECHADO;
    dir = dir === OLHO_FELIZ ? dir : OLHO_FECHADO;
  }
  const olho = (desenho, espelho) => desenho.forEach((linha, j) => [...linha].forEach((ch, i) => {
    if (ch === ".") return;
    // no olho direito o brilho continua do lado da luz (esquerda da pupila)
    const letra = espelho && ch === "W" ? "K" : espelho && ch === "K" ? "W" : ch;
    px(espelho ? 40 - i : 23 + i, 28 + j, corDe[letra]);
  }));
  olho(esq, false);
  olho(dir, true);
  if (fem && esq === OLHO_BUSTO) { px(22, 28, c.cilio); px(21, 27, c.cilio); }
  if (fem && dir === OLHO_BUSTO) { px(41, 28, c.cilio); px(42, 27, c.cilio); }
  // sobrancelhas
  const sob = SOBRANCELHAS_BUSTO[tipo] || SOBRANCELHAS_BUSTO.normal;
  sob.forEach(([x1, x2, y]) => {
    for (let x = x1; x <= x2; x++) {
      px(x, y, c.sobrancelha);
      px(63 - x, y - (tipo === "confiante" ? 1 : 0), c.sobrancelha);
    }
  });
  // nariz
  px(31, 32, c.peleLuz); px(32, 33, c.peleSombra); px(32, 34, c.peleFunda); px(31, 34, c.peleSombra);
  // boca e bochechas
  (BOCAS_BUSTO[boca] || BOCAS_BUSTO[tipo] || BOCAS_BUSTO.sorriso).forEach(([x1, x2, y, ch]) => {
    for (let x = x1; x <= x2; x++) px(x, y, corDe[ch]);
  });
  if (tipo !== "serio" && tipo !== "bravo") {
    for (let x = 22; x <= 24; x++) { px(x, 34, c.bochecha); px(x + 17, 34, c.bochecha); }
    if (tipo === "timido") for (let x = 22; x <= 25; x++) { px(x, 35, c.bochecha); px(x + 16, 35, c.bochecha); }
  }
  if (a.acessorio === "sardas") [[23, 33], [25, 34], [24, 35], [40, 33], [38, 34], [39, 35]].forEach(([x, y]) => px(x, y, c.peleFunda));
  if (a.acessorio === "cicatriz") {
    const cor = corEntre(c.pele, "#a8323e", 0.4);
    [[24, 24], [25, 25], [25, 26], [26, 27], [26, 32], [27, 33], [27, 34]].forEach(([x, y]) => px(x, y, cor));
  }
}

function pelosDoRosto({ a, c, g, forma, px }) {
  const fio = (x, y) => (x > 34 ? c.cabSombra : (x + y) % 3 === 0 ? c.cabSombra : x < 27 ? c.cabLuz : c.cab);
  if (a.acessorio === "barba") {
    forma((x, y) => {
      if (!g.cabeca(x, y) && !(y >= 43 && y <= 44 && x >= 29 && x <= 34)) return false;
      if (y >= 35 && y <= 38 && x >= 29 && x <= 34) return false;
      return y >= 33 && (y >= 36 || Math.abs(x + 0.5 - BUSTO_CX) >= 9);
    }, fio, 30, 46);
  }
  if (a.acessorio === "barba" || a.acessorio === "bigode") {
    for (let x = 29; x <= 34; x++) px(x, 35, fio(x, 35));
    [27, 28, 35, 36].forEach((x) => px(x, 36, fio(x, 36)));
  }
  if (a.acessorio === "cavanhaque") {
    forma((x, y) => (x >= 30 && x <= 33 && y >= 39 && y <= 43) || (y === 44 && x >= 31 && x <= 32), fio, 38, 45);
  }
}

// ---------- chapéus ----------

// os chapéus da loja que são variações de uma base (mesmo desenho, outras cores) usam a tabela do herói
function chapeuDoBusto(a) {
  const variacao = typeof VARIACOES_CHAPEU !== "undefined" ? VARIACOES_CHAPEU[a.chapeu] : null;
  const base = variacao ? variacao.base : a.chapeu;
  const p = { ...paletaAvatar(a), ...(variacao ? variacao.cores : {}) };
  const limites = { pontudo: 18, capuz: 16, cacador: 17, elmoFerro: 22, elmo: 22, boina: 15, cartola: 15 };
  return { base, p, limite: limites[base] ?? -1 };
}

function desenharChapeuBusto(d) {
  const { chapeu, px, forma } = d;
  const p = chapeu.p;
  const metal = { claro: "#f4f7fb", base: "#c9cfdc", escuro: "#8a93a8", fundo: "#5c6478" };
  const dxDe = (x) => x + 0.5 - BUSTO_CX;
  switch (chapeu.base) {
    case "pontudo": {
      for (let y = 0; y <= 16; y++) {
        const t = (16 - y) / 16;
        const centro = BUSTO_CX + 7 * t * t;
        const meia = Math.max(0.6, 11 * Math.pow(1 - t, 0.9));
        for (let x = Math.floor(centro - meia); x <= Math.ceil(centro + meia) - 1; x++) {
          const rel = (x + 0.5 - centro) / meia;
          let cor = rel < -0.45 ? p.n : rel > 0.45 ? p.m : p.M;
          if (y <= 2) cor = p.m;
          if (y === 12) cor = p.Q;
          if (y === 13 || y === 14) cor = p.D;
          if (y === 15) cor = p.d;
          px(x, y, cor);
        }
      }
      [[31, 13, p.g], [32, 13, p.G], [31, 14, p.G], [32, 14, p.X]].forEach(([x, y, cor]) => px(x, y, cor));
      [[29, 8], [35, 4], [26, 11]].forEach(([x, y]) => px(x, y, p.Q));
      forma((x, y) => {
        const nx = dxDe(x) / 21;
        const ny = (y + 0.5 - 17.5) / 3.2;
        return nx * nx + ny * ny <= 1;
      }, (x, y) => (y <= 16 ? (dxDe(x) < -6 ? p.n : p.M) : y >= 19 ? p.V : dxDe(x) > 8 ? p.m : p.M));
      break;
    }
    case "capuz": {
      const abertura = (x, y, k = 1) => {
        const nx = dxDe(x) / (11.5 * k);
        const ny = (y + 0.5 - 30) / (14 * k);
        return y >= 16 && nx * nx + ny * ny <= 1;
      };
      forma((x, y) => {
        const dx = dxDe(x);
        if (y <= 34) {
          const nx = dx / 17;
          const ny = (y + 0.5 - 27) / 18;
          if (nx * nx + ny * ny > 1) return false;
        } else if (y > 58 || Math.abs(dx) > 17 + (y - 35) * 0.5) return false;
        return !abertura(x, y);
      }, (x, y) => {
        if (abertura(x, y, 1.1)) return p.V;
        if (abertura(x, y, 1.2)) return p.D;
        const dx = dxDe(x);
        if (y > 36 && Math.round(dx) % 7 === 0) return p.m;
        return dx < -8 ? p.n : dx > 7 ? p.m : p.M;
      });
      break;
    }
    case "cacador": {
      forma((x, y) => {
        if (y < 4 || y > 15) return false;
        if (y <= 5 && Math.abs(dxDe(x)) < 2) return false;
        return Math.abs(dxDe(x)) <= 10 - (y < 8 ? (8 - y) * 1.2 : 0);
      }, (x, y) => (y === 13 ? p.Q : y >= 14 ? p.D : dxDe(x) < -5 ? p.n : dxDe(x) > 5 ? p.m : p.M));
      forma((x, y) => {
        const dx = Math.abs(dxDe(x));
        if (dx > 21) return false;
        const sobe = dx > 16 ? 2 : dx > 13 ? 1 : 0;
        return y >= 16 - sobe && y <= 18 - sobe;
      }, (x, y) => (y <= 15 ? p.n : y === 16 && Math.abs(dxDe(x)) <= 16 ? p.n : y >= 18 || dxDe(x) > 10 ? p.V : p.m));
      for (let t = 0; t <= 1; t += 0.03) {
        const x = Math.round(41 + 12 * t);
        const y = Math.round(13 - 13 * t - 3 * Math.sin(Math.PI * t));
        px(x, y, p.d); px(x, y - 1, p.Q); if (t > 0.2 && t < 0.85) px(x - 1, y - 1, p.Q);
      }
      break;
    }
    case "bandana": {
      forma((x, y) => {
        const dx = Math.abs(dxDe(x));
        const topo = 16 + Math.round(dx * 0.15);
        return dx <= 13.5 && y >= topo && y <= topo + 3;
      }, (x, y) => {
        const topo = 16 + Math.round(Math.abs(dxDe(x)) * 0.15);
        if (y === topo) return p.Q;
        if (y === topo + 3) return p.d;
        return x % 5 === 0 && y === topo + 1 ? p.Q : p.D;
      });
      forma((x, y) => x >= 45 && x <= 47 && y >= 19 && y <= 22, () => p.D);
      for (let t = 0; t <= 1; t += 0.08) {
        const x1 = Math.round(46 + 7 * t);
        const y1 = Math.round(21 + 9 * t);
        px(x1, y1, p.D); px(x1 + 1, y1, p.d);
        const x2 = Math.round(46 + 4 * t);
        const y2 = Math.round(22 + 10 * t);
        px(x2, y2, p.d);
      }
      break;
    }
    case "elmoFerro":
    case "elmo": {
      const m = { ...metal };
      if (chapeu.p.A && chapeu.p.A !== "#d8dee9") { m.base = chapeu.p.A; m.escuro = chapeu.p.a; m.claro = chapeu.p.w || tom(chapeu.p.A, 1.5); m.fundo = tom(chapeu.p.a, 0.7); }
      forma((x, y) => {
        const dx = dxDe(x);
        if (y <= 24) {
          const nx = dx / 14.5;
          const ny = (y + 0.5 - 24) / 14;
          return nx * nx + ny * ny <= 1;
        }
        if (y <= 39 && Math.abs(dx) >= 9 && Math.abs(dx) <= 14.5 - (y > 33 ? (y - 33) * 0.6 : 0)) return true;
        return y <= 33 && (x === 31 || x === 32);
      }, (x, y) => {
        const dx = dxDe(x);
        if (y >= 21 && y <= 23 && Math.abs(dx) < 14) return y === 21 ? m.claro : (Math.round(dx) % 5 === 0 ? p.D : m.escuro);
        if (dx >= -8 && dx <= -6 && y >= 12 && y <= 20) return m.claro;
        if (x === 31 || x === 32) return y < 21 ? (x === 31 ? m.claro : m.base) : x === 31 ? m.base : m.escuro;
        if (dx > 9) return m.fundo;
        if (dx > 4) return m.escuro;
        return m.base;
      });
      if (chapeu.base === "elmo") {
        [-1, 1].forEach((lado) => {
          for (let t = 0; t <= 1; t += 0.04) {
            const x = BUSTO_CX + lado * (12 + 11 * t);
            const y = 16 - 13 * t + 5 * t * t;
            const r = 2.4 - 1.8 * t;
            bolaBusto(px, x, y, r, (nx) => (nx * lado > 0.2 ? "#bdb3a0" : "#ece6d6"));
          }
        });
        [[31, 18, "#ff4d6d"], [32, 18, "#a8323e"], [31, 17, "#ffb3c1"]].forEach(([x, y, cor]) => px(x, y, cor));
      }
      break;
    }
    case "tiara": {
      for (let x = 21; x <= 42; x++) {
        const nx = dxDe(x) / 12;
        const y = Math.round(19 - Math.sqrt(Math.max(0, 1 - nx * nx)) * 3);
        px(x, y - 1, p.Q); px(x, y, p.D); px(x, y + 1, p.d);
      }
      [[31, 13, p.g], [32, 13, p.G], [31, 14, p.G], [32, 14, p.X], [30, 14, p.D], [33, 14, p.D], [31, 15, p.D], [32, 15, p.D]].forEach(([x, y, cor]) => px(x, y, cor));
      [[25, 16], [38, 16]].forEach(([x, y]) => px(x, y, p.G));
      break;
    }
    case "boina": {
      forma((x, y) => {
        const nx = (x + 0.5 - 30) / 15.5;
        const ny = (y + 0.5 - 12 - (x - 30) * 0.12) / 5.5;
        return nx * nx + ny * ny <= 1;
      }, (x, y) => {
        const base = 12 + (x - 30) * 0.12;
        if (y >= base + 3.5) return p.V;
        if (x < 24 && y < base) return p.n;
        return x > 38 ? p.m : p.M;
      });
      px(30, 5, p.m); px(31, 5, p.m); px(30, 6, p.M);
      break;
    }
    case "flores": {
      const cores = ["#ff9fb2", "#ffd166", "#f4f7fb", "#b38cff"];
      for (let x = 19; x <= 44; x++) {
        const nx = dxDe(x) / 13;
        const y = Math.round(18 - Math.sqrt(Math.max(0, 1 - nx * nx)) * 3);
        px(x, y, "#4c9a2a"); px(x, y + 1, "#2f6e1c");
        if ((x - 19) % 5 === 2) {
          const cor = cores[((x - 19) / 5) % 4 | 0];
          [[0, -1], [-1, 0], [1, 0], [0, 1]].forEach(([ox, oy]) => px(x + ox, y + oy, cor));
          px(x, y, "#c46a1b");
        }
      }
      break;
    }
    case "cartola": {
      forma((x, y) => y <= 13 && Math.abs(dxDe(x)) <= 10.5, (x, y) => {
        if (y >= 10 && y <= 12) return y === 10 ? "#d9544f" : "#a8323e";
        return dxDe(x) < -6 ? "#3d3266" : dxDe(x) > 6 ? "#1b1533" : "#2b2540";
      });
      forma((x, y) => y >= 13 && y <= 15 && Math.abs(dxDe(x)) <= (y === 14 ? 17 : 16), (x, y) => (y === 13 ? "#3d3266" : "#1b1533"));
      px(38, 11, "#f5c451"); px(38, 12, "#c9952a");
      break;
    }
    case "coroa": {
      const ouro = { claro: "#fff3b0", base: "#f5c451", escuro: "#c9952a" };
      forma((x, y) => y >= 14 && y <= 17 && Math.abs(dxDe(x)) <= 11.5, (x, y) => (y === 14 ? ouro.claro : y === 17 || dxDe(x) > 7 ? ouro.escuro : ouro.base));
      [22, 27, 32, 37, 42].forEach((bx, i) => {
        const alto = i === 2 ? 5 : i === 1 || i === 3 ? 7 : 9;
        for (let y = alto; y <= 13; y++) {
          const meia = Math.round((y - alto) * 0.35);
          for (let x = bx - meia - 1; x <= bx + meia; x++) px(x, y, x >= bx ? ouro.escuro : ouro.base);
        }
        px(bx - 1, alto - 1, ouro.claro);
      });
      [[26, "#e0304a"], [31, p.G], [32, p.G], [37, "#e0304a"]].forEach(([x, cor]) => { px(x, 15, cor); px(x, 16, cor); });
      break;
    }
    default:
  }
}

function acessoriosPorCima({ a, px, p }) {
  if (a.acessorio === "oculos") {
    const aro = "#3a3550";
    [[22, 29], [34, 41]].forEach(([x1, x2]) => {
      for (let x = x1 + 1; x <= x2 - 1; x++) { px(x, 27, aro); px(x, 33, aro); }
      for (let y = 28; y <= 32; y++) { px(x1, y, aro); px(x2, y, aro); }
    });
    [30, 31, 32, 33].forEach((x) => px(x, 29, aro));
    [19, 20, 21].forEach((x) => px(x, 28, aro));
    [42, 43, 44].forEach((x) => px(x, 28, aro));
    px(23, 32, "#e6fdff"); px(35, 32, "#e6fdff");
  }
  if (a.acessorio === "tapaolho") {
    const tira = "#2b2540";
    for (let t = 0; t <= 1; t += 0.06) px(Math.round(35 - 15 * t), Math.round(27 - 8 * t), tira);
    [[42, 28], [43, 27], [44, 27]].forEach(([x, y]) => px(x, y, tira));
    for (let y = 27; y <= 32; y++) for (let x = 35; x <= 41; x++) {
      if ((y === 27 || y === 32) && (x === 35 || x === 41)) continue;
      px(x, y, x === 36 && y === 28 ? "#3d3266" : "#1b1533");
    }
  }
  if (a.acessorio === "brinco") {
    [[19, 34], [44, 34]].forEach(([x, y]) => { px(x, y, p.D); px(x, y + 1, p.g); px(x, y + 2, p.G); });
  }
}

function cachecolDoBusto({ a, forma, p }) {
  if (a.acessorio !== "cachecol") return;
  forma((x, y) => {
    const nx = (x + 0.5 - BUSTO_CX) / 11.5;
    const ny = (y + 0.5 - 46) / 4.2;
    return nx * nx + ny * ny <= 1 || (x >= 36 && x <= 41 && y >= 48 && y <= 64 - (x - 36));
  }, (x, y) => (y % 3 === 0 ? p.d : x > 38 && y < 49 ? p.d : x < 26 ? p.Q : p.D));
}

function retratoBusto(escolhas, { boca = null, olhos = null } = {}) {
  const a = escolhasCompletas(escolhas);
  const { canvas, ctx } = criarTela(BUSTO_L, BUSTO_A);
  const px = (x, y, cor) => {
    if (!cor || x < 0 || y < 0 || x >= BUSTO_L || y >= BUSTO_A) return;
    ctx.fillStyle = cor;
    ctx.fillRect(x, y, 1, 1);
  };
  const forma = (dentro, cor, y0 = 0, y1 = BUSTO_A - 1, x0 = 0, x1 = BUSTO_L - 1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (dentro(x, y)) px(x, y, cor(x, y));
  };
  const fem = a.corpo === "feminino";
  const chapeu = chapeuDoBusto(a);
  const d = {
    a, fem, px, forma, chapeu,
    c: coresDoBusto(a),
    g: geometriaBusto(fem),
    p: paletaAvatar(a),
    e: ESTILOS_BUSTO[a.cabelo] || ESTILOS_BUSTO.curto,
  };
  cabeloDeTras(d);
  traseiraDoBusto(d);
  troncoDoBusto(d);
  pescocoDoBusto(d);
  gorjalDoGuerreiro(d);
  capuzDoArqueiro(d);
  cachecolDoBusto(d);
  cabecaDoBusto(d);
  rostoDoBusto(d, boca, olhos);
  pelosDoRosto(d);
  cabeloDaFrente(d);
  desenharChapeuBusto(d);
  acessoriosPorCima(d);
  return contornar(canvas, "auto");
}

const cacheBustoUrl = new Map();
function retratoBustoUrl(escolhas, opcoes = {}) {
  const chave = JSON.stringify([escolhas, opcoes]);
  if (!cacheBustoUrl.has(chave)) cacheBustoUrl.set(chave, retratoBusto(escolhas, opcoes).toDataURL());
  return cacheBustoUrl.get(chave);
}
