// O bestiário em pixel art: os monstros desenhados por código com volume de verdade. Cada parte do corpo é
// uma forma (elipsoide, polígono, osso) pintada com uma rampa de 6 tons da cor dela (sombra fria, luz quente),
// com pontilhado de pixel na passagem de um tom para o outro, brilho onde a luz bate em cheio e o contorno
// colorido do herói. Cada monstro sai em quadros de animação (o slime borbulha, o sapo infla o papo, o
// morcego bate as asas, o fogo-fátuo tremula, a assombração ondula, o escorpião anda e balança a cauda, o
// esqueleto bate a mandíbula). "escala" desenha o mesmo bicho maior, com mais detalhe (os chefões), e
// "coroa" põe a coroa do rei. Tudo fica guardado: cada combinação é desenhada uma vez só.
// Depende de pixel.js (criarTela, tom, hexParaRgb, contornar).

const LUZ_BESTIARIO = (() => {
  const l = [-0.55, -0.65, 0.55];
  const n = Math.hypot(...l);
  return l.map((v) => v / n);
})();
const BAYER_BESTIARIO = [[0, 2], [3, 1]];
const cacheBestiario = new Map();

function lembrarBestiario(chave, criar) {
  if (!cacheBestiario.has(chave)) cacheBestiario.set(chave, criar());
  return cacheBestiario.get(chave);
}

const misturarRgb = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));

// os 6 tons de uma cor: sombra bem escura puxando para o roxo, sombra, meio-tom, a cor, luz e brilho quente
function rampaDe(cor) {
  return lembrarBestiario(`rampa|${cor}`, () => {
    const base = hexParaRgb(cor);
    const roxo = [27, 16, 54];
    const quente = [255, 243, 200];
    return [
      misturarRgb(hexParaRgb(tom(cor, 0.3)), roxo, 0.35),
      misturarRgb(hexParaRgb(tom(cor, 0.5)), roxo, 0.2),
      hexParaRgb(tom(cor, 0.74)),
      base,
      misturarRgb(hexParaRgb(tom(cor, 1.22)), quente, 0.12),
      misturarRgb(hexParaRgb(tom(cor, 1.5)), [255, 255, 255], 0.25),
    ];
  });
}

// a luz (de -1 a 1) vira um dos tons da rampa, com o pontilhado 2 x 2 na borda entre dois tons
function tomDaLuz(luz, x, y, n, deslocar = 0) {
  const v = (luz * 0.5 + 0.5) * (n - 1) + deslocar + (BAYER_BESTIARIO[y & 1][x & 1] - 1.5) * 0.2;
  return Math.max(0, Math.min(n - 1, Math.round(v)));
}

// uma tela de pintura: pinta direto nos bytes (rápido) e no fim ganha o contorno colorido
function pintura(largura, altura) {
  const w = Math.round(largura) + 2;
  const h = Math.round(altura) + 2;
  const px = new Uint8ClampedArray(w * h * 4);
  const p = {
    w, h,
    pixel(x, y, rgb, alfa = 255) {
      const xi = Math.floor(x) + 1;
      const yi = Math.floor(y) + 1;
      if (xi < 0 || yi < 0 || xi >= w || yi >= h) return;
      const i = (yi * w + xi) * 4;
      if (alfa < 255 && px[i + 3]) {
        const k = alfa / 255;
        px[i] = px[i] + (rgb[0] - px[i]) * k;
        px[i + 1] = px[i + 1] + (rgb[1] - px[i + 1]) * k;
        px[i + 2] = px[i + 2] + (rgb[2] - px[i + 2]) * k;
        return;
      }
      px[i] = rgb[0];
      px[i + 1] = rgb[1];
      px[i + 2] = rgb[2];
      px[i + 3] = alfa;
    },
    cheio(x, y) {
      const xi = Math.floor(x) + 1;
      const yi = Math.floor(y) + 1;
      return xi >= 0 && yi >= 0 && xi < w && yi < h && px[(yi * w + xi) * 4 + 3] > 0;
    },
    // uma forma redonda com volume: o normal da esfera dá a luz de cada pixel
    elipsoide(cx, cy, rx, ry, rampa, op = {}) {
      const n = rampa.length;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        if (op.ate !== undefined && y > op.ate) continue;
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx;
          const dy = (y + 0.5 - cy) / ry;
          const d = dx * dx + dy * dy;
          if (d > 1) continue;
          if (op.dentro && !p.cheio(x, y)) continue;
          const nz = Math.sqrt(1 - d);
          const luz = dx * LUZ_BESTIARIO[0] + dy * LUZ_BESTIARIO[1] + nz * LUZ_BESTIARIO[2];
          let cor = rampa[tomDaLuz(luz, x, y, n, op.deslocar || 0)];
          if (op.brilho !== false && luz > 0.94 - (op.brilhoMaior || 0)) cor = [255, 255, 255];
          p.pixel(x, y, cor, op.alfa ?? 255);
        }
      }
    },
    // um polígono chato (asas, orelhas, chamas): o tom vem da altura dentro dele (mais claro em cima)
    poligono(pontos, rampa, op = {}) {
      const ys = pontos.map(([, y]) => y);
      const y0 = Math.floor(Math.min(...ys));
      const y1 = Math.ceil(Math.max(...ys));
      for (let y = y0; y <= y1; y++) {
        const cruzamentos = [];
        for (let i = 0; i < pontos.length; i++) {
          const [xa, ya] = pontos[i];
          const [xb, yb] = pontos[(i + 1) % pontos.length];
          const yy = y + 0.5;
          if ((ya <= yy && yb > yy) || (yb <= yy && ya > yy)) cruzamentos.push(xa + ((yy - ya) / (yb - ya)) * (xb - xa));
        }
        cruzamentos.sort((a, b) => a - b);
        for (let k = 0; k + 1 < cruzamentos.length; k += 2) {
          for (let x = Math.round(cruzamentos[k]); x < Math.round(cruzamentos[k + 1]); x++) {
            const subida = (y - y0) / Math.max(1, y1 - y0);
            const i = op.tom ?? tomDaLuz(0.4 - subida * 0.9, x, y, rampa.length, op.deslocar || 0);
            p.pixel(x, y, rampa[i], op.alfa ?? 255);
          }
        }
      }
    },
    // uma linha grossa (ossos, patas, cordas), com a luz de um lado
    linha(x0, y0, x1, y1, rampa, grossura = 1, tomBase = 3) {
      const passos = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
      for (let s = 0; s <= passos; s++) {
        const x = x0 + ((x1 - x0) * s) / passos;
        const y = y0 + ((y1 - y0) * s) / passos;
        for (let g = 0; g < grossura; g++) {
          const i = Math.max(0, Math.min(rampa.length - 1, tomBase + (g === 0 && grossura > 1 ? 1 : 0) - (g === grossura - 1 && grossura > 2 ? 1 : 0)));
          p.pixel(x + g, y, rampa[i]);
        }
      }
    },
    pronto() {
      const { canvas, ctx } = criarTela(w, h);
      ctx.putImageData(new ImageData(px, w, h), 0, 0);
      return contornar(canvas, "auto");
    },
  };
  return p;
}

