// As árvores pintadas com o pincel do bestiário (bestiario.js): a copa em cachos com volume (cada cacho é
// uma esfera de folhas com 6 tons e pontilhado), tufos menores por cima dando a textura das folhas, galhos
// aparecendo entre os cachos, tronco com casca e raízes abrindo no chão. Cada tipo tem 3 variações (o Reino
// sorteia uma por árvore, pela posição) e diz que cor de folha solta no vento (canvas.folhas), para as folhas
// que caem (mundo.js). Saem na resolução do Reino (res 2) e já acabadas (o acabamento do cenário não repinta).
// Depende de pixel.js, bestiario.js e cenario_hd.js (RESOLUCAO_REINO, sorteador, comSombraEmbaixo).

const ARVORES_PINTADAS = new Set(["redonda", "escura", "pinheiro", "pinheiroNeve", "morta", "palmeira", "cacto", "arbusto", "cogumelo", "junco", "osso", "rocha", "rochaNeve", "cristal"]);

const CORES_DAS_ARVORES = {
  redonda: [{ copa: "#3f8f4a", fruta: "#e63946" }, { copa: "#4a9a3f", fruta: null }, { copa: "#4c9450", flor: "#ff9fc8" }],
  escura: [{ copa: "#2a6a3c" }, { copa: "#2f6a34" }, { copa: "#2a5f45", fruta: "#a98bff" }],
};

function troncoPintado(p, cx, topo, base, largura, cor = "#7a4e2a") {
  const r = rampaDe(cor);
  const meia = largura / 2;
  p.poligono([[cx - meia, topo], [cx + meia, topo], [cx + meia + 1, base - 5], [cx - meia - 1, base - 5]], r, { deslocar: 0.3 });
  // o lado da sombra e a casca
  p.poligono([[cx + meia * 0.25, topo], [cx + meia, topo], [cx + meia + 1, base - 5], [cx + meia * 0.25, base - 5]], r, { tom: 1 });
  p.linha(cx - meia + 1, topo, cx - meia, base - 6, r, 1, 4);
  for (let y = topo + 4; y < base - 8; y += 5) p.linha(cx - meia * 0.3, y, cx + meia * 0.1, y + 2, r, 1, 1);
  // as raízes
  [[-1, 7], [1, 7], [-0.4, 4], [0.5, 4]].forEach(([lado, alcance]) => {
    p.poligono([[cx + lado * meia * 0.8, base - 8], [cx + lado * (meia + alcance), base], [cx + lado * meia * 0.2, base]], r, { deslocar: lado < 0 ? 0.6 : -0.4 });
  });
}

// a copa redonda: cachos grandes (os de trás mais escuros), galhos, tufos de folha, frutas ou flores
function copaPintada(p, cx, cy, rx, ry, cores, sorte) {
  const r = rampaDe(cores.copa);
  const cachos = [];
  for (let i = 0; i < 13; i++) {
    const a = sorte() * Math.PI * 2;
    const d = Math.sqrt(sorte()) * 0.68;
    cachos.push({ x: cx + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d, r: Math.min(rx, ry) * (0.34 + sorte() * 0.16) });
  }
  cachos.push({ x: cx, y: cy - ry * 0.3, r: Math.min(rx, ry) * 0.5 });
  cachos.sort((a, b) => a.y - b.y);
  // de trás (o fundo escuro que dá profundidade)
  cachos.forEach((c) => p.elipsoide(c.x + 2, c.y + 3, c.r, c.r * 0.92, r, { brilho: false, deslocar: -1.2 }));
  // galhos entre os cachos
  const tronco = rampaDe("#6b4423");
  [[-0.5, 0.2], [0.45, 0.1], [0.05, -0.2]].forEach(([dx, dy]) => p.linha(cx, cy + ry * 0.75, cx + rx * dx, cy + ry * dy, tronco, 2, 2));
  // a frente (com menos luz chapada: quem dá a luz são as folhas)
  cachos.forEach((c, i) => {
    if (i % 3 === 0) return;
    p.elipsoide(c.x, c.y, c.r, c.r * 0.9, r, { brilho: false, deslocar: -0.45 });
  });
  // a borda recortada: folhas saindo para fora da copa, claras em cima e escuras embaixo
  for (let i = 0; i < 46; i++) {
    const a = sorte() * Math.PI * 2;
    const bx = cx + Math.cos(a) * rx * 0.86;
    const by = cy + Math.sin(a) * ry * 0.86;
    const tom = Math.sin(a) < -0.3 ? 4 : Math.cos(a) < -0.3 ? 3 : 1;
    const ox = Math.cos(a) * 4;
    const oy = Math.sin(a) * 4;
    p.poligono([[bx - oy * 0.4, by + ox * 0.4], [bx + ox, by + oy], [bx + oy * 0.4, by - ox * 0.4]], r, { tom });
  }
  // a textura: cada folha é um traço de 2 pixels com a luz de onde ela está e a sombrinha embaixo
  for (let i = 0; i < 240; i++) {
    const x = cx + (sorte() - 0.5) * rx * 2;
    const y = cy + (sorte() - 0.5) * ry * 2;
    if (!p.cheio(x, y)) continue;
    const alto = (y - cy) / ry + ((x - cx) / rx) * 0.6;
    const t = alto < -0.45 ? 5 : alto < -0.1 ? 4 : alto < 0.35 ? 3 : 2;
    p.pixel(x, y + 1, r[Math.max(0, t - 3)]);
    p.pixel(x, y, r[t]);
    p.pixel(x + (i % 2 ? 1 : -1), y - 1, r[t]);
  }
  // frutas ou flores salpicadas na frente
  const enfeite = cores.fruta || cores.flor;
  if (enfeite) {
    for (let i = 0; i < (cores.flor ? 16 : 7); i++) {
      const x = cx + (sorte() - 0.5) * rx * 1.6;
      const y = cy + (sorte() - 0.4) * ry * 1.5;
      if (!p.cheio(x, y)) continue;
      if (cores.flor) {
        const c = hexParaRgb(cores.flor);
        [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => p.pixel(x + dx, y + dy, dx || dy ? c : [255, 243, 176]));
      } else p.elipsoide(x, y, 2, 2, rampaDe(enfeite));
    }
  }
}

