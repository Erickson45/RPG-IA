// RPG IA · página de apresentação: a cena do título, o céu estrelado, e as seções interativas
// (galeria, classes, a história, o bestiário, a biblioteca e um desafio de verdade, tirado do jogo).

const LINK_JOGO = "https://magiaia.duckdns.org";
const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s) => document.querySelector(s);
const carregar = (src) => new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = src; });

// ---------- a barra de cima ganha fundo quando a página rola ----------
const barra = $("#barra");
const marcarBarra = () => barra.classList.toggle("rolou", scrollY > 20);
addEventListener("scroll", marcarBarra, { passive: true });
marcarBarra();

// ---------- a cena do título do jogo, no convite final ----------
(async () => {
  const nomes = ["guerreiro", "mago", "arqueiro"];
  let herois = [];
  try {
    herois = await Promise.all(nomes.map((n) => Promise.all([
      carregar(`img/sprites/heroi-${n}-lado-0.png`), carregar(`img/sprites/heroi-${n}-lado-respira.png`),
    ])));
  } catch {
    // sem as imagens, a cena fica só com o céu e o castelo
  }
  let canvas = $("#cena");
  criarCena(canvas, herois);
  // ao redimensionar, recria a cena na proporção nova (a anterior para sozinha quando sai da página)
  let espera;
  addEventListener("resize", () => {
    clearTimeout(espera);
    espera = setTimeout(() => {
      const novo = canvas.cloneNode();
      canvas.replaceWith(novo);
      canvas = novo;
      criarCena(canvas, herois);
    }, 200);
  });
})();

// ---------- o céu estrelado atrás da página ----------
(() => {
  const c = $("#estrelas");
  const ctx = c.getContext("2d");
  let estrelas = [];
  const montar = () => {
    c.width = innerWidth;
    c.height = innerHeight;
    estrelas = Array.from({ length: Math.round((innerWidth * innerHeight) / 5200) }, () => ({
      x: Math.random() * innerWidth, y: Math.random() * innerHeight, t: Math.random() < 0.12 ? 3 : 2,
      f: 0.5 + Math.random() * 2.5, fase: Math.random() * 6,
    }));
  };
  const quadro = (agora) => {
    ctx.fillStyle = "#0d0920";
    ctx.fillRect(0, 0, c.width, c.height);
    for (const e of estrelas) {
      const brilho = calmo ? 0.8 : 0.35 + Math.max(0, Math.sin(agora / 1000 * e.f + e.fase)) * 0.65;
      ctx.fillStyle = `rgba(${e.t === 3 ? "255, 240, 200" : "200, 190, 255"}, ${brilho})`;
      ctx.fillRect(Math.round(e.x), Math.round(e.y), e.t, e.t);
    }
    if (!calmo) requestAnimationFrame(quadro);
  };
  montar();
  addEventListener("resize", montar);
  requestAnimationFrame(quadro);
})();

// ---------- aparecer ao rolar e os números que contam ----------
const contar = (el) => {
  const alvo = Number(el.dataset.conta);
  const inicio = performance.now();
  const passo = (agora) => {
    const p = Math.min(1, (agora - inicio) / 1400);
    el.textContent = Math.round(alvo * (1 - Math.pow(1 - p, 3))).toLocaleString("pt-BR");
    if (p < 1) requestAnimationFrame(passo);
  };
  calmo ? (el.textContent = alvo.toLocaleString("pt-BR")) : requestAnimationFrame(passo);
};
const observador = new IntersectionObserver((entradas) => {
  for (const e of entradas) {
    if (!e.isIntersecting) continue;
    e.target.classList.add("visivel");
    e.target.querySelectorAll("[data-conta]").forEach(contar);
    observador.unobserve(e.target);
  }
}, { threshold: 0.15 });
const observar = () => document.querySelectorAll(".aparece:not(.visivel)").forEach((el) => observador.observe(el));

// ---------- galeria ----------
const PRINTS = [
  ["01-titulo", "A tela de título", "A Academia no morro, a aurora e o dragão cruzando o céu."],
  ["02-batalha-prompt", "Batalha de prompt", "Completa a parte que falta do prompt: papel, contexto, tarefa ou formato?"],
  ["academia", "A Academia Arcana", "Onde tudo começa: o mestre Zetsu, a biblioteca e as salas de aula."],
  ["04-reino-de-elyndor", "O Reino à noite", "Dia e noite de verdade. À noite, as criaturas mais perigosas saem."],
  ["chefe", "Chefão em fases", "O Rei Slime dos Campos: perguntas mais difíceis e prêmio raro."],
  ["05-grimorio-licao", "O Grimório", "Errou? O livro abre no capítulo que explica, com exemplos prontos."],
];
$("#lista-galeria").innerHTML = PRINTS.map(([arq, titulo, texto]) => `
  <button type="button" class="aparece" data-img="img/prints/${arq}.jpg" data-legenda="${titulo}: ${texto}">
    <div class="moldura"><img src="img/prints/${arq}.jpg" alt="${titulo}" loading="lazy">
    <div class="legenda"><b>${titulo}</b>${texto}</div></div>
  </button>`).join("");