// a coroa do rei (de qualquer bicho): ouro com gemas, do tamanho da escala
function coroaNoBestiario(p, cx, base, s) {
  const ouro = rampaDe("#f5c451");
  const larg = 9 * s;
  p.poligono([[cx - larg / 2, base], [cx + larg / 2, base], [cx + larg / 2, base - 3 * s], [cx + larg * 0.32, base - 5.5 * s], [cx + larg * 0.16, base - 3 * s],
    [cx, base - 6.5 * s], [cx - larg * 0.16, base - 3 * s], [cx - larg * 0.32, base - 5.5 * s], [cx - larg / 2, base - 3 * s]], ouro);
  p.linha(cx - larg / 2, base - 0.5, cx + larg / 2, base - 0.5, ouro, Math.max(1, Math.round(s)), 2);
  [[-0.32, 5.5, "#e63946"], [0, 6.5, "#6ef0ff"], [0.32, 5.5, "#e63946"]].forEach(([k, alto, gema]) => {
    p.elipsoide(cx + larg * k, base - alto * s + 0.8 * s, Math.max(0.8, 0.9 * s), Math.max(0.8, 0.9 * s), rampaDe(gema));
  });
}

function olhoDeBicho(p, x, y, s, { rx = 2, ry = 2.6, iris = "#1b1533", aceso = false, piscando = false, branco = "#f6f4ff" } = {}) {
  if (piscando) {
    p.linha(x - rx * s, y + 0.3 * s, x + rx * s, y + 0.3 * s, rampaDe("#1b1533"), Math.max(1, Math.round(0.8 * s)), 3);
    return;
  }
  p.elipsoide(x, y, rx * s, ry * s, rampaDe(branco), { brilho: false });
  p.elipsoide(x + 0.2 * s, y + 0.2 * s, rx * 0.72 * s, ry * 0.74 * s, rampaDe(iris), { brilho: false, deslocar: aceso ? 1 : 0.6 });
  // o brilho do olho (dois pontinhos), que dá vida
  p.pixel(x - 0.4 * s, y - 0.9 * s, [255, 255, 255]);
  p.pixel(x + 0.8 * s, y + 0.9 * s, [220, 230, 255]);
  if (s >= 2) p.pixel(x - 0.4 * s + 1, y - 0.9 * s, [255, 255, 255]);
}

// ---------- o slime: gosma brilhante, núcleo por dentro, bolhas subindo e a pontinha balançando ----------
function slimeArte(cor, { escala = 1, coroa = false } = {}) {
  return lembrarBestiario(`slime|${cor}|${escala}|${coroa}`, () => Array.from({ length: 8 }, (_, q) => {
    const s = escala;
    const f = q / 8;
    const onda = Math.sin(f * Math.PI * 2);
    const W = 32 * s;
    const H = (coroa ? 35 : 28) * s;
    const p = pintura(W, H);
    const r = rampaDe(cor);
    const base = H - 3 * s;
    const rx = 13.5 * s * (1 + onda * 0.05);
    const ry = 10.5 * s * (1 - onda * 0.06);
    const cx = W / 2;
    const cy = base - ry * 0.86;
    p.elipsoide(cx, base + 0.6 * s, rx * 0.98, 1.8 * s, rampaDe(tom(cor, 0.6)), { brilho: false, deslocar: -1 });
    p.elipsoide(cx, cy, rx, ry, r, { ate: Math.round(base), brilhoMaior: 0.04 });
    p.elipsoide(cx + onda * 1.4 * s, cy - ry * 0.92, 3 * s, 3.4 * s, r);
    // o núcleo mais escuro, visto através da gosma
    p.elipsoide(cx + 2.5 * s, cy + 2.2 * s, rx * 0.36, ry * 0.34, r, { deslocar: -1.3, brilho: false, dentro: true });
    // as bolhas subindo por dentro
    for (let k = 0; k < 3; k++) {
      const fase = (f + k / 3) % 1;
      const bx = cx + (k - 1) * 5 * s + Math.sin(fase * 6 + k) * s;
      const by = base - 2.5 * s - fase * ry * 1.4;
      if (!p.cheio(bx, by)) continue;
      const rb = Math.max(1, 0.9 * s);
      p.elipsoide(bx, by, rb, rb, r, { deslocar: 1.6, dentro: true });
    }
    // os olhos, a boca e as bochechas
    const piscando = q === 6;
    olhoDeBicho(p, cx - 4.5 * s, cy + 0.6 * s, s, { piscando });
    olhoDeBicho(p, cx + 4.5 * s, cy + 0.6 * s, s, { piscando });
    const boca = rampaDe(tom(cor, 0.3));
    for (let i = -2; i <= 2; i++) p.pixel(cx + i * 0.7 * s, cy + 5 * s + (Math.abs(i) === 2 ? -0.7 * s : 0), boca[1]);
    [[-8, 3.4], [8, 3.4]].forEach(([dx, dy]) => p.elipsoide(cx + dx * s, cy + dy * s, 1.6 * s, 0.9 * s, rampaDe("#ff8fb0"), { brilho: false, alfa: 170 }));
    if (coroa) coroaNoBestiario(p, cx, cy - ry * 0.85, s * 1.2);
    return p.pronto();
  }));
}

// ---------- o sapo: papo inflando, olhos piscando, manchas nas costas ----------
function sapoArte(pele = "#4c9a2a", barriga = "#c8f59a", { escala = 1, coroa = false } = {}) {
  return lembrarBestiario(`sapo|${pele}|${barriga}|${escala}|${coroa}`, () => Array.from({ length: 6 }, (_, q) => {
    const s = escala;
    const f = q / 6;
    const papo = Math.max(0, Math.sin(f * Math.PI * 2));
    const W = 34 * s;
    const H = (coroa ? 32 : 26) * s;
    const p = pintura(W, H);
    const r = rampaDe(pele);
    const cx = W / 2;
    const base = H - 2 * s;
    // as patas de trás dobradas e as da frente
    [-1, 1].forEach((lado) => p.elipsoide(cx + lado * 10 * s, base - 3.2 * s, 5.2 * s, 3.6 * s, r, { deslocar: -0.6 }));
    p.elipsoide(cx, base - 7 * s, 13 * s, 8 * s, r, { ate: Math.round(base - 1 * s) });
    // as manchas das costas
    [[-6, -11, 1.8], [3, -12.5, 1.4], [8, -9, 1.2], [-2, -8.5, 1]].forEach(([dx, dy, rr]) => p.elipsoide(cx + dx * s, base + dy * s, rr * s, rr * 0.8 * s, r, { deslocar: -1.5, brilho: false, dentro: true }));
    // a barriga e o papo, que infla
    p.elipsoide(cx, base - 3.5 * s + papo * 0.6 * s, 9 * s, (4.2 + papo * 1.6) * s, rampaDe(barriga), { brilho: false });
    [-1, 1].forEach((lado) => p.elipsoide(cx + lado * 6 * s, base - 0.8 * s, 2.4 * s, 1.4 * s, r));
    // a boca larga
    const boca = rampaDe(tom(pele, 0.35));
    for (let i = -9; i <= 9; i++) p.pixel(cx + i * s, base - 8 * s + Math.round((i * i) / 40) * s * 0.6, boca[1]);
    // os olhos em cima, em cúpula
    [-1, 1].forEach((lado) => {
      const ox = cx + lado * 7 * s;
      const oy = base - 14 * s;
      p.elipsoide(ox, oy, 3.8 * s, 3.6 * s, r);
      if (q === 4) p.linha(ox - 2.4 * s, oy, ox + 2.4 * s, oy, boca, Math.max(1, Math.round(0.8 * s)), 1);
      else {
        p.elipsoide(ox, oy - 0.3 * s, 2.5 * s, 2.5 * s, rampaDe("#fff4b8"), { brilho: false });
        p.linha(ox - 1.3 * s, oy, ox + 1.3 * s, oy, rampaDe("#1b1533"), Math.max(1, Math.round(1.1 * s)), 2);
        p.pixel(ox - 1 * s, oy - 1.3 * s, [255, 255, 255]);
      }
    });
    if (coroa) coroaNoBestiario(p, cx, base - 16.5 * s, s * 1.1);
    return p.pronto();
  }));
}

