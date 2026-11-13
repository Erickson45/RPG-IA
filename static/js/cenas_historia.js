// As cenas animadas da história: cada capítulo abre com uma pequena cena em pixel art (no mesmo motor do
// prólogo, telaPrologo), e as grandes revelações (a verdade de Lyra, a memória de Malakar) também. Cada
// cena toca uma vez só (progresso.cenasVistas); tocarCenaDaHistoria(id, depois) devolve se tocou.
// Depende de pixel.js, cenarios.js, heroi.js, reino.js (sprites dos monstros), umbra.js (LYRA) e prologo.js.

// ---------- pedacinhos de cenário ----------

function chaoDaCena(ctx, cor, borda) {
  retangulo(ctx, 0, 80, LARGURA_PROLOGO, 30, cor);
  if (borda) for (let x = 0; x < LARGURA_PROLOGO; x += 7) retangulo(ctx, x, 80, 5, 1, borda);
}

function estrelasDaCena(ctx, t, quantas = 40, ate = 70) {
  for (let i = 0; i < quantas; i++) {
    const brilha = Math.sin(t * (1 + (i % 5)) + i) > 0.2;
    retangulo(ctx, (i * 47 + 13) % LARGURA_PROLOGO, (i * 31 + 7) % ate, 1, 1, brilha ? "#ffffff" : "#6c6a9a");
  }
}

// o herói andando de lado (x cresce com o tempo, até "ate")
function heroiNaCena(ctx, heroi, x0, y, t, velocidade = 22, ate = 999) {
  const x = Math.round(Math.min(ate, x0 + t * velocidade));
  const parado = x >= ate;
  ctx.drawImage(heroi.lado[parado ? 0 : Math.floor(t * VELOCIDADE_ANDAR) % QUADROS_ANDAR], x, y);
  return x;
}

