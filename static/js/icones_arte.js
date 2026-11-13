// Os ícones de RPG do jogo inteiro, pintados com o pincel do bestiário (volume, rampa de 6 tons, pontilhado
// e contorno colorido), no lugar dos emojis: escudo, espadas, pergaminho, cadeado, troféu, raio, castelo...
// Cada emoji usado no jogo aponta para uma forma (FORMAS_DE_ICONE ou as dos itens, itens_arte.js) com as
// cores dela. O conversor (no fim) troca, sozinho, todo emoji que aparece na tela pelo <img> do ícone; os
// poucos que não têm forma própria viram o emoji em pixel com contorno (emojiCanvas), para nada destoar.
// Depende de pixel.js, bestiario.js e itens_arte.js.

const rIc = (cor) => rampaDe(cor);

// uma estrelinha de quatro pontas
function brilhoDeIcone(p, x, y, raio, cor = "#ffffff") {
  const c = hexParaRgb(cor);
  p.pixel(x, y, [255, 255, 255]);
  for (let i = 1; i <= raio; i++) {
    const a = i === raio ? 150 : 255;
    p.pixel(x - i, y, c, a);
    p.pixel(x + i, y, c, a);
    p.pixel(x, y - i, c, a);
    p.pixel(x, y + i, c, a);
  }
}

// uma lâmina reta da ponta (x1, y1) ao cabo (x0, y0), com fio claro
function laminaDeIcone(p, x0, y0, x1, y1, cor = "#d8dee9") {
  p.linha(x0, y0, x1, y1, rIc(cor), 2, 3);
  p.linha(x0, y0 - 1, x1 - 0.5, y1, rIc(cor), 1, 5);
}