function pinheiroPintado(p, cx, w, h, neve, v) {
  const verde = rampaDe(neve ? "#2a6b4c" : ["#2f7a44", "#2a6e3c", "#357f48"][v]);
  const branco = rampaDe("#f2f6ff");
  const andares = 5;
  for (let a = 0; a < andares; a++) {
    const topo = 3 + a * 17 + (v === 2 ? a : 0);
    const altura = 30 + a * 2;
    const meia = 11 + a * 6 + (v === 1 ? 2 : 0);
    // a borda de baixo em serrinha (as pontas dos galhos)
    const pontos = [[cx, topo]];
    for (let k = 0; k <= 8; k++) pontos.push([cx + meia - (k * meia * 2) / 8, topo + altura - (k % 2 ? 4 : 0)]);
    p.poligono(pontos, verde, { deslocar: -0.4 });
    // o lado iluminado
    p.poligono([[cx, topo], [cx - meia * 0.2, topo + altura - 2], [cx - meia, topo + altura]], verde, { tom: 4 });
    // as agulhas: risquinhos claros
    for (let y = topo + 6; y < topo + altura - 4; y += 4) {
      const m = ((y - topo) / altura) * meia;
      for (let x = -m + 2; x < m - 2; x += 5) p.linha(cx + x, y, cx + x + 2, y + 1, verde, 1, x < 0 ? 5 : 3);
    }
    if (neve) p.poligono([[cx, topo], [cx + meia * 0.55, topo + altura * 0.45], [cx + meia * 0.2, topo + altura * 0.4], [cx - meia * 0.3, topo + altura * 0.5], [cx - meia * 0.6, topo + altura * 0.42]], branco);
  }
}