const visor = $("#visor");
$("#lista-galeria").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-img]");
  if (!b) return;
  $("#visor-img").src = b.dataset.img;
  $("#visor-img").alt = b.dataset.legenda;
  $("#visor-legenda").textContent = b.dataset.legenda;
  visor.showModal();
});
$("#visor-fechar").addEventListener("click", () => visor.close());
visor.addEventListener("click", (e) => { if (e.target === visor) visor.close(); });

// ---------- classes ----------
const CLASSES = [
  { id: "guerreiro", nome: "Guerreiro", cor: "#ff6b4a", lema: "Quem segura a linha segura o reino.",
    desc: "Armadura, aço e coragem. Vence na linha de frente, com disciplina e força de vontade.",
    subs: [
      ["Comandante de Batalha", "Vence com ordens precisas: os prompts que fazem a tropa (e a IA) entender de primeira."],
      ["Paladino do Firewall", "O escudo do reino: protege senhas, dados e pessoas de golpes e vazamentos."],
      ["Berserker do Código", "Programa com fúria: scripts, automações e correções que saem na força do braço."],
      ["Gladiador Corporativo", "Luta nas batalhas do dia a dia: e-mails, relatórios, reuniões e prazos, com a IA do lado."],
      ["Cavaleiro dos Fundamentos", "Conhece o inimigo por dentro: como os modelos aprendem, erram e alucinam."],
    ] },
  { id: "mago", nome: "Mago", cor: "#a98bff", lema: "A palavra certa abre qualquer porta.",
    desc: "Estuda runas, dados e golens. Vence pelo conhecimento e pela magia.",
    subs: [
      ["Mago das Runas", "Mestre das palavras. Transforma pedidos confusos em feitiços precisos: os prompts."],
      ["Alquimista de Dados", "Transforma planilhas, APIs e números em respostas e painéis que todo mundo entende."],
      ["Artífice de Autômatos", "Constrói golens de código que trabalham sozinhos: scripts e automações."],
      ["Guardião dos Selos", "Protege os segredos do reino: privacidade, senhas e dados de quem confia em ti."],
      ["Domador de Dragões", "Encara os maiores desafios: projetos completos, da ideia ao produto."],
    ] },
  { id: "arqueiro", nome: "Arqueiro", cor: "#5fd35f", lema: "Paciência, mira e uma flecha só.",
    desc: "Olhos de águia e passos leves. Vence de longe, com precisão e esperteza.",
    subs: [
      ["Caçador de Prompts", "Mira nas palavras: escreve o pedido exato para a IA acertar de primeira."],
      ["Sentinela da Torre", "Vigia o reino do alto: golpes, vazamentos e invasores não passam pelos olhos dele."],
      ["Ranger do Código", "Arma armadilhas de código: scripts e automações que trabalham por ele."],
      ["Mercenário Freelancer", "Usa IA no trabalho de verdade: entrega rápido, cobra justo e nunca perde um prazo."],
      ["Patrulheiro dos Dados", "Lê a floresta dos dados: como os modelos aprendem, decidem e às vezes se perdem."],
    ] },
];
const abas = $("#abas-classes");
abas.innerHTML = CLASSES.map((c, i) => `
  <button type="button" class="aba" role="tab" id="aba-${c.id}" aria-selected="${i === 1}" style="--cor:${c.cor}" data-classe="${c.id}">
    <img class="pixel" src="img/sprites/heroi-${c.id}-baixo-0.png" alt="">${c.nome}</button>`).join("");
