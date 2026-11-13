// A abertura do jogo: a cena animada do Zetsu na frente da Academia, as falas com efeito de máquina de
// escrever e a introdução em cartões ("como o jogo funciona"), que dá para pular a qualquer momento.
// Depende de pixel.js, cenarios.js (pintarAcademiaExterna, pintarReinoExterno, pintarSalaoAcademia),
// heroi.js (spritesHeroi), avatar.js (VISUAL_ZETSU), reino.js (TIPOS_MONSTRO) e interiores.js (espelhoMercado).

const LARGURA_ABERTURA = 160;
const ALTURA_ABERTURA = 110;

// Zetsu flutuando na frente da Academia, com faíscas girando em volta da gema do cajado.
function pintarAbertura(ctx, t) {
  pintarAcademiaExterna(ctx, t);
  // morro escuro na frente, onde o Zetsu está de pé
  ctx.fillStyle = "#0b0a1c";
  for (let x = 0; x < 70; x++) {
    const h = 16 + Math.round(Math.sin(x * 0.08) * 3) - Math.max(0, x - 50);
    ctx.fillRect(x, ALTURA_ABERTURA - h, 1, h);
  }
  // o Zetsu em primeiro plano, em escala 2 (como o retrato de um personagem na frente do cenário)
  const zetsu = spritesHeroi(VISUAL_ZETSU).baixo[0];
  const escala = 2;
  const sobe = Math.round(Math.sin(t * 2) * 1.5) * escala;
  const x = 2;
  const y = ALTURA_ABERTURA - zetsu.height * escala + 10 + sobe;
  brilhoRedondo(ctx, x + 32, y + 50, 40, "169, 139, 255", 0.05 + Math.sin(t * 2) * 0.02);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(zetsu, x, y, zetsu.width * escala, zetsu.height * escala);
  // faíscas girando em volta da gema do cajado (canto de cima, à direita do sprite)
  const gx = x + 25 * escala;
  const gy = y + 6 * escala;
  for (let i = 0; i < 6; i++) {
    const a = t * 2.2 + (i * Math.PI * 2) / 6;
    ctx.fillStyle = i % 2 ? "#6ef0ff" : "#e6fdff";
    ctx.fillRect(Math.round(gx + Math.cos(a) * 12), Math.round(gy + Math.sin(a) * 7), 2, 2);
  }
  // runas subindo do chão
  for (let i = 0; i < 8; i++) {
    const vida = (t * 0.35 + i / 8) % 1;
    ctx.globalAlpha = 1 - vida;
    ctx.fillStyle = i % 2 ? "#a98bff" : "#6ef0ff";
    ctx.fillRect(x + 6 + ((i * 9) % 54), Math.round(ALTURA_ABERTURA - 6 - vida * 70), 2, 2);
  }
  ctx.globalAlpha = 1;
}

// Escreve a fala letra por letra (os trechos entre ** ficam em negrito). Clicar na caixa termina na hora.
// Devolve uma promessa que resolve quando o texto está todo na tela.
function escreverFala(elemento, texto, velocidade = 22) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((p) => (p.startsWith("**") ? { negrito: true, texto: p.slice(2, -2) } : { negrito: false, texto: p }));
  // uma fala nova no mesmo lugar interrompe a anterior (senão as letras das duas se misturam)
  elemento._pararFala?.();
  elemento.textContent = "";
  return new Promise((resolver) => {
    let parte = 0;
    let letra = 0;
    let atual = null;
    let pronto = false;
    elemento._pararFala = () => {
      pronto = true;
      clearInterval(relogio);
      elemento.closest("[data-caixa]")?.removeEventListener("click", terminar);
      resolver();
    };
    const terminar = () => {
      if (pronto) return;
      pronto = true;
      clearInterval(relogio);
      elemento.innerHTML = partes.map((p) => (p.negrito ? `<strong>${escapar(p.texto)}</strong>` : escapar(p.texto))).join("");
      elemento.closest("[data-caixa]")?.removeEventListener("click", terminar);
      resolver();
    };
    const relogio = setInterval(() => {
      if (!elemento.isConnected) return terminar();
      if (parte >= partes.length) return terminar();
      if (!atual) {
        atual = partes[parte].negrito ? document.createElement("strong") : document.createElement("span");
        elemento.append(atual);
      }
      atual.textContent += partes[parte].texto[letra];
      letra += 1;
      if (letra % 3 === 0 && typeof Som !== "undefined" && Som.blip) Som.blip(elemento.dataset.voz ? Number(elemento.dataset.voz) : 0.85);
      if (letra >= partes[parte].texto.length) {
        parte += 1;
        letra = 0;
        atual = null;
      }
    }, velocidade / (typeof Som !== "undefined" && Som.volumes ? Som.volumes().velocidadeTexto || 1 : 1));
    elemento.closest("[data-caixa]")?.addEventListener("click", terminar);
  });
}