// ---------- o resto da decoração dos mapas, no mesmo pincel ----------
// Cada uma: [largura, altura, pintar(p, w, h, variante, sorte), sombra (fração da largura), folhas que caem].
// Os tamanhos são os mesmos de antes (o desenho de 16 unidades × 4), para nada mudar de lugar no mapa.
function pedraPintada(p, cx, base, rx, ry, cor, neve, musgo) {
  const r = rampaDe(cor);
  // a rocha em faces lascadas: o contorno irregular, o topo claro, a frente no meio-tom e o lado da sombra
  const topoY = base - ry * 2;
  const contorno = [[cx - rx, base], [cx - rx * 0.95, base - ry * 0.9], [cx - rx * 0.6, topoY + ry * 0.35], [cx - rx * 0.1, topoY],
    [cx + rx * 0.45, topoY + ry * 0.15], [cx + rx * 0.9, base - ry * 1.05], [cx + rx, base]];
  p.poligono(contorno, r, { tom: 2 });
  p.poligono([[cx - rx * 0.6, topoY + ry * 0.35], [cx - rx * 0.1, topoY], [cx + rx * 0.45, topoY + ry * 0.15], [cx + rx * 0.2, base - ry * 1.15], [cx - rx * 0.5, base - ry * 1.05]], r, { tom: 4 });
  p.poligono([[cx - rx, base], [cx - rx * 0.95, base - ry * 0.9], [cx - rx * 0.6, topoY + ry * 0.35], [cx - rx * 0.5, base - ry * 1.05], [cx - rx * 0.35, base]], r, { tom: 3 });
  p.poligono([[cx + rx * 0.2, base - ry * 1.15], [cx + rx * 0.45, topoY + ry * 0.15], [cx + rx * 0.9, base - ry * 1.05], [cx + rx, base], [cx + rx * 0.25, base]], r, { tom: 1 });
  // as arestas acesas, as rachaduras e o granulado
  p.linha(cx - rx * 0.6, topoY + ry * 0.35, cx - rx * 0.1, topoY, r, 1, 5);
  p.linha(cx - rx * 0.1, topoY, cx + rx * 0.45, topoY + ry * 0.15, r, 1, 5);
  p.linha(cx + rx * 0.05, base - ry * 0.9, cx + rx * 0.15, base - ry * 0.3, r, 1, 0);
  for (let i = 0; i < rx * 1.2; i++) {
    const x = cx + Math.sin(i * 12.9) * rx * 0.8;
    const y = base - ry * (0.3 + Math.abs(Math.sin(i * 7.7)) * 1.4);
    if (p.cheio(x, y)) p.pixel(x, y, r[i % 2 ? 1 : 4]);
  }
  if (musgo) p.elipsoide(cx - rx * 0.2, base - ry * 1.75, rx * 0.5, ry * 0.32, rampaDe("#5f9a3a"), { brilho: false, dentro: true, deslocar: 0.4 });
  if (neve) p.elipsoide(cx - rx * 0.05, base - ry * 1.78, rx * 0.8, ry * 0.42, rampaDe("#f2f6ff"), { dentro: true, deslocar: 0.8 });
}