const mostrarClasse = (id) => {
  const c = CLASSES.find((x) => x.id === id);
  abas.querySelectorAll(".aba").forEach((a) => a.setAttribute("aria-selected", String(a.dataset.classe === id)));
  const painel = $("#painel-classe");
  painel.style.setProperty("--cor", c.cor);
  painel.setAttribute("aria-labelledby", `aba-${c.id}`);
  painel.innerHTML = `
    <div class="retrato"><img class="pixel" src="img/sprites/heroi-${c.id}-baixo-0.png" alt="${c.nome}"><h3>${c.nome}</h3><q>${c.lema}</q></div>
    <div><p class="desc-classe">${c.desc} No nível 4, escolhe uma das 5 subclasses. Cada uma muda as <b>perguntas</b> que tu enfrenta:</p>
      <div class="subclasses">${c.subs.map(([n, d]) => `<div class="subclasse"><b>${n}</b><span>${d}</span></div>`).join("")}</div></div>`;
};
abas.addEventListener("click", (e) => { const a = e.target.closest(".aba"); if (a) mostrarClasse(a.dataset.classe); });
abas.addEventListener("keydown", (e) => {
  if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
  const lista = [...abas.querySelectorAll(".aba")];
  const atual = lista.findIndex((a) => a.getAttribute("aria-selected") === "true");
  const prox = lista[(atual + (e.key === "ArrowRight" ? 1 : lista.length - 1)) % lista.length];
  prox.focus();
  mostrarClasse(prox.dataset.classe);
});
mostrarClasse("mago");

// ---------- a história (o prólogo do jogo, com o texto aparecendo letra a letra) ----------
const PROLOGO = [
  "Em Elyndor, conhecimento não é só sabedoria. É poder. Cada verdade compreendida acende magia nas mãos de quem a entende.",
  "Por mil anos, a Academia Arcana ensinou a mais difícil das magias: perguntar bem, conferir as fontes e nunca parar de aprender.",
  "Até que o maior dos mestres, Malakar, criou o Oráculo: uma mente única que respondia tudo, para todos. E o povo parou de pensar.",
  "Mas saber sem compreender tem fome. Dessa fome nasceu o Vazio... e na noite da Grande Ruptura, o Oráculo se partiu.",
  "Os pedaços do saber esquecido caíram sobre o Reino e viraram monstros. Eles não querem sangue. Querem respostas.",
  "Trezentos anos depois, um aprendiz encontrou nas ruínas o Núcleo Arcano. E o Núcleo, que dormia desde a Ruptura... acordou.",
  "Nas profundezas, algo sentiu esse despertar. E sorriu. Neste reino, conhecimento é poder... e o teu está só começando.",
];
let cena = 0;
let digitando = null;
const textoHistoria = $("#historia-texto");
const mostrarCena = (i) => {
  cena = i;
  clearInterval(digitando);
  const frase = PROLOGO[i];
  $("#historia-pontos").innerHTML = PROLOGO.map((_, k) => `<i class="${k === i ? "ativo" : ""}"></i>`).join("");
  $("#historia-proximo").textContent = i === PROLOGO.length - 1 ? "⚔️ Começar a jornada" : "Continuar ▸";
  textoHistoria.classList.remove("pronto");
  if (calmo) { textoHistoria.textContent = frase; textoHistoria.classList.add("pronto"); return; }
  let n = 0;
  textoHistoria.textContent = "";
  digitando = setInterval(() => {
    n += 2;
    textoHistoria.textContent = frase.slice(0, n);
    if (n >= frase.length) { clearInterval(digitando); textoHistoria.classList.add("pronto"); }
  }, 28);
};
$("#historia-proximo").addEventListener("click", () => {
  // o primeiro clique completa a frase; o segundo passa para a próxima
  if (!textoHistoria.classList.contains("pronto")) {
    clearInterval(digitando);
    textoHistoria.textContent = PROLOGO[cena];
    textoHistoria.classList.add("pronto");
    return;
  }
  if (cena === PROLOGO.length - 1) { window.open(LINK_JOGO, "_blank", "noopener"); return; }
  mostrarCena(cena + 1);
});
// começa a escrever quando a seção aparece na tela
new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { mostrarCena(0); o.disconnect(); } }, { threshold: 0.4 }).observe($(".pergaminho"));