const FORMAS_DE_ICONE = {
  escudo(p, { cor = "#3d6fd6", aro = "#f5c451", emblema = "#f5c451" }) {
    const pontos = [[2, 2], [16, 2], [16, 9], [9, 17], [2, 9]];
    p.poligono(pontos, rIc(aro));
    p.poligono([[3.5, 3.5], [14.5, 3.5], [14.5, 8.6], [9, 15], [3.5, 8.6]], rIc(cor));
    p.poligono([[3.5, 3.5], [9, 3.5], [9, 15], [3.5, 8.6]], rIc(cor), { tom: 4 });
    p.linha(9, 5, 9, 12, rIc(emblema), 1, 4);
    p.linha(6, 7.5, 12, 7.5, rIc(emblema), 1, 4);
  },
  espadas(p) {
    [[3, 3, 14, 14], [15, 3, 4, 14]].forEach(([x0, y0, x1, y1], i) => {
      p.linha(x0, y0, x1 - (i ? -1.5 : 1.5) * 1, y1 - 1.5, rIc("#d8dee9"), 2, i ? 2 : 4);
    });
    [[13, 13, 16, 16, 12, 15, 15, 12], [5, 13, 2, 16, 6, 15, 3, 12]].forEach(([a, b, c, d, e, f, g, h]) => {
      p.linha(a, b, c, d, rIc("#8a5a2a"), 2, 3);
      p.linha(e, f, g, h, rIc("#f5c451"), 1, 4);
    });
    p.pixel(3, 3, [255, 255, 255]);
    p.pixel(15, 3, [255, 255, 255]);
  },
  adaga(p) {
    laminaDeIcone(p, 9, 2, 9, 11, "#d8dee9");
    p.linha(5, 12, 13, 12, rIc("#f5c451"), 2, 4);
    p.linha(9, 14, 9, 17, rIc("#8a5a2a"), 2, 3);
    p.elipsoide(9.5, 17, 1.4, 1.2, rIc("#e63946"));
  },
  arco(p) {
    for (let i = 0; i <= 20; i++) {
      const a = -Math.PI / 2 + (i / 20) * Math.PI;
      p.pixel(5 + Math.cos(a) * 6, 9 + Math.sin(a) * 8, rIc("#a8703a")[i % 3 ? 3 : 4]);
      p.pixel(4.2 + Math.cos(a) * 6, 9 + Math.sin(a) * 8, rIc("#a8703a")[1]);
    }
    p.linha(5, 1, 5, 17, rIc("#e8e4dc"), 1, 4);
    p.linha(3, 9, 16, 9, rIc("#c9cbe0"), 1, 3);
    p.poligono([[14, 7], [17.5, 9], [14, 11]], rIc("#d8dee9"));
    p.poligono([[2, 7.5], [4, 9], [2, 10.5], [1, 9]], rIc("#e63946"));
  },
  alvo(p) {
    ["#e63946", "#f6f4ff", "#e63946", "#f6f4ff"].forEach((c, i) => p.elipsoide(9, 10, 8 - i * 2, 8 - i * 2, rIc(c), { brilho: false }));
    p.elipsoide(9, 10, 1.5, 1.5, rIc("#e63946"));
    p.linha(9, 10, 16, 3, rIc("#8a5a2a"), 1, 3);
    p.poligono([[15, 1], [17.5, 1], [17.5, 3.5]], rIc("#4caf50"));
  },
  orbe(p, { cor = "#a98bff" }) {
    p.poligono([[4, 14], [14, 14], [16, 17], [2, 17]], rIc("#c9952a"));
    p.elipsoide(9, 8, 7, 7, rIc(cor), { brilhoMaior: 0.05 });
    p.elipsoide(10, 9, 3, 3, rIc("#ffffff"), { alfa: 110, brilho: false });
    brilhoDeIcone(p, 6, 5, 1);
  },
  varinha(p) {
    p.linha(3, 16, 12, 7, rIc("#5c3418"), 2, 3);
    brilhoDeIcone(p, 13.5, 4.5, 3, "#ffd166");
    p.pixel(16, 9, [255, 243, 176]);
    p.pixel(9, 2, [255, 243, 176]);
  },
  chapeuMago(p, { cor = "#3d4fd6" }) {
    p.poligono([[3, 14], [10, 1], [13, 4], [12, 7], [15, 14]], rIc(cor));
    p.poligono([[3, 14], [10, 1], [9, 14]], rIc(cor), { tom: 4 });
    p.elipsoide(9, 15, 8.5, 2.4, rIc(cor), { deslocar: -0.3 });
    p.linha(4, 13, 14.5, 13, rIc("#f5c451"), 2, 4);
    brilhoDeIcone(p, 8, 8, 1, "#ffd166");
  },
  cartola(p) {
    p.poligono([[5, 3], [13, 3], [13, 14], [5, 14]], rIc("#2b2540"));
    p.poligono([[5, 3], [8, 3], [8, 14], [5, 14]], rIc("#2b2540"), { tom: 4 });
    p.linha(5, 11, 13, 11, rIc("#a8323e"), 2, 3);
    p.elipsoide(9, 15, 8, 2, rIc("#2b2540"));
  },
  chapeuCacador(p, { cor = "#2f6e1c" }) {
    p.elipsoide(9, 13, 8.5, 2.6, rIc(cor));
    p.elipsoide(9, 9.5, 5, 4.5, rIc(cor), { ate: 12 });
    p.linha(5, 11, 13, 11, rIc("#8a5a2a"), 1, 3);
    p.linha(13, 10, 17, 2, rIc("#e63946"), 2, 4);
  },
  capuz(p, { cor = "#4a6b2a" }) {
    p.poligono([[9, 1], [15, 6], [16, 17], [2, 17], [3, 6]], rIc(cor));
    p.elipsoide(9, 10, 4, 4.5, rIc("#1b1533"), { brilho: false, deslocar: -1 });
    p.pixel(7.5, 10, [255, 209, 102]);
    p.pixel(10.5, 10, [255, 209, 102]);
  },
  manto(p, { cor = "#a8323e" }) {
    p.poligono([[5, 2], [13, 2], [17, 17], [1, 17]], rIc(cor));
    p.poligono([[5, 2], [9, 2], [7, 17], [1, 17]], rIc(cor), { tom: 4 });
    p.linha(9, 4, 9, 16, rIc(cor), 1, 1);
    p.elipsoide(9, 3, 2, 1.6, rIc("#f5c451"));
  },
  bandana(p, { cor = "#c8283c" }) {
    p.elipsoide(8, 9, 7, 4, rIc(cor));
    p.elipsoide(8, 9, 4.5, 2, rIc("#1b1533"), { brilho: false, deslocar: -1, dentro: true });
    p.poligono([[13, 9], [17, 14], [15, 16], [12, 11]], rIc(cor));
    p.poligono([[13, 10], [16, 17], [13, 17], [12, 12]], rIc(cor), { tom: 2 });
  },
  elmo(p, { cor = "#c9cbe0", pluma = "#e63946" }) {
    p.elipsoide(9, 10, 7, 7, rIc(cor), { ate: 16 });
    p.linha(3, 11, 15, 11, rIc("#1b1533"), 1, 1);
    p.linha(9, 11, 9, 16, rIc("#1b1533"), 1, 1);
    p.poligono([[8, 3.5], [10, 3.5], [12, 0.5], [6, 0.5]], rIc(pluma));
  },
  grimorio(p, { cor = "#a8323e" }) {
    p.poligono([[3, 2], [15, 2], [15, 16], [3, 16]], rIc(cor), { tom: 3 });
    p.poligono([[3, 2], [5, 2], [5, 16], [3, 16]], rIc(cor), { tom: 1 });
    p.linha(15, 3, 15, 15, rIc("#f1dca4"), 1, 4);
    p.poligono([[7, 5], [13, 5], [13, 9], [7, 9]], rIc("#f5c451"));
    p.elipsoide(10, 7, 1.2, 1.2, rIc("#6ef0ff"));
    [4, 14].forEach((y) => p.linha(5, y, 15, y, rIc("#f5c451"), 1, 4));
  },
  livroAberto(p) {
    p.poligono([[1, 4], [9, 5], [9, 16], [1, 15]], rIc("#f1dca4"), { tom: 4 });
    p.poligono([[9, 5], [17, 4], [17, 15], [9, 16]], rIc("#f1dca4"), { tom: 3 });
    [7, 9, 11].forEach((y) => {
      p.linha(3, y, 7, y + 0.5, rIc("#8a6a3a"), 1, 2);
      p.linha(11, y + 0.5, 15, y, rIc("#8a6a3a"), 1, 2);
    });
    p.linha(1, 16, 17, 16, rIc("#8a3a2a"), 1, 2);
  },
  livros(p) {
    [["#a8323e", 2, 2], ["#3d6fd6", 7, 4], ["#4caf50", 12, 1]].forEach(([c, x, y]) => {
      p.poligono([[x, y], [x + 4, y], [x + 4, 17], [x, 17]], rIc(c));
      p.linha(x + 0.5, y + 3, x + 3.5, y + 3, rIc("#f5c451"), 1, 4);
      p.linha(x + 0.5, 14, x + 3.5, 14, rIc("#f5c451"), 1, 4);
    });
  },
  cadeado(p, { aberto = false }) {
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI + (i / 14) * Math.PI;
      p.pixel(9 + Math.cos(a) * 4 + (aberto ? -3 : 0), 8 + Math.sin(a) * 5 - (aberto ? 2 : 0), rIc("#c9cbe0")[3]);
      p.pixel(9 + Math.cos(a) * 5 + (aberto ? -3 : 0), 8 + Math.sin(a) * 6 - (aberto ? 2 : 0), rIc("#c9cbe0")[1]);
    }
    p.poligono([[3, 8], [15, 8], [15, 17], [3, 17]], rIc("#f5c451"));
    p.elipsoide(9, 11.5, 1.4, 1.4, rIc("#1b1533"), { brilho: false });
    p.linha(9, 12, 9, 15, rIc("#1b1533"), 1, 0);
  },
  chave(p) {
    p.elipsoide(5, 5, 4, 4, rIc("#f5c451"));
    p.elipsoide(5, 5, 1.6, 1.6, rIc("#1b1533"), { brilho: false });
    p.linha(8, 8, 16, 16, rIc("#f5c451"), 2, 3);
    p.linha(13, 13, 11, 15, rIc("#f5c451"), 2, 3);
    p.linha(15, 15, 13.5, 17, rIc("#f5c451"), 2, 3);
  },
  chama(p, { cor = "#ff7a1a" }) {
    p.poligono([[9, 0.5], [15, 8], [15, 13], [12, 17], [6, 17], [3, 13], [3, 8], [6, 5], [7, 9]], rIc(cor));
    p.poligono([[9, 6], [12, 11], [11, 16], [7, 16], [6, 12]], rIc("#ffd166"));
    p.elipsoide(9, 14, 1.8, 2, rIc("#fff3b0"), { brilho: false });
  },
  caveira(p) {
    p.elipsoide(9, 8, 7, 6.5, rIc("#e8e4dc"));
    p.poligono([[5, 12], [13, 12], [12, 17], [6, 17]], rIc("#e8e4dc"), { tom: 3 });
    [[6, 8.5], [12, 8.5]].forEach(([x, y]) => p.elipsoide(x, y, 2, 2.2, rIc("#1b1533"), { brilho: false }));
    p.poligono([[8, 11], [10, 11], [9, 13]], rIc("#1b1533"), { tom: 1 });
    [7.5, 9.5, 11.5].forEach((x) => p.linha(x, 14, x, 16.5, rIc("#8a8a9a"), 1, 1));
  },
  alerta(p) {
    p.poligono([[9, 1], [17, 16], [1, 16]], rIc("#f5c451"));
    p.linha(9, 6, 9, 11, rIc("#1b1533"), 2, 0);
    p.elipsoide(9.5, 13.5, 1.1, 1.1, rIc("#1b1533"), { brilho: false });
  },
  castelo(p) {
    const pedra = rIc("#9a9ab0");
    p.poligono([[2, 7], [16, 7], [16, 17], [2, 17]], pedra);
    [[1, 3, 5], [7, 1, 11], [13, 3, 17]].forEach(([x0, y0, x1]) => {
      p.poligono([[x0, y0 + 2], [x1, y0 + 2], [x1, 17], [x0, 17]], pedra, { tom: 4 });
      for (let x = x0; x < x1; x += 2) p.poligono([[x, y0], [x + 1, y0], [x + 1, y0 + 2], [x, y0 + 2]], pedra);
    });
    p.poligono([[7, 11], [11, 11], [11, 17], [7, 17]], rIc("#5c3418"));
    p.elipsoide(9, 11, 2, 2, rIc("#5c3418"), { ate: 11 });
    p.linha(9, 0, 9, -1, rIc("#e63946"), 1, 3);
    p.poligono([[9, -1], [12, 0], [9, 1]], rIc("#e63946"));
  },
  taca(p) {
    const ouro = rIc("#f5c451");
    p.elipsoide(9, 5, 6.5, 5, ouro, { brilhoMaior: 0.04 });
    p.poligono([[2.5, 1], [15.5, 1], [15.5, 5], [2.5, 5]], ouro, { tom: 3 });
    [[2, 4], [16, 4]].forEach(([x, y]) => p.elipsoide(x, y, 1.6, 2.4, ouro, { brilho: false }));
    p.linha(9, 10, 9, 13, ouro, 2, 3);
    p.poligono([[5, 14], [13, 14], [14, 17], [4, 17]], ouro);
    p.elipsoide(9, 5, 1.4, 1.4, rIc("#e63946"));
  },
  certo(p) {
    p.poligono([[1, 1], [17, 1], [17, 17], [1, 17]], rIc("#2e9e5a"));
    p.linha(4, 9, 7.5, 13, rIc("#ffffff"), 2, 4);
    p.linha(7.5, 13, 14, 4.5, rIc("#ffffff"), 2, 4);
  },
  errado(p) {
    p.linha(3, 3, 15, 15, rIc("#e63946"), 3, 3);
    p.linha(15, 3, 3, 15, rIc("#e63946"), 3, 3);
  },
  raio(p, { cor = "#ffd166" }) {
    p.poligono([[11, 0.5], [3, 10], [8, 10], [6, 17.5], [15, 7], [10, 7], [13, 0.5]], rIc(cor));
    p.linha(10.5, 2, 6.5, 8, rIc("#ffffff"), 1, 5);
  },
  dragao(p, { cor = "#c8283c" }) {
    p.poligono([[3, 6], [6, 1], [7, 6]], rIc("#f5c451"));
    p.poligono([[9, 6], [12, 1], [12, 7]], rIc("#f5c451"));
    p.elipsoide(8, 10, 6, 5.5, rIc(cor));
    p.poligono([[10, 9], [17, 11], [17, 15], [10, 15]], rIc(cor), { tom: 3 });
    p.pixel(16, 12, [27, 21, 51]);
    p.elipsoide(8, 8.5, 1.6, 1.4, rIc("#ffd166"), { brilho: false });
    p.pixel(8.4, 8.5, [27, 21, 51]);
    p.poligono([[12, 15], [14, 15], [13, 17]], rIc("#ffffff"), { tom: 5 });
  },
  nota(p) {
    p.linha(7, 3, 7, 13, rIc("#ffd166"), 2, 4);
    p.linha(14, 1, 14, 11, rIc("#ffd166"), 2, 4);
    p.poligono([[7, 3], [15, 1], [15, 4], [7, 6]], rIc("#ffd166"));
    p.elipsoide(5.5, 14, 3, 2.4, rIc("#ffd166"));
    p.elipsoide(12.5, 12, 3, 2.4, rIc("#ffd166"));
  },
  mapa(p) {
    const papel = rIc("#e8d3a0");
    p.poligono([[1, 3], [6, 1], [12, 3], [17, 1], [17, 15], [12, 17], [6, 15], [1, 17]], papel, { tom: 3 });
    p.poligono([[6, 1], [12, 3], [12, 17], [6, 15]], papel, { tom: 2 });
    p.linha(3, 12, 6, 8, rIc("#a8323e"), 1, 2);
    p.linha(6, 8, 10, 10, rIc("#a8323e"), 1, 2);
    p.linha(12, 5, 15, 8, rIc("#c8283c"), 1, 3);
    p.linha(15, 5, 12, 8, rIc("#c8283c"), 1, 3);
  },
  porta(p) {
    p.elipsoide(9, 7, 6.5, 6, rIc("#9a9ab0"), { ate: 9 });
    p.poligono([[2.5, 7], [15.5, 7], [15.5, 17], [2.5, 17]], rIc("#9a9ab0"));
    p.elipsoide(9, 8, 5, 5, rIc("#8a5a2a"), { ate: 9 });
    p.poligono([[4, 8], [14, 8], [14, 17], [4, 17]], rIc("#8a5a2a"));
    [7, 11].forEach((x) => p.linha(x, 5, x, 17, rIc("#5c3418"), 1, 1));
    p.elipsoide(12, 12, 0.9, 0.9, rIc("#f5c451"));
  },
  arvore(p, { cor = "#3f9a3f", pinheiro = false }) {
    p.linha(9, 12, 9, 17, rIc("#8a5a2a"), 2, 3);
    if (pinheiro) {
      [[1, 9, 13], [3, 6, 9], [5, 3, 5]].forEach(([margem, topo, base]) => p.poligono([[9, topo - 3], [17 - margem, base], [1 + margem, base]], rIc(cor)));
      return;
    }
    p.elipsoide(9, 7.5, 7.5, 6.5, rIc(cor), { brilhoMaior: 0.03 });
    p.elipsoide(6, 6, 3, 2.6, rIc(cor), { deslocar: 0.8, dentro: true, brilho: false });
  },
  capelo(p) {
    p.poligono([[9, 3], [17, 7], [9, 11], [1, 7]], rIc("#2b2540"));
    p.poligono([[5, 9], [13, 9], [13, 14], [5, 14]], rIc("#2b2540"), { tom: 2 });
    p.elipsoide(9, 14, 4, 1.6, rIc("#2b2540"), { brilho: false });
    p.linha(9, 7, 15, 9, rIc("#f5c451"), 1, 4);
    p.linha(15, 9, 15, 14, rIc("#f5c451"), 1, 4);
    p.elipsoide(15, 15, 1, 1.4, rIc("#f5c451"));
  },
  constructo(p) {
    p.poligono([[3, 4], [15, 4], [15, 15], [3, 15]], rIc("#8a93a8"));
    p.poligono([[3, 4], [7, 4], [7, 15], [3, 15]], rIc("#8a93a8"), { tom: 4 });
    [[6.5, 9], [11.5, 9]].forEach(([x, y]) => p.elipsoide(x, y, 1.6, 1.6, rIc("#6ef0ff"), { deslocar: 1 }));
    p.linha(6, 12.5, 12, 12.5, rIc("#1b1533"), 1, 1);
    p.linha(9, 4, 9, 1, rIc("#c9cbe0"), 1, 3);
    p.elipsoide(9, 1, 1.2, 1.2, rIc("#e63946"));
  },
  cerebro(p) {
    p.elipsoide(9, 9, 8, 7, rIc("#ff9fbf"));
    p.linha(9, 3, 9, 15, rIc("#c85a8a"), 1, 1);
    [[4, 7, 7, 6], [11, 6, 14, 8], [4, 11, 7, 12], [11, 12, 14, 10]].forEach(([a, b, c, d]) => p.linha(a, b, c, d, rIc("#c85a8a"), 1, 1));
  },
  grafico(p) {
    p.poligono([[1, 1], [17, 1], [17, 17], [1, 17]], rIc("#e8d3a0"), { tom: 3 });
    [[3, 11, "#e63946"], [7, 7, "#f5c451"], [11, 9, "#4caf50"], [14, 4, "#3d6fd6"]].forEach(([x, y, c]) => p.poligono([[x, y], [x + 2.5, y], [x + 2.5, 15], [x, 15]], rIc(c)));
  },
  balao(p, { cor = "#f6f4ff" }) {
    p.elipsoide(9, 8, 8, 6, rIc(cor));
    p.poligono([[4, 12], [8, 13], [3, 17]], rIc(cor), { tom: 3 });
    [6, 9, 12].forEach((x) => p.elipsoide(x, 8, 0.9, 0.9, rIc("#6a5a8a"), { brilho: false }));
  },
  // a lua crescente: o disco menos o pedaço que a sombra come
  lua(p, { cor = "#fff3b0" }) {
    const r = rIc(cor);
    for (let y = 0; y < 18; y++) {
      for (let x = 0; x < 18; x++) {
        const dx = (x + 0.5 - 9) / 7.5;
        const dy = (y + 0.5 - 9) / 7.5;
        if (dx * dx + dy * dy > 1 || Math.hypot(x + 0.5 - 13, y + 0.5 - 6) < 6) continue;
        p.pixel(x, y, r[tomDaLuz(-dx * 0.6 - dy * 0.5, x, y, 6)]);
      }
    }
  },
  broto(p) {
    p.elipsoide(9, 16, 6, 1.6, rIc("#8a5a2a"), { brilho: false });
    p.linha(9, 16, 9, 8, rIc("#4caf50"), 1, 3);
    p.elipsoide(5.5, 7.5, 3.6, 2.2, rIc("#7ddc5a"));
    p.elipsoide(12.5, 5.5, 3.6, 2.2, rIc("#7ddc5a"));
  },
  explosao(p, { cor = "#ff7a1a" }) {
    const pontos = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = i % 2 ? 4 : 8.5;
      pontos.push([9 + Math.cos(a) * r, 9 + Math.sin(a) * r]);
    }
    p.poligono(pontos, rIc(cor));
    p.elipsoide(9, 9, 3.5, 3.5, rIc("#ffd166"));
    p.elipsoide(9, 9, 1.5, 1.5, rIc("#fff3b0"), { brilho: false });
  },
  trevo(p) {
    [[6, 6], [12, 6], [9, 11], [6, 11.5]].slice(0, 3).forEach(([x, y]) => p.elipsoide(x, y, 3.6, 3.6, rIc("#4caf50")));
    p.elipsoide(12, 11, 3.6, 3.6, rIc("#4caf50"));
    p.linha(9, 12, 7, 17, rIc("#2e7d32"), 1, 3);
  },
  cobra(p) {
    for (let i = 0; i < 26; i++) {
      const k = i / 25;
      p.elipsoide(3 + k * 11, 14 - Math.sin(k * Math.PI * 2.2) * 4 - k * 4, 1.8, 1.8, rIc("#4caf50"), { brilho: false, deslocar: (i % 3) * 0.3 });
    }
    p.elipsoide(15, 6, 2.8, 2.2, rIc("#4caf50"));
    p.pixel(16, 5, [255, 209, 102]);
    p.linha(17.5, 6.5, 18.5, 7.5, rIc("#e63946"), 1, 3);
  },
  alfinete(p) {
    p.elipsoide(9, 6.5, 5.5, 5.5, rIc("#e63946"));
    p.poligono([[5, 9], [13, 9], [9, 17]], rIc("#e63946"), { tom: 2 });
    p.elipsoide(9, 6.5, 2, 2, rIc("#fff3b0"), { brilho: false });
  },
  bussola(p) {
    p.elipsoide(9, 9, 8, 8, rIc("#c9952a"));
    p.elipsoide(9, 9, 6, 6, rIc("#f1dca4"), { brilho: false });
    p.poligono([[9, 3.5], [10.5, 9], [7.5, 9]], rIc("#e63946"));
    p.poligono([[9, 14.5], [10.5, 9], [7.5, 9]], rIc("#5a5a70"));
  },
  folha(p, { cor = "#4caf50" }) {
    p.poligono([[2, 16], [5, 7], [11, 2], [17, 1], [15, 8], [10, 14]], rIc(cor));
    p.linha(3, 15, 15, 3, rIc(tom(cor, 0.6)), 1, 2);
  },
  vento(p) {
    [[3, 5, 13], [1, 9, 16], [4, 13, 12]].forEach(([x, y, w]) => {
      p.linha(x, y, x + w - 2, y, rIc("#cfe6ff"), 1, 4);
      p.elipsoide(x + w - 1, y - 1.5, 1.6, 1.6, rIc("#cfe6ff"), { brilho: false });
    });
  },
  setas(p) {
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 1.6 + 0.4;
      p.pixel(9 + Math.cos(a) * 6.5, 9 + Math.sin(a) * 6.5, rIc("#6ef0ff")[3]);
      p.pixel(9 + Math.cos(a) * 5.5, 9 + Math.sin(a) * 5.5, rIc("#6ef0ff")[4]);
    }
    p.poligono([[13, 1], [17, 5], [12, 6]], rIc("#6ef0ff"));
  },
  lupa(p) {
    p.elipsoide(7, 7, 6, 6, rIc("#c9952a"));
    p.elipsoide(7, 7, 4.2, 4.2, rIc("#9fd4ff"), { brilhoMaior: 0.05 });
    p.linha(11, 11, 16.5, 16.5, rIc("#5c3418"), 2, 3);
  },
  bolsa(p, { cor = "#8a5a2a" }) {
    p.poligono([[2, 6], [16, 6], [16, 17], [2, 17]], rIc(cor));
    p.poligono([[2, 6], [16, 6], [14, 11], [4, 11]], rIc(cor), { tom: 4 });
    p.elipsoide(9, 11, 1.6, 1.6, rIc("#f5c451"));
    p.linha(6, 6, 7, 2, rIc(tom(cor, 0.7)), 1, 2);
    p.linha(12, 6, 11, 2, rIc(tom(cor, 0.7)), 1, 2);
    p.linha(7, 2, 11, 2, rIc(tom(cor, 0.7)), 1, 2);
  },
  engrenagem(p) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      p.elipsoide(9 + Math.cos(a) * 7, 9 + Math.sin(a) * 7, 1.8, 1.8, rIc("#9a9ab0"), { brilho: false });
    }
    p.elipsoide(9, 9, 6.5, 6.5, rIc("#9a9ab0"));
    p.elipsoide(9, 9, 2.4, 2.4, rIc("#2b2540"), { brilho: false });
  },
  lampada(p) {
    p.elipsoide(9, 7, 6, 6, rIc("#ffd166"), { brilhoMaior: 0.06 });
    p.poligono([[6, 11], [12, 11], [11, 15], [7, 15]], rIc("#ffd166"), { tom: 3 });
    p.poligono([[6.5, 14], [11.5, 14], [11.5, 17], [6.5, 17]], rIc("#9a9ab0"));
  },
  bau(p) {
    p.elipsoide(9, 7, 8, 4, rIc("#a8703a"), { ate: 7 });
    p.poligono([[1, 7], [17, 7], [17, 17], [1, 17]], rIc("#a8703a"));
    p.linha(1, 8, 17, 8, rIc("#f5c451"), 1, 4);
    [3, 15].forEach((x) => p.linha(x, 4, x, 17, rIc("#f5c451"), 1, 3));
    p.poligono([[7.5, 7], [10.5, 7], [10.5, 11], [7.5, 11]], rIc("#f5c451"));
  },
  pata(p) {
    p.elipsoide(9, 12, 4.5, 4, rIc("#8a5a2a"));
    [[3.5, 7], [7, 4], [11, 4], [14.5, 7]].forEach(([x, y]) => p.elipsoide(x, y, 2, 2.4, rIc("#8a5a2a")));
  },
  balanca(p) {
    const ouro = rIc("#f5c451");
    p.linha(9, 2, 9, 15, ouro, 1, 4);
    p.linha(2, 4, 16, 4, ouro, 1, 4);
    [3, 15].forEach((x) => {
      p.linha(x, 4, x - 1.5, 10, ouro, 1, 2);
      p.linha(x, 4, x + 1.5, 10, ouro, 1, 2);
      p.elipsoide(x, 10.5, 2.6, 1.4, ouro);
    });
    p.poligono([[6, 15], [12, 15], [13, 17], [5, 17]], ouro);
  },
  medalha(p, { cor = "#f5c451" }) {
    p.poligono([[4, 1], [8, 1], [10, 8], [6, 8]], rIc("#c8283c"));
    p.poligono([[10, 1], [14, 1], [12, 8], [8, 8]], rIc("#3d6fd6"));
    p.elipsoide(9, 12, 5.5, 5.5, rIc(cor));
    brilhoDeIcone(p, 9, 12, 1, "#ffffff");
  },
  corneta(p) {
    p.poligono([[2, 7], [6, 7], [15, 2], [15, 16], [6, 11], [2, 11]], rIc("#f5c451"));
    p.elipsoide(15, 9, 2, 7, rIc("#c9952a"));
  },
  proibido(p) {
    p.elipsoide(9, 9, 8, 8, rIc("#e63946"));
    p.elipsoide(9, 9, 5.5, 5.5, rIc("#f6f4ff"), { brilho: false });
    p.linha(5, 5, 13, 13, rIc("#e63946"), 2, 3);
  },
  exclamacao(p) {
    p.poligono([[7, 1], [11, 1], [10, 12], [8, 12]], rIc("#e63946"));
    p.elipsoide(9, 15.5, 2, 2, rIc("#e63946"));
  },
  pena(p) {
    p.poligono([[16, 1], [12, 3], [6, 9], [4, 14], [9, 11], [14, 6]], rIc("#f6f4ff"));
    p.linha(16, 1, 4, 14, rIc("#c9cbe0"), 1, 1);
    p.linha(4, 14, 2, 17, rIc("#2b2540"), 1, 1);
  },
  bandeira(p, { cor = "#e63946" }) {
    p.linha(3, 1, 3, 17, rIc("#8a5a2a"), 2, 3);
    p.poligono([[4, 2], [16, 4], [12, 7], [16, 10], [4, 10]], rIc(cor));
  },
  corrente(p) {
    [[3, 13], [9, 9], [15, 5]].forEach(([x, y], i) => {
      p.elipsoide(x, y, 3.4, 2.6, rIc("#9a9ab0"), { brilho: false });
      p.elipsoide(x, y, 1.6, 1, rIc("#1b1533"), { brilho: false, alfa: i % 2 ? 255 : 200 });
    });
  },
  onda(p) {
    for (let y = 4; y <= 14; y += 5) {
      for (let x = 1; x <= 17; x++) p.pixel(x, y + Math.sin(x * 0.7 + y) * 1.6, rIc("#4fa8ff")[3]);
      for (let x = 1; x <= 17; x++) p.pixel(x, y + 1 + Math.sin(x * 0.7 + y) * 1.6, rIc("#4fa8ff")[1]);
    }
  },
  sacoMoedas(p) {
    p.elipsoide(9, 12, 7, 5.5, rIc("#a8703a"));
    p.poligono([[6, 3], [12, 3], [11, 7], [7, 7]], rIc("#a8703a"));
    p.linha(6, 7, 12, 7, rIc("#f5c451"), 1, 4);
    p.elipsoide(9, 12.5, 2.2, 2.2, rIc("#f5c451"));
  },
  tenda(p) {
    p.poligono([[9, 1], [17, 9], [1, 9]], rIc("#c8283c"));
    for (let x = 2; x < 17; x += 4) p.poligono([[x, 9], [x + 2, 9], [x + 1, 11]], rIc("#f6f4ff"));
    p.poligono([[3, 9], [15, 9], [15, 17], [3, 17]], rIc("#a8703a"), { tom: 2 });
    p.poligono([[7, 11], [11, 11], [11, 17], [7, 17]], rIc("#1b1533"), { tom: 1 });
  },
  pocaoVerde(p) { FORMAS_DE_ITEM.frasco(p, { cor: "#4cdf6a" }); },
  rosto(p, { cor = "#ffd166" }) {
    p.elipsoide(9, 9, 8, 8, rIc(cor));
    [[6, 7.5], [12, 7.5]].forEach(([x, y]) => p.elipsoide(x, y, 1, 1.6, rIc("#1b1533"), { brilho: false }));
    for (let i = -3; i <= 3; i++) p.pixel(9 + i, 12 + (Math.abs(i) === 3 ? -1 : 0), [27, 21, 51]);
  },
  mao(p) {
    p.elipsoide(9, 11, 5.5, 5.5, rIc("#e9b98f"));
    [4.5, 7.5, 10.5, 13.5].forEach((x, i) => p.elipsoide(x, 5 - (i === 1 || i === 2 ? 1 : 0), 1.4, 3.5, rIc("#e9b98f")));
  },
  relogio(p) {
    p.elipsoide(9, 10, 7.5, 7.5, rIc("#c9952a"));
    p.elipsoide(9, 10, 5.8, 5.8, rIc("#f6f4ff"), { brilho: false });
    p.linha(9, 10, 9, 6, rIc("#1b1533"), 1, 1);
    p.linha(9, 10, 12, 10, rIc("#1b1533"), 1, 1);
    p.elipsoide(9, 2, 1.6, 1.2, rIc("#c9952a"));
  },
  pessoa(p) {
    p.elipsoide(9, 5, 3.5, 3.5, rIc("#e9b98f"));
    p.elipsoide(9, 15, 6, 5, rIc("#3d6fd6"), { ate: 17 });
  },
  casa(p) {
    p.poligono([[9, 1], [17, 9], [1, 9]], rIc("#c8283c"));
    p.poligono([[3, 9], [15, 9], [15, 17], [3, 17]], rIc("#e8d3a0"));
    p.poligono([[7.5, 12], [10.5, 12], [10.5, 17], [7.5, 17]], rIc("#8a5a2a"));
  },
  globo(p) {
    p.elipsoide(9, 9, 8, 8, rIc("#3d8bd9"));
    p.elipsoide(7, 7, 3, 2.5, rIc("#4caf50"), { dentro: true });
    p.elipsoide(12, 12, 2.6, 2, rIc("#4caf50"), { dentro: true });
  },
  sol(p) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      p.linha(9 + Math.cos(a) * 6, 9 + Math.sin(a) * 6, 9 + Math.cos(a) * 8.5, 9 + Math.sin(a) * 8.5, rIc("#ffd166"), 1, 4);
    }
    p.elipsoide(9, 9, 5, 5, rIc("#ffd166"));
  },
  nuvem(p, { cor = "#e8eef5" }) {
    p.elipsoide(6, 11, 4.5, 4, rIc(cor));
    p.elipsoide(11, 8, 5.5, 5, rIc(cor));
    p.elipsoide(13.5, 12, 4, 3.5, rIc(cor));
  },
  sacola(p) { FORMAS_DE_ICONE.bolsa(p, { cor: "#6a4fc0" }); },
  interrogacao(p) {
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI * 1.1 + (i / 16) * Math.PI * 1.45;
      p.elipsoide(9 + Math.cos(a) * 4.5, 6 + Math.sin(a) * 4.5, 1.4, 1.4, rIc("#a98bff"), { brilho: false });
    }
    p.linha(9, 10, 9, 12, rIc("#a98bff"), 2, 3);
    p.elipsoide(9.5, 15.5, 1.6, 1.6, rIc("#a98bff"));
  },
  // a carta com o lacre de cera
  carta(p) {
    p.poligono([[1, 4], [17, 4], [17, 15], [1, 15]], rIc("#f1dca4"), { tom: 3 });
    p.linha(1, 4, 9, 10, rIc("#c79a4c"), 1, 2);
    p.linha(17, 4, 9, 10, rIc("#c79a4c"), 1, 2);
    p.elipsoide(9, 10, 2, 2, rIc("#c8283c"));
  },
  // a placa de madeira na estaca
  placa(p) {
    p.linha(9, 10, 9, 17, rIc("#5c3418"), 2, 3);
    p.poligono([[1, 2], [17, 2], [17, 11], [1, 11]], rIc("#a8703a"));
    [5, 8].forEach((y) => p.linha(4, y, 14, y, rIc("#5c3418"), 1, 1));
  },
  flor(p, { cor = "#ff9fbf" }) {
    p.linha(9, 10, 9, 17, rIc("#4caf50"), 1, 3);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      p.elipsoide(9 + Math.cos(a) * 4, 7 + Math.sin(a) * 4, 2.8, 2.8, rIc(cor));
    }
    p.elipsoide(9, 7, 2, 2, rIc("#ffd166"));
  },
};

