// A tela de carregamento: uma cena em pixel art em que o herói anda por uma paisagem que passa em
// camadas (céu, estrelas, montanhas, castelo, árvores, casas, lampiões e vaga-lumes), com o destino num
// círculo de runas, a barra dourada e uma dica do Zetsu. Cada destino tem a sua paisagem:
//   inicio (a abertura do jogo), reino (dia no campo), academia (noite com o castelo) e porta (rua ao entardecer).
// abrirCarregamento(opcoes) devolve { concluir }: concluir() enche a barra, some com a tela e resolve a promessa.

const DICAS_CARREGAMENTO = [
  "Na batalha, as setas ↑ e ↓ andam com o cursor e o Enter escolhe a resposta.",
  "Acertos seguidos enchem a Sequência: a cada 5, um GOLPE FINAL.",
  "Responder rápido dá crítico: fica de olho no relâmpago da barra de turno.",
  "Teus 3 poderes da batalha se trocam na Árvore, aba Poderes (tecla K).",
  "As magias de classe recarregam em horas de verdade: guarda as lendárias para os chefões.",
  "À noite saem criaturas diferentes, e elas pagam 25% a mais.",
  "A rodinha do mouse aproxima e afasta a câmera do mapa.",
  "Um bom prompt tem Papel, Contexto, Tarefa e Formato.",
  "A IA pode inventar números com toda a confiança: confere sempre os dados.",
  "Dar exemplos no prompt (few-shot) ajuda a IA a acertar o formato.",
  "Nunca cole senhas ou dados de clientes numa IA pública.",
  "Pedir para a IA “pensar passo a passo” melhora respostas de raciocínio.",
  "Os enigmas brilhando pelo Reino dão moedas: chega perto e aperta E.",
  "O Golpe Arcano no mapa faz o monstro começar a luta ferido.",
  "Cada nível dá um ponto de talento na Árvore Arcana.",
  "Quanto mais claro o pedido, menos a IA precisa adivinhar.",
];

const TEMAS_CARREGAMENTO = {
  inicio: { ceu: ["#05030f", "#1a1240", "#4a2466"], astro: "lua", estrelas: true, montanhas: ["#241a4a", "#17112f"], chao: "#262046", terra: "#17132c", grama: "#3a3270", objetos: ["pinheiro", "torre"], castelo: true, luz: "#6ef0ff" },
  reino: { ceu: ["#3f78c8", "#8cc4ec", "#ffe2a8"], astro: "sol", estrelas: false, montanhas: ["#7b9cc8", "#5f86b0"], chao: "#4f9a44", terra: "#9a7444", grama: "#6fc25a", objetos: ["arvore", "pinheiro", "casa"], castelo: false, luz: "#fff3b0" },
  academia: { ceu: ["#0d0824", "#2c1a5c", "#7a3e86"], astro: "lua", estrelas: true, montanhas: ["#2a1e52", "#1c1438"], chao: "#2e2a5a", terra: "#1e1a3c", grama: "#45407e", objetos: ["pinheiro", "torre"], castelo: true, luz: "#c9a8ff" },
  porta: { ceu: ["#1c0e26", "#5a2236", "#d0743a"], astro: "sol", estrelas: true, montanhas: ["#4a1e30", "#331422"], chao: "#5a3e2c", terra: "#3a281c", grama: "#6a4a34", objetos: ["casa", "lampiao", "casa"], castelo: false, luz: "#ffd166" },
  // Umbraterra: o céu do vazio e a Fenda rasgada no horizonte
  umbra: { ceu: ["#05020c", "#1e0a36", "#4a1a5a"], astro: "lua", corLua: "#e0c8ff", estrelas: true, montanhas: ["#2a1240", "#1a0a2a"], chao: "#24123a", terra: "#160a24", grama: "#4a2a6a", objetos: [], castelo: false, fenda: true, luz: "#c08bff" },
  // a entrada das masmorras: a boca da caverna com as tochas
  masmorra: { ceu: ["#06040c", "#16102a", "#2a1e3a"], astro: null, estrelas: true, montanhas: ["#1e1830", "#140f22"], chao: "#2a2436", terra: "#18141f", grama: "#3a3448", objetos: [], castelo: false, caverna: true, luz: "#ff9a3c" },
};