// um desenho qualquer pintado de uma cor só (as silhuetas dos chefões)
function silhueta(sprite, cor) {
  const { canvas, ctx } = criarTela(sprite.width, sprite.height);
  ctx.drawImage(sprite, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = cor;
  ctx.fillRect(0, 0, sprite.width, sprite.height);
  return canvas;
}

// uma carta (pergaminho com o lacre vermelho do "L.") flutuando
function cartaDeL(ctx, x, y, t) {
  const sobe = Math.round(Math.sin(t * 2) * 2);
  brilhoRedondo(ctx, x + 12, y + 9 + sobe, 18, "255, 209, 102", 0.07);
  retangulo(ctx, x, y + sobe, 24, 18, "#e9dcb8");
  retangulo(ctx, x, y + sobe, 24, 2, "#cdbb8e");
  for (let i = 0; i < 4; i++) retangulo(ctx, x + 3, y + 5 + i * 3 + sobe, 14 - (i % 2) * 4, 1, "#8a7a5a");
  circuloPixel(ctx, x + 18, y + 13 + sobe, 3, "#a8323e");
  retangulo(ctx, x + 17, y + 12 + sobe, 2, 3, "#ffd166");
}

// ---------- os capítulos ----------

const CENAS_HISTORIA = {
  "capitulo-1": {
    titulo: "Capítulo I",
    cenas: [
      {
        texto: "A capital de Elyndor acorda com o sino da Academia. Hoje, um aprendiz atravessa os portões pela primeira vez.",
        pintar(ctx, t, heroi) {
          ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#3a2a6b", "#7a4a8a", "#d07a6a", "#f5b56b"]);
          circuloPixel(ctx, 124, 66 - Math.min(16, t * 4), 10, "#ffd166");
          // a muralha e as torres da capital, com bandeiras ao vento
          retangulo(ctx, 0, 52, LARGURA_PROLOGO, 28, "#3d2f5a");
          for (let x = 0; x < LARGURA_PROLOGO; x += 8) retangulo(ctx, x, 48, 5, 4, "#3d2f5a");
          [[18, 30], [62, 22], [104, 28], [146, 34]].forEach(([x, y], i) => {
            retangulo(ctx, x - 6, y, 12, 52 - y, "#2b2140");
            retangulo(ctx, x - 8, y - 3, 16, 3, "#4a3a6a");
            retangulo(ctx, x, y - 12, 1, 9, "#5c3418");
            retangulo(ctx, x + 1, y - 12 + (Math.floor(t * 5 + i) % 2), 6, 4, i % 2 ? "#a8323e" : "#2f6fb0");
            retangulo(ctx, x - 2, y + 8, 4, 5, "#ffd166");
          });
          // o portão aberto
          retangulo(ctx, 74, 58, 16, 22, "#1b1430");
          chaoDaCena(ctx, "#4a6b3a", "#5f8a4a");
          for (let x = 70; x < 96; x += 3) retangulo(ctx, x, 80 + (x % 2), 2, 30, "#8a7a5a");
          heroiNaCena(ctx, heroi, 70, 34, t, 20, 120);
        },
      },
      {
        texto: "Lá fora, os campos estão cheios de gosma... e de perguntas sem resposta. Cada monstro guarda um pedaço do saber perdido.",
        pintar(ctx, t, heroi) {
          ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#6ab0e8", "#8cc6ee", "#b6dcf2", "#d8eef8"]);
          [[20, 18], [92, 12], [134, 24]].forEach(([x, y], i) => {
            const dx = (x + t * (4 + i)) % 190 - 15;
            retangulo(ctx, Math.round(dx), y, 22, 5, "#ffffff");
            retangulo(ctx, Math.round(dx) + 4, y - 3, 12, 3, "#ffffff");
          });
          chaoDaCena(ctx, "#5fa84a", "#7cc35f");
          for (let i = 0; i < 12; i++) retangulo(ctx, (i * 37) % 160, 84 + (i * 7) % 22, 2, 2, "#3f8f4a");
          [["#5fd35f", 70], ["#4fa8ff", 102], ["#b06cff", 132]].forEach(([cor, x], i) => {
            const pulo = Math.round(Math.abs(Math.sin(t * 3 + i)) * 8);
            ctx.drawImage(spriteReino(`cena-slime-${cor}`, () => spriteSlime(cor)), x, 64 - pulo);
            // a interrogação que cada monstro carrega
            const y = 52 - pulo + Math.round(Math.sin(t * 4 + i));
            retangulo(ctx, x + 9, y, 5, 1, "#ffffff");
            retangulo(ctx, x + 13, y + 1, 1, 2, "#ffffff");
            retangulo(ctx, x + 11, y + 3, 2, 1, "#ffffff");
            retangulo(ctx, x + 11, y + 6, 2, 1, "#ffffff");
          });
          ctx.drawImage(heroi.lado[0], 18, 34);
          brilhoRedondo(ctx, 44, 44, 6, "110, 240, 255", 0.12 + Math.sin(t * 5) * 0.04);
        },
      },
    ],
  },
  "capitulo-2": {
    titulo: "Capítulo II",
    cenas: [
      {
        texto: "Na Floresta Uivante, os lobos uivam para um céu sem estrelas. Alguma coisa os deixou com fome de respostas.",
        pintar(ctx, t) {
          ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#05070f", "#0a1020", "#101a30", "#16223e"]);
          circuloPixel(ctx, 128, 20, 10, "#e8eef5");
          brilhoRedondo(ctx, 128, 20, 24, "232, 238, 245", 0.05);
          chaoDaCena(ctx, "#0e1a14");
          for (let x = -4; x < LARGURA_PROLOGO; x += 11) pinheiro(ctx, x, 82 + (x % 3) * 2, "#0a1610", "#10241a");
          const lobo = spriteReino("cena-lobos", () => quadrosLobo("#2b2540", "#ff4d6d"));
          const x = Math.round(-36 + ((t * 26) % 210));
          ctx.drawImage(lobo[Math.floor(t * 8) % 4], x, 66);
          // o uivo: ondas saindo do focinho do lobo parado no morro
          ctx.drawImage(lobo[1], 104, 52);
          for (let i = 0; i < 3; i++) {
            const r = ((t * 14 + i * 7) % 21);
            ctx.fillStyle = `rgba(232, 238, 245, ${0.4 * (1 - r / 21)})`;
            ctx.fillRect(134 + r, 50 - Math.round(r * 0.6), 1, 3);
          }
          [[30, 90], [70, 96], [118, 92]].forEach(([ox, oy], i) => {
            if (Math.sin(t * 2 + i * 2) > -0.4) {
              retangulo(ctx, ox, oy, 2, 1, "#ffd166");
              retangulo(ctx, ox + 4, oy, 2, 1, "#ffd166");
            }
          });
        },
      },
      {
        texto: "Presa num tronco, uma carta: \"Não confie em respostas que ninguém confere.\" Embaixo, só uma letra: L.",
        pintar(ctx, t) {
          ceuEmFaixas(ctx, LARGURA_PROLOGO, ALTURA_PROLOGO, ["#0a1020", "#101a30", "#142038", "#1a2842"]);
          // o tronco, de perto
          retangulo(ctx, 48, 20, 64, 90, "#3d2a1a");
          for (let y = 22; y < 110; y += 6) retangulo(ctx, 50 + (y % 12), y, 18, 1, "#2a1b10");
          retangulo(ctx, 48, 20, 6, 90, "#4a3420");
          cartaDeL(ctx, 68, 44, t);
          // folhas caindo
          for (let i = 0; i < 6; i++) {
            const c = (t * 0.25 + i / 6) % 1;
            retangulo(ctx, Math.round(10 + i * 26 + Math.sin(t * 2 + i) * 6), Math.round(c * 110), 2, 1, i % 2 ? "#3f7d3a" : "#5c8a3a");
          }
        },
      },
    ],
  },
  "capitulo-3": {
    titulo: "Capítulo III",
    cenas: [
      {
        texto: "No pântano, a névoa faz o falso parecer verdadeiro. Quem não confere as fontes afunda devagar.",
        pintar(ctx, t) {
          ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#0e1a14", "#16261c", "#1e3226", "#284030"]);
          retangulo(ctx, 0, 70, LARGURA_PROLOGO, 40, "#1a3a2e");
          // a sombra do Sapo Rei, enorme, meio escondida na névoa
          const rei = spriteReino("cena-sapo-rei", () => silhueta(ampliarSprite(spriteSapo(), 3), "#0c1a12"));
          ctx.drawImage(rei, 50, 22 + Math.round(Math.sin(t) * 2));
          retangulo(ctx, 76, 40, 3, 2, "#ffd166");
          retangulo(ctx, 98, 40, 3, 2, "#ffd166");
          // reflexos que mentem: a lua aparece duas vezes na água
          circuloPixel(ctx, 30, 18, 6, "#c8f59a");
          circuloPixel(ctx, 30 + Math.round(Math.sin(t * 2) * 3), 88, 6, "rgba(200, 245, 154, 0.5)");
          for (let i = 0; i < 4; i++) {
            const y = 60 + i * 9;
            ctx.fillStyle = `rgba(160, 200, 170, ${0.12 + 0.05 * Math.sin(t + i)})`;
            ctx.fillRect(Math.round(((t * (6 + i * 3)) % 60) - 60), y, 220, 4);
          }
        },
      },
      {
        texto: "Outra carta de L., molhada de lágrima ou de brejo: \"Ele ainda vive. À noite, eu ouço a voz dele.\"",
        pintar(ctx, t) {
          ceuEmFaixas(ctx, LARGURA_PROLOGO, ALTURA_PROLOGO, ["#0a140e", "#122018", "#1a2c22", "#22382c"]);
          for (let i = 0; i < 5; i++) {
            const r = (t * 10 + i * 9) % 45;
            ctx.strokeStyle = `rgba(200, 245, 154, ${0.3 * (1 - r / 45)})`;
            ctx.beginPath();
            ctx.ellipse(80, 62, r, r * 0.3, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          cartaDeL(ctx, 68, 50, t);
          [[22, 70], [130, 76], [118, 54]].forEach(([x, y]) => retangulo(ctx, x, y, 10, 3, "#3f8f4a"));
        },
      },
    ],
  },
  "capitulo-4": {
    titulo: "Capítulo IV",
    cenas: [
      {
        texto: "Sob as dunas de Qadir, uma pirâmide guarda a inscrição mais antiga do Reino.",
        pintar(ctx, t) {
          ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#f5a65b", "#f5c07b", "#f8d89b", "#fbe8bb"]);
          circuloPixel(ctx, 30, 22, 9, "#fff3b0");
          for (let x = 0; x < LARGURA_PROLOGO; x++) {
            const h = 14 + Math.round(Math.sin(x * 0.05 + 1) * 6 + Math.sin(x * 0.13) * 3);
            retangulo(ctx, x, 80 - h, 1, h + 30, x % 9 ? "#e8b86a" : "#d9a85a");
          }
          for (let i = 0; i < 18; i++) retangulo(ctx, 80 - i * 2, 30 + i * 2, 4 + i * 4, 2, i % 3 ? "#c9955a" : "#b5824a");
          const esc = spriteReino("cena-escorpiao", () => spriteEscorpiao());
          ctx.drawImage(esc, Math.round(140 - ((t * 14) % 170)), 82);
          // o vento levando a areia
          for (let i = 0; i < 10; i++) retangulo(ctx, Math.round((t * 60 + i * 37) % 180) - 10, 50 + (i * 11) % 50, 3, 1, "rgba(255, 240, 200, 0.6)");
        },
      },
      {
        texto: "\"O Vazio não pensa. Ele só consome o que foi decorado sem ser compreendido.\"",
        pintar(ctx, t) {
          ceuEmFaixas(ctx, LARGURA_PROLOGO, ALTURA_PROLOGO, ["#3d2a1a", "#4a3420", "#5a4028", "#6a4c30"]);
          for (let y = 0; y < ALTURA_PROLOGO; y += 10) for (let x = (y / 10) % 2 ? 0 : 10; x < LARGURA_PROLOGO; x += 20) retangulo(ctx, x, y, 19, 9, "#7a5a38");
          // as runas acendem uma a uma
          const acesas = Math.floor(t * 6);
          for (let i = 0; i < 36; i++) {
            const x = 22 + (i % 12) * 10;
            const y = 34 + Math.floor(i / 12) * 14;
            const cor = i < acesas ? "#ffd166" : "#4a3420";
            if (i < acesas) brilhoRedondo(ctx, x + 3, y + 4, 5, "255, 209, 102", 0.08);
            retangulo(ctx, x, y, 6, 1, cor);
            retangulo(ctx, x + (i % 3) * 2, y + 1, 1, 6, cor);
            retangulo(ctx, x, y + 7, 6, 1, cor);
          }
        },
      },
    ],
  },
  "capitulo-5": {
    titulo: "Capítulo V",
    cenas: [
      {
        texto: "Nas Montanhas do Dragão, um rugido sacode o Reino inteiro. Ignis, o Dragão Rei, acordou.",
        pintar(ctx, t) {
          ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#2a0a14", "#4a1020", "#6a1a28", "#8a2a30"]);
          for (let x = 0; x < LARGURA_PROLOGO; x++) {
            const h = 30 + Math.round(Math.abs(Math.sin(x * 0.04)) * 24 + Math.sin(x * 0.17) * 4);
            retangulo(ctx, x, 80 - h, 1, h, "#2b2033");
            retangulo(ctx, x, 80 - h, 1, 3, "#e8eef5");
          }
          chaoDaCena(ctx, "#1b1520");
          const quadros = spriteReino("cena-ignis", () => quadrosDragao("#8a1010", { escala: 1.3, coroa: true }));
          const x = Math.round(-90 + ((t * 30) % 280));
          ctx.drawImage(quadros[Math.floor(t * 9) % quadros.length], x, 4 + Math.round(Math.sin(t * 2) * 4));
          // a baforada
          for (let i = 0; i < 10; i++) {
            const k = (t * 3 + i * 0.1) % 1;
            retangulo(ctx, x + 72 + Math.round(k * 30), 30 + Math.round(k * 20 + Math.sin(i) * 4), 2, 2, k < 0.5 ? "#ffd166" : "#ff4d6d");
          }
        },
      },
      {
        texto: "E a pergunta que ninguém teve coragem de fazer: se a Ruptura acabou há trezentos anos... por que os monstros continuam nascendo?",
        pintar(ctx, t, heroi) {
          ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#07040f", "#120a22", "#1d0f33", "#2a1240"]);
          estrelasDaCena(ctx, t, 30, 60);
          chaoDaCena(ctx, "#16101f");
          ctx.drawImage(heroi.cima[0], 64, 34);
          // olhos vermelhos abrindo no escuro, cada vez mais
          for (let i = 0; i < Math.min(14, Math.floor(t * 3)); i++) {
            const x = (i * 53 + 11) % 150 + 5;
            const y = 58 + (i * 23) % 45;
            if (Math.abs(x - 72) < 18 && y < 84) continue;
            retangulo(ctx, x, y, 2, 1, "#ff2d55");
            retangulo(ctx, x + 4, y, 2, 1, "#ff2d55");
          }
        },
      },
    ],
  },
  "capitulo-6": {
    titulo: "Capítulo VI",
    cenas: [
      {
        texto: "Diante da fogueira, Ulf conta o segredo que guardou por trezentos anos: Malakar escondeu três Selos do Saber. Juntos, eles abrem a Fenda.",
        pintar(ctx, t, heroi) {
          ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#05070f", "#0a1020", "#101a30", "#16223e"]);
          estrelasDaCena(ctx, t, 35, 60);
          chaoDaCena(ctx, "#1b1a26", "#2a2838");
          // a fogueira
          brilhoRedondo(ctx, 80, 74, 30, "255, 150, 60", 0.1 + Math.sin(t * 9) * 0.03);
          for (let i = 0; i < 5; i++) {
            const h = 6 + Math.round(Math.abs(Math.sin(t * 8 + i)) * 6);
            retangulo(ctx, 74 + i * 3, 80 - h, 2, h, i % 2 ? "#ffd166" : "#ff7b39");
          }
          retangulo(ctx, 70, 80, 20, 2, "#5c3418");
          ctx.drawImage(heroi.lado[0], 30, 34);
          ctx.save();
          ctx.translate(132, 34);
          ctx.scale(-1, 1);
          ctx.drawImage(heroiParado(HABITANTES.find((m) => m.id === "ermitao").visual), 0, 0);
          ctx.restore();
          // os três Selos girando em cima do fogo
          ["#c08bff", "#6ef0ff", "#ffd166"].forEach((cor, i) => {
            const a = t * 1.2 + i * 2.09;
            const x = Math.round(80 + Math.cos(a) * 18);
            const y = Math.round(40 + Math.sin(a) * 6);
            brilhoRedondo(ctx, x, y, 7, "255, 233, 160", 0.12);
            circuloPixel(ctx, x, y, 4, cor);
            retangulo(ctx, x - 1, y - 1, 2, 2, "#ffffff");
          });
        },
      },
      {
        texto: "Perguntar. Conferir a fonte. Entender. Cada Selo é uma lição, e cada lição é um passo até o teu último título.",
        pintar(ctx, t, heroi) {
          ceuEmFaixas(ctx, LARGURA_PROLOGO, ALTURA_PROLOGO, ["#1a1033", "#22143f", "#2b1a4d", "#33205a"]);
          // um livro aberto soltando runas que sobem até o herói
          retangulo(ctx, 52, 74, 56, 4, "#5c3418");
          retangulo(ctx, 56, 64, 23, 10, "#e9dcb8");
          retangulo(ctx, 81, 64, 23, 10, "#e9dcb8");
          retangulo(ctx, 79, 64, 2, 10, "#8a7a5a");
          for (let i = 0; i < 12; i++) {
            const k = (t * 0.5 + i / 12) % 1;
            retangulo(ctx, Math.round(60 + (i * 13) % 40 + Math.sin(t * 2 + i) * 3), Math.round(62 - k * 50), 2, 2, `rgba(255, 209, 102, ${1 - k})`);
          }
          ctx.drawImage(heroi.baixo[0], 64, 14);
          // o título do herói enchendo de ouro
          const cheio = Math.min(1, t / 3);
          retangulo(ctx, 40, 96, 80, 6, "#1b1533");
          retangulo(ctx, 41, 97, Math.round(78 * cheio), 4, cheio < 1 ? "#c08bff" : "#ffd166");
        },
      },
    ],
  },
  "capitulo-7": {
    titulo: "Capítulo VII",
    cenas: [
      {
        texto: "Quando Ignis caiu, a tranca da Ruptura rachou. Ao norte da capital, o chão se abriu numa fenda de luz roxa.",
        pintar(ctx, t) {
          ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#0a0618", "#140c2a", "#1f1240", "#2a1652"]);
          estrelasDaCena(ctx, t, 25, 50);
          // a capital ao longe
          for (let x = 10; x < 70; x += 10) retangulo(ctx, x, 60 - (x % 20), 7, 20 + (x % 20), "#1b1430");
          chaoDaCena(ctx, "#2a2433");
          // a rachadura crescendo
          const tam = Math.min(1, t / 3);
          let x = 80;
          for (let y = 80; y < 80 + tam * 30; y++) {
            x += Math.round(Math.sin(y * 0.9) * 2);
            retangulo(ctx, x - 2, y, 5, 1, "#c08bff");
            retangulo(ctx, x - 1, y, 3, 1, "#ffffff");
          }
          brilhoRedondo(ctx, 80, 92, 26 * tam, "192, 139, 255", 0.12);
          for (let i = 0; i < 8; i++) {
            const k = (t * 0.6 + i / 8) % 1;
            retangulo(ctx, 76 + (i * 7) % 12, Math.round(92 - k * 70), 1, 2, `rgba(192, 139, 255, ${1 - k})`);
          }
        },
      },
      {
        texto: "Do outro lado, uma ilha flutua no Vazio. E na beirada, com uma lanterna, uma sentinela espera há trezentos anos.",
        pintar(ctx, t) {
          ceuEmFaixas(ctx, LARGURA_PROLOGO, ALTURA_PROLOGO, ["#05030a", "#0b0618", "#120a24", "#180c2e"]);
          estrelasDaCena(ctx, t, 50, 110);
          // a ilha flutuante
          const sobe = Math.round(Math.sin(t * 0.8) * 2);
          retangulo(ctx, 20, 70 + sobe, 120, 6, "#3d3550");
          for (let i = 0; i < 12; i++) retangulo(ctx, 26 + i * 9, 76 + sobe, 9, 8 + (i % 4) * 5, "#2b2440");
          retangulo(ctx, 20, 68 + sobe, 120, 2, "#5b3f7a");
          ctx.drawImage(heroiParado(LYRA.visual), 64, 20 + sobe);
          brilhoRedondo(ctx, 92, 46 + sobe, 14, "255, 190, 110", 0.14 + Math.sin(t * 9) * 0.03);
          retangulo(ctx, 90, 42 + sobe, 5, 7, "#5c3418");
          retangulo(ctx, 91, 43 + sobe, 3, 5, "#ffd166");
        },
      },
    ],
  },
  "capitulo-8": {
    titulo: "Capítulo VIII",
    cenas: [
      {
        texto: "Quatro guardiões cercam o Trono do Vazio. Todos foram, um dia, aprendizes de Malakar.",
        pintar(ctx, t) {
          ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#05030a", "#0d0618", "#160a26", "#200e33"]);
          chaoDaCena(ctx, "#16101f");
          // o trono no alto
          retangulo(ctx, 70, 20, 20, 30, "#2b2033");
          retangulo(ctx, 66, 16, 28, 5, "#3d2f4a");
          brilhoRedondo(ctx, 80, 34, 16, "150, 60, 255", 0.1 + Math.sin(t * 2) * 0.03);
          const guardioes = [
            ["colosso", () => spriteEsqueleto(), "255, 110, 30", 8],
            ["rainha", () => spriteEscorpiao("#6ef0ff", "#2f7fbf", "#ffffff"), "110, 240, 255", 40],
            ["leviata", () => spriteSapo("#3d1d63", "#a98bff"), "192, 139, 255", 102],
            ["ymir", () => spriteLobo("#e8f6ff", "#6ef0ff"), "220, 240, 255", 130],
          ];
          guardioes.forEach(([id, criarSprite, rgb, x], i) => {
            const s = spriteReino(`cena-guardiao-${id}`, () => silhueta(ampliarSprite(criarSprite(), 1.3), "#0b0612"));
            const y = 82 - s.height + Math.round(Math.sin(t * 2 + i) * 1);
            brilhoRedondo(ctx, x + s.width / 2, y + s.height / 2, s.width * 0.7, rgb, 0.1 + Math.sin(t * 3 + i) * 0.03);
            ctx.drawImage(s, x, y);
          });
        },
      },
      {
        texto: "E Lyra, que te trouxe até aqui, olha para o Trono como quem olha para casa. Ela esconde alguma coisa.",
        pintar(ctx, t) {
          ceuEmFaixas(ctx, LARGURA_PROLOGO, ALTURA_PROLOGO, ["#120a22", "#1d0f33", "#2a1240", "#341650"]);
          // Lyra de perto, desviando o olhar
          const lyra = spriteReino("cena-lyra-perto", () => ampliarSprite(heroiParado(LYRA.visual), 2));
          ctx.drawImage(lyra, 46, 14 + Math.round(Math.sin(t * 1.5)));
          brilhoRedondo(ctx, 116, 70, 18, "255, 190, 110", 0.1 + Math.sin(t * 9) * 0.03);
          for (let i = 0; i < 5; i++) {
            const k = (t * 0.3 + i / 5) % 1;
            retangulo(ctx, 20 + i * 28, Math.round(110 - k * 110), 1, 1, `rgba(255, 190, 110, ${1 - k})`);
          }
        },
      },
    ],
  },
  "capitulo-9": {
    titulo: "Capítulo IX",
    cenas: [
      {
        texto: "Nyxar circula o Trono do Vazio, mais escuro que a própria noite. Quem chega perto, ele vem buscar.",
        pintar(ctx, t) {
          ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#05030a", "#0d0618", "#160a26", "#200e33"]);
          if (Math.sin(t * 5) > 0.9) {
            let x = 30 + Math.floor((t * 41) % 100);
            for (let y = 0; y < 60; y += 4) {
              x += Math.round(Math.sin(y + t * 20) * 3);
              retangulo(ctx, x, y, 1, 4, "#e6d4ff");
            }
          }
          chaoDaCena(ctx, "#140c1c");
          retangulo(ctx, 62, 46, 36, 34, "#2b2033");
          retangulo(ctx, 58, 42, 44, 5, "#3d2f4a");
          const quadros = spriteReino("cena-nyxar", () => quadrosDragao("#2b1150", { escala: 1.2, barriga: "#a98bff", coroa: true }));
          const a = t * 0.9;
          ctx.drawImage(quadros[Math.floor(t * 8) % quadros.length], Math.round(80 + Math.cos(a) * 60 - 40), Math.round(18 + Math.sin(a * 2) * 10));
        },
      },
      {
        texto: "E no Trono, uma voz com o rosto de Malakar: \"Por que estudar, se eu posso responder por ti?\"",
        pintar(ctx, t) {
          ceuEmFaixas(ctx, LARGURA_PROLOGO, ALTURA_PROLOGO, ["#030208", "#08040f", "#0e0618", "#140822"]);
          const vazio = spriteReino("cena-vazio", () => ampliarSprite(silhueta(heroiParado(VISUAL_MALAKAR), "#120822"), 2));
          brilhoRedondo(ctx, 80, 56, 46, "150, 60, 255", 0.08 + Math.sin(t * 2) * 0.03);
          ctx.drawImage(vazio, 48, 6 + Math.round(Math.sin(t) * 2));
          // os olhos roxos acendendo
          const olho = Math.min(1, t / 1.5);
          ctx.fillStyle = `rgba(200, 120, 255, ${olho})`;
          ctx.fillRect(70, 34, 4, 2);
          ctx.fillRect(84, 34, 4, 2);
          // o saber sendo sugado para dentro dele
          for (let i = 0; i < 16; i++) {
            const k = (t * 0.5 + i / 16) % 1;
            const a = i * 0.39;
            retangulo(ctx, Math.round(80 + Math.cos(a) * 80 * (1 - k)), Math.round(56 + Math.sin(a) * 50 * (1 - k)), 1, 1, i % 2 ? "#ffd166" : "#c08bff");
          }
        },
      },
    ],
  },
  // ---------- as revelações ----------
  "revelacao-lyra": {
    titulo: "A Verdade de Lyra",
    cenas: [
      {
        texto: "Lyra abaixa a lanterna. \"Malakar é meu pai. Eu abri a Fenda para trazer alguém capaz de salvá-lo.\"",
        pintar(ctx, t, heroi) {
          ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#120a22", "#1d0f33", "#2a1240", "#341650"]);
          chaoDaCena(ctx, "#2a2433", "#3a3346");
          ctx.drawImage(heroi.lado[0], 36, 34);
          ctx.save();
          ctx.translate(124, 34);
          ctx.scale(-1, 1);
          ctx.drawImage(heroiParado(LYRA.visual), 0, Math.round(Math.min(3, t)));
          ctx.restore();
          brilhoRedondo(ctx, 92, 74, 12, "255, 190, 110", 0.12 + Math.sin(t * 9) * 0.03);
          // uma lágrima caindo
          const k = (t * 0.7) % 1;
          retangulo(ctx, 106, Math.round(48 + k * 30), 1, 2, `rgba(160, 220, 255, ${1 - k})`);
        },
      },
      {
        texto: "\"Antes do Oráculo, ele me ensinava a ler as estrelas. Dizia que toda resposta boa começa com uma pergunta honesta.\"",
        pintar(ctx, t) {
          // a lembrança: tons de sépia, a menina e o pai olhando o céu
          ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#2a1f14", "#3d2c1a", "#4a3620", "#5a4228"]);
          for (let i = 0; i < 30; i++) retangulo(ctx, (i * 47 + 9) % 160, (i * 29) % 60, 1, 1, Math.sin(t * 2 + i) > 0 ? "#fff3cf" : "#a08a60");
          chaoDaCena(ctx, "#3a2a1a");
          ctx.save();
          ctx.filter = "sepia(1) brightness(0.9)";
          ctx.drawImage(heroiParado(VISUAL_MALAKAR), 58, 30);
          ctx.drawImage(spriteReino("cena-lyra-menina", () => ampliarSprite(heroiParado(LYRA.visual), 0.7)), 92, 44);
          ctx.restore();
          ctx.fillStyle = "rgba(42, 31, 20, 0.25)";
          ctx.fillRect(0, 0, LARGURA_PROLOGO, ALTURA_PROLOGO);
        },
      },
    ],
  },
  "revelacao-malakar": {
    titulo: "A Memória de Malakar",
    cenas: [
      {
        texto: "\"Eu criei o Oráculo para que ninguém mais precisasse estudar. Achei que era um presente. Era uma fome.\"",
        pintar: (ctx, t) => pintarOraculo(ctx, t),
      },
      {
        texto: "\"O Vazio nasceu de mim. E hoje usa o meu rosto.\" O Eco treme, e por um instante tu vês os dois: o mestre e a sombra.",
        pintar(ctx, t) {
          ceuEmFaixas(ctx, LARGURA_PROLOGO, ALTURA_PROLOGO, ["#05030a", "#0d0618", "#160a26", "#200e33"]);
          const k = (Math.sin(t * 1.4) + 1) / 2;
          ctx.globalAlpha = 0.5 + k * 0.5;
          ctx.drawImage(heroiParado(VISUAL_MALAKAR), 50, 30);
          ctx.globalAlpha = 1 - k * 0.6;
          ctx.drawImage(spriteReino("cena-vazio-pequeno", () => silhueta(heroiParado(VISUAL_MALAKAR), "#1a0a2e")), 78, 30);
          ctx.globalAlpha = 1;
          retangulo(ctx, 88, 38, 2, 1, "#c08bff");
          retangulo(ctx, 94, 38, 2, 1, "#c08bff");
          brilhoRedondo(ctx, 80, 54, 30, "150, 60, 255", 0.06);
        },
      },
    ],
  },
};

// Toca a cena (uma vez só por herói). Devolve true se tocou; "depois" roda ao terminar (ou na hora, se
// ela já tinha sido vista).
function tocarCenaDaHistoria(id, depois = () => {}) {
  const cena = CENAS_HISTORIA[id];
  progresso.cenasVistas ||= [];
  if (!cena || progresso.cenasVistas.includes(id) || document.querySelector(".prologo")) {
    depois();
    return false;
  }
  progresso.cenasVistas.push(id);
  salvarProgresso();
  // o nome do capítulo aparece grande na primeira cena; a trilha do mistério toca e a do mapa volta depois
  const cenas = cena.cenas.map((c, i) => ({ ...c, titulo: i === 0 }));
  const voltarMusica = musicaDoMapa();
  telaPrologo(() => {
    Som.musica(voltarMusica);
    depois();
  }, progresso.avatar || {}, cenas, { tituloFinal: cena.titulo.toUpperCase(), botaoFinal: "Seguir ▸", pular: "Pular cena ▸▸", musica: cena.musica || "misterio" });
  marcarComoCena();
  return true;
}

// ---------- a entrada dos chefões ----------
// Na primeira vez que o herói encara um chefão, antes da luta: o chão treme e a sombra dele surge
// (cena 1); depois ele aparece por inteiro, no brilho da cor dele, dizendo a primeira fala (cena 2).
// Feita a partir do próprio chefão (desenho, nome e falas do servidor): vale para todos.
const CLIMA_DOS_CHEFES = {
  campos: ["#3a6b9a", "#5f8fc0", "#8cb6dc", "#b6d6ee", "125, 255, 154"], floresta: ["#05070f", "#0a1020", "#101a30", "#16223e", "255, 77, 109"],
  pantano: ["#0e1a14", "#16261c", "#1e3226", "#284030", "200, 245, 154"], deserto: ["#8a4a2a", "#b5703a", "#d9985a", "#f0c07b", "255, 209, 102"],
  montanhas: ["#2a0a14", "#4a1020", "#6a1a28", "#8a2a30", "255, 90, 60"], cinzas: ["#1a0806", "#2e0e08", "#4a160c", "#6a2010", "255, 120, 40"],
  cristais: ["#06121e", "#0a1e30", "#102a44", "#163858", "110, 240, 255"], abismo: ["#07040f", "#120822", "#1c0c33", "#261044", "192, 139, 255"],
  geleira: ["#1a2a44", "#2a3e60", "#3e5680", "#5a74a0", "220, 240, 255"], trono: ["#030208", "#08040f", "#0e0618", "#140822", "150, 60, 255"],
};

function cenasDoChefe(monstro) {
  const [c1, c2, c3, c4, brilho] = CLIMA_DOS_CHEFES[monstro.regiao] || CLIMA_DOS_CHEFES.trono;
  const desenho = monstro.quadros?.[0] || monstro.sprite;
  const escala = Math.min(1.6, 70 / desenho.width, 72 / desenho.height);
  const w = Math.round(desenho.width * escala);
  const h = Math.round(desenho.height * escala);
  const sombra = silhueta(desenho, "#05030a");
  const fala = monstro.fases?.[0]?.fala || "...";
  const fundo = (ctx, t) => {
    ceuEmFaixas(ctx, LARGURA_PROLOGO, 84, [c1, c2, c3, c4]);
    retangulo(ctx, 0, 84, LARGURA_PROLOGO, 26, "#0b0812");
  };
  const desenhar = (ctx, img, x, y) => {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, x, y, w, h);
  };
  return [
    {
      texto: "O chão treme. As árvores se calam. Algo enorme percebeu que tu chegaste...",
      efeito: "tremor",
      pintar(ctx, t) {
        fundo(ctx, t);
        const treme = Math.round(Math.sin(t * 40) * Math.min(2, t));
        const surge = Math.min(1, t / 2.5);
        ctx.globalAlpha = surge;
        desenhar(ctx, sombra, 80 - w / 2 + treme, 84 - h + Math.round((1 - surge) * 20));
        ctx.globalAlpha = 1;
        // pedrinhas pulando do chão
        for (let i = 0; i < 10; i++) {
          const k = (t * 1.5 + i / 10) % 1;
          retangulo(ctx, 10 + i * 15, Math.round(84 - Math.sin(k * Math.PI) * 8), 2, 2, "#5a5266");
        }
      },
    },
    {
      texto: `${monstro.nome}: "${fala}"`,
      pintar(ctx, t) {
        fundo(ctx, t);
        brilhoRedondo(ctx, 80, 84 - h / 2, Math.max(w, h) * 0.75, brilho, 0.1 + Math.sin(t * 3) * 0.04);
        const pulo = Math.round(Math.abs(Math.sin(t * 2)) * 2);
        const quadro = monstro.quadros ? monstro.quadros[Math.floor(t * 8) % monstro.quadros.length] : desenho;
        desenhar(ctx, quadro, 80 - w / 2, 84 - h - pulo);
        // um clarão no começo da cena
        if (t < 0.25) {
          ctx.fillStyle = `rgba(255, 255, 255, ${0.8 - t * 3})`;
          ctx.fillRect(0, 0, LARGURA_PROLOGO, ALTURA_PROLOGO);
        }
      },
    },
  ];
}

// toca a entrada do chefão (uma vez por herói) e depois começa a luta
function entradaDoChefe(monstro, depois) {
  const id = `chefe-${monstro.tipoId}`;
  progresso.cenasVistas ||= [];
  if (!monstro.chefe || progresso.cenasVistas.includes(id) || document.querySelector(".prologo")) return depois();
  progresso.cenasVistas.push(id);
  salvarProgresso();
  Som.efeito("rugido");
  telaPrologo(depois, progresso.avatar || {}, cenasDoChefe(monstro).map((c, i) => ({ ...c, titulo: i === 1 })),
    { tituloFinal: monstro.nome.toUpperCase(), botaoFinal: "⚔️ Lutar!", pular: "Lutar ▸▸", musica: monstro.tipoId === "vazio" ? "vazio" : "chefao" });
  marcarComoCena();
}

// a música de onde o herói está (para voltar a ela depois de uma cena)
function musicaDoMapa() {
  if (document.querySelector(".tela-mundo.umbra")) return "umbra";
  if (document.querySelector(".tela-mundo.reino")) return "reino";
  if (document.querySelector(".dungeon, .encontro")) return "batalha";
  return "academia";
}

// nas cenas da história o título grande aparece e some sozinho (para não cobrir os personagens)
function marcarComoCena() {
  document.querySelector(".prologo:last-of-type")?.classList.add("cena-historia");
  document.querySelector(".faixa-lugar")?.remove(); // a faixa de "chegou na cidade" não fica por cima da cena
}