const DECORACOES_PINTADAS = {
  morta: [64, 98, (p, w, h, v, sorte) => {
    const cx = w / 2;
    const r = rampaDe(["#6e6258", "#5e5148", "#7a6a5a"][v]);
    troncoPintado(p, cx, h * 0.38, h - 4, 9, ["#6e6258", "#5e5148", "#7a6a5a"][v]);
    // os galhos retorcidos, afinando, com galhinhos nas pontas
    const galho = (x0, y0, ang, comp, grossura, nivel) => {
      const x1 = x0 + Math.cos(ang) * comp;
      const y1 = y0 + Math.sin(ang) * comp;
      p.linha(x0, y0, x1, y1, r, Math.max(1, Math.round(grossura)), grossura > 2 ? 3 : 2);
      if (nivel < 3) {
        galho(x1, y1, ang - 0.5 - sorte() * 0.3, comp * 0.62, grossura * 0.6, nivel + 1);
        if (sorte() < 0.7) galho(x1, y1, ang + 0.4 + sorte() * 0.3, comp * 0.55, grossura * 0.6, nivel + 1);
      }
    };
    galho(cx, h * 0.42, -Math.PI / 2 - 0.5, 20, 4, 0);
    galho(cx, h * 0.48, -Math.PI / 2 + 0.6, 18, 3.5, 0);
    galho(cx, h * 0.38, -Math.PI / 2 + 0.05, 16, 3, 1);
    // o oco no tronco
    if (v === 1) p.elipsoide(cx - 1, h * 0.66, 2.4, 3.4, rampaDe("#1b1533"), { brilho: false });
  }, 0.24, []],
  palmeira: [80, 114, (p, w, h, v, sorte) => {
    const tronco = rampaDe("#a8783a");
    const curva = [6, -6, 3][v];
    // o tronco em anéis, curvado
    for (let i = 0; i < 16; i++) {
      const k = i / 15;
      const x = w / 2 + Math.sin(k * Math.PI * 0.8) * curva - k * curva * 0.3;
      const y = h - 6 - k * (h * 0.62);
      p.elipsoide(x, y, 4.6 - k * 1.4, 3.2, tronco, { brilho: false, deslocar: i % 2 ? -0.5 : 0.3 });
    }
    const tx = w / 2 + Math.sin(0.8 * Math.PI) * curva - curva * 0.3;
    const ty = h - 6 - h * 0.62;
    // as folhas: arcos caídos com os folíolos
    const verde = rampaDe(["#3f9a3f", "#4aa83a", "#3a8a4a"][v]);
    for (let f = 0; f < 7; f++) {
      const ang = -Math.PI / 2 + (f - 3) * 0.5;
      const comp = 24 + sorte() * 6;
      for (let s = 0; s <= 14; s++) {
        const k = s / 14;
        const x = tx + Math.cos(ang) * comp * k;
        const y = ty + Math.sin(ang) * comp * k + k * k * 18;
        p.elipsoide(x, y, 2.2 - k, 1.6, verde, { brilho: false, deslocar: f < 3 ? 0.6 : -0.3 });
        if (s % 2 === 0 && s > 2) p.linha(x, y, x + (f < 3 ? -3 : 3), y + 3, verde, 1, f < 3 ? 4 : 2);
      }
    }
    // os cocos
    [[-2, 3], [2, 4], [0, 5]].forEach(([dx, dy]) => p.elipsoide(tx + dx, ty + dy, 2.2, 2.2, rampaDe("#6b4423")));
  }, 0.22, ["#4aa83a", "#7ddc5a"]],
  cacto: [56, 90, (p, w, h, v) => {
    const r = rampaDe(["#3f9a5a", "#4a9a4a", "#3a8a5a"][v]);
    const cx = w / 2;
    // o corpo e os braços, arredondados em cima, com as costelas
    const coluna = (x, topo, base, larg) => {
      p.elipsoide(x, topo + larg, larg, larg, r, { brilho: false });
      p.poligono([[x - larg, topo + larg], [x + larg, topo + larg], [x + larg, base], [x - larg, base]], r);
      p.poligono([[x - larg, topo + larg], [x - larg * 0.2, topo + larg], [x - larg * 0.2, base], [x - larg, base]], r, { tom: 4 });
      p.poligono([[x + larg * 0.4, topo + larg], [x + larg, topo + larg], [x + larg, base], [x + larg * 0.4, base]], r, { tom: 2 });
      for (let y = topo + larg; y < base; y += 4) [-0.55, 0.05, 0.65].forEach((k) => p.pixel(x + larg * k, y, [240, 240, 220]));
    };
    coluna(cx, 8, h - 6, 8);
    if (v !== 2) {
      coluna(cx - 15, 28, 46, 5);
      p.poligono([[cx - 15, 44], [cx - 6, 44], [cx - 6, 50], [cx - 15, 50]], r, { tom: 3 });
    }
    if (v !== 1) {
      coluna(cx + 15, 22 + v * 6, 40 + v * 4, 5);
      p.poligono([[cx + 6, 38 + v * 4], [cx + 15, 38 + v * 4], [cx + 15, 44 + v * 4], [cx + 6, 44 + v * 4]], r, { tom: 2 });
    }
    // a flor no topo
    if (v === 0) [[0, 0], [-2, 1], [2, 1], [0, -2]].forEach(([dx, dy]) => p.elipsoide(cx + dx, 8 + dy, 1.8, 1.6, rampaDe(dx || dy ? "#ff7ab0" : "#ffd166")));
  }, 0.26, []],
  arbusto: [58, 42, (p, w, h, v, sorte) => {
    const cores = [{ copa: "#3f8f4a", fruta: "#4a6fd6" }, { copa: "#4a9a3f", flor: "#ffffff" }, { copa: "#3a8a46", fruta: "#e63946" }][v];
    copaPintada(p, w / 2, h * 0.56, w * 0.44, h * 0.42, cores, sorte);
  }, 0.36, []],
  cogumelo: [34, 34, (p, w, h, v) => {
    const chapeu = ["#c8283c", "#b8783a", "#8a4fd6"][v];
    [[w / 2 + 5, 1, 7], [w / 2 - 6, 0.7, 5], [w / 2 + 12, 0.55, 4]].forEach(([x, k, rx], i) => {
      if (v === 1 && i === 2) return;
      const base = h - 3 - i;
      const alto = 16 * k;
      p.poligono([[x - rx * 0.35, base - alto * 0.6], [x + rx * 0.35, base - alto * 0.6], [x + rx * 0.4, base], [x - rx * 0.4, base]], rampaDe("#efe6d2"));
      p.elipsoide(x, base - alto * 0.62, rx, rx * 0.65, rampaDe(chapeu), { ate: base - alto * 0.5 });
      if (v !== 1) [[-0.4, -0.2], [0.3, -0.35], [0.05, 0.1]].forEach(([dx, dy]) => p.elipsoide(x + dx * rx, base - alto * 0.62 + dy * rx, 0.9, 0.8, rampaDe("#ffffff"), { brilho: false }));
    });
  }, 0.4, []],
  junco: [42, 50, (p, w, h, v, sorte) => {
    const verde = rampaDe("#4a8a3a");
    for (let i = 0; i < 9; i++) {
      const x = 6 + i * 3.6 + sorte() * 2;
      const topo = 10 + sorte() * 18;
      const curva = (sorte() - 0.5) * 8;
      p.linha(x, h - 3, x + curva, topo, verde, 1, i % 2 ? 4 : 2);
      // a taboa marrom em alguns
      if (i % 3 === v) p.elipsoide(x + curva * 0.92, topo + 5, 1.6, 4, rampaDe("#6b4423"));
    }
  }, 0.36, []],
  osso: [50, 26, (p, w, h, v) => {
    const osso = rampaDe("#e8e4dc");
    const um = (x0, y0, x1, y1) => {
      p.linha(x0, y0, x1, y1, osso, 2, 3);
      [[x0, y0], [x1, y1]].forEach(([x, y]) => [-1.2, 1.2].forEach((d) => p.elipsoide(x + d * 0.4, y + d, 1.6, 1.6, osso, { brilho: false })));
    };
    um(8, h - 6, 26, h - 10);
    if (v !== 1) um(24, h - 4, 40, h - 8);
    // o crânio pequeno
    if (v !== 2) {
      p.elipsoide(38, h - 11, 6, 5, osso, { brilho: false });
      [[35.5, h - 11], [40.5, h - 11]].forEach(([x, y]) => p.elipsoide(x, y, 1.3, 1.5, rampaDe("#1b1533"), { brilho: false }));
    }
  }, 0.4, []],
  rocha: [58, 42, (p, w, h, v) => {
    pedraPintada(p, w / 2 + (v - 1) * 2, h - 3, 20 + v * 2, 12 + (v === 2 ? 2 : 0), ["#8a8b99", "#9a8f80", "#7a7f8a"][v], false, v === 1);
    if (v === 0) pedraPintada(p, w / 2 + 16, h - 2, 7, 5, "#8a8b99", false, false);
  }, 0.42, []],
  rochaNeve: [58, 42, (p, w, h, v) => {
    pedraPintada(p, w / 2 + (v - 1) * 2, h - 3, 20 + v * 2, 12, ["#8a8b99", "#7a8090", "#9a9cb0"][v], true, false);
    if (v !== 1) pedraPintada(p, w / 2 - 17, h - 2, 6, 5, "#8a8b99", true, false);
  }, 0.42, []],
  // os cristais de Umbraterra: lascas lapidadas que brilham
  cristal: [58, 90, (p, w, h, v) => {
    const cor = ["#9fe8ff", "#c08bff", "#ff9ad8"][v];
    const r = rampaDe(cor);
    [[w / 2, 6, 9], [w / 2 - 13, 34, 6], [w / 2 + 13, 28, 6.5], [w / 2 + 4, 46, 5]].forEach(([x, topo, larg]) => {
      const base = h - 4;
      p.poligono([[x, topo], [x + larg, topo + larg * 1.6], [x + larg * 0.8, base], [x - larg * 0.8, base], [x - larg, topo + larg * 1.6]], r, { tom: 2 });
      p.poligono([[x, topo], [x - larg, topo + larg * 1.6], [x - larg * 0.8, base], [x - larg * 0.1, base]], r, { tom: 4 });
      p.poligono([[x, topo], [x + larg, topo + larg * 1.6], [x + larg * 0.3, topo + larg * 1.6]], r, { tom: 5 });
      p.linha(x - larg * 0.4, topo + larg * 2, x - larg * 0.3, base - 4, r, 1, 5);
    });
  }, 0.36, []],
};