// números "sorteados" sempre iguais para a mesma posição (a paisagem não pisca entre um quadro e outro)
function sorteFixa(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const textoSeguro = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// A tela de carregamento: uma ilustração parada em pixel art (o herói de costas no alto de um penhasco,
// olhando o destino sob a lua), a placa com o nome do lugar, a dica do Zetsu numa caixa de diálogo e a
// barra de blocos ("Carregando"). A cena é viva (animarCenaCarregamento): nuvens, estrelas, raios, vaga-lumes
// e neblina; a placa tem o círculo de runas girando e a barra brilha passando.
// icone é HTML do próprio jogo (emoji ou <img>); título e sobretítulo podem ter o nome do jogador e são escapados.
const BLOCOS_CARREGAMENTO = 20;

function abrirCarregamento({ tema = "inicio", titulo = "", sobretitulo = "", icone = "✨", avatar = null } = {}) {
  const cores = TEMAS_CARREGAMENTO[tema] || TEMAS_CARREGAMENTO.inicio;
  const dica = DICAS_CARREGAMENTO[Math.floor(Math.random() * DICAS_CARREGAMENTO.length)];
  const tela = document.createElement("div");
  tela.className = `carregamento tema-${tema}`;
  tela.style.setProperty("--luz", cores.luz);
  const zetsu = typeof IMG_ZETSU !== "undefined" ? `<img class="pixel rosto-dica" src="${IMG_ZETSU}" alt="">` : "";
  tela.innerHTML = `
    <canvas class="pixel cena-carregamento"></canvas>
    <div class="placa-carregamento">
      <span class="icone-destino">${icone}</span>
      <div>
        ${sobretitulo ? `<small>${textoSeguro(sobretitulo)}</small>` : ""}
        <h2>${textoSeguro(titulo)}</h2>
      </div>
    </div>
    <div class="rodape-carregamento">
      <div class="dica-carregamento">${zetsu}<p><b>Dica do Zetsu</b>${dica}</p><i class="cursor-dica">▼</i></div>
      <div class="barra-carregamento" aria-label="Carregando">
        <span class="rotulo-barra">Carregando</span>
        <div class="blocos">${"<i></i>".repeat(BLOCOS_CARREGAMENTO)}</div>
      </div>
    </div>`;
  // já entra visível (sem esperar um quadro): ela cobre a cortina da transição na hora
  tela.classList.add("visivel");
  document.body.append(tela);
  desenharCenaCarregamento(tela.querySelector("canvas"), tema, avatar);

  // a barra: anda sozinha até ~90% enquanto espera; ao terminar, corre até 100% (bloco a bloco)
  const blocos = [...tela.querySelectorAll(".blocos i")];
  const inicio = performance.now();
  let terminou = false;
  let mostrado = 0;
  const encher = () => {
    if (!tela.isConnected) return;
    const t = (performance.now() - inicio) / 1000;
    const meta = terminou ? 1 : 0.9 * (1 - Math.exp(-t / 1.1));
    mostrado += (meta - mostrado) * (terminou ? 0.35 : 0.1);
    const cheios = Math.round(mostrado * BLOCOS_CARREGAMENTO);
    blocos.forEach((b, i) => b.classList.toggle("cheio", i < cheios));
    requestAnimationFrame(encher);
  };
  requestAnimationFrame(encher);

  return {
    concluir() {
      terminou = true;
      return new Promise((resolver) => {
        setTimeout(() => {
          blocos.forEach((b) => b.classList.add("cheio"));
          tela.classList.add("saindo");
          setTimeout(() => {
            tela.remove();
            resolver();
          }, 380);
        }, 320);
      });
    },
  };
}

// A ilustração parada do carregamento (desenhada uma vez): céu em faixas com pontilhado, estrelas, a lua
// (ou o sol), montanhas ao longe, o castelo (ou a vila) do destino e, na frente, o penhasco com o herói de
// costas e a capa ao vento, olhando para lá.
function desenharCenaCarregamento(canvas, tema, avatar) {
  const cores = TEMAS_CARREGAMENTO[tema] || TEMAS_CARREGAMENTO.inicio;
  // a largura segue a proporção da tela (deitada ou em pé), para a lua não sair oval
  const H = 180;
  const W = Math.max(100, Math.round((H * window.innerWidth) / Math.max(1, window.innerHeight)));
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const faixa = (y0, y1, cor) => { ctx.fillStyle = cor; ctx.fillRect(0, y0, W, y1 - y0); };
  // o céu em 3 faixas, com pontilhado (dither) na passagem de uma cor para a outra
  const cortes = [0, Math.round(H * 0.42), Math.round(H * 0.68)];
  cores.ceu.forEach((cor, i) => faixa(cortes[i], i < 2 ? cortes[i + 1] : H, cor));
  [1, 2].forEach((i) => {
    ctx.fillStyle = cores.ceu[i];
    for (let y = cortes[i] - 6; y < cortes[i]; y++) {
      for (let x = (y % 2) * 1; x < W; x += 2 + (cortes[i] - y > 3 ? 2 : 0)) ctx.fillRect(x, y, 1, 1);
    }
  });
  if (cores.estrelas) {
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(sorteFixa(i + 1) * W);
      const y = Math.floor(sorteFixa(i + 2) * H * 0.55);
      ctx.fillStyle = sorteFixa(i + 3) > 0.8 ? "#ffffff" : "#9a93d0";
      ctx.fillRect(x, y, 1, 1);
      if (sorteFixa(i + 4) > 0.94) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
    }
  }
  // o astro, grande e com halo em degraus
  const ax = Math.round(W * 0.7);
  const ay = 40;
  const disco = (r, cor) => {
    ctx.fillStyle = cor;
    for (let dy = -r; dy <= r; dy++) {
      const meia = Math.round(Math.sqrt(r * r - dy * dy));
      ctx.fillRect(ax - meia, ay + dy, meia * 2 + 1, 1);
    }
  };
  if (cores.astro === "lua") {
    disco(26, "rgba(255, 250, 220, 0.06)");
    disco(20, "rgba(255, 250, 220, 0.08)");
    disco(14, cores.corLua || "#fff6d8");
    ctx.fillStyle = cores.corLua ? tom(cores.corLua, 0.85) : "#e3d8b0";
    [[-5, -4, 4], [4, 2, 3], [-2, 6, 2], [6, -6, 2]].forEach(([dx, dy, s]) => ctx.fillRect(ax + dx, ay + dy, s, s));
  } else if (cores.astro) {
    disco(26, "rgba(255, 220, 120, 0.1)");
    disco(19, "rgba(255, 220, 120, 0.18)");
    disco(13, "#ffe08a");
  }
  // duas cadeias de montanhas
  const serra = (base, amp, cor, semente) => {
    ctx.fillStyle = cor;
    for (let x = 0; x < W; x++) {
      const h = base + Math.sin(x * 0.03 + semente) * amp + Math.abs(Math.sin(x * 0.011 + semente * 2)) * amp * 1.3;
      ctx.fillRect(x, Math.round(H * 0.72 - h), 1, Math.ceil(h) + 60);
    }
  };
  serra(30, 12, cores.montanhas[0], 1.7);
  // o destino no horizonte: o castelo (Academia/abertura) ou casas com janelas acesas
  const cx = Math.round(W * 0.66);
  const chao = Math.round(H * 0.72);
  ctx.fillStyle = cores.montanhas[1];
  if (cores.fenda) {
    // a Fenda: um rasgo vertical brilhando, com ilhas de pedra flutuando em volta
    for (let y = 0; y < 70; y++) {
      const meia = Math.max(1, Math.round(6 - Math.abs(y - 35) * 0.16 + Math.sin(y * 0.6) * 1.2));
      const xx = cx + Math.round(Math.sin(y * 0.15) * 4);
      ctx.fillStyle = "rgba(192, 139, 255, 0.25)";
      ctx.fillRect(xx - meia - 4, chao - 75 + y, meia * 2 + 8, 1);
      ctx.fillStyle = y % 3 ? "#c08bff" : "#ff4d6d";
      ctx.fillRect(xx - meia, chao - 75 + y, meia * 2, 1);
      ctx.fillStyle = "#ffe6f4";
      ctx.fillRect(xx - 1, chao - 75 + y, 2, 1);
    }
    [[-40, 50, 14], [34, 42, 10], [-20, 70, 8], [52, 64, 7]].forEach(([dx, alto, larg]) => {
      ctx.fillStyle = cores.montanhas[1];
      for (let k = 0; k < larg / 2; k++) ctx.fillRect(cx + dx - larg / 2 + k, chao - alto + k, larg - k * 2, 1);
      ctx.fillStyle = "#4a2a6a";
      ctx.fillRect(cx + dx - larg / 2, chao - alto - 1, larg, 1);
    });
  } else if (cores.caverna) {
    // a boca da caverna na encosta, com as duas tochas acesas
    // a encosta de pedra (mais clara que o céu), com a borda de cima acesa
    for (let y = 0; y < 66; y++) {
      const meia = Math.round(16 + y * 0.9 + Math.sin(y * 0.4) * 2);
      ctx.fillStyle = y < 2 ? "#5a4e72" : y % 9 === 0 ? "#2e2640" : "#3a3050";
      ctx.fillRect(cx - meia, chao - 74 + y, meia * 2, 1);
    }
    // a boca escura, em arco, com a luz das tochas lá dentro
    for (let y = 0; y < 36; y++) {
      const meia = Math.round(Math.sqrt(Math.max(0, 36 * 36 - (36 - y) ** 2)) * 0.55);
      ctx.fillStyle = y > 26 ? "#2a1408" : "#05030a";
      ctx.fillRect(cx - meia, chao - 44 + y, meia * 2, 1);
    }
    [-24, 24].forEach((dx) => {
      ctx.fillStyle = "#3a2414";
      ctx.fillRect(cx + dx, chao - 30, 2, 10);
      ctx.fillStyle = "rgba(255, 154, 60, 0.25)";
      ctx.fillRect(cx + dx - 5, chao - 39, 12, 12);
      ctx.fillStyle = "#ff9a3c";
      ctx.fillRect(cx + dx - 1, chao - 35, 4, 5);
      ctx.fillStyle = "#ffe08a";
      ctx.fillRect(cx + dx, chao - 33, 2, 2);
    });
  } else if (cores.castelo) {
    [[-26, 22, 10], [-14, 36, 9], [-4, 48, 10], [8, 36, 9], [19, 22, 10], [-22, 14, 50]].forEach(([dx, alto, larg]) => ctx.fillRect(cx + dx, chao - alto, larg, alto));
    [[-14, 36], [-4, 48], [8, 36]].forEach(([dx, alto]) => { for (let i = 0; i < 5; i++) ctx.fillRect(cx + dx - 1 + i, chao - alto - 10 + i * 2, 11 - i * 2, 2); });
    ctx.fillStyle = cores.luz;
    [[-10, 26], [1, 38], [1, 26], [12, 24], [-19, 10], [22, 12]].forEach(([dx, dy]) => ctx.fillRect(cx + dx, chao - dy, 2, 3));
    ctx.fillStyle = "#e0304a";
    ctx.fillRect(cx + 1, chao - 70, 1, 8);
    ctx.fillRect(cx + 2, chao - 70, 5, 3);
  } else if (cores.objetos.length) {
    for (let i = -3; i <= 3; i++) {
      const x = cx + i * 13;
      const alto = 8 + Math.round(sorteFixa(i + 20) * 6);
      ctx.fillStyle = cores.montanhas[1];
      ctx.fillRect(x - 5, chao - alto, 11, alto);
      for (let k = 0; k < 4; k++) ctx.fillRect(x - 6 + k, chao - alto - 1 - k, 13 - k * 2, 1);
      ctx.fillStyle = cores.luz;
      ctx.fillRect(x - 2, chao - alto + 3, 2, 2);
    }
  }
  serra(10, 6, cores.chao, 4.3);
  ctx.fillStyle = cores.terra;
  ctx.fillRect(0, chao + 12, W, H);
  // o penhasco na frente (à esquerda), com a borda iluminada
  const px = Math.round(W * 0.3);
  ctx.fillStyle = "#0b0816";
  for (let x = 0; x < px + 30; x++) {
    const topo = Math.round(H * 0.74 + (x > px ? (x - px) * 1.6 : Math.sin(x * 0.08) * 2));
    ctx.fillRect(x, topo, 1, H - topo);
  }
  ctx.fillStyle = cores.grama;
  for (let x = 0; x < px; x++) ctx.fillRect(x, Math.round(H * 0.74 + Math.sin(x * 0.08) * 2), 1, 1);
  // o herói de costas no alto do penhasco, olhando o destino
  try {
    const s = spritesHeroi(avatar || AVATAR_PADRAO).cima[0];
    ctx.drawImage(s, px - 26, Math.round(H * 0.74) - PE_HEROI - 1);
  } catch {
    // sem o herói: a paisagem sozinha já basta
  }
  // a ilustração fica pronta numa cópia; por cima dela, a cena ganha vida (animarCenaCarregamento)
  const base = document.createElement("canvas");
  base.width = W;
  base.height = H;
  base.getContext("2d").drawImage(canvas, 0, 0);
  animarCenaCarregamento(canvas, base, cores, ax, ay);
}