// cada emoji (sem o FE0F) e a sua forma: [forma, opções]. As formas dos itens (itens_arte.js) também valem.
const ICONE_DO_EMOJI = {
  "🛡": ["escudo", {}], "⚔": ["espadas", {}], "🗡": ["adaga", {}], "🏹": ["arco", {}], "🎯": ["alvo", {}],
  "🔮": ["orbe", {}], "🪄": ["varinha", {}], "🧙": ["chapeuMago", {}], "🎩": ["cartola", {}], "🤠": ["chapeuCacador", {}],
  "👒": ["chapeuCacador", { cor: "#a8323e" }], "🧝": ["capuz", {}], "🧣": ["manto", {}], "👘": ["manto", { cor: "#3d4fd6" }],
  "🧥": ["manto", { cor: "#16b8b8" }], "🎗": ["bandana", {}], "🎌": ["bandana", {}], "⛑": ["elmo", {}], "🪖": ["elmo", { cor: "#f5c451", pluma: "#3d6fd6" }],
  "📕": ["grimorio", {}], "📘": ["grimorio", { cor: "#3d6fd6" }], "📗": ["grimorio", { cor: "#2e9e5a" }], "📒": ["grimorio", { cor: "#d4a52c" }],
  "📖": ["livroAberto", {}], "📚": ["livros", {}], "📜": ["pergaminho", {}], "📋": ["pergaminho", {}], "📄": ["pergaminho", {}], "📝": ["pena", {}],
  "✍": ["pena", {}], "✏": ["pena", {}], "✨": ["brilhos", {}], "🌟": ["estrela", {}], "⭐": ["estrela", {}], "💫": ["brilhos", {}],
  "🪙": ["moeda", {}], "💰": ["sacoMoedas", {}], "🔒": ["cadeado", {}], "🔐": ["cadeado", {}], "🔏": ["cadeado", {}], "🔓": ["cadeado", { aberto: true }],
  "🔑": ["chave", {}], "🗝": ["chave", {}], "🔥": ["chama", {}], "❤️‍🔥": ["coracao", { cor: "#ff6a28", brilho: "#fff3b0" }],
  "🌀": ["espiral", { cor: "#c08bff" }], "☠": ["caveira", {}], "💀": ["caveira", {}], "⚠": ["alerta", {}], "🚨": ["alerta", {}],
  "🏰": ["castelo", {}], "🏯": ["castelo", {}], "🏛": ["castelo", {}], "🏆": ["taca", {}], "✅": ["certo", {}], "❌": ["errado", {}], "✖": ["errado", {}],
  "👑": ["coroa", {}], "♛": ["coroa", { cor: "#7a5ab8" }], "⚡": ["raio", {}], "🌩": ["raio", { cor: "#9fd4ff" }], "🐉": ["dragao", {}], "🐲": ["dragao", { cor: "#2e9e5a" }],
  "⏳": ["ampulheta", {}], "⌛": ["ampulheta", {}], "⏱": ["relogio", {}], "⏰": ["relogio", {}],
  "❤": ["coracao", { cor: "#e8283c" }], "💖": ["coracao", { cor: "#ff4d8d" }], "💗": ["coracao", { cor: "#ff7aa8" }], "💙": ["coracao", { cor: "#4fa8ff" }],
  "💚": ["coracao", { cor: "#4cdf6a" }], "💜": ["coracao", { cor: "#9b5cff" }], "🖤": ["coracao", { cor: "#3a2a5a", brilho: "#c08bff" }], "💛": ["coracao", { cor: "#ffd166" }],
  "🎵": ["nota", {}], "🎶": ["nota", {}], "🗺": ["mapa", {}], "🚪": ["porta", {}], "🌳": ["arvore", {}], "🌲": ["arvore", { cor: "#2f7d46", pinheiro: true }],
  "🎓": ["capelo", {}], "🤖": ["constructo", {}], "🧠": ["cerebro", {}], "🧪": ["frasco", { cor: "#4cdf6a" }], "⚗": ["frasco", { cor: "#9b5cff" }],
  "📊": ["grafico", {}], "📈": ["grafico", {}], "💎": ["gema", { cor: "#6ef0ff" }], "💠": ["gema", { cor: "#4fa8ff" }], "🔷": ["gema", { cor: "#2f7bff" }], "♦": ["gema", { cor: "#e8283c" }],
  "💬": ["balao", {}], "💭": ["balao", { cor: "#e8eef5" }], "🗣": ["balao", {}], "🌙": ["lua", {}], "🌒": ["lua", {}], "🌕": ["lua", { cor: "#e8e4c8" }],
  "🌱": ["broto", {}], "💥": ["explosao", {}], "☄": ["explosao", { cor: "#ff5a1f" }], "🍀": ["trevo", {}], "🐍": ["cobra", {}],
  "📍": ["alfinete", {}], "📌": ["alfinete", {}], "🧭": ["bussola", {}], "❄": ["floco", { cor: "#cfeaff" }], "🧊": ["gelo", { cor: "#9fd4ff" }],
  "🌿": ["folha", {}], "🍃": ["folha", { cor: "#7ddc5a" }], "🍂": ["folha", { cor: "#d0782a" }], "👁": ["olho", { cor: "#3d8bd9" }], "👀": ["olho", { cor: "#3d8bd9" }],
  "💨": ["vento", {}], "🌫": ["vento", {}], "🔁": ["setas", {}], "🔄": ["setas", {}], "🔍": ["lupa", {}], "🔎": ["lupa", {}],
  "💼": ["bolsa", {}], "👝": ["bolsa", { cor: "#a8323e" }], "🎒": ["bolsa", { cor: "#6a4fc0" }], "💧": ["lagrima", { cor: "#4fa8ff" }], "🫧": ["lagrima", { cor: "#9fd4ff" }],
  "⚙": ["engrenagem", {}], "💡": ["lampada", {}], "🎁": ["bau", {}], "🧰": ["bau", {}], "📦": ["bau", {}], "🐾": ["pata", {}], "⚖": ["balanca", {}],
  "🥇": ["medalha", {}], "🥈": ["medalha", { cor: "#c9cbe0" }], "🥉": ["medalha", { cor: "#c9803a" }], "🏅": ["medalha", {}], "🎖": ["medalha", {}],
  "📣": ["corneta", {}], "📢": ["corneta", {}], "⛔": ["proibido", {}], "🚫": ["proibido", {}], "❗": ["exclamacao", {}],
  "🚩": ["bandeira", {}], "🏳": ["bandeira", { cor: "#f6f4ff" }], "🔗": ["corrente", {}], "⛓": ["corrente", {}], "🌊": ["onda", {}],
  "🔨": ["martelo", {}], "⚒": ["martelo", {}], "🛠": ["martelo", {}], "🔧": ["martelo", {}], "🪓": ["machado", {}],
  "🏪": ["tenda", {}], "🌋": ["chama", { cor: "#e8283c" }], "🕯": ["garrafa", { cor: "#ffd166" }],
  "🦴": ["osso", {}], "🪨": ["minerio", {}], "🦷": ["presa", { cor: "#e6f0ff", base: "#6a7a9a" }], "🦂": ["presa", { cor: "#f5c451", base: "#8b4513" }],
  "🕸": ["seda", { cor: "#d8f4ff" }], "🌑": ["caco", { cor: "#4a3a7a" }], "🌌": ["po", { cor: "#2b2050", estrelas: "#fff3b0" }],
  "✴": ["caco", { cor: "#f5c451" }], "🟢": ["gota", { cor: "#5fd35f" }], "🔵": ["nucleo", { cor: "#2fd6e8" }], "🟣": ["nucleo", { cor: "#9b5cff" }],
  "🍞": ["pao", {}], "🙂": ["rosto", {}], "✋": ["mao", {}], "👋": ["mao", {}], "🧑": ["pessoa", {}], "👤": ["pessoa", {}], "👥": ["pessoa", {}],
  "❔": ["interrogacao", {}], "❓": ["interrogacao", {}], "🤔": ["rosto", {}], "🙋": ["rosto", {}], "🤷": ["rosto", {}], "🥹": ["rosto", {}],
  "😅": ["rosto", {}], "😂": ["rosto", {}], "🧓": ["rosto", { cor: "#e9b98f" }], "🎭": ["rosto", { cor: "#a98bff" }], "🤝": ["mao", {}], "🙏": ["mao", {}],
  "📧": ["carta", {}], "✉": ["carta", {}], "📨": ["carta", {}], "🪧": ["placa", {}], "🌸": ["flor", {}], "💔": ["coracao", { cor: "#8a2a3a" }],
  "💻": ["orbe", { cor: "#6ef0ff" }], "🖥": ["orbe", { cor: "#6ef0ff" }], "⌨": ["grimorio", { cor: "#5a5a70" }], "💾": ["gema", { cor: "#3d6fd6" }],
  "🔭": ["lupa", {}], "🚀": ["explosao", { cor: "#ff5a1f" }], "🎉": ["brilhos", {}], "🔊": ["corneta", {}], "🔇": ["corneta", {}], "📡": ["corneta", {}],
  "🗑": ["errado", {}], "🏟": ["castelo", {}], "🍺": ["frasco", { cor: "#e8a03a" }], "🌅": ["sol", {}], "🏃": ["vento", {}], "🕊": ["pena", {}],
  "🐺": ["mascote", { id: "lobo", cor: "#8a8fa3" }], "🦉": ["mascote", { id: "coruja", cor: "#8b5a2b" }], "🐈": ["mascote", { id: "gato", cor: "#2b2540" }],
  "🦊": ["mascote", { id: "raposa", cor: "#e8742a" }], "🐢": ["mascote", { id: "tartaruga", cor: "#4a7a5a" }], "🗿": ["mascote", { id: "golem", cor: "#8a8fa3" }],
  "🐇": ["mascote", { id: "coelho", cor: "#e8e4f0" }], "🦅": ["mascote", { id: "fenix", cor: "#e74c3c" }], "🐸": ["monstro", { qual: "sapo" }],
  "👾": ["monstro", { qual: "slime" }], "🐛": ["monstro", { qual: "slime" }], "🦇": ["monstro", { qual: "morcego" }], "👻": ["monstro", { qual: "assombracao" }],
  "🏠": ["casa", {}], "🌍": ["globo", {}], "🌐": ["globo", {}], "☀": ["sol", {}], "🔆": ["sol", {}], "☁": ["nuvem", {}],
};