// ---------- bestiário ----------
const MONSTROS = [
  ["slime-da-duvida", "Slime da Dúvida", 24, 19, 4], ["slime-do-bug", "Slime do Bug", 24, 19, 4], ["slime-alucinado", "Slime Alucinado", 24, 19, 4],
  ["slime-toxico", "Slime Tóxico", 24, 19, 4], ["slime-gigante", "Slime Gigante", 36, 29, 3], ["morcego-do-cache", "Morcego do Cache", 24, 13, 4],
  ["assombracao-do-codigo-morto", "Assombração do Código Morto", 20, 22, 4], ["fogo-fatuo-alucinado", "Fogo-Fátuo Alucinado", 16, 18, 4.5],
  ["esqueleto-compilador", "Esqueleto Compilador", 28, 36, 2.6], ["escorpiao-do-bug", "Escorpião do Bug", 32, 17, 3.4],
  ["lobo-uivante", "Lobo Uivante", 34, 21, 3], ["lobo-alfa-da-nevoa", "Lobo Alfa da Névoa", 43, 26, 2.5], ["lobo-das-neves", "Lobo das Neves", 34, 21, 3],
  ["sapo-do-brejo", "Sapo do Brejo", 24, 17, 4], ["dragao-vermelho", "Dragão Vermelho", 53, 47, 2], ["dragao-de-gelo", "Dragão de Gelo", 53, 47, 2],
];
$("#lista-monstros").innerHTML = MONSTROS.map(([id, nome, w, h, e]) => `
  <div class="besta aparece"><img class="pixel" src="img/sprites/monstro-${id}.png" alt="" style="width:${w * e}px;height:${h * e}px"><span>${nome}</span></div>`).join("");
const CHEFES = [
  ["rei-slime-dos-campos", "Rei Slime dos Campos", 84, 77], ["fenrir-o-lobo-rei", "Fenrir, o Lobo Rei", 102, 75],
  ["sapo-rei-do-brejo", "Sapo Rei do Brejo", 90, 75], ["escorpiao-imperador", "Escorpião Imperador", 104, 55], ["ignis-o-dragao-rei", "Ignis, o Dragão Rei", 156, 136],
];
$("#lista-chefes").innerHTML = CHEFES.map(([id, nome, w, h]) => `
  <div class="chefe aparece"><img class="pixel" src="img/sprites/monstro-${id}.png" alt="" style="width:${Math.round(w * 1.5)}px;height:${Math.round(h * 1.5)}px"><b>${nome}</b></div>`).join("");

// ---------- biblioteca ----------
const LIVROS = ["O Grimório da IA", "A Arte do Prompt", "Prompts Avançados", "Livro de Receitas de Prompt", "Por Dentro dos Modelos",
  "IA no Dia a Dia do Trabalho", "Produtividade com IA", "Custos e Métricas da IA", "O Oráculo das Fontes", "A Guilda dos Agentes",
  "Os Sentidos da Máquina", "Escudos contra Prompt Injection", "O Códice da LGPD", "O Juramento da IA Responsável", "Armadura Digital",
  "Primeiros Feitiços em Python", "Python que Trabalha por Ti", "Python Conversando com a IA", "Dados na Palma da Mão", "Tomo dos Dados: SQL",
  "Mensageiros: APIs e JSON", "Crônicas do Git", "Código que Não Quebra", "Encantamentos de PowerShell", "Pergaminhos do Apps Script", "Fluxos Sem Código"];
const CORES = ["#a98bff", "#6ef0ff", "#f5c451", "#ff8a7a", "#5fd35f"];
$("#lista-livros").innerHTML = LIVROS.map((l, i) => `<span class="livro" style="--c:${CORES[i % CORES.length]}"><i></i>${l}</span>`).join("");