// A vida da tela de carregamento, por cima da ilustração: as nuvens passando devagar (duas camadas), as
// estrelas piscando, uma estrela cadente de vez em quando, os raios de luz saindo do astro, os vaga-lumes
// (ou faíscas) flutuando com brilho e a neblina rasteira andando no pé do penhasco.
function animarCenaCarregamento(canvas, base, cores, ax, ay) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const luz = hexParaRgb(cores.luz).join(", ");
  const nuvem = (x, y, larg, cor) => {
    ctx.fillStyle = cor;
    for (let k = 0; k < 4; k++) {
      const meia = larg * (0.5 - Math.abs(k - 1.5) * 0.12);
      ctx.fillRect(Math.round(x - meia), y + k * 2, Math.round(meia * 2), 2);
    }
  };
  const inicio = performance.now();
  let ultimo = 0;
  const quadro = (agora) => {
    if (!canvas.isConnected) return;
    requestAnimationFrame(quadro);
    if (agora - ultimo < 40) return;
    ultimo = agora;
    const t = (agora - inicio) / 1000;
    ctx.drawImage(base, 0, 0);
    // os raios do astro, girando devagar
    if (cores.astro) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 6; k++) {
        const a = t * 0.08 + (k * Math.PI) / 3;
        ctx.fillStyle = `rgba(255, 240, 200, ${0.025 + Math.sin(t + k) * 0.012})`;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + Math.cos(a - 0.06) * 160, ay + Math.sin(a - 0.06) * 160);
        ctx.lineTo(ax + Math.cos(a + 0.06) * 160, ay + Math.sin(a + 0.06) * 160);
        ctx.fill();
      }
      ctx.restore();
    }
    // as estrelas que piscam
    if (cores.estrelas) {
      for (let i = 0; i < 24; i++) {
        const brilho = Math.sin(t * (1.5 + sorteFixa(i + 300) * 3) + i);
        if (brilho < 0.6) continue;
        const x = Math.floor(sorteFixa(i + 301) * W);
        const y = Math.floor(sorteFixa(i + 302) * H * 0.5);
        ctx.fillStyle = `rgba(255, 255, 255, ${(brilho - 0.6) * 2.5})`;
        ctx.fillRect(x, y, 1, 1);
        ctx.fillRect(x - 1, y, 3, 1);
        ctx.fillRect(x, y - 1, 1, 3);
      }
      // a estrela cadente (a cada ~7 s)
      const ciclo = (t % 7) / 1.2;
      if (ciclo < 1) {
        const sx = W * (0.15 + sorteFixa(Math.floor(t / 7)) * 0.5) + ciclo * 70;
        const sy = 10 + ciclo * 26;
        for (let k = 0; k < 10; k++) {
          ctx.fillStyle = `rgba(255, 250, 230, ${(1 - k / 10) * (1 - ciclo)})`;
          ctx.fillRect(Math.round(sx - k * 2.6), Math.round(sy - k), 1, 1);
        }
      }
    }
    // as nuvens: as de trás mais lentas e mais escuras
    [[0.25, 6, 0.06, 22], [0.55, 14, 0.1, 30]].forEach(([alturaRel, velocidade, alfa, larg], camada) => {
      for (let i = 0; i < 4; i++) {
        const x = ((sorteFixa(i + camada * 10 + 400) * (W + 120) + t * velocidade) % (W + 120)) - 60;
        const y = Math.round(H * alturaRel * 0.6 + sorteFixa(i + 410) * 18);
        nuvem(x, y, larg + sorteFixa(i + 420) * 16, `rgba(${camada ? "220, 210, 255" : "180, 170, 220"}, ${alfa})`);
      }
    });
    // os vaga-lumes (ou faíscas) flutuando, com o brilho em volta
    for (let i = 0; i < 18; i++) {
      const vida = (t * (0.08 + sorteFixa(i + 500) * 0.08) + sorteFixa(i + 501)) % 1;
      const x = (sorteFixa(i + 502) * W + Math.sin(t * 0.9 + i) * 10 + W) % W;
      const y = H * 0.85 - vida * H * 0.45;
      const a = Math.sin(vida * Math.PI) * (0.6 + Math.sin(t * 4 + i) * 0.4);
      if (a <= 0.05) continue;
      ctx.fillStyle = `rgba(${luz}, ${a * 0.18})`;
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - 1, 5, 3);
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 2, 3, 5);
      ctx.fillStyle = `rgba(${luz}, ${a})`;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    // a neblina rasteira
    for (let y = Math.round(H * 0.7); y < H; y += 2) {
      const forca = (y - H * 0.7) / (H * 0.3);
      for (let x = 0; x < W; x += 3) {
        const n = Math.sin(x * 0.05 + t * 0.5 + y * 0.2) + Math.sin(x * 0.021 - t * 0.3);
        if (n < 0.6) continue;
        ctx.fillStyle = `rgba(200, 190, 235, ${0.04 + forca * 0.06})`;
        ctx.fillRect(x, y, 3, 2);
      }
    }
  };
  requestAnimationFrame(quadro);
}