// as formas que faltam montadas com as dos itens
Object.assign(FORMAS_DE_ICONE, {
  brilhos(p) {
    brilhoDeIcone(p, 10, 7, 5, "#ffd166");
    brilhoDeIcone(p, 4, 13, 3, "#fff3b0");
    brilhoDeIcone(p, 15, 15, 2, "#fff3b0");
  },
  martelo(p) {
    p.linha(4, 16, 11, 7, rIc("#8a5a2a"), 2, 3);
    p.poligono([[8, 2], [15, 9], [12, 12], [5, 5]], rIc("#9a9ab0"));
    p.poligono([[8, 2], [11, 5], [8, 8], [5, 5]], rIc("#9a9ab0"), { tom: 4 });
  },
  machado(p) {
    p.linha(5, 17, 12, 3, rIc("#8a5a2a"), 2, 3);
    p.poligono([[10, 2], [17, 3], [17, 11], [11, 8]], rIc("#c9cbe0"));
    p.linha(17, 3, 17, 11, rIc("#ffffff"), 1, 5);
  },
});

const cacheIconesPintados = new Map();
function chaveDoEmoji(emoji) {
  return emoji.replace(/️/g, "");
}
// as chaves do mapa sem o FE0F (o seletor de emoji), do mesmo jeito que o conversor procura
Object.keys(ICONE_DO_EMOJI).forEach((k) => {
  const limpa = chaveDoEmoji(k);
  if (limpa !== k) {
    ICONE_DO_EMOJI[limpa] = ICONE_DO_EMOJI[k];
    delete ICONE_DO_EMOJI[k];
  }
});