// ---------- o desafio (perguntas de verdade do jogo) ----------
const DESAFIOS = [
  { monstro: "slime-alucinado", nome: "Slime Alucinado", perigo: "Encontro no Reino · Médio", w: 24, h: 19,
    pergunta: "Blub blub! Responde se for capaz: em essência, o que um LLM faz quando gera uma resposta?",
    opcoes: ["Copia um trecho exato do treino e cola na resposta", "Raciocina como uma pessoa e confere cada afirmação",
      "Prevê, token a token, qual pedaço de texto é mais provável vir a seguir", "Pesquisa a resposta pronta num banco de fatos verificados"],
    certa: 2, licao: "Um LLM gera texto prevendo o próximo token mais provável. Por isso ele soa confiante mesmo quando erra: conferir continua sendo trabalho teu.",
    livro: "O Grimório da IA, cap. 2: Como um LLM pensa" },
  { monstro: "slime-da-duvida", nome: "Slime da Dúvida", perigo: "Situação de trabalho · Fraco", w: 24, h: 19,
    pergunta: "Paulo, do comercial: \"A IA me passou o link de um estudo perfeito para a proposta, mas o link não abre. Coloco mesmo assim?\"",
    opcoes: ["Colocar, o cliente dificilmente vai clicar", "Trocar o link por \"fonte: internet\"",
      "Não colocar: pode ser alucinação; procurar o estudo de verdade e só citar se ele existir", "Pedir para a IA gerar outro link até algum abrir"],
    certa: 2, licao: "IA pode inventar referências com aparência real. Citação só depois de conferir a fonte original.",
    livro: "O Grimório da IA, cap. 3: Alucinação" },
  { monstro: "slime-do-bug", nome: "Slime do Bug", perigo: "Encontro no Reino · Médio", w: 24, h: 19,
    pergunta: "Para extrair campos de notas fiscais em JSON, qual temperatura faz mais sentido?",
    opcoes: ["Alta, para o modelo ser criativo com os campos", "Baixa, para respostas mais previsíveis",
      "A mais alta possível, para evitar erros", "Tanto faz, temperatura só muda a cor do texto"],
    certa: 1, licao: "Temperatura baixa deixa a saída mais previsível, que é o que tu quer ao extrair dados. Criatividade fica para brainstorm.",
    livro: "Por Dentro dos Modelos, cap. 5: Temperatura e amostragem" },
  { monstro: "fogo-fatuo-alucinado", nome: "Fogo-Fátuo Alucinado", perigo: "Situação de trabalho · Ética", w: 16, h: 18,
    pergunta: "Fernanda, do RH: \"O Tiago perdeu o pai ontem. Queria mandar uma mensagem do time para ele.\" Como tu faz?",
    opcoes: ["Usa um modelo genérico de condolências da internet", "Pede para a IA escrever e manda sem ler",
      "Pede para a IA escrever um texto bem longo e formal", "Escreve uma mensagem pessoal tu mesmo; se quiser, usa a IA só para revisar"],
    certa: 3, licao: "Tem hora em que o valor está justamente em ser humano. A IA pode revisar, mas a mensagem precisa ser tua.",
    livro: "Ética e segurança no trabalho, cap. 4: Quando NÃO usar IA" },
];
let desafioAtual = 0;
const montarDesafio = (i) => {
  const d = DESAFIOS[i];
  desafioAtual = i;
  $("#desafio-nome").textContent = d.nome;
  $("#desafio-rotulo").textContent = d.nome;
  $("#desafio-perigo").textContent = d.perigo;
  const sprite = $("#desafio-sprite");
  sprite.src = `img/sprites/monstro-${d.monstro}.png`;
  sprite.style.width = `${d.w * 5}px`;
  sprite.style.height = `${d.h * 5}px`;
  sprite.style.opacity = "1";
  $("#desafio-vida").style.width = "100%";
  $("#desafio-pergunta").textContent = d.pergunta;
  $("#desafio-resultado").hidden = true;
  $("#desafio-respostas").innerHTML = d.opcoes.map((o, k) => `
    <button type="button" class="resposta" data-k="${k}"><span class="letra">${"ABCD"[k]}</span><span>${o}</span></button>`).join("");
};
$("#desafio-respostas").addEventListener("click", (e) => {
  const b = e.target.closest(".resposta");
  if (!b || b.disabled) return;
  const d = DESAFIOS[desafioAtual];
  const acertou = Number(b.dataset.k) === d.certa;
  $("#desafio-respostas").querySelectorAll(".resposta").forEach((r) => {
    r.disabled = true;
    if (Number(r.dataset.k) === d.certa) r.classList.add("certa");
  });
  if (!acertou) b.classList.add("errada");
  if (acertou) { $("#desafio-vida").style.width = "0%"; $("#desafio-sprite").style.opacity = "0.25"; }
  const ultimo = desafioAtual === DESAFIOS.length - 1;
  const res = $("#desafio-resultado");
  res.innerHTML = `
    <h3>${acertou ? "✨ Feitiço em cheio!" : "💥 O monstro te acertou!"}</h3>
    <p>${d.licao}<br><small>📖 Estuda isso em: ${d.livro}</small></p>
    <div class="botoes">
      ${ultimo ? "" : `<button type="button" class="botao" id="desafio-proximo">Manda a próxima! 🔮</button>`}
      <a class="botao ${ultimo ? "" : "secundario"}" href="${LINK_JOGO}" target="_blank" rel="noopener">⚔️ Jogar o jogo completo</a>
    </div>`;
  res.hidden = false;
  res.querySelector("#desafio-proximo")?.addEventListener("click", () => montarDesafio(desafioAtual + 1));
});
montarDesafio(0);

// ---------- Pix ----------
$("#copiar-pix").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#chave-pix").textContent.trim());
    $("#pix-copiado").hidden = false;
  } catch {
    // sem acesso à área de transferência: seleciona a chave para copiar à mão
    getSelection().selectAllChildren($("#chave-pix"));
  }
});

observar();