// ---------- o morcego: asas com membrana e ossos batendo, olhos vermelhos acesos ----------
function morcegoArte(corpo = "#3d2c5c") {
  return lembrarBestiario(`morcego|${corpo}`, () => Array.from({ length: 6 }, (_, q) => {
    const f = q / 6;
    const bate = Math.sin(f * Math.PI * 2);
    const W = 36;
    const H = 24;
    const p = pintura(W, H);
    const r = rampaDe(corpo);
    const membrana = rampaDe(tom(corpo, 0.8));
    const cx = W / 2;
    const cy = 13;
    [-1, 1].forEach((lado) => {
      const ombro = [cx + lado * 3, cy - 2];
      const ponta = [cx + lado * 17, cy - 3 - bate * 8];
      const meio = [cx + lado * 11, cy - 4 - bate * 5];
      const pontos = [ombro, meio, ponta, [cx + lado * 14, cy + 3 - bate * 3], [cx + lado * 11, cy + 1 - bate * 2], [cx + lado * 8, cy + 4 - bate], [cx + lado * 5, cy + 3]];
      p.poligono(lado < 0 ? pontos : pontos, membrana);
      p.linha(ombro[0], ombro[1], meio[0], meio[1], r, 1, 4);
      p.linha(meio[0], meio[1], ponta[0], ponta[1], r, 1, 4);
      p.linha(meio[0], meio[1], cx + lado * 11, cy + 1 - bate * 2, r, 1, 3);
    });
    p.elipsoide(cx, cy + 1, 4.5, 5.5, r);
    p.elipsoide(cx, cy - 4.5, 4, 3.6, r);
    [-1, 1].forEach((lado) => p.poligono([[cx + lado * 1.5, cy - 7], [cx + lado * 4.5, cy - 7], [cx + lado * 3.5, cy - 11]], r));
    [-1.6, 1.6].forEach((dx) => {
      p.elipsoide(cx + dx, cy - 4.5, 1, 1, rampaDe("#ff3b5c"), { deslocar: 1 });
    });
    p.pixel(cx - 1, cy - 2, [255, 255, 255]);
    p.pixel(cx + 1, cy - 2, [255, 255, 255]);
    p.linha(cx - 2, cy + 6.5, cx - 1, cy + 7.5, r, 1, 1);
    p.linha(cx + 2, cy + 6.5, cx + 1, cy + 7.5, r, 1, 1);
    return p.pronto();
  }));
}

// ---------- o fogo-fátuo: chama em três camadas tremulando, com rostinho e faíscas ----------
function fogoFatuoArte(cor = "#2fd6e8", { escala = 1 } = {}) {
  return lembrarBestiario(`fogo|${cor}|${escala}`, () => Array.from({ length: 6 }, (_, q) => {
    const s = escala;
    const f = q / 6;
    const W = 22 * s;
    const H = 28 * s;
    const p = pintura(W, H);
    const cx = W / 2;
    const fora = rampaDe(cor);
    const meio = rampaDe(tom(cor, 1.45));
    const dentro = rampaDe("#ffffff");
    const camadas = [[1, fora, 0.6], [0.66, meio, 1.4], [0.36, dentro, 2]];
    camadas.forEach(([k, rampa, claro], c) => {
      const baseY = 19 * s + (1 - k) * 2 * s;
      const raio = 7.5 * s * k;
      const topo = 2 * s + (1 - k) * 8 * s;
      for (let y = Math.floor(topo); y < H; y++) {
        // a gota: redonda e gorda embaixo, afinando em ponta em cima, a ponta balançando
        const subida = (baseY - y) / (baseY - topo);
        const meia = y > baseY ? Math.sqrt(Math.max(0, raio * raio - (y - baseY) ** 2)) : raio * Math.max(0, 1 - subida) ** 0.55;
        const desvio = Math.sin(y * 0.5 / s + f * Math.PI * 2 + c * 0.7) * 1.8 * s * Math.max(0, subida) ** 1.2;
        for (let x = Math.floor(cx - meia + desvio); x <= Math.ceil(cx + meia + desvio); x++) {
          const borda = Math.abs(x + 0.5 - cx - desvio) / Math.max(0.5, meia);
          p.pixel(x, y, rampa[tomDaLuz(0.5 - borda * 1.1, x, y, rampa.length, claro)]);
        }
      }
    });
    // o rostinho
    const k = rampaDe("#16405a");
    p.elipsoide(cx - 2.2 * s, 18 * s, 0.9 * s, 1.3 * s, k, { brilho: false });
    p.elipsoide(cx + 2.2 * s, 18 * s, 0.9 * s, 1.3 * s, k, { brilho: false });
    p.elipsoide(cx, 21.5 * s, (0.6 + (q % 3) * 0.3) * s, (0.7 + (q % 3) * 0.3) * s, k, { brilho: false });
    // as faíscas subindo
    for (let i = 0; i < 3; i++) {
      const fase = (f + i / 3) % 1;
      p.pixel(cx + (i - 1) * 4 * s + Math.sin(fase * 7) * s, 4 * s - fase * 4 * s + 4 * s, fora[4]);
    }
    return p.pronto();
  }));
}

// ---------- a assombração: o lençol ondulando, olhos ocos acesos e braços de névoa ----------
function assombracaoArte(cor = "#dfe9ff", { escala = 1 } = {}) {
  return lembrarBestiario(`fantasma|${cor}|${escala}`, () => Array.from({ length: 6 }, (_, q) => {
    const s = escala;
    const f = q / 6;
    const W = 26 * s;
    const H = 32 * s;
    const p = pintura(W, H);
    const r = rampaDe(cor);
    const cx = W / 2;
    // os braços de névoa, atrás
    [-1, 1].forEach((lado) => p.elipsoide(cx + lado * (9 + Math.sin(f * Math.PI * 2 + lado) * 1.2) * s, 15 * s + Math.sin(f * Math.PI * 2 + lado) * s, 3 * s, 2 * s, r, { deslocar: -0.4 }));
    // o corpo: a cabeça redonda e o lençol descendo, com a barra ondulando
    for (let y = Math.floor(2 * s); y < H; y++) {
      const naCabeca = y < 11 * s;
      const meia = naCabeca ? Math.sqrt(Math.max(0, (8.5 * s) ** 2 - (y - 10.5 * s) ** 2)) : 8.5 * s + (y - 11 * s) * 0.08;
      for (let x = Math.floor(cx - meia); x <= Math.ceil(cx + meia); x++) {
        const barra = 26 * s + Math.sin((x / s) * 0.8 + f * Math.PI * 2) * 2 * s;
        if (y > barra) continue;
        const nx = (x + 0.5 - cx) / Math.max(1, meia);
        const ny = naCabeca ? (y - 10.5 * s) / (8.5 * s) : 0.15;
        const nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny));
        const luz = nx * LUZ_BESTIARIO[0] + ny * LUZ_BESTIARIO[1] + nz * LUZ_BESTIARIO[2] - (y > barra - 3 * s ? 0.35 : 0);
        p.pixel(x, y, r[tomDaLuz(luz, x, y, r.length, 0.2)]);
      }
    }
    // os olhos ocos com a luz azul dentro e a boca
    const oco = rampaDe("#1b1533");
    [-3.3, 3.3].forEach((dx) => {
      p.elipsoide(cx + dx * s, 10 * s, 1.9 * s, 2.6 * s, oco, { brilho: false });
      p.elipsoide(cx + dx * s, 10.6 * s, 0.9 * s, 1 * s, rampaDe("#7fd4ff"), { deslocar: 0.8 + Math.sin(f * Math.PI * 2) * 0.4, brilho: false });
    });
    p.elipsoide(cx, 16 * s, 1.6 * s, (1.6 + Math.abs(Math.sin(f * Math.PI * 2)) * 0.8) * s, oco, { brilho: false });
    return p.pronto();
  }));
}