// A paisagem animada (usada no carregamento e na tela inicial): desenha no canvas enquanto ele estiver na
// página. aoQuadro(t) é chamado a cada quadro, com o tempo em segundos.
function criarPaisagem(canvas, { tema = "inicio", avatar = null, aoQuadro = null } = {}) {
  const cores = TEMAS_CARREGAMENTO[tema] || TEMAS_CARREGAMENTO.inicio;
  const ctx = canvas.getContext("2d");
  // a cena tem 200 pixels de altura, esticados na tela inteira (o herói ocupa ~1/4 da altura)
  const H = 200;
  const W = Math.max(200, Math.round((H * window.innerWidth) / Math.max(1, window.innerHeight)));
  canvas.width = W;
  canvas.height = H;
  const CHAO = H - 50; // a linha onde os pés pisam (embaixo dela, a estrada e o rodapé com a dica e a barra)
  let sprites = null;
  try {
    sprites = spritesHeroi(avatar || AVATAR_PADRAO).lado;
  } catch {
    sprites = null;
  }

  // uma camada de montanhas: a altura de cada coluna vem de senos, e ela anda devagar
  const montanhas = (desloc, base, amplitude, cor, semente) => {
    ctx.fillStyle = cor;
    for (let x = 0; x < W; x++) {
      const m = x + desloc;
      const h = base + Math.sin(m * 0.021 + semente) * amplitude + Math.sin(m * 0.057 + semente * 2) * amplitude * 0.45
        + Math.abs(Math.sin(m * 0.009 + semente)) * amplitude * 0.8;
      ctx.fillRect(x, Math.round(CHAO - h), 1, Math.ceil(h));
    }
  };
  const pinheiro = (x, base, alto, cor) => {
    for (let i = 0; i < alto; i += 2) {
      const largura = Math.round((i / alto) * (alto * 0.45)) + 1;
      ctx.fillStyle = cor;
      ctx.fillRect(Math.round(x - largura), base - alto + i, largura * 2 + 1, 2);
    }
    ctx.fillStyle = "#2a1a10";
    ctx.fillRect(Math.round(x) - 1, base, 3, 3);
  };
  const arvore = (x, base, alto) => {
    ctx.fillStyle = "#5a3a20";
    ctx.fillRect(Math.round(x) - 1, base - alto * 0.45, 3, alto * 0.45 + 2);
    ctx.fillStyle = "#2f7a3a";
    ctx.beginPath();
    ctx.arc(Math.round(x), base - alto * 0.62, alto * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4fa24a";
    ctx.beginPath();
    ctx.arc(Math.round(x) - 2, base - alto * 0.7, alto * 0.22, 0, Math.PI * 2);
    ctx.fill();
  };
  const casa = (x, base, n, t) => {
    const largura = 18 + Math.round(sorteFixa(n) * 10);
    const alto = 14 + Math.round(sorteFixa(n + 3) * 8);
    const x0 = Math.round(x - largura / 2);
    ctx.fillStyle = tema === "reino" ? "#e8d4a8" : "#3a2430";
    ctx.fillRect(x0, base - alto, largura, alto);
    ctx.fillStyle = ["#a8323e", "#2f5ea8", "#2e7d3e", "#8a5a2a"][n % 4];
    // o telhado: largo embaixo e fechando para cima
    for (let i = 0; i < 8; i++) ctx.fillRect(x0 - 2 + i, base - alto - 1 - i, largura + 4 - i * 2, 1);
    ctx.fillRect(x0 - 2, base - alto, largura + 4, 2);
    // janelas acesas que piscam de vez em quando
    const acesa = tema !== "reino" || sorteFixa(n + 9) > 0.5;
    ctx.fillStyle = acesa ? (Math.sin(t * 2 + n) > -0.9 ? "#ffd166" : "#c9952a") : "#4a5a7a";
    ctx.fillRect(x0 + 3, base - alto + 4, 4, 4);
    ctx.fillRect(x0 + largura - 7, base - alto + 4, 4, 4);
    ctx.fillStyle = "#3a2414";
    ctx.fillRect(x0 + Math.round(largura / 2) - 2, base - 7, 5, 7);
  };
  const lampiao = (x, base, t, n) => {
    ctx.fillStyle = "#1a1018";
    ctx.fillRect(Math.round(x), base - 22, 2, 22);
    ctx.fillRect(Math.round(x) - 2, base - 24, 6, 3);
    const brilho = 0.35 + Math.sin(t * 6 + n) * 0.08;
    const g = ctx.createRadialGradient(x + 1, base - 20, 0, x + 1, base - 20, 14);
    g.addColorStop(0, `rgba(255, 210, 110, ${brilho})`);
    g.addColorStop(1, "rgba(255, 210, 110, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 14, base - 34, 30, 30);
    ctx.fillStyle = "#ffe08a";
    ctx.fillRect(Math.round(x) - 1, base - 21, 4, 3);
  };
  const torre = (x, base, n) => {
    const alto = 26 + Math.round(sorteFixa(n) * 16);
    ctx.fillStyle = "#1c1636";
    ctx.fillRect(Math.round(x) - 4, base - alto, 9, alto);
    for (let i = 0; i < 6; i++) ctx.fillRect(Math.round(x) - 5 + i, base - alto - 10 + i * 2, 11 - i * 2, 2);
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(Math.round(x), base - alto + 6, 2, 3);
  };
  const castelo = (x, base, t) => {
    ctx.fillStyle = "#150f2c";
    const blocos = [[-34, 30, 12], [-20, 44, 10], [-8, 58, 16], [10, 44, 10], [22, 30, 12], [-30, 20, 64]];
    blocos.forEach(([dx, alto, largura]) => ctx.fillRect(Math.round(x + dx), base - alto, largura, alto));
    [[-20, 44], [-8, 58], [10, 44]].forEach(([dx, alto]) => {
      for (let i = 0; i < 6; i++) ctx.fillRect(Math.round(x + dx - 1 + i), base - alto - 12 + i * 2, 12 - i * 2, 2);
    });
    // janelinhas e a bandeira no alto da torre do meio
    ctx.fillStyle = cores.luz;
    [[-16, 30], [0, 42], [0, 30], [14, 30], [-26, 14], [24, 16]].forEach(([dx, dy], i) => {
      if (Math.sin(t * 1.5 + i * 1.7) > -0.6) ctx.fillRect(Math.round(x + dx), base - dy, 2, 3);
    });
    ctx.fillStyle = "#e0304a";
    const onda = Math.round(Math.sin(t * 5));
    ctx.fillRect(Math.round(x), base - 78, 1, 8);
    ctx.fillRect(Math.round(x) + 1, base - 78, 6, 3);
    ctx.fillRect(Math.round(x) + 6, base - 77 + onda, 2, 2);
  };

  const inicio = performance.now();
  const quadro = (agora) => {
    if (!canvas.isConnected) return;
    // o horário do quadro pode vir um pouquinho antes da abertura: nunca deixa o tempo ficar negativo
    const t = Math.max(0, (agora - inicio) / 1000);
    // céu em três faixas com degradê
    const ceu = ctx.createLinearGradient(0, 0, 0, CHAO);
    ceu.addColorStop(0, cores.ceu[0]);
    ceu.addColorStop(0.62, cores.ceu[1]);
    ceu.addColorStop(1, cores.ceu[2]);
    ctx.fillStyle = ceu;
    ctx.fillRect(0, 0, W, H);
    if (cores.estrelas) {
      for (let i = 0; i < 70; i++) {
        const brilha = Math.sin(t * (1 + sorteFixa(i) * 3) + i) > 0.2;
        ctx.fillStyle = brilha ? "#ffffff" : "#8a84c0";
        ctx.fillRect(Math.floor(sorteFixa(i + 1) * W), Math.floor(sorteFixa(i + 2) * (CHAO - 50)), 1, 1);
      }
    }
    // o astro: a lua com crateras ou o sol com raios
    const ax = Math.round(W * 0.78);
    const ay = 26;
    if (cores.astro === "lua") {
      ctx.fillStyle = "rgba(255, 250, 220, 0.15)";
      ctx.beginPath(); ctx.arc(ax, ay, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff6d8";
      ctx.beginPath(); ctx.arc(ax, ay, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e6dcb8";
      ctx.fillRect(ax - 4, ay - 3, 3, 3); ctx.fillRect(ax + 3, ay + 2, 2, 2);
    } else {
      ctx.fillStyle = "rgba(255, 220, 120, 0.25)";
      ctx.beginPath(); ctx.arc(ax, ay + 10, 20 + Math.sin(t * 2) * 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffe08a";
      ctx.beginPath(); ctx.arc(ax, ay + 10, 12, 0, Math.PI * 2); ctx.fill();
    }
    // três camadas de montanhas, cada uma mais rápida (parallax)
    montanhas(t * 3, 46, 16, cores.montanhas[0], 1.3);
    // o castelo fica longe: passa bem devagar e, quando sai pela esquerda, volta pela direita
    if (cores.castelo) castelo((((W * 0.7 - t * 5) % (W + 160)) + W + 160) % (W + 160) - 80, CHAO - 20, t);
    montanhas(t * 7, 22, 9, cores.montanhas[1], 4.1);
    // os objetos do meio (árvores, casas, lampiões, torres), presos em posições do "mundo" que passa
    const passoObjetos = 34;
    const deslocMeio = t * 18;
    const primeiro = Math.floor(deslocMeio / passoObjetos) - 1;
    for (let n = primeiro; n < primeiro + W / passoObjetos + 3; n++) {
      const x = n * passoObjetos - deslocMeio + sorteFixa(n) * 14;
      const tipo = cores.objetos[Math.floor(sorteFixa(n + 7) * cores.objetos.length)];
      const base = CHAO - 2;
      if (tipo === "pinheiro") pinheiro(x, base, 22 + Math.round(sorteFixa(n + 1) * 14), tema === "reino" ? "#2e6a3a" : "#1a1838");
      else if (tipo === "arvore") arvore(x, base, 24 + Math.round(sorteFixa(n + 1) * 10));
      else if (tipo === "casa") casa(x, base, Math.abs(n), t);
      else if (tipo === "lampiao") lampiao(x, base, t, n);
      else if (tipo === "torre") torre(x, base, Math.abs(n));
    }
    // o chão: grama com tufos e a estrada de terra com pedrinhas, na velocidade dos passos
    const deslocChao = t * 30;
    ctx.fillStyle = cores.chao;
    ctx.fillRect(0, CHAO, W, H - CHAO);
    ctx.fillStyle = cores.grama;
    ctx.fillRect(0, CHAO, W, 2);
    for (let x = 0; x < W + 8; x += 6) {
      const m = Math.floor((x + deslocChao) / 6);
      if (sorteFixa(m) > 0.55) ctx.fillRect(Math.round(x - (deslocChao % 6)), CHAO - 2, 1, 2);
    }
    ctx.fillStyle = cores.terra;
    ctx.fillRect(0, CHAO + 6, W, 16);
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    for (let x = 0; x < W + 10; x += 10) {
      const m = Math.floor((x + deslocChao) / 10);
      if (sorteFixa(m + 50) > 0.5) ctx.fillRect(Math.round(x - (deslocChao % 10)), CHAO + 8 + Math.floor(sorteFixa(m) * 12), 2, 1);
    }
    // a frente: mato mais escuro passando rápido, perto da "câmera"
    const deslocFrente = t * 46;
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(0, CHAO + 24, W, H - CHAO - 24);
    for (let x = 0; x < W + 12; x += 4) {
      const m = Math.floor((x + deslocFrente) / 4);
      const alto = Math.floor(sorteFixa(m + 90) * 5);
      ctx.fillRect(Math.round(x - (deslocFrente % 4)), CHAO + 24 - alto, 2, alto);
    }
    // o herói andando no lugar enquanto o mundo passa, com a sombrinha embaixo
    const hx = Math.round(W * 0.42);
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(hx + 6, CHAO + 1, 18, 2);
    ctx.fillRect(hx + 8, CHAO + 3, 14, 1);
    if (sprites) {
      const s = sprites[Math.floor(t * VELOCIDADE_ANDAR) % QUADROS_ANDAR];
      ctx.drawImage(s, hx, CHAO - PE_HEROI - 1);
    }
    // vaga-lumes (ou faíscas mágicas) subindo e dançando
    ctx.fillStyle = cores.luz;
    for (let i = 0; i < 16; i++) {
      const vida = (t * 0.25 + sorteFixa(i)) % 1;
      const fx = (sorteFixa(i + 20) * W + Math.sin(t * 1.5 + i) * 8 - t * 6 + W) % W;
      const fy = CHAO - 6 - vida * 70;
      if (Math.sin(t * 4 + i * 2) > -0.3) ctx.fillRect(Math.round(fx), Math.round(fy), 1, 1);
    }
    if (aoQuadro) aoQuadro(t);
    requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);
}