// ---------- as fontes e os postes de luz ----------
// A fonte: a bacia de pedra com friso e a água com reflexo, a coluna com a taça de cima e o orbe de cristal
// no alto. O poste: base de ferro batido, a haste com anéis, os arabescos e a lanterna de vidro com telhado.
// W e H em pixels do desenho (resolução 2); a animação (animarFontePintada, animarPostePintado) desenha os
// jatos d'água, as ondas, a chama e o brilho por cima, no mesmo tamanho do desenho.
function fontePintada(W, H) {
  return lembrarBestiario(`fonte|${W}|${H}`, () => {
    const p = pintura(W, H);
    const pedra = rampaDe("#a3a6c2");
    const agua = rampaDe("#3f8fd6");
    const cx = W / 2;
    const by = H * 0.72;
    const rx = W * 0.46;
    const ry = H * 0.19;
    // a bacia: a borda externa, a parede da frente e o friso
    p.elipsoide(cx, by + ry * 0.55, rx, ry * 1.05, pedra, { brilho: false, deslocar: -0.6 });
    p.poligono([[cx - rx, by], [cx + rx, by], [cx + rx, by + ry * 0.65], [cx - rx, by + ry * 0.65]], pedra, { tom: 2 });
    for (let x = cx - rx + 3; x < cx + rx - 2; x += 6) p.linha(x, by + 2, x, by + ry * 0.6, pedra, 1, 1);
    p.elipsoide(cx, by, rx, ry, pedra, { brilho: false });
    // a água da bacia, com o reflexo
    p.elipsoide(cx, by + 1, rx * 0.86, ry * 0.72, agua, { brilho: false, deslocar: 0.2 });
    p.elipsoide(cx - rx * 0.3, by - ry * 0.15, rx * 0.25, ry * 0.18, rampaDe("#a7dcff"), { brilho: false, alfa: 160, dentro: true });
    // a coluna com o anel do meio
    const topo = H * 0.32;
    p.poligono([[cx - 5, by - 2], [cx + 5, by - 2], [cx + 3.5, topo + 6], [cx - 3.5, topo + 6]], pedra, { deslocar: 0.3 });
    p.poligono([[cx + 1, by - 2], [cx + 5, by - 2], [cx + 3.5, topo + 6], [cx + 1, topo + 6]], pedra, { tom: 1 });
    p.elipsoide(cx, (by + topo) / 2 + 4, 6.5, 2.2, pedra, { brilho: false });
    // a taça de cima com água
    p.elipsoide(cx, topo + 5, W * 0.17, H * 0.055, pedra, { brilho: false, deslocar: -0.5 });
    p.elipsoide(cx, topo + 3, W * 0.17, H * 0.05, pedra, { brilho: false });
    p.elipsoide(cx, topo + 3.4, W * 0.13, H * 0.032, agua, { brilho: false, deslocar: 0.4 });
    // o pedestal do orbe
    p.poligono([[cx - 2.5, topo + 3], [cx + 2.5, topo + 3], [cx + 1.5, topo - 5], [cx - 1.5, topo - 5]], rampaDe("#f5c451"));
    const pronto = comSombraEmbaixo(p.pronto(), W / 2 + 1, by + ry * 0.9, rx * 1.02);
    pronto.res = RESOLUCAO_REINO;
    pronto.acabado = true;
    pronto.folhas = [];
    pronto.fonte = { cx: cx + 1, by: by + 1, rx, ry, topo: topo + 1 };
    return pronto;
  });
}