// ---------- os cartões da introdução ----------

function chaoPalco(ctx, cor = "#2a2248", brilho = "#3d3266") {
  ctx.fillStyle = cor;
  ctx.fillRect(0, 74, 160, 16);
  ctx.fillStyle = brilho;
  ctx.fillRect(0, 74, 160, 1);
}

function fundoNoite(ctx, t) {
  ceuEmFaixas(ctx, 160, 90, ["#120e2a", "#1a1440", "#231a52", "#2c2063"]);
  for (let i = 0; i < 24; i++) {
    const brilha = Math.sin(t * 2 + i) > 0.3;
    ctx.fillStyle = brilha ? "#ffffff" : "#8a84a6";
    ctx.fillRect((i * 37) % 160, (i * 23) % 60, 1, 1);
  }
}

const KITS_INTRO = [
  { kit: "mago", item: "cajado", chapeu: "pontudo", manto: "#5a3aa6" },
  { kit: "guerreiro", item: "espadaEscudo", chapeu: "elmoFerro", manto: "#a8323e", cabelo: "curto" },
  { kit: "arqueiro", item: "arco", chapeu: "cacador", manto: "#1f7a5c", corpo: "feminino", cabelo: "rabo", corCabelo: "#e2b04a" },
];

const SLIDES_INTRO = [
  {
    icone: "🌍", titulo: "O Reino de Elyndor",
    texto: "Desde a **Grande Ruptura**, o conhecimento do reino vive partido em fragmentos. Deles nasceu uma magia nova: a **IA**. Tu vais aprender a usá-la de verdade (prompts, código, segurança, trabalho) enquanto salvas Elyndor.",
    pintar: (ctx, t) => pintarReinoExterno(ctx, t),
  },
  {
    icone: "⚔️", titulo: "Escolhe tua classe",
    texto: "**Mago**, **Guerreiro** ou **Arqueiro**: cada um com roupa, armas e poderes próprios. Todos começam como iniciantes e, no **nível 4**, escolhem uma das 5 **subclasses**, com magias engraçadas e uma passiva só delas.",
    pintar: (ctx, t) => {
      fundoNoite(ctx, t);
      chaoPalco(ctx);
      KITS_INTRO.forEach((kit, i) => {
        const sprite = spritesHeroi({ ...AVATAR_PADRAO, ...kit }).baixo[Math.floor(t * 12 + i * 2) % QUADROS_ANDAR];
        const x = 16 + i * 48;
        brilhoRedondo(ctx, x + 16, 52, 18, ["169, 139, 255", "255, 107, 74", "95, 211, 95"][i], 0.07);
        ctx.drawImage(sprite, x, 74 - PE_HEROI);
      });
    },
  },
  {
    icone: "🏰", titulo: "A Academia Arcana",
    texto: "Três professores ensinam do iniciante ao avançado. Cada **lição** vale até **3 estrelas**, abre baús e libera as **dungeons**. A biblioteca e a sala da carreira guardam livros e guias que rendem XP.",
    pintar: (ctx, t) => {
      pintarSalaoAcademia(ctx, t);
      const zetsu = spritesHeroi(VISUAL_ZETSU).baixo[0];
      ctx.drawImage(zetsu, 64, 34 + Math.round(Math.sin(t * 2)));
    },
  },
  {
    icone: "🐺", titulo: "Batalhas no Reino",
    texto: "Encostou num monstro, começa a batalha: cada **resposta certa** é um golpe; cada erro te custa **corações**. Usa as técnicas do teu grimório (ou arsenal, ou aljava) gastando **mana**, **fúria** ou **foco**. Os **chefões** mudam de forma em 3 fases.",
    pintar: (ctx, t) => {
      fundoNoite(ctx, t);
      chaoPalco(ctx, "#1f4a2a", "#2f7d46");
      const golpe = t % 2 < 0.5;
      const heroi = spritesHeroi({ ...AVATAR_PADRAO, ...KITS_INTRO[1] }).lado[golpe ? 2 : 0];
      ctx.drawImage(heroi, 26 + (golpe ? 6 : 0), 74 - PE_HEROI);
      const lobo = TIPOS_MONSTRO.lobo.sprite();
      ctx.save();
      ctx.translate(132, 74 - lobo.height);
      ctx.scale(-1, 1);
      ctx.drawImage(lobo, 0, golpe ? -2 : 0);
      ctx.restore();
      if (golpe) {
        ctx.fillStyle = "#ffffff";
        [[90, 50], [94, 54], [98, 58], [92, 60], [100, 48]].forEach(([x, y]) => ctx.fillRect(x, y, 2, 2));
      }
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i < 3 ? "#ff4d6d" : "#4a2433";
        ctx.fillRect(6 + i * 7, 6, 5, 4);
        ctx.fillRect(7 + i * 7, 10, 3, 1);
      }
    },
  },
  {
    icone: "🌳", titulo: "Tu evoluis",
    texto: "Acertos dão **domínio** nas trilhas (com patentes e golpes certeiros). Cada nível dá **pontos** para a **Árvore Arcana** (tecla **K**). O diário de **missões** (tecla **J**) paga bem, e a **mochila** (tecla **I**) guarda itens, visuais e troféus.",
    pintar: (ctx, t) => {
      fundoNoite(ctx, t);
      ctx.fillStyle = "#5c3418";
      ctx.fillRect(78, 40, 4, 40);
      const nos = [[80, 30], [56, 42], [104, 42], [40, 58], [64, 58], [96, 58], [120, 58]];
      [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]].forEach(([a, b]) => {
        ctx.strokeStyle = "#8b5a2b";
        ctx.beginPath();
        ctx.moveTo(nos[a][0], nos[a][1]);
        ctx.lineTo(nos[b][0], nos[b][1]);
        ctx.stroke();
      });
      const acesos = Math.floor(t * 1.5) % (nos.length + 2);
      nos.forEach(([x, y], i) => {
        const aceso = i < acesos;
        if (aceso) brilhoRedondo(ctx, x, y, 8, "255, 209, 102", 0.12);
        circuloPixel(ctx, x, y, 5, aceso ? "#ffd166" : "#3d3266");
        circuloPixel(ctx, x, y, 3, aceso ? "#fff3b0" : "#2a2248");
      });
    },
  },
  {
    icone: "🏪", titulo: "Mercado e espelho",
    texto: "No **Mercado** a Brina vende poções, comidas, roupas, mascotes e uma **arma especial** para cada classe. O **espelho** do Mercado troca teu visual quando quiseres. A classe, essa, é para sempre.",
    pintar: (ctx, t) => {
      ctx.fillStyle = "#7a4d24";
      ctx.fillRect(0, 0, 160, 90);
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = i % 2 ? "#fdf2e9" : "#e74c3c";
        ctx.fillRect(i * 16, 0, 16, 8);
      }
      chaoPalco(ctx, "#b08a55", "#c9a46e");
      ctx.drawImage(espelhoMercado(), 30, 74 - 36);
      const heroi = spritesHeroi({ ...AVATAR_PADRAO, ...KITS_INTRO[(Math.floor(t / 1.5)) % 3] }).baixo[0];
      ctx.drawImage(heroi, 70, 74 - PE_HEROI);
      for (let i = 0; i < 5; i++) {
        const vida = (t * 0.6 + i / 5) % 1;
        ctx.fillStyle = "#f5c451";
        ctx.fillRect(112 + i * 7, Math.round(70 - vida * 40), 3, 3);
      }
    },
  },
  {
    icone: "🎮", titulo: "Os controles",
    texto: "Anda com **WASD** ou as **setas** (ou clica no chão). **E** entra e conversa. **K** árvore, **J** missões, **I** mochila e **F** tela cheia. Pronto: bora criar teu aventureiro!",
    pintar: (ctx, t) => {
      fundoNoite(ctx, t);
      chaoPalco(ctx);
      const volta = (t * 30) % 220;
      const indo = volta < 110;
      const x = indo ? volta + 10 : 230 - volta;
      const heroi = spritesHeroi({ ...AVATAR_PADRAO, ...KITS_INTRO[0] }).lado[Math.floor(t * VELOCIDADE_ANDAR) % QUADROS_ANDAR];
      ctx.save();
      if (indo) ctx.drawImage(heroi, Math.round(x), 74 - PE_HEROI);
      else {
        ctx.translate(Math.round(x) + heroi.width, 74 - PE_HEROI);
        ctx.scale(-1, 1);
        ctx.drawImage(heroi, 0, 0);
      }
      ctx.restore();
    },
  },
];