// a imagem (data URL) do ícone de RPG de um emoji, ou null se ele não tem forma
function iconeDoEmoji(emoji) {
  const chave = chaveDoEmoji(emoji);
  if (cacheIconesPintados.has(chave)) return cacheIconesPintados.get(chave);
  let src = null;
  const arte = ICONE_DO_EMOJI[chave] || ICONE_DO_EMOJI[chave.split("‍")[0]];
  // os bichos usam a arte deles mesmos (mascotes e monstros do bestiário), no primeiro quadro
  try {
    if (arte?.[0] === "mascote" && typeof mascoteArte === "function") src = mascoteArte(arte[1].id, arte[1].cor)?.parado?.[0]?.toDataURL() || null;
    if (arte?.[0] === "monstro") {
      const quadros = { slime: () => slimeArte("#5fd35f"), sapo: () => sapoArte(), morcego: () => morcegoArte(), assombracao: () => assombracaoArte() }[arte[1].qual];
      src = quadros?.()?.[0]?.toDataURL() || null;
    }
  } catch {
    src = null;
  }
  if (src) {
    cacheIconesPintados.set(chave, src);
    return src;
  }
  const forma = arte && (FORMAS_DE_ICONE[arte[0]] || FORMAS_DE_ITEM[arte[0]]);
  if (forma) {
    try {
      const p = pintura(18, 18);
      forma(p, arte[1]);
      src = p.pronto().toDataURL();
    } catch {
      src = null;
    }
  }
  // sem forma própria: o emoji em pixel, com contorno (para nada ficar com cara de emoji do sistema)
  if (!src && typeof emojiPixel === "function") src = emojiPixel(emoji, 18);
  cacheIconesPintados.set(chave, src);
  return src;
}