function animarFontePintada(ctx, x, y, t, sprite) {
  const f = sprite.fonte;
  if (!f) return;
  const k = 1 / (sprite.res || 2);
  const px = (hx, hy, cor, a = 1, s = 1) => {
    if (a <= 0.03) return;
    ctx.fillStyle = cor.startsWith("#") ? cor : `rgba(${cor}, ${a})`;
    ctx.globalAlpha = cor.startsWith("#") ? a : 1;
    ctx.fillRect(x + hx * k, y + hy * k, s * k, s * k);
    ctx.globalAlpha = 1;
  };
  // o orbe de cristal flutuando e girando a luz
  const orboY = f.topo - 11 + Math.sin(t * 2) * 1.5;
  brilhoRedondo(ctx, x + f.cx * k, y + orboY * k, 6, "110, 240, 255", 0.08 + Math.sin(t * 3) * 0.03);
  for (let dy = -4; dy <= 4; dy++) {
    const meia = 4 - Math.abs(dy);
    for (let dx = -meia; dx <= meia; dx++) px(f.cx + dx, orboY + dy, dx + dy < -2 ? "#e6fdff" : dx + dy < 2 ? "#6ef0ff" : "#2fa8d8");
  }
  // os jatos: do topo para a taça e da taça para a bacia, em arcos de gotas
  for (let lado = -1; lado <= 1; lado += 2) {
    for (let i = 0; i < 8; i++) {
      const fase = (t * 1.4 + i / 8) % 1;
      const ax = f.cx + lado * fase * 9;
      const ay = f.topo - 4 - Math.sin(fase * Math.PI) * 6 + fase * 6;
      px(ax, ay, fase < 0.5 ? "#e6fdff" : "#a7dcff", 1, 1);
    }
    for (let i = 0; i < 10; i++) {
      const fase = (t * 1.1 + i / 10) % 1;
      const ax = f.cx + lado * (f.rx * 0.32 + fase * f.rx * 0.45);
      const ay = f.topo + 4 - Math.sin(fase * Math.PI) * 4 + fase * (f.by - f.topo - 4);
      px(ax, ay, i % 2 ? "#d6f4ff" : "#7fc3e8", 1, 1);
    }
  }
  // as ondas abrindo onde a água cai, e os brilhos na superfície
  for (let onda = 0; onda < 2; onda++) {
    const fase = (t * 0.8 + onda * 0.5) % 1;
    const rr = 4 + fase * f.rx * 0.5;
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      px(f.cx + Math.cos(ang) * rr, f.by + Math.sin(ang) * rr * (f.ry / f.rx), "214, 244, 255", (1 - fase) * 0.7);
    }
  }
  for (let i = 0; i < 5; i++) {
    if (Math.sin(t * 3 + i * 2.1) < 0.6) continue;
    px(f.cx + Math.sin(i * 4.1) * f.rx * 0.65, f.by + Math.cos(i * 2.7) * f.ry * 0.45, "#ffffff");
  }
}