// ---------- o escorpião: patas andando, pinças abrindo, cauda balançando com o ferrão ----------
function escorpiaoArte(corpo = "#b5651d", cauda = "#8b4513", pinca = "#d2691e", { escala = 1, coroa = false } = {}) {
  return lembrarBestiario(`escorpiao|${corpo}|${cauda}|${pinca}|${escala}|${coroa}`, () => Array.from({ length: 6 }, (_, q) => {
    const s = escala;
    const f = q / 6;
    const onda = Math.sin(f * Math.PI * 2);
    const W = 42 * s;
    const H = (coroa ? 32 : 27) * s;
    const p = pintura(W, H);
    const rc = rampaDe(corpo);
    const rt = rampaDe(cauda);
    const rp = rampaDe(pinca);
    const base = H - 2 * s;
    const yCorpo = base - 6 * s;
    // as patas: 4 de cada lado, alternando
    for (let i = 0; i < 4; i++) {
      const x = (15 + i * 4.5) * s;
      const passo = (i % 2 ? onda : -onda) * 1.5 * s;
      p.linha(x, yCorpo + 1 * s, x - 2 * s + passo, base - 2 * s, rampaDe(tom(corpo, 0.6)), Math.max(1, Math.round(s)), 2);
      p.linha(x - 2 * s + passo, base - 2 * s, x - 3 * s + passo, base, rampaDe(tom(corpo, 0.6)), Math.max(1, Math.round(s)), 1);
    }
    // a cauda: segmentos numa curva que sai de trás do corpo, sobe e se dobra para a frente por cima dele
    // (uma curva de Bézier), balançando; o ferrão aponta para a frente e para baixo
    const segmentos = 7;
    const bezier = (u) => {
      const p0 = [11 * s, yCorpo - 1 * s];
      const p1 = [3 * s, yCorpo - 14 * s];
      const p2 = [(16 + onda * 1.5) * s, yCorpo - (19 + onda * 0.8) * s];
      const a = (1 - u) * (1 - u);
      const b = 2 * u * (1 - u);
      const c = u * u;
      return [a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]];
    };
    for (let i = 0; i <= segmentos; i++) {
      const u = i / segmentos;
      const [x, y] = bezier(u);
      const raio = (3.3 - u * 1.5) * s;
      p.elipsoide(x, y, raio, raio * 0.92, rt);
    }
    const ponta = bezier(1);
    p.poligono([[ponta[0] + 0.5 * s, ponta[1] - 1.5 * s], [ponta[0] + 4.5 * s, ponta[1] + 1 * s], [ponta[0] + 2 * s, ponta[1] + 3.5 * s], [ponta[0] - 0.5 * s, ponta[1] + 1 * s]], rampaDe("#ff4d4d"));
    // o corpo em gomos e a cabeça
    for (let i = 0; i < 5; i++) p.elipsoide((14 + i * 4) * s, yCorpo, 3.6 * s, 3.4 * s, rc);
    p.elipsoide(33 * s, yCorpo - 0.5 * s, 4.5 * s, 3.8 * s, rc);
    p.pixel(35 * s, yCorpo - 2 * s, [255, 77, 77]);
    p.pixel(36 * s, yCorpo - 1.5 * s, [255, 77, 77]);
    // o braço e a pinça, abrindo e fechando
    const abre = (onda * 0.5 + 0.5) * 1.6 * s;
    p.linha(35 * s, yCorpo + 1 * s, 38 * s, yCorpo - 2 * s, rp, Math.max(1, Math.round(1.4 * s)), 3);
    p.elipsoide(39 * s, yCorpo - 4 * s - abre, 2.4 * s, 1.5 * s, rp);
    p.elipsoide(39.5 * s, yCorpo - 1.2 * s + abre * 0.3, 2.2 * s, 1.3 * s, rp, { deslocar: -0.4 });
    if (coroa) coroaNoBestiario(p, 33 * s, yCorpo - 4 * s, s);
    return p.pronto();
  }));
}

// ---------- o esqueleto: mandíbula batendo, olhos verdes pulsando, espada e trapo balançando ----------
function esqueletoArte({ escala = 1, coroa = false, osso = "#e8e4dc", olho = "#7dff9a" } = {}) {
  return lembrarBestiario(`esqueleto|${escala}|${coroa}|${osso}|${olho}`, () => Array.from({ length: 6 }, (_, q) => {
    const s = escala;
    const f = q / 6;
    const onda = Math.sin(f * Math.PI * 2);
    const W = 32 * s;
    const H = (coroa ? 50 : 44) * s;
    const p = pintura(W, H);
    const ro = rampaDe(osso);
    const cx = W / 2 - 1 * s;
    const pe = H - 1 * s;
    const sobe = Math.round(onda * 0.6 * s);
    const quadril = pe - 14 * s + sobe;
    // as pernas: fêmur, joelho e canela
    [-1, 1].forEach((lado) => {
      const joelho = [cx + lado * 3.5 * s, quadril + 7 * s];
      p.linha(cx + lado * 2.5 * s, quadril, joelho[0], joelho[1], ro, Math.max(2, Math.round(1.6 * s)), 3);
      p.linha(joelho[0], joelho[1], cx + lado * 3.5 * s, pe - 1 * s, ro, Math.max(2, Math.round(1.6 * s)), 3);
      p.elipsoide(joelho[0] + 0.5 * s, joelho[1], 1.4 * s, 1.2 * s, ro);
      p.elipsoide(cx + lado * 4 * s + 1 * s, pe - 0.5 * s, 2.4 * s, 1 * s, ro, { brilho: false });
    });
    // a bacia e o trapo
    p.elipsoide(cx + 0.5 * s, quadril, 4.5 * s, 2.2 * s, ro);
    const trapo = rampaDe("#4a4555");
    for (let i = 0; i < 4; i++) {
      const x = cx - 4 * s + i * 2.6 * s;
      const balanco = Math.sin(f * Math.PI * 2 + i) * s;
      p.linha(x, quadril + 1 * s, x + balanco, quadril + (4 + (i % 2) * 2) * s, trapo, Math.max(1, Math.round(1.6 * s)), 3);
    }
    // a coluna e as costelas
    const peito = quadril - 9 * s;
    p.linha(cx, quadril - 1 * s, cx, peito - 4 * s, ro, Math.max(1, Math.round(1.4 * s)), 2);
    for (let i = 0; i < 4; i++) {
      const y = peito - 2.5 * s + i * 2.2 * s;
      const larg = (5.5 - i * 0.5) * s;
      for (let k = -1; k <= 1; k += 2) {
        for (let t = 0; t <= 10; t++) {
          const a = (t / 10) * Math.PI * 0.85;
          p.pixel(cx + k * Math.sin(a) * larg, y + (1 - Math.cos(a)) * 1.2 * s, ro[t < 3 ? 4 : t > 8 ? 2 : 3]);
        }
      }
    }
    // os braços: o esquerdo solto, o direito segurando a espada
    const ombro = peito - 4 * s;
    p.linha(cx - 5 * s, ombro, cx - 7 * s, ombro + 9 * s + onda * 0.5 * s, ro, Math.max(1, Math.round(1.4 * s)), 3);
    p.linha(cx + 5 * s, ombro, cx + 8 * s, ombro + 7 * s, ro, Math.max(1, Math.round(1.4 * s)), 3);
    const metal = rampaDe("#cfd6e6");
    const mx = cx + 9 * s;
    p.linha(mx, ombro + 6 * s, mx, ombro - 12 * s - onda * s, metal, Math.max(2, Math.round(2 * s)), 3);
    p.linha(mx - 2.5 * s, ombro + 5 * s, mx + 3.5 * s, ombro + 5 * s, rampaDe("#8b5a2b"), Math.max(1, Math.round(1.2 * s)), 3);
    p.linha(mx + 0.5 * s, ombro + 6 * s, mx + 0.5 * s, ombro + 9 * s, rampaDe("#5c3418"), Math.max(1, Math.round(1.2 * s)), 3);
    [0.3, 0.55].forEach((k) => p.pixel(mx + 1 * s, ombro + 6 * s - k * 18 * s, rampaDe("#c9874a")[3]));
    // o crânio, os olhos acesos e a mandíbula que bate
    const cabeca = ombro - 7.5 * s;
    p.elipsoide(cx + 0.5 * s, cabeca, 6 * s, 6.3 * s, ro, { ate: Math.round(cabeca + 3 * s) });
    const boca = q % 2 ? 1.2 * s : 0;
    p.elipsoide(cx + 0.5 * s, cabeca + 4.2 * s + boca, 4 * s, 2 * s, ro, { brilho: false });
    for (let i = -3; i <= 3; i += 1.5) p.pixel(cx + 0.5 * s + i * s, cabeca + 3.4 * s + boca * 0.5, rampaDe("#1b1533")[2]);
    const oco = rampaDe("#1b1533");
    [-2.4, 2.6].forEach((dx) => {
      p.elipsoide(cx + dx * s, cabeca, 1.9 * s, 2 * s, oco, { brilho: false });
      p.elipsoide(cx + dx * s, cabeca + 0.3 * s, 0.8 * s, 0.8 * s, rampaDe(olho), { deslocar: 0.6 + onda * 0.6, brilho: false });
    });
    p.poligono([[cx - 0.4 * s, cabeca + 1.6 * s], [cx + 1.4 * s, cabeca + 1.6 * s], [cx + 0.5 * s, cabeca + 2.8 * s]], oco, { tom: 1 });
    if (coroa) coroaNoBestiario(p, cx + 0.5 * s, cabeca - 5 * s, s);
    return p.pronto();
  }));
}