// A introdução em cartões: setas, bolinhas e teclado (← → Enter Esc). "Pular" fecha na hora.
function telaIntroducao(aoTerminar) {
  const camada = document.createElement("div");
  camada.className = "introducao";
  camada.innerHTML = `
    <div class="cartao-intro">
      <button class="botao botao-fantasma pular-intro" type="button" data-pular>Pular introdução ▸▸</button>
      <canvas class="pixel" width="160" height="90"></canvas>
      <div class="texto-intro">
        <p class="sobretitulo-pixel" data-contador></p>
        <h2 data-titulo></h2>
        <p data-texto></p>
      </div>
      <div class="navegacao-intro">
        <button class="botao botao-fantasma" type="button" data-voltar>◂ Voltar</button>
        <div class="bolinhas-intro" data-bolinhas></div>
        <button class="botao" type="button" data-avancar>Próximo ▸</button>
      </div>
    </div>`;
  document.body.append(camada);
  const canvas = camada.querySelector("canvas");
  let atual = 0;
  let pintor = SLIDES_INTRO[0].pintar;
  animarCenario(canvas, (ctx, t) => pintor(ctx, t));

  function fechar() {
    window.removeEventListener("keydown", aoTeclar);
    camada.classList.add("saindo");
    setTimeout(() => camada.remove(), 300);
    aoTerminar();
  }
  function mostrar(i) {
    atual = i;
    const slide = SLIDES_INTRO[i];
    pintor = slide.pintar;
    camada.querySelector("[data-contador]").textContent = `${i + 1} de ${SLIDES_INTRO.length}`;
    camada.querySelector("[data-titulo]").textContent = `${slide.icone} ${slide.titulo}`;
    escreverFala(camada.querySelector("[data-texto]"), slide.texto, 12);
    camada.querySelector("[data-bolinhas]").innerHTML = SLIDES_INTRO.map((_, j) => `<button type="button" class="${j === i ? "atual" : ""}" data-ir="${j}" aria-label="Cartão ${j + 1}"></button>`).join("");
    camada.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => mostrar(Number(b.dataset.ir))));
    camada.querySelector("[data-voltar]").disabled = i === 0;
    camada.querySelector("[data-avancar]").textContent = i === SLIDES_INTRO.length - 1 ? "Bora jogar! ⚔️" : "Próximo ▸";
    const cartao = camada.querySelector(".cartao-intro");
    cartao.classList.remove("entrando");
    void cartao.offsetWidth;
    cartao.classList.add("entrando");
  }
  function avancar() {
    if (atual === SLIDES_INTRO.length - 1) fechar();
    else mostrar(atual + 1);
  }
  function aoTeclar(e) {
    if (e.key === "ArrowRight" || e.key === "Enter") avancar();
    else if (e.key === "ArrowLeft" && atual > 0) mostrar(atual - 1);
    else if (e.key === "Escape") fechar();
    else return;
    e.preventDefault();
  }
  window.addEventListener("keydown", aoTeclar);
  camada.querySelector("[data-pular]").addEventListener("click", fechar);
  camada.querySelector("[data-avancar]").addEventListener("click", avancar);
  camada.querySelector("[data-voltar]").addEventListener("click", () => atual > 0 && mostrar(atual - 1));
  mostrar(0);
}