function postePintado(W, H, cor = "#ffd96b") {
  return lembrarBestiario(`poste|${W}|${H}|${cor}`, () => {
    const p = pintura(W, H);
    const ferro = rampaDe("#3d3a5a");
    const ouro = rampaDe("#c9952a");
    const cx = W / 2;
    // a base em degraus
    p.poligono([[cx - W * 0.4, H - 1], [cx + W * 0.4, H - 1], [cx + W * 0.3, H - H * 0.07], [cx - W * 0.3, H - H * 0.07]], ferro);
    p.poligono([[cx - W * 0.25, H - H * 0.07], [cx + W * 0.25, H - H * 0.07], [cx + W * 0.13, H - H * 0.15], [cx - W * 0.13, H - H * 0.15]], ferro, { deslocar: 0.4 });
    // a haste com os anéis dourados
    const topoHaste = H * 0.3;
    p.poligono([[cx - 1.6, H - H * 0.15], [cx + 1.6, H - H * 0.15], [cx + 1.2, topoHaste], [cx - 1.2, topoHaste]], ferro);
    p.linha(cx - 1, H - H * 0.15, cx - 0.8, topoHaste, ferro, 1, 5);
    [0.62, 0.42].forEach((k) => p.elipsoide(cx, H * k, 3, 1.4, ouro, { brilho: false }));
    // os arabescos de ferro segurando a lanterna
    [-1, 1].forEach((lado) => {
      for (let s = 0; s <= 10; s++) {
        const a = (s / 10) * Math.PI * 1.3;
        p.pixel(cx + lado * (2 + Math.sin(a) * W * 0.22), topoHaste + 2 - Math.cos(a) * 4 + s * 0.4, ferro[3]);
      }
    });
    // a lanterna: telhado, a gaiola com os vidros acesos e o pingente embaixo
    const l0 = H * 0.09;
    const l1 = topoHaste;
    const meia = W * 0.3;
    p.poligono([[cx - meia - 2, l0 + 3], [cx + meia + 2, l0 + 3], [cx, l0 - H * 0.05]], ferro, { deslocar: 0.3 });
    p.elipsoide(cx, l0 - H * 0.055, 1.6, 1.6, ouro);
    p.poligono([[cx - meia, l0 + 3], [cx + meia, l0 + 3], [cx + meia * 0.8, l1], [cx - meia * 0.8, l1]], ferro);
    const vidro = rampaDe(cor);
    p.poligono([[cx - meia + 1.5, l0 + 4.5], [cx - 0.6, l0 + 4.5], [cx - 0.6, l1 - 1.5], [cx - meia * 0.8 + 1.5, l1 - 1.5]], vidro, { tom: 4 });
    p.poligono([[cx + 0.6, l0 + 4.5], [cx + meia - 1.5, l0 + 4.5], [cx + meia * 0.8 - 1.5, l1 - 1.5], [cx + 0.6, l1 - 1.5]], vidro, { tom: 3 });
    p.pixel(cx - meia + 2, l0 + 5, [255, 255, 255]);
    p.elipsoide(cx, l1 + 1.2, meia * 0.7, 1.4, ferro, { brilho: false });
    const pronto = comSombraEmbaixo(p.pronto(), W / 2 + 1, H - 1, W * 0.34);
    pronto.res = RESOLUCAO_REINO;
    pronto.acabado = true;
    pronto.folhas = [];
    pronto.poste = { cx: cx + 1, chama: (l0 + l1) / 2 + 2, cor };
    return pronto;
  });
}