function imgDoEmoji(emoji) {
  const src = iconeDoEmoji(emoji);
  if (!src) return null;
  const img = document.createElement("img");
  img.className = "icone-px";
  img.src = src;
  img.alt = emoji;
  img.draggable = false;
  return img;
}

// ---------- o conversor: troca os emojis da tela pelos ícones ----------
// Os emojis "de verdade" (pictogramas). Os sinais de texto (✓ ✗ ★ ✦ ▸ ◆ setas) ficam como estão.
const PADRAO_EMOJI = /(?:\p{Extended_Pictographic}(?:️)?(?:‍\p{Extended_Pictographic}(?:️)?)*)/gu;
const SINAIS_DE_TEXTO = new Set(["✓", "✔", "✗", "✕", "★", "☆", "✦", "▶", "◀", "▲", "▼", "⬆", "⬇", "⬅", "➡", "↔", "↖", "↗", "↘", "↙", "↺", "↻",
  "♪", "♫", "♥", "©", "®", "™", "➜", "◆", "◇", "☰", "⛶", "➕", "⏩", "⏹", "▸", "◂"]);
const FORA_DO_CONVERSOR = "script, style, textarea, input, select, option, svg, canvas, title, [contenteditable], .sem-icone-px, code, pre";

function converterTexto(no) {
  const texto = no.nodeValue;
  if (!texto || !/[←-⯿〰〽\uD83C-\uDBFF]/.test(texto)) return;
  const pai = no.parentElement;
  if (!pai || pai.closest(FORA_DO_CONVERSOR)) return;
  PADRAO_EMOJI.lastIndex = 0;
  let ultimo = 0;
  let mudou = false;
  const pedacos = document.createDocumentFragment();
  for (const m of texto.matchAll(PADRAO_EMOJI)) {
    const emoji = m[0];
    if (SINAIS_DE_TEXTO.has(chaveDoEmoji(emoji))) continue;
    const img = imgDoEmoji(emoji);
    if (!img) continue;
    if (m.index > ultimo) pedacos.append(texto.slice(ultimo, m.index));
    pedacos.append(img);
    ultimo = m.index + emoji.length;
    mudou = true;
  }
  if (!mudou) return;
  if (ultimo < texto.length) pedacos.append(texto.slice(ultimo));
  no.replaceWith(pedacos);
}