// ---------- os mascotes (no mesmo estilo dos monstros) ----------
// Cada mascote sai em 8 quadros parado (respira, pisca, mexe o rabo ou as asas) e 4 correndo. "cor" é a cor
// escolhida no criador (a natural de cada um, se não escolher). mascoteArte(id, cor) devolve { parado, correndo }.
function blocoDoBestiario(p, x, y, w, h, rampa) {
  for (let yy = Math.round(y); yy < Math.round(y + h); yy++) {
    for (let xx = Math.round(x); xx < Math.round(x + w); xx++) {
      const topo = yy === Math.round(y);
      const esquerda = xx === Math.round(x);
      const baixo = yy === Math.round(y + h) - 1;
      const direita = xx === Math.round(x + w) - 1;
      const i = topo ? 5 : esquerda ? 4 : baixo ? 1 : direita ? 2 : tomDaLuz(0.15 - (yy - y) / h * 0.4, xx, yy, rampa.length);
      p.pixel(xx, yy, rampa[i]);
    }
  }
}

const MASCOTES_DO_BESTIARIO = {
  // o gato sentado: orelhas pontudas, olhos de fenda, o rabo balançando; correndo, esticado no galope
  gato(cor, q, correndo) {
    const f = q / (correndo ? 4 : 8);
    const onda = Math.sin(f * Math.PI * 2);
    const p = pintura(26, 24);
    const r = rampaDe(cor);
    const claro = rampaDe(tom(cor, 1.6));
    if (correndo) {
      const pata = onda * 2;
      [[8, pata], [11, -pata], [16, -pata], [19, pata]].forEach(([x, d]) => p.linha(x, 15, x + d, 21, r, 2, 2));
      for (let i = 0; i < 5; i++) p.elipsoide(5 - i * 1.4, 12 - i * 0.6 + onda * i * 0.3, 1.6, 1.6, r);
      p.elipsoide(13, 13, 8, 4.2, r);
      p.elipsoide(20, 9, 5, 4.4, r);
      [[17, 6, 16, 1, 19, 5], [21, 5, 22, 0, 24, 5]].forEach(([a, b, c2, d, e, g]) => p.poligono([[a, b], [c2, d], [e, g]], r));
      p.elipsoide(22.5, 9, 1.2, 1.4, rampaDe("#ffd166"), { brilho: false });
      p.pixel(22.8, 9, [27, 21, 51]);
      p.pixel(24.5, 10.5, [255, 143, 176]);
      return p.pronto();
    }
    const respira = Math.sin(f * Math.PI * 2) * 0.4;
    for (let i = 0; i < 6; i++) p.elipsoide(18 + i * 0.8 + Math.sin(f * Math.PI * 2 + i * 0.5) * (i * 0.35), 20 - i * 2, 1.6, 1.6, r);
    p.elipsoide(12, 17.5, 6.5, 5.5 + respira, r, { ate: 22 });
    p.elipsoide(12, 18.5, 3.5, 3.5, claro, { brilho: false, dentro: true });
    [[9.5, 22], [14.5, 22]].forEach(([x, y]) => p.elipsoide(x, y, 2, 1.2, claro, { brilho: false }));
    p.elipsoide(12, 9.5 + respira * 0.5, 6.5, 5.5, r);
    [[6.5, 6.5, 6, 1, 9.5, 4.5], [17.5, 6.5, 18, 1, 14.5, 4.5]].forEach(([a, b, c2, d, e, g]) => {
      p.poligono([[a, b], [c2, d], [e, g]], r);
      p.poligono([[a + (a < 12 ? 0.8 : -0.8), b - 0.6], [c2 + (a < 12 ? 0.4 : -0.4), d + 2], [e + (a < 12 ? -0.8 : 0.8), g]], rampaDe("#ff8fb0"), { tom: 3 });
    });
    const pisca = q === 5;
    [[9.3, 9.5], [14.7, 9.5]].forEach(([x, y]) => {
      if (pisca) return p.linha(x - 1.2, y, x + 1.2, y, r, 1, 0);
      p.elipsoide(x, y, 1.6, 1.9, rampaDe("#ffd166"), { brilho: false });
      p.linha(x, y - 1, x, y + 1, rampaDe("#1b1533"), 1, 1);
      p.pixel(x - 0.8, y - 1, [255, 255, 255]);
    });
    p.pixel(12, 11.5, [255, 143, 176]);
    p.pixel(11, 12.5, r[0]);
    p.pixel(13, 12.5, r[0]);
    return p.pronto();
  },
  // a raposa: focinho comprido, peito e ponta do rabo brancos, rabo cheio balançando
  raposa(cor, q, correndo) {
    const f = q / (correndo ? 4 : 8);
    const onda = Math.sin(f * Math.PI * 2);
    const p = pintura(28, 24);
    const r = rampaDe(cor);
    const branco = rampaDe("#f6efe6");
    const escuro = rampaDe(tom(cor, 0.35));
    if (correndo) {
      const pata = onda * 2.2;
      [[9, pata], [12, -pata], [17, -pata], [20, pata]].forEach(([x, d]) => p.linha(x, 15, x + d, 21, escuro, 2, 2));
      p.elipsoide(4, 11 + onda, 4.5, 3, r);
      p.elipsoide(1.5, 10.5 + onda, 2, 2, branco);
      p.elipsoide(14, 13, 8, 4, r);
      p.elipsoide(15, 15, 5, 2, branco, { dentro: true, brilho: false });
      p.elipsoide(21, 9, 4.5, 4, r);
      p.elipsoide(25, 10.5, 2.5, 1.6, branco);
      p.pixel(27, 10, [27, 21, 51]);
      p.poligono([[18, 6], [18.5, 0], [21, 5]], r);
      p.poligono([[21.5, 5], [23, 0], [24, 6]], r);
      p.pixel(22.5, 8.5, [27, 21, 51]);
      return p.pronto();
    }
    const respira = Math.sin(f * Math.PI * 2) * 0.4;
    p.elipsoide(20 + onda * 0.8, 17, 5, 3.6, r);
    p.elipsoide(23.5 + onda, 15.5, 2.2, 2, branco);
    p.elipsoide(12, 17.5, 6.5, 5.5 + respira, r, { ate: 22 });
    p.elipsoide(12, 17, 3.5, 4, branco, { dentro: true, brilho: false });
    [[9.5, 22], [14.5, 22]].forEach(([x, y]) => p.elipsoide(x, y, 2, 1.2, escuro, { brilho: false }));
    p.elipsoide(12, 9.5 + respira * 0.5, 6.5, 5.3, r);
    p.elipsoide(12, 12, 3.6, 2.4, branco, { brilho: false });
    [[6.5, 6, 5.5, 0, 10, 4.5], [17.5, 6, 18.5, 0, 14, 4.5]].forEach(([a, b, c2, d, e, g]) => {
      p.poligono([[a, b], [c2, d], [e, g]], r);
      p.pixel(c2 + (a < 12 ? 0.6 : -0.6), d + 1.5, escuro[1]);
    });
    const pisca = q === 3;
    [[9.3, 9], [14.7, 9]].forEach(([x, y]) => {
      if (pisca) return p.linha(x - 1.1, y, x + 1.1, y, escuro, 1, 1);
      p.elipsoide(x, y, 1.3, 1.6, rampaDe("#1b1533"), { brilho: false });
      p.pixel(x - 0.5, y - 0.8, [255, 255, 255]);
    });
    p.elipsoide(12, 12.2, 1, 0.8, rampaDe("#1b1533"), { brilho: false });
    return p.pronto();
  },
  // a coruja: o disco do rosto, olhos enormes, as penas da barriga e as asas que abrem para voar
  coruja(cor, q, correndo) {
    const f = q / (correndo ? 4 : 8);
    const onda = Math.sin(f * Math.PI * 2);
    const p = pintura(28, 24);
    const r = rampaDe(cor);
    const claro = rampaDe(tom(cor, 1.55));
    const cx = 14;
    const abre = correndo ? onda * 6 : Math.max(0, Math.sin(f * Math.PI * 2)) * 0.8;
    [-1, 1].forEach((lado) => p.poligono([[cx + lado * 5, 9], [cx + lado * (9 + Math.abs(abre)), 9 - abre], [cx + lado * (10 + Math.abs(abre) * 0.4), 17 - abre * 0.5], [cx + lado * 6, 20]], r));
    p.elipsoide(cx, 14, 7.5, 8.5, r, { ate: 22 });
    for (let i = 0; i < 5; i++) p.pixel(cx - 3 + (i % 3) * 3, 16 + Math.floor(i / 3) * 2.5, claro[3]);
    p.elipsoide(cx, 15.5, 4, 4.5, claro, { dentro: true, brilho: false });
    [[cx - 4, 2.5], [cx + 4, 2.5]].forEach(([x, y]) => p.poligono([[x - 1.5, y + 4], [x + (x < cx ? -1 : 1), y], [x + 1.5, y + 4]], r));
    const pisca = q === 6 && !correndo;
    [-3.2, 3.2].forEach((dx) => {
      p.elipsoide(cx + dx, 9.5, 3, 3, claro, { brilho: false });
      if (pisca) return p.linha(cx + dx - 2, 9.5, cx + dx + 2, 9.5, r, 1, 0);
      p.elipsoide(cx + dx, 9.5, 2, 2, rampaDe("#ffd166"), { brilho: false });
      p.elipsoide(cx + dx + 0.3, 9.7, 1.1, 1.1, rampaDe("#1b1533"), { brilho: false });
      p.pixel(cx + dx - 0.6, 8.6, [255, 255, 255]);
    });
    p.poligono([[cx - 1, 11.5], [cx + 1, 11.5], [cx, 14]], rampaDe("#f5c451"), { tom: 3 });
    if (!correndo) [[cx - 3, 22], [cx + 2, 22]].forEach(([x, y]) => p.linha(x, y, x + 2, y, rampaDe("#f5c451"), 1, 3));
    return p.pronto();
  },
  // o golem: blocos de pedra com runas, o núcleo de cristal pulsando e os olhos acesos
  golem(cor, q, correndo) {
    const f = q / (correndo ? 4 : 8);
    const onda = Math.sin(f * Math.PI * 2);
    const p = pintura(26, 26);
    const r = rampaDe(cor);
    const magia = rampaDe("#6ef0ff");
    const pisao = correndo ? Math.round(Math.abs(onda) * 2) : 0;
    const desce = correndo ? (q % 2) : Math.round(Math.max(0, onda) * 0.6);
    blocoDoBestiario(p, 7 + (correndo && q % 2 ? 1 : 0), 18 - (correndo ? pisao * (q < 2 ? 1 : 0) : 0), 4, 6, r);
    blocoDoBestiario(p, 15 - (correndo && q % 2 ? 1 : 0), 18 - (correndo ? pisao * (q >= 2 ? 1 : 0) : 0), 4, 6, r);
    blocoDoBestiario(p, 1, 9 + desce, 4, 8, r);
    blocoDoBestiario(p, 21, 9 + desce, 4, 8, r);
    blocoDoBestiario(p, 5, 8 + desce, 16, 11, r);
    blocoDoBestiario(p, 7, 1 + desce, 12, 8, r);
    const pulso = 0.6 + Math.sin(f * Math.PI * 2) * 0.6;
    p.elipsoide(13, 13 + desce, 2.6, 2.6, magia, { deslocar: pulso });
    [[10, 4.5], [16, 4.5]].forEach(([x, y]) => p.elipsoide(x, y + desce, 1.2, 0.9, magia, { deslocar: 1.2, brilho: false }));
    [[7, 11, 9, 13], [19, 12, 17, 15], [9, 3, 8, 6]].forEach(([a, b, c2, d]) => p.linha(a, b + desce, c2, d + desce, magia, 1, 2));
    return p.pronto();
  },
  // a fênix: crista e rabo de fogo tremulando, asas de chama; voando, as asas batem
  fenix(cor, q, correndo) {
    const f = q / (correndo ? 4 : 8);
    const onda = Math.sin(f * Math.PI * 2);
    const p = pintura(28, 26);
    const r = rampaDe(cor);
    const laranja = rampaDe("#ff9f43");
    const ouro = rampaDe("#ffd166");
    for (let i = 0; i < 3; i++) {
      const sobe = Math.sin(f * Math.PI * 2 + i) * 1.5;
      p.poligono([[11, 16], [3 - i * 1.5, 22 + i * 1.5 + sobe], [6 - i, 24 + sobe], [13, 18]], [ouro, laranja, r][i]);
    }
    const bate = correndo ? onda * 6 : Math.sin(f * Math.PI * 2) * 1.5;
    p.poligono([[12, 11], [4, 6 - bate], [6, 12 - bate * 0.5], [9, 15]], laranja);
    p.elipsoide(14, 14, 5.5, 4.8, r);
    p.poligono([[15, 11], [24, 6 - bate], [22, 12 - bate * 0.5], [17, 15]], r);
    p.elipsoide(18, 8, 3.6, 3.4, r);
    for (let i = 0; i < 3; i++) p.poligono([[16 + i, 5.5], [15 + i * 1.6 + Math.sin(f * 7 + i) * 0.8, 0.5 + i * 0.6], [17.5 + i, 5]], [ouro, laranja, ouro][i]);
    p.poligono([[21, 8], [24.5, 9], [21, 10]], ouro, { tom: 3 });
    p.pixel(19, 7.5, [27, 21, 51]);
    p.pixel(18.6, 7, [255, 255, 255]);
    if (!correndo) [[12, 19], [15, 19]].forEach(([x, y]) => p.linha(x, y, x, y + 3, ouro, 1, 3));
    return p.pronto();
  },
  // o coelho lunar: orelhas compridas que mexem, nariz que fareja, rabinho de algodão e a lua na testa
  coelho(cor, q, correndo) {
    const f = q / (correndo ? 4 : 8);
    const onda = Math.sin(f * Math.PI * 2);
    const p = pintura(24, 26);
    const r = rampaDe(cor);
    const claro = rampaDe(tom(cor, 1.5));
    const rosa = rampaDe("#ff9fbf");
    if (correndo) {
      // o pulo: o corpo esticado no alto, as patas de trás empurrando
      const sobe = Math.abs(onda) * 3;
      p.elipsoide(4, 15 - sobe, 2.2, 2.2, rampaDe("#ffffff"));
      p.elipsoide(11, 16 - sobe, 7, 4.5, r);
      p.linha(6, 19 - sobe, 3 - onda * 2, 23, r, 2, 2);
      p.linha(15, 19 - sobe, 17 + onda * 2, 23, r, 2, 2);
      p.elipsoide(17.5, 11 - sobe, 4.5, 4, r);
      p.poligono([[15, 9 - sobe], [9, 3 - sobe], [11, 2 - sobe], [17, 8 - sobe]], r);
      p.poligono([[16, 8 - sobe], [12, 1 - sobe], [14, 0.5 - sobe], [18, 7.5 - sobe]], r);
      p.pixel(19.5, 10 - sobe, [27, 21, 51]);
      p.pixel(22, 12 - sobe, [255, 143, 176]);
      return p.pronto();
    }
    const respira = onda * 0.4;
    const fareja = q % 2 ? 0.5 : 0;
    p.elipsoide(18.5, 20, 2.4, 2.4, rampaDe("#ffffff"));
    p.elipsoide(12, 18.5, 6.5, 5.5 + respira, r, { ate: 24 });
    p.elipsoide(12, 19.5, 3.6, 3.6, claro, { brilho: false, dentro: true });
    [[9, 23.5], [15, 23.5]].forEach(([x, y]) => p.elipsoide(x, y, 2.2, 1.1, claro, { brilho: false }));
    p.elipsoide(12, 11 + respira * 0.5, 5.5, 4.8, r);
    // as orelhas: uma delas dobra de vez em quando
    const dobra = q === 3 || q === 4 ? 3 : 0;
    p.poligono([[8.5, 8], [7, 0.5], [9.5, 0], [11, 7.5]], r);
    p.poligono([[9, 7], [8, 1.5], [9.5, 1.2], [10.3, 7]], rosa, { tom: 3 });
    p.poligono([[13, 7.5], [14.5 + dobra, 0.5 + dobra * 0.4], [17 + dobra, 1 + dobra * 0.6], [15.5, 8]], r);
    p.poligono([[13.8, 7], [15 + dobra, 1.6 + dobra * 0.4], [16 + dobra, 2 + dobra * 0.5], [14.8, 7.2]], rosa, { tom: 3 });
    // a lua crescente na testa
    p.pixel(12, 8, [255, 243, 176]);
    p.pixel(11, 8.5, [255, 243, 176]);
    p.pixel(11.5, 9.5, [255, 243, 176]);
    const pisca = q === 6;
    [[9.6, 11.5], [14.4, 11.5]].forEach(([x, y]) => {
      if (pisca) return p.linha(x - 1, y, x + 1, y, r, 1, 0);
      p.elipsoide(x, y, 1.3, 1.6, rampaDe("#1b1533"), { brilho: false });
      p.pixel(x - 0.5, y - 0.8, [255, 255, 255]);
    });
    p.pixel(12, 13 + fareja, [255, 143, 176]);
    [[7.5, 13.5], [16.5, 13.5]].forEach(([x, y]) => p.elipsoide(x, y, 1.3, 0.8, rosa, { brilho: false, alfa: 170 }));
    return p.pronto();
  },
  // o lobinho de jade: pelo cinza com a máscara escura, olhos de gelo, coleira de jade e o rabo abanando
  lobo(cor, q, correndo) {
    const f = q / (correndo ? 4 : 8);
    const onda = Math.sin(f * Math.PI * 2);
    const p = pintura(28, 24);
    const r = rampaDe(cor);
    const claro = rampaDe(tom(cor, 1.55));
    const escuro = rampaDe(tom(cor, 0.5));
    const jade = rampaDe("#3fbf7f");
    if (correndo) {
      const pata = onda * 2.2;
      [[9, pata], [12, -pata], [17, -pata], [20, pata]].forEach(([x, d]) => p.linha(x, 15, x + d, 21, escuro, 2, 2));
      p.poligono([[7, 11], [0, 8 + onda * 2], [1, 12 + onda], [7, 14]], r);
      p.elipsoide(14, 13, 8, 4.2, r);
      p.elipsoide(14, 11, 6, 2, escuro, { dentro: true, brilho: false });
      p.elipsoide(15, 15.5, 5, 1.6, claro, { dentro: true, brilho: false });
      p.elipsoide(21, 9, 4.5, 4, r);
      p.elipsoide(24.5, 10.5, 2.6, 1.8, claro);
      p.pixel(26.5, 10, [27, 21, 51]);
      p.poligono([[18, 6], [18.5, 0.5], [21, 5]], r);
      p.poligono([[21.5, 5], [23, 0.5], [24, 6]], r);
      p.linha(18, 12, 19, 14, jade, 2, 3);
      p.pixel(22.5, 8.5, [159, 212, 255]);
      return p.pronto();
    }
    const respira = onda * 0.4;
    // o rabo abanando
    const abana = Math.sin(f * Math.PI * 4) * 2.5;
    p.poligono([[17, 19], [24 + abana * 0.4, 13 - abana], [25 + abana * 0.3, 16 - abana * 0.5], [18, 21]], r);
    p.pixel(24.5 + abana * 0.4, 13.5 - abana, claro[4]);
    p.elipsoide(12, 17.5, 6.5, 5.5 + respira, r, { ate: 22 });
    p.elipsoide(12, 17.5, 3.5, 4, claro, { dentro: true, brilho: false });
    [[9.5, 22], [14.5, 22]].forEach(([x, y]) => p.elipsoide(x, y, 2, 1.2, escuro, { brilho: false }));
    p.elipsoide(12, 9.5 + respira * 0.5, 6.5, 5.3, r);
    // a máscara escura em volta dos olhos e o focinho claro
    p.elipsoide(12, 8.5 + respira * 0.5, 5.5, 2.4, escuro, { dentro: true, brilho: false });
    p.elipsoide(12, 12.2, 3.4, 2.3, claro, { brilho: false });
    [[6.5, 6, 6, 0, 10, 4.5], [17.5, 6, 18, 0, 14, 4.5]].forEach(([a, b, c2, d, e, g]) => {
      p.poligono([[a, b], [c2, d], [e, g]], r);
      p.pixel(c2 + (a < 12 ? 0.8 : -0.8), d + 2, escuro[1]);
    });
    const pisca = q === 5;
    [[9.3, 9], [14.7, 9]].forEach(([x, y]) => {
      if (pisca) return p.linha(x - 1.1, y, x + 1.1, y, escuro, 1, 1);
      p.elipsoide(x, y, 1.3, 1.5, rampaDe("#9fd4ff"), { brilho: false });
      p.pixel(x + 0.2, y + 0.2, [27, 21, 51]);
      p.pixel(x - 0.5, y - 0.8, [255, 255, 255]);
    });
    p.elipsoide(12, 11.6, 1, 0.8, rampaDe("#1b1533"), { brilho: false });
    // a coleira de jade com a gema do clã
    p.linha(7.5, 14.3, 16.5, 14.3, jade, 1, 2);
    p.elipsoide(12, 15, 1.3, 1.3, jade, { deslocar: 1 });
    return p.pronto();
  },
  // a tartaruga rúnica: casco alto de placas com runas que acendem, a cabeça que espia e as patinhas
  tartaruga(cor, q, correndo) {
    const f = q / (correndo ? 4 : 8);
    const onda = Math.sin(f * Math.PI * 2);
    const p = pintura(28, 22);
    const casco = rampaDe(cor);
    const pele = rampaDe("#8fbf6a");
    const runa = rampaDe("#6ef0ff");
    const passo = correndo ? onda * 1.5 : 0;
    [[6, passo], [10, -passo], [17, passo], [21, -passo]].forEach(([x, d]) => p.elipsoide(x + d, 19.5, 2, 1.6, pele));
    const espia = correndo ? 1 : Math.max(0, Math.sin(f * Math.PI * 2)) * 1.4;
    p.elipsoide(24 + espia, 14 - espia * 0.3, 3.3, 3, pele);
    p.pixel(25.5 + espia, 13 - espia * 0.3, [27, 21, 51]);
    p.pixel(25.2 + espia, 12.4 - espia * 0.3, [255, 255, 255]);
    p.elipsoide(3, 17, 1.6, 1, pele);
    p.elipsoide(13.5, 12.5, 10.5, 7.5, casco, { ate: 18 });
    p.linha(3.5, 18, 23.5, 18, rampaDe(tom(cor, 0.6)), 1, 2);
    // as placas do casco e as runas que acendem em onda
    const placas = [[13.5, 9], [8.5, 12], [18.5, 12], [11, 15.5], [16, 15.5]];
    placas.forEach(([x, y], i) => {
      p.elipsoide(x, y, 2.6, 2, casco, { dentro: true, deslocar: 0.5, brilho: false });
      const acesa = 0.5 + 0.5 * Math.sin(f * Math.PI * 2 - i * 1.2);
      if (acesa > 0.45) {
        p.pixel(x, y - 0.5, runa[Math.round(2 + acesa * 3)]);
        p.pixel(x - 0.6, y + 0.5, runa[Math.round(1 + acesa * 3)]);
        p.pixel(x + 0.6, y + 0.5, runa[Math.round(1 + acesa * 3)]);
      }
    });
    return p.pronto();
  },
  // o cristalino: um cristal vivo que flutua, com dois cacos orbitando e olhinhos acesos
  cristal(cor, q, correndo) {
    const f = q / (correndo ? 4 : 8);
    const onda = Math.sin(f * Math.PI * 2);
    const p = pintura(26, 23);
    const r = rampaDe(cor);
    const sobe = onda * 1.5;
    const cx = 13;
    const cy = 12 + sobe;
    // os cacos orbitando: o de trás antes do corpo
    const orbitas = [0, Math.PI].map((d) => {
      const a = f * Math.PI * 2 + d;
      return { x: cx + Math.cos(a) * 10, y: cy + Math.sin(a) * 3, frente: Math.sin(a) > 0 };
    });
    const caco = ({ x, y }) => p.poligono([[x, y - 2.5], [x + 1.8, y], [x, y + 2.5], [x - 1.8, y]], r, { deslocar: 0.8 });
    orbitas.filter((o) => !o.frente).forEach(caco);
    p.poligono([[cx, cy - 10], [cx + 7, cy - 2], [cx + 4, cy + 8], [cx - 4, cy + 8], [cx - 7, cy - 2]], r, { tom: 2 });
    p.poligono([[cx, cy - 10], [cx + 7, cy - 2], [cx, cy - 1]], r, { tom: 4 });
    p.poligono([[cx, cy - 10], [cx, cy - 1], [cx - 7, cy - 2]], r, { tom: 5 });
    p.poligono([[cx - 7, cy - 2], [cx, cy - 1], [cx - 4, cy + 8]], r, { tom: 3 });
    p.poligono([[cx + 7, cy - 2], [cx + 4, cy + 8], [cx, cy - 1]], r, { tom: 1 });
    const pisca = q === 6 && !correndo;
    [[cx - 2.5, cy + 2], [cx + 2.5, cy + 2]].forEach(([x, y]) => {
      if (pisca) return p.linha(x - 1, y, x + 1, y, rampaDe("#1b1533"), 1, 2);
      p.elipsoide(x, y, 1.2, 1.6, rampaDe("#1b1533"), { brilho: false });
      p.pixel(x - 0.3, y - 0.8, [255, 255, 255]);
    });
    p.pixel(cx - 3, cy - 6, [255, 255, 255]);
    orbitas.filter((o) => o.frente).forEach(caco);
    return p.pronto();
  },
};
// ids dos estilos de corrida do mundo (mundo.js): cada mascote corre do jeito dele
const CORRIDA_DO_BESTIARIO = {
  gato: ["galope", 12], raposa: ["galope", 12], coruja: ["asas", 12], golem: ["pisada", 6], fenix: ["voo", 12], slime: ["quique", 3],
  coelho: ["quique", 10], lobo: ["galope", 12], tartaruga: ["pisada", 5], cristal: ["voo", 10], lume: ["voo", 12],
};

function mascoteArte(id, cor) {
  return lembrarBestiario(`mascote|${id}|${cor}`, () => {
    if (id === "slime") {
      const quadros = slimeArte(cor, { escala: 0.62 });
      return { parado: quadros, correndo: [quadros[0]] };
    }
    // o Lume é um fogo-fátuo de estimação: o mesmo do bestiário, pequenininho
    if (id === "lume") {
      const quadros = fogoFatuoArte(cor, { escala: 0.62 });
      return { parado: quadros, correndo: quadros.slice(0, 4) };
    }
    const pintor = MASCOTES_DO_BESTIARIO[id];
    if (!pintor) return null;
    return {
      parado: Array.from({ length: 8 }, (_, q) => pintor(cor, q, false)),
      correndo: Array.from({ length: 4 }, (_, q) => pintor(cor, q, true)),
    };
  });
}