function animarPostePintado(ctx, x, y, t, sprite, semente = 0) {
  const pp = sprite.poste;
  if (!pp) return;
  const k = 1 / (sprite.res || 2);
  const rgb = hexParaRgb(pp.cor).join(", ");
  const tremor = Math.sin(t * 9 + semente) * 0.5 + Math.sin(t * 23 + semente * 3) * 0.3;
  // o brilho em volta da lanterna e a chama dentro dela, tremulando
  brilhoRedondo(ctx, x + pp.cx * k, y + pp.chama * k, 9 + tremor, rgb, 0.08 + tremor * 0.02);
  const fy = y + (pp.chama - 2) * k;
  ctx.fillStyle = "#fff3b0";
  ctx.fillRect(x + (pp.cx - 0.5) * k, fy, k, (3 + tremor) * k);
  ctx.fillStyle = pp.cor;
  ctx.fillRect(x + (pp.cx - 1) * k, fy + 1.5 * k, 2 * k, 2 * k);
  // as mariposas rodando a luz
  for (let i = 0; i < 2; i++) {
    const a = t * (2.4 + i) + semente + i * 3;
    ctx.fillStyle = "rgba(240, 230, 210, 0.8)";
    ctx.fillRect(x + (pp.cx + Math.cos(a) * 7) * k, y + (pp.chama + Math.sin(a * 1.3) * 5) * k, k, k);
  }
}

// a árvore pronta (canvas na resolução do Reino, com sombra no chão e as cores das folhas que caem)
function arvorePintada(tipo, variante = 0) {
  return lembrarBestiario(`arvore|${tipo}|${variante}`, () => {
    const sorte = sorteador(97 + variante * 131 + tipo.length * 7);
    let w;
    let h;
    let p;
    let folhas;
    if (DECORACOES_PINTADAS[tipo]) {
      const [lw, lh, pintar, sombra, caem] = DECORACOES_PINTADAS[tipo];
      [w, h] = [lw, lh];
      p = pintura(w, h);
      pintar(p, w, h, variante, sorte);
      const pronto = comSombraEmbaixo(p.pronto(), w / 2 + 1, h - 2, w * sombra);
      pronto.res = RESOLUCAO_REINO;
      pronto.acabado = true;
      pronto.folhas = caem;
      return pronto;
    }
    if (tipo === "pinheiro" || tipo === "pinheiroNeve") {
      [w, h] = [78, 134];
      p = pintura(w, h);
      const cx = w / 2;
      troncoPintado(p, cx, h - 34, h - 6, 9);
      pinheiroPintado(p, cx, w, h, tipo === "pinheiroNeve", variante);
      folhas = tipo === "pinheiroNeve" ? ["#ffffff", "#e8f2ff"] : ["#3f8a55", "#2f6e3c"];
    } else if (tipo === "vaso") {
      // a árvore de vaso do Salão: copa redonda num vaso de pedra
      [w, h] = [64, 92];
      p = pintura(w, h);
      const cx = w / 2;
      troncoPintado(p, cx, 50, 78, 7);
      const cores = [{ copa: "#3b7d3a" }, { copa: "#3f8a48", flor: "#ff9fc8" }, { copa: "#357a46", fruta: "#ffd166" }][variante];
      copaPintada(p, cx, 32, 27, 25, cores, sorte);
      const pedra = rampaDe("#9a9cb0");
      p.poligono([[cx - 15, 74], [cx + 15, 74], [cx + 12, 91], [cx - 12, 91]], pedra);
      p.elipsoide(cx, 74, 17, 3.2, pedra, { brilho: false, deslocar: 0.7 });
      p.elipsoide(cx, 74, 13, 1.6, rampaDe("#5c3a20"), { brilho: false });
      folhas = cores.flor ? ["#ff9fc8", "#ffd1e4"] : ["#6fbf4a", "#a7e06b", "#e8c050"];
    } else {
      const escura = tipo === "escura";
      [w, h] = escura ? [104, 142] : [98, 132];
      p = pintura(w, h);
      const cx = w / 2;
      const cores = CORES_DAS_ARVORES[escura ? "escura" : "redonda"][variante];
      troncoPintado(p, cx, h * 0.5, h - 6, escura ? 13 : 11, escura ? "#5a3a1e" : "#7a4e2a");
      copaPintada(p, cx, h * 0.36, w * 0.43, h * 0.3, cores, sorte);
      folhas = cores.flor ? ["#ff9fc8", "#ffd1e4", "#ffffff"] : escura ? ["#3f7a3a", "#5f8a2a", "#8a6a2a"] : ["#6fbf4a", "#a7e06b", "#e8c050", "#d0782a"];
    }
    const pronto = comSombraEmbaixo(p.pronto(), w / 2 + 1, h - 3, w * (tipo === "vaso" ? 0.22 : 0.3));
    pronto.res = RESOLUCAO_REINO;
    pronto.acabado = true;
    pronto.folhas = folhas;
    return pronto;
  });
}