function converterEmojis(raiz) {
  if (!raiz) return;
  if (raiz.nodeType === Node.TEXT_NODE) return converterTexto(raiz);
  if (raiz.nodeType !== Node.ELEMENT_NODE || raiz.matches?.(FORA_DO_CONVERSOR)) return;
  const andador = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  const nos = [];
  while (andador.nextNode()) nos.push(andador.currentNode);
  nos.forEach(converterTexto);
}

// liga o conversor na página inteira: o que já está lá e tudo que aparecer depois
function ligarIconesRpg() {
  if (ligarIconesRpg.ligado || typeof MutationObserver === "undefined") return;
  ligarIconesRpg.ligado = true;
  converterEmojis(document.body);
  const pendentes = new Set();
  let agendado = false;
  const observador = new MutationObserver((mudancas) => {
    mudancas.forEach((m) => {
      if (m.type === "characterData") pendentes.add(m.target);
      else m.addedNodes.forEach((n) => pendentes.add(n));
    });
    if (agendado) return;
    agendado = true;
    // junta as mudanças do mesmo quadro (antes de pintar a tela, sem piscar o emoji)
    queueMicrotask(() => {
      agendado = false;
      const lista = [...pendentes];
      pendentes.clear();
      lista.forEach((n) => n.isConnected && converterEmojis(n));
    });
  });
  observador.observe(document.body, { childList: true, subtree: true, characterData: true });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ligarIconesRpg);
else ligarIconesRpg();
