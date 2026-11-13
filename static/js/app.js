// RPG IA (Academia Arcana de Elyndor): lógica do jogo no navegador.
// O progresso do aluno mora no servidor (ligado a um id de jogador). Tudo que vale de verdade
// (XP, moedas, vida, itens, vitórias) é decidido lá; o navegador pede a ação e redesenha a tela.
// O localStorage guarda só o id do jogador e uma cópia para abrir o jogo mais rápido.

const CHAVE_PROGRESSO = "academia-zetsu-progresso";
const CHAVE_JOGADOR = "academia-jogador-id";
// espelho da curva de XP do servidor (progressao.py), só para desenhar a barra
const CURVA_XP = { xpBase: 50, xpPorNivel: 30, eras: [[1, "Era do Aprendiz"], [11, "Era do Explorador"], [21, "Era do Mestre"], [36, "Era do Arquimago"]] };
let jogadorId = null;
const PARTES = {
  papel: { rotulo: "Papel", letra: "P", dica: "Quem a IA deve ser.", exemplo: "Ex.: Você é um desenvolvedor Python experiente..." },
  contexto: { rotulo: "Contexto", letra: "C", dica: "A situação real, com detalhes.", exemplo: "Ex.: Tenho um arquivo chamados.csv com as colunas..." },
  tarefa: { rotulo: "Tarefa", letra: "T", dica: "O que fazer, com regras claras.", exemplo: "Ex.: Crie um script que conte os chamados abertos..." },
  formato: { rotulo: "Formato", letra: "F", dica: "Como você quer a resposta.", exemplo: "Ex.: Código Python comentado + como rodar no terminal." },
};

const tela = document.getElementById("tela");
// o Zetsu em pixel art, desenhado pelo mesmo sistema de avatar (avatar.js)
const IMG_ZETSU = avatarDataUrl(VISUAL_ZETSU);
let progresso = carregarProgresso();
let iaAtiva = false;

// ---------- utilidades ----------

function progressoNovo() {
  return { nome: "", xp: 0, fases: {} };
}

// ---------- inventário ----------

let CATALOGO = { consumiveis: [], cosmeticos: [], trofeus: [], baus_das_fases: {}, moedas_iniciais: 50 };
// trilhas de domínio, regiões do Reino e quadro de missões (conteudo/trilhas, regioes e missoes.json)
let JORNADA = { trilhas: { trilhas: {}, ranks: [{ nome: "Novato", pontos: 0 }], golpe_a_partir_de: 2, bonus_por_rank: 25 }, regioes: {}, missoes: { missoes: [], preco_troca: 10 }, magias: { mana: { base: 3, por_niveis: 4, maxima: 8, por_acerto: 1 }, magias: [] }, habilidades: { ramos: [], preco_reiniciar: 50 }, classes: [], principais: [], caminho: { nivel_escolha: 4, degraus_das_magias: [2, 3, 5], degrau_da_passiva: 4 } };

// ---------- o jogador no servidor ----------

// ---------- os saves: até 3 personagens por navegador ----------
// Cada save é um jogador do servidor; o navegador guarda a lista de ids e qual está aberto.

const CHAVE_SAVES = "academia-saves";
const MAXIMO_SAVES = 3;

function listaSaves() {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE_SAVES));
    if (Array.isArray(lista)) return lista;
  } catch {
    // lista corrompida ou sem localStorage: recomeça a partir do save aberto
  }
  const aberto = localStorage.getItem(CHAVE_JOGADOR);
  return aberto ? [aberto] : [];
}

function guardarSaves(lista) {
  try {
    localStorage.setItem(CHAVE_SAVES, JSON.stringify(lista.slice(0, MAXIMO_SAVES)));
  } catch {
    // sem localStorage: os saves duram só esta visita
  }
}

function abrirSave(id, novo) {
  jogadorId = id;
  localStorage.setItem(CHAVE_JOGADOR, id);
  progresso = novo;
  // o dragãozinho era grátis e virou o Dragão da Academia, exclusivo: quem o usava sem ter conquistado
  // passa a andar com a raposa (que agora é grátis)
  if (progresso.avatar?.familiar === "dragao" && Array.isArray(progresso.cosmeticos) && !possuiCosmetico("dragao-academia")) {
    progresso.avatar = { ...progresso.avatar, familiar: "raposa", corFamiliar: undefined };
    delete progresso.avatar.corFamiliar;
    setTimeout(() => salvarProgresso(), 0);
  }
  salvarLocal();
  aplicarTema();
  atualizarStatus();
  // o que o servidor calcula na hora (mana recarregada, mana máxima...) chega logo depois
  api(`/api/jogador/${id}`, undefined, "GET").then((r) => id === jogadorId && r.estado && aplicarEstado(r.estado)).catch(() => {});
}

// Quem jogava antes dos saves (progresso só no navegador, sem id no servidor) vira o primeiro save.
async function migrarSaveAntigo() {
  if (listaSaves().length) return;
  const salvo = carregarProgresso();
  if (!salvo.nome) return;
  const r = await api("/api/jogador", { progresso: salvo });
  guardarSaves([r.id]);
  localStorage.setItem(CHAVE_JOGADOR, r.id);
}

// veterano: o save de um aventureiro que já existe neste navegador (com nome e trilha). Quem já jogou não
// vê de novo o prólogo, a conversa longa do Zetsu, a apresentação da classe e o teste de aptidão: só dá o
// nome, cria o visual e entra no jogo, com a mesma trilha (os interesses) do aventureiro que já tinha.
async function novoSave(veterano = null) {
  const r = await api("/api/jogador", { progresso: null });
  guardarSaves([...listaSaves(), r.id]);
  abrirSave(r.id, r.progresso);
  // cada save tem o próprio relógio do Reino: a aventura nova sempre começa às 6h da manhã
  progresso.inicioDoDia = Date.now();
  if (veterano?.trilha) {
    progresso.veterano = true;
    progresso.viuPrologo = true;
    progresso.viuIntro = true;
    progresso.trilha = structuredClone(veterano.trilha);
    // as cenas da história que o outro aventureiro já viu também não repetem (as novas continuam aparecendo)
    progresso.cenasVistas = [...(veterano.cenasVistas || [])];
  }
  salvarProgresso();
}

// Abre o save escolhido: a história na primeira vez, depois o próximo passo que falta.
function comecarSave() {
  const seguir = () => (progresso.nome ? proximoPasso() : telaBoasVindas());
  if (!progresso.viuPrologo) {
    telaPrologo(() => {
      progresso.viuPrologo = true;
      salvarProgresso();
      seguir();
    }, progresso.avatar || {});
  } else seguir();
}

// o título do herói de um save (o degrau do caminho da classe, que evolui com ele)
function rotuloDaClasse(p) {
  return principalDoHeroi(p) ? seloDoTitulo(p) : `<span class="selo-titulo comum">🌱 Ainda sem classe</span>`;
}

// multi: a escolha de quem entra no Salão do multijogador (o "Jogar" vira "Entrar no Salão")
async function telaSaves({ multi = false } = {}) {
  if (typeof deixarOSalao === "function") deixarOSalao();
  Som.musica("abertura");
  fecharMochila?.();
  if (typeof fecharCenasEsquecidas === "function") fecharCenasEsquecidas();
  document.body.classList.remove("modo-mundo");
  window.scrollTo(0, 0);
  const ids = listaSaves();
  const aberto = localStorage.getItem(CHAVE_JOGADOR);
  const copiaLocal = carregarProgresso();
  const saves = (await Promise.all(ids.map(async (id) => {
    try {
      return { id, p: (await api(`/api/jogador/${id}`)).progresso };
    } catch {
      // o servidor perdeu este save (banco apagado ou limpo): se o navegador ainda tem a cópia dele, recria
      if (id !== aberto || !copiaLocal.nome) return null;
      const r = await api("/api/jogador", { progresso: copiaLocal });
      localStorage.setItem(CHAVE_JOGADOR, r.id);
      return { id: r.id, p: r.progresso };
    }
  }))).filter(Boolean);
  guardarSaves(saves.map((s) => s.id)); // saves que o servidor não conhece mais saem da lista
  const vagas = MAXIMO_SAVES - saves.length;
  // a escolha do aventureiro no estilo da tela inicial: a mesma cena ao fundo, o logo dourado e as cartas
  // com moldura de ouro, cada herói num pedestal (animado com os efeitos dos itens dele)
  const secao = criar(`
    <section class="tela-saves">
      <canvas class="pixel cena-titulo"></canvas>
      <div class="vinheta-titulo"></div>
      <div class="conteudo-saves">
        <header class="topo-saves">
          <button class="botao-voltar-titulo" type="button" data-voltar-titulo>◂ Menu inicial</button>
          <div class="logo-saves">
            <h1 data-texto="RPG IA">RPG IA</h1>
            <div class="faixa-logo"><span>${multi ? "Quem entra no Salão?" : "Escolhe teu aventureiro"}</span></div>
          </div>
        </header>
        <div class="slots-save">
          ${saves.map((s, i) => `
            <div class="slot-save carta-aventureiro ${s.id === jogadorId ? "aberto" : ""}" style="--i:${i}">
              <small class="numero-save">✦ Save ${i + 1} ✦</small>
              <div class="pedestal-save">
                ${s.p.avatar ? `<canvas class="pixel heroi-save" width="64" height="64" data-save="${i}"></canvas>` : '<span class="sem-avatar">❔</span>'}
              </div>
              <strong class="nome-save">${escapar(s.p.nome || "Sem nome ainda")}</strong>
              <small class="classe-save">${rotuloDaClasse(s.p)}</small>
              <div class="selo-nivel">Nível ${nivelDe(s.p.xp || 0)}</div>
              <ul class="dados-save">
                <li><span>🪙</span>${s.p.moedas ?? 0}</li>
                <li><span>👑</span>${(s.p.chefesDerrotados || []).length} chefões</li>
                <li><span>📜</span>${(s.p.quests?.concluidas || []).length} quests</li>
              </ul>
              <div class="acoes-save">
                <button class="botao botao-jogar" type="button" data-entrar="${s.id}">${multi ? (s.p.nome && s.p.avatar ? "🛡️ Entrar no Salão" : "🔒 Sem herói ainda") : "⚔ Jogar"}</button>
                <button class="botao-apagar" type="button" data-apagar="${s.id}" title="Apagar este save">🗑️</button>
              </div>
            </div>`).join("")}
          ${Array.from({ length: vagas }, (_, i) => `
            <button class="slot-save vazio carta-aventureiro" type="button" data-novo style="--i:${saves.length + i}">
              <small class="numero-save">✦ Save ${saves.length + i + 1} ✦</small>
              <span class="portal-novo"><i></i><b>＋</b></span>
              <strong class="nome-save">Novo aventureiro</strong>
              <small>Cria um herói do zero: vocação, visual e tudo.</small>
            </button>`).join("")}
        </div>
        <p class="legenda-saves">O personagem é criado uma vez só. Para mudar o visual depois, usa o espelho do Mercado; para recomeçar do zero, apaga o save.</p>
      </div>
    </section>`);
  secao.querySelector("[data-voltar-titulo]").addEventListener("click", () => voltarAoTitulo());
  // os heróis nos pedestais, respirando e com o brilho dos itens raros
  let ultimoDesenhoSaves = 0;
  const desenharHeroisDosSaves = (agora) => {
    if (!secao.isConnected) return;
    // 30 quadros por segundo bastam (e nada com a aba escondida)
    if (document.hidden || agora - ultimoDesenhoSaves < 32) {
      requestAnimationFrame(desenharHeroisDosSaves);
      return;
    }
    ultimoDesenhoSaves = agora;
    const t = agora / 1000;
    secao.querySelectorAll("canvas[data-save]").forEach((c) => {
      const escolhas = saves[Number(c.dataset.save)].p.avatar;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, 64, 64);
      const sprite = heroiParado(escolhas);
      // os pés ficam no meio do disco do pedestal (y 55 do desenho), e não na beirada da frente
      ctx.drawImage(sprite, 16, 55 - PE_HEROI - (Math.floor(t * 1.4) % 2));
      desenharEfeitosHeroi(ctx, escolhas, t, 16, 55 - PE_HEROI, "baixo");
    });
    requestAnimationFrame(desenharHeroisDosSaves);
  };
  requestAnimationFrame(desenharHeroisDosSaves);
  // Jogar: a carta do save cresce e brilha, o herói dá um pulo, as outras apagam, caem estrelas e a tela
  // se fecha num círculo com o nome do aventureiro antes de entrar no jogo
  secao.querySelectorAll("[data-entrar]").forEach((b) => b.addEventListener("click", async () => {
    const save = saves.find((s) => s.id === b.dataset.entrar);
    if (secao.classList.contains("escolhendo")) return;
    // no Multijogador, um save sem herói pronto não entra no Salão: avisa e só cria se o jogador quiser
    if (multi && !(save.p.nome && save.p.avatar) && (await avisoSemHeroi()) !== "solo") return;
    secao.classList.add("escolhendo");
    b.closest(".slot-save").classList.add("entrando");
    Som.efeito("evolucao");
    chuvaDeEstrelas(30);
    // no Multijogador, quem já tem herói vai direto para o Salão
    const paraOSalao = multi && Boolean(save.p.nome && save.p.avatar);
    setTimeout(() => {
      transicaoPixel(`${paraOSalao ? "🛡️" : "⚔️"} ${save.p.nome || "Nova aventura"}`, "#120d2e", () => {
        tela.replaceChildren(); // a tela de saves sai (senão tapa o prólogo de um save que ainda não começou)
        abrirSave(save.id, save.p);
        if (paraOSalao) telaSalao();
        else comecarSave();
      }, {
        forma: "circulo", duracao: 520, espera: 420,
        carregar: paraOSalao
          ? { tema: "academia", titulo: "Salão de Elyndor", sobretitulo: "Abrindo os portões do castelo", icone: "🛡️", avatar: save.p.avatar, minimo: 1600 }
          : { tema: save.p.local === "reino" ? "reino" : "academia", titulo: save.p.nome || "Nova aventura", sobretitulo: "A aventura continua", icone: "⚔️", avatar: save.p.avatar, minimo: 2000 },
      });
    }, 650);
  }));
  // Novo aventureiro: a carta vira um portal, a tela fecha e o jogo começa do zero (prólogo e criação).
  // A tela de saves sai antes: ela fica por cima de tudo e tapava o prólogo (o save era criado sem
  // ninguém ver nada).
  secao.querySelectorAll("[data-novo]").forEach((b) => b.addEventListener("click", () => {
    if (secao.classList.contains("escolhendo")) return;
    secao.classList.add("escolhendo");
    b.classList.add("entrando");
    Som.efeito("evolucao");
    chuvaDeEstrelas(30);
    // já tem aventureiro com trilha aqui? o novo pula a história e a aptidão (herda a trilha do mais avançado)
    const veterano = saves.filter((s) => s.p.nome && s.p.trilha).sort((a, b) => (b.p.xp || 0) - (a.p.xp || 0))[0]?.p || null;
    setTimeout(() => transicaoPixel("✨ Uma nova lenda começa...", "#120d2e", async () => {
      tela.replaceChildren();
      await novoSave(veterano);
      comecarSave();
    }, { forma: "circulo", duracao: 520, espera: 700 }), 500);
  }));
  secao.querySelectorAll("[data-apagar]").forEach((b) => b.addEventListener("click", async () => {
    const save = saves.find((s) => s.id === b.dataset.apagar);
    const apagar = await confirmarRPG({
      titulo: `Apagar ${save.p.nome || "este aventureiro"}?`, icone: "💀", perigo: true,
      retrato: save.p.avatar ? heroiParado(save.p.avatar).toDataURL() : null,
      texto: `**Nível ${nivelDe(save.p.xp || 0)}**, moedas, itens, quests e tudo mais **somem para sempre**. Essa magia não tem volta.`,
      confirmar: "🗑️ Apagar para sempre", cancelar: "Manter o herói",
    });
    if (!apagar) return;
    await api(`/api/jogador/${save.id}`, {}, "DELETE");
    guardarSaves(listaSaves().filter((id) => id !== save.id));
    if (save.id === jogadorId) {
      jogadorId = null;
      localStorage.removeItem(CHAVE_JOGADOR);
      progresso = progressoNovo();
      salvarLocal();
    }
    telaSaves();
  }));
  tela.replaceChildren(secao);
  criarCenaTitulo(secao.querySelector(".cena-titulo"), null, { comHerois: false });
}

// Uma confirmação no estilo do jogo (no lugar da caixinha do navegador): janela de pedra com moldura de
// ouro, ícone, retrato opcional e dois botões de placa. Devolve uma promessa com true (confirmou) ou false.
// perigo: o botão de confirmar fica vermelho e a janela treme ao abrir.
function confirmarRPG({ titulo, texto, icone = "⚠️", retrato = null, confirmar = "Confirmar", cancelar = "Cancelar", perigo = false }) {
  return new Promise((resolver) => {
    const camada = criar(`
      <div class="confirmacao-rpg ${perigo ? "perigo" : ""}" role="dialog" aria-modal="true">
        <div class="janela-confirmacao">
          <span class="icone-confirmacao">${icone}</span>
          ${retrato ? `<img class="pixel retrato-confirmacao" src="${retrato}" alt="">` : ""}
          <h2>${escapar(titulo)}</h2>
          <p>${formatar(texto)}</p>
          <div class="botoes-confirmacao">
            <button type="button" class="placa-titulo placa-cancelar" data-nao><span class="gema-placa"></span><span class="texto-placa"><b>${escapar(cancelar)}</b></span></button>
            <button type="button" class="placa-titulo placa-confirmar" data-sim><span class="gema-placa"></span><span class="texto-placa"><b>${escapar(confirmar)}</b></span></button>
          </div>
        </div>
      </div>`);
    const fechar = (resposta) => {
      window.removeEventListener("keydown", teclas, true);
      camada.classList.add("saindo");
      setTimeout(() => camada.remove(), 220);
      resolver(resposta);
    };
    const teclas = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        fechar(false);
      }
    };
    camada.querySelector("[data-nao]").addEventListener("click", () => fechar(false));
    camada.querySelector("[data-sim]").addEventListener("click", () => fechar(true));
    camada.addEventListener("click", (e) => { if (e.target === camada) fechar(false); });
    window.addEventListener("keydown", teclas, true);
    document.body.append(camada);
    Som.efeito(perigo ? "erro" : "passar");
    camada.querySelector("[data-nao]").focus();
  });
}

// Volta para a tela inicial; "Um Jogador" leva aos saves (ou cria o primeiro, na primeira visita).
// Saída do jogo com despedida: a tela escurece, o herói acena num círculo de luz com "Jogo salvo" e
// "Até logo", e só depois a tela se fecha num círculo de pixels; a próxima tela é montada por baixo,
// já coberta, para não aparecer se arrumando na frente do jogador.
function despedirSe(destino) {
  if (document.querySelector(".despedida")) return;
  const nome = progresso.nome || "aventureiro";
  const camada = criar(`
    <div class="despedida">
      <div class="palco-despedida">
        <span class="luz-despedida"></span>
        <img class="pixel heroi-despedida" src="${heroiParado(progresso.avatar || AVATAR_PADRAO).toDataURL()}" alt="">
        <span class="aceno-despedida">👋</span>
      </div>
      <p class="salvo-despedida">💾 Jogo salvo</p>
      <h2>Até logo, ${escapar(nome)}!</h2>
      <small>O reino guarda teu lugar até tu voltares.</small>
    </div>`);
  document.body.append(camada);
  Som.efeito("passar");
  setTimeout(() => transicaoPixel("✨ Até a próxima aventura", "#0b0818", () => {
    camada.remove();
    tela.replaceChildren();
    destino();
  }, { forma: "circulo", duracao: 560, espera: 600 }), 1500);
}

function voltarAoTitulo() {
  if (typeof deixarOSalao === "function") deixarOSalao();
  fecharMochila?.();
  document.getElementById("menu-pausa")?.close?.();
  telaTitulo(async () => {
    if (listaSaves().length) return telaSaves();
    await novoSave();
    comecarSave();
  }, typeof telaSalao === "function" ? () => telaSaves({ multi: true }) : null, async () => {
    // o Multijogador só abre para quem já tem um herói pronto (com nome e visual) em algum save
    if (await temHeroiPronto()) return true;
    return avisoSemHeroi();
  });
}

// algum dos saves deste navegador tem um herói pronto (nome e visual) para o Salão?
async function temHeroiPronto() {
  const prontos = await Promise.all(listaSaves().map(async (id) => {
    try {
      const p = (await api(`/api/jogador/${id}`)).progresso;
      return Boolean(p?.nome && p?.avatar);
    } catch {
      return false;
    }
  }));
  return prontos.some(Boolean);
}

// a mensagem de quem tenta entrar no Multijogador sem herói: "solo" se ele quiser ir criar agora
async function avisoSemHeroi() {
  const criar = await confirmarRPG({
    titulo: "Primeiro, teu herói!", icone: "🛡️", confirmar: "⚔ Criar meu herói", cancelar: "Voltar",
    texto: "O Salão de Elyndor é para aventureiros que já existem. Cria teu herói no modo Um Jogador (nome, classe e visual) e depois volta ao Multijogador, aqui no menu inicial.",
  });
  return criar ? "solo" : false;
}

// Pede uma ação ao servidor (comprar, descansar, responder...) e aplica o estado que ele devolve.
async function acaoJogador(caminho, dados = {}) {
  const r = await api(`/api/jogador/${jogadorId}/${caminho}`, dados);
  if (r.estado) aplicarEstado(r.estado);
  return r;
}

// o currículo da classe que o servidor calcula (skills do caminho, foco, estilo e Grimório de Erros)
let curriculoServidor = null;

function aplicarEstado(estado) {
  const { status, curriculo, ...campos } = estado;
  if (status) statusServidor = status;
  if (curriculo !== undefined) {
    // a prova do degrau acabou de abrir (a skill foi dominada): o mestre avisa
    const podiaAntes = curriculoServidor?.prova?.pode;
    curriculoServidor = curriculo;
    if (curriculoServidor && podiaAntes === false && curriculo?.prova?.pode) {
      setTimeout(() => avisoFlutuante("📜", `${curriculo.prova.degrau === 1 ? "Prova do Aprendiz" : `Prova do Degrau ${curriculo.prova.degrau}`} liberada!`,
        "Tu dominaste a skill. Abre o Livro do Herói (K), aba Ofício, e encara a prova."), 1200);
    }
  }
  const patentesAntes = patentes();
  const prontasAntes = new Set(missoesAtivas().filter((m) => m.pronta).map((m) => m.id));
  const nivelAntes = nivelDe(progresso.xp || 0);
  const pontosAntes = pontosHabilidade();
  const degrauAntes = degrauDaClasse();
  const principalAntes = progresso.classe?.principal;
  const escolhaAntes = podeEscolherSubclasse();
  const moedasAntes = progresso.moedas ?? 0;
  const questsAntes = progresso.quests?.ativas ? structuredClone(progresso.quests.ativas) : null;
  Object.assign(progresso, campos);
  // um objetivo de quest andou: aviso no canto e o rastreador atualizado
  if (campos.quests && questsAntes && JORNADA?.historia) avisarProgressoQuests(questsAntes);
  if ((progresso.moedas ?? 0) > moedasAntes) Som.efeito("moeda");
  else if ((progresso.moedas ?? 0) < moedasAntes) Som.efeito("compra");
  if (progresso.classe?.principal !== principalAntes) aplicarTema();
  salvarLocal();
  atualizarStatus();
  const degrau = degrauDaClasse();
  if (degrau > degrauAntes && degrauAntes > 0) {
    const classe = classeDoHeroi();
    const posicaoMagia = JORNADA.caminho.degraus_das_magias.indexOf(degrau);
    const magia = classe && posicaoMagia >= 0 ? classe.magias[posicaoMagia] : null;
    const passiva = classe && degrau === JORNADA.caminho.degrau_da_passiva ? classe.passiva : null;
    const novidade = magia ? `Magia de classe nova: ${magia.icone} ${magia.nome}. Vê na Árvore Arcana (tecla K).`
      : passiva ? `Passiva nova: ${passiva.icone} ${passiva.nome}. ${passiva.frase}` : "Teu caminho de classe avançou.";
    cerimoniaDoTitulo(novidade);
  }
  if (podeEscolherSubclasse() && !escolhaAntes) {
    avisoFlutuante("🌟", "Hora de escolher tua subclasse!", "Abre a Árvore Arcana (tecla K) e escolhe teu caminho. A escolha é para sempre.");
  }
  if (pontosHabilidade() > pontosAntes) {
    avisoFlutuante("🌳", "Ponto de habilidade!", `Tens ${pontosHabilidade()} para gastar na árvore de habilidades (tecla K).`);
  }
  const nivel = nivelDe(progresso.xp || 0);
  JORNADA.magias.magias.filter((m) => m.nivel > nivelAntes && m.nivel <= nivel).forEach((m) => {
    const { grimorio } = temaDaClasse();
    avisoFlutuante(m.icone, `Técnica nova: ${m.nome}`, `${m.descricao} Está no teu ${grimorio.nome.toLowerCase()} (mochila › ${grimorio.icone}).`);
  });
  // o servidor decide; aqui só se comemora o que mudou
  Object.entries(patentes()).forEach(([trilha, posicao]) => {
    if (posicao <= (patentesAntes[trilha] ?? 0)) return;
    const t = JORNADA.trilhas.trilhas[trilha];
    const golpe = posicao === JORNADA.trilhas.golpe_a_partir_de ? " Agora teus acertos dessa trilha são golpes certeiros!" : "";
    avisoFlutuante(t.icone, `${t.nome}: ${JORNADA.trilhas.ranks[posicao].nome}!`, `Nova patente de domínio. +${JORNADA.trilhas.bonus_por_rank * posicao} 🪙.${golpe}`);
  });
  missoesAtivas().filter((m) => m.pronta && !prontasAntes.has(m.id)).forEach((m) => {
    avisoFlutuante("📜", `Missão cumprida: ${m.titulo}`, "Abre o diário de missões (tecla J) para resgatar a recompensa.");
  });
}

// ---------- árvore de habilidades e caminho da classe ----------

// aprendida na árvore ou dada pela passiva da subclasse (mesma regra do servidor)
function temHabilidade(id) {
  if ((progresso.habilidades || []).includes(id)) return true;
  const classe = classeDoHeroi();
  return Boolean(classe) && classe.passiva.habilidade === id && degrauDaClasse() >= JORNADA.caminho.degrau_da_passiva;
}

function todasHabilidades() {
  return [...JORNADA.habilidades.ramos.flatMap((r) => r.habilidades), JORNADA.habilidades.lenda].filter(Boolean);
}

// mesma conta do servidor (habilidades.py): 1 ponto por nível acima do 1 e 1 por chefão vencido
function pontosHabilidade() {
  const custos = Object.fromEntries(todasHabilidades().map((h) => [h.id, h.custo]));
  const gastos = (progresso.habilidades || []).reduce((soma, id) => soma + (custos[id] || 0), 0);
  return nivelDe(progresso.xp || 0) - 1 + (progresso.chefesDerrotados || []).length - gastos;
}

// A classe principal (mago, guerreiro ou arqueiro), escolhida ao criar o personagem.
function principalDoHeroi(p = progresso) {
  return (JORNADA.principais || []).find((x) => x.id === p.classe?.principal) || null;
}

// A subclasse (null enquanto o herói ainda é iniciante).
function classeDoHeroi(p = progresso) {
  const principal = principalDoHeroi(p);
  const classe = (JORNADA.classes || []).find((c) => c.id === p.classe?.id);
  return principal && classe?.principal === principal.id ? classe : null;
}

// Quantos degraus do caminho o herói subiu (mesma regra do servidor): o 1 é ser iniciante; do 2 em
// diante é preciso ter a subclasse, nível, domínio na trilha dela e chefões vencidos.
function degrauDaClasse(p = progresso) {
  if (!principalDoHeroi(p)) return 0;
  const classe = classeDoHeroi(p);
  if (!classe) return 1;
  const nivel = nivelDe(p.xp || 0);
  const patente = posicaoPatente((p.dominio || {})[classe.trilha] || 0);
  const chefes = (p.chefesDerrotados || []).length;
  const provas = new Set(p.provas || []);
  let degrau = 1;
  for (const e of classe.evolucoes) {
    if (nivel < e.nivel || patente < (e.dominio || 0) || chefes < (e.chefes || 0)) break;
    // do degrau 2 em diante cada subida cobra a Prova do Degrau (a do 1 foi cobrada ao escolher a subclasse)
    if (degrau > 1 && !provas.has(degrau)) break;
    degrau += 1;
  }
  return degrau;
}

// Os degraus do caminho: o iniciante da classe principal e as evoluções da subclasse.
function degrausDoCaminho(p = progresso) {
  const principal = principalDoHeroi(p);
  if (!principal) return [];
  const inicio = { titulo: principal.iniciante.titulo, frase: principal.iniciante.frase, nivel: 1 };
  const classe = classeDoHeroi(p);
  return classe ? [inicio, ...classe.evolucoes] : [inicio, { titulo: "Subclasse à tua escolha", nivel: JORNADA.caminho.nivel_escolha, escolha: true }];
}

function caminhoDaClasse(p = progresso) {
  const degrau = degrauDaClasse(p);
  return degrau ? { ...degrausDoCaminho(p)[degrau - 1], degrau } : null;
}

// Ícone, título e cor que representam o herói: a subclasse, ou a classe principal enquanto é iniciante.
// ultimo: chegou ao último degrau do caminho (é o que abre Umbraterra).
function identidadeDaClasse(p = progresso) {
  const classe = classeDoHeroi(p) || principalDoHeroi(p);
  if (!classe) return { icone: "🌱", titulo: "Viajante", cor: "#a98bff", degrau: 0, ultimo: false };
  const caminho = caminhoDaClasse(p);
  return { icone: classe.icone, titulo: caminho.titulo, cor: classe.cor, degrau: caminho.degrau, ultimo: Boolean(classeDoHeroi(p)) && caminho.degrau === degrausDoCaminho(p).length };
}

// O título do herói num selo que fica mais raro a cada degrau do caminho (cinza, verde, azul, roxo e,
// no último, ouro brilhando). Aparece no HUD, nas cartas dos saves e em cima do herói no mapa.
const RARIDADE_DO_DEGRAU = ["comum", "comum", "incomum", "raro", "epico", "lendario"];
function seloDoTitulo(p = progresso) {
  const id = identidadeDaClasse(p);
  return `<span class="selo-titulo ${RARIDADE_DO_DEGRAU[id.degrau] || "comum"}">${id.icone} ${escapar(id.titulo)}</span>`;
}

function podeEscolherSubclasse() {
  return Boolean(principalDoHeroi()) && !classeDoHeroi() && nivelDe(progresso.xp || 0) >= JORNADA.caminho.nivel_escolha
    && (progresso.provas || []).includes(1);
}

function auraDoHeroi() {
  return principalDoHeroi() ? { rgb: hexParaRgb(identidadeDaClasse().cor).join(", "), degrau: degrauDaClasse() } : null;
}

function requisitoDoDegrau(e, classe) {
  // o primeiro degrau (iniciante) é de graça; os outros cobram a prova do degrau de baixo
  const partes = e.nivel > 1 ? [`nível ${e.nivel}`, "Prova do Degrau"] : [`nível ${e.nivel}`];
  if (e.escolha) partes.push("escolhe tua subclasse");
  if (e.dominio) partes.push(`${JORNADA.trilhas.ranks[e.dominio].nome} em ${JORNADA.trilhas.trilhas[classe.trilha].nome}`);
  if (e.chefes) partes.push(`${e.chefes} chefões vencidos`);
  return partes.join(" · ");
}

// Cada classe conta a mesma regra do seu jeito: o grimório do mago é o arsenal do guerreiro e a aljava
// do arqueiro; o domínio e as missões também mudam de nome. aplicarTema troca os textos no JORNADA.
let JORNADA_BASE = null;
const TEMA_PADRAO = {
  grimorio: { nome: "Grimório", icone: "📖", recurso: "Mana", recurso_icone: "💧", magias: {} },
  dominio: { nome: "Domínio", ranks: [], trilhas: {} }, missoes: { nome: "Missões", textos: {} },
};

function temaDaClasse() {
  const kit = progresso.classe?.principal || progresso.avatar?.kit || "mago";
  return (JORNADA.principais || []).find((p) => p.id === kit)?.tema || TEMA_PADRAO;
}

function aplicarTema() {
  JORNADA_BASE ||= structuredClone({ magias: JORNADA.magias.magias, trilhas: JORNADA.trilhas.trilhas, ranks: JORNADA.trilhas.ranks, missoes: JORNADA.missoes.missoes });
  const tema = temaDaClasse();
  JORNADA.magias.magias = JORNADA_BASE.magias.map((m) => ({ ...m, ...(tema.grimorio.magias[m.id] || {}) }));
  // "assunto" guarda o nome de verdade da trilha: o tema dá o apelido, mas o conteúdo continua sendo aquele
  JORNADA.trilhas.trilhas = Object.fromEntries(Object.entries(JORNADA_BASE.trilhas).map(([id, t]) => [id, { ...t, ...(tema.dominio.trilhas[id] || {}), assunto: t.nome }]));
  JORNADA.trilhas.ranks = JORNADA_BASE.ranks.map((r, i) => ({ ...r, nome: tema.dominio.ranks[i] || r.nome }));
  JORNADA.missoes.missoes = JORNADA_BASE.missoes.map((m) => ({ ...m, ...(tema.missoes.textos[m.id] || {}) }));
}

const RARIDADES = { comum: "Comum", epica: "Épica", lendaria: "Lendária" };

// A Árvore Arcana: um livro de RPG. À esquerda, a ficha do herói; à direita, três abas:
// o Caminho (títulos e magias da classe), os Talentos (os ramos de habilidades com a lendária
// no topo) e os Poderes (os 3 que vão para a barra da batalha). Modal de tamanho fixo.
let habilidadeEscolhida = null;
let talentoRecemAprendido = null; // o medalhão que acabou de acender (ganha o clarão depois de redesenhar)
let abaArvore = "caminho";
let vagaEscolhida = 0;

function abrirArvore(aba) {
  if (!progresso.nome) return;
  if (aba) abaArvore = aba;
  let painel = document.querySelector(".arvore-epica");
  if (!painel) {
    painel = document.createElement("dialog");
    painel.className = "arvore-epica";
    painel.setAttribute("aria-label", "Árvore Arcana");
    document.body.append(painel);
    painel.addEventListener("click", (e) => { if (e.target === painel) painel.close(); });
    // as recargas correm em tempo real enquanto o livro está aberto
    setInterval(() => {
      if (!painel.open) return;
      painel.querySelectorAll("[data-fim]").forEach((el) => {
        const falta = Math.round(Number(el.dataset.fim) - Date.now() / 1000);
        el.textContent = falta > 0 ? `⏳ volta em ${tempoCurto(falta)}` : "✓ Pronta";
        el.classList.toggle("pronta", falta <= 0);
      });
    }, 1000);
  }
  const livres = pontosHabilidade();
  const principal = principalDoHeroi();
  const classe = classeDoHeroi();
  const identidade = identidadeDaClasse();
  const degrau = degrauDaClasse();
  const atual = caminhoDaClasse();
  const degraus = degrausDoCaminho();
  const { nivel_escolha: nivelEscolha, degraus_das_magias: degrausMagias, degrau_da_passiva: degrauPassiva } = JORNADA.caminho;
  const podeEscolher = podeEscolherSubclasse();
  const { ramos, lenda, preco_reiniciar: preco } = JORNADA.habilidades;
  const nivel = nivelDe(progresso.xp || 0);
  const mana = manaAgora();
  const recurso = temaDaClasse().grimorio;
  const equipados = poderesEquipados();
  const estadoDe = (h) => {
    if (temHabilidade(h.id)) return "aprendida";
    if (h.id === lenda?.id) return ramos.filter((r) => temHabilidade(r.habilidades.at(-1).id)).length >= lenda.requer_finais ? "aberta" : "trancada";
    const ramo = ramos.find((r) => r.habilidades.includes(h));
    const i = ramo.habilidades.indexOf(h);
    return i === 0 || temHabilidade(ramo.habilidades[i - 1].id) ? "aberta" : "trancada";
  };
  const rolagem = painel.dataset.aba === abaArvore ? painel.querySelector(".arvore-corpo")?.scrollTop || 0 : 0; // redesenhar não volta ao topo
  const medalhao = (h, cor) => `
    <div class="no-epico ${estadoDe(h)} ${habilidadeEscolhida === h.id ? "escolhido" : ""}" style="--cor-ramo:${cor}">
      <button type="button" class="medalhao" data-no="${h.id}" title="${escapar(h.nome)}">
        <span>${estadoDe(h) === "trancada" ? "🔒" : h.icone}</span><i>${h.custo}</i>
      </button>
      <span class="nome-no">${escapar(h.nome)}</span>
    </div>`;
  // o texto da recarga de uma magia de classe: correndo (com data-fim para o relógio) ou pronta
  const textoRecarga = (m) => {
    const falta = recargaRestante(m.id);
    return falta ? `<small class="recarga-poder" data-fim="${progresso.recargas[m.id]}">⏳ volta em ${tempoCurto(falta)}</small>`
      : `<small class="recarga-poder pronta">✓ Pronta · recarga de ${m.recarga_horas}h</small>`;
  };

  const abaCaminho = principal ? `
    <section class="caminho-classe degrau-${degrau}" style="--cor-classe:${identidade.cor}">
      <div class="info-caminho">
        <small>${principal.icone} ${escapar(principal.titulo)}${classe ? ` › ${classe.icone} ${escapar(classe.titulo)}` : ""} · degrau ${degrau} de ${classe ? degraus.length : 1 + 4}</small>
        <h3>${escapar(atual.titulo)}</h3>
        <p class="frase-arvore">“${escapar(atual.frase || principal.lema)}”</p>
        <ol class="degraus">
          ${degraus.map((e, i) => `
            <li class="${i < degrau ? "feito" : i === degrau ? "proximo" : "trancado"}">
              <b>${i < degrau ? "✦" : i + 1}</b><strong>${escapar(e.titulo)}</strong><small>${escapar(requisitoDoDegrau(e, classe))}</small>
            </li>`).join("")}
        </ol>
      </div>
    </section>
    ${classe ? `
      <section class="magias-classe">
        <h4>✨ Poderes de ${escapar(classe.titulo)} <small>uma vez por batalha · depois recarregam em horas de verdade</small></h4>
        <div class="cartas-magia">
          ${classe.magias.map((m, i) => {
            const precisa = degrausMagias[i];
            const liberada = degrau >= precisa;
            return `
              <div class="carta-magia ${m.raridade} ${liberada ? "" : "selada"}">
                <span class="raridade">${RARIDADES[m.raridade]}</span>
                <span class="icone-magia">${liberada ? m.icone : "🔒"}</span>
                <strong>${escapar(m.nome)}</strong>
                <em>“${escapar(m.frase)}”</em>
                <small>${escapar(m.descricao)}</small>
                ${liberada ? textoRecarga(m) : `<small class="libera">Libera no degrau ${precisa}: ${escapar(degraus[precisa - 1].titulo)}</small>`}
              </div>`;
          }).join("")}
          ${(() => {
            const p = classe.passiva;
            const liberada = degrau >= degrauPassiva;
            const efeito = todasHabilidades().find((h) => h.id === p.habilidade);
            return `
              <div class="carta-magia passiva ${liberada ? "" : "selada"}">
                <span class="raridade">Passiva</span>
                <span class="icone-magia">${liberada ? p.icone : "🔒"}</span>
                <strong>${escapar(p.nome)}</strong>
                <em>“${escapar(p.frase)}”</em>
                <small>${escapar(efeito?.descricao || "")} Vale sempre, sem gastar pontos.</small>
                <small class="libera">${liberada ? "Ativa" : `Libera no degrau ${degrauPassiva}: ${escapar(degraus[degrauPassiva - 1].titulo)}`}</small>
              </div>`;
          })()}
        </div>
      </section>` : `
      <section class="escolha-subclasse">
        <h4>🌟 Escolhe tua subclasse <small>${podeEscolher ? "Tu já podes escolher! A escolha é para sempre."
          : `Libera no nível ${nivelEscolha}, com a Prova do Aprendiz aprovada (aba Ofício). Vai conhecendo as opções:`}</small></h4>
        <div class="cartas-subclasse">
          ${JORNADA.classes.filter((s) => s.principal === principal.id).map((s) => `
            <div class="carta-subclasse" style="--cor-classe:${s.cor}">
              <span class="icone-sub">${s.icone}</span>
              <strong>${escapar(s.titulo)}</strong>
              <em>“${escapar(s.lema)}”</em>
              <small>${escapar(s.descricao)}</small>
              <small class="trilha-sub">${JORNADA.trilhas.trilhas[s.trilha].icone} Cresce com ${escapar(JORNADA.trilhas.trilhas[s.trilha].nome)}</small>
              <ul class="poderes-sub">
                ${s.magias.map((m) => `<li><span>${m.icone}</span>${escapar(m.nome)}<i class="${m.raridade}">${RARIDADES[m.raridade]}</i></li>`).join("")}
                <li><span>${s.passiva.icone}</span>${escapar(s.passiva.nome)}<i>Passiva</i></li>
              </ul>
              <button class="botao" type="button" data-subclasse="${s.id}" ${podeEscolher ? "" : "disabled"}>${podeEscolher ? "Escolher"
                : nivel < nivelEscolha ? `🔒 Nível ${nivelEscolha}` : "🔒 Prova do Aprendiz"}</button>
            </div>`).join("")}
        </div>
      </section>`}` : '<p class="legenda-arvore">Cria teu personagem para abrir o caminho da classe.</p>';

  const abaTalentos = `
    <section class="arvore-ramos">
      <h4>🌳 Talentos <small>1 ponto por nível · 1 por chefão · cada ramo sobe até a habilidade final</small></h4>
      ${lenda ? `<div class="topo-lenda">${medalhao(lenda, "#ffd166")}<small>Pede ${lenda.requer_finais} habilidades finais de ramos</small></div>` : ""}
      <div class="ramos-epicos">
        ${ramos.map((ramo) => `
          <div class="ramo-epico ${ramo.habilidades.some((h) => temHabilidade(h.id)) ? "desperto" : ""}" style="--cor-ramo:${ramo.cor}">
            ${(() => {
              // de cima (a habilidade final) para baixo; o galho entre dois medalhões acende quando o de
              // baixo foi aprendido, e a energia sobe por ele quando o de cima já pode ser aprendido
              const lista = ramo.habilidades.slice().reverse();
              return lista.map((h, k) => {
                const baixo = lista[k + 1];
                if (!baixo) return medalhao(h, ramo.cor);
                const aceso = estadoDe(baixo) === "aprendida";
                const fluindo = aceso && estadoDe(h) === "aberta";
                return `${medalhao(h, ramo.cor)}<span class="galho ${aceso ? "aceso" : ""} ${fluindo ? "fluindo" : ""}"></span>`;
              }).join("");
            })()}
            <div class="raiz-ramo"><span>${ramo.icone}</span><strong>${escapar(ramo.nome)}</strong><small>${escapar(ramo.descricao)}</small></div>
          </div>`).join("")}
      </div>
    </section>`;

  // um poder na lista da aba Poderes: o que dá para equipar vira botão; o resto mostra o cadeado
  const cartaPoder = ({ chave, tipo, magia: m, trancado }) => {
    const vaga = equipados.findIndex((p) => p?.chave === chave);
    const meta = trancado ? `<small class="libera">🔒 ${escapar(trancado)}</small>`
      : tipo === "classe" ? textoRecarga(m) : `<small class="custo-poder">${m.custo}${recurso.recurso_icone} de ${escapar(recurso.recurso.toLowerCase())}</small>`;
    return `
      <button type="button" class="poder-carta ${tipo} ${m.raridade || ""} ${vaga >= 0 ? "equipado" : ""} ${trancado ? "selada" : ""}"
        ${trancado ? "disabled" : `data-poder="${chave}"`} title="${escapar(m.descricao)}">
        ${vaga >= 0 ? `<b class="na-vaga">${vaga + 1}</b>` : ""}
        <span class="icone-poder">${trancado ? "🔒" : m.icone}</span>
        <span class="texto-poder"><strong>${escapar(m.nome)}</strong>${tipo === "classe" ? `<i class="${m.raridade}">${RARIDADES[m.raridade]}</i>` : ""}<small>${escapar(m.descricao)}</small>${meta}</span>
      </button>`;
  };
  const poderesDaClasse = (classe?.magias || []).map((m, i) => ({
    chave: `c:${m.id}`, tipo: "classe", magia: m,
    trancado: degrau >= degrausMagias[i] ? "" : `degrau ${degrausMagias[i]}: ${degraus[degrausMagias[i] - 1]?.titulo || ""}`,
  }));
  const poderesDoGrimorio = JORNADA.magias.magias.map((m) => ({
    chave: `g:${m.id}`, tipo: "grimorio", magia: m, trancado: nivel >= (m.nivel || 1) ? "" : `nível ${m.nivel}`,
  }));
  const abaPoderes = `
    <section class="aba-poderes">
      <h4>⚔️ Poderes equipados <small>3 vagas · na batalha, teclas 1, 2 e 3</small></h4>
      <div class="vagas-poder">
        ${equipados.map((p, i) => `
          <div class="vaga-poder ${i === vagaEscolhida ? "escolhida" : ""} ${p ? `${p.tipo} ${p.magia.raridade || ""}` : "vazia"}">
            <button type="button" class="corpo-vaga" data-vaga="${i}" title="${p ? "Clica para tirar e escolher outro" : "Vaga livre: clica num poder abaixo"}">
              <b class="tecla">${i + 1}</b>
              <span class="icone-poder">${p ? p.magia.icone : "＋"}</span>
              <strong>${p ? escapar(p.magia.nome) : "Vaga livre"}</strong>
              <small>${p ? (p.tipo === "classe" ? `${RARIDADES[p.magia.raridade]} · 1× por batalha` : `${p.magia.custo}${recurso.recurso_icone} por uso`) : "clica num poder abaixo"}</small>
            </button>
          </div>`).join("")}
      </div>
      <p class="dica-poderes">Clica numa vaga para liberar e depois no poder novo. Clicar num poder já equipado tira ele.</p>
      ${classe ? `<h4>✨ Magias de ${escapar(classe.titulo)} <small>fortes, mas recarregam em horas de verdade</small></h4>
        <div class="lista-poderes">${poderesDaClasse.map(cartaPoder).join("")}</div>` : ""}
      <h4>${recurso.icone} ${escapar(recurso.nome)} <small>técnicas que gastam ${escapar(recurso.recurso.toLowerCase())} e voltam com acertos</small></h4>
      <div class="lista-poderes">${poderesDoGrimorio.map(cartaPoder).join("")}</div>
    </section>`;

  // o Ofício: o currículo da classe, uma skill por degrau, com a lição, as dicas e quanto falta para dominar
  const cur = curriculoServidor;
  const abaOficio = !cur ? '<p class="legenda-arvore">Escolhe tua classe para abrir o currículo do teu ofício.</p>' : `
    <section class="oficio">
      <div class="oficio-topo">
        <div><small>Foco do teu ofício</small><strong>${escapar(cur.foco)}</strong></div>
        ${cur.estilo?.nome ? `<div class="estilo-classe" title="${escapar(cur.estilo.descricao)}"><small>Jeito de aprender</small><strong>${cur.estilo.icone} ${escapar(cur.estilo.nome)}</strong><em>${escapar(cur.estilo.descricao)}</em></div>` : ""}
      </div>
      ${cartaoDaProva(cur.prova, cur.provaAberta)}
      <ol class="skills-oficio">
        ${cur.skills.map((s) => {
          const estado = !s.liberada ? "trancada" : s.dominada ? "dominada" : s.atual ? "atual" : "estudando";
          const parte = Math.min(1, s.acertos / s.dominar);
          return `
            <li class="skill-oficio ${estado}">
              <span class="degrau-skill">${s.degrau}</span>
              <div class="corpo-skill">
                <header>
                  <span class="icone-skill">${s.liberada ? s.icone : "🔒"}</span>
                  <strong>${escapar(s.nome)}</strong>
                  <i class="estado-skill">${{ trancada: `Degrau ${s.degrau}`, dominada: "✦ Dominada", atual: "Estudando agora", estudando: "Em revisão" }[estado]}</i>
                </header>
                ${s.liberada ? `
                  <p>${escapar(s.resumo)}</p>
                  ${s.dicas?.length ? `<ul class="dicas-skill">${s.dicas.map((d) => `<li>${escapar(d)}</li>`).join("")}</ul>` : ""}
                  <div class="progresso-skill" title="${s.acertos} acertos de ${s.dominar} para dominar"><i style="width:${parte * 100}%"></i><span>${Math.min(s.acertos, s.dominar)} / ${s.dominar} acertos${s.perguntas ? ` · ${s.perguntas} desafios` : ""}</span></div>
                  ${s.fonte ? `<button class="botao botao-fantasma ler-skill" type="button" data-ler="${escapar(s.fonte.livro)}" data-capitulo="${s.fonte.capitulo}">📖 Estudar na biblioteca</button>` : ""}`
                  : `<p class="trancada-skill">Libera ao subir para o degrau ${s.degrau} do caminho. Aí as batalhas começam a cobrar essa skill.</p>`}
              </div>
            </li>`;
        }).join("")}
      </ol>
      <div class="grimorio-erros">
        <span class="icone-grimorio">🔁</span>
        <div>
          <strong>Grimório de Erros</strong>
          <small>${cur.erros.total ? `${cur.erros.total} pergunta(s) que tu erraste vão voltar como ecos${cur.erros.prontos ? ` · <b>${cur.erros.prontos} já pode(m) aparecer</b>` : ""}.` : "Nenhum erro esperando revanche."} Acerta o eco 3 vezes, em dias diferentes, e ele some.</small>
        </div>
        <b class="ecos-vencidos" title="Ecos vencidos">${cur.erros.vencidos}<small>vencidos</small></b>
      </div>
    </section>`;

  painel.dataset.aba = abaArvore;
  painel.innerHTML = `
    <i class="canto-livro c1"></i><i class="canto-livro c2"></i><i class="canto-livro c3"></i><i class="canto-livro c4"></i>
    <header class="arvore-topo">
      <div class="faixa-titulo"><p class="sobretitulo-arvore">✦ Árvore Arcana ✦</p><h2>O Livro do Herói</h2></div>
      <button class="selo-fechar" type="button" data-fechar aria-label="Fechar o livro" title="Fechar (K ou Esc)"><span>✕</span></button>
    </header>
    <div class="livro-arvore">
      <aside class="ficha-arvore" style="--cor-classe:${identidade.cor}">
        <div class="retrato-classe retrato-ficha degrau-${degrau}">
          <div class="runas-orbita"><i>ᚠ</i><i>ᚱ</i><i>ᛟ</i><i>ᛉ</i></div>
          <img class="pixel" src="${heroiParado(progresso.avatar).toDataURL()}" alt="">
          <span class="pedestal"></span>
        </div>
        <strong class="nome-ficha">${escapar(progresso.nome)}</strong>
        <small class="titulo-ficha">${identidade.icone} ${escapar(identidade.titulo)}</small>
        <span class="nivel-ficha">Nível ${nivel}</span>
        <div class="barras-ficha">
          <div class="hud-barra vida" title="Vida"><i style="width:${(vidaAtual() / vidaMaxima()) * 100}%"></i><span>❤ ${vidaAtual()} / ${vidaMaxima()}</span></div>
          <div class="hud-barra mana" title="${escapar(recurso.recurso)}"><i style="width:${(mana.atual / mana.maxima) * 100}%"></i><span>${recurso.recurso_icone} ${mana.atual} / ${mana.maxima}</span></div>
        </div>
        <div class="pontos-arvore ${livres > 0 ? "com-pontos" : ""}"><span>🌳</span><strong>${livres}</strong><small>${livres === 1 ? "ponto livre" : "pontos livres"}</small></div>
        <div class="mini-vagas" title="Poderes equipados: clica num para trocar">
          ${equipados.map((p, i) => `<button type="button" data-vaga="${i}" class="${p ? p.magia.raridade || "grimorio" : "vazia"} ${abaArvore === "poderes" && i === vagaEscolhida ? "escolhida" : ""}" title="${p ? `${escapar(p.magia.nome)}: clica para trocar` : "Vaga livre"}"><b>${i + 1}</b>${p ? p.magia.icone : "＋"}</button>`).join("")}
        </div>
        <ul class="stats-ficha">
          <li><span>🌟</span>Talentos<b>${(progresso.habilidades || []).length}</b></li>
          <li><span>👑</span>Chefões<b>${(progresso.chefesDerrotados || []).length}</b></li>
          <li><span>🔥</span>Sequência<b>${progresso.sequencia || 0}</b></li>
        </ul>
        <div class="ficha-mascote na-arvore">${cartaDoMascote(progresso.avatar?.familiar)}</div>
      </aside>
      <div class="pagina-arvore">
        <nav class="abas-arvore" role="tablist">
          ${[["caminho", "📜", "Caminho"], ["oficio", "📚", "Ofício"], ["talentos", "🌳", "Talentos"], ["poderes", "⚔️", "Poderes"]].map(([id, icone, nome]) => `
            <button type="button" role="tab" class="aba-arvore ${abaArvore === id ? "ativa" : ""}" data-aba="${id}" aria-selected="${abaArvore === id}">
              <span>${icone}</span>${nome}${id === "talentos" && livres > 0 ? `<i class="selo-pontos">${livres}</i>` : ""}
            </button>`).join("")}
        </nav>
        <div class="arvore-corpo aba-${abaArvore}">
          ${abaArvore === "talentos" ? abaTalentos : abaArvore === "poderes" ? abaPoderes : abaArvore === "oficio" ? abaOficio : abaCaminho}
        </div>
      </div>
    </div>
    <footer class="detalhe-arvore" data-detalhe ${abaArvore === "talentos" ? "" : "hidden"}></footer>`;

  painel.querySelector(".arvore-corpo").scrollTop = rolagem;
  painel.querySelector("[data-prova]")?.addEventListener("click", () => {
    painel.close();
    telaProva();
  });
  painel.querySelectorAll("[data-ler]").forEach((b) => b.addEventListener("click", () => {
    painel.close();
    abrirFonte({ tipo: "livro", id: b.dataset.ler, capitulo: Number(b.dataset.capitulo) });
  }));
  painel.querySelectorAll("[data-aba]").forEach((b) => b.addEventListener("click", () => {
    Som.efeito("porta");
    abrirArvore(b.dataset.aba);
  }));
  // Trocar poder em dois cliques: clicar numa vaga (a grande ou a pequena da ficha) tira o poder dela e
  // deixa ela escolhida; clicar num poder equipa na vaga escolhida (ou na primeira livre). Clicar num
  // poder que já está equipado tira ele.
  painel.querySelectorAll("[data-vaga]").forEach((b) => b.addEventListener("click", () => {
    vagaEscolhida = Number(b.dataset.vaga);
    if (poderesEquipados()[vagaEscolhida]) {
      equiparPoder(vagaEscolhida, null);
      Som.efeito("clique");
    }
    abrirArvore("poderes");
  }));
  painel.querySelectorAll("[data-poder]").forEach((b) => b.addEventListener("click", (evento) => {
    const equipados = poderesEquipados();
    const ondeEsta = equipados.findIndex((p) => p?.chave === b.dataset.poder);
    if (ondeEsta >= 0) {
      equiparPoder(ondeEsta, null);
      vagaEscolhida = ondeEsta;
      Som.efeito("clique");
      return abrirArvore();
    }
    const livre = equipados[vagaEscolhida] ? equipados.findIndex((p) => !p) : vagaEscolhida;
    equiparPoder(livre >= 0 ? livre : vagaEscolhida, b.dataset.poder);
    faiscas(evento.clientX, evento.clientY, "#f5c451");
    Som.efeito("moeda");
    // a próxima vaga livre fica escolhida, para equipar em sequência
    const vazia = poderesEquipados().findIndex((p) => !p);
    if (vazia >= 0) vagaEscolhida = vazia;
    abrirArvore();
  }));
  const detalhe = painel.querySelector("[data-detalhe]");
  const desenharDetalhe = () => {
    const h = todasHabilidades().find((x) => x.id === habilidadeEscolhida);
    if (!h) {
      detalhe.innerHTML = `
        <p>Clica num medalhão para ver a habilidade.</p>
        <button class="botao botao-fantasma" type="button" data-reiniciar ${(progresso.habilidades || []).length && progresso.moedas >= preco ? "" : "disabled"}>↺ Reiniciar árvore (🪙 ${preco})</button>`;
    } else {
      const estado = estadoDe(h);
      const motivo = estado === "trancada" ? (h.id === lenda?.id ? `Domina ${lenda.requer_finais} habilidades finais de ramos primeiro.` : "Aprende a habilidade de baixo deste ramo primeiro.") : "";
      detalhe.innerHTML = `
        <span class="icone-detalhe">${h.icone}</span>
        <div>
          <strong>${escapar(h.nome)} <em>${h.custo} 🌳</em></strong>
          <i>“${escapar(h.frase || "")}”</i>
          <small>${escapar(h.descricao)}</small>
        </div>
        ${estado === "aprendida" ? '<span class="tag tag-concluida">Aprendida ✓</span>'
          : estado === "aberta" ? `<button class="botao" type="button" data-aprender="${h.id}" ${livres < h.custo ? "disabled" : ""}>${livres < h.custo ? `Faltam ${h.custo - livres} 🌳` : `Aprender · ${h.custo} 🌳`}</button>`
          : `<small class="motivo">🔒 ${escapar(motivo)}</small>`}`;
    }
    detalhe.querySelector("[data-aprender]")?.addEventListener("click", async (evento) => {
      evento.currentTarget.disabled = true;
      try {
        await acaoJogador(`habilidades/${h.id}/aprender`);
        faiscas(evento.clientX, evento.clientY, "#7dff9a");
        chuvaDeEstrelas(20);
        Som.efeito("evolucao");
        talentoRecemAprendido = h.id;
      } catch (erro) {
        avisoFlutuante("⚠️", "Não deu", erro.message);
      }
      abrirArvore();
      // o medalhão que acabou de acender: clarão, onda dourada e faíscas saindo dele
      const no = talentoRecemAprendido && document.querySelector(`.arvore-epica [data-no="${talentoRecemAprendido}"]`);
      if (no) {
        animar(no.closest(".no-epico"), "despertou");
        const b = no.getBoundingClientRect();
        faiscas(b.left + b.width / 2, b.top + b.height / 2, "#ffd166");
      }
      talentoRecemAprendido = null;
    });
    detalhe.querySelector("[data-reiniciar]")?.addEventListener("click", async () => {
      try {
        await acaoJogador("habilidades/reiniciar");
      } catch (erro) {
        avisoFlutuante("⚠️", "Não deu", erro.message);
      }
      abrirArvore();
    });
  };
  desenharDetalhe();
  painel.querySelectorAll("[data-no]").forEach((b) => b.addEventListener("click", () => {
    habilidadeEscolhida = habilidadeEscolhida === b.dataset.no ? null : b.dataset.no;
    painel.querySelectorAll(".no-epico").forEach((n) => n.classList.toggle("escolhido", n.querySelector("[data-no]").dataset.no === habilidadeEscolhida));
    desenharDetalhe();
  }));
  painel.querySelector("[data-fechar]").addEventListener("click", () => painel.close());
  painel.querySelectorAll("[data-subclasse]").forEach((b) => b.addEventListener("click", async (evento) => {
    const escolhida = JORNADA.classes.find((s) => s.id === b.dataset.subclasse);
    const seguir = await confirmarRPG({
      titulo: `Seguir o caminho de ${escolhida.titulo}?`, icone: escolhida.icone,
      texto: `“${escolhida.lema}” A escolha da subclasse é **para sempre**.`, confirmar: "✨ Seguir este caminho", cancelar: "Pensar mais",
    });
    if (!seguir) return;
    try {
      await acaoJogador("classe/subclasse", { id: escolhida.id });
      faiscas(evento.clientX, evento.clientY, escolhida.cor);
    } catch (erro) {
      avisoFlutuante("⚠️", "Não deu", erro.message);
    }
    abrirArvore();
  }));
  if (!painel.open) painel.showModal();
  // na aba Talentos, a árvore de verdade cresce por trás dos medalhões (depois do layout, para medir)
  if (abaArvore === "talentos") requestAnimationFrame(() => arvoreViva(painel));
}

// ---------- a Árvore Viva (aba Talentos) ----------
// Uma árvore em pixel desenhada por trás dos medalhões: o tronco nasce embaixo, abre em quatro galhos
// grossos (um por ramo) que sobem pelas colunas passando por cada medalhão, e lá no alto os quatro se
// curvam e se encontram na coroa (a habilidade lendária). Cada trecho é madeira escura enquanto ninguém
// aprendeu; quando o medalhão de baixo é aprendido, o trecho acende na cor do ramo (veio de luz no meio
// e brilho em volta), e faíscas de energia sobem por ele. As posições saem do próprio layout (cada
// medalhão é medido), então a árvore acompanha a tela de qualquer tamanho. Desenha em pixels de 3x3.
const PIXEL_ARVORE = 3;
function arvoreViva(painel) {
  const area = painel.querySelector(".arvore-ramos");
  if (!area) return;
  area.querySelector(".tronco-arcano")?.remove();
  const tela = document.createElement("canvas");
  tela.className = "tronco-arcano";
  tela.setAttribute("aria-hidden", "true");
  area.prepend(tela);
  const ctx = tela.getContext("2d");
  let caminhos = [];
  let fundo = null;

  // o centro de um elemento, em pixels da árvore (relativo à área)
  const centroDe = (el, base) => {
    const r = el.getBoundingClientRect();
    return { x: (r.left - base.left + r.width / 2) / PIXEL_ARVORE, y: (r.top - base.top + r.height / 2) / PIXEL_ARVORE };
  };
  // uma curva suave de a até b (sobe reto e depois curva, como galho), em pontos
  const curva = (a, b, dobra = 0.5) => {
    const pontos = [];
    const passos = Math.max(6, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
    for (let i = 0; i <= passos; i++) {
      const t = i / passos;
      // Bézier cúbica: sai na vertical de a e chega na vertical em b
      const c1 = { x: a.x, y: a.y + (b.y - a.y) * dobra };
      const c2 = { x: b.x, y: b.y - (b.y - a.y) * dobra };
      const u = 1 - t;
      pontos.push({
        x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
        y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
      });
    }
    return pontos;
  };

  function medir() {
    const base = area.getBoundingClientRect();
    const W = Math.ceil(area.scrollWidth / PIXEL_ARVORE);
    const H = Math.ceil(area.scrollHeight / PIXEL_ARVORE);
    tela.width = W;
    tela.height = H;
    tela.style.width = `${W * PIXEL_ARVORE}px`;
    tela.style.height = `${H * PIXEL_ARVORE}px`;
    caminhos = [];
    const pe = { x: W / 2, y: H - 2 };
    const lendaNo = area.querySelector(".topo-lenda .no-epico");
    const coroa = lendaNo ? centroDe(lendaNo.querySelector(".medalhao"), base) : { x: W / 2, y: 10 };
    const colunas = [...area.querySelectorAll(".ramo-epico")];
    const forquilha = { x: W / 2, y: H - 14 };
    // o tronco: do pé até a forquilha (sempre aceso de leve se algum ramo já despertou)
    const algumDesperto = colunas.some((c) => c.classList.contains("desperto"));
    caminhos.push({ pontos: curva(pe, forquilha, 0.3), grossura: 7, cor: "#ffd166", aceso: algumDesperto, fluindo: false, tronco: true });
    colunas.forEach((coluna) => {
      const cor = getComputedStyle(coluna).getPropertyValue("--cor-ramo").trim() || "#ffd166";
      const nos = [...coluna.querySelectorAll(".no-epico")]; // de cima para baixo
      const raiz = coluna.querySelector(".raiz-ramo");
      const pontoRaiz = raiz ? centroDe(raiz, base) : { x: forquilha.x, y: forquilha.y - 10 };
      const ultimo = nos.at(-1);
      // o galho grosso: da forquilha até a placa do ramo
      caminhos.push({ pontos: curva(forquilha, pontoRaiz, 0.55), grossura: 5, cor, aceso: coluna.classList.contains("desperto"), fluindo: false });
      // da placa até o primeiro medalhão (o de baixo)
      if (ultimo) {
        caminhos.push({ pontos: curva(pontoRaiz, centroDe(ultimo.querySelector(".medalhao"), base), 0.5), grossura: 4, cor, aceso: ultimo.classList.contains("aprendida"), fluindo: ultimo.classList.contains("aberta") });
      }
      // entre os medalhões, de baixo para cima
      for (let i = nos.length - 1; i > 0; i--) {
        const baixo = nos[i];
        const cima = nos[i - 1];
        const aceso = baixo.classList.contains("aprendida");
        caminhos.push({
          pontos: curva(centroDe(baixo.querySelector(".medalhao"), base), centroDe(cima.querySelector(".medalhao"), base), 0.5),
          grossura: 3, cor, aceso, fluindo: aceso && cima.classList.contains("aberta"),
        });
      }
      // do medalhão do alto até a coroa lendária
      if (nos[0] && lendaNo) {
        const alto = centroDe(nos[0].querySelector(".medalhao"), base);
        caminhos.push({ pontos: curva(alto, coroa, 0.6), grossura: 3, cor, aceso: nos[0].classList.contains("aprendida"), fluindo: false, galhoFino: true });
      }
    });
    desenharFundo(W, H, coroa);
  }

  // A madeira e a luz ficam numa folha pronta; a cada quadro só as faíscas são desenhadas por cima.
  function desenharFundo(W, H, coroa) {
    fundo = document.createElement("canvas");
    fundo.width = W;
    fundo.height = H;
    const f = fundo.getContext("2d");
    f.imageSmoothingEnabled = false;
    const disco = (x, y, r, cor) => {
      f.fillStyle = cor;
      const rr = Math.max(0.5, r);
      f.fillRect(Math.round(x - rr), Math.round(y - rr), Math.max(1, Math.round(rr * 2)), Math.max(1, Math.round(rr * 2)));
    };
    // o halo da coroa
    const halo = f.createRadialGradient(coroa.x, coroa.y, 2, coroa.x, coroa.y, 46);
    halo.addColorStop(0, "rgba(255, 209, 102, 0.35)");
    halo.addColorStop(1, "rgba(255, 209, 102, 0)");
    f.fillStyle = halo;
    f.fillRect(0, 0, W, H);
    // primeiro todo o contorno escuro (para os galhos se fundirem), depois a madeira, depois a luz
    caminhos.forEach((c) => c.pontos.forEach((p) => disco(p.x, p.y, c.grossura / 2 + 1, "#120608")));
    caminhos.forEach((c) => c.pontos.forEach((p, i) => {
      disco(p.x, p.y, c.grossura / 2, c.tronco ? "#4a2c18" : "#3a2414");
      // o veio claro do lado da luz (esquerda)
      if (c.grossura >= 4 && i % 2 === 0) disco(p.x - c.grossura / 4, p.y, 0.5, "#6b4426");
    }));
    caminhos.filter((c) => c.aceso).forEach((c) => {
      f.globalAlpha = 0.28;
      c.pontos.forEach((p) => disco(p.x, p.y, c.grossura / 2 + 2, c.cor));
      f.globalAlpha = 1;
      c.pontos.forEach((p) => disco(p.x, p.y, Math.max(0.5, c.grossura / 2 - 0.5), c.cor));
      c.pontos.forEach((p, i) => i % 2 === 0 && disco(p.x, p.y, 0.5, "#fff6d8"));
    });
    // folhinhas e brotos nos galhos que já acenderam (pontos de cor sobrando para os lados)
    caminhos.filter((c) => c.aceso && !c.tronco).forEach((c) => {
      c.pontos.forEach((p, i) => {
        if (i % 7 !== 3) return;
        const lado = i % 14 === 3 ? 1 : -1;
        disco(p.x + lado * (c.grossura / 2 + 1), p.y - 1, 0.5, c.cor);
        disco(p.x + lado * (c.grossura / 2 + 2), p.y - 2, 0.5, "#fff6d8");
      });
    });
    // as raízes saindo do pé do tronco
    const pe = caminhos[0].pontos[0];
    [-1, 1].forEach((lado) => {
      for (let i = 0; i < 18; i++) disco(pe.x + lado * (3 + i), pe.y - 1 + Math.round(i * 0.25), Math.max(0.5, 2 - i * 0.1), "#3a2414");
    });
  }

  // as faíscas de energia subindo pelos trechos acesos (e mais rápido pelos que estão "fluindo")
  const faiscasArvore = [];
  let ultimo = performance.now();
  function quadro(agora) {
    if (!tela.isConnected || !painel.open) return;
    requestAnimationFrame(quadro);
    if (document.hidden || !fundo) return;
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;
    const acesos = caminhos.filter((c) => c.aceso || c.fluindo);
    if (acesos.length && faiscasArvore.length < 40 && Math.random() < dt * 14) {
      const c = acesos[Math.floor(Math.random() * acesos.length)];
      faiscasArvore.push({ c, p: 0, v: (c.fluindo ? 0.9 : 0.45) + Math.random() * 0.3 });
    }
    ctx.clearRect(0, 0, tela.width, tela.height);
    ctx.drawImage(fundo, 0, 0);
    for (let i = faiscasArvore.length - 1; i >= 0; i--) {
      const s = faiscasArvore[i];
      s.p += s.v * dt;
      if (s.p >= 1) {
        faiscasArvore.splice(i, 1);
        continue;
      }
      // os pontos do caminho vão de baixo para cima (tronco e galhos foram traçados nessa ordem)
      const pts = s.c.pontos;
      const ponto = pts[Math.min(pts.length - 1, Math.floor(s.p * pts.length))];
      ctx.globalAlpha = Math.sin(s.p * Math.PI);
      ctx.fillStyle = "#fff6d8";
      ctx.fillRect(Math.round(ponto.x), Math.round(ponto.y), 1, 1);
      ctx.fillStyle = s.c.cor;
      ctx.fillRect(Math.round(ponto.x), Math.round(ponto.y) + 1, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  medir();
  requestAnimationFrame(quadro);
  // a janela mudou de tamanho: mede e redesenha (e para de observar quando a árvore sai da tela)
  const observador = new ResizeObserver(() => {
    if (!tela.isConnected) return observador.disconnect();
    medir();
  });
  observador.observe(area);
}

function alternarArvore() {
  const painel = document.querySelector(".arvore-epica");
  if (painel?.open) painel.close();
  else abrirArvore();
}

// ---------- domínio por trilha e missões ----------

function posicaoPatente(pontos) {
  return JORNADA.trilhas.ranks.reduce((pos, rank, i) => (pontos >= rank.pontos ? i : pos), 0);
}

function patentes() {
  return Object.fromEntries(Object.entries(progresso.dominio || {}).map(([trilha, pontos]) => [trilha, posicaoPatente(pontos)]));
}

function trilhaInfo(trilha) {
  const t = JORNADA.trilhas.trilhas[trilha];
  if (!t) return null;
  const pontos = (progresso.dominio || {})[trilha] || 0;
  const posicao = posicaoPatente(pontos);
  return { ...t, id: trilha, pontos, posicao, patente: JORNADA.trilhas.ranks[posicao].nome, golpe: posicao >= JORNADA.trilhas.golpe_a_partir_de };
}

// as missões ativas, já com título, alvo e recompensa do quadro de missões
function missoesAtivas() {
  return ((progresso.missoes || {}).ativas || []).map((m) => {
    const modelo = JORNADA.missoes.missoes.find((x) => x.id === m.id);
    return modelo ? { ...modelo, feito: m.feito, pronta: m.feito >= modelo.alvo } : null;
  }).filter(Boolean);
}

function recompensaTexto(r) {
  const partes = [];
  if (r.moedas) partes.push(`🪙 ${r.moedas}`);
  if (r.xp) partes.push(`⭐ ${r.xp} XP`);
  Object.entries(r.itens || {}).forEach(([id, qtd]) => partes.push(`${itemDoCatalogo(id)?.icone || "🎁"} ×${qtd}`));
  return partes.join(" · ");
}

// Aviso que desce no canto da tela e some sozinho (patente nova, missão cumprida...).
function avisoFlutuante(icone, titulo, texto) {
  let pilha = document.querySelector(".avisos-flutuantes");
  if (!pilha) {
    pilha = document.createElement("div");
    pilha.className = "avisos-flutuantes";
    pilha.setAttribute("aria-live", "polite");
    document.body.append(pilha);
  }
  const aviso = criar(`<div class="aviso-flutuante"><span>${icone}</span><div><strong>${escapar(titulo)}</strong><small>${escapar(texto)}</small></div></div>`);
  pilha.append(aviso);
  setTimeout(() => aviso.classList.add("saindo"), 5200);
  setTimeout(() => aviso.remove(), 5700);
}

// ---------- vida ----------

function vidaMaxima() {
  // a conta do servidor (com o bônus do equipamento) vale; sem ela, a mesma regra sem o equipamento
  return statusServidor.vidaMaxima ?? Math.min(3 + nivelDe(progresso.xp || 0), 10) + (temHabilidade("pele") ? 1 : 0);
}

function vidaAtual() {
  return Math.min(progresso.vida?.atual ?? vidaMaxima(), vidaMaxima());
}

function coracoesHtml(atual = vidaAtual(), maximo = vidaMaxima()) {
  return Array.from({ length: maximo }, (_, i) =>
    `<img class="pixel coracao" src="${coracaoPixel(i < atual)}" alt="">`).join("");
}

// Barra de RPG (vida, mana): o preenchimento anda na hora e um rastro claro vai atrás,
// mostrando quanto o golpe tirou. Devolve a função que atualiza a barra.
function barraRpg(elemento, tipo, icone) {
  elemento.classList.add("barra-rpg", tipo);
  elemento.innerHTML = `<span class="icone-barra">${icone}</span><div class="trilho"><b></b><i></i></div><strong></strong>`;
  const [rastro, cheio, texto] = ["b", "i", "strong"].map((s) => elemento.querySelector(s));
  return (atual, maximo) => {
    const parte = `${maximo ? Math.max(0, Math.min(1, atual / maximo)) * 100 : 0}%`;
    cheio.style.width = parte;
    rastro.style.width = parte;
    texto.textContent = `${atual} / ${maximo}`;
    elemento.classList.toggle("critica", atual <= maximo * 0.25);
  };
}

// ---------- poderes equipados: os 3 que vão para a barra da batalha ----------

const VAGAS_DE_PODER = 3;

// Tudo o que o herói já pode equipar: as técnicas do grimório (liberadas por nível) e as magias
// da subclasse (liberadas pelos degraus do caminho). A chave diz de onde veio: "g:visao", "c:agi".
function poderesDisponiveis() {
  const nivel = nivelDe(progresso.xp || 0);
  const classe = classeDoHeroi();
  const degrau = degrauDaClasse();
  const daClasse = (classe?.magias || [])
    .filter((m, i) => degrau >= JORNADA.caminho.degraus_das_magias[i])
    .map((m) => ({ chave: `c:${m.id}`, tipo: "classe", magia: m }));
  const doGrimorio = JORNADA.magias.magias.filter((m) => nivel >= (m.nivel || 1))
    .map((m) => ({ chave: `g:${m.id}`, tipo: "grimorio", magia: m }));
  return [...daClasse, ...doGrimorio];
}

// As 3 vagas (null = vaga vazia). Quem nunca escolheu leva os primeiros poderes que tiver.
function poderesEquipados() {
  const disponiveis = poderesDisponiveis();
  const porChave = new Map(disponiveis.map((p) => [p.chave, p]));
  const escolhidos = progresso.poderesEquipados || disponiveis.slice(0, VAGAS_DE_PODER).map((p) => p.chave);
  return Array.from({ length: VAGAS_DE_PODER }, (_, i) => porChave.get(escolhidos[i]) || null);
}

function equiparPoder(vaga, chave) {
  const atuais = poderesEquipados().map((p) => p?.chave || null);
  const estava = chave ? atuais.indexOf(chave) : -1;
  if (estava >= 0) atuais[estava] = atuais[vaga]; // já estava em outra vaga: troca de lugar
  atuais[vaga] = chave;
  progresso.poderesEquipados = atuais;
  salvarProgresso();
  window.dispatchEvent(new Event("poderes-mudaram"));
}

// segundos que faltam para uma magia de classe recarregar (o servidor guarda o horário em segundos)
function recargaRestante(id) {
  return Math.max(0, Math.round((progresso.recargas?.[id] || 0) - Date.now() / 1000));
}

function tempoCurto(segundos) {
  const minutos = Math.ceil(segundos / 60);
  const h = Math.floor(minutos / 60);
  const min = minutos % 60;
  return h ? `${h}h${min && h < 10 ? String(min).padStart(2, "0") : ""}` : `${min}min`;
}

// Zerou a vida: o servidor já tirou 10% das moedas e encheu a vida; aqui o herói acorda na Academia.
function telaDesmaio(motivo, perda = 0) {
  Som.musica("abertura");
  progresso.local = "academia";
  salvarProgresso();
  atualizarStatus();
  window.scrollTo(0, 0);
  const secao = criar(`
    <section class="aptidao derrota">
      <h2>💫 Tu desmaiaste...</h2>
      <p class="legenda">${escapar(motivo)}${perda ? ` Na confusão, ${perda} moedas se perderam pelo caminho.` : ""}</p>
      <div data-zetsu></div>
      <div class="acoes" style="justify-content:center">
        <button class="botao" type="button" data-academia>Acordar na Academia 🏰</button>
      </div>
    </section>`);
  const zetsu = criarZetsu();
  secao.querySelector("[data-zetsu]").replaceWith(zetsu.elemento);
  secao.querySelector("[data-academia]").addEventListener("click", () => irPara("academia"));
  tela.replaceChildren(secao);
  zetsu.mostrarCena({ tipo: "destaque", titulo: "Enfermaria da Academia", icone: "🛏️", texto: "Os aprendizes te carregaram até aqui. **Tua vida foi restaurada.**" });
  zetsu.dizer(`Calma, ${nomeAluno()}, tu tá em casa. Todo aventureiro cai de vez em quando. Revisa as lições e volta pro Reino mais forte.`);
}

// o catálogo por id (com a Forja são quase 500 peças: procurar na lista toda a cada carta pesava)
let catalogoPorId = { de: null, mapa: new Map() };
function itemDoCatalogo(id) {
  if (catalogoPorId.de !== CATALOGO) {
    catalogoPorId = { de: CATALOGO, mapa: new Map() };
    [...CATALOGO.trofeus, ...CATALOGO.cosmeticos, ...CATALOGO.consumiveis].forEach((i) => catalogoPorId.mapa.set(i.id, i));
  }
  return catalogoPorId.mapa.get(id);
}

// os materiais da Casa da Forja (vêm do servidor junto com o catálogo; o herói guarda em progresso.materiais)
function materialDoCatalogo(id) {
  return (CATALOGO.materiais || []).find((m) => m.id === id);
}
function quantosMateriais(id) {
  return (progresso.materiais || {})[id] || 0;
}
// a peça forjável que o herói ainda não forjou não aparece no criador nem na mochila (aparece na Forja)
function forjaEscondida(c) {
  return Boolean(c?.forja) && !possuiCosmetico(c.id);
}

// Os visuais do catálogo com "visual" (os itens novos) entram no criador e no desenho do herói: a arma ou o
// chapéu é uma variação de cor de um desenho-base, com o efeito de partículas da raridade; a roupa é uma cor.
function registrarVisuaisDoCatalogo() {
  CATALOGO.cosmeticos.forEach((c) => {
    const v = c.visual;
    if (!v) return;
    const opcoes = AVATAR_OPCOES[v.slot]?.valores;
    if (!opcoes) return;
    if (v.slot === "manto") {
      if (!opcoes.some((o) => typeof o === "object" && o.bloqueio === c.id)) opcoes.push({ cor: v.cor, kit: c.kit, bloqueio: c.id });
      return;
    }
    const variacoes = v.slot === "item" ? VARIACOES_ITEM : VARIACOES_CHAPEU;
    const efeitos = v.slot === "item" ? EFEITOS_ITEM : EFEITOS_CHAPEU;
    variacoes[v.id] = { base: v.base, cores: v.cores };
    if (v.efeito) efeitos[v.id] = { raridade: c.raridade, ...v.efeito };
    if (!opcoes.some((o) => o.id === v.id)) {
      opcoes.push({ id: v.id, nome: c.nome, kit: c.kit, bloqueio: c.id });
      if (v.slot === "item" && c.kit) (ITENS_DO_KIT[c.kit] ||= []).push(v.id);
    }
  });
}

// Trocou de roupa: depois que o visual novo é salvo, pede ao servidor o estado com o bônus do equipamento
// (vida e mana máximas, XP e ouro a mais...).
function atualizarBonusDoServidor() {
  if (!jogadorId) return;
  const id = jogadorId;
  setTimeout(() => api(`/api/jogador/${id}`, undefined, "GET").then((r) => id === jogadorId && r.estado && aplicarEstado(r.estado)).catch(() => {}), 800);
}

// "+10% XP · +1 mana · +2s": o bônus de um item, curtinho, para as cartas da loja e da mochila
const NOMES_BONUS = { xp: ["XP", true], moedas: ["ouro", true], sorte: ["sorte", true], mana: ["mana", false], vida: ["❤", false], tempo: ["s p/ responder", false] };
function textoBonus(bonus = {}) {
  return Object.entries(bonus).filter(([, v]) => v).map(([k, v]) => {
    const [nome, pct] = NOMES_BONUS[k] || [k, false];
    return pct ? `+${Math.round(v * 100)}% ${nome}` : `+${v} ${nome}`;
  }).join(" · ");
}

// A carta do mascote: os atributos que ele dá e o poder que usa sozinho nas batalhas (vem do servidor).
function cartaDoMascote(id) {
  const m = (JORNADA.mascotes || {})[id];
  if (!m) return `<p class="sem-poder">Sem mascote, sem ajuda nas batalhas. Que coragem!</p>`;
  return `
    <div class="carta-mascote">
      <span class="icone-mascote">${m.icone}</span>
      <div>
        <strong>${escapar(m.nome)}</strong>
        <small class="atributos-mascote">${escapar(textoBonus(m.bonus))}</small>
        <p><b>${escapar(m.poder.nome)}</b> ${escapar(m.poder.texto)}</p>
      </div>
    </div>`;
}

// quem comprou a raposa quando ela era vendida tem o Dragão da Academia (o mesmo vale no servidor)
const COSMETICO_ANTIGO_LIBERA = { "dragao-academia": ["raposa"] };
function possuiCosmetico(id) {
  const donos = progresso.cosmeticos || [];
  return donos.includes(id) || (COSMETICO_ANTIGO_LIBERA[id] || []).some((antigo) => donos.includes(antigo));
}

function quantidade(id) {
  return progresso.inventario[id] || 0;
}

// Gasta um item no servidor (o elixir já cura lá). Devolve false se não deu.
async function gastarItem(id) {
  if (!quantidade(id)) return false;
  try {
    await acaoJogador("usar", { item: id });
    return true;
  } catch {
    return false;
  }
}

function listaGanhos(ganhos) {
  return `<ul class="ganhos">${ganhos.map((g, i) => `
    <li class="${g.raro ? "raro" : ""}" style="animation-delay:${0.4 + i * 0.2}s"><span>${iconeDoGanho(g)}</span>${escapar(g.texto)}</li>`).join("")}</ul>`;
}

function carregarProgresso() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_PROGRESSO)) || progressoNovo();
  } catch {
    return progressoNovo();
  }
}

function salvarLocal() {
  try {
    localStorage.setItem(CHAVE_PROGRESSO, JSON.stringify(progresso));
  } catch {
    // sem localStorage (aba anônima, por exemplo): o jogo segue, só não abre tão rápido depois
  }
}

// Salva o que é do navegador (avatar, sala, posição...) no servidor, juntando várias mudanças seguidas.
let esperaSalvar = null;
function salvarProgresso() {
  salvarLocal();
  if (!jogadorId) return;
  clearTimeout(esperaSalvar);
  esperaSalvar = setTimeout(() => {
    api(`/api/jogador/${jogadorId}/progresso`, progresso, "PUT").catch(() => {});
  }, 400);
}

async function api(url, dados, metodo = "POST") {
  const opcoes = dados === undefined ? {} : {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  };
  const resposta = await fetch(url, opcoes);
  const corpo = await resposta.json();
  if (!resposta.ok) throw new Error(corpo.erro || "Erro no servidor");
  return corpo;
}

function escapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

// Markdown bem simples: **negrito**, *itálico* e `código`.
function formatar(texto) {
  return escapar(texto)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function criar(html) {
  const modelo = document.createElement("template");
  modelo.innerHTML = html.trim();
  return modelo.content.firstElementChild;
}

function estrelasHtml(quantidade) {
  return [1, 2, 3].map((n) => (n <= quantidade ? "★" : '<span class="apagada">★</span>')).join("");
}

function nomeAluno() {
  return progresso.nome || "aprendiz";
}

function blocoCodigo(codigo, copiavel = false) {
  const botao = copiavel ? '<button class="copiar" type="button" data-copiar>Copiar</button>' : "";
  return `<div class="bloco-codigo">${botao}<pre><code>${escapar(codigo)}</code></pre></div>`;
}

// Liga os botões "Copiar" que estiverem dentro do elemento.
function ativarCopiar(elemento) {
  elemento.querySelectorAll("[data-copiar]").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const texto = botao.parentElement.querySelector("code").textContent;
      try {
        await navigator.clipboard.writeText(texto);
        botao.textContent = "Copiado!";
      } catch {
        botao.textContent = "Selecione e copie";
      }
      setTimeout(() => (botao.textContent = "Copiar"), 1500);
    });
  });
}

// ---------- topo: XP e nível ----------

// cada nível pede um pouco mais de XP: sair do nível n custa xpBase + xpPorNivel × n
function xpParaChegar(nivel) {
  const anteriores = nivel - 1;
  // mesma fórmula do servidor (progressao.py): a parte linear mais a curva que aperta depois do nível 3
  const m = Math.max(0, anteriores - (CURVA_XP.nivelCurva ?? 3));
  return CURVA_XP.xpBase * anteriores + Math.floor((CURVA_XP.xpPorNivel * anteriores * nivel) / 2)
    + Math.floor(((CURVA_XP.xpCurva ?? 0) * m * (m + 1) * (2 * m + 1)) / 6);
}

function nivelDe(xp) {
  let nivel = 1;
  while (xp >= xpParaChegar(nivel + 1)) nivel += 1;
  return nivel;
}

function eraDe(nivel) {
  return CURVA_XP.eras.filter(([inicio]) => nivel >= inicio).pop()[1];
}

function atualizarStatus() {
  const status = document.getElementById("status");
  status.hidden = !progresso.nome;
  const nivel = nivelDe(progresso.xp || 0);
  const noNivel = (progresso.xp || 0) - xpParaChegar(nivel);
  const doNivel = xpParaChegar(nivel + 1) - xpParaChegar(nivel);
  const rotuloNivel = document.getElementById("nivel");
  rotuloNivel.textContent = `Nv. ${nivel}`;
  rotuloNivel.title = `${eraDe(nivel)} · faltam ${doNivel - noNivel} XP para o nível ${nivel + 1}`;
  document.getElementById("xp").textContent = `${progresso.xp} XP`;
  document.querySelector("#moedas b").textContent = progresso.moedas ?? 0;
  if (progresso.vida) {
    const vidas = document.getElementById("vidas-topo");
    vidas.innerHTML = coracoesHtml();
    vidas.title = `Vida: ${vidaAtual()} de ${vidaMaxima()}`;
  }
  document.getElementById("barra-xp").style.width = `${(noNivel / doNivel) * 100}%`;
  // missões do quadro prontas para resgatar e quests prontas para entregar acendem o botão do diário
  const prontas = missoesAtivas().filter((m) => m.pronta).length + (JORNADA?.historia ? questsAtivas().filter((q) => q.completa).length : 0);
  const botaoMissoes = document.getElementById("btn-missoes");
  botaoMissoes.classList.toggle("com-alerta", prontas > 0);
  botaoMissoes.title = prontas ? `Missões: ${prontas} pronta(s) para resgatar (J)` : "Missões (J)";
  const pontos = pontosHabilidade();
  const botaoArvore = document.getElementById("btn-arvore");
  botaoArvore.classList.toggle("com-alerta", pontos > 0 || podeEscolherSubclasse());
  botaoArvore.title = podeEscolherSubclasse() ? "Árvore Arcana: escolhe tua subclasse! (K)"
    : pontos > 0 ? `Árvore de habilidades: ${pontos} ponto(s) para gastar (K)` : "Árvore de habilidades (K)";
  // o título acompanha o caminho da classe (Aprendiz de Mago → Mago das Runas → Tecelão de Prompts → ...)
  const classe = identidadeDaClasse();
  document.getElementById("heroi-brasao").innerHTML = progresso.avatar ? avatarSvg(progresso.avatar, nomeAluno()) : classe.icone;
  document.getElementById("heroi-nome").textContent = nomeAluno();
  document.getElementById("heroi-classe").textContent = `${classe.icone} ${classe.titulo}`;
  atualizarHud();
}

// ---------- HUD de RPG no mapa: vida, mana e XP em cima; as 5 habilidades embaixo ----------

let statusServidor = {}; // o que o servidor calcula (mana máxima, tempo de recarga...), vem junto com o estado

// A mana de agora: o servidor guarda quanto tinha e desde quando recarrega; aqui só se conta o tempo que passou.
function manaAgora() {
  const maxima = statusServidor.manaMaxima ?? 3;
  const regen = statusServidor.manaRegen || 12;
  const m = progresso.mana;
  if (!m) return { atual: maxima, maxima, falta: 0 };
  if (m.atual >= maxima) return { atual: maxima, maxima, falta: 0 };
  const passou = Math.max(0, Date.now() / 1000 - m.em);
  const atual = Math.min(maxima, m.atual + Math.floor(passou / regen));
  return { atual, maxima, falta: atual < maxima ? regen - (passou % regen) : 0, regen };
}

function atualizarHud() {
  const hud = document.getElementById("hud-rpg");
  if (!hud || !progresso.nome) return;
  hud.hidden = false;
  const nivel = nivelDe(progresso.xp || 0);
  const noNivel = (progresso.xp || 0) - xpParaChegar(nivel);
  const doNivel = xpParaChegar(nivel + 1) - xpParaChegar(nivel);
  const mana = manaAgora();
  const barra = (classe, parte, texto) => {
    const el = hud.querySelector(`.hud-barra.${classe}`);
    el.querySelector("i").style.width = `${Math.max(0, Math.min(1, parte)) * 100}%`;
    el.querySelector("span").textContent = texto;
  };
  barra("vida", vidaAtual() / vidaMaxima(), `${vidaAtual()} / ${vidaMaxima()}`);
  barra("mana", mana.atual / mana.maxima, `${mana.atual} / ${mana.maxima}`);
  // o pedacinho que está recarregando aparece mais claro, enchendo
  hud.querySelector(".hud-barra.mana b").style.cssText = mana.falta
    ? `left:${(mana.atual / mana.maxima) * 100}%;width:${((1 - mana.falta / mana.regen) / mana.maxima) * 100}%` : "width:0";
  barra("xp", noNivel / doNivel, `XP ${noNivel} / ${doNivel} · faltam ${doNivel - noNivel} para o Nv. ${nivel + 1}`);
  hud.querySelector("#hud-nome").textContent = nomeAluno();
  hud.querySelector("#hud-nivel").textContent = `Nv. ${nivel}`;
  const titulo = hud.querySelector("#hud-titulo");
  const selo = principalDoHeroi() ? seloDoTitulo() : "";
  if (titulo.innerHTML !== selo) titulo.innerHTML = selo;
  const retrato = hud.querySelector("#hud-retrato");
  const chave = JSON.stringify(progresso.avatar || {});
  if (retrato.dataset.avatar !== chave) {
    retrato.dataset.avatar = chave;
    retrato.innerHTML = progresso.avatar ? avatarSvg(progresso.avatar, nomeAluno()) : "";
  }
  desenharBarraHabilidades();
  posicionarRastreador();
}

// O rastreador da quest fica logo embaixo do HUD: mede onde o HUD termina (ele cresce com o título e muda
// de tamanho em telas estreitas) e guarda em --fundo-hud.
function posicionarRastreador() {
  const hud = document.getElementById("hud-rpg");
  const caixa = hud && !hud.hidden ? hud.getBoundingClientRect() : null;
  document.documentElement.style.setProperty("--fundo-hud", `${caixa?.height ? Math.round(caixa.bottom + 12) : 92}px`);
}
window.addEventListener("resize", posicionarRastreador);
new ResizeObserver(posicionarRastreador).observe(document.getElementById("hud-rpg"));

// A barra de baixo no mapa: os 3 poderes da Árvore que o herói leva para a luta (as técnicas do grimório,
// que gastam mana, e as magias da classe, que recarregam em horas). No mapa eles só aparecem (são usados na
// batalha, pelas teclas 1, 2 e 3): clicar abre a Árvore na aba Poderes, e o ✏️ troca o que está equipado.
// (Antes eram as habilidades do mapa: correr, luz, cura, teleporte e o golpe à distância.)
// ---------- as poções da barra (espaços 4 e 5) ----------
// O 4 é de vida e o 5 de mana. Cada um guarda a poção escolhida (progresso.pocoesBarra); se ela acabou, usa
// outra do mesmo tipo que o herói tenha. Clique (ou tecla 4/5 no mapa) bebe; clique direito escolhe qual.
const TIPOS_POCAO = [
  { tipo: "vida", nome: "vida", icone: "❤️", filtro: (c) => c.cura },
  { tipo: "mana", nome: "mana", icone: "🔷", filtro: (c) => c.mana },
];
function pocoesDoTipo(i) {
  return (CATALOGO?.consumiveis || []).filter(TIPOS_POCAO[i].filtro);
}
function pocaoDaBarra(i) {
  const lista = pocoesDoTipo(i);
  const escolhida = progresso.pocoesBarra?.[i];
  const dela = lista.find((c) => c.id === escolhida);
  if (dela && quantidade(dela.id) > 0) return dela;
  return lista.find((c) => quantidade(c.id) > 0) || dela || lista[0] || null;
}
async function usarPocaoDaBarra(i, botao) {
  const pocao = pocaoDaBarra(i);
  if (!pocao || !quantidade(pocao.id)) {
    Som.efeito("erro");
    avisoFlutuante(TIPOS_POCAO[i].icone, `Sem poção de ${TIPOS_POCAO[i].nome}`, "Compra no Mercado ou acha nas batalhas e dungeons.");
    return;
  }
  if (!(await gastarItem(pocao.id))) {
    Som.efeito("erro");
    avisoFlutuante(pocao.icone, "Não deu para beber agora", TIPOS_POCAO[i].tipo === "vida" ? "Tua vida já está cheia." : "Tua mana já está cheia.");
    return;
  }
  Som.efeito(TIPOS_POCAO[i].tipo === "vida" ? "cura" : "magia");
  const r = botao?.getBoundingClientRect();
  if (r) faiscas(r.left + r.width / 2, r.top, TIPOS_POCAO[i].tipo === "vida" ? "#ff6b7a" : "#6ec8ff");
  desenharBarraHabilidades();
}
// a escolha da poção do espaço: uma janelinha em cima dele com as poções daquele tipo
function escolherPocaoDaBarra(i, botao) {
  document.querySelector(".escolha-pocao")?.remove();
  const lista = pocoesDoTipo(i);
  const caixa = criar(`
    <div class="escolha-pocao" role="menu">
      <small>Poção de ${TIPOS_POCAO[i].nome} no espaço ${i + 4}</small>
      ${lista.map((c) => `
        <button type="button" role="menuitem" data-pocao="${c.id}" class="${pocaoDaBarra(i)?.id === c.id ? "escolhida" : ""} ${quantidade(c.id) ? "" : "sem"}">
          <span>${iconeDoItem(c.id, c.icone)}</span><b>${escapar(c.nome)}</b><i>×${quantidade(c.id)}</i>
        </button>`).join("")}
    </div>`);
  document.body.append(caixa);
  const r = botao.getBoundingClientRect();
  caixa.style.left = `${Math.max(8, Math.min(window.innerWidth - caixa.offsetWidth - 8, r.left + r.width / 2 - caixa.offsetWidth / 2))}px`;
  caixa.style.top = `${r.top - caixa.offsetHeight - 10}px`;
  caixa.querySelectorAll("[data-pocao]").forEach((b) => b.addEventListener("click", () => {
    const escolha = [...(progresso.pocoesBarra || [null, null])];
    escolha[i] = b.dataset.pocao;
    progresso.pocoesBarra = escolha;
    salvarProgresso();
    Som.efeito("clique");
    caixa.remove();
    desenharBarraHabilidades();
  }));
  // clicar fora ou apertar Esc fecha
  setTimeout(() => {
    const fechar = (e) => {
      if (e.type === "keydown" && e.key !== "Escape") return;
      if (e.type === "pointerdown" && caixa.contains(e.target)) return;
      caixa.remove();
      window.removeEventListener("pointerdown", fechar, true);
      window.removeEventListener("keydown", fechar, true);
    };
    window.addEventListener("pointerdown", fechar, true);
    window.addEventListener("keydown", fechar, true);
  }, 0);
}
// teclas 4 e 5 no mapa bebem as poções da barra (com a roda de gestos aberta, os números são dos gestos)
window.addEventListener("keydown", (e) => {
  if (e.key !== "4" && e.key !== "5") return;
  if (e.target instanceof Element && e.target.closest("input, textarea")) return;
  if (!document.body.classList.contains("modo-mundo") || document.querySelector("dialog[open], .roda-gestos, .inventario.aberto")) return;
  const i = Number(e.key) - 4;
  usarPocaoDaBarra(i, document.querySelector(`#barra-habilidades [data-pocao-barra="${i}"]`));
});

function desenharBarraHabilidades() {
  const barra = document.getElementById("barra-habilidades");
  if (!barra) return;
  barra.hidden = !document.body.classList.contains("modo-mundo") || !window.mundoAtivo || !progresso?.nome;
  if (barra.hidden) return;
  const poderes = poderesEquipados();
  const recurso = temaDaClasse().grimorio;
  const pocoes = [0, 1].map(pocaoDaBarra);
  const assinatura = `${poderes.map((p) => p?.chave || "-").join("|")}#${pocoes.map((c) => (c ? `${c.id}:${quantidade(c.id)}` : "-")).join("|")}`;
  if (barra.dataset.poderes !== assinatura) {
    barra.dataset.poderes = assinatura;
    barra.innerHTML = `${poderes.map((p, i) => {
      if (!p) return `<button type="button" class="slot-habilidade vazio" data-arvore title="Vaga vazia: escolhe um poder na Árvore"><span class="icone">＋</span><b class="tecla">${i + 1}</b></button>`;
      const m = p.magia;
      const custo = p.tipo === "classe" ? `${m.recarga_horas}h` : `${m.custo}`;
      return `
        <button type="button" class="slot-habilidade poder-mapa ${p.tipo}" data-arvore data-chave="${p.chave}" title="${escapar(`${m.nome}: ${m.descricao}${p.tipo === "classe" ? ` (1× por batalha, recarrega em ${m.recarga_horas}h)` : ` (${m.custo} de ${recurso.recurso.toLowerCase()})`}. Usa na batalha com a tecla ${i + 1}.`)}">
          <span class="icone">${m.icone}</span><b class="tecla">${i + 1}</b><small class="custo">${custo}</small><i class="recarga"></i>
        </button>`;
    }).join("")}
      <i class="divisor-barra" aria-hidden="true"></i>
      ${pocoes.map((c, i) => {
        const qtd = c ? quantidade(c.id) : 0;
        return `
          <button type="button" class="slot-habilidade slot-pocao ${TIPOS_POCAO[i].tipo} ${qtd ? "" : "sem-pocao"}" data-pocao-barra="${i}"
            title="${escapar(c ? `${c.nome} (×${qtd}): ${c.descricao}` : `Poção de ${TIPOS_POCAO[i].nome}`)} Clica ou aperta ${i + 4} para beber; clique direito para escolher outra.">
            <span class="icone">${c ? c.icone : TIPOS_POCAO[i].icone}</span><b class="tecla">${i + 4}</b><small class="qtd">×${qtd}</small>
          </button>`;
      }).join("")}
      <button type="button" class="slot-habilidade editar-barra" data-arvore title="Trocar os poderes (abre a Árvore, aba Poderes)"><span class="icone">✏️</span></button>`;
    barra.querySelectorAll("[data-arvore]").forEach((b) => b.addEventListener("click", () => abrirArvore("poderes")));
    barra.querySelectorAll("[data-pocao-barra]").forEach((b) => {
      const i = Number(b.dataset.pocaoBarra);
      b.addEventListener("click", () => usarPocaoDaBarra(i, b));
      b.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        escolherPocaoDaBarra(i, b);
      });
    });
  }
  // as magias de classe que estão recarregando escurecem e mostram quanto falta
  const { atual } = manaAgora();
  poderes.forEach((p) => {
    if (!p) return;
    const b = barra.querySelector(`[data-chave="${p.chave}"]`);
    if (!b) return;
    const espera = p.tipo === "classe" ? recargaRestante(p.magia.id) : 0;
    b.classList.toggle("sem-mana", p.tipo !== "classe" && atual < p.magia.custo);
    b.classList.toggle("recarregando", espera > 0);
    b.querySelector(".recarga").style.height = espera > 0 ? `${Math.min(100, (espera / (p.magia.recarga_horas * 3600)) * 100)}%` : "0";
  });
}
window.addEventListener("poderes-mudaram", () => desenharBarraHabilidades());
// a mana recarrega e os tempos das habilidades andam mesmo sem o servidor mandar nada
setInterval(() => document.body.classList.contains("modo-jogo") && atualizarHud(), 250);

// ---------- o Zetsu e o balão de fala ----------

// O palco: painel de quadrinho em cima, Zetsu (ou outro personagem) à esquerda e o aventureiro à direita.
// Mantém o nome criarZetsu porque todas as etapas conversam por ele.
// Retrato de corpo inteiro em pixel (o mesmo sprite que anda pelo mapa), para o palco das conversas.
function retratoCorpoInteiro(visual, nome = "") {
  return `<img class="pixel retrato-corpo" src="${heroiParado(visual).toDataURL()}" alt="${escapar(nome)}">`;
}

// a velocidade do texto escolhida no menu (1 normal, 1.6 rápida, 0.7 lenta)
function velocidadeDoTexto() {
  return Som.volumes().velocidadeTexto || 1;
}

function criarZetsu(ator = { nome: "Zetsu", retrato: retratoCorpoInteiro(VISUAL_ZETSU, "Zetsu") }) {
  const bloco = criar(`
    <div class="palco">
      <div class="quadro" hidden></div>
      <div class="dialogo">
        <div class="ator ator-zetsu">${ator.retrato}<span class="nome-ator">${escapar(ator.nome)}</span></div>
        <div class="falas">
          <div class="balao" aria-live="polite">
            <span class="nome">${escapar(ator.nome)}</span>
            <div class="fala"></div>
          </div>
          <div class="balao-jogador" hidden><span class="nome">${escapar(nomeAluno())}</span><div class="fala-jogador"></div></div>
          <div class="escolhas-dialogo" hidden></div>
          <div class="itens-palco" hidden></div>
        </div>
        <div class="ator ator-jogador">${retratoCorpoInteiro(progresso.avatar, nomeAluno())}<span class="nome-ator">${escapar(nomeAluno())}</span></div>
      </div>
    </div>`);
  const fala = bloco.querySelector(".fala");
  const quadro = bloco.querySelector(".quadro");
  const balaoJogador = bloco.querySelector(".balao-jogador");
  const areaEscolhas = bloco.querySelector(".escolhas-dialogo");
  let timer = null;
  let terminar = null;

  function mostrarCena(cena) {
    quadro.innerHTML = renderCena(cena);
    quadro.hidden = false;
    // reinicia a animação de entrada do painel
    quadro.classList.remove("entrando");
    void quadro.offsetWidth;
    quadro.classList.add("entrando");
  }

  function esconderCena() {
    quadro.hidden = true;
  }

  function jogadorDiz(texto) {
    balaoJogador.querySelector(".fala-jogador").innerHTML = formatar(texto);
    balaoJogador.className = "balao-jogador";
    balaoJogador.hidden = false;
  }

  function marcarResposta(certa) {
    balaoJogador.classList.add(certa ? "certa" : "errada");
  }

  // Some com opções da escolha que está na tela (efeito da Poção da Clareza).
  function removerOpcoes(indices) {
    indices.forEach((i) => {
      const botao = areaEscolhas.querySelector(`.fala-opcao[data-i="${i}"]`);
      if (botao) {
        botao.disabled = true;
        botao.classList.add("dissolvida");
      }
    });
  }

  // Barra de itens usáveis embaixo das falas: [{ id, icone, nome, quantidade, usar }].
  const barraItens = bloco.querySelector(".itens-palco");
  function definirItens(itens) {
    barraItens.replaceChildren(...itens.map((item) => {
      // magias mostram o custo em mana no lugar da quantidade e podem vir desligadas por outro motivo
      const desligado = item.desligado ?? !item.quantidade;
      const botao = criar(`
        <button class="item-usavel ${item.classe || ""}" type="button" title="${escapar(item.nome)}" ${desligado ? "disabled" : ""}
          ${item.tecla ? `data-tecla="${item.tecla}"` : ""}>
          <span>${item.icone}</span><small>${item.rotulo ?? item.quantidade}</small>${item.tecla ? `<b class="tecla">${item.tecla}</b>` : ""}
        </button>`);
      botao.addEventListener("click", () => item.usar(botao));
      return botao;
    }));
    barraItens.hidden = !itens.length;
  }

  // Mostra as falas que o aventureiro pode dizer e devolve o índice escolhido.
  function escolher(opcoes, { silencioso = false } = {}) {
    areaEscolhas.replaceChildren(...opcoes.map((o, i) => criar(`
      <button class="fala-opcao ${silencioso ? "fala-seguir" : ""}" type="button" data-i="${i}">
        ${o.icone ? `<span class="icone">${o.icone}</span>` : ""}<span>${formatar(o.texto)}</span>
      </button>`)));
    areaEscolhas.hidden = false;
    return new Promise((resolve) => {
      resolverEscolha = resolve;
      areaEscolhas.querySelectorAll(".fala-opcao").forEach((b) => b.addEventListener("click", () => {
        const i = Number(b.dataset.i);
        areaEscolhas.hidden = true;
        resolverEscolha = null;
        if (!silencioso) jogadorDiz(opcoes[i].fala || opcoes[i].texto);
        resolve(i);
      }, { once: true }));
      areaEscolhas.querySelector(".fala-opcao").focus({ preventScroll: true });
    });
  }

  // Encerra a escolha da tela sem resposta (a magia Pergunta Nova troca a pergunta no meio).
  let resolverEscolha = null;
  function cancelarEscolha(valor = -1) {
    if (!resolverEscolha) return;
    const resolver = resolverEscolha;
    resolverEscolha = null;
    areaEscolhas.hidden = true;
    resolver(valor);
  }

  // Efeito de digitação: revela o HTML aos poucos, pulando tags e entidades inteiras.
  function dizer(texto, { manterJogador = false } = {}) {
    pular();
    if (!manterJogador) balaoJogador.hidden = true;
    const html = formatar(texto);
    let i = 0;
    bloco.classList.add("falando");
    return new Promise((resolve) => {
      terminar = () => {
        clearInterval(timer);
        timer = null;
        terminar = null;
        fala.innerHTML = html;
        bloco.classList.remove("falando");
        resolve();
      };
      let letras = 0;
      timer = setInterval(() => {
        if (html[i] === "<") i = html.indexOf(">", i) + 1;
        else if (html[i] === "&") i = html.indexOf(";", i) + 1;
        else i += 1;
        fala.innerHTML = html.slice(0, i);
        // a voz de quem fala: um "blip" a cada poucas letras
        if (++letras % 3 === 0 && typeof Som.blip === "function") Som.blip(ator.voz || 0.85);
        if (i >= html.length) terminar();
      }, 18 / velocidadeDoTexto());
    });
  }

  function pular() {
    if (terminar) terminar();
  }

  function digitando() {
    return timer !== null;
  }

  return {
    elemento: bloco, dizer, pular, digitando, mostrarCena, esconderCena, jogadorDiz, escolher, marcarResposta,
    removerOpcoes, definirItens, cancelarEscolha,
  };
}

// ---------- telas ----------

// A abertura: o Zetsu aparece na frente da Academia, se apresenta com falas animadas, pergunta o nome
// e oferece a introdução do jogo (que dá para pular).
async function telaBoasVindas() {
  Som.musica("abertura");
  window.scrollTo(0, 0);
  const secao = criar(`
    <section class="abertura">
      <div class="palco-abertura">
        <canvas class="pixel" width="${LARGURA_ABERTURA}" height="${ALTURA_ABERTURA}" aria-label="Zetsu, o arquimago, na frente da Academia"></canvas>
      </div>
      <div class="lado-abertura">
        <p class="marca-rpg-ia"><img class="pixel" src="${iconeRpgIaDataUrl()}" alt=""> RPG <strong>IA</strong></p>
        <h1>Academia Arcana <span>de Elyndor</span></h1>
        <div class="caixa-fala-abertura" data-caixa title="Clica para acelerar">
          <strong class="quem-fala">🧙 Zetsu</strong>
          <p data-fala></p>
          <span class="seta-fala" data-seta hidden>▼</span>
        </div>
        <form class="campo-nome" id="form-nome" hidden>
          <input type="text" id="input-nome" placeholder="Teu nome, aventureiro" maxlength="30" required autocomplete="off">
          <button class="botao" type="submit">É esse ⚔️</button>
          <small class="aviso-nome" data-aviso-nome aria-live="polite"></small>
        </form>
        <div class="acoes" data-escolhas></div>
      </div>
    </section>`);
  tela.replaceChildren(secao);
  animarCenario(secao.querySelector("canvas"), pintarAbertura);
  const fala = secao.querySelector("[data-fala]");
  const seta = secao.querySelector("[data-seta]");
  const caixa = secao.querySelector("[data-caixa]");
  const escolhas = secao.querySelector("[data-escolhas]");

  // cada fala espera um clique (ou Enter) para seguir, menos a última de cada bloco
  const esperarClique = () => new Promise((resolver) => {
    seta.hidden = false;
    const seguir = (e) => {
      if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
      seta.hidden = true;
      caixa.removeEventListener("click", seguir);
      window.removeEventListener("keydown", seguir);
      resolver();
    };
    setTimeout(() => {
      caixa.addEventListener("click", seguir);
      window.addEventListener("keydown", seguir);
    }, 50);
  });
  const dizer = async (texto, esperar = true) => {
    await escreverFala(fala, texto);
    if (esperar) await esperarClique();
  };

  // quem já tem outro aventureiro já ouviu tudo isso: o Zetsu só pergunta o nome do novo
  if (progresso.veterano) {
    await dizer("Mais um aventureiro do teu grupo? Já conheces o caminho. Só me diz: como devo chamar este?", false);
  } else {
    await dizer("Ah... finalmente chegaste. Senti tua presença desde que a lua nasceu sobre Elyndor.");
    await dizer("Eu sou **Zetsu**, arquimago da Academia Arcana. Desde a **Grande Ruptura**, o conhecimento do reino vive partido em fragmentos... e deles nasceu uma magia nova: a **IA**.");
    await dizer("Monstros de dúvida rondam as estradas, e só quem domina essa magia consegue atravessá-las. Tu vieste aprender, não vieste?");
    await dizer("Antes de tudo: como devo te chamar, aprendiz?", false);
  }
  const form = secao.querySelector("#form-nome");
  form.hidden = false;
  const entrada = document.getElementById("input-nome");
  const aviso = secao.querySelector("[data-aviso-nome]");
  entrada.focus();
  // cada nome é único no jogo: o servidor diz se está livre (enquanto digita e de novo ao confirmar)
  const conferirNome = async (nome) => {
    try {
      return await api(`/api/jogador/nome-livre?nome=${encodeURIComponent(nome)}&id=${encodeURIComponent(jogadorId || "")}`, undefined, "GET");
    } catch {
      return { livre: true }; // sem conexão: o servidor confere de novo quando o progresso for salvo
    }
  };
  let espera = null;
  entrada.addEventListener("input", () => {
    clearTimeout(espera);
    aviso.textContent = "";
    aviso.className = "aviso-nome";
    const nome = entrada.value.trim();
    if (!nome) return;
    espera = setTimeout(async () => {
      const r = await conferirNome(nome);
      if (entrada.value.trim() !== nome) return;
      aviso.textContent = r.livre ? "✓ Nome livre" : r.motivo;
      aviso.className = `aviso-nome ${r.livre ? "livre" : "ocupado"}`;
    }, 350);
  });
  const nome = await new Promise((resolver) => form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const escolhido = entrada.value.trim();
    const r = await conferirNome(escolhido);
    if (!r.livre) {
      aviso.textContent = r.motivo;
      aviso.className = "aviso-nome ocupado";
      animar(entrada, "negado");
      entrada.focus();
      return;
    }
    resolver(escolhido);
  }));
  form.hidden = true;
  progresso.nome = nome;
  salvarProgresso();
  atualizarStatus();
  chuvaDeEstrelas(24);
  await dizer(`**${nome}**... Sim. As runas já sussurravam esse nome. Vais longe, ${nome}.`, false);
  await new Promise((r) => setTimeout(r, 300));
  // o veterano vai direto para a criação (sem a introdução do reino)
  if (progresso.veterano) {
    await new Promise((r) => setTimeout(r, 700));
    return telaCriador();
  }
  escolhas.innerHTML = `
    <button class="botao" type="button" data-intro>📘 Me mostra como o reino funciona</button>
    <button class="botao botao-fantasma" type="button" data-pular>⏩ Pular, quero criar meu personagem</button>`;
  escolhas.querySelector("[data-intro]").addEventListener("click", () => telaIntroducao(() => {
    progresso.viuIntro = true;
    salvarProgresso();
    telaCriador();
  }));
  escolhas.querySelector("[data-pular]").addEventListener("click", () => telaCriador());
}

// Segue para o próximo passo da entrada que ainda falta (personagem, classe, teste) ou abre o mapa.
async function proximoPasso() {
  if (!progresso.avatar) return telaCriador();
  // a classe principal é a vocação escolhida no criador (mago, guerreiro ou arqueiro)
  if (!progresso.classe?.principal) {
    try {
      await acaoJogador("classe/principal", { id: escolhasCompletas(progresso.avatar).kit });
    } catch {
      // já escolhida em outra aba: segue com a do servidor
    }
    if (!progresso.trilha) return telaClasse();
  }
  if (!progresso.trilha) return telaAptidao();
  return telaMapa();
}

// ---------- criador de personagem ----------

// modo "criar": o personagem novo, com tudo liberado. Modo "espelho" (o espelho do Mercado): só a
// aparência; a vocação (a classe) e o corpo ficam como foram criados.
function telaCriador(modo = "criar") {
  Som.musica(modo === "espelho" ? "mercado" : "abertura");
  window.scrollTo(0, 0);
  const escolhas = escolhasCompletas(progresso.avatar);
  const espelho = modo === "espelho";
  const TRAVADOS_NO_ESPELHO = ["kit", "corpo"];
  let abaAtual = "classe";
  // o que cada vocação usa na cabeça quando o aluno ainda não mudou
  const CHAPEU_DO_KIT = { mago: "pontudo", guerreiro: "elmoFerro", arqueiro: "cacador" };
  const liberada = (v) => !bloqueioDaOpcao(v) || possuiCosmetico(bloqueioDaOpcao(v));

  function amostrasDoGrupo(chave, grupo) {
    if (grupo.tipo === "kit") {
      return grupo.valores.map((v) => `
        <button type="button" class="carta-kit" data-valor="${v.id}">
          <img class="pixel" data-previa-kit="${v.id}" alt="">
          <strong>${v.icone} ${escapar(v.nome)}</strong>
          <small>${escapar(v.descricao)}</small>
        </button>`).join("");
    }
    return grupo.valores.filter((v) => !forjaEscondida(itemDoCatalogo(bloqueioDaOpcao(v)))).map((v) => {
      const valor = valorDaOpcao(v);
      const bloqueio = bloqueioDaOpcao(v);
      const travada = bloqueio && !possuiCosmetico(bloqueio);
      const item = bloqueio ? itemDoCatalogo(bloqueio) : null;
      // a dica do cadeado; sem o item no catálogo (servidor com catálogo antigo), uma dica genérica em vez
      // de travar a tela inteira
      const dica = !travada ? "" : item
        ? `title="🔒 ${escapar(item.nome)}: ${escapar(item.origem || (item.preco ? `à venda no Mercado por ${item.preco} moedas` : "um visual especial"))}"`
        : `title="🔒 ${escapar(v.nome)}: visual especial, ainda não conquistado"`;
      const extras = `${travada ? "disabled" : ""} ${dica} ${v.kit ? `data-kit="${v.kit}"` : ""} class="${grupo.tipo === "cor" ? "amostra-cor" : "amostra-estilo"} ${travada ? "travada" : ""} ${bloqueio ? "especial" : ""}"`;
      return grupo.tipo === "cor"
        ? `<button type="button" data-valor="${valor}" style="background:${valor}" aria-label="${grupo.rotulo} ${valor}" ${extras}></button>`
        : `<button type="button" data-valor="${valor}" ${extras}>${travada ? "🔒 " : bloqueio ? "✨ " : ""}${escapar(v.nome)}</button>`;
    }).join("") + (grupo.livre ? `
      <label class="amostra-livre" title="Escolher qualquer cor">
        <input type="color" data-livre="${chave}" aria-label="${grupo.rotulo}: cor livre"><span>🎨</span>
      </label>` : "");
  }

  const secao = criar(`
    <section class="${espelho ? "" : "criacao-heroi"}">
      <div class="cabecalho-mapa">
        <div>
          <h2>${espelho ? "🪞 O Espelho do Mercado" : "Crie teu aventureiro"}</h2>
          <p>${espelho ? "Muda cabelo, rosto, roupa e cores quando quiser. A vocação e o corpo ficam como foram criados."
            : "Escolha tua vocação, teu rosto, teu cabelo e tuas cores. A vocação é tua classe: depois de criado, só o visual muda (no espelho do Mercado)."}</p>
        </div>
      </div>
      <div class="criador">
        <div class="vitrine">
          <div data-preview></div>
          <div class="pedestal"></div>
          <h3>${escapar(nomeAluno())}</h3>
          <p class="vitrine-kit" data-kit-nome></p>
          <div class="acoes">
            ${espelho ? '<button class="botao botao-fantasma" type="button" data-voltar>◂ Voltar</button>' : ""}
            <button class="botao botao-fantasma" type="button" data-sortear>🎲 Sortear</button>
            <button class="botao" type="button" data-pronto>${espelho ? "Salvar ✓" : "Pronto! ▸"}</button>
          </div>
        </div>
        <div>
          <div class="abas abas-criador" role="tablist">
            ${ABAS_CRIADOR.map((aba) => `<button type="button" role="tab" data-aba="${aba.id}">${aba.nome}</button>`).join("")}
          </div>
          <div class="opcoes-criador">
            ${Object.entries(AVATAR_OPCOES).map(([chave, grupo]) => `
              <div class="grupo-criador ${grupo.tipo === "kit" ? "grupo-kit" : ""}" data-grupo="${chave}" data-aba-grupo="${grupo.aba}">
                <h4>${grupo.rotulo}</h4>
                <div class="amostras">${amostrasDoGrupo(chave, grupo)}</div>
              </div>`).join("")}
            <div class="ficha-mascote" data-poder-mascote></div>
          </div>
        </div>
      </div>
    </section>`);

  // vitrine: o herói de corpo inteiro andando no lugar, com o mascote; só vira quando o aluno clica nele
  const preview = secao.querySelector("[data-preview]");
  const vitrine = document.createElement("canvas");
  vitrine.width = 60; // o herói (32) e, ao lado, o mascote grande (até 38 de largura, o dragão)
  vitrine.height = 2 + ALTURA_HEROI + 2;
  vitrine.className = "pixel heroi-vitrine";
  vitrine.title = "Clique para virar ou arraste para girar";
  preview.append(vitrine);
  const ctxVitrine = vitrine.getContext("2d");
  // o giro da vitrine em graus (0 = de frente): o clique vira um quarto de volta, devagar, passando pelos
  // ângulos do meio; arrastar gira à mão e, ao soltar, ele assenta na direção mais perto
  let anguloVitrine = 0;
  let alvoVitrine = 0;
  let arrasto = null;
  let quadroVitrine = 0;
  // Cada quadro da vitrine é desenhado só quando aparece (uns 6 ms), e não os 12 quadros da caminhada de
  // uma vez a cada troca de roupa (quase 200 ms, a travadinha). Trocou o visual, começa uma lista nova.
  let quadrosVitrine = { chave: "", lista: {} };
  function quadroDaVitrine(direcao, quadro) {
    const chave = JSON.stringify(escolhas);
    if (quadrosVitrine.chave !== chave) quadrosVitrine = { chave, lista: {} };
    return (quadrosVitrine.lista[`${direcao}${quadro}`] ||= quadroHeroi(escolhas, direcao, quadro));
  }
  function desenharVitrine() {
    const vista = heroiNoAngulo(quadroDaVitrine, anguloVitrine, quadroVitrine);
    const { direcao, espelhado, sprite } = vista;
    ctxVitrine.clearRect(0, 0, vitrine.width, vitrine.height);
    ctxVitrine.save();
    if (espelhado) {
      ctxVitrine.translate(5 + LARGURA_HEROI, 2);
      ctxVitrine.scale(-1, 1);
    } else ctxVitrine.translate(5, 2);
    ctxVitrine.drawImage(sprite, 0, 0);
    // o brilho e as partículas dos itens épicos e lendários aparecem já no criador
    desenharEfeitosHeroi(ctxVitrine, escolhas, performance.now() / 1000, 0, 0, direcao);
    ctxVitrine.restore();
    // o mascote grande ao lado, animado (o dragão bate as asas e paira; os outros respiram e piscam)
    const quadrosMascote = familiarQuadros(escolhas);
    if (quadrosMascote?.length) {
      const voa = MASCOTES_VOAM.has(escolhas.familiar);
      const m = quadrosMascote[Math.floor(performance.now() / (quadrosMascote.length === 4 ? 110 : 380)) % quadrosMascote.length];
      const sobe = voa ? 10 + Math.round(Math.sin(performance.now() / 420) * 2) : 0;
      ctxVitrine.drawImage(m, Math.min(vitrine.width - m.width, 38), vitrine.height - m.height - 2 - sobe);
    }
  }
  vitrine.style.touchAction = "none";
  vitrine.style.cursor = "grab";
  vitrine.addEventListener("pointerdown", (e) => {
    arrasto = { x: e.clientX, angulo: anguloVitrine, mexeu: false };
    vitrine.setPointerCapture?.(e.pointerId);
    vitrine.style.cursor = "grabbing";
  });
  vitrine.addEventListener("pointermove", (e) => {
    if (!arrasto) return;
    const dx = e.clientX - arrasto.x;
    if (Math.abs(dx) > 3) arrasto.mexeu = true;
    if (!arrasto.mexeu) return;
    // arrastar para a direita gira o herói para a direita dele (o rosto vai para a direita)
    anguloVitrine = arrasto.angulo + dx * 1.2;
    alvoVitrine = anguloVitrine;
  });
  const soltar = () => {
    if (!arrasto) return;
    // clique sem arrastar: um quarto de volta; arrastou: assenta na direção mais perto
    alvoVitrine = arrasto.mexeu ? Math.round(anguloVitrine / 90) * 90 : Math.round(alvoVitrine / 90) * 90 + 90;
    arrasto = null;
    vitrine.style.cursor = "grab";
  };
  vitrine.addEventListener("pointerup", soltar);
  vitrine.addEventListener("pointercancel", soltar);
  // redesenha rápido (para as partículas dos itens raros correrem lisas e o giro sair liso), mas a
  // caminhada troca de quadro devagar
  let tique = 0;
  const relogioVitrine = setInterval(() => {
    if (!vitrine.isConnected) return clearInterval(relogioVitrine);
    if (++tique % 2 === 0) quadroVitrine = (quadroVitrine + 1) % QUADROS_ANDAR;
    if (!arrasto && anguloVitrine !== alvoVitrine) {
      const falta = alvoVitrine - anguloVitrine;
      anguloVitrine = Math.abs(falta) < 2 ? alvoVitrine : anguloVitrine + falta * 0.3;
    }
    desenharVitrine();
  }, 57);

  // troca de vocação: a arma vira a primeira da nova vocação e, se o aluno não tinha mudado o chapéu, o chapéu também
  function trocarKit(kit) {
    if (escolhas.chapeu === CHAPEU_DO_KIT[escolhas.kit]) escolhas.chapeu = CHAPEU_DO_KIT[kit];
    escolhas.kit = kit;
    if (kitDoItem(escolhas.item) !== kit) {
      escolhas.item = AVATAR_OPCOES.item.valores.find((v) => v.kit === kit && liberada(v)).id;
    }
  }

  function atualizarPrevias() {
    secao.querySelectorAll("[data-previa-kit]").forEach((img) => {
      const outro = { ...escolhas };
      const k = img.dataset.previaKit;
      if (outro.chapeu === CHAPEU_DO_KIT[escolhas.kit]) outro.chapeu = CHAPEU_DO_KIT[k];
      outro.kit = k;
      if (kitDoItem(outro.item) !== k) outro.item = ITENS_DO_KIT[k][0];
      // a mesma roupa já desenhada não é desenhada de novo
      const chave = JSON.stringify(outro);
      if (img.dataset.chave === chave) return;
      img.dataset.chave = chave;
      img.src = heroiParado({ ...outro, familiar: "nenhum" }).toDataURL();
    });
  }

  function redesenhar() {
    desenharVitrine();
    const kit = AVATAR_OPCOES.kit.valores.find((v) => v.id === escolhas.kit);
    secao.querySelector("[data-kit-nome]").textContent = `${kit.icone} ${kit.nome}`;
    secao.querySelectorAll("[data-aba]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.aba === abaAtual)));
    secao.querySelectorAll(".grupo-criador").forEach((g) => {
      g.hidden = g.dataset.abaGrupo !== abaAtual || (espelho && TRAVADOS_NO_ESPELHO.includes(g.dataset.grupo));
      const atual = escolhas[g.dataset.grupo];
      const botoes = [...g.querySelectorAll("[data-valor]")];
      botoes.forEach((b) => {
        b.setAttribute("aria-pressed", String(b.dataset.valor === atual));
        // cada vocação só mostra as próprias armas
        if (b.dataset.kit) b.hidden = b.dataset.kit !== escolhas.kit;
      });
      // cor fora das amostras: o seletor livre fica marcado e mostra a cor escolhida
      const livre = g.querySelector(".amostra-livre");
      if (livre) {
        const personalizada = Boolean(atual) && !botoes.some((b) => b.dataset.valor === atual);
        livre.classList.toggle("ativa", personalizada);
        livre.style.background = personalizada ? atual : "";
        if (atual) livre.querySelector("input").value = atual;
      }
    });
    // a prévia de cada vocação mostra o próprio aluno vestido com ela: só na aba da vocação, e depois do
    // clique (no quadro seguinte), para a troca de roupa responder na hora
    if (abaAtual === "classe") requestAnimationFrame(atualizarPrevias);
    // o mascote só aparece no seletor de cor se existir
    secao.querySelector('[data-grupo="corFamiliar"]').hidden = abaAtual !== "mascote" || escolhas.familiar === "nenhum";
    const ficha = secao.querySelector("[data-poder-mascote]");
    ficha.hidden = abaAtual !== "mascote";
    ficha.innerHTML = cartaDoMascote(escolhas.familiar);
  }
  secao.querySelectorAll("[data-aba]").forEach((b) => b.addEventListener("click", () => {
    abaAtual = b.dataset.aba;
    redesenhar();
  }));
  secao.querySelectorAll(".grupo-criador").forEach((g) => {
    g.querySelectorAll("[data-valor]").forEach((b) => b.addEventListener("click", () => {
      if (g.dataset.grupo === "kit") trocarKit(b.dataset.valor);
      else escolhas[g.dataset.grupo] = b.dataset.valor;
      // trocou de mascote: volta para a cor natural dele
      if (g.dataset.grupo === "familiar") delete escolhas.corFamiliar;
      redesenhar();
    }));
  });
  secao.querySelectorAll("[data-livre]").forEach((entrada) => entrada.addEventListener("input", () => {
    escolhas[entrada.dataset.livre] = entrada.value;
    redesenhar();
  }));
  secao.querySelector("[data-sortear]").addEventListener("click", (evento) => {
    for (const [chave, grupo] of Object.entries(AVATAR_OPCOES)) {
      if (chave === "item" || (espelho && TRAVADOS_NO_ESPELHO.includes(chave))) continue;
      const liberadas = grupo.valores.filter((v) => liberada(v) && (!v.kit || v.kit === escolhas.kit));
      escolhas[chave] = valorDaOpcao(liberadas[Math.floor(Math.random() * liberadas.length)]);
    }
    const armas = AVATAR_OPCOES.item.valores.filter((v) => v.kit === escolhas.kit && liberada(v));
    escolhas.item = armas[Math.floor(Math.random() * armas.length)].id;
    delete escolhas.corFamiliar;
    faiscas(evento.clientX, evento.clientY, "#a98bff");
    redesenhar();
  });
  secao.querySelector("[data-pronto]").addEventListener("click", (evento) => {
    progresso.avatar = { ...escolhas };
    salvarProgresso();
    atualizarStatus();
    faiscas(evento.clientX, evento.clientY);
    if (espelho) telaInterior("mercado");
    else proximoPasso();
  });
  secao.querySelector("[data-voltar]")?.addEventListener("click", () => telaInterior("mercado"));
  redesenhar();
  tela.replaceChildren(secao);
}

// ---------- escolha de classe ----------

// O Zetsu apresenta a classe principal e as subclasses que o herói vai poder escolher no nível de escolha.
async function telaClasse() {
  Som.musica("abertura");
  window.scrollTo(0, 0);
  const principal = principalDoHeroi();
  const subclasses = JORNADA.classes.filter((s) => s.principal === principal.id);
  const secao = criar('<section class="aptidao"><div data-zetsu></div><div data-classes></div></section>');
  const zetsu = criarZetsu();
  secao.querySelector("[data-zetsu]").replaceWith(zetsu.elemento);
  tela.replaceChildren(secao);

  zetsu.mostrarCena({
    tipo: "destaque", titulo: `${principal.titulo}: o começo do caminho`, icone: principal.icone, efeito: "UAU!",
    texto: `Todo ${principal.titulo.toLowerCase()} começa como **${principal.iniciante.titulo}**. No **nível ${JORNADA.caminho.nivel_escolha}** tu escolhes uma subclasse, com magias e uma passiva só dela.`,
  });
  zetsu.dizer(`Que visual, **${nomeAluno()}**! Um ${principal.titulo.toLowerCase()} ${principal.icone}. “${principal.lema}” Olha os caminhos que te esperam:`);

  secao.querySelector("[data-classes]").replaceChildren(criar(`
    <div class="classes">
      ${subclasses.map((c, i) => `
        <div class="carta-de-classe" style="--cor-classe:${c.cor}; animation-delay:${i * 0.08}s">
          <span class="icone">${c.icone}</span><strong>${escapar(c.titulo)}</strong>
          <em>“${escapar(c.lema)}”</em><small>${escapar(c.descricao)}</small>
          <small class="poderes-previa">${c.magias.map((m) => m.icone).join(" ")} ${c.passiva.icone}</small>
        </div>`).join("")}
    </div>`));

  await zetsu.escolher([{ texto: "Bora, mestre! ⚔️" }], { silencioso: true });
  telaAptidao();
}

// ---------- teste de aptidão e trilha personalizada ----------

// O círculo mágico do ritual, desenhado num canvas atrás de tudo: visto em perspectiva no chão, com
// anéis que giram em sentidos opostos, as marcas do relógio, um hexagrama, as runas, os nós do andamento
// (um por pergunta) e faíscas subindo. pulsar(i, cor) acende o nó i com uma onda de energia e um pilar de
// luz; carregar() acelera tudo e deixa dourado (o fim do ritual); calmo: só gira.
// LEVE de propósito (a versão antiga travava o navegador): cada peça com brilho (anéis, marcas, hexagrama,
// runas, o brilho dos nós) é desenhada UMA vez numa tela guardada; a cada quadro só se gira e cola essas
// telas prontas. Sem shadowBlur no quadro a quadro, resolução 1x, no máximo 30 quadros por segundo,
// faíscas com limite e pausa quando a aba está escondida.
function circuloMagicoRitual(canvas, total = 0, { calmo = false } = {}) {
  const ctx = canvas.getContext("2d");
  const RUNAS = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒ";
  const CIANO = [110, 240, 255];
  const ROXO = [169, 139, 255];
  const OURO = [255, 209, 102];
  const cor = (rgb, a) => `rgba(${rgb.join ? rgb.join(", ") : rgb}, ${a})`;
  const faiscas = [];
  const ondas = [];
  const acesos = new Set();
  let carga = 0; // 0 normal, sobe até 1 no carregar()
  let carregando = false;
  let pilar = 0;
  let corPilar = "110, 240, 255";
  let angulo = 0;
  let ultimo = performance.now();
  let ultimoDesenho = 0;
  let ativo = true;
  let camadas = null; // as telas prontas, refeitas só quando o tamanho muda

  // uma tela quadrada com o centro no meio, onde a peça é desenhada (com brilho) uma vez só
  const telaCamada = (lado, desenhar) => {
    const c = document.createElement("canvas");
    c.width = c.height = lado;
    const g = c.getContext("2d");
    g.translate(lado / 2, lado / 2);
    g.lineCap = "round";
    desenhar(g);
    return c;
  };
  const anel = (g, raio, largura, rgb, alfa, tracejado = null) => {
    g.save();
    g.strokeStyle = cor(rgb, alfa);
    g.lineWidth = largura;
    g.shadowColor = cor(rgb, 0.9);
    g.shadowBlur = 12;
    if (tracejado) g.setLineDash(tracejado);
    g.beginPath();
    g.arc(0, 0, raio, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  };

  // as camadas em duas paletas: a normal (roxo e ciano) e a dourada do fim do ritual
  function montarCamadas(R) {
    // a peça é desenhada com no máximo 440 px de raio e esticada na hora de colar (o brilho segura bem)
    const escala = Math.min(1, 440 / R);
    const r = R * escala;
    const lado = Math.ceil(r * 2 + 40);
    const paleta = (principal, secundaria) => ({
      fixa: telaCamada(lado, (g) => {
        anel(g, r * 0.98, 3, principal, 0.75);
        anel(g, r * 0.3, 2, secundaria, 0.6);
      }),
      relogio: telaCamada(lado, (g) => {
        anel(g, r * 0.9, 2, secundaria, 0.55, [14, 10]);
        g.strokeStyle = cor(principal, 0.7);
        g.lineWidth = 2;
        for (let i = 0; i < 72; i++) {
          const a = (i / 72) * Math.PI * 2;
          const dentro = r * (i % 6 ? 0.94 : 0.91);
          g.beginPath();
          g.moveTo(Math.cos(a) * dentro, Math.sin(a) * dentro);
          g.lineTo(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98);
          g.stroke();
        }
      }),
      dourado: telaCamada(lado, (g) => anel(g, r * 0.62, 2.5, OURO, 0.55, [4, 8])),
      hexagrama: telaCamada(lado, (g) => {
        g.strokeStyle = cor(secundaria, 0.6);
        g.lineWidth = 2;
        g.shadowColor = cor(secundaria, 1);
        g.shadowBlur = 10;
        [0, Math.PI].forEach((base) => {
          g.beginPath();
          for (let k = 0; k <= 3; k++) {
            const a = base + (k / 3) * Math.PI * 2 - Math.PI / 2;
            if (k) g.lineTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
            else g.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
          }
          g.stroke();
        });
      }),
      runas: [...RUNAS].map((runa) => telaCamada(40, (g) => {
        g.font = "22px serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillStyle = cor(secundaria, 1);
        g.shadowColor = cor(secundaria, 1);
        g.shadowBlur = 8;
        g.fillText(runa, 0, 0);
      })),
    });
    const brilhoNo = (rgb) => telaCamada(48, (g) => {
      const luz = g.createRadialGradient(0, 0, 0, 0, 0, 22);
      luz.addColorStop(0, cor(rgb, 1));
      luz.addColorStop(0.3, cor(rgb, 0.8));
      luz.addColorStop(1, cor(rgb, 0));
      g.fillStyle = luz;
      g.fillRect(-24, -24, 48, 48);
    });
    return { R, escala, lado, normal: paleta(ROXO, CIANO), ouro: null, noAceso: brilhoNo(CIANO), noApagado: brilhoNo([120, 110, 160]), paleta };
  }

  function redimensionar() {
    canvas.width = Math.max(1, Math.round(canvas.clientWidth));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight));
    camadas = null;
  }
  redimensionar();
  window.addEventListener("resize", redimensionar);

  function colar(imagem, giro, alfa = 1) {
    if (alfa <= 0.01) return;
    ctx.save();
    ctx.rotate(giro);
    ctx.globalAlpha = alfa;
    const lado = imagem.width / camadas.escala;
    ctx.drawImage(imagem, -lado / 2, -lado / 2, lado, lado);
    ctx.restore();
  }

  function quadro(agora) {
    if (!ativo || !canvas.isConnected) return destruir();
    requestAnimationFrame(quadro);
    // 30 quadros por segundo bastam para um círculo girando devagar; com a aba escondida, nada
    if (document.hidden || agora - ultimoDesenho < 32) return;
    ultimoDesenho = agora;
    const dt = Math.min(0.08, (agora - ultimo) / 1000);
    ultimo = agora;
    const t = agora / 1000;
    if (carregando) carga = Math.min(1, carga + dt * 0.45);
    pilar = Math.max(0, pilar - dt * 1.1);
    angulo += dt * (calmo ? 0.08 : 0.16 + carga * 2.4);
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H * 0.74;
    const R = Math.min(W * 0.46, H * 0.95);
    const achatar = 0.36; // a perspectiva: o círculo está deitado no chão
    if (!camadas || Math.abs(camadas.R - R) > 2) camadas = montarCamadas(R);
    if (carga > 0 && !camadas.ouro) camadas.ouro = camadas.paleta(OURO, OURO);
    const principal = ROXO.map((v, i) => Math.round(v + (OURO[i] - v) * carga));
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(cx, cy);
    ctx.scale(1, achatar);
    // o brilho do chão
    const luz = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    luz.addColorStop(0, cor(principal, 0.22 + carga * 0.25 + pilar * 0.2));
    luz.addColorStop(1, cor(principal, 0));
    ctx.fillStyle = luz;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    // os anéis: a paleta normal some aos poucos e a dourada aparece no lugar
    [["normal", 1 - carga], ["ouro", carga]].forEach(([nome, alfa]) => {
      const p = camadas[nome];
      if (!p || alfa <= 0.01) return;
      colar(p.fixa, 0, alfa);
      colar(p.relogio, angulo * 0.5, alfa);
      colar(p.dourado, -angulo * 1.6, alfa * (0.8 + carga * 0.4));
      colar(p.hexagrama, -angulo * 0.8, alfa);
    });
    // os nós do andamento, um por pergunta
    for (let i = 0; i < total; i++) {
      const a = (i / total) * Math.PI * 2 - Math.PI / 2 + angulo * 0.5;
      const aceso = acesos.has(i);
      const tam = (aceso ? 40 : 22) * (1 + Math.sin(t * 4 + i) * 0.08);
      ctx.globalAlpha = aceso ? 1 : 0.6;
      ctx.drawImage(aceso ? camadas.noAceso : camadas.noApagado, Math.cos(a) * R * 0.98 - tam / 2, Math.sin(a) * R * 0.98 - tam / 2, tam, tam);
    }
    ctx.globalAlpha = 1;
    // as ondas de energia de cada resposta, abrindo no chão
    for (let i = ondas.length - 1; i >= 0; i--) {
      const o = ondas[i];
      o.r += dt * R * 1.4;
      o.a -= dt * 1.2;
      if (o.a <= 0) {
        ondas.splice(i, 1);
        continue;
      }
      if (o.r <= 0) continue; // a segunda onda sai um pouco depois da primeira
      ctx.strokeStyle = cor(o.rgb, o.a);
      ctx.lineWidth = 6 * o.a;
      ctx.beginPath();
      ctx.arc(0, 0, o.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    // as runas: em pé, girando em volta (fora do achatamento, para continuarem legíveis)
    const runas = (carga > 0.5 && camadas.ouro ? camadas.ouro : camadas.normal).runas;
    for (let i = 0; i < runas.length; i++) {
      const a = (i / runas.length) * Math.PI * 2 + angulo * 0.7;
      const frente = (Math.sin(a) + 1) / 2; // as runas da frente brilham mais
      ctx.globalAlpha = 0.35 + frente * 0.6;
      ctx.drawImage(runas[i], Math.round(cx + Math.cos(a) * R * 0.78 - 20), Math.round(cy + Math.sin(a) * R * 0.78 * achatar - 26));
    }
    ctx.globalAlpha = 1;
    // o pilar de luz que sobe do centro (a cada resposta e no fim do ritual)
    const forca = Math.max(pilar, carga * 0.85);
    if (forca > 0.01) {
      const largura = R * 0.16 * (0.6 + forca * 0.6);
      const rgb = carga > 0 ? OURO.join(", ") : corPilar;
      const coluna = ctx.createLinearGradient(0, cy, 0, 0);
      coluna.addColorStop(0, cor(rgb, 0.42 * forca));
      coluna.addColorStop(1, cor(rgb, 0));
      ctx.fillStyle = coluna;
      ctx.beginPath();
      ctx.ellipse(cx, cy, largura, largura * achatar, 0, 0, Math.PI);
      ctx.lineTo(cx - largura * 0.7, 0);
      ctx.lineTo(cx + largura * 0.7, 0);
      ctx.closePath();
      ctx.fill();
    }
    // as faíscas subindo da borda do círculo (mais e mais rápidas quando o ritual carrega), com limite
    const nascem = (calmo ? 12 : 26) * (1 + carga * 3) * dt;
    for (let k = 0; k < nascem + (Math.random() < nascem % 1 ? 1 : 0) && faiscas.length < 110; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = R * (0.3 + Math.random() * 0.68);
      faiscas.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * achatar, vy: -(40 + Math.random() * 90) * (1 + carga * 2), vida: 1, rgb: Math.random() < 0.5 ? principal : CIANO });
    }
    for (let i = faiscas.length - 1; i >= 0; i--) {
      const f = faiscas[i];
      f.vida -= dt * 0.7;
      f.y += f.vy * dt;
      f.x += Math.sin(t * 3 + i) * 0.4;
      if (f.vida <= 0) {
        faiscas.splice(i, 1);
        continue;
      }
      ctx.fillStyle = cor(f.rgb, f.vida);
      ctx.fillRect(f.x, f.y, 3, 3);
    }
    ctx.restore();
  }
  requestAnimationFrame(quadro);

  function destruir() {
    ativo = false;
    window.removeEventListener("resize", redimensionar);
  }
  return {
    pulsar(i, rgb = "110, 240, 255") {
      acesos.add(i);
      corPilar = rgb;
      pilar = 1;
      ondas.push({ r: 0, a: 1, rgb }, { r: -40, a: 0.8, rgb: "255, 209, 102" });
    },
    carregar() {
      carregando = true;
      for (let i = 0; i < total; i++) acesos.add(i);
    },
    destruir,
  };
}

// As respostas do ritual num menu de escolha de RPG clássico: uma janela de diálogo com uma linha por
// opção (ícone, título e a fala do herói) e o cursor ▶ piscando na marcada. Setas ↑ ↓ (ou o mouse)
// movem o cursor, Enter, clique ou as teclas 1 a 4 escolhem; a escolhida pisca e a janela fecha.
// Devolve o índice.
function escolherCartaRitual(secao, opcoes) {
  const n = opcoes.length;
  const menu = criar(`
    <div class="menu-escolha" role="listbox" aria-label="Escolhe uma resposta">
      <p class="titulo-escolha">O que tu respondes?</p>
      ${opcoes.map((o, i) => `
        <button type="button" class="opcao-menu" role="option" data-i="${i}">
          <span class="cursor-menu" aria-hidden="true">▶</span>
          <span class="icone-opcao">${o.icone || "✦"}</span>
          <span class="texto-opcao"><strong>${escapar(o.titulo)}</strong>${o.fala ? `<small>“${escapar(o.fala)}”</small>` : ""}</span>
          <kbd>${i + 1}</kbd>
        </button>`).join("")}
    </div>`);
  secao.append(menu);
  const linhas = [...menu.querySelectorAll(".opcao-menu")];
  let marcada = 0;
  const marcar = (i, som = true) => {
    if (i === marcada && linhas[i].classList.contains("marcada")) return;
    linhas.forEach((l, k) => l.classList.toggle("marcada", k === i));
    marcada = i;
    if (som) Som.efeito("passar");
  };
  marcar(0, false);
  return new Promise((resolve) => {
    let feito = false;
    const escolher = (i) => {
      if (feito || !linhas[i]) return;
      feito = true;
      window.removeEventListener("keydown", teclas);
      marcar(i, false);
      Som.efeito("magia");
      linhas[i].classList.add("escolhida");
      linhas.forEach((l) => { l.disabled = true; });
      setTimeout(() => {
        menu.remove();
        resolve(i);
      }, 520);
    };
    const teclas = (e) => {
      if (!secao.isConnected) return window.removeEventListener("keydown", teclas);
      const k = Number(e.key);
      if (k >= 1 && k <= n) return escolher(k - 1);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        marcar((marcada + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        escolher(marcada);
      }
    };
    window.addEventListener("keydown", teclas);
    linhas.forEach((l, i) => {
      l.addEventListener("pointerenter", () => marcar(i));
      l.addEventListener("click", () => escolher(i));
    });
  });
}

async function telaAptidao() {
  Som.musica("abertura");
  window.scrollTo(0, 0);
  const { perguntas } = await api("/api/aptidao");
  // o ritual: câmara escura, o círculo mágico girando no chão (canvas), velas e os orbes do andamento
  const secao = criar(`
    <section class="aptidao ritual-aptidao">
      <div class="camara-ritual" aria-hidden="true">
        <span class="vitral-ritual"></span><span class="pilar-ritual p1"></span><span class="pilar-ritual p2"></span>
        <span class="feixes-ritual"></span>
        <canvas class="circulo-magico"></canvas>
        <span class="vela v1"></span><span class="vela v2"></span><span class="vela v3"></span><span class="vela v4"></span>
      </div>
      <div class="abertura-ritual" aria-hidden="true"><small>✦ Câmara das Runas ✦</small><strong>O Ritual da Aptidão</strong><i></i></div>
      <div class="progresso-ritual" data-progresso hidden></div>
      <div data-zetsu></div>
    </section>`);
  const zetsu = criarZetsu();
  secao.querySelector("[data-zetsu]").replaceWith(zetsu.elemento);
  tela.replaceChildren(secao);
  const circulo = circuloMagicoRitual(secao.querySelector(".circulo-magico"), perguntas.length);
  // a cor de cada resposta no pilar de luz (ciano, roxo, ouro e verde, na ordem das cartas)
  const CORES_CARTA = ["110, 240, 255", "192, 139, 255", "255, 209, 102", "125, 255, 154"];
  // os orbes de cristal: cada resposta acende um
  const areaProgresso = secao.querySelector("[data-progresso]");
  const desenharProgresso = (feitas) => {
    areaProgresso.hidden = false;
    areaProgresso.innerHTML = `<small>${feitas < perguntas.length ? `Pergunta ${feitas + 1} de ${perguntas.length}` : "As runas falaram"}</small>
      <div>${perguntas.map((_, i) => `<i class="${i < feitas ? "aceso" : i === feitas ? "atual" : ""}"></i>`).join("")}</div>`;
  };
  zetsu.mostrarCena({
    tipo: "fluxo", titulo: "O teste de aptidão",
    itens: [
      { icone: "🗣️", texto: "Tu responde com **sinceridade**" },
      { icone: "🔮", texto: "Eu leio teus **poderes**" },
      { icone: "🗺️", texto: "O reino ganha a **tua trilha**" },
    ],
  });
  zetsu.dizer(`Antes de te soltar no reino, um ritual de toda nova turma: o **teste de aptidão**. Nada de prova, ${nomeAluno()}: é só pra eu saber por onde tu começa.`);
  await zetsu.escolher([{ texto: "Pode perguntar, mestre!" }], { silencioso: true });
  zetsu.esconderCena();

  const respostas = {};
  for (const [k, pergunta] of perguntas.entries()) {
    desenharProgresso(k);
    zetsu.dizer(pergunta.fala);
    const i = await escolherCartaRitual(secao, pergunta.opcoes);
    zetsu.jogadorDiz(pergunta.opcoes[i].fala || pergunta.opcoes[i].titulo);
    respostas[pergunta.chave] = pergunta.opcoes[i].valor;
    Som.efeito("magia");
    // a resposta vira energia: o nó da pergunta acende, uma onda corre o chão e um pilar de luz sobe
    circulo.pulsar(k, CORES_CARTA[i % CORES_CARTA.length]);
    desenharProgresso(k + 1);
    await zetsu.dizer(pergunta.opcoes[i].reacao, { manterJogador: true });
    await new Promise((r) => setTimeout(r, 600));
  }

  // o ritual que gera a trilha: o círculo carrega, as runas giram cada vez mais rápido e tudo clareia
  zetsu.elemento.remove();
  secao.classList.add("carregando-ritual");
  circulo.carregar();
  // o Zetsu no desenho atual dele (pixel nítido), flutuando no meio das runas enquanto traça o caminho
  secao.append(criar(`
    <div class="ritual ritual-zetsu">
      <div class="orbita-zetsu">${[..."ᚠᚱᛟᛉᚨᛇ"].map((r, i) => `<i style="--i:${i}">${r}</i>`).join("")}</div>
      <img class="pixel zetsu-ritual" src="${heroiParado(VISUAL_ZETSU).toDataURL()}" alt="">
      <p>O Zetsu consulta as runas e traça o teu caminho<span class="pontinhos"><b>.</b><b>.</b><b>.</b></span></p>
    </div>`));
  Som.efeito("especial");
  const [trilha] = await Promise.all([api("/api/trilha", respostas), new Promise((r) => setTimeout(r, 2600))]);
  secao.classList.add("clarao-ritual");
  Som.efeito("evolucao");
  await new Promise((r) => setTimeout(r, 450));
  progresso.trilha = trilha;
  salvarProgresso();
  atualizarStatus();
  telaRevelacao(trilha);
}

async function telaRevelacao(trilha) {
  const fases = (await api("/api/fases")).filter((f) => professorDa(f) === "zetsu");
  // a revelação: a carta da classe com raios de luz e a trilha como um mapa de jornada (marcos num caminho
  // dourado), na mesma câmara do ritual
  const identidade = identidadeDaClasse();
  const principal = principalDoHeroi();
  const secao = criar(`
    <section class="aptidao revelacao ritual-aptidao">
      <div class="camara-ritual" aria-hidden="true">
        <span class="vitral-ritual"></span><span class="pilar-ritual p1"></span><span class="pilar-ritual p2"></span>
        <span class="feixes-ritual"></span>
        <canvas class="circulo-magico"></canvas>
        <span class="vela v1"></span><span class="vela v2"></span><span class="vela v3"></span><span class="vela v4"></span>
      </div>
      <div data-zetsu></div>
      <div class="revelacao-grade">
        <div class="carta-revelada" style="--cor-classe:${identidade.cor}">
          <div class="raios-revelacao"></div>
          <small class="sobre-revelada">✦ As runas revelaram ✦</small>
          <img class="pixel heroi-revelado" src="${heroiParado(progresso.avatar).toDataURL()}" alt="">
          <span class="pedestal-revelado"></span>
          <small class="nome-revelado">${escapar(nomeAluno())}, o</small>
          <h2>${identidade.icone} ${escapar(identidade.titulo)}</h2>
          ${principal?.lema ? `<p class="lema-revelado">“${escapar(principal.lema)}”</p>` : ""}
        </div>
        <div class="mapa-trilha">
          <h3>🗺️ Tua trilha pelo Reino</h3>
          <ol class="caminho-trilha">
            ${fases.map((f, i) => {
              const opcional = trilha.opcionais.includes(f.id);
              return `
                <li class="${opcional ? "opcional" : "recomendada"}" style="--i:${i}">
                  <span class="marco-trilha"><b>${f.icone}</b><i>${i + 1}</i></span>
                  <span class="texto-trilha"><strong>${escapar(f.local || f.titulo)}</strong>
                    <small>${escapar(opcional ? trilha.motivos[f.id] : f.subtitulo)}</small></span>
                  <span class="tag ${opcional ? "tag-opcional" : "tag-disponivel"}">${opcional ? "Opcional" : "Recomendada"}</span>
                </li>`;
            }).join("")}
          </ol>
          <button class="botao botao-jogar" type="button" data-mapa>🏰 Entrar na Academia</button>
        </div>
      </div>
    </section>`);
  const zetsu = criarZetsu();
  secao.querySelector("[data-zetsu]").replaceWith(zetsu.elemento);
  secao.querySelector("[data-mapa]").addEventListener("click", () => irPara("academia"));
  tela.replaceChildren(secao);
  circuloMagicoRitual(secao.querySelector(".circulo-magico"), 0, { calmo: true });
  chuvaDeEstrelas(30);
  zetsu.dizer(trilha.fala + (trilha.opcionais.length
    ? " As fases que tu já domina ficam **abertas como opcionais**: entra nelas quando quiser revisar."
    : " Vamos passar por todos os locais do reino, um de cada vez."));
}

// ---------- os três professores ----------

// A Academia tem uma sala por nível. A sala seguinte abre quando o aluno conclui todas as lições
// obrigatórias do professor anterior com pelo menos 70% das estrelas.
const MINIMO_APROVACAO = 0.7;
const PROFESSORES = [
  {
    id: "zetsu", nome: "Mestre Zetsu", icone: "🧙", nivel: "Iniciante", sala: "sala", cor: "#4a2f93", parede: "#4a4170", quadro: "PCTF",
    visual: VISUAL_ZETSU,
  },
  {
    id: "kaela", nome: "Mestra Kaela", icone: "⚙️", nivel: "Intermediário", sala: "sala-kaela", cor: "#1f5c8a", parede: "#3d5470", quadro: "API",
    visual: { corpo: "feminino", pele: "#c98d63", cabelo: "longo", corCabelo: "#1b1b2f", rosto: "confiante", chapeu: "tiara", manto: "#1f5c8a", detalhe: "#f5c451", item: "orbe", magia: "#6ef0ff", acessorio: "oculos", familiar: "nenhum" },
  },
  {
    id: "orion", nome: "Arquimago Orion", icone: "🔭", nivel: "Avançado", sala: "sala-orion", cor: "#7a1f3d", parede: "#5a3a52", quadro: "RAG",
    visual: { pele: "#e9b98f", cabelo: "longo", corCabelo: "#e8e4dc", rosto: "serio", chapeu: "coroa", manto: "#7a1f3d", detalhe: "#f5c451", item: "cajado", magia: "#ff7ad9", aura: "estrelas", acessorio: "barba", familiar: "nenhum" },
  },
];

function professorDa(fase) {
  return fase.professor || "zetsu";
}

function professorPorId(id) {
  return PROFESSORES.find((p) => p.id === id) || PROFESSORES[0];
}

// Como o aluno foi com um professor: quantas lições fez e quantas estrelas tirou nelas.
function desempenhoProfessor(professorId, fases) {
  const opcionais = progresso.trilha ? progresso.trilha.opcionais : [];
  const licoes = fases.filter((f) => professorDa(f) === professorId && !f.em_breve);
  const obrigatorias = licoes.filter((f) => !opcionais.includes(f.id));
  const feitas = licoes.filter((f) => progresso.fases[f.id]);
  const estrelas = feitas.reduce((soma, f) => soma + progresso.fases[f.id].estrelas, 0);
  const maximo = feitas.length * 3;
  const porcentagem = maximo ? estrelas / maximo : 0;
  const todasFeitas = obrigatorias.every((f) => progresso.fases[f.id]);
  return { licoes, feitas, estrelas, maximo, porcentagem, todasFeitas, aprovado: todasFeitas && feitas.length > 0 && porcentagem >= MINIMO_APROVACAO };
}

function salaLiberada(professorId, fases) {
  const indice = PROFESSORES.findIndex((p) => p.id === professorId);
  return indice <= 0 || desempenhoProfessor(PROFESSORES[indice - 1].id, fases).aprovado;
}

function atorDoProfessor(professorId) {
  const professor = professorPorId(professorId);
  if (professor.id === "zetsu") return undefined; // o palco já nasce com o Zetsu
  return { nome: professor.nome.split(" ").pop(), retrato: retratoCorpoInteiro(professor.visual, professor.nome) };
}

// Regras da trilha: opcionais ficam sempre abertas; as recomendadas abrem em ordem, dentro da sala de
// cada professor, e só depois que a sala dele estiver liberada.
function situacaoFases(fases) {
  const opcionais = progresso.trilha ? progresso.trilha.opcionais : [];
  const situacoes = {};
  const anteriorFeita = {};
  const salas = Object.fromEntries(PROFESSORES.map((p) => [p.id, salaLiberada(p.id, fases)]));
  for (const fase of fases) {
    const professor = professorDa(fase);
    const concluida = Boolean(progresso.fases[fase.id]);
    const opcional = opcionais.includes(fase.id);
    const anterior = anteriorFeita[professor] ?? true;
    const disponivel = !fase.em_breve && salas[professor] && (opcional || anterior);
    situacoes[fase.id] = { concluida, opcional, disponivel, estrelas: concluida ? progresso.fases[fase.id].estrelas : 0, atual: false };
    if (!opcional) anteriorFeita[professor] = concluida;
  }
  // o herói fica na primeira fase recomendada que ainda falta; formado, ele sai e fica a bandeira de vitória
  const proxima = fases.find((f) => !situacoes[f.id].opcional && situacoes[f.id].disponivel && !situacoes[f.id].concluida);
  if (proxima) situacoes[proxima.id].atual = true;
  return situacoes;
}

function abrirMissao(fase, s) {
  const modalMissao = document.getElementById("modal-missao");
  const bloqueada = !s.disponivel && !s.concluida;
  let aviso = "";
  if (bloqueada) aviso = "🔒 A névoa ainda cobre este lugar. Conclua as fases recomendadas anteriores para chegar aqui.";
  else if (s.opcional && !s.concluida) aviso = `✨ Fase opcional: ${progresso.trilha.motivos[fase.id] || "revisão para quem já domina o assunto."}`;
  modalMissao.innerHTML = `
    <div class="missao-conteudo">
      <div class="icone-missao">${fase.icone}</div>
      <p class="local">Fase ${fase.id} · ${escapar(fase.local || "")}</p>
      <h2>${escapar(fase.titulo)}</h2>
      <p>${escapar(fase.subtitulo)}</p>
      <div class="recompensa">
        <span>🪙 ${fase.xp} XP</span>
        <span class="estrelas">${estrelasHtml(s.estrelas)}</span>
      </div>
      ${aviso ? `<p class="aviso">${escapar(aviso)}</p>` : ""}
      <div class="acoes">
        <button class="botao botao-fantasma" type="button" data-fechar>Voltar</button>
        ${bloqueada ? "" : `<button class="botao" type="button" data-iniciar>${s.concluida ? "Jogar de novo ↻" : "Iniciar missão ⚔️"}</button>`}
      </div>
    </div>`;
  modalMissao.querySelector("[data-fechar]").addEventListener("click", () => modalMissao.close());
  modalMissao.querySelector("[data-iniciar]")?.addEventListener("click", () => {
    modalMissao.close();
    jogarFase(fase.id);
  });
  modalMissao.showModal();
}

// ---------- Academia e Reino ----------

// ---------- o Salão do multijogador e as outras telas ----------
// Quem está no Salão só sai de lá quando escolhe: pelo portão, pelo menu de pausa (Academia, trocar de
// aventureiro, sair) ou confirmando um "ir até" das quests. Tudo que só "volta ao mapa" (o fim da Prova do
// Degrau, o Mercado, vestir uma peça, os créditos) devolve ao Salão, no mesmo lugar.
function estaNoSalao() {
  return typeof SALAO !== "undefined" && Boolean(SALAO.ativo);
}
function deixarOSalao() {
  if (typeof SALAO === "undefined") return;
  SALAO.ativo = false;
  sairDoSalao(true);
}
async function confirmarSaidaDoSalao(destino) {
  if (!estaNoSalao()) return true;
  const sim = await confirmarRPG({
    titulo: "Sair do Salão?", icone: "🚪", confirmar: "Ir", cancelar: "Ficar no Salão",
    texto: `Isso te leva para ${destino} e tu sais do multijogador. Para voltar, é pelo Multijogador do menu inicial.`,
  });
  if (sim) deixarOSalao();
  return sim;
}

function telaMapa() {
  if (estaNoSalao()) return telaSalao({ posicao: SALAO.ultimaPosicao });
  if (progresso.local === "umbra") return umbraLiberada() ? telaUmbra() : telaReino();
  return progresso.local === "reino" ? telaReino() : telaAcademia();
}

function irPara(destino) {
  deixarOSalao(); // ir para a Academia, o Reino ou Umbraterra é sempre uma escolha (o menu, um portal)
  progresso.local = destino;
  salvarProgresso();
  if (destino === "umbra") {
    Som.efeito("rugido");
    return transicaoPixel("🌀 Atravessando a Fenda da Ruptura...", "#140a22", () => telaUmbra(), {
      forma: "portal", duracao: 900,
      carregar: { tema: "umbra", titulo: "Umbraterra", sobretitulo: "O Abismo da Ruptura", icone: "🌀", avatar: progresso.avatar, minimo: 2200 },
    });
  }
  const reino = destino === "reino";
  transicaoPixel(reino ? "Rumo ao Reino de Elyndor..." : "Rumo à Academia...", reino ? "#2f6b45" : "#1a1240",
    () => (reino ? telaReino() : telaAcademia("lobby", { origem: "entrada", comPortoes: true })), {
      carregar: reino
        ? { tema: "reino", titulo: "Reino de Elyndor", sobretitulo: "Rumo ao", icone: "🗺️", avatar: progresso.avatar, minimo: 1800 }
        : { tema: "academia", titulo: "Academia Arcana", sobretitulo: "Rumo à", icone: "🏰", avatar: progresso.avatar, minimo: 1800 },
    });
}

// ---------- Academia ----------

// Os colegas de turma que circulam pelo lobby.
const ALUNOS = [
  {
    id: "lia", nome: "Lia, a Aprendiz", tx: 8, ty: 9,
    visual: { corpo: "feminino", pele: "#f6d3b3", cabelo: "coque", corCabelo: "#b5532a", chapeu: "tiara", manto: "#2e5cb8", item: "varinha", magia: "#ffb347" },
    falas: ["Tô treinando P-C-T-F na Torre do Prompt: Papel, Contexto, Tarefa e Formato!", "Dizem que quem confere as fontes nunca cai na Cripta das Alucinações."],
  },
  {
    id: "tome", nome: "Tomé, o Curioso", tx: 25, ty: 10,
    visual: { pele: "#9a6440", cabelo: "cacheado", corCabelo: "#2b1d14", chapeu: "nenhum", manto: "#1f7a5c", item: "grimorio", acessorio: "oculos", magia: "#7dff9a" },
    falas: ["Uma vez colei um token num prompt. O Zetsu me fez revogar na hora!", "Tu viu o cristal da fonte? Dizem que brilha mais quando alguém escreve um bom prompt."],
  },
  {
    id: "nara", nome: "Nara, a Veterana", tx: 12, ty: 20,
    visual: { corpo: "feminino", pele: "#c98d63", cabelo: "trancas", corCabelo: "#2b1d14", chapeu: "nenhum", manto: "#a8323e", item: "espadaEscudo", magia: "#ff7ad9" },
    falas: ["Dica de veterana: os slimes do Reino perguntam o que tu já estudou. Revisa antes de sair!", "A Brina do Mercado vende Poção da Clareza. Já me salvou numa dungeon."],
  },
  {
    id: "kai", nome: "Kai, o Artífice", tx: 21, ty: 20,
    visual: { pele: "#e9b98f", cabelo: "raspado", corCabelo: "#6b3e1f", chapeu: "boina", manto: "#c46a1b", item: "orbe", acessorio: "cachecol", magia: "#6ef0ff" },
    falas: ["Se repete, um script pode fazer. Esse é o meu lema!", "Monta um dashboard no Grafana de treino da Arena. É muito satisfatório."],
  },
  {
    id: "bardo", nome: "Lírio, o Bardo", tx: 24, ty: 18, bardo: true,
    visual: { pele: "#e9b98f", cabelo: "cacheado", corCabelo: "#e2b04a", rosto: "sorriso", chapeu: "boina", manto: "#2e8b57", detalhe: "#ffd166", item: "varinha", magia: "#ffd166", acessorio: "cachecol" },
    falas: [
      "🎵 *Na Torre do Prompt um mago escreveu: Papel, Contexto, Tarefa... e o Formato venceu!* 🎵",
      "🎵 *Não cola tua senha no prompt, ó aprendiz, que o dragão do vazamento te deixa infeliz!* 🎵",
      "Dizem que o dragãozinho que voa na fonte nasceu de um ovo que o Arquimago Orion chocou com magia de RAG. Eu acredito!",
      "🎵 *Três mestres guardam as portas do saber: Zetsu, Kaela e Orion... setenta por cento pra vencer!* 🎵",
      "Já leste os livros da biblioteca? A Mestra Lúmen paga em moedas quem chega ao fim. Melhor plateia que a minha!",
    ],
  },
];
const CURANDEIRA = { nome: "Irmã Flora, a Curandeira", visual: { corpo: "feminino", pele: "#f1c9a5", cabelo: "longo", corCabelo: "#e8e4dc", chapeu: "capuz", manto: "#e9e4d4", detalhe: "#4fd1a5", item: "orbe", magia: "#7dff9a" } };
const BIBLIOTECARIA = { nome: "Mestra Lúmen, a Bibliotecária", visual: { corpo: "feminino", pele: "#e0b48c", cabelo: "coque", corCabelo: "#9aa0b5", chapeu: "nenhum", manto: "#1f5c4a", detalhe: "#f5c451", item: "grimorio", acessorio: "oculos", magia: "#f5c451" } };

// As estantes da biblioteca, da esquerda para a direita. "nome" é o mesmo campo "estante" do biblioteca.json.
const ESTANTES = [
  // curto: o nome na plaquinha em cima da estante (são 6 lado a lado)
  { id: "programacao", nome: "Programação", curto: "Código", icone: "💻", cor: "#3776ab" },
  { id: "automacao", nome: "Automação", curto: "Automação", icone: "⚙️", cor: "#34a853" },
  { id: "ia", nome: "Inteligência Artificial", curto: "IA", icone: "🔮", cor: "#8e5cff" },
  { id: "prompt", nome: "Arte do Prompt", curto: "Prompts", icone: "🪄", cor: "#e76f51" },
  { id: "seguranca", nome: "Segurança e Ética", curto: "Segurança", icone: "🛡️", cor: "#c0392b" },
  { id: "trabalho", nome: "IA no Trabalho", curto: "Trabalho", icone: "💼", cor: "#2a9d8f" },
];
// só para mostrar nas estantes; quem paga é o servidor (RECOMPENSA_LEITURA em jogador.py)
const RECOMPENSA_LIVRO = { xp: 30, moedas: 15 };

// A especialista da Sala da Carreira: IA no dia a dia do trabalho e no mercado.
const MENTORA = {
  nome: "Íris, a Mentora de Carreira",
  visual: { corpo: "feminino", pele: "#9a6440", cabelo: "cacheado", corCabelo: "#2b1d14", rosto: "confiante", chapeu: "nenhum", manto: "#c46a1b", detalhe: "#f5c451", item: "grimorio", magia: "#ffb347", acessorio: "brinco", familiar: "nenhum" },
  dicas: [
    "Comece pelas tarefas **chatas e fáceis de conferir**: ata de reunião, e-mail padrão, resumo. É ali que a IA mais economiza tempo com menos risco.",
    "No currículo, troque \"sei usar IA\" por um **resultado com número**: \"reduzi o relatório de 3h para 20min\".",
    "Antes de colar qualquer coisa numa IA, pergunte: **eu postaria isso num grupo público?** Se não, anonimiza ou usa só ferramenta aprovada.",
    "Monte tua **biblioteca de prompts**: cada prompt que funciona bem vira um atalho para sempre.",
    "Na entrevista, recrutador gosta de **senso crítico**: conte uma vez em que a IA errou e como tu percebeu.",
    "A IA escreve o rascunho. **Tu assina embaixo.** Se não assinaria, ainda não está pronto.",
    "Não existe a melhor IA: existe a melhor **para a tua tarefa e permitida pela tua empresa**. Testa duas lado a lado.",
  ],
};
const cacheLivros = {};
const cacheCapas = {}; // a capa em pixel de cada livro, já virada imagem (não refaz a cada página)

// Uma conversa rápida por cima do mapa, sem sair dele.
function falarCom(nome, visual, fala, botoes = []) {
  const modalMissao = document.getElementById("modal-missao");
  modalMissao.innerHTML = `
    <div class="missao-conteudo conversa-mapa">
      <img class="pixel retrato-conversa" src="${heroiParado(visual).toDataURL()}" alt="">
      <p class="local">${escapar(nome)}</p>
      <p class="fala-conversa">${formatar(fala)}</p>
      <div class="acoes">
        ${botoes.map((b, i) => `<button class="botao ${b.fantasma ? "botao-fantasma" : ""}" type="button" data-i="${i}">${b.texto}</button>`).join("")}
        <button class="botao botao-fantasma" type="button" data-fechar>Até mais!</button>
      </div>
    </div>`;
  modalMissao.querySelector("[data-fechar]").addEventListener("click", () => modalMissao.close());
  modalMissao.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => {
    modalMissao.close();
    botoes[Number(b.dataset.i)].acao();
  }));
  modalMissao.showModal();
}

// Texto dos livros: parágrafos separados por linha em branco; blocos com "- " viram lista e com "1. " lista numerada.
function textoLivroHtml(texto) {
  return texto.split("\n\n").map((bloco) => {
    const linhas = bloco.split("\n");
    if (linhas.every((l) => l.startsWith("- "))) return `<ul>${linhas.map((l) => `<li>${formatar(l.slice(2))}</li>`).join("")}</ul>`;
    if (linhas.every((l) => /^\d+\. /.test(l))) return `<ol>${linhas.map((l) => `<li>${formatar(l.replace(/^\d+\. /, ""))}</li>`).join("")}</ol>`;
    return `<p>${linhas.map(formatar).join("<br>")}</p>`;
  }).join("");
}

// Código dos livros, com os comentários em outra cor para facilitar a leitura.
const MARCA_COMENTARIO = { python: /(^|\s)#/, powershell: /(^|\s)#/, bash: /(^|\s)#/, javascript: /(^|\s)\/\//, sql: /(^|\s)--/ };
function codigoLivroHtml(codigo, linguagem) {
  const marca = MARCA_COMENTARIO[linguagem];
  const linhas = codigo.split("\n").map((linha) => {
    const achou = marca && linha.match(marca);
    if (!achou) return escapar(linha);
    const inicio = achou.index + achou[1].length;
    return `${escapar(linha.slice(0, inicio))}<span class="comentario">${escapar(linha.slice(inicio))}</span>`;
  });
  return `<div class="bloco-codigo"><button class="copiar" type="button" data-copiar>Copiar</button><pre><code>${linhas.join("\n")}</code></pre></div>`;
}

function abrirModal(modal) {
  if (!modal.open) modal.showModal();
}

// A trilha que o jogo puxa para o herói: a da subclasse ou, no iniciante, a da classe principal.
function trilhaPreferida() {
  return classeDoHeroi()?.trilha || principalDoHeroi()?.trilha_inicial || null;
}

function livroCombina(livro) {
  return Boolean(trilhaPreferida()) && JORNADA.trilhas.estantes?.[livro.estante] === trilhaPreferida();
}

// os livros que combinam com o caminho do herói vêm primeiro (e os já lidos por último)
function livrosParaMim(livros) {
  const lidos = progresso.livrosLidos || [];
  return [...livros].sort((a, b) => (lidos.includes(a.id) - lidos.includes(b.id)) || (livroCombina(b) - livroCombina(a)));
}

// A estante aberta: uma prateleira de madeira com as lombadas dos livros em pé (cor, ícone e título na
// vertical, alturas diferentes, fita dourada nos lidos e estrela nos que combinam com o caminho do herói).
// Passar o mouse puxa o livro um pouco para fora e mostra o resumo dele embaixo; clicar abre.
function abrirEstante(estante, livros) {
  const modalMissao = document.getElementById("modal-missao");
  const lidos = progresso.livrosLidos || [];
  const daEstante = livrosParaMim(livros.filter((l) => l.estante === estante.nome));
  const identidade = identidadeDaClasse();
  const resumo = (l) => `
    <span class="icone-livro">${l.icone}</span>
    <span>
      ${livroCombina(l) ? `<span class="tag tag-disponivel">⭐ Para teu caminho de ${escapar(identidade.titulo)}</span>` : ""}
      <strong>${escapar(l.titulo)}</strong>
      <small>${escapar(l.resumo)}</small>
      <em>${l.capitulos} capítulos${lidos.includes(l.id) ? " · ✔ lido" : ` · 🪙 ${RECOMPENSA_LIVRO.moedas} + ⭐ ${RECOMPENSA_LIVRO.xp} XP`}${(progresso.leitura || {})[l.id] ? ` · 🔖 cap. ${progresso.leitura[l.id] + 1}` : ""}</em>
    </span>`;
  modalMissao.innerHTML = `
    <div class="missao-conteudo estante-pixel" style="--cor-estante:${estante.cor}">
      <p class="local">${estante.icone} Estante</p>
      <h2>${escapar(estante.nome)}</h2>
      <div class="prateleira">
        ${daEstante.map((l, i) => `
          <button class="lombada ${lidos.includes(l.id) ? "lido" : ""} ${livroCombina(l) ? "combina" : ""}" type="button" data-livro="${l.id}"
            style="--cor-livro:${l.cor}; --altura:${150 + ((i * 37) % 4) * 12}px; --i:${i}" title="${escapar(l.titulo)}">
            <span class="icone-lombada">${l.icone}</span>
            <span class="titulo-lombada">${escapar(l.titulo)}</span>
          </button>`).join("")}
        <span class="tabua"></span>
      </div>
      <div class="resumo-estante" data-resumo>${daEstante[0] ? resumo(daEstante[0]) : ""}</div>
      <div class="acoes"><button class="botao botao-fantasma" type="button" data-fechar>Fechar</button></div>
    </div>`;
  const caixaResumo = modalMissao.querySelector("[data-resumo]");
  modalMissao.querySelector("[data-fechar]").addEventListener("click", () => modalMissao.close());
  modalMissao.querySelectorAll("[data-livro]").forEach((b) => {
    const livro = daEstante.find((l) => l.id === b.dataset.livro);
    const mostrar = () => { caixaResumo.innerHTML = resumo(livro); };
    b.addEventListener("mouseenter", mostrar);
    b.addEventListener("focus", mostrar);
    b.addEventListener("click", () => {
      Som.efeito("passar");
      abrirLivro(b.dataset.livro, () => abrirEstante(estante, livros), (progresso.leitura || {})[b.dataset.livro] || 0);
    });
  });
  abrirModal(modalMissao);
}

// A capa em pixel art de um livro: o couro na cor dele, cantoneiras de ouro e o ícone no meio
function capaDoLivro(livro) {
  return spriteReino(`capa-livro-${livro.id}`, () => {
    const { canvas, ctx } = criarTela(40, 52);
    retangulo(ctx, 0, 0, 40, 52, tom(livro.cor, 0.5));
    retangulo(ctx, 2, 1, 37, 50, livro.cor);
    retangulo(ctx, 2, 1, 4, 50, tom(livro.cor, 0.7)); // a lombada
    retangulo(ctx, 9, 5, 26, 1, "#f5c451");
    retangulo(ctx, 9, 46, 26, 1, "#f5c451");
    [[7, 3], [35, 3], [7, 47], [35, 47]].forEach(([x, y]) => retangulo(ctx, x, y, 3, 3, "#f5c451"));
    ctx.drawImage(emojiCanvas(livro.icone, 22), 10, 15, 22, 22);
    return contornar(canvas);
  });
}

// fonte: "biblioteca" (livros das estantes) ou "carreira" (guias da Mentora de Carreira)
// O livro aberto em pixel: capa de couro na cor do livro, duas páginas de pergaminho com a costura no meio
// e uma fita marcadora. Na esquerda, a capa em pixel art e o sumário (✔ nos capítulos já lidos); na
// direita, o capítulo com letra capitular, o código (se tiver) e, no fim, o "Teste teu saber" com as
// perguntas de batalha que saem daquele capítulo. Trocar de capítulo vira a página (para a frente ou
// para trás). O marcador guarda onde o herói parou (progresso.leitura).
async function abrirLivro(id, aoVoltar, capitulo = 0, fonte = "biblioteca", direcao = 0) {
  const modalMissao = document.getElementById("modal-missao");
  const chave = `${fonte}:${id}`;
  if (!cacheLivros[chave]) cacheLivros[chave] = await api(`/api/${fonte}/${id}`);
  const livro = cacheLivros[chave];
  const total = livro.capitulos.length;
  capitulo = Math.max(0, Math.min(total - 1, capitulo));
  const cap = livro.capitulos[capitulo];
  progresso.leitura = { ...(progresso.leitura || {}), [id]: capitulo };
  const vistos = new Set([...(progresso.capitulosLidos?.[id] || []), capitulo]);
  progresso.capitulosLidos = { ...(progresso.capitulosLidos || {}), [id]: [...vistos] };
  salvarProgresso();
  // virando a página do mesmo livro já aberto: só a página da direita, o sumário e os números trocam (o
  // resto do livro fica, sem redesenhar tudo nem refazer a animação de abrir)
  const aberto = direcao && modalMissao.open ? modalMissao.querySelector(`.livro-pixel[data-livro="${CSS.escape(chave)}"]`) : null;
  const capaUrl = (cacheCapas[livro.id] ||= capaDoLivro(livro).toDataURL());
  const html = `
    <div class="livro-pixel" data-livro="${escapar(chave)}" style="--cor-livro:${livro.cor}">
      <span class="fita-livro"></span>
      <aside class="pagina-esquerda">
        <img class="pixel capa-pixel" src="${capaUrl}" alt="">
        <strong class="titulo-livro">${escapar(livro.titulo)}</strong>
        <small class="estante-livro">${fonte === "carreira" ? "Guia da Mentora Íris" : escapar(livro.estante || "")}</small>
        <ol class="sumario-pixel">${livro.capitulos.map((c, i) => `
          <li><button type="button" data-cap="${i}" class="${i === capitulo ? "atual" : ""} ${vistos.has(i) ? "lido" : ""}">
            <b>${i + 1}</b><span>${escapar(c.titulo)}</span>${vistos.has(i) && i !== capitulo ? "<i>✔</i>" : ""}</button></li>`).join("")}
        </ol>
        <button class="botao botao-fantasma" type="button" data-voltar>${fonte === "carreira" ? "◂ Voltar à sala" : "◂ Voltar à estante"}</button>
      </aside>
      <article class="pagina-direita ${direcao > 0 ? "virando-frente" : direcao < 0 ? "virando-tras" : ""}">
        <p class="local">✦ Capítulo ${capitulo + 1} de ${total} ✦</p>
        <h2>${escapar(cap.titulo)}</h2>
        <div class="texto-capitulo">${textoLivroHtml(cap.texto)}</div>
        ${cap.codigo ? `<p class="linguagem-codigo">${escapar(cap.linguagem || "")}</p>${codigoLivroHtml(cap.codigo, cap.linguagem)}` : ""}
        <div class="teste-capitulo" data-teste>
          <button class="botao botao-teste" type="button" data-testar>⚔️ Teste teu saber neste capítulo</button>
        </div>
        <div class="acoes navegacao-livro">
          <button class="botao botao-fantasma" type="button" data-ir="${capitulo - 1}" ${capitulo === 0 ? "disabled" : ""}>◂ Página anterior</button>
          ${capitulo === total - 1
            ? '<button class="botao" type="button" data-terminar>✔ Terminei o livro</button>'
            : `<button class="botao" type="button" data-ir="${capitulo + 1}">Virar a página ▸</button>`}
        </div>
      </article>
      <span class="numero-pagina esquerda">${capitulo * 2 + 1}</span><span class="numero-pagina direita">${capitulo * 2 + 2}</span>
    </div>`;
  if (aberto) {
    const novo = document.createElement("template");
    novo.innerHTML = html.trim();
    const livroNovo = novo.content.firstElementChild;
    [".pagina-direita", ".sumario-pixel", ".numero-pagina.esquerda", ".numero-pagina.direita"].forEach((seletor) => {
      aberto.querySelector(seletor).replaceWith(livroNovo.querySelector(seletor));
    });
  } else {
    modalMissao.innerHTML = html;
    modalMissao.querySelector("[data-voltar]").addEventListener("click", aoVoltar);
  }
  ativarCopiar(modalMissao.querySelector(".pagina-direita"));
  const virar = (para) => {
    Som.efeito("passar");
    abrirLivro(id, aoVoltar, para, fonte, Math.sign(para - capitulo));
  };
  modalMissao.querySelectorAll("[data-cap]").forEach((b) => b.addEventListener("click", () => virar(Number(b.dataset.cap))));
  modalMissao.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => virar(Number(b.dataset.ir))));
  modalMissao.querySelector("[data-terminar]")?.addEventListener("click", () => terminarLivro(livro, aoVoltar, fonte));
  modalMissao.querySelector("[data-testar]").addEventListener("click", () => testeDoCapitulo(modalMissao.querySelector("[data-teste]"), fonte, id, capitulo));
  modalMissao.querySelector(".pagina-direita").scrollTop = 0;
  abrirModal(modalMissao);
}

// O teste rápido do fim do capítulo: até 3 perguntas de batalha que saem dele, corrigidas pelo servidor.
// É só treino (não dá prêmio): a graça é chegar na batalha já sabendo.
async function testeDoCapitulo(caixa, fonte, id, capitulo) {
  caixa.innerHTML = '<p class="legenda">Abrindo as perguntas...</p>';
  const perguntas = await api(`/api/praticar/${fonte}/${id}/${capitulo}`);
  if (!perguntas.length) {
    caixa.innerHTML = '<p class="legenda">📜 Este capítulo ainda não tem perguntas de batalha. Segue a leitura!</p>';
    return;
  }
  let acertos = 0;
  const mostrar = (k) => {
    if (k >= perguntas.length) {
      caixa.innerHTML = `<div class="resultado-teste ${acertos === perguntas.length ? "perfeito" : ""}">
        <strong>${acertos === perguntas.length ? "🏆 Perfeito!" : acertos ? "⚔️ Bom treino!" : "📖 Relê com calma"}</strong>
        <span>${acertos} de ${perguntas.length} certas. ${acertos === perguntas.length ? "Os monstros que perguntarem isso vão se arrepender." : "Essas mesmas perguntas aparecem nas batalhas."}</span></div>`;
      if (acertos === perguntas.length) chuvaDeEstrelas(16);
      return;
    }
    const p = perguntas[k];
    caixa.innerHTML = `
      <div class="pergunta-teste">
        <small>Pergunta ${k + 1} de ${perguntas.length}</small>
        ${p.cenario ? `<blockquote>${p.cenario.de ? `<b>${escapar(p.cenario.de)}:</b> ` : ""}${escapar(p.cenario.texto)}</blockquote>` : ""}
        <strong>${formatar(p.pergunta)}</strong>
        ${p.codigo ? codigoLivroHtml(p.codigo, "python") : ""}
        <div class="opcoes-teste">${p.opcoes.map((o, i) => `<button type="button" data-resp="${i}">${formatar(o)}</button>`).join("")}</div>
      </div>`;
    caixa.querySelectorAll("[data-resp]").forEach((b) => b.addEventListener("click", async () => {
      caixa.querySelectorAll("[data-resp]").forEach((x) => { x.disabled = true; });
      const r = await api("/api/praticar/corrigir", { ref: p.ref, resposta: Number(b.dataset.resp) });
      if (r.correta) acertos += 1;
      Som.efeito(r.correta ? "acerto" : "erro");
      b.classList.add(r.correta ? "certa" : "errada");
      caixa.querySelector(`[data-resp="${r.resposta_certa}"]`)?.classList.add("certa");
      caixa.querySelector(".pergunta-teste").insertAdjacentHTML("beforeend", `
        <p class="explicacao-teste">${r.correta ? "✅" : "❌"} ${escapar(r.explicacao)}</p>
        <button class="botao" type="button" data-proxima>${k + 1 < perguntas.length ? "Próxima ▸" : "Ver o resultado ▸"}</button>`);
      caixa.querySelector("[data-proxima]").addEventListener("click", () => mostrar(k + 1));
    }));
  };
  mostrar(0);
}

async function terminarLivro(livro, aoVoltar, fonte = "biblioteca") {
  const modalMissao = document.getElementById("modal-missao");
  // quem decide se a leitura vale moedas (só a primeira vez) é o servidor
  const { primeiraVez, ganhos } = await acaoJogador("leitura", { fonte, id: livro.id });
  if (primeiraVez) chuvaDeEstrelas(14);
  modalMissao.innerHTML = `
    <div class="missao-conteudo">
      <div class="icone-missao">${livro.icone}</div>
      <p class="local">${fonte === "carreira" ? "Guia concluído" : "Livro concluído"}</p>
      <h2>${escapar(livro.titulo)}</h2>
      ${primeiraVez ? listaGanhos(ganhos) : "<p>Releitura não dá moedas, mas o saber fica ainda mais firme. 📚</p>"}
      <div class="acoes">
        <button class="botao" type="button" data-voltar>${fonte === "carreira" ? "Voltar à sala" : "Escolher outro livro"}</button>
        <button class="botao botao-fantasma" type="button" data-fechar>Fechar</button>
      </div>
    </div>`;
  modalMissao.querySelector("[data-voltar]").addEventListener("click", aoVoltar);
  modalMissao.querySelector("[data-fechar]").addEventListener("click", () => modalMissao.close());
}

function estadoLicao(s) {
  if (s.concluida) return "concluida";
  if (!s.disponivel) return "bloqueada";
  return s.opcional ? "opcional" : "disponivel";
}

const SALAS_ACADEMIA = {
  lobby: ["Academia Arcana", "Anda com <kbd>WASD</kbd> ou clicando. A porta grande leva à sala do Zetsu e a verde, à biblioteca."],
  sala: ["Sala do Zetsu · Iniciante", "Cada grimório é uma lição. Chega perto e aperta <kbd>E</kbd> para estudar."],
  "sala-kaela": ["Sala da Kaela · Intermediário", "Automação de verdade: scripts robustos, ferramentas, APIs e Git."],
  "sala-orion": ["Sala do Orion · Avançado", "A magia mais alta: RAG, agentes, segurança e IA em produção."],
  biblioteca: ["Biblioteca da Academia", "Cada estante guarda os livros de uma área. Chega perto e aperta <kbd>E</kbd> para ler."],
  carreira: ["Sala da Carreira", "IA no trabalho e no mercado: cada móvel guarda um guia da Mentora Íris."],
};

function nomeDaSala(professor) {
  const [titulo, nome] = professor.nome.split(" ");
  return `Sala ${titulo.endsWith("a") ? "da" : "do"} ${nome}`;
}

// A conversa com o professor dentro da sala dele: a próxima lição, ou como o aluno foi.
function falaDoProfessor(professor, fases, situacoes) {
  const desempenho = desempenhoProfessor(professor.id, fases);
  const porcentagem = Math.round(desempenho.porcentagem * 100);
  const seguinte = PROFESSORES[PROFESSORES.indexOf(professor) + 1];
  const proxima = fases.find((f) => professorDa(f) === professor.id && situacoes[f.id].disponivel && !situacoes[f.id].concluida && !situacoes[f.id].opcional);
  if (proxima) return `Hoje a lição é **${proxima.local}**: ${proxima.titulo}. O grimório dela está brilhando em dourado!`;
  if (!desempenho.aprovado) {
    return `Tu concluíste minhas lições, ${nomeAluno()}, mas com **${porcentagem}%** das estrelas. Refaz as lições com menos estrelas até chegar a **${MINIMO_APROVACAO * 100}%**${seguinte ? ` e a porta da ${nomeDaSala(seguinte).replace("Sala ", "sala ")} se abre` : ""}.`;
  }
  if (seguinte) return `Mandou bem: **${porcentagem}%** das estrelas! A ${nomeDaSala(seguinte).replace("Sala", "sala")} está aberta para ti, no lobby. Volta aqui quando quiser revisar.`;
  return `**${porcentagem}%** das estrelas na trilha mais difícil da Academia. Tu és um verdadeiro arquimago, ${nomeAluno()}.`;
}

// A porta trancada explica o que falta para abrir.
function falaDaPortaTrancada(professor, fases) {
  const anterior = PROFESSORES[PROFESSORES.indexOf(professor) - 1];
  const d = desempenhoProfessor(anterior.id, fases);
  const obrigatorias = d.licoes.filter((f) => !(progresso.trilha?.opcionais || []).includes(f.id)).length;
  const feitas = d.licoes.filter((f) => progresso.fases[f.id] && !(progresso.trilha?.opcionais || []).includes(f.id)).length;
  return `*(uma voz atravessa a porta)* Ainda não, ${nomeAluno()}. Minha porta só abre para quem concluir as lições do **${anterior.nome}** com pelo menos **${MINIMO_APROVACAO * 100}% das estrelas**. Teu progresso: **${feitas} de ${obrigatorias}** lições e **${Math.round(d.porcentagem * 100)}%** das estrelas.`;
}

// A Academia é um mundo: o lobby, as salas dos três professores (onde ficam as lições) e a biblioteca.
async function telaAcademia(sala = progresso.salaAcademia || "lobby", { origem, comPortoes = false } = {}) {
  Som.musica("academia");
  window.scrollTo(0, 0);
  const fases = await api("/api/fases");
  const professorDaSala = PROFESSORES.find((p) => p.sala === sala);
  if (!SALAS_ACADEMIA[sala] || (professorDaSala && !salaLiberada(professorDaSala.id, fases))) sala = "lobby";
  progresso.local = "academia";
  progresso.salaAcademia = sala;
  salvarProgresso();
  const situacoes = situacaoFases(fases);
  const livros = sala === "biblioteca" ? await api("/api/biblioteca") : [];
  const guias = sala === "carreira" ? await api("/api/carreira") : [];
  const [titulo, dica] = SALAS_ACADEMIA[sala];

  const secao = criar(`
    <section class="tela-mundo academia">
      <div class="cabecalho-mapa">
        <div>
          <h2 class="titulo-pixel">${titulo}</h2>
          <p>${dica}</p>
        </div>
      </div>
      <div class="mapa-reino" data-mundo></div>
    </section>`);
  if (formado(fases)) {
    const faixa = criar(`
      <div class="faixa-formatura">
        <span>🎓</span>
        <div><strong>Tu te formaste na Academia!</strong><p>Toda a tua trilha está concluída. Teu certificado te espera.</p></div>
        <button class="botao" type="button">Ver meu certificado</button>
      </div>`);
    faixa.querySelector("button").addEventListener("click", () => telaCertificado(fases));
    secao.querySelector("[data-mundo]").after(faixa);
  }
  tela.replaceChildren(secao);
  atualizarModoMundo(); // já em tela cheia antes de o motor medir o mapa
  const area = secao.querySelector("[data-mundo]");

  const portas = PROFESSORES.slice(1).map((p) => ({ id: p.sala, nome: nomeDaSala(p), icone: p.icone, cor: p.cor, liberada: salaLiberada(p.id, fases) }));
  let cenario;
  if (professorDaSala) {
    cenario = cenarioSala({
      origem,
      professor: professorDaSala,
      licoes: fases.filter((f) => professorDa(f) === professorDaSala.id)
        .map((f) => ({ id: f.id, icone: f.icone, estado: estadoLicao(situacoes[f.id]), atual: situacoes[f.id].atual })),
    });
  } else if (sala === "biblioteca") cenario = cenarioBiblioteca({ origem, estantes: ESTANTES });
  else if (sala === "carreira") cenario = cenarioCarreira({ origem, guias, mentora: MENTORA });
  else cenario = cenarioLobby({ origem, alunos: ALUNOS, portas });

  const modalMissao = document.getElementById("modal-missao");
  const lerGuia = (guia) => abrirLivro(guia.id, () => modalMissao.close(), 0, "carreira");

  montarMundo(area, cenario, {
    avatar: progresso.avatar,
    nomeHeroi: nomeAluno(),
    tituloHeroi: principalDoHeroi() ? seloDoTitulo() : "",
    aura: auraDoHeroi(),
    aoMover: () => {},
    aoEntrar: (lugar) => {
      const salaDoProfessor = PROFESSORES.find((p) => p.sala === lugar.id);
      if (salaDoProfessor) {
        if (lugar.liberada === false) return falarCom(salaDoProfessor.nome, salaDoProfessor.visual, falaDaPortaTrancada(salaDoProfessor, fases));
        return telaAcademia(lugar.id, { origem: "lobby" });
      }
      if (lugar.id === "biblioteca") return telaAcademia("biblioteca", { origem: "lobby" });
      if (lugar.id === "carreira") return telaAcademia("carreira", { origem: "lobby" });
      if (lugar.guia) return lerGuia(lugar.guia);
      if (lugar.id === "mentora") {
        const naoLido = guias.find((g) => !(progresso.livrosLidos || []).includes(g.id));
        const caminho = trilhaPreferida() === "trabalho" ? ` Teu caminho de **${identidadeDaClasse().titulo}** combina demais com esta sala.` : "";
        const fala = `${sortear(MENTORA.dicas)}${caminho} ${naoLido
          ? `Quer um bom próximo passo? Lê o guia **${naoLido.titulo}**.`
          : "Tu já leste todos os meus guias. Agora é colocar em prática!"}`;
        return falarCom(MENTORA.nome, MENTORA.visual, fala, naoLido ? [{ texto: `${naoLido.icone} Abrir o guia`, acao: () => lerGuia(naoLido) }] : []);
      }
      if (lugar.id === "saida") return telaAcademia("lobby", { origem: sala });
      if (lugar.id === "portoes") return irPara("reino");
      if (lugar.estante) return abrirEstante(lugar.estante, livros);
      if (lugar.id === "bibliotecaria") {
        const naoLido = livrosParaMim(livros).find((l) => !(progresso.livrosLidos || []).includes(l.id));
        if (!naoLido) {
          return falarCom(BIBLIOTECARIA.nome, BIBLIOTECARIA.visual, `Tu já leste todos os livros desta biblioteca, ${nomeAluno()}! Poucos aprendizes chegam tão longe. Volta sempre para reler.`);
        }
        const estante = ESTANTES.find((e) => e.nome === naoLido.estante);
        return falarCom(BIBLIOTECARIA.nome, BIBLIOTECARIA.visual,
          `Shhh... bem-vindo, ${nomeAluno()}. Aqui o saber é livre: **Programação** à esquerda, **Automação** no meio e **Inteligência Artificial** à direita. Cada livro lido até o fim vale moedas e XP. ${livroCombina(naoLido)
            ? `Para um ${identidadeDaClasse().titulo} como tu, eu separei este: *${naoLido.titulo}*.`
            : `Que tal começar por *${naoLido.titulo}*?`}`,
          [{ texto: `${naoLido.icone} Ler agora`, acao: () => abrirLivro(naoLido.id, () => abrirEstante(estante, livros)) }]);
      }
      if (lugar.id === "enfermaria") {
        const ferido = vidaAtual() < vidaMaxima();
        if (ferido) acaoJogador("enfermaria");
        return falarCom(CURANDEIRA.nome, CURANDEIRA.visual, ferido
          ? "Deita aqui um pouquinho... Pronto! **Tua vida está cheia de novo.** ❤️"
          : `Tu tá ótimo, ${nomeAluno()}! Volta aqui se algum slime te machucar.`);
      }
      if (lugar.id === "professor") {
        const botoes = formado(fases) ? [{ texto: "🎓 Ver certificado", acao: () => telaCertificado(fases) }] : [];
        return falarCom(professorDaSala.nome, professorDaSala.visual, falaDoProfessor(professorDaSala, fases, situacoes), botoes);
      }
      if (lugar.licao) {
        const fase = fases.find((f) => f.id === lugar.licao.id);
        return abrirMissao(fase, situacoes[fase.id]);
      }
      const aluno = ALUNOS.find((a) => a.id === lugar.id);
      if (aluno) falarCom(aluno.nome, aluno.visual, sortear(aluno.falas));
    },
  });
  if (comPortoes) portoesAbrindo(area);

  // uma sala acabou de abrir: o professor novo vem receber o aluno no lobby
  progresso.salasAbertas = progresso.salasAbertas || ["zetsu"];
  const novo = PROFESSORES.find((p) => salaLiberada(p.id, fases) && !progresso.salasAbertas.includes(p.id));
  if (sala === "lobby" && novo) {
    progresso.salasAbertas.push(novo.id);
    salvarProgresso();
    setTimeout(() => {
      if (!area.isConnected) return;
      chuvaDeEstrelas(30);
      falarCom(novo.nome, novo.visual,
        `A runa da minha porta se apagou, ${nomeAluno()}! Tu provaste teu valor. A **${nomeDaSala(novo).replace("Sala", "sala")}** (nível ${novo.nivel.toLowerCase()}) está aberta, aqui no lobby.`,
        [{ texto: "Entrar agora ▸", acao: () => telaAcademia(novo.sala, { origem: "lobby" }) }]);
    }, comPortoes ? 2400 : 700);
  }
}

// ---------- Reino ----------

async function telaReino() {
  Som.musica("reino");
  window.scrollTo(0, 0);
  progresso.local = "reino";
  salvarProgresso();
  const [fases, dungeons, puzzles, combate] = await Promise.all([api("/api/fases"), api("/api/dungeons"), api("/api/puzzles"), api("/api/monstros")]);
  const resolvidos = progresso.puzzlesResolvidos || [];
  puzzles.forEach((p) => { p.resolvido = resolvidos.includes(p.id); });
  const lugares = [
    { id: "portal", tipo: "portal", nome: "Portal da Academia", icone: "🏰", liberada: true },
    { id: "mercado", tipo: "mercado", nome: "Mercado", icone: "🏪", liberada: true },
    { id: "estalagem", tipo: "estalagem", nome: "Estalagem do Grifo", icone: "🍺", liberada: true },
    { id: "forja", tipo: "forja", nome: "Casa da Forja", icone: "⚒️", liberada: true },
    { id: "fenda", tipo: "fenda", nome: "Fenda da Ruptura", icone: "🌀", liberada: umbraLiberada() },
    ...dungeons.filter((d) => d.mundo !== "umbra").map((d) => ({
      id: d.id, tipo: "dungeon", nome: d.nome, icone: d.icone,
      liberada: Boolean(progresso.fases[d.requer_fase]), vencida: Boolean((progresso.dungeons[d.id] || {}).vitorias),
    })),
  ];
  const secao = criar(`
    <section class="tela-mundo reino">
      <div class="cabecalho-mapa">
        <div>
          <h2 class="titulo-pixel">Reino de Elyndor</h2>
          <p>Anda com <kbd>WASD</kbd> ou as setas, ou clica no chão. Chega perto de um lugar e aperta <kbd>E</kbd> para entrar.</p>
        </div>
        <div class="minimapa" data-minimapa title="Mapa do Reino (M)">
          <div class="relogio-reino" data-relogio-reino>
            <span class="icone-hora"></span><b class="hora"></b><small class="vira"></small>
            <i class="barra-periodo"><i></i></i>
          </div>
          <canvas class="pixel"></canvas>
          <span class="regiao-atual"></span>
        </div>
      </div>
      <div class="mapa-reino" data-mundo></div>
      <div class="rastreador-quest" data-rastreador-quest hidden></div>
    </section>`);
  tela.replaceChildren(secao);
  atualizarModoMundo();
  cidadeAtual = null;
  atualizarRastreadorQuest();

  const nivel = nivelDe(progresso.xp);
  const mundo = montarMundo(secao.querySelector("[data-mundo]"), cenarioReino(lugares, puzzles, combate, JORNADA.regioes, nivel), {
    avatar: progresso.avatar,
    nomeHeroi: nomeAluno(),
    tituloHeroi: principalDoHeroi() ? seloDoTitulo() : "",
    aura: auraDoHeroi(),
    // posição salva num mapa antigo (antes do Reino crescer) não vale: o herói volta para o portal
    posicao: progresso.posicaoReino?.mapa === VERSAO_MAPA ? progresso.posicaoReino : null,
    aoMover: (pos) => {
      progresso.posicaoReino = { ...pos, mapa: VERSAO_MAPA };
      verificarCidade(pos.x, pos.y); // chegou numa cidade: a faixa com o nome e o objetivo "visitar"
    },
    aoBarreira: (regiao) => avisoFlutuante("🔒", regiao.nome, `Uma barreira mágica protege esta região. Chega ao nível ${regiao.nivelMinimo} para atravessar (tu tá no ${nivel}).`),
    aoEntrar: (lugar) => {
      const { id } = lugar;
      salvarProgresso();
      if (id === "portal") return irPara("academia");
      if (id === "fenda") return entrarNaFenda();
      if (id === "mercado") return telaInterior("mercado");
      if (id === "estalagem") return telaInterior("estalagem");
      if (id === "forja") return telaInterior("forja");
      if (lugar.puzzle) return abrirPuzzle(lugar.puzzle);
      if (lugar.habitante) return conversarComMorador(lugar.habitante);
      if (lugar.placa) return abrirPlaca(lugar.placa.texto);
      const dungeon = dungeons.find((d) => d.id === id);
      if (dungeon) abrirDungeon(dungeon, fases);
    },
    aoEncontro: encontroNoMapa,
  });
  montarMinimapa(secao.querySelector("[data-minimapa]"), mundo, lugares, puzzles);
  // a primeira vez no Reino abre a história com a cena do capítulo I
  if (!(progresso.quests?.concluidas || []).length) tocarCenaDaHistoria("capitulo-1");
}

// ---------- a mecânica de cada chefão ----------
// Cada chefão luta de um jeito: um efeito nas cartas de resposta que atrapalha a vista (névoa, gelo,
// reflexos que trocam de lugar, maré, tremor...), anunciado na primeira rodada. A resposta continua a
// mesma: as cartas mudam de lugar só na tela (CSS order), o número de cada uma é o de sempre.
const MECANICAS_CHEFE = {
  reiSlime: { nome: "Gosma Pegajosa", texto: "As cartas balançam como gelatina.", classe: "mec-gosma" },
  fenrir: { nome: "Uivo da Lua", texto: "Cada uivo sacode a tela. Na fúria, só a carta sob o teu cursor fica clara.", classe: "mec-uivo" },
  sapoRei: { nome: "Névoa Alucinante", texto: "As cartas ficam embaçadas: passa o mouse (ou o foco) para enxergar.", classe: "mec-nevoa" },
  escorpiaoImperador: { nome: "Veneno", texto: "O veneno faz as letras tremerem.", classe: "mec-veneno" },
  ignis: { nome: "Asas de Fogo", texto: "Brasas caem sobre as cartas.", classe: "mec-brasas" },
  colossoMagma: { nome: "Terremoto", texto: "O chão treme e as cartas pulam de tempos em tempos.", classe: "mec-terremoto" },
  rainhaCristal: { nome: "Reflexos", texto: "Os cristais trocam as cartas de lugar. Lê com atenção!", classe: "mec-reflexo", trocar: true },
  leviata: { nome: "Maré do Abismo", texto: "As cartas sobem e descem com a maré.", classe: "mec-mare" },
  ymir: { nome: "Congelamento", texto: "As cartas chegam congeladas: espera o gelo quebrar.", classe: "mec-gelo", congelar: 2400 },
  nyxar: { nome: "Sombra das Asas", texto: "A sombra das asas passa por cima das cartas.", classe: "mec-sombra" },
  vazio: { nome: "A Fome do Vazio", texto: "As cartas somem e voltam. Na última fase, o Vazio também troca tudo de lugar.", classe: "mec-vazio", trocar: (fase) => fase >= 3 },
};

function aplicarMecanicaDoChefe(secao, tipoId, fase, primeira) {
  const m = MECANICAS_CHEFE[tipoId];
  if (!m) return;
  secao.classList.add(m.classe);
  secao.dataset.faseChefe = fase;
  if (primeira) avisoFlutuante("⚠️", `Mecânica: ${m.nome}`, m.texto);
  const area = secao.querySelector(".escolhas-dialogo");
  const cartas = [...area.querySelectorAll(".fala-opcao")];
  if (m.congelar) {
    area.classList.add("congelada");
    Som.efeito("erro");
    setTimeout(() => {
      area.classList.remove("congelada");
      Som.efeito("passar");
    }, m.congelar);
  }
  const trocar = typeof m.trocar === "function" ? m.trocar(fase) : m.trocar;
  if (trocar && cartas.length > 1) {
    // depois de um instante, as cartas trocam de lugar (só a ordem na tela)
    setTimeout(() => {
      if (!area.isConnected || area.hidden) return;
      const ordem = cartas.map((_, i) => i).sort(() => Math.random() - 0.5);
      cartas.forEach((c, i) => { c.style.order = ordem[i]; });
      area.classList.remove("trocando");
      void area.offsetWidth;
      area.classList.add("trocando");
      Som.efeito("magia");
    }, 1600);
  }
}

// ---------- de onde vem cada pergunta ----------
// O servidor manda a "fonte" de cada pergunta de batalha: um capítulo da biblioteca ({ tipo: "livro" }),
// um guia da Sala da Carreira ({ tipo: "guia" }), uma lição dos mestres ou uma dungeon.

function textoDaFonte(f) {
  if (f.tipo === "livro" || f.tipo === "guia") {
    return `${f.icone || "📖"} <b>${escapar(f.titulo)}</b> · Cap. ${f.capitulo + 1}: ${escapar(f.capituloTitulo)}`;
  }
  return f.tipo === "dungeon" ? `${f.icone || "🗝️"} Dungeon: <b>${escapar(f.titulo)}</b>` : `🎓 Lição: <b>${escapar(f.titulo)}</b>`;
}

function estudeEm(f) {
  if (f.tipo === "livro") return `📖 *Estuda isso em* **${f.titulo}**, cap. ${f.capitulo + 1} (${f.capituloTitulo}), na Biblioteca.`;
  if (f.tipo === "guia") return `💼 *Estuda isso em* **${f.titulo}**, cap. ${f.capitulo + 1} (${f.capituloTitulo}), na Sala da Carreira.`;
  return f.tipo === "dungeon" ? `🗝️ *Essa pergunta vem da dungeon* **${f.titulo}**.` : `🎓 *Essa pergunta vem da lição* **${f.titulo}**.`;
}

// abre o capítulo por cima da tela (a batalha continua por baixo, esperando)
function abrirFonte(f) {
  if (!f || !["livro", "guia"].includes(f.tipo)) return;
  const modal = document.getElementById("modal-missao");
  abrirLivro(f.id, () => modal.close(), f.capitulo, f.tipo === "guia" ? "carreira" : "biblioteca");
}

// Encostou num monstro no mapa (Reino ou Umbraterra): a tela se fecha num círculo vermelho com o nome
// dele e começa a batalha.
function encontroNoMapa(monstro, opcoes = {}) {
  // a primeira vez contra um chefão: a cena de entrada dele antes da luta
  if (monstro.chefe) return entradaDoChefe(monstro, () => comecarLuta(monstro, opcoes));
  comecarLuta(monstro, opcoes);
}

// Fecha tudo que estiver aberto por cima do jogo (menu, livro, pergaminho, mochila): a luta, uma cena ou
// uma tela nova nunca começa com uma janela velha aberta na frente.
function fecharJanelasAbertas() {
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  document.querySelector(".inventario.aberto")?.querySelector("[data-fechar]")?.click();
}

function comecarLuta(monstro, { golpe = false } = {}) {
  fecharJanelasAbertas();
  salvarProgresso();
  Som.efeito(monstro.chefe ? "rugido" : "critico");
  transicaoPixel(`${golpe ? "☄️" : "⚔️"} ${monstro.nome}!`, monstro.chefe ? "#3a0612" : "#5a0f1e", () => telaEncontro({
    id: monstro.id, tipoId: monstro.tipoId, nome: monstro.nome, moedas: monstro.moedas, xp: monstro.xp, nivel: monstro.nivel,
    forca: monstro.forca, vida: monstro.vida || 1, dano: monstro.dano || 1, chefe: monstro.chefe, premio: monstro.premio,
    imagem: monstro.sprite.toDataURL(), golpe, regiao: monstro.regiao, sprite: monstro.sprite, quadros: monstro.quadros,
  }), { forma: "batalha", duracao: monstro.chefe ? 560 : 440, espera: monstro.chefe ? 800 : 420 });
}

// ---------- Umbraterra, o Abismo da Ruptura ----------
// O segundo mapa, muito mais difícil: só abre quando o herói chega ao último degrau da subclasse (o
// último título). O servidor confere de novo em cada batalha e dungeon de lá.

function umbraLiberada() {
  return Boolean(statusServidor?.umbraterra) || (identidadeDaClasse().ultimo && Boolean(classeDoHeroi()));
}

function entrarNaFenda() {
  if (umbraLiberada()) return irPara("umbra");
  const classe = classeDoHeroi();
  const ultimo = classe ? classe.evolucoes[classe.evolucoes.length - 1] : null;
  avisoFlutuante("🌀", "A Fenda da Ruptura está selada", ultimo
    ? `Só quem chega ao último degrau da subclasse atravessa: ${ultimo.titulo} (${requisitoDoDegrau(ultimo, classe)}).`
    : "Só quem chega ao último degrau da subclasse atravessa. Escolhe tua subclasse e segue o caminho até o fim.");
}

async function telaUmbra() {
  Som.musica("umbra");
  window.scrollTo(0, 0);
  progresso.local = "umbra";
  salvarProgresso();
  const [fases, dungeons, combate] = await Promise.all([api("/api/fases"), api("/api/dungeons"), api("/api/monstros")]);
  const dasTrevas = dungeons.filter((d) => d.mundo === "umbra");
  const lugares = [
    { id: "volta-reino", tipo: "portal", nome: "Voltar ao Reino", icone: "🗺️", liberada: true },
    ...dasTrevas.map((d) => ({
      id: d.id, tipo: "dungeon", nome: d.nome, icone: d.icone,
      liberada: Boolean(progresso.fases[d.requer_fase]), vencida: Boolean((progresso.dungeons[d.id] || {}).vitorias),
    })),
  ];
  const secao = criar(`
    <section class="tela-mundo reino umbra">
      <div class="cabecalho-mapa">
        <div>
          <h2 class="titulo-pixel">Umbraterra</h2>
          <p>O Abismo da Ruptura. Aqui os monstros batem forte e as perguntas são as mais difíceis do jogo.</p>
        </div>
        <div class="minimapa" data-minimapa title="Mapa de Umbraterra">
          <canvas class="pixel"></canvas>
          <span class="regiao-atual"></span>
        </div>
      </div>
      <div class="mapa-reino" data-mundo></div>
      <div class="rastreador-quest" data-rastreador-quest hidden></div>
    </section>`);
  tela.replaceChildren(secao);
  atualizarModoMundo();
  atualizarRastreadorQuest();
  const nivel = nivelDe(progresso.xp);
  const mundo = montarMundo(secao.querySelector("[data-mundo]"), cenarioUmbra(lugares, combate, JORNADA.regioes, nivel), {
    avatar: progresso.avatar,
    nomeHeroi: nomeAluno(),
    tituloHeroi: principalDoHeroi() ? seloDoTitulo() : "",
    aura: auraDoHeroi(),
    posicao: progresso.posicaoUmbra?.mapa === VERSAO_UMBRA ? progresso.posicaoUmbra : null,
    aoMover: (pos) => { progresso.posicaoUmbra = { ...pos, mapa: VERSAO_UMBRA }; },
    aoBarreira: (regiao) => avisoFlutuante("🔒", regiao.nome, `A escuridão daqui só deixa passar heróis de nível ${regiao.nivelMinimo} (tu tá no ${nivel}).`),
    aoEntrar: (lugar) => {
      salvarProgresso();
      if (lugar.id === "volta-reino") return irPara("reino");
      if (lugar.habitante) return conversarComMorador(lugar.habitante);
      if (lugar.placa) return abrirPlaca(lugar.placa.texto);
      const dungeon = dasTrevas.find((d) => d.id === lugar.id);
      if (dungeon) abrirDungeon(dungeon, fases);
    },
    aoEncontro: encontroNoMapa,
  });
  montarMinimapaUmbra(secao.querySelector("[data-minimapa]"), mundo, lugares);
}

// ---------- minimapa do Reino ----------

const NOMES_REGIOES_MAPA = [
  ["Montanhas do Dragão", 150, 18, "montanhas"], ["Floresta Uivante", 64, 92, "floresta"], ["Pântano", 70, 206, "pantano"],
  ["Deserto dos Bugs", 280, 60, "deserto"], ["Campos", 226, 120, "campos"],
];

// O retrato do herói para o minimapa: a cabeça do sprite dentro de um medalhão dourado (guardado por visual).
let marcadorGuardado = { chave: null, canvas: null };
function marcadorDoHeroi(T) {
  const chave = `${T}:${JSON.stringify(progresso.avatar || {})}`;
  if (marcadorGuardado.chave === chave) return marcadorGuardado.canvas;
  const corpo = heroiParado(progresso.avatar);
  const { canvas, ctx } = criarTela(T, T);
  const borda = Math.max(2, Math.round(T / 12));
  const circulo = (r, cor) => {
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.arc(T / 2, T / 2, r, 0, Math.PI * 2);
    ctx.fill();
  };
  circulo(T / 2, "#1b1533");
  circulo(T / 2 - borda / 2, "#f5c451");
  const dentro = T / 2 - borda * 1.5;
  circulo(dentro, "#3d2f74");
  ctx.save();
  ctx.beginPath();
  ctx.arc(T / 2, T / 2, dentro, 0, Math.PI * 2);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  // um quadrado do topo do sprite (chapéu e rosto), ampliado para encher o medalhão
  const lado = Math.round(corpo.width * 0.62);
  ctx.drawImage(corpo, Math.round((corpo.width - lado) / 2), Math.round(corpo.height * 0.04), lado, lado, T / 2 - dentro, T / 2 - dentro, dentro * 2, dentro * 2);
  ctx.restore();
  marcadorGuardado = { chave, canvas };
  return canvas;
}

function montarMinimapa(caixa, mundo, lugares, puzzles) {
  const canvas = caixa.querySelector("canvas");
  const rotuloRegiao = caixa.querySelector(".regiao-atual");
  const base = miniMapaReino();
  const ESCALA = 2;
  canvas.width = base.width * ESCALA;
  canvas.height = base.height * ESCALA;
  const ctx = canvas.getContext("2d");
  const corDoLugar = (l) => (l.tipo === "dungeon" ? (l.liberada ? "#ff4d6d" : "#8a8799") : l.id === "portal" ? "#6ef0ff" : "#ffd166");
  const relogioReino = caixa.querySelector("[data-relogio-reino]");

  // O relógio do Reino: hora do dia (1 minuto de verdade = 1 hora) e quanto falta para anoitecer ou amanhecer.
  function desenharRelogio(momento) {
    const horas = Math.floor(momento.hora);
    const minutos = Math.floor((momento.hora - horas) * 60 / 10) * 10; // de 10 em 10, para não ficar piscando
    const falta = Math.ceil(momento.faltam);
    const contagem = `${Math.floor(falta / 60)}:${String(falta % 60).padStart(2, "0")}`;
    relogioReino.querySelector(".icone-hora").textContent = momento.icone;
    relogioReino.querySelector(".hora").textContent = `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
    relogioReino.querySelector(".vira").textContent = momento.noite ? `🌅 amanhece em ${contagem}` : `🌙 anoitece em ${contagem}`;
    relogioReino.title = `${momento.nome} no Reino. Cada minuto de verdade é uma hora daqui.${momento.noite
      ? " À noite saem as criaturas da noite (e pagam +25%)." : ""}`;
    relogioReino.classList.toggle("noite", momento.noite);
    // a barrinha enche ao longo do período atual (o dia claro ou a noite)
    const duracao = (momento.noite ? 24 - HORA_ANOITECE + HORA_AMANHECE : HORA_ANOITECE - HORA_AMANHECE) * DURACAO_DIA / 24;
    relogioReino.querySelector(".barra-periodo i").style.width = `${Math.max(0, 100 - (momento.faltam / duracao) * 100)}%`;
  }

  function desenharMinimapa() {
    const ampliado = caixa.classList.contains("ampliado");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
    ctx.drawImage(sombraRegioesTrancadas(nivelDe(progresso.xp)), 0, 0, canvas.width, canvas.height);
    // o minimapa escurece junto com o Reino (os marcadores ficam por cima, sempre visíveis)
    const momento = momentoDoDia();
    if (momento.laranja > 0) {
      ctx.fillStyle = `rgba(255, 120, 40, ${0.18 * momento.laranja})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (momento.escuridao > 0.01) {
      ctx.fillStyle = `rgba(10, 12, 42, ${momento.escuridao * 0.85})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    desenharRelogio(momento);
    const piscar = Math.floor(Date.now() / 400) % 2;
    // o canvas é reduzido pelo CSS: os marcadores crescem junto para continuarem do mesmo tamanho na tela
    const s = Math.max(1, (canvas.width / (canvas.clientWidth || canvas.width)) / 2.2);
    const quadrado = (x, y, lado, cor, borda = "#1b1533") => {
      const l = Math.round(lado * s);
      ctx.fillStyle = borda;
      ctx.fillRect(Math.round(x - l / 2) - 1, Math.round(y - l / 2) - 1, l + 2, l + 2);
      ctx.fillStyle = cor;
      ctx.fillRect(Math.round(x - l / 2), Math.round(y - l / 2), l, l);
    };
    lugares.forEach((l) => {
      const [cx, cy] = POSICAO_LUGARES[l.id];
      quadrado(cx * ESCALA, cy * ESCALA, 4, corDoLugar(l));
    });
    // as cidades: o ícone sempre; o nome em dourado com o mapa ampliado
    ctx.textAlign = "center";
    CIDADES.forEach((c) => {
      const [x, y] = c.centro.map((v) => v * ESCALA);
      ctx.font = `${Math.round(12 * s)}px sans-serif`;
      ctx.fillText(c.icone, x, y + Math.round(4 * s));
      if (!ampliado) return;
      ctx.font = `${Math.round(22 * Math.min(s, 1.4))}px 'Jersey 10', sans-serif`;
      const largura = ctx.measureText(c.nome).width + 12;
      // a capital tem o porto logo embaixo: o nome dela vai em cima da muralha
      const ny = c.id === "elyndor" ? (c.y0 - 2) * ESCALA : (c.y1 + 3) * ESCALA + 12;
      ctx.fillStyle = "rgba(20, 16, 32, 0.8)";
      ctx.fillRect(x - largura / 2, ny - 15, largura, 21);
      ctx.fillStyle = "#ffd166";
      ctx.fillText(c.nome, x, ny + 1);
    });
    // moradores com quest: "!" (ou "?" para entregar) em dourado na história e azul nas outras
    HABITANTES.forEach((h) => {
      const quest = estadoQuestNpc(h.id);
      if (!quest) return;
      ctx.font = `bold ${Math.round(11 * s)}px 'Jersey 10', sans-serif`;
      ctx.lineWidth = Math.max(2, s);
      ctx.strokeStyle = "#1b1205";
      ctx.strokeText(quest.marca, h.tx * ESCALA, h.ty * ESCALA);
      ctx.fillStyle = quest.principal ? "#ffd166" : "#6ec8ff";
      ctx.fillText(quest.marca, h.tx * ESCALA, h.ty * ESCALA);
    });
    // covis dos chefões ainda de pé: caveira vermelha
    CHEFES.filter((c) => !(progresso.chefesDerrotados || []).includes(`chefe-${c.tipoId}`)).forEach((c) => {
      ctx.font = `bold ${Math.round(9 * s)}px sans-serif`;
      ctx.fillText("💀", c.tx * ESCALA, c.ty * ESCALA + Math.round(3 * s));
    });
    puzzles.filter((p) => !p.resolvido).forEach((p) => {
      const [cx, cy] = POSICAO_PUZZLES[p.id];
      quadrado(cx * ESCALA, cy * ESCALA, 2.4, piscar ? "#fff3b0" : "#c9a227", "transparent");
    });
    if (ampliado) {
      ctx.font = "19px 'Jersey 10', sans-serif";
      ctx.textAlign = "center";
      NOMES_REGIOES_MAPA.forEach(([nome, x, y, id]) => {
        const trancada = !regiaoLiberada(id, nivelDe(progresso.xp));
        const texto = trancada ? `🔒 ${nome} · Nv. ${REGIOES[id].nivelMinimo}` : nome;
        ctx.fillStyle = "rgba(20, 16, 32, 0.75)";
        const largura = ctx.measureText(texto).width + 10;
        ctx.fillRect(x * ESCALA - largura / 2, y * ESCALA - 13, largura, 18);
        ctx.fillStyle = trancada ? "#c9b8ff" : "#ffe9b0";
        ctx.fillText(texto, x * ESCALA, y * ESCALA + 1);
      });
    }
    // o herói: o rosto dele numa moldura dourada, pequenininho e parado
    const hx = Math.round((mundo.heroi.x / TILE) * ESCALA);
    const hy = Math.round((mundo.heroi.y / TILE) * ESCALA);
    // o canvas é reduzido pelo CSS: o medalhão mede ~15 px na tela, aberto ou ampliado (sem piscar)
    const T = Math.max(16, Math.min(48, Math.round((15 * canvas.width) / (canvas.clientWidth || canvas.width))));
    const marcador = marcadorDoHeroi(T);
    ctx.drawImage(marcador, hx - marcador.width / 2, hy - marcador.height / 2);
    const regiao = regiaoNoPonto(mundo.heroi.x, mundo.heroi.y);
    rotuloRegiao.innerHTML = `📍 ${escapar(regiao.nome)} <span title="Perigo">${"☠".repeat(regiao.perigo)}</span>`;
  }
  const relogio = setInterval(() => {
    if (!caixa.isConnected || !mundo.ativo()) return clearInterval(relogio);
    desenharMinimapa();
  }, 250);
  desenharMinimapa();
  const alternar = () => {
    caixa.classList.toggle("ampliado");
    desenharMinimapa();
  };
  caixa.addEventListener("click", alternar);
  const teclaM = (e) => {
    if (!caixa.isConnected) return window.removeEventListener("keydown", teclaM);
    if ((e.key === "m" || e.key === "M") && !document.querySelector("dialog[open]") && !(e.target instanceof Element && e.target.closest("input, textarea"))) alternar();
  };
  window.addEventListener("keydown", teclaM);
}

// ---------- enigmas e placas do Reino ----------

function abrirPlaca(texto) {
  const modalMissao = document.getElementById("modal-missao");
  modalMissao.innerHTML = `
    <div class="missao-conteudo">
      <div class="icone-missao">🪧</div>
      <p class="local">Placa da estrada</p>
      <p class="fala-placa">${formatar(texto)}</p>
      <div class="acoes"><button class="botao" type="button" data-fechar>Seguir viagem</button></div>
    </div>`;
  modalMissao.querySelector("[data-fechar]").addEventListener("click", () => modalMissao.close());
  abrirModal(modalMissao);
}

// Uma barra de tempo que esvazia: dourada enquanto vale o bônus rápido, vermelha no fim.
// Chama aoAcabar quando zera; devolve uma função para parar.
function relogioEmBarra(area, tempo, aoAcabar) {
  area.hidden = false;
  area.innerHTML = '<div class="barra-relogio"></div><span></span>';
  const barra = area.firstElementChild;
  const rotulo = area.lastElementChild;
  const comeco = performance.now();
  let quadro = null;
  const passo = () => {
    if (!area.isConnected) return;
    const passou = (performance.now() - comeco) / 1000;
    const resta = Math.max(0, tempo.limite - passou);
    const rapido = passou <= tempo.rapido;
    barra.style.width = `${(resta / tempo.limite) * 100}%`;
    area.classList.toggle("relampago", rapido);
    area.classList.toggle("urgente", resta <= tempo.limite * 0.25);
    rotulo.textContent = rapido ? `⚡ bônus rápido: ${Math.ceil(tempo.rapido - passou)}s` : `⏳ ${Math.ceil(resta)}s`;
    if (resta <= 0) return aoAcabar();
    quadro = requestAnimationFrame(passo);
  };
  quadro = requestAnimationFrame(passo);
  return () => cancelAnimationFrame(quadro);
}

// Enigma do mapa: charada com alternativas, lacuna no código, "ordene os passos" ou verdadeiro ou falso
// relâmpago. Tem relógio (rápido vale +50% no tesouro), soma na Sequência e, errando, o enigma solta um
// golpe que dá para aparar.
async function abrirPuzzle(p) {
  const modalMissao = document.getElementById("modal-missao");
  const recompensa = [`🪙 ${p.recompensa.moedas}`, `⭐ ${p.recompensa.xp} XP`,
    ...Object.entries(p.recompensa.itens || {}).map(([id, qtd]) => `${itemDoCatalogo(id).icone} ×${qtd}`)];
  const cabecalho = `
    <div class="icone-missao">${p.movel === "bau" ? "🗝️" : "🔮"}</div>
    <p class="local">${escapar(p.regiao)} · Enigma</p>
    <h2>${escapar(p.nome)}</h2>`;
  if (p.resolvido) {
    modalMissao.innerHTML = `
      <div class="missao-conteudo">${cabecalho}
        <p>✓ Tu já desvendaste este enigma e levaste o tesouro.</p>
        <div class="acoes"><button class="botao" type="button" data-fechar>Fechar</button></div>
      </div>`;
    modalMissao.querySelector("[data-fechar]").addEventListener("click", () => modalMissao.close());
    return abrirModal(modalMissao);
  }
  let ordem = p.itens ? [...p.itens] : null;
  const sequencia = progresso.sequencia || 0;
  modalMissao.innerHTML = `
    <div class="missao-conteudo puzzle">${cabecalho}
      <p>${formatar(p.texto)}</p>
      ${p.codigo ? blocoCodigo(p.codigo) : ""}
      <div class="relogio-duelo" data-relogio hidden></div>
      <div data-resposta></div>
      <div class="recompensa">${recompensa.map((r) => `<span>${r}</span>`).join("")}</div>
      <p class="sequencia-enigma">🔥 Sequência ${sequencia}: acertar agora vale +${Math.min((sequencia + 1) * 5, 50)}% no tesouro${sequencia ? "" : " (e começa uma sequência)"}. Rápido, mais +50%!</p>
      <p class="aviso">Errar zera a sequência e o enigma ataca: apara na hora certa para não perder ❤️. Tens ${vidaAtual()} de ${vidaMaxima()}.</p>
      <div class="acoes"><button class="botao botao-fantasma" type="button" data-fechar>Depois</button></div>
    </div>`;
  let pararRelogio = () => {};
  // fechar o enigma (botão ou Esc) para o relógio: o tempo só corre com ele aberto
  modalMissao.addEventListener("close", () => pararRelogio(), { once: true });
  modalMissao.querySelector("[data-fechar]").addEventListener("click", () => modalMissao.close());
  const area = modalMissao.querySelector("[data-resposta]");
  let respondendo = false;

  // o relógio começa no servidor quando o enigma abre (e de novo a cada tentativa)
  async function iniciarTentativa() {
    const { tempo } = await acaoJogador(`puzzles/${p.id}/abrir`);
    if (!modalMissao.open) return;
    pararRelogio = relogioEmBarra(modalMissao.querySelector("[data-relogio]"), tempo, () => responder(null));
  }

  async function responder(resposta) {
    if (respondendo) return;
    respondendo = true;
    pararRelogio();
    // o servidor corrige e dá o tesouro (uma vez só); errando, o golpe fica no ar para aparar
    const r = await acaoJogador(`puzzles/${p.id}`, { resposta });
    if (r.correta) {
      chuvaDeEstrelas(r.relampago ? 45 : 25);
      Som.efeito("vitoria");
      modalMissao.innerHTML = `
        <div class="missao-conteudo">${cabecalho}
          <p>✨ <strong>Enigma desvendado!</strong> ${escapar(r.explicacao)}</p>
          ${r.relampago ? '<p class="relampago-ganho">⚡ Relâmpago! Resolveste rápido: +50% no tesouro.</p>' : ""}
          ${r.sequencia ? `<p class="sequencia-enigma">🔥 Sequência ${r.sequencia}</p>` : ""}
          ${listaGanhos(r.ganhos)}
          <div class="acoes"><button class="botao" type="button" data-fechar>Levar o tesouro</button></div>
        </div>`;
      modalMissao.querySelector("[data-fechar]").addEventListener("click", () => {
        modalMissao.close();
        telaReino(); // o baú aparece aberto e a runa apaga
      });
      return;
    }
    // errou (ou o tempo acabou): o enigma ataca e o anel da Defesa ativa aparece
    const fx = criarFxBatalha(modalMissao, modalMissao);
    const alvo = modalMissao.querySelector(".icone-missao");
    const golpe = await acaoJogador("aparar", { apertou: await fx.aparar(alvo) });
    if (golpe.dano) {
      fx.golpeNoHeroi(alvo, golpe.dano);
      animar(document.body, "tremor");
      animar(document.getElementById("vidas-topo"), "tremor-vida");
    } else fx.bloqueio(alvo, "APAROU!");
    setTimeout(() => fx.destruir(), 1400);
    if (golpe.desmaiou) {
      modalMissao.close();
      return telaDesmaio(`Um enigma antigo drenou tuas forças: ${p.nome}.`, golpe.perda);
    }
    const perdida = r.sequenciaPerdida ? ` Tua sequência de ${r.sequenciaPerdida} acabou.` : "";
    modalMissao.querySelector(".aviso").textContent = `✗ ${resposta === null ? "O tempo acabou!" : "Não foi dessa vez!"} ${golpe.dano
      ? `Perdeste ${golpe.dano} coração (${vidaAtual()} de ${vidaMaxima()}).` : "Mas aparaste o golpe!"}${perdida} Pensa com calma e tenta de novo.`;
    modalMissao.querySelector(".sequencia-enigma").textContent = "🔥 Sequência 0: acerta para começar uma nova.";
    respondendo = false;
    if (p.tipo === "relampago") desenharRelampago();
    iniciarTentativa();
  }

  // verdadeiro ou falso relâmpago: uma afirmação por vez; no fim, todas vão juntas para o servidor
  let respostasVf = [];
  function desenharRelampago() {
    const i = respostasVf.length;
    if (i >= p.afirmacoes.length) {
      const respostas = respostasVf;
      respostasVf = [];
      return responder(respostas);
    }
    area.innerHTML = `
      <div class="afirmacao-relampago"><small>Afirmação ${i + 1} de ${p.afirmacoes.length}</small>${escapar(p.afirmacoes[i])}</div>
      <div class="botoes-vf">
        <button class="botao" type="button" data-vf="1">✅ Verdadeiro</button>
        <button class="botao botao-fantasma" type="button" data-vf="0">❌ Falso</button>
      </div>`;
    area.querySelectorAll("[data-vf]").forEach((b) => b.addEventListener("click", () => {
      Som.efeito("clique");
      respostasVf.push(b.dataset.vf === "1");
      desenharRelampago();
    }));
  }

  if (p.tipo === "enigma" || p.tipo === "lacuna") {
    const rotulo = (o) => (p.tipo === "lacuna" ? `<code>${escapar(o)}</code>` : escapar(o));
    area.innerHTML = `<div class="opcoes-puzzle">${p.opcoes.map((o, i) => `<button class="botao botao-fantasma" type="button" data-i="${i}">${rotulo(o)}</button>`).join("")}</div>`;
    area.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => responder(Number(b.dataset.i))));
  } else if (p.tipo === "relampago") {
    desenharRelampago();
  } else {
    const desenharOrdem = () => {
      area.innerHTML = `
        <ol class="ordem-puzzle">${ordem.map((item, i) => `
          <li><span>${escapar(item)}</span>
            <button type="button" data-sobe="${i}" ${i === 0 ? "disabled" : ""} aria-label="Subir">▲</button>
            <button type="button" data-desce="${i}" ${i === ordem.length - 1 ? "disabled" : ""} aria-label="Descer">▼</button>
          </li>`).join("")}
        </ol>
        <button class="botao" type="button" data-conferir>Conferir a ordem</button>`;
      area.querySelectorAll("[data-sobe]").forEach((b) => b.addEventListener("click", () => {
        const i = Number(b.dataset.sobe);
        [ordem[i - 1], ordem[i]] = [ordem[i], ordem[i - 1]];
        desenharOrdem();
      }));
      area.querySelectorAll("[data-desce]").forEach((b) => b.addEventListener("click", () => {
        const i = Number(b.dataset.desce);
        [ordem[i + 1], ordem[i]] = [ordem[i], ordem[i + 1]];
        desenharOrdem();
      }));
      area.querySelector("[data-conferir]").addEventListener("click", () => responder(ordem));
    };
    desenharOrdem();
  }
  abrirModal(modalMissao);
  iniciarTentativa();
}

const ESTALAJADEIRO = {
  nome: "Bram, o Estalajadeiro",
  avatar: {
    pele: "#c98d63", cabelo: "raspado", corCabelo: "#6b3e1f", rosto: "sorriso", chapeu: "nenhum", manto: "#8b5a2b",
    detalhe: "#e9e4d4", item: "grimorio", magia: "#ffb347", acessorio: "barba", familiar: "nenhum",
  },
};
const PRECO_DESCANSO = 15; // só para mostrar; quem cobra é o servidor (jogador.py)

const BOATOS = [
  "Dizem que o Lich da Cripta, lá no pântano, só cai para quem **confere as fontes**.",
  "Um mercador jurou que a Hidra do Traceback, na Masmorra dos Bugs, odeia quem lê **a última linha do erro**.",
  "Os lobos da Floresta Uivante **correm atrás** de quem passa perto. Anda pela estrada!",
  "A Brina do Mercado guarda uma **Coroa do Arquimago**. Caríssima!",
  "Os dragões das montanhas perguntam **duas vezes**. Errou uma, perdeu dois corações.",
  "Tem 15 enigmas escondidos pelo Reino. Pedras que brilham e baús perdidos... quem resolve, enriquece!",
];

const MENESTREL = {
  nome: "Fiona, a Menestrel",
  visual: { corpo: "feminino", pele: "#f6d3b3", cabelo: "longo", corCabelo: "#a8323e", rosto: "sorriso", chapeu: "tiara", manto: "#6c48c9", detalhe: "#ffd166", item: "varinha", magia: "#ff7ad9", acessorio: "brinco" },
  cancoes: [
    "🎵 *Lá nas montanhas o dragão rugiu: \"me diz o que é RAG!\" e o herói sorriu...* 🎵",
    "🎵 *Lobo na floresta, slime no capim, quem estudou na Academia não tem medo, não, enfim!* 🎵",
    "🎵 *Bebe um elixir, descansa com o Bram, que amanhã tem deserto e escorpião de manhã!* 🎵",
  ],
};

const FREGUESES = [
  {
    id: "ana", nome: "Ana, a Aventureira", tx: 7, ty: 9,
    visual: { corpo: "feminino", pele: "#c98d63", cabelo: "rabo", corCabelo: "#2b1d14", rosto: "confiante", chapeu: "capuz", manto: "#1f7a5c", detalhe: "#ffd166", item: "arco", magia: "#7dff9a", acessorio: "nenhum" },
    falas: ["Fui até o Deserto dos Bugs e voltei sem um coração. Os escorpiões sabem tudo de APIs!", "Dica: os enigmas dão itens bons. O baú da torre na floresta me deu um elixir."],
  },
  {
    id: "selene", nome: "Selene, a Viajante", tx: 17, ty: 11,
    visual: { corpo: "feminino", pele: "#6b4128", cabelo: "cacheado", corCabelo: "#2b1d14", rosto: "sorriso", chapeu: "boina", manto: "#2e5cb8", detalhe: "#e9e4d4", item: "grimorio", magia: "#6ef0ff", acessorio: "oculos" },
    falas: ["Já viste o minimapa no canto? Clica nele (ou aperta M) para ver o Reino inteiro.", "No oásis do deserto tem uma pedra que pergunta de SQL. Eu errei... duas vezes."],
  },
];

// As mercadorias expostas no Mercado: as armas só da vocação do herói, e o que ele ainda não tem na frente.
function itensDaLoja() {
  const kit = escolhasCompletas(progresso.avatar).kit;
  const visuais = CATALOGO.cosmeticos.filter((c) => c.preco && (!c.kit || c.kit === kit))
    .map((c) => ({ id: c.id, icone: c.icone, nome: c.nome, preco: c.preco, tipo: "visual", avatar: c.avatar, kit: c.kit, comprado: possuiCosmetico(c.id) }))
    .sort((a, b) => (a.comprado - b.comprado) || (Boolean(b.kit) - Boolean(a.kit)));
  return [...CATALOGO.consumiveis.map((i) => ({ id: i.id, icone: i.icone, nome: i.nome, preco: i.preco, tipo: "consumivel" })), ...visuais];
}

// Compra um item no servidor (que confere preço e moedas). Devolve a mensagem de erro, ou null se deu certo.
async function comprarItem(id) {
  try {
    await acaoJogador("comprar", { item: id });
    return null;
  } catch (erro) {
    return erro.message;
  }
}

// Uma vitrine do mercado: o item, o preço e o botão de comprar.
function abrirVitrine(item, mensagem = "") {
  const modalMissao = document.getElementById("modal-missao");
  const dados = itemDoCatalogo(item.id);
  const visual = item.tipo === "visual";
  const tem = visual ? possuiCosmetico(item.id) : quantidade(item.id);
  const previa = visual
    ? `<img class="pixel previa-vitrine" src="${heroiParado({ ...progresso.avatar, ...dados.avatar }).toDataURL()}" alt="">`
    : `<img class="pixel previa-vitrine item" src="${arteDoItem(dados.id) || emojiPixel(dados.icone, 24)}" alt="">`;
  let botao = `<button class="botao" type="button" data-comprar ${progresso.moedas < dados.preco ? "disabled" : ""}>Comprar por 🪙 ${dados.preco}</button>`;
  if (visual && tem) {
    botao = estaVestindo(dados) ? '<span class="tag tag-concluida">Vestindo ✓</span>' : '<button class="botao" type="button" data-vestir>Vestir ✨</button>';
  }
  modalMissao.innerHTML = `
    <div class="missao-conteudo vitrine-item">
      ${previa}
      <p class="local">Mercado de Elyndor</p>
      <h2>${dados.icone} ${escapar(dados.nome)}</h2>
      <p>${escapar(dados.descricao)}</p>
      <p class="aviso">${mensagem ? escapar(mensagem) : visual ? (tem ? "Esse visual já é teu." : "") : `Na mochila: ×${tem}`} · Tens 🪙 ${progresso.moedas}</p>
      <div class="acoes">${botao}<button class="botao botao-fantasma" type="button" data-fechar>Fechar</button></div>
    </div>`;
  modalMissao.querySelector("[data-fechar]").addEventListener("click", () => modalMissao.close());
  modalMissao.querySelector("[data-comprar]")?.addEventListener("click", async (evento) => {
    const erro = await comprarItem(item.id);
    if (!erro) {
      faiscas(evento.clientX, evento.clientY);
      xpFlutuante(`-${dados.preco} 🪙`, evento.clientX, evento.clientY);
    }
    abrirVitrine(item, erro || `${sortear(MERCADORA.compras)} (Brina)`);
  });
  modalMissao.querySelector("[data-vestir]")?.addEventListener("click", (evento) => {
    vestir(dados);
    faiscas(evento.clientX, evento.clientY, "#a98bff");
    abrirVitrine(item, "Ficou um charme! O reino inteiro vai comentar. (Brina)");
  });
  abrirModal(modalMissao);
}

function conversarComBram() {
  const cheio = vidaAtual() >= vidaMaxima();
  falarCom(ESTALAJADEIRO.nome, ESTALAJADEIRO.avatar,
    cheio
      ? `Opa, ${nomeAluno()}! Tá inteirinho, hein? Senta, pega uma sopa, que eu te conto um boato.`
      : `Opa, ${nomeAluno()}! Tá com cara de quem apanhou de monstro. Um quarto lá em cima custa **🪙 ${PRECO_DESCANSO}** e tu acorda com a vida cheia.`,
    [
      ...(cheio ? [] : [{ texto: `🛏️ Descansar (🪙 ${PRECO_DESCANSO})`, acao: descansarNaEstalagem }]),
      { texto: "👂 Me conta um boato", acao: () => falarCom(ESTALAJADEIRO.nome, ESTALAJADEIRO.avatar, sortear(BOATOS), [{ texto: "🍺 Outro boato!", acao: conversarComBram }]) },
    ]);
}

async function descansarNaEstalagem() {
  try {
    await acaoJogador("descansar");
  } catch (erro) {
    return falarCom(ESTALAJADEIRO.nome, ESTALAJADEIRO.avatar, erro.message);
  }
  chuvaDeEstrelas(12);
  falarCom(ESTALAJADEIRO.nome, ESTALAJADEIRO.avatar, "Dorme bem! ... 💤 ... Bom dia! **Tua vida está cheia.** ❤️");
}

// Por dentro da Estalagem do Grifo e do Mercado de Elyndor: dá para andar, conversar e ver as mercadorias.
function telaInterior(tipo) {
  Som.musica("mercado");
  window.scrollTo(0, 0);
  progresso.local = "reino";
  salvarProgresso();
  const naEstalagem = tipo === "estalagem";
  const naForja = tipo === "forja";
  const titulo = naForja ? "Casa da Forja" : naEstalagem ? "Estalagem do Grifo" : "Mercado de Elyndor";
  const subtitulo = naForja ? "Chega perto da bigorna (ou do Duran) e aperta <kbd>E</kbd> para forjar."
    : naEstalagem ? "Cama quente, sopa de abóbora e boatos do Reino." : "Chega perto de uma mercadoria e aperta <kbd>E</kbd> para ver.";
  const secao = criar(`
    <section class="tela-mundo interior ${naForja ? "interior-forja" : ""}">
      <div class="cabecalho-mapa">
        <div>
          <h2 class="titulo-pixel">${titulo}</h2>
          <p>${subtitulo}</p>
        </div>
        <div class="acoes" style="margin:0"><button class="botao botao-fantasma" type="button" data-voltar>◂ Voltar ao Reino</button></div>
      </div>
      <div class="mapa-reino" data-mundo></div>
    </section>`);
  secao.querySelector("[data-voltar]").addEventListener("click", () => transicaoPixel("🗺️ Reino de Elyndor", "#2f6b45", () => telaReino(), {
    forma: "diagonal", duracao: 300, espera: 260,
    carregar: { tema: "reino", titulo: "Reino de Elyndor", sobretitulo: "Voltando para o", icone: "🗺️", avatar: progresso.avatar, minimo: 1100 },
  }));
  tela.replaceChildren(secao);
  atualizarModoMundo();
  const cenario = naForja
    ? cenarioForja({ ferreiro: FERREIRO_DA_FORJA, vitrine: pecasDaVitrineDaForja(), avatarAluno: progresso.avatar })
    : naEstalagem
      ? cenarioEstalagem({ fregueses: FREGUESES, menestrel: MENESTREL, estalajadeiro: ESTALAJADEIRO })
      : cenarioMercado({ itens: itensDaLoja(), mercadora: MERCADORA, avatarAluno: progresso.avatar });
  montarMundo(secao.querySelector("[data-mundo]"), cenario, {
    avatar: progresso.avatar,
    nomeHeroi: nomeAluno(),
    tituloHeroi: principalDoHeroi() ? seloDoTitulo() : "",
    aura: auraDoHeroi(),
    aoMover: () => {},
    aoEntrar: (lugar) => {
      if (lugar.id === "saida") return telaReino();
      if (lugar.id === "espelho") return telaCriador("espelho");
      if (lugar.id === "bigorna") return telaForja();
      if (lugar.id === "duran") return conversarComDuran();
      if (lugar.pecaDaForja) return telaForja({ item: lugar.pecaDaForja.id });
      if (lugar.id === "bram") return conversarComBram();
      if (lugar.id === "quarto") return descansarNaEstalagem();
      if (lugar.id === "menestrel") return falarCom(MENESTREL.nome, MENESTREL.visual, sortear(MENESTREL.cancoes));
      if (lugar.fregues) return falarCom(lugar.fregues.nome, lugar.fregues.visual, sortear(lugar.fregues.falas));
      if (lugar.id === "brina") {
        return falarCom(MERCADORA.nome, MERCADORA.avatar,
          `Bem-vindo à minha loja, **${nomeAluno()}**! Tens **🪙 ${progresso.moedas}**. Poções nas mesas da esquerda, visuais nos manequins da direita e, ali no canto, o **espelho** para trocar de visual quando quiser. Chega perto e dá uma olhada!`,
          [{ texto: "📜 Ver o catálogo completo", acao: telaMercado }]);
      }
      if (lugar.item) return abrirVitrine(lugar.item);
    },
  });
}

// o jeito de falar de cada monstro: [desafio, quando perde, quando acerta o herói]
const FALAS_MONSTRO = {
  reiSlime: ["*BLUUUB!* O Rei Slime faz o chão tremer de gosma: \"Ninguém passa pelos meus campos sem provar o que sabe!\"", "Bluuub... *a coroa rola pelo chão e o rei vira uma poça*", "*SPLOSH!* O Rei Slime te esmaga com a barriga!"],
  fenrir: ["*AAAUUUUUUU!* Fenrir, o Lobo Rei, uiva e a floresta inteira escuta:", "Auuu... *Fenrir baixa a cabeça e some entre as árvores*", "*CRUNCH!* As presas do Lobo Rei te acertam!"],
  sapoRei: ["*CROOOAAAC!* O Sapo Rei se ergue do brejo, a coroa pingando lama:", "Croac... *o rei afunda devagar no pântano*", "*SPLAT!* A língua de ouro te derruba na lama!"],
  escorpiaoImperador: ["*TSSSSSS!* O Escorpião Imperador ergue o ferrão dourado sob o sol:", "Tsss... *o Imperador se enterra nas dunas*", "*CRAC!* O ferrão imperial atravessa tua defesa!"],
  ignis: ["*ROOOOOOAAAAAAAR!* Ignis, o Dragão Rei, abre as asas e o céu escurece:", "Grrr... *Ignis bate as asas e voa para além das nuvens*", "*FWOOOOOOSH!* O fogo de Ignis te engole!"],
  slime: ["*Blub blub!* Responde se for capaz:", "Blub... blub... *puf*", "Blub blub blub! (isso é uma risada de slime)"],
  lobo: ["*AUUUUU!* Os lobos da floresta só deixam passar quem sabe:", "Auu... *o lobo foge para a mata*", "*GRRR!* Errou, e o lobo morde!"],
  sapo: ["*CROAC!* O sapo do brejo infla a garganta:", "Croac... *tchibum, ele pula na lama*", "*CROAC CROAC!* A língua grudenta te acerta!"],
  escorpiao: ["*Tsss tsss...* O escorpião ergue o ferrão:", "Tsss... *ele some debaixo da areia*", "*TSSS!* A ferroada dói!"],
  esqueleto: ["*Clec clec!* O esqueleto compila uma pergunta:", "Clec... *os ossos desmontam no chão*", "*CLEC CLEC CLEC!* Ele ri com a mandíbula solta!"],
  dragao: ["*ROOOAAAR!* O dragão bate as asas e o chão treme:", "Rooar... *o dragão recua para as nuvens*", "*FWOOOSH!* Uma baforada de fogo te acerta em cheio!"],
  // as criaturas da noite
  morcego: ["*Iiiiik!* O morcego guardou tua resposta em cache... será que ainda vale?", "Iik... *ele some na escuridão*", "*FLAP FLAP!* O morcego dá um rasante na tua cabeça!"],
  assombracao: ["*Uuuuuhhh...* Uma voz do código esquecido pergunta:", "Uuuh... *a assombração se desfaz em névoa*", "*BUUU!* Um arrepio gelado te atravessa!"],
  fogoFatuo: ["*Fsssh...* A luzinha dança e te desafia:", "Fsss... *a chama apaga com um suspiro*", "*FLASH!* O brilho te deixa tonto!"],
};

function falasDoMonstro(tipoId = "") {
  if (FALAS_MONSTRO[tipoId]) return FALAS_MONSTRO[tipoId];
  const chave = Object.keys(FALAS_MONSTRO).find((k) => tipoId.toLowerCase().startsWith(k)) || "slime";
  return FALAS_MONSTRO[chave];
}

const CORES_FORCA = { Fraco: "#7dff9a", Médio: "#ffd166", Forte: "#ff9a3c", Chefão: "#ff4d6d" };

// Batalha com um monstro do Reino. Cada resposta certa tira uma vida dele; cada errada tira
// "dano" corações do herói, que pode continuar lutando ou fugir. A pergunta vem do perigo da
// região e pode ser uma situação de trabalho (e-mail do chefe, mensagem de colega...).
async function telaEncontro(monstro) {
  window.scrollTo(0, 0);
  const [desafio, derrota, golpe] = falasDoMonstro(monstro.tipoId);
  const nivel = monstro.nivel || 1;
  const vidaTotal = monstro.vida || 1;
  let vidaMonstro = vidaTotal;
  const forca = monstro.forca || "Fraco";
  const nivelAntes = nivelDe(progresso.xp);
  const secao = criar(`
    <section class="dungeon encontro ${monstro.chefe ? "chefao" : ""}">
      <div class="hud-dungeon">
        <h2><small>Encontro no Reino · perigo ${"☠".repeat(nivel)} · <span class="forca" style="color:${CORES_FORCA[forca]}">${forca}</span></small>${escapar(monstro.nome)}</h2>
        <span class="selo-trilha" data-trilha hidden></span>
        <span class="selo-skill" data-skill hidden></span>
        <button class="selo-fonte" type="button" data-fonte hidden></button>
        <div class="recursos-heroi">
          <div class="retrato-batalha" data-retrato></div>
          <div class="barras-batalha">
            <strong class="nome-batalha">${escapar(progresso.nome)} <small>Nv. ${nivelAntes}</small></strong>
            <div data-vidas title="Vida"></div>
            <div data-mana title="${temaDaClasse().grimorio.recurso}: gasta nos poderes, volta a cada acerto"></div>
          </div>
        </div>
        <div class="fase-chefe" data-fase hidden></div>
        <div class="efeitos-ativos" data-efeitos></div>
        <div class="sequencia-hud" data-sequencia></div>
      </div>
      <div class="relogio-duelo" data-relogio hidden><div class="barra-relogio"></div><span></span></div>
      <div data-palco></div>
    </section>`);
  const retrato = `
    <div class="inimigo ${monstro.chefe ? "chefe" : ""}">
      <img class="pixel corpo-inimigo" src="${monstro.imagem}" alt="">
      <div class="vida-inimigo"><div></div></div>
      <div class="coracoes-inimigo" data-vida-monstro></div>
    </div>`;
  const palco = criarZetsu({ nome: monstro.nome, retrato });
  palco.elemento.classList.add("palco-dungeon");
  // o fundo da arena: o cenário em pixel da região onde o monstro vive (arena.js)
  // e o clima de agora, o mesmo do mapa: chuva, neve nas montanhas e a noite
  const clima = climaDaLuta(monstro.regiao);
  palco.elemento.querySelector(".dialogo").style.setProperty("--arte-cenario", `url(${arenaDaRegiao(monstro.regiao, { chefe: monstro.chefe, chuva: clima.chuva, noite: clima.noite })})`);
  if (clima.chuva || clima.neve) animarClimaDaArena(palco.elemento.querySelector(".dialogo"), clima);
  // o cartão da pergunta (e-mail, código, verdadeiro ou falso) fica no meio da arena, entre os dois
  // lutadores, em vez de empurrar a luta para baixo
  palco.elemento.querySelector(".dialogo").prepend(palco.elemento.querySelector(".quadro"));
  secao.querySelector("[data-palco]").replaceWith(palco.elemento);
  const barraVida = barraRpg(secao.querySelector("[data-vidas]"), "vida", "❤");
  const desenharVida = () => barraVida(vidaAtual(), vidaMaxima());
  desenharVida();
  secao.querySelector("[data-retrato]").innerHTML = progresso.avatar ? avatarSvg(progresso.avatar, nomeAluno()) : "";
  const seloTrilha = secao.querySelector("[data-trilha]");
  // de onde sai a pergunta da rodada (livro e capítulo da biblioteca, guia da carreira, lição ou dungeon);
  // clicar abre o capítulo por cima da batalha, para estudar depois
  const seloFonte = secao.querySelector("[data-fonte]");
  let fonteAtual = null;
  seloFonte.addEventListener("click", () => abrirFonte(fonteAtual));
  tela.replaceChildren(secao);
  const inimigo = palco.elemento.querySelector(".inimigo");
  // tudo de cada lutador fica junto dele na arena: o nome e o perigo do monstro viram a placa em cima da
  // barra de HP dele; a vida e a mana do herói ficam embaixo do herói. O topo só guarda sequência e efeitos.
  const placaMonstro = secao.querySelector(".hud-dungeon h2");
  placaMonstro.classList.add("placa-inimigo");
  inimigo.querySelector(".vida-inimigo").before(placaMonstro);
  palco.elemento.querySelector(".ator-jogador").append(secao.querySelector(".recursos-heroi"));
  // os efeitos da luta: cada classe ataca do seu jeito, com som e partículas
  const corpoInimigo = inimigo.querySelector(".corpo-inimigo");
  const heroiEl = palco.elemento.querySelector(".ator-jogador img");
  animarArena(secao, heroiEl, corpoInimigo, monstro);
  setTimeout(() => auraNaBatalha(palco.elemento.querySelector(".ator-jogador"), progresso.avatar), 400);
  const fx = criarFxBatalha(secao);
  const kit = escolhasCompletas(progresso.avatar).kit;
  const corDaMagia = progresso.avatar?.magia || "#6ef0ff";
  const corDoMonstro = (typeof monstro.cor === "string" && monstro.cor.startsWith("#") && monstro.cor) || "#c9a8ff";
  fx.aura(corpoInimigo, corDoMonstro, Boolean(monstro.chefe));
  Som.musica(monstro.tipoId === "vazio" ? "vazio" : monstro.chefe ? "chefao" : "batalha");
  Som.efeito(monstro.chefe ? "rugido" : "porta");
  const barraInimigo = palco.elemento.querySelector(".vida-inimigo div");
  const vidaDoMonstro = palco.elemento.querySelector("[data-vida-monstro]");
  const desenharVidaMonstro = () => {
    barraInimigo.style.width = `${Math.round((vidaMonstro / vidaTotal) * 100)}%`;
    vidaDoMonstro.textContent = `HP ${vidaMonstro} / ${vidaTotal}`;
  };
  desenharVidaMonstro();

  // a batalha mora no servidor: ele guarda a vida do monstro, a mana, as magias ativas e a fase do chefão
  let inicio;
  try {
    inicio = await acaoJogador("batalhas", { tipo: monstro.tipoId, monstroId: monstro.id, golpe: Boolean(monstro.golpe) })
      // sem mana para o Golpe Arcano na hora: a luta começa normal
      .catch((erro) => (monstro.golpe ? acaoJogador("batalhas", { tipo: monstro.tipoId, monstroId: monstro.id }) : Promise.reject(erro)));
  } catch (erro) {
    palco.dizer(erro.message);
    await palco.escolher([{ texto: "Voltar à aventura ▸" }], { silencioso: true });
    return telaMapa();
  }
  // o Golpe Arcano acertou no mapa: o monstro já entra ferido
  if (inicio.vida < vidaMonstro) {
    vidaMonstro = inicio.vida;
    desenharVidaMonstro();
    setTimeout(() => fx.numero(corpoInimigo, "☄️ GOLPE ARCANO −1", "critico"), 350);
  }
  const rotaBatalha = `batalhas/${inicio.batalha}`;
  let ganhos = [];
  let fragmento = null;
  let golpeFinal = false;
  let achouTesouro = false;
  let deixouCair = null; // o monstro deixou cair algo (raro: o id do visual exclusivo)
  let especialFinal = null;

  // ---- mana, grimório e fase do chefão ----
  let mana = inicio.mana;
  let efeitos = {};
  let fase = inicio.fase;
  let efeitosFase = inicio.efeitosFase;
  let perguntaNova = null;
  const barraMana = barraRpg(secao.querySelector("[data-mana]"), "mana", temaDaClasse().grimorio.recurso_icone);
  const areaFase = secao.querySelector("[data-fase]");
  const areaEfeitos = secao.querySelector("[data-efeitos]");
  const desenharMana = () => barraMana(mana, inicio.manaMaxima);
  const desenharEfeitos = () => {
    const ativos = [efeitos.escudo && "🛡️ Escudo de Runas", efeitos.lamina && "✨ Lâmina de Luz"].filter(Boolean);
    areaEfeitos.innerHTML = ativos.map((e) => `<span>${e}</span>`).join("");
  };
  const desenharFase = () => {
    if (!monstro.chefe) return;
    const marcas = [
      efeitosFase.perigo && `☠ +${efeitosFase.perigo} perigo`, efeitosFase.dano && `💥 +${efeitosFase.dano} dano`,
      efeitosFase.silencio && "🔇 magias +1 mana", efeitosFase.trilha && `📚 só ${trilhaInfo(efeitosFase.trilha)?.nome}`,
    ].filter(Boolean);
    areaFase.hidden = false;
    areaFase.innerHTML = `<strong>Fase ${fase}/3 · ${escapar(efeitosFase.nome)}</strong>${marcas.map((m) => `<span>${escapar(m)}</span>`).join("")}`;
    inimigo.classList.remove("fase-1", "fase-2", "fase-3");
    inimigo.classList.add(`fase-${fase}`);
  };
  // mesma conta do servidor: silêncio da fase soma 1; o Eco do Grimório paga a primeira magia
  const custoMagia = (m) => (temHabilidade("eco") && !efeitos.ecoUsado ? 0 : m.custo + (efeitosFase.silencio ? 1 : 0));
  // A barra de poderes: só os 3 equipados (teclas 1, 2 e 3) e o ✏️ que abre a Árvore para trocar.
  // As técnicas do grimório gastam mana; as magias da classe valem uma vez por batalha e recarregam em horas.
  function desenharGrimorio() {
    const usadas = efeitos.especiais || [];
    const liberadas = new Set(inicio.magias.map((m) => m.id));
    const especiais = new Map(inicio.especiais.map((m) => [m.id, m]));
    const recurso = temaDaClasse().grimorio;
    const vaga = (poder, i) => {
      const tecla = String(i + 1);
      const id = poder?.magia.id;
      if (poder?.tipo === "grimorio" && liberadas.has(id)) {
        const m = JORNADA.magias.magias.find((x) => x.id === id);
        return {
          icone: m.icone, tecla, nome: `${m.nome} (${custoMagia(m)} de ${recurso.recurso.toLowerCase()}): ${m.descricao}`, rotulo: `${custoMagia(m)}${recurso.recurso_icone}`, classe: "magia poder",
          desligado: mana < custoMagia(m) || Boolean(efeitos[m.id]) || (m.id === "cura" && vidaAtual() >= vidaMaxima())
            || (m.id === "visao" && ["vf", "ordem"].includes(desafioAtual)),
          usar: (botao) => lancarMagia(m, botao),
        };
      }
      if (poder?.tipo === "classe" && especiais.has(id)) {
        const m = especiais.get(id);
        const imune = Boolean(monstro.chefe) && ["expulsar", "apagar"].includes(m.efeito.tipo);
        const espera = recargaRestante(m.id);
        return {
          icone: m.icone, tecla, classe: `especial poder ${m.raridade} ${espera ? "recarregando" : ""}`,
          rotulo: usadas.includes(m.id) ? "✓" : espera ? `⏳${tempoCurto(espera)}` : "1×",
          nome: `${m.nome} (${RARIDADES[m.raridade]}): “${m.frase}” ${m.descricao}${imune ? " Chefões são imunes." : ""}${espera ? ` Recarrega em ${tempoCurto(espera)}.` : ` Depois de usar, recarrega em ${m.recarga_horas}h.`}`,
          desligado: usadas.includes(m.id) || espera > 0 || imune,
          usar: (botao) => lancarEspecial(m, botao),
        };
      }
      return { icone: "＋", tecla, nome: "Vaga vazia: escolhe um poder na Árvore (aba Poderes).", rotulo: "", classe: "poder vazio", desligado: false, usar: () => abrirArvore("poderes") };
    };
    palco.definirItens([
      ...poderesEquipados().map(vaga),
      { icone: "✏️", nome: "Trocar os poderes equipados (abre a Árvore na aba Poderes)", rotulo: "", classe: "editar-poderes", desligado: false, usar: () => abrirArvore("poderes") },
    ]);
  }
  window.addEventListener("poderes-mudaram", function trocou() {
    if (!tela.contains(secao)) return window.removeEventListener("poderes-mudaram", trocou);
    desenharGrimorio();
  });
  // atalhos da barra na batalha: 1, 2 e 3 para os poderes equipados
  const atalhosBatalha = (e) => {
    if (!tela.contains(secao)) return window.removeEventListener("keydown", atalhosBatalha);
    if (document.querySelector("dialog[open]") || (e.target instanceof Element && e.target.closest("input, textarea"))) return;
    // ↑ e ↓ andam com o cursor ▶ pelo menu de respostas (Enter escolhe), como num RPG de console
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const opcoes = [...palco.elemento.querySelectorAll(".escolhas-dialogo:not([hidden]) .fala-opcao:not(.dissolvida)")];
      if (!opcoes.length) return;
      e.preventDefault();
      const atual = opcoes.indexOf(document.activeElement);
      const proxima = atual < 0 ? 0 : (atual + (e.key === "ArrowDown" ? 1 : -1) + opcoes.length) % opcoes.length;
      opcoes[proxima].focus();
      Som.efeito("clique");
      return;
    }
    const botao = palco.elemento.querySelector(`.itens-palco [data-tecla="${e.key.toUpperCase()}"]`);
    if (!botao || botao.disabled) return;
    e.preventDefault();
    botao.click();
  };
  window.addEventListener("keydown", atalhosBatalha);
  // o mouse e as setas mexem o mesmo cursor ▶ (passar o mouse numa resposta é o mesmo que ir até ela)
  palco.elemento.addEventListener("mouseover", (e) => {
    const opcao = e.target instanceof Element && e.target.closest(".escolhas-dialogo .fala-opcao");
    if (opcao && document.activeElement !== opcao) opcao.focus({ preventScroll: true });
  });

  // Magia de classe: um banner com a frase de efeito e, se ela resolver a rodada, a resposta vem pronta.
  let respostaEspecial = null;
  async function lancarEspecial(m, botao) {
    botao.disabled = true;
    try {
      const r = await acaoJogador(`${rotaBatalha}/especial`, { magia: m.id });
      bannerEspecial(m, r.falhou);
      fx.especial(m, corpoInimigo);
      mana = r.mana;
      efeitos = r.efeitos;
      if (r.resposta) {
        respostaEspecial = r.resposta;
        palco.cancelarEscolha(-3);
      } else {
        if (r.vidaMonstro < vidaMonstro) {
          animar(inimigo, "atingido");
          setTimeout(() => fx.numero(corpoInimigo, `−${vidaMonstro - r.vidaMonstro}`, "critico"), 450);
        }
        if (r.vida) fx.numero(heroiEl, "+❤", "cura");
        vidaMonstro = r.vidaMonstro;
        desenharVidaMonstro();
        desenharVida();
        if (r.fase) {
          fase = r.fase;
          efeitosFase = r.efeitosFase;
          desenharFase();
          animar(inimigo, "transformando");
          avisoFlutuante("⚡", `FASE ${fase}: ${efeitosFase.nome}`, efeitosFase.fala);
        }
        desenharGrimorio();
      }
    } catch (erro) {
      avisoFlutuante(m.icone, m.nome, erro.message);
      desenharGrimorio();
    }
    desenharMana();
    desenharEfeitos();
  }
  function bannerEspecial(m, falhou) {
    const banner = criar(`
      <div class="banner-especial ${m.raridade}">
        <span class="raridade">${RARIDADES[m.raridade]}</span>
        <span class="icone-banner">${m.icone}</span>
        <strong>${escapar(m.nome)}</strong>
        <em>“${escapar(m.frase)}”</em>
        ${falhou ? "<small>💥 Quebrou a produção! Tua mana foi junto...</small>" : ""}
      </div>`);
    camadaEfeitos.append(banner);
    animar(document.body, "tremor");
    chuvaDeEstrelas(m.raridade === "lendaria" ? 40 : 15);
    setTimeout(() => banner.remove(), 2600);
  }
  async function lancarMagia(m, botao) {
    botao.disabled = true;
    try {
      const r = await acaoJogador(`${rotaBatalha}/magia`, { magia: m.id });
      mana = r.mana;
      efeitos = r.efeitos;
      const caixa = botao.getBoundingClientRect();
      faiscas(caixa.left + caixa.width / 2, caixa.top, "#6ec8ff");
      fx.tecnica(m.id, heroiEl, corpoInimigo, corDaMagia);
      if (m.id === "visao") palco.removerOpcoes(r.dissolver);
      if (m.id === "cura") desenharVida();
      if (m.id === "renovar") {
        perguntaNova = r.pergunta;
        palco.cancelarEscolha(-1);
      }
    } catch (erro) {
      avisoFlutuante(m.icone, m.nome, erro.message);
    }
    desenharMana();
    desenharEfeitos();
    if (m.id !== "renovar") desenharGrimorio();
  }
  desenharMana();
  desenharFase();

  // ---- a Sequência: acertos seguidos (em batalhas e enigmas); a cada 5, um Golpe Final ----
  const areaSequencia = secao.querySelector("[data-sequencia]");
  function desenharSequencia(perdida = 0) {
    const n = progresso.sequencia || 0;
    const cheias = n > 0 && n % 5 === 0 ? 5 : n % 5;
    areaSequencia.innerHTML = `<strong>🔥 Sequência ${n}</strong>
      <span class="pips">${Array.from({ length: 5 }, (_, i) => `<i class="${i < cheias ? "cheia" : ""}"></i>`).join("")}</span>
      <small>${n ? `+${Math.min(n * 5, 50)}% no prêmio` : "acerta seguido!"}</small>`;
    areaSequencia.title = "Acertos seguidos em batalhas e enigmas. A cada 5, um GOLPE FINAL; cada ponto aumenta o prêmio. Errar zera.";
    areaSequencia.classList.toggle("quente", n >= 3);
    if (perdida) {
      areaSequencia.classList.remove("quebrou");
      void areaSequencia.offsetWidth;
      areaSequencia.classList.add("quebrou");
      avisoFlutuante("💔", "Sequência perdida", `Tua sequência de ${perdida} acabou.`);
    }
  }
  desenharSequencia();

  // ---- o relógio da rodada: enquanto tu pensa, o monstro carrega o ataque ----
  const areaRelogio = secao.querySelector("[data-relogio]");
  const barraRelogio = areaRelogio.querySelector(".barra-relogio");
  const rotuloRelogio = areaRelogio.querySelector("span");
  let relogio = null;
  function iniciarRelogio(tempo) {
    pararRelogio();
    const comeco = performance.now();
    areaRelogio.hidden = false;
    inimigo.classList.add("carregando");
    const quadro = () => {
      if (!tela.contains(secao)) return pararRelogio();
      const passou = (performance.now() - comeco) / 1000;
      const resta = Math.max(0, tempo.limite - passou);
      const relampago = passou <= tempo.rapido;
      barraRelogio.style.width = `${(resta / tempo.limite) * 100}%`;
      areaRelogio.classList.toggle("relampago", relampago);
      areaRelogio.classList.toggle("urgente", resta <= tempo.limite * 0.25);
      rotuloRelogio.textContent = relampago ? `⚡ crítico: ${Math.ceil(tempo.rapido - passou)}s` : `⏳ ${Math.ceil(resta)}s`;
      inimigo.style.setProperty("--carga", Math.min(1, passou / tempo.limite).toFixed(2));
      if (resta <= 0) {
        pararRelogio();
        palco.cancelarEscolha(-4); // o tempo acabou: vale como erro
        return;
      }
      relogio = requestAnimationFrame(quadro);
    };
    relogio = requestAnimationFrame(quadro);
  }
  function pararRelogio() {
    cancelAnimationFrame(relogio);
    relogio = null;
    inimigo.classList.remove("carregando");
    areaRelogio.hidden = true;
  }

  // Desafio de pôr em ordem: clica nos passos na sequência certa (clicar num marcado desfaz dali em diante).
  // Devolve as posições clicadas ou, se a rodada foi encerrada de outro jeito, o código da escolha (-1, -3, -4).
  // Pôr os passos em ordem: os passos ficam no próprio painel de Respostas (nada por cima do palco da luta,
  // que cortava a lista e criava barra de rolagem), com o "Recomeçar a ordem" embaixo deles.
  function escolherOrdem(itens) {
    const painel = criar(`
      <div class="desafio-ordem">
        <p class="titulo-ordem">📜 Ritual: clica nos passos na ordem certa</p>
        <div class="passos-ordem">${itens.map((t, i) => `
          <button type="button" class="passo-ordem" data-i="${i}"><b></b><span>${escapar(t)}</span></button>`).join("")}
        </div>
      </div>`);
    const areaEscolhas = palco.elemento.querySelector(".escolhas-dialogo");
    palco.elemento.querySelector(".quadro").hidden = true;
    const escolhidos = [];
    const redesenhar = () => painel.querySelectorAll(".passo-ordem").forEach((b) => {
      const pos = escolhidos.indexOf(Number(b.dataset.i));
      b.classList.toggle("marcado", pos >= 0);
      b.querySelector("b").textContent = pos >= 0 ? pos + 1 : "";
    });
    painel.querySelectorAll(".passo-ordem").forEach((b) => b.addEventListener("click", () => {
      const i = Number(b.dataset.i);
      const pos = escolhidos.indexOf(i);
      if (pos >= 0) escolhidos.splice(pos);
      else escolhidos.push(i);
      Som.efeito("clique");
      redesenhar();
      if (escolhidos.length === itens.length) setTimeout(() => palco.cancelarEscolha(-9), 300);
    }));
    return new Promise((resolve) => {
      const esperar = () => {
        const escolha = palco.escolher([{ icone: "↺", texto: "Recomeçar a ordem" }], { silencioso: true });
        areaEscolhas.prepend(painel);
        areaEscolhas.classList.add("com-ordem");
        return escolha.then((v) => {
          if (v === 0 || (v === -9 && escolhidos.length < itens.length)) {
            if (v === 0) escolhidos.length = 0;
            redesenhar();
            return esperar();
          }
          areaEscolhas.classList.remove("com-ordem");
          resolve(v === -9 ? [...escolhidos] : v);
        });
      };
      esperar();
    });
  }

  let desafioAtual = "escolha";
  let bonusNoite = false;
  for (let rodada = 0; vidaMonstro > 0; rodada++) {
    // o servidor deixa de fora as últimas perguntas vistas, para o Reino nunca ficar repetitivo
    const trocada = Boolean(perguntaNova);
    const pergunta = perguntaNova || await acaoJogador(`${rotaBatalha}/pergunta`);
    perguntaNova = null;
    desafioAtual = pergunta.desafio || "escolha";
    const trilha = trilhaInfo(pergunta.trilha);
    seloTrilha.hidden = !trilha;
    if (trilha) {
      seloTrilha.style.setProperty("--cor-trilha", trilha.cor);
      seloTrilha.innerHTML = `${trilha.icone} ${escapar(trilha.nome)} · ${escapar(trilha.patente)}${trilha.golpe ? " ⚔️" : ""}`;
      seloTrilha.title = trilha.golpe ? "Tu domina essa trilha: acertar tira 2 de vida do monstro!" : "Acertar dá domínio nessa trilha";
    }
    // a lição da classe que essa pergunta treina, ou o eco de uma pergunta que o herói já errou
    const seloSkill = secao.querySelector("[data-skill]");
    seloSkill.hidden = !pergunta.skill && !pergunta.eco;
    seloSkill.classList.toggle("eco", Boolean(pergunta.eco));
    seloSkill.innerHTML = pergunta.eco ? "🔁 <b>Eco de um erro</b> · revanche!"
      : pergunta.skill ? `${pergunta.skill.icone || "📜"} <b>Lição da tua classe</b> · ${escapar(pergunta.skill.nome)}` : "";
    seloSkill.title = pergunta.eco ? "Tu erraste essa antes. Acerta agora e ela volta cada vez mais tarde, até sair do Grimório de Erros."
      : "Pergunta do currículo da tua classe: cada acerto conta para dominar essa skill (veja no Livro do Herói, tecla K).";
    fonteAtual = pergunta.fonte || null;
    seloFonte.hidden = !fonteAtual;
    if (fonteAtual) {
      seloFonte.innerHTML = textoDaFonte(fonteAtual);
      seloFonte.title = ["livro", "guia"].includes(fonteAtual.tipo) ? "Clica para ler esse capítulo" : "De onde vem essa pergunta";
    }

    // cada tipo de desafio entra de um jeito: múltipla escolha, verdadeiro ou falso, lacuna ou ordem
    palco.esconderCena();
    if (desafioAtual === "vf" && !pergunta.codigo) {
      palco.mostrarCena({ tipo: "destaque", titulo: "Verdadeiro ou falso?", icone: "⚡", efeito: "RELÂMPAGO!", texto: `A resposta é: **${pergunta.afirmacao}**` });
    } else if (pergunta.cenario) {
      // o cenário traz o próprio "tipo" (email/chat): ele vira o formato e não pode trocar o tipo da cena
      palco.mostrarCena({ ...pergunta.cenario, tipo: "mensagem", titulo: "Situação de trabalho", formato: pergunta.cenario.tipo });
    } else if (pergunta.codigo) {
      palco.mostrarCena({ tipo: "codigo", titulo: desafioAtual === "lacuna" ? "Completa a lacuna ✍️" : "O enigma do monstro", codigo: pergunta.codigo });
    }
    const abertura = trocada ? "Hmpf, outra pergunta então!" : rodada === 0 ? (monstro.chefe && efeitosFase.fala) || desafio
      : vidaMonstro < vidaTotal ? "Ainda não acabou!" : "De novo!";
    const tipoDesafio = pergunta.cenario ? "Resolve essa situação do mundo real:"
      : desafioAtual === "vf" ? "Verdadeiro ou falso, rápido!" : desafioAtual === "ordem" ? "Põe o ritual na ordem:" : "";
    const afirmacao = desafioAtual === "vf" ? ` A resposta é **${pergunta.afirmacao}**?` : "";
    palco.dizer(`${abertura} ${tipoDesafio} ${pergunta.pergunta}${afirmacao}`);
    const opcoes = desafioAtual === "vf" ? [{ icone: "✅", texto: "Verdadeiro" }, { icone: "❌", texto: "Falso" }]
      : pergunta.opcoes.map((o) => ({ texto: desafioAtual === "lacuna" ? `\`${o}\`` : o }));
    const escolha = desafioAtual === "ordem" ? escolherOrdem(pergunta.itens) : palco.escolher(opcoes);
    // o chefão tem a mecânica dele: névoa, gelo, reflexos, maré... (só atrapalha a vista, nunca a resposta)
    if (monstro.chefe) aplicarMecanicaDoChefe(secao, monstro.tipoId, fase, rodada === 0);
    desenharGrimorio();
    if (pergunta.tempo) iniciarRelogio(pergunta.tempo);
    const escolhida = await escolha;
    pararRelogio();
    palco.definirItens([]);
    if (escolhida === -1) continue; // Pergunta Nova: a próxima rodada usa a pergunta que a magia trouxe
    if (escolhida === -4) palco.jogadorDiz("⏳ *O tempo acabou...*");
    else if (Array.isArray(escolhida)) palco.jogadorDiz("Essa é a ordem! 📜");
    const vidaAntes = vidaMonstro;
    // -3: uma magia de classe resolveu a rodada (expulsou, apagou ou respondeu por ti); -4: o tempo acabou
    const r = escolhida === -3 ? respostaEspecial
      : await acaoJogador(`${rotaBatalha}/responder`, { resposta: escolhida === -4 ? null : escolhida });
    if (escolhida !== -3) palco.marcarResposta(r.correta);
    if (r.especial) especialFinal = r;
    mana = r.mana;
    efeitos = r.efeitos;
    desenharMana();
    desenharEfeitos();
    desenharSequencia(r.sequenciaPerdida);
    if (r.bonusNoite) bonusNoite = true;
    const certa = r.texto_certo ?? pergunta.opcoes[r.resposta_certa];
    // a explicação termina dizendo onde estudar aquilo
    if (fonteAtual && r.explicacao) r.explicacao = `${r.explicacao} ${estudeEm(fonteAtual)}`;
    // o currículo: a skill da classe dominada (5 acertos) e o eco que saiu do Grimório de Erros
    if (r.skillDominada) {
      Som.efeito("nivel");
      avisoFlutuante(r.skillDominada.icone || "📜", `Skill dominada: ${r.skillDominada.nome}!`, "Tu aprendeste mais um ofício da tua classe. Veja no Livro do Herói (K).");
    }
    if (r.eco === "dominado") avisoFlutuante("🔁", "Eco vencido!", "Essa pergunta que tu tinhas errado saiu do teu Grimório de Erros.");

    if (r.correta) {
      vidaMonstro = r.vidaMonstro;
      ganhos = r.ganhos;
      const bonus = [r.especial && `${r.especial} ✨`, r.golpe && "domínio ⚔️", r.lamina && "Lâmina de Luz ✨", ...r.bonus].filter(Boolean);
      golpeFinal = bonus.length > 0;
      achouTesouro = Boolean(r.faro);
      deixouCair = r.drop ? { raro: r.dropRaro || null } : deixouCair;
      fragmento = r.fragmento || null;
      // o golpe da classe voa até o monstro; quando chega, ele pisca e o dano pula de cima dele
      if (kit !== "guerreiro") animar(palco.elemento.querySelector(".ator-jogador"), "atacando");
      if (r.relampago) fx.numero(heroiEl, "⚡ RELÂMPAGO", "cura");
      await fx.ataque(kit, heroiEl, corpoInimigo, { cor: corDaMagia, critico: golpeFinal });
      if (r.golpeFinal) await fx.golpeFinal(corpoInimigo, corDaMagia);
      animar(inimigo, "atingido");
      const tirou = vidaAntes - vidaMonstro;
      if (tirou > 0) fx.numero(corpoInimigo, r.golpeFinal ? `GOLPE FINAL −${tirou}` : golpeFinal ? `CRÍTICO −${tirou}` : `−${tirou}`, golpeFinal ? "critico" : "dano");
      desenharVidaMonstro();
      if (golpeFinal) animar(document.body, "tremor");
      if (vidaMonstro > 0) {
        const convenceu = r.convenceu ? `Tu erraste... mas com 20 anos de experiência o monstro acreditou em ti. (A certa era: **${certa}**.) ` : "";
        // o acerto tem a cara da classe: feitiço, golpe de espada ou flecha
        const estilo = temaDaClasse().batalha || { acerto: "Acertou em cheio!", icone: "⚔️", efeito: "TCHAK!", proxima: "Manda a próxima! ⚔️" };
        palco.mostrarCena({
          tipo: "destaque", titulo: r.convenceu ? "Tenho 20 Anos de Experiência! 🧓" : bonus.length ? `Golpe certeiro! −${vidaAntes - vidaMonstro} ♥` : estilo.acerto,
          icone: r.convenceu ? "🧓" : bonus.length ? "💥" : estilo.icone, efeito: r.convenceu ? "CONFIA!" : bonus.length ? "CRÍTICO!" : estilo.efeito,
          texto: `${convenceu}${bonus.length ? `Bônus de ${bonus.join(" e ")}. ` : ""}${r.explicacao} Mas ele ainda tem **${vidaMonstro}** de vida!`,
        });
        await palco.escolher([{ texto: estilo.proxima }], { silencioso: true });
        if (r.fase) {
          fase = r.fase;
          efeitosFase = r.efeitosFase;
          await mudarDeFase();
        }
      }
      continue;
    }

    // errou: o monstro contra-ataca (ou o Escudo de Runas e a Esquiva seguram). Sem proteção, o golpe
    // fica no ar e o anel da Defesa ativa aparece: clicar na hora certa apara 1 de dano.
    animar(inimigo, "atacando");
    await fx.ataqueDoMonstro(corpoInimigo, heroiEl, monstro.chefe ? "#ff2a4d" : "#ff4d6d");
    let golpeRecebido = { dano: r.dano, aparou: false, desmaiou: false, perda: 0 };
    if (r.aparar) golpeRecebido = await acaoJogador("aparar", { apertou: await fx.aparar(heroiEl) });
    const { dano, aparou } = golpeRecebido;
    if (dano) {
      animar(document.body, "tremor");
      fx.golpeNoHeroi(heroiEl, dano);
      if (aparou) fx.bloqueio(heroiEl, "APAROU PARTE!");
    } else {
      fx.bloqueio(heroiEl, aparou ? "APAROU!" : r.escudo ? "ESCUDO!" : r.bonus.some((b) => b.startsWith("Esquiva")) ? "ESQUIVOU!" : "BLOQUEADO!");
    }
    desenharVida();
    const explicacao = `${r.esgotou ? "O tempo acabou! " : ""}A certa era: **${certa}**. ${r.explicacao}`;
    palco.mostrarCena(r.escudo
      ? { tipo: "destaque", titulo: "O Escudo de Runas segurou o golpe!", icone: "🛡️", efeito: "CLANG!", texto: `Nenhum coração perdido. ${explicacao}` }
      : aparou && !dano ? { tipo: "destaque", titulo: "Aparaste o golpe! 🛡️", icone: "⚔️", efeito: "CLANG!", texto: `Reflexo perfeito: nenhum coração perdido. ${explicacao}` }
      : aparou ? { tipo: "destaque", titulo: `Aparaste parte do golpe! −${dano} ❤️`, icone: "⚔️", efeito: "TCHANG!", texto: explicacao }
      : !r.dano && r.bonus.some((b) => b.startsWith("Esquiva")) ? { tipo: "destaque", titulo: "Esquivou! 💨", icone: "💨", efeito: "WHOOSH!", texto: `Tua habilidade de Esquiva te livrou do primeiro golpe. ${explicacao}` }
      : !r.dano ? { tipo: "destaque", titulo: "O monstro não conseguiu atacar!", icone: "🌀", efeito: "HÃ?!", texto: `Tua magia de classe segurou o golpe. ${explicacao}` }
        : { tipo: "destaque", titulo: `Tu foste atingido! −${dano} ❤️`, icone: "💥", efeito: "OUCH!", texto: explicacao });
    palco.dizer(golpe, { manterJogador: true });
    if (golpeRecebido.desmaiou) {
      Som.efeito("derrota");
      await palco.escolher([{ texto: "Ugh..." }], { silencioso: true });
      return telaDesmaio(`${monstro.nome} te nocauteou no Reino.`, golpeRecebido.perda);
    }
    const seguir = await palco.escolher([
      { texto: `Continuar lutando ⚔️ (tens ${vidaAtual()} ❤️)` },
      { texto: "Fugir e voltar à aventura 🏃" },
    ], { silencioso: true });
    if (seguir === 1) {
      acaoJogador(`${rotaBatalha}/fugir`).catch(() => {});
      return telaMapa();
    }
  }

  // O chefão perdeu um terço da vida: muda de forma, avisa o que endureceu e a luta segue.
  async function mudarDeFase() {
    fx.rugido(corpoInimigo);
    animar(document.body, "tremor");
    animar(inimigo, "transformando");
    chuvaDeEstrelas(15);
    desenharFase();
    palco.mostrarCena({
      tipo: "destaque", titulo: `FASE ${fase}: ${efeitosFase.nome}`, icone: fase === 3 ? "🔥" : "⚡", efeito: fase === 3 ? "FÚRIA!" : "RAAAH!",
      texto: areaFase.querySelectorAll("span").length
        ? `Agora: ${[...areaFase.querySelectorAll("span")].map((s) => `**${s.textContent}**`).join(", ")}.`
        : "Ele mudou de forma!",
    });
    palco.dizer(efeitosFase.fala);
    await palco.escolher([{ texto: `Encarar a fase ${fase} ⚔️` }], { silencioso: true });
  }

  // vitória! (o prêmio já foi dado pelo servidor junto com a última resposta)
  // o monstro se desfaz em pixels, e a fanfarra toca
  fx.morte(corpoInimigo);
  inimigo.querySelector(".vida-inimigo")?.classList.add("zerada");
  await new Promise((resolver) => setTimeout(resolver, 500));
  Som.efeito("vitoria");
  if (ganhos.some((g) => g.icone === "🪙")) setTimeout(() => Som.efeito("moeda"), 700);
  if (monstro.chefe) chuvaDeEstrelas(60);
  else derrotarMonstro(monstro.id);
  // vitória por magia de classe tem fala própria (o monstro foi embora, foi apagado...)
  const porMagia = especialFinal?.fim === "vitoria" ? especialFinal : null;
  const sequencia = progresso.sequencia || 0;
  const extras = [bonusNoite && "🌙 bônus da noite +25%", sequencia && `🔥 Sequência ${sequencia} +${Math.min(sequencia * 5, 50)}%`].filter(Boolean);
  const textoGanhos = ganhos.length
    ? `Ganhaste ${ganhos.map((g) => g.texto).join(", ")}${extras.length ? ` (${extras.join(", ")})` : ""}.` : "Nenhum prêmio sobrou.";
  palco.mostrarCena({
    tipo: "destaque", titulo: monstro.chefe ? "CHEFÃO DERROTADO!" : porMagia ? `${porMagia.especial}!` : "Monstro derrotado!",
    icone: monstro.chefe ? "👑" : porMagia ? "✨" : "⚔️",
    efeito: monstro.chefe ? "VITÓRIA!" : porMagia ? "PUF!" : golpeFinal ? "CRÍTICO!" : "POW!",
    texto: `${porMagia?.perdeuPremio ? "O DELETE apagou o prêmio junto... ninguém tinha backup. 😅 " : ""}${golpeFinal && !porMagia ? "Golpe certeiro no final! " : ""}${achouTesouro ? "Teu Faro de Tesouro 🗝️ achou algo! " : ""}${deixouCair && !deixouCair.raro ? "Ele deixou cair um item! " : ""}${ganhos.length ? `**Espólio da batalha**${extras.length ? ` (${extras.join(", ")})` : ""}:` : textoGanhos}`,
    espolio: ganhos,
  });
  // drop raro: um visual exclusivo que só cai de monstro, com festa
  if (deixouCair?.raro) {
    const item = itemDoCatalogo(deixouCair.raro);
    setTimeout(() => {
      Som.efeito("evolucao");
      chuvaDeEstrelas(70);
      avisoFlutuante(iconeDoItem(deixouCair.raro, item?.icone || "🎁"), "DROP RARO!", `${item?.nome || "Um item raro"} caiu do monstro! Já está na tua Mochila.`);
    }, 900);
  }
  palco.dizer(derrota, { manterJogador: true });
  verificarSubidaDeNivel(nivelAntes);
  await palco.escolher([{ texto: fragmento ? "Pegar o que ele deixou cair 📜" : "Voltar à aventura ▸" }], { silencioso: true });
  if (fragmento) return mostrarFragmento(fragmento, telaMapa);
  telaMapa();
}

// Um pedaço da história da Grande Ruptura, deixado por um chefão.
function mostrarFragmento(fragmento, aoFechar) {
  const modalMissao = document.getElementById("modal-missao");
  modalMissao.innerHTML = `
    <div class="missao-conteudo fragmento">
      <div class="icone-missao">📜</div>
      <p class="local">Fragmento da Grande Ruptura · ${(progresso.fragmentos || []).length} de 5</p>
      <h2>${escapar(fragmento.titulo)}</h2>
      <p class="texto-fragmento">“${escapar(fragmento.texto)}”</p>
      <div class="acoes"><button class="botao" type="button" data-fechar>Guardar no grimório</button></div>
    </div>`;
  modalMissao.querySelector("[data-fechar]").addEventListener("click", () => {
    modalMissao.close();
    aoFechar();
  });
  abrirModal(modalMissao);
}

// Mostra a festa de subida de nível se o XP que o servidor deu passou de um nível.
function verificarSubidaDeNivel(nivelAntes) {
  const nivelDepois = nivelDe(progresso.xp);
  if (nivelDepois > nivelAntes) subiuDeNivel(nivelDepois);
}

// ---------- fase ----------

async function jogarFase(faseId) {
  Som.musica("academia");
  window.scrollTo(0, 0);
  const fase = await api(`/api/fases/${faseId}`);
  const estado = { acertosQuiz: 0, totalQuiz: 0, estrelasPrompt: null, solucoesVistas: 0, estrelasEtapas: [], canvas: null };

  // Dentro da sala do professor, a aula acontece ali mesmo: na lousa, por cima do mapa.
  const professor = professorPorId(professorDa(fase));
  const mundo = tela.querySelector(".tela-mundo");
  const naSala = Boolean(mundo) && progresso.salaAcademia === professor.sala;
  const topo = `
    <div class="fase-topo">
      <button class="botao botao-fantasma" type="button" data-voltar>${naSala ? "◂ Sair da aula" : "◂ Mapa"}</button>
      <h2><small>${escapar(fase.local || `Fase ${fase.id}`)}</small>${fase.icone} ${escapar(fase.titulo)}</h2>
      <div class="progresso-etapas">${fase.etapas.map(() => "<span></span>").join("")}</div>
    </div>`;
  const secao = criar(naSala ? `
    <section class="aula-na-sala">
      ${topo}
      <div class="lousa">
        <div class="lousa-vazia">
          <span>${escapar([...professor.quadro].join(" · "))}</span>
          <strong>${fase.icone} ${escapar(fase.titulo)}</strong>
          <small>${escapar(fase.subtitulo)}</small>
        </div>
        <div data-lousa></div>
        <div data-conteudo></div>
      </div>
      <div data-zetsu></div>
    </section>` : `
    <section>
      ${topo}
      <div data-zetsu></div>
      <div data-conteudo></div>
    </section>`);
  secao.querySelector("[data-voltar]").addEventListener("click", telaMapa);
  const zetsu = criarZetsu(atorDoProfessor(professor.id));
  secao.querySelector("[data-zetsu]").replaceWith(zetsu.elemento);
  const conteudo = secao.querySelector("[data-conteudo]");
  const marcadores = secao.querySelectorAll(".progresso-etapas span");
  if (naSala) {
    // os painéis de cada fala passam a ser escritos a giz na lousa
    secao.querySelector("[data-lousa]").replaceWith(zetsu.elemento.querySelector(".quadro"));
    mundo.querySelector(".aula-na-sala")?.remove();
    mundo.append(secao);
    atualizarModoMundo();
  } else {
    tela.replaceChildren(secao);
  }

  for (let i = 0; i < fase.etapas.length; i++) {
    marcadores.forEach((m, j) => {
      m.className = j < i ? "feita" : j === i ? "atual" : "";
    });
    const etapa = fase.etapas[i];
    const contexto = { fase, etapa, indice: i, zetsu, conteudo, estado };
    if (etapa.tipo === "dialogo") await etapaDialogo(contexto);
    else if (etapa.tipo === "quiz") await etapaQuiz(contexto);
    else if (etapa.tipo === "classificar") await etapaClassificar(contexto);
    else if (etapa.tipo === "construir_prompt") await etapaConstruirPrompt(contexto);
    else if (etapa.tipo === "checklist") await etapaChecklist(contexto);
    else if (etapa.tipo === "ordenar") await etapaOrdenar(contexto);
    else if (etapa.tipo === "anonimizar") await etapaAnonimizar(contexto);
    else if (etapa.tipo === "verificar_codigo") await etapaVerificarCodigo(contexto);
    else if (etapa.tipo === "missao_api") await etapaMissaoApi(contexto);
    else if (etapa.tipo === "missao_dashboard") await etapaMissaoDashboard(contexto);
    else if (etapa.tipo === "canvas") await etapaCanvas(contexto);
    else if (etapa.tipo === "pitch") await etapaPitch(contexto);
    if (!tela.contains(secao)) return; // aluno voltou para o mapa no meio da fase
  }
  concluirFase(fase, estado);
}

function botaoContinuar(texto = "Continuar ▸") {
  return criar(`<button class="botao" type="button">${texto}</button>`);
}

function esperarClique(botao) {
  return new Promise((resolve) => botao.addEventListener("click", resolve, { once: true }));
}

// O que o aventureiro "responde" para seguir a conversa.
const REACOES = ["Entendi, mestre!", "Continua, tô curtindo!", "Faz sentido...", "Uau! E aí?", "Certo!", "Hmm, interessante.", "Saquei!"];

async function etapaDialogo({ etapa, zetsu, conteudo }) {
  conteudo.replaceChildren();
  for (let i = 0; i < etapa.falas.length; i++) {
    // uma fala pode ser só texto ou { texto, cena } com um painel de quadrinho
    const item = typeof etapa.falas[i] === "string" ? { texto: etapa.falas[i] } : etapa.falas[i];
    if (item.cena) zetsu.mostrarCena(item.cena);
    zetsu.dizer(item.texto.replaceAll("{nome}", nomeAluno()));
    const ultima = i === etapa.falas.length - 1;
    const resposta = ultima ? "Bora! ⚔️" : REACOES[i % REACOES.length];
    // primeiro clique durante a digitação só completa a frase
    while (true) {
      await zetsu.escolher([{ texto: resposta }], { silencioso: true });
      if (zetsu.digitando()) zetsu.pular();
      else break;
    }
  }
  zetsu.esconderCena();
}

async function etapaQuiz({ fase, etapa, indice, zetsu, conteudo, estado }) {
  const total = etapa.perguntas.length;
  estado.totalQuiz += total;
  conteudo.replaceChildren();

  for (let p = 0; p < total; p++) {
    const pergunta = etapa.perguntas[p];
    if (pergunta.codigo) zetsu.mostrarCena({ tipo: "codigo", titulo: "Olha isso aqui", codigo: pergunta.codigo });
    else zetsu.esconderCena();
    zetsu.dizer(`**Pergunta ${p + 1} de ${total}.** ${pergunta.pergunta}`);

    const promessa = zetsu.escolher(pergunta.opcoes.map((o) => ({ texto: o })));
    let usouPocao = false;
    const montarItens = () => zetsu.definirItens(quantidade("pocao") ? [{
      icone: iconeDoItem("pocao", "🧪"), nome: "Poção da Clareza: some com 2 respostas erradas", quantidade: usouPocao ? 0 : quantidade("pocao"),
      usar: async () => {
        if (usouPocao || !(await gastarItem("pocao"))) return;
        usouPocao = true;
        const r = await api(`/api/fases/${fase.id}/pocao`, { etapa: indice, pergunta: p });
        zetsu.removerOpcoes(r.remover);
        montarItens();
      },
    }] : []);
    montarItens();
    const escolhida = await promessa;
    zetsu.definirItens([]);
    const resultado = await api(`/api/fases/${fase.id}/quiz`, { etapa: indice, pergunta: p, resposta: escolhida });
    zetsu.marcarResposta(resultado.correta);
    if (resultado.correta) {
      estado.acertosQuiz += 1;
      const r = zetsu.elemento.querySelector(".balao-jogador").getBoundingClientRect();
      faiscas(r.left + r.width / 2, r.top + r.height / 2, "#4fd1a5");
      zetsu.dizer(resultado.explicacao, { manterJogador: true });
    } else {
      zetsu.dizer(`Não foi dessa vez! A certa é: **${pergunta.opcoes[resultado.resposta_certa]}**. Guarda essa!`, { manterJogador: true });
    }
    await zetsu.escolher([{ texto: p === total - 1 ? "Bora seguir!" : "Manda a próxima!" }], { silencioso: true });
  }
  zetsu.esconderCena();
}

async function etapaClassificar(contexto) {
  const { fase, etapa, indice, zetsu, conteudo } = contexto;
  zetsu.dizer(etapa.enunciado);
  const escolhas = new Array(etapa.trechos.length).fill(null);
  // por padrão as opções são as partes do P-C-T-F; a etapa pode trazer rótulos próprios
  const rotulo = (parte) => (etapa.rotulos && etapa.rotulos[parte]) || PARTES[parte].rotulo;

  const painel = criar(`
    <div class="painel">
      <div class="trechos">
        ${etapa.trechos.map((t, i) => `
          <div class="trecho" data-i="${i}">
            <span>“${escapar(t.texto)}”</span>
            <div class="chips">
              ${etapa.partes.map((p) => `<button class="chip" type="button" data-parte="${p}">${escapar(rotulo(p))}</button>`).join("")}
            </div>
          </div>`).join("")}
      </div>
      <div class="acoes"><button class="botao" type="button" data-conferir disabled>Conferir</button></div>
    </div>`);
  conteudo.replaceChildren(painel);
  const conferir = painel.querySelector("[data-conferir]");

  painel.querySelectorAll(".trecho").forEach((linha) => {
    const i = Number(linha.dataset.i);
    linha.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        linha.querySelectorAll(".chip").forEach((c) => c.classList.remove("selecionado"));
        chip.classList.add("selecionado");
        escolhas[i] = chip.dataset.parte;
        conferir.disabled = escolhas.includes(null);
      });
    });
  });

  await esperarClique(conferir);
  conferir.remove();
  const resultado = await api(`/api/fases/${fase.id}/classificar`, { etapa: indice, respostas: escolhas });

  painel.querySelectorAll(".trecho").forEach((linha, i) => {
    const detalhe = resultado.detalhes[i];
    linha.classList.add(detalhe.acertou ? "acertou" : "errou");
    linha.querySelectorAll(".chip").forEach((c) => (c.disabled = true));
    if (!detalhe.acertou) {
      const porque = detalhe.explicacao ? ` ${escapar(detalhe.explicacao)}` : "";
      linha.append(criar(`<span class="correcao">Esse aqui é <strong>${escapar(rotulo(detalhe.certa))}</strong>.${porque}</span>`));
    }
  });

  const { acertos, total } = resultado;
  if (acertos === total) zetsu.dizer(`**${acertos} de ${total}!** Gabaritou, ${nomeAluno()}! Olho clínico.`);
  else if (acertos >= total - 2) zetsu.dizer(`**${acertos} de ${total}.** Muito bom! Dá uma olhada nos que eu corrigi.`);
  else zetsu.dizer(`**${acertos} de ${total}.** Tranquilo, é treino! Relê as correções e, se quiser, tenta de novo.`);

  const acoes = painel.querySelector(".acoes");
  const continuar = botaoContinuar();
  await new Promise((resolve) => {
    if (acertos < total) {
      const repetir = criar('<button class="botao botao-fantasma" type="button">Tentar de novo</button>');
      repetir.addEventListener("click", () => etapaClassificar(contexto).then(resolve), { once: true });
      acoes.append(repetir);
    }
    continuar.addEventListener("click", resolve, { once: true });
    acoes.append(continuar);
  });
}

async function etapaConstruirPrompt({ fase, etapa, indice, zetsu, conteudo, estado }) {
  zetsu.dizer("Lê o cenário e escreve cada parte do prompt. Quando terminar, clica em **Avaliar meu prompt**.");

  const painel = criar(`
    <div class="painel">
      <div class="cenario">
        <strong>📋 Cenário</strong>
        <p>${escapar(etapa.cenario)}</p>
        <p>Prompt fraco que <em>não</em> queremos: <span class="prompt-fraco">${escapar(etapa.prompt_fraco)}</span></p>
      </div>
      <div class="campos-prompt">
        ${Object.entries(PARTES).map(([chave, p]) => `
          <div class="campo" data-parte="${chave}">
            <label for="campo-${chave}"><span class="letra">${p.letra}</span>${p.rotulo}</label>
            <textarea id="campo-${chave}" data-campo="${chave}" placeholder="${escapar(p.exemplo)}"></textarea>
            <small>${escapar(p.dica)}</small>
          </div>`).join("")}
      </div>
      <div class="preview" data-preview></div>
      <div class="acoes"><button class="botao" type="button" data-avaliar>Avaliar meu prompt</button></div>
      <div data-resultado></div>
    </div>`);
  conteudo.replaceChildren(painel);

  const campos = () => Object.fromEntries(
    [...painel.querySelectorAll("[data-campo]")].map((t) => [t.dataset.campo, t.value]));
  const preview = painel.querySelector("[data-preview]");
  painel.querySelectorAll("[data-campo]").forEach((t) =>
    t.addEventListener("input", () => {
      preview.textContent = Object.values(campos()).map((v) => v.trim()).filter(Boolean).join("\n");
    }));

  const areaResultado = painel.querySelector("[data-resultado]");
  const avaliarBotao = painel.querySelector("[data-avaliar]");

  await new Promise((concluir) => {
    avaliarBotao.addEventListener("click", async () => {
      avaliarBotao.disabled = true;
      avaliarBotao.textContent = "Zetsu está lendo...";
      try {
        const r = await api(`/api/fases/${fase.id}/prompt`, { etapa: indice, campos: campos() });
        zetsu.dizer(r.fala);
        mostrarResultado(r);
        if (r.aprovado) estado.estrelasPrompt = Math.max(estado.estrelasPrompt || 0, r.estrelas);
      } catch (erro) {
        zetsu.dizer(`Ops, deu um erro: ${erro.message}`);
      } finally {
        avaliarBotao.disabled = false;
        avaliarBotao.textContent = "Avaliar de novo";
      }
    });

    function mostrarResultado(r) {
      const bloco = criar(`
        <div class="resultado">
          <div class="nota-geral">
            <span class="numero">${r.nota}<small>/100</small></span>
            <span class="estrelas">${estrelasHtml(r.estrelas)}</span>
          </div>
          ${r.alertas.length ? `
            <div class="alerta-dados">
              <strong>⛔ Dado sensível no prompt</strong>
              <ul>${r.alertas.map((a) => `<li>${escapar(a)}</li>`).join("")}</ul>
            </div>` : ""}
          <div class="partes">
            ${Object.keys(PARTES).map((chave) => [chave, r.partes[chave]]).map(([chave, parte]) => `
              <div class="parte">
                <div class="parte-cabecalho"><span>${PARTES[chave].rotulo}</span><span>${parte.pontos}/${parte.maximo}</span></div>
                <div class="barra"><div style="width:${(parte.pontos / parte.maximo) * 100}%"></div></div>
                <ul>
                  ${parte.elogios.map((e) => `<li class="elogio">${escapar(e)}</li>`).join("")}
                  ${parte.dicas.map((d) => `<li class="dica">${escapar(d)}</li>`).join("")}
                </ul>
              </div>`).join("")}
          </div>
          <div class="acoes" data-acoes-resultado></div>
          <div data-opiniao></div>
        </div>`);
      const acoes = bloco.querySelector("[data-acoes-resultado]");

      if (iaAtiva) {
        const botaoIa = criar('<button class="botao botao-ia" type="button">🤖 Segunda opinião do Zetsu (IA)</button>');
        botaoIa.addEventListener("click", async () => {
          botaoIa.disabled = true;
          const alvo = bloco.querySelector("[data-opiniao]");
          alvo.replaceChildren(criar('<p class="carregando">Zetsu está pensando com a IA...</p>'));
          try {
            const { resposta } = await api("/api/zetsu/opiniao", { cenario: etapa.cenario, prompt: r.prompt_montado });
            alvo.replaceChildren(criar(`<div class="opiniao-ia">${formatar(resposta)}</div>`));
          } catch (erro) {
            alvo.replaceChildren(criar(`<p class="carregando">${escapar(erro.message)}</p>`));
          }
        });
        acoes.append(botaoIa);
      }
      if (r.aprovado) {
        const continuar = botaoContinuar("Concluir fase ▸");
        continuar.addEventListener("click", concluir, { once: true });
        acoes.append(continuar);
      }
      areaResultado.replaceChildren(bloco);
    }
  });
}

async function etapaChecklist({ fase, etapa, indice, zetsu, conteudo }) {
  zetsu.dizer(`**${etapa.titulo}**: faz cada item com calma. Travou? Clica em **Preciso de ajuda**.`);
  const feitos = new Array(etapa.itens.length).fill(false);

  const painel = criar(`
    <div class="painel">
      <h3>${escapar(etapa.titulo)}</h3>
      <div class="checklist">
        ${etapa.itens.map((item, i) => `
          <div class="item-check" data-i="${i}">
            <span class="marca" aria-hidden="true">${i + 1}</span>
            <div class="item-corpo">
              <strong>${escapar(item.titulo)}</strong>
              <p>${formatar(item.descricao)}</p>
              ${item.comando ? blocoCodigo(item.comando, true) : ""}
              ${item.codigo ? blocoCodigo(item.codigo, true) : ""}
              ${item.verificacao ? `
                <form class="verificacao">
                  <label for="verif-${indice}-${i}">${escapar(item.verificacao.rotulo)}</label>
                  <div class="linha-verificacao">
                    <input type="text" id="verif-${indice}-${i}" placeholder="Ex.: ${escapar(item.verificacao.exemplo)}" autocomplete="off">
                    <button class="botao" type="submit">Verificar</button>
                  </div>
                </form>` : '<button class="botao botao-fantasma" type="button" data-feito>✓ Já fiz</button>'}
              <p class="retorno" aria-live="polite" hidden></p>
              <button class="link-ajuda" type="button" data-ajuda>Preciso de ajuda</button>
            </div>
          </div>`).join("")}
      </div>
      <div class="acoes"><button class="botao" type="button" data-continuar disabled>Continuar ▸</button></div>
    </div>`);
  conteudo.replaceChildren(painel);
  ativarCopiar(painel);
  const continuar = painel.querySelector("[data-continuar]");

  function marcarFeito(linha, i) {
    feitos[i] = true;
    linha.classList.add("feito");
    linha.querySelector(".marca").textContent = "✓";
    linha.querySelectorAll("input, .verificacao button, [data-feito]").forEach((el) => (el.disabled = true));
    continuar.disabled = feitos.includes(false);
    if (!continuar.disabled) zetsu.dizer("Tudo pronto! Pode seguir quando quiser.");
  }

  painel.querySelectorAll(".item-check").forEach((linha) => {
    const i = Number(linha.dataset.i);
    const item = etapa.itens[i];
    // Respostas aparecem no balão e também embaixo do item, que é onde o aluno está olhando.
    const retorno = linha.querySelector(".retorno");
    const responder = (mensagem, tipo) => {
      zetsu.dizer(mensagem);
      retorno.innerHTML = `<strong>Zetsu:</strong> ${formatar(mensagem)}`;
      retorno.className = `retorno ${tipo}`;
      retorno.hidden = false;
    };

    linha.querySelector("[data-ajuda]").addEventListener("click", () => responder(item.ajuda, "dica"));
    linha.querySelector("[data-feito]")?.addEventListener("click", () => marcarFeito(linha, i));

    linha.querySelector(".verificacao")?.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const input = linha.querySelector("input");
      if (!input.value.trim()) return;
      const r = await api(`/api/fases/${fase.id}/checklist`, { etapa: indice, item: i, resposta: input.value });
      responder(r.mensagem, r.ok ? "sucesso" : "erro");
      linha.classList.toggle("com-erro", !r.ok);
      if (r.ok) marcarFeito(linha, i);
    });
  });

  await esperarClique(continuar);
}

async function etapaOrdenar({ fase, etapa, indice, zetsu, conteudo }) {
  zetsu.dizer(etapa.enunciado);
  let ordem = [...etapa.itens];

  const painel = criar(`
    <div class="painel">
      <ol class="lista-ordenar"></ol>
      <div class="acoes" data-acoes><button class="botao" type="button" data-conferir>Conferir ordem</button></div>
    </div>`);
  conteudo.replaceChildren(painel);
  const lista = painel.querySelector(".lista-ordenar");
  const acoes = painel.querySelector("[data-acoes]");
  let posicoes = null;
  let travado = false;

  function desenhar() {
    lista.replaceChildren(...ordem.map((texto, i) => {
      const classe = posicoes ? (posicoes[i] ? "certo" : "errado") : "";
      const li = criar(`
        <li class="${classe}">
          <span class="posicao">${i + 1}</span>
          <span class="texto">${escapar(texto)}</span>
          <span class="setas">
            <button type="button" data-mover="-1" aria-label="Subir" ${i === 0 || travado ? "disabled" : ""}>▲</button>
            <button type="button" data-mover="1" aria-label="Descer" ${i === ordem.length - 1 || travado ? "disabled" : ""}>▼</button>
          </span>
        </li>`);
      li.querySelectorAll("[data-mover]").forEach((botao) => {
        botao.addEventListener("click", () => {
          const destino = i + Number(botao.dataset.mover);
          [ordem[i], ordem[destino]] = [ordem[destino], ordem[i]];
          posicoes = null; // mexeu: some a correção antiga
          desenhar();
        });
      });
      return li;
    }));
  }
  desenhar();

  await new Promise((concluir) => {
    painel.querySelector("[data-conferir]").addEventListener("click", async () => {
      const r = await api(`/api/fases/${fase.id}/ordenar`, { etapa: indice, ordem });
      posicoes = r.posicoes;
      desenhar();
      acoes.querySelectorAll("[data-extra]").forEach((b) => b.remove());

      if (r.acertos === r.total) {
        travado = true;
        desenhar();
        zetsu.dizer("Ordem perfeita! É exatamente esse o ciclo: pedir, entender, criar, rodar e corrigir.");
        acoes.replaceChildren();
        const continuar = botaoContinuar();
        continuar.addEventListener("click", concluir, { once: true });
        acoes.append(continuar);
        return;
      }

      zetsu.dizer(`**${r.acertos} de ${r.total}** no lugar certo. Os verdes estão certos; mexe nos vermelhos e confere de novo.`);
      const revelar = criar('<button class="botao botao-fantasma" type="button" data-extra>Ver a resposta</button>');
      revelar.addEventListener("click", () => {
        ordem = [...r.ordem_certa];
        posicoes = ordem.map(() => true);
        travado = true;
        desenhar();
        zetsu.dizer("Olha a ordem certa com calma. Repara que **entender o código vem antes de rodar**.");
        acoes.replaceChildren();
        const continuar = botaoContinuar();
        continuar.addEventListener("click", concluir, { once: true });
        acoes.append(continuar);
      });
      acoes.append(revelar);
    });
  });
}

async function etapaAnonimizar({ fase, etapa, indice, zetsu, conteudo }) {
  zetsu.dizer(etapa.enunciado);

  const painel = criar(`
    <div class="painel">
      <div class="anonimizar">
        <div>
          <h3>📄 Chamado original</h3>
          ${blocoCodigo(etapa.texto)}
        </div>
        <div>
          <label for="texto-anonimo"><h3>✏️ Tua versão para a IA</h3></label>
          <textarea id="texto-anonimo" class="texto-anonimo" spellcheck="false"></textarea>
          <div class="marcadores">
            Marcadores: ${["[NOME]", "[CPF]", "[TELEFONE]", "[EMAIL]", "[SENHA]", "[PROCESSO]"]
              .map((m) => `<button class="chip" type="button" data-marcador="${m}">${m}</button>`).join("")}
          </div>
        </div>
      </div>
      <div class="acoes"><button class="botao" type="button" data-verificar>Verificar anonimização</button></div>
      <div data-resultado></div>
    </div>`);
  conteudo.replaceChildren(painel);

  const area = painel.querySelector(".texto-anonimo");
  area.value = etapa.texto;
  // clicar num marcador troca o texto selecionado por ele
  painel.querySelectorAll("[data-marcador]").forEach((chip) => {
    chip.addEventListener("mousedown", (evento) => evento.preventDefault()); // não tira o foco da seleção
    chip.addEventListener("click", () => {
      const { selectionStart: inicio, selectionEnd: fim } = area;
      area.setRangeText(chip.dataset.marcador, inicio, fim, "end");
      area.focus();
    });
  });

  const verificar = painel.querySelector("[data-verificar]");
  const areaResultado = painel.querySelector("[data-resultado]");

  await new Promise((concluir) => {
    verificar.addEventListener("click", async () => {
      const r = await api(`/api/fases/${fase.id}/anonimizar`, { etapa: indice, texto: area.value });
      zetsu.dizer(r.fala);
      const itens = [
        ...r.vazamentos.map((v) => `<li class="erro">⛔ Ainda aparece: <strong>${escapar(v)}</strong></li>`),
        ...r.faltando.map((f) => `<li class="aviso">⚠️ Você apagou ${escapar(f)}</li>`),
      ];
      const bloco = criar(`
        <div class="resultado">
          <div class="nota-geral">
            <span class="numero">${r.protegidos}<small>/${r.total}</small></span>
            <span>dados protegidos</span>
          </div>
          ${itens.length ? `<ul class="lista-anonimizar">${itens.join("")}</ul>` : ""}
          <div class="acoes" data-acoes-resultado></div>
        </div>`);
      if (r.aprovado) {
        verificar.disabled = true;
        area.readOnly = true;
        const continuar = botaoContinuar();
        continuar.addEventListener("click", concluir, { once: true });
        bloco.querySelector("[data-acoes-resultado]").append(continuar);
      } else {
        verificar.textContent = "Verificar de novo";
      }
      areaResultado.replaceChildren(bloco);
    });
  });
}

// ---------- missões (Fase 5) ----------

function documentacaoHtml(secoes) {
  return `
    <details class="documentacao" open>
      <summary>📘 Documentação</summary>
      ${secoes.map((s) => `
        <div class="doc-secao">
          <h4>${escapar(s.titulo)}</h4>
          ${s.texto ? `<p>${formatar(s.texto)}</p>` : ""}
          ${s.codigo ? blocoCodigo(s.codigo, true) : ""}
        </div>`).join("")}
    </details>`;
}

function listaChecks(checks) {
  return `<ul class="lista-checks">${checks.map((c) => `
    <li class="${c.ok ? "ok" : "falhou"}">
      <span>${c.ok ? "✓" : "✗"}</span>
      <div><strong>${escapar(c.descricao)}</strong>${c.dica ? `<small>${escapar(c.dica)}</small>` : ""}</div>
    </li>`).join("")}</ul>`;
}

// Botão que busca o script de referência do Zetsu (só aparece depois da primeira tentativa).
function botaoSolucao(fase, indice, alvo, zetsu, estado) {
  const botao = criar('<button class="botao botao-fantasma" type="button">👀 Ver a solução do Zetsu (-1 ⭐)</button>');
  botao.addEventListener("click", async () => {
    const { arquivo, codigo } = await api(`/api/fases/${fase.id}/solucao/${indice}`);
    estado.solucoesVistas += 1;
    zetsu.dizer("Esse é o meu jeito de fazer. Lê com calma, entende cada linha e **roda você mesmo**: copiar sem entender não vale!");
    alvo.replaceChildren(criar(`<div><h4>📄 ${escapar(arquivo)}</h4>${blocoCodigo(codigo, true)}</div>`));
    ativarCopiar(alvo);
    botao.remove();
  });
  return botao;
}

async function etapaVerificarCodigo({ fase, etapa, indice, zetsu, conteudo }) {
  zetsu.dizer(`**${etapa.titulo}**. Lê os passos, usa a IA do teu jeito e cola o resultado aqui.`);

  const painel = criar(`
    <div class="painel">
      <h3>${escapar(etapa.titulo)}</h3>
      <ol class="passos">${etapa.instrucoes.map((p) => `<li>${formatar(p)}</li>`).join("")}</ol>
      <details class="dica-prompt">
        <summary>💡 Travou no prompt? Uma ideia de ponto de partida</summary>
        ${blocoCodigo(etapa.dica_prompt, true)}
      </details>
      <p class="requisitos-titulo">O Zetsu vai conferir:</p>
      <ul class="requisitos">${etapa.checks.map((c) => `<li>${escapar(c.descricao)}</li>`).join("")}</ul>
      <label for="codigo-${indice}" class="rotulo-campo">${escapar(etapa.rotulo)}</label>
      <textarea id="codigo-${indice}" class="area-codigo" spellcheck="false" placeholder="<!DOCTYPE html>..."></textarea>
      <div class="acoes"><button class="botao" type="button" data-verificar>Verificar</button></div>
      <div data-preview></div>
      <div data-resultado></div>
    </div>`);
  conteudo.replaceChildren(painel);
  ativarCopiar(painel);
  const area = painel.querySelector("textarea");
  const verificar = painel.querySelector("[data-verificar]");
  const areaResultado = painel.querySelector("[data-resultado]");

  await new Promise((concluir) => {
    verificar.addEventListener("click", async () => {
      if (!area.value.trim()) return zetsu.dizer("Cola o código primeiro, aprendiz!");
      const r = await api(`/api/fases/${fase.id}/verificar_codigo`, { etapa: indice, codigo: area.value });
      const faltam = r.checks.filter((c) => !c.ok).length;
      if (r.aprovado) zetsu.dizer("Aprovado! Tá completo e sem nada que não devia estar ali.");
      else if (r.problemas.length) zetsu.dizer(`Opa: ${r.problemas[0]}`);
      else zetsu.dizer(`Quase! Faltam **${faltam}** requisito(s). Pede para a IA ajustar só o que falta.`);

      // Roda o código do aluno num iframe isolado (sem acesso ao jogo nem ao localStorage dele).
      if (etapa.preview) {
        const moldura = criar(`
          <div class="moldura-preview">
            <div class="barra-navegador"><span></span><span></span><span></span> teu produto, rodando de verdade</div>
            <iframe sandbox="allow-scripts" title="Prévia do teu produto"></iframe>
          </div>`);
        moldura.querySelector("iframe").srcdoc = area.value;
        painel.querySelector("[data-preview]").replaceChildren(moldura);
      }

      const bloco = criar(`
        <div class="resultado">
          ${r.problemas.length ? `<div class="alerta-dados"><strong>⛔ Corrija antes</strong><ul>${r.problemas.map((p) => `<li>${escapar(p)}</li>`).join("")}</ul></div>` : ""}
          ${listaChecks(r.checks)}
          <div class="acoes" data-acoes-resultado></div>
        </div>`);
      if (r.aprovado) {
        verificar.disabled = true;
        const continuar = botaoContinuar();
        continuar.addEventListener("click", concluir, { once: true });
        bloco.querySelector("[data-acoes-resultado]").append(continuar);
      } else {
        verificar.textContent = "Verificar de novo";
      }
      areaResultado.replaceChildren(bloco);
    });
  });
}

async function etapaMissaoApi({ fase, etapa, indice, zetsu, conteudo, estado }) {
  zetsu.dizer(`**${etapa.titulo}**. Lê a documentação, pede o script para a IA, roda no teu terminal e responde as perguntas com o que ele mostrar.`);

  const painel = criar(`
    <div class="painel">
      <h3>${escapar(etapa.titulo)}</h3>
      ${documentacaoHtml(etapa.documentacao)}
      <div class="acoes"><button class="botao botao-fantasma" type="button" data-testar>🔌 Testar a API aqui</button></div>
      <div data-teste></div>
      <h4>Perguntas do coordenador</h4>
      <form class="perguntas-missao">
        ${etapa.perguntas.map((p, i) => `
          <div class="pergunta-missao" data-i="${i}">
            <label for="missao-${indice}-${i}">${escapar(p.pergunta)}</label>
            <input type="text" id="missao-${indice}-${i}" autocomplete="off" ${p.tipo === "numero" ? 'inputmode="numeric"' : ""}>
            <small class="retorno" hidden></small>
          </div>`).join("")}
        <div class="acoes" data-acoes><button class="botao" type="submit">Conferir respostas</button></div>
      </form>
      <div data-solucao></div>
    </div>`);
  conteudo.replaceChildren(painel);
  ativarCopiar(painel);

  // Mostra como a API responde, para o aluno entender o formato antes de pedir o script.
  painel.querySelector("[data-testar]").addEventListener("click", async () => {
    const resposta = await fetch(etapa.testar, { headers: { Authorization: "Bearer zetsu-treino-2026" } });
    const dados = await resposta.json();
    const amostra = { total: dados.total, problemas: dados.problemas.slice(0, 2) };
    painel.querySelector("[data-teste]").replaceChildren(criar(`
      <div><p class="legenda">Resposta real da API (mostrando só 2 dos ${dados.total} problemas):</p>${blocoCodigo(JSON.stringify(amostra, null, 2))}</div>`));
    zetsu.dizer("Viu o formato? É isso que o teu script vai receber. Agora pede para a IA um script que busque, filtre e conte.");
  });

  const form = painel.querySelector(".perguntas-missao");
  let tentativas = 0;
  await new Promise((concluir) => {
    form.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      if (form.dataset.concluido) return;
      const respostas = [...form.querySelectorAll("input")].map((i) => i.value);
      const r = await api(`/api/fases/${fase.id}/missao`, { etapa: indice, respostas });
      tentativas += 1;
      form.querySelectorAll(".pergunta-missao").forEach((linha, i) => {
        const res = r.resultados[i];
        const retorno = linha.querySelector(".retorno");
        linha.classList.toggle("certo", res.ok);
        linha.classList.toggle("errado", !res.ok);
        retorno.hidden = false;
        retorno.innerHTML = res.ok ? "✓ Bate com os dados do Zabbix!" : formatar(res.dica);
        retorno.className = `retorno ${res.ok ? "sucesso" : "erro"}`;
      });

      const acoes = form.querySelector("[data-acoes]");
      if (r.aprovado) {
        form.dataset.concluido = "1";
        form.querySelectorAll("input, button").forEach((el) => (el.disabled = true));
        zetsu.dizer("Tudo certo! Esses são exatamente os números do Zabbix. Levantamento entregue sem um dado vazar.");
        const continuar = botaoContinuar();
        continuar.addEventListener("click", concluir, { once: true });
        form.after(continuar);
      } else {
        zetsu.dizer("Algum número não bateu. Confere a dica embaixo de cada pergunta e roda o script de novo.");
        if (tentativas === 1) acoes.append(botaoSolucao(fase, indice, painel.querySelector("[data-solucao]"), zetsu, estado));
      }
    });
  });
}

const ICONES_PAINEL = { stat: "🔢", gauge: "⏱️", timeseries: "📈", graph: "📈", barchart: "📊", piechart: "🥧", table: "📋", text: "📝" };

// Desenha o layout do dashboard com dados fictícios, só para o aluno ver como ficou.
function previewDashboard(dados) {
  const semente = (texto) => [...String(texto)].reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 997, 7);
  const posicionados = dados.paineis.filter((p) => p.pos);
  const paineis = posicionados.map((p) => {
    const s = semente(p.titulo + p.id);
    let visual = `<span class="icone-painel">${ICONES_PAINEL[p.tipo] || "🧩"}</span>`;
    if (p.tipo === "stat") visual = `<span class="valor-stat">${(s % 90) + 10}${/%/.test(p.titulo) ? "%" : ""}</span>`;
    if (p.tipo === "gauge") visual = `<span class="valor-gauge" style="--valor:${(s % 25) + 75}">${(s % 25) + 75}%</span>`;
    if (p.tipo === "timeseries" || p.tipo === "graph") {
      const pontos = Array.from({ length: 12 }, (_, i) =>
        `${i * 10},${(17 + 10 * Math.sin(i * 0.8 + s) + ((s * (i + 1)) % 5) - 2).toFixed(1)}`).join(" ");
      visual = `<svg viewBox="0 0 110 34" preserveAspectRatio="none" class="linha-serie"><polyline points="${pontos}" /></svg>`;
    }
    if (p.tipo === "barchart") {
      visual = `<div class="barras">${[0, 1, 2, 3, 4].map((i) => `<span style="height:${25 + ((s * (i + 2)) % 70)}%"></span>`).join("")}</div>`;
    }
    if (p.tipo === "piechart") visual = `<span class="pizza" style="--a:${(s % 40) + 30}%"></span>`;
    return `
      <div class="painel-grafana" style="grid-column:${p.pos.x + 1} / span ${p.pos.w}; grid-row:${p.pos.y + 1} / span ${p.pos.h}">
        <span class="titulo-painel">${escapar(p.titulo || "(sem título)")}</span>
        <div class="visual-painel">${visual}</div>
      </div>`;
  }).join("");
  return `
    <div class="preview-grafana">
      <div class="topo-grafana">📊 ${escapar(dados.titulo || "(sem título)")} <small>versão ${dados.versao}</small></div>
      <div class="grade-grafana">${paineis || '<p class="legenda">Nenhum painel com gridPos para desenhar.</p>'}</div>
    </div>`;
}

async function etapaMissaoDashboard({ fase, etapa, indice, zetsu, conteudo, estado }) {
  zetsu.dizer(`**${etapa.titulo}**. Pede para a IA um script Python que monte o JSON e mande para a API. Depois clica em **Conferir meu dashboard**.`);

  const painel = criar(`
    <div class="painel">
      <h3>${escapar(etapa.titulo)}</h3>
      ${documentacaoHtml(etapa.documentacao)}
      <div class="acoes" data-acoes><button class="botao" type="button" data-conferir>📊 Conferir meu dashboard</button></div>
      <div data-resultado></div>
      <div data-solucao></div>
    </div>`);
  conteudo.replaceChildren(painel);
  ativarCopiar(painel);
  const conferir = painel.querySelector("[data-conferir]");
  const areaResultado = painel.querySelector("[data-resultado]");
  let mostrouSolucao = false;

  await new Promise((concluir) => {
    conferir.addEventListener("click", async () => {
      const r = await api(`/api/fases/${fase.id}/dashboard`);
      if (!r.encontrado) {
        zetsu.dizer("Ainda não chegou nenhum dashboard no meu Grafana. Rodou o script? Confere se ele imprimiu **200** e **success**.");
      } else if (r.aprovado) {
        zetsu.dizer("Dashboard aprovado! Layout limpo, KPIs em destaque e gráfico de tendência. Pode mostrar pro coordenador.");
      } else {
        zetsu.dizer("Recebi teu dashboard, mas ainda tem ajuste. Olha a lista, corrige o JSON e roda o script de novo.");
      }

      areaResultado.replaceChildren(criar(`
        <div class="resultado">
          ${r.encontrado ? `${previewDashboard(r)}${listaChecks(r.checks)}` : ""}
        </div>`));

      if (r.aprovado) {
        conferir.remove();
        const continuar = botaoContinuar();
        continuar.addEventListener("click", concluir, { once: true });
        painel.querySelector("[data-acoes]").append(continuar);
      } else {
        conferir.textContent = "📊 Conferir de novo";
        if (!mostrouSolucao) {
          mostrouSolucao = true;
          painel.querySelector("[data-acoes]").append(botaoSolucao(fase, indice, painel.querySelector("[data-solucao]"), zetsu, estado));
        }
      }
    });
  });
}

// ---------- projeto final (Fase 6) ----------

async function etapaCanvas({ fase, etapa, indice, zetsu, conteudo, estado }) {
  zetsu.dizer("Preenche o canvas da tua ideia. Cada campo tem um exemplo para te inspirar.");

  const painel = criar(`
    <div class="painel">
      <h3>${escapar(etapa.titulo)}</h3>
      <form class="canvas">
        ${etapa.campos.map((c) => `
          <div class="campo-canvas ${c.chave === "nome" ? "campo-largo" : ""}" data-chave="${c.chave}">
            <label for="canvas-${c.chave}">${escapar(c.rotulo)}</label>
            ${c.chave === "nome"
              ? `<input type="text" id="canvas-${c.chave}" placeholder="${escapar(c.placeholder)}" maxlength="40">`
              : `<textarea id="canvas-${c.chave}" placeholder="${escapar(c.placeholder)}"></textarea>`}
            <small class="retorno" hidden></small>
          </div>`).join("")}
        <div class="acoes campo-largo" data-acoes><button class="botao" type="submit">Avaliar minha ideia</button></div>
      </form>
      <div data-resultado></div>
    </div>`);
  conteudo.replaceChildren(painel);
  const form = painel.querySelector("form");
  const respostas = () => Object.fromEntries(
    etapa.campos.map((c) => [c.chave, form.querySelector(`#canvas-${c.chave}`).value.trim()]));

  await new Promise((concluir) => {
    let ultimo = null;
    form.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const r = await api(`/api/fases/${fase.id}/canvas`, { etapa: indice, respostas: respostas() });
      ultimo = r;
      zetsu.dizer(r.fala);
      r.campos.forEach((c) => {
        const retorno = form.querySelector(`[data-chave="${c.chave}"] .retorno`);
        retorno.hidden = false;
        retorno.textContent = c.retorno;
        retorno.className = `retorno ${c.ok ? "sucesso" : "dica"}`;
      });
      painel.querySelector("[data-resultado]").replaceChildren(criar(`
        <div class="resultado">
          <div class="nota-geral"><span class="numero">${r.nota}<small>/100</small></span><span class="estrelas">${estrelasHtml(r.estrelas)}</span></div>
          ${r.alertas.length ? `<div class="alerta-dados"><strong>⛔ Dado sensível</strong><ul>${r.alertas.map((a) => `<li>${escapar(a)}</li>`).join("")}</ul></div>` : ""}
        </div>`));

      form.querySelector("[data-continuar]")?.remove();
      if (r.aprovado) {
        const continuar = botaoContinuar("Seguir com essa ideia ▸");
        continuar.dataset.continuar = "";
        continuar.addEventListener("click", () => {
          estado.canvas = respostas();
          estado.estrelasEtapas.push(ultimo.estrelas);
          concluir();
        }, { once: true });
        form.querySelector("[data-acoes]").append(continuar);
      }
    });
  });
}

async function etapaPitch({ fase, etapa, indice, zetsu, conteudo, estado }) {
  const ideia = estado.canvas || {};
  zetsu.dizer("Escreve o pitch como se fosse falar. Depois ensaia em voz alta com o cronômetro: **1 minuto**, nem um segundo a mais!");

  const painel = criar(`
    <div class="painel">
      <h3>${escapar(etapa.titulo)}</h3>
      <div class="pitch">
        <aside class="resumo-ideia">
          <strong>💡 ${escapar(ideia.nome || "Tua ideia")}</strong>
          ${ideia.problema ? `<p><em>Problema:</em> ${escapar(ideia.problema)}</p>` : ""}
          ${ideia.solucao ? `<p><em>Solução:</em> ${escapar(ideia.solucao)}</p>` : ""}
          <p class="legenda">Estrutura: <strong>gancho</strong> → <strong>problema</strong> → <strong>solução</strong> com o nome → <strong>pedido</strong>.</p>
        </aside>
        <div>
          <textarea class="texto-pitch" placeholder="Imagina se..."></textarea>
          <div class="contador"><span data-contador>0 palavras · ~0s</span>
            <button class="botao botao-fantasma" type="button" data-cronometro>⏱️ Ensaiar em voz alta</button>
          </div>
        </div>
      </div>
      <div class="acoes" data-acoes><button class="botao" type="button" data-avaliar>Avaliar meu pitch</button></div>
      <div data-resultado></div>
    </div>`);
  conteudo.replaceChildren(painel);
  const area = painel.querySelector(".texto-pitch");
  const contador = painel.querySelector("[data-contador]");

  area.addEventListener("input", () => {
    const palavras = (area.value.match(/[\p{L}\p{N}]+/gu) || []).length;
    const segundos = Math.round((palavras / 150) * 60);
    contador.textContent = `${palavras} palavras · ~${segundos}s falando`;
    contador.classList.toggle("passou", segundos > 80);
  });

  const cronometro = painel.querySelector("[data-cronometro]");
  let timer = null;
  cronometro.addEventListener("click", () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
      cronometro.textContent = "⏱️ Ensaiar em voz alta";
      return;
    }
    let restante = 60;
    cronometro.textContent = `⏹️ ${restante}s`;
    zetsu.dizer("Valendo! Lê em voz alta, com calma. Eu marco o tempo.");
    timer = setInterval(() => {
      restante -= 1;
      cronometro.textContent = `⏹️ ${restante}s`;
      if (restante <= 0 || !document.body.contains(cronometro)) {
        clearInterval(timer);
        timer = null;
        cronometro.textContent = "⏱️ Ensaiar de novo";
        zetsu.dizer("**Tempo!** Se não deu para terminar, corta palavra. Pitch bom é pitch enxuto.");
      }
    }, 1000);
  });

  const avaliar = painel.querySelector("[data-avaliar]");
  await new Promise((concluir) => {
    avaliar.addEventListener("click", async () => {
      const r = await api(`/api/fases/${fase.id}/pitch`, { etapa: indice, texto: area.value, produto: ideia.nome || "" });
      zetsu.dizer(r.fala);
      const bloco = criar(`
        <div class="resultado">
          <div class="nota-geral"><span class="numero">${r.nota}<small>/100</small></span><span class="estrelas">${estrelasHtml(r.estrelas)}</span>
            <span class="legenda">${r.palavras} palavras · ~${r.segundos}s</span></div>
          ${listaChecks(r.criterios)}
          <div class="acoes" data-acoes-resultado></div>
          <div data-opiniao></div>
        </div>`);
      const acoes = bloco.querySelector("[data-acoes-resultado]");

      if (iaAtiva) {
        const botaoIa = criar('<button class="botao botao-ia" type="button">🤖 E aí, Zetsu, você investiria? (IA)</button>');
        botaoIa.addEventListener("click", async () => {
          botaoIa.disabled = true;
          const alvo = bloco.querySelector("[data-opiniao]");
          alvo.replaceChildren(criar('<p class="carregando">Zetsu está pensando como investidor...</p>'));
          try {
            const textoIdeia = Object.entries(ideia).map(([k, v]) => `${k}: ${v}`).join("\n");
            const { resposta } = await api("/api/zetsu/opiniao", { tipo: "pitch", ideia: textoIdeia, pitch: area.value });
            alvo.replaceChildren(criar(`<div class="opiniao-ia">${formatar(resposta)}</div>`));
          } catch (erro) {
            alvo.replaceChildren(criar(`<p class="carregando">${escapar(erro.message)}</p>`));
          }
        });
        acoes.append(botaoIa);
      }
      if (r.aprovado) {
        const continuar = botaoContinuar("Apresentar para o Zetsu ▸");
        continuar.addEventListener("click", () => {
          if (timer) clearInterval(timer);
          estado.estrelasEtapas.push(r.estrelas);
          concluir();
        }, { once: true });
        acoes.append(continuar);
      }
      avaliar.textContent = "Avaliar de novo";
      painel.querySelector("[data-resultado]").replaceChildren(bloco);
    });
  });
}

// ---------- mochila e mercado ----------

function vestir(cosmetico) {
  if (!daMinhaClasse(cosmetico)) return; // arma, chapéu ou roupa de outra classe não serve
  progresso.avatar = { ...progresso.avatar, ...cosmetico.avatar };
  salvarProgresso();
  atualizarStatus();
}

function estaVestindo(cosmetico) {
  return Object.entries(cosmetico.avatar).every(([chave, valor]) => (progresso.avatar || {})[chave] === valor);
}

// Carta de um visual, com o personagem do aluno já usando a peça.
// Os visuais que a classe do herói pode usar: os gerais e os da classe dele (armas, chapéus, roupas).
function daMinhaClasse(c) {
  return !c.kit || c.kit === escolhasCompletas(progresso.avatar).kit;
}

const RARIDADES_ITEM = { comum: "Comum", raro: "Raro", epico: "Épico", lendario: "Lendário" };

// ---------- o desenho de verdade de cada item (em vez do emoji) ----------
// Arma e chapéu: as mesmas funções que pintam o herói pintam só a peça numa tela vazia, com contorno, e o
// desenho é recortado. Roupa e aura: o herói vestindo. Mascote: o mascote. Consumível: o emoji em pixel.
const cacheDesenhoItem = new Map();

function recortarDesenho(canvas) {
  const { width: w, height: h } = canvas;
  const dados = canvas.getContext("2d").getImageData(0, 0, w, h).data;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!dados[(y * w + x) * 4 + 3]) continue;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  if (x1 < 0) return canvas;
  const { canvas: recorte, ctx } = criarTela(x1 - x0 + 1, y1 - y0 + 1);
  ctx.drawImage(canvas, x0, y0, recorte.width, recorte.height, 0, 0, recorte.width, recorte.height);
  return recorte;
}

function desenhoDoItem(item) {
  if (cacheDesenhoItem.has(item.id)) return cacheDesenhoItem.get(item.id);
  let desenho;
  const av = item.avatar || {};
  try {
    if (!item.avatar) {
      desenho = canvasDoItem(item.id) || emojiCanvas(item.icone, 24);
    } else if (av.item || av.chapeu) {
      const a = escolhasCompletas({ ...AVATAR_PADRAO, kit: item.kit || AVATAR_PADRAO.kit, ...av });
      const { canvas, ctx } = criarTela(56, 72);
      const d = pincelHeroi(ctx, paletaHeroi(a));
      if (av.item) itemHeroi(d, a, 26, 48);
      else {
        ctx.translate(12, 22);
        chapeuHeroi(d, a, "frente");
      }
      // o mesmo acabamento do herói: metal polido, gema acesa, veio do couro e o volume
      desenho = recortarDesenho(contornar(acabamentoDoHeroi(canvas, a), "auto"));
    } else if (av.familiar) {
      desenho = familiarCanvas({ ...AVATAR_PADRAO, ...av }) || emojiCanvas(item.icone, 24);
    } else {
      desenho = heroiParado({ ...progresso.avatar, ...av });
    }
  } catch {
    desenho = emojiCanvas(item.icone, 24);
  }
  cacheDesenhoItem.set(item.id, desenho);
  return desenho;
}

// a imagem pronta (para <img>), para a mochila e as cartas de quest
function imagemDoItem(item) {
  return desenhoDoItem(item).toDataURL();
}

const LUZ_RARIDADE = { comum: "185, 199, 220", raro: "79, 180, 255", epico: "176, 124, 255", lendario: "255, 201, 77" };

// uma folha de trabalho por tamanho, reaproveitada a cada quadro da vitrine
const folhasDaVitrine = new Map();
function folhaDaVitrine(w, h) {
  const chave = `${w}x${h}`;
  if (!folhasDaVitrine.has(chave)) folhasDaVitrine.set(chave, criarTela(w, h));
  return folhasDaVitrine.get(chave);
}

// Desenha um item numa tela de vitrine: brilho da raridade (raios girando nos lendários), a peça flutuando
// e as partículas do efeito dela (raios, brasas, neve, fumaça, runas). t em segundos.
function desenharItemNaVitrine(ctx, item, t, tamanho) {
  ctx.clearRect(0, 0, tamanho, tamanho);
  const luz = LUZ_RARIDADE[item.raridade] || LUZ_RARIDADE.comum;
  const meio = tamanho / 2;
  if (item.raridade === "lendario") {
    ctx.save();
    ctx.translate(meio, meio);
    ctx.rotate(t * 0.6);
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = `rgba(${luz}, 0.16)`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-3, -meio);
      ctx.lineTo(3, -meio);
      ctx.fill();
    }
    ctx.restore();
  }
  if (item.raridade && item.raridade !== "comum") {
    brilhoRedondo(ctx, Math.round(meio), Math.round(meio), Math.round(tamanho * 0.3), luz, item.raridade === "raro" ? 0.07 : 0.11 + Math.sin(t * 3) * 0.03);
  }
  const desenho = desenhoDoItem(item);
  // armas compridas (cajado, espada, machado, arco...) ficam na diagonal, como ícone de item de RPG, e
  // ganham mais tamanho; o resto fica em pé
  const alta = desenho.height > desenho.width * 1.8;
  const escala = alta
    ? Math.max(1, Math.floor((tamanho * 1.12) / desenho.height))
    : Math.max(1, Math.floor(Math.min((tamanho * 0.8) / desenho.width, (tamanho * 0.8) / desenho.height)));
  const w = desenho.width * escala;
  const h = desenho.height * escala;
  const flutua = Math.round(Math.sin(t * 2) * 1.5);
  // a peça ampliada numa folha, e de vez em quando uma faixa de luz atravessa ela (só por cima dos pixels)
  const folha = folhaDaVitrine(w, h);
  folha.ctx.clearRect(0, 0, w, h);
  folha.ctx.imageSmoothingEnabled = false;
  folha.ctx.globalCompositeOperation = "source-over";
  folha.ctx.drawImage(desenho, 0, 0, w, h);
  const ciclo = (t % 3.2) / 3.2;
  if (ciclo < 0.35) {
    const x = -h + (ciclo / 0.35) * (w + h * 2);
    folha.ctx.globalCompositeOperation = "source-atop";
    folha.ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    folha.ctx.beginPath();
    folha.ctx.moveTo(x, h);
    folha.ctx.lineTo(x + h * 0.6, 0);
    folha.ctx.lineTo(x + h * 0.6 + 4 * escala, 0);
    folha.ctx.lineTo(x + 4 * escala, h);
    folha.ctx.fill();
    folha.ctx.globalCompositeOperation = "source-over";
  }
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.translate(Math.round(meio), Math.round(meio) + flutua);
  if (alta) ctx.rotate(Math.PI / 4);
  ctx.drawImage(folha.canvas, -Math.round(w / 2), -Math.round(h / 2));
  ctx.restore();
  // as partículas do efeito, espalhadas em volta da peça
  const efeito = item.visual?.efeito || EFEITOS_ITEM[item.avatar?.item] || EFEITOS_CHAPEU[item.avatar?.chapeu];
  if (efeito) {
    const quantas = item.raridade === "lendario" ? 9 : item.raridade === "raro" ? 3 : 5;
    for (let i = 0; i < quantas; i++) {
      const p = (t * (efeito.tipo === "runa" ? 0.35 : 0.6) + i / quantas) % 1;
      if (efeito.tipo === "runa") {
        const ang = t * 2 + (i / quantas) * Math.PI * 2;
        particulaDeEfeito(ctx, efeito.tipo, efeito.cor, meio + Math.cos(ang) * w * 0.55, meio + Math.sin(ang) * h * 0.45, p, t, i);
      } else {
        particulaDeEfeito(ctx, efeito.tipo, efeito.cor, meio - w / 2 + ((i * 37) % Math.max(4, w)), meio + h / 2 - ((i * 23) % Math.max(4, h)), p, t, i);
      }
    }
  }
}

function cartaCosmetico(c, { loja = false } = {}) {
  const tem = possuiCosmetico(c.id);
  let rodape;
  if (tem) {
    rodape = estaVestindo(c)
      ? '<span class="tag tag-concluida">Vestindo ✓</span>'
      : `<button class="botao botao-fantasma" type="button" data-vestir="${c.id}">Vestir</button>`;
  } else if (c.preco && loja) {
    rodape = `<button class="botao" type="button" data-comprar="${c.id}" ${progresso.moedas < c.preco ? "disabled" : ""}>🪙 ${c.preco}</button>`;
  } else {
    rodape = `<small class="origem">🔒 ${escapar(c.origem || `Mercado: 🪙 ${c.preco}`)}</small>`;
  }
  return `
    <div class="carta-item cosmetico raridade-${c.raridade || "comum"} ${tem ? "" : "vazio"}">
      ${c.raridade ? `<span class="selo-raridade">${RARIDADES_ITEM[c.raridade]}</span>` : ""}
      <div class="previa">${avatarSvg({ ...progresso.avatar, ...c.avatar }, c.nome)}</div>
      <strong>${c.icone} ${escapar(c.nome)}</strong>
      <small>${escapar(c.descricao)}</small>
      ${rodape}
    </div>`;
}

// A mochila é um inventário que desliza pela lateral, por cima do jogo (sem sair do mapa).
let abaMochila = "itens";

function slotsDaMochila() {
  return {
    itens: [
      ...CATALOGO.consumiveis.map((i) => ({
        id: i.id, tipo: "item", icone: iconeDoItem(i.id, i.icone), nome: i.nome, descricao: i.descricao, qtd: quantidade(i.id), tem: quantidade(i.id) > 0,
      })),
      // os materiais da Forja que o herói já tem (os mais raros no fim)
      ...(CATALOGO.materiais || []).filter((m) => quantosMateriais(m.id) > 0)
        .sort((a, b) => ORDEM_TIER_MATERIAL[a.tier] - ORDEM_TIER_MATERIAL[b.tier])
        .map((m) => ({
          id: m.id, tipo: "material", icone: iconeDoItem(m.id, m.icone), nome: m.nome, qtd: quantosMateriais(m.id), tem: true, raridade: m.raridade,
          descricao: `${m.descricao} Material da Forja: ${ondeCaiOMaterial(m)}.`,
        })),
    ],
    visuais: CATALOGO.cosmeticos.filter((c) => daMinhaClasse(c) && !forjaEscondida(c)).map((c) => {
      const tem = possuiCosmetico(c.id);
      return {
        id: c.id, tipo: "visual", icone: c.icone, nome: c.nome, tem, vestindo: tem && estaVestindo(c), avatar: c.avatar,
        descricao: tem ? c.descricao : `🔒 ${c.origem || `Mercado: 🪙 ${c.preco}`}`,
      };
    }),
    trofeus: CATALOGO.trofeus.map((t) => {
      const tem = progresso.trofeus.includes(t.id);
      return { id: t.id, tipo: "trofeu", icone: tem ? t.icone : "❔", nome: tem ? t.nome : "???", tem, descricao: tem ? t.descricao : `Conquiste em: ${t.origem}` };
    }),
  };
}

function fecharMochila() {
  const painel = document.querySelector(".inventario");
  if (!painel) return;
  painel.classList.remove("aberto");
  setTimeout(() => painel.remove(), 250);
}

// ---------- a Tela do Herói: ficha à esquerda, o boneco com o equipamento no meio e a bolsa à direita ----------

// os espaços de equipamento em volta do boneco: cada um é uma parte do visual (avatar)
const ESPACOS_EQUIPAMENTO = [
  { chave: "chapeu", nome: "Chapéu", icone: "🎩", lado: "esq" },
  { chave: "manto", nome: "Manto", icone: "👘", lado: "esq" },
  { chave: "aura", nome: "Aura", icone: "✨", lado: "esq" },
  { chave: "item", nome: "Arma", icone: "⚔️", lado: "dir" },
  { chave: "familiar", nome: "Mascote", icone: "🐾", lado: "dir" },
];
// na aba Visuais, qual espaço está filtrado ("todos" ou uma chave de ESPACOS_EQUIPAMENTO)
let filtroVisual = "todos";
// os mesmos tetos do servidor (equipamento.py)
const TETOS_BONUS = { xp: 0.5, moedas: 0.5, mana: 3, vida: 3, tempo: 6, sorte: 0.15 };

// A peça vestida num espaço: o visual do catálogo que o herói tem e está usando ou, sem ele, a peça que
// veio do criador (sem bônus). null quando o espaço está vazio.
function pecaVestida(chave) {
  const doCatalogo = CATALOGO.cosmeticos.find((c) => c.avatar && chave in c.avatar && possuiCosmetico(c.id) && estaVestindo(c));
  if (doCatalogo) return doCatalogo;
  const a = escolhasCompletas(progresso.avatar);
  const valor = a[chave];
  if (!valor || valor === "nenhum" || (chave === "aura" && valor === "simples")) return null;
  return { id: `base-${chave}-${valor}`, nome: "Peça do criador", icone: "◆", avatar: { [chave]: valor }, kit: a.kit, raridade: "comum", descricao: "A que escolheste ao criar o herói. Não dá bônus." };
}

// os bônus somados do que está vestido e do mascote (a conta que vale é a do servidor; esta é para mostrar)
function bonusDoEquipamento() {
  const total = Object.fromEntries(Object.keys(TETOS_BONUS).map((k) => [k, 0]));
  const fontes = CATALOGO.cosmeticos.filter((c) => c.avatar && possuiCosmetico(c.id) && estaVestindo(c)).map((c) => c.bonus || {});
  fontes.push((JORNADA.mascotes || {})[progresso.avatar?.familiar]?.bonus || {});
  fontes.forEach((f) => Object.entries(f).forEach(([k, v]) => { if (k in total) total[k] += v; }));
  return Object.fromEntries(Object.entries(total).map(([k, v]) => [k, Math.round(Math.min(v, TETOS_BONUS[k]) * 100) / 100]));
}

function fichaDoHeroi() {
  const nivel = nivelDe(progresso.xp || 0);
  const noNivel = (progresso.xp || 0) - xpParaChegar(nivel);
  const doNivel = xpParaChegar(nivel + 1) - xpParaChegar(nivel);
  const mana = manaAgora();
  const b = bonusDoEquipamento();
  const { grimorio } = temaDaClasse();
  const barra = (classe, rotulo, atual, maximo) => `
    <div class="barra-ficha ${classe}">
      <span>${rotulo}</span>
      <div class="trilho-ficha"><i style="width:${maximo ? Math.min(100, (atual / maximo) * 100) : 0}%"></i></div>
      <b>${atual}/${maximo}</b>
    </div>`;
  const pct = (v) => `+${Math.round(v * 100)}%`;
  const atributos = [
    ["❤️", "Vida máxima", vidaMaxima(), b.vida],
    [grimorio.recurso_icone, `${grimorio.recurso} máxima`, mana.maxima, b.mana],
    ["⭐", "XP nas vitórias", pct(b.xp)],
    ["🪙", "Ouro nas vitórias", pct(b.moedas)],
    ["🍀", "Sorte de achado", pct(b.sorte)],
    ["⏳", "Tempo para responder", `+${b.tempo}s`],
  ];
  return `
    <section class="ficha-heroi">
      <div class="cabeca-ficha">
        <img class="pixel busto-ficha" src="${retratoBustoUrl(progresso.avatar)}" alt="">
        <div>
          <strong>${escapar(nomeAluno())}</strong>
          ${seloDoTitulo()}
          <small>Nível ${nivel} · ${escapar(eraDe(nivel))}</small>
        </div>
      </div>
      ${barra("xp", "XP", noNivel, doNivel)}
      ${barra("vida", "Vida", vidaAtual(), vidaMaxima())}
      ${barra("mana", escapar(grimorio.recurso), mana.atual, mana.maxima)}
      <h4 class="titulo-ficha">Atributos</h4>
      <ul class="atributos-ficha">${atributos.map(([icone, nome, valor, extra]) => `
        <li><span>${icone}</span>${escapar(nome)}<b>${valor}${extra ? ` <em title="do equipamento">(+${extra})</em>` : ""}</b></li>`).join("")}
      </ul>
      <div class="ouro-ficha">🪙 <b>${progresso.moedas ?? 0}</b> <small>moedas</small></div>
    </section>`;
}

function bonecoDoHeroi() {
  const espaco = (e) => {
    const peca = pecaVestida(e.chave);
    const marcado = abaMochila === "visuais" && filtroVisual === e.chave;
    return `
      <button type="button" class="espaco-equip ${peca ? `raridade-${peca.raridade || "comum"}` : "vazio"} ${marcado ? "marcado" : ""}" data-espaco="${e.chave}" data-peca="${peca && !peca.id.startsWith("base-") ? peca.id : ""}" title="${e.nome}${peca ? `: ${escapar(peca.nome)}` : " (vazio)"}">
        ${peca ? `<img class="pixel" src="${imagemDoItem(peca)}" alt="">` : `<span class="silhueta">${e.icone}</span>`}
        <small>${e.nome}</small>
      </button>`;
  };
  const mascote = familiarCanvas(progresso.avatar);
  return `
    <section class="boneco-heroi" style="--cor-classe:${identidadeDaClasse().cor}">
      <div class="coluna-equip">${ESPACOS_EQUIPAMENTO.filter((e) => e.lado === "esq").map(espaco).join("")}</div>
      <div class="palco-boneco">
        <img class="pixel heroi-boneco" src="${heroiParado(progresso.avatar).toDataURL()}" alt="${escapar(nomeAluno())}">
        ${mascote ? `<img class="pixel mascote-boneco" src="${mascote.toDataURL()}" alt="">` : ""}
      </div>
      <div class="coluna-equip">${ESPACOS_EQUIPAMENTO.filter((e) => e.lado === "dir").map(espaco).join("")}</div>
    </section>`;
}

function abrirMochila(selecionado = null) {
  let painel = document.querySelector(".inventario");
  const novo = !painel;
  if (novo) {
    painel = document.createElement("aside");
    painel.className = "inventario tela-heroi";
    painel.setAttribute("aria-label", "Herói e mochila");
    // clicar fora da janela fecha
    painel.addEventListener("click", (e) => { if (e.target === painel) fecharMochila(); });
    document.body.append(painel);
  }
  // a bolsa (coluna da direita) é montada abaixo; aqui o topo e as abas
  const montar = (conteudoBolsa) => `
    <div class="janela-heroi">
      <div class="inventario-topo">
        <h2>${imgIconeRpg("mochila", "titulo-icone")} Herói</h2>
        <small class="atalho-heroi"><kbd>I</kbd> abre e fecha · <kbd>Esc</kbd> sai</small>
        <button class="fechar" type="button" data-fechar aria-label="Fechar">×</button>
      </div>
      <div class="corpo-heroi">
        ${fichaDoHeroi()}
        ${bonecoDoHeroi()}
        <section class="bolsa-heroi">${cabecalho}${conteudoBolsa}</section>
      </div>
    </div>`;
  const cabecalho = `
    <div class="abas-inventario">
      ${[["itens", "🧪 Itens"], ["visuais", "✨ Visuais"], ["trofeus", "🏆 Troféus"], ["missoes", "📜 Missões"], ["dominio", "🎓 Domínio"], ["grimorio", `${temaDaClasse().grimorio.icone} ${temaDaClasse().grimorio.nome.split(" ")[0]}`]].map(([id, rotulo]) =>
        `<button type="button" data-aba="${id}" class="${id === abaMochila ? "ativa" : ""}">${rotulo}${id === "missoes" && missoesAtivas().some((m) => m.pronta) ? ' <i class="ponto-alerta"></i>' : ""}</button>`).join("")}
    </div>`;
  const ligarAbas = () => {
    painel.querySelector("[data-fechar]").addEventListener("click", fecharMochila);
    painel.querySelectorAll("[data-aba]").forEach((b) => b.addEventListener("click", () => {
      abaMochila = b.dataset.aba;
      if (abaMochila !== "visuais") filtroVisual = "todos";
      abrirMochila();
    }));
    // um espaço do boneco abre a aba Visuais só com as peças daquele espaço
    painel.querySelectorAll("[data-espaco]").forEach((b) => b.addEventListener("click", () => {
      abaMochila = "visuais";
      filtroVisual = b.dataset.espaco;
      abrirMochila(b.dataset.peca || null);
    }));
    painel.querySelectorAll("[data-filtro]").forEach((b) => b.addEventListener("click", () => {
      filtroVisual = b.dataset.filtro;
      abrirMochila();
    }));
    if (novo) setTimeout(() => painel.classList.add("aberto"), 10);
  };
  const paineis = { missoes: painelMissoes, dominio: painelDominio, grimorio: painelGrimorio };
  if (paineis[abaMochila]) {
    painel.innerHTML = montar(paineis[abaMochila]());
    ligarAbas();
    // clicar numa quest (ou missão do quadro) fecha a mochila e o herói vai até o objetivo
    painel.querySelectorAll("[data-ir-quest]").forEach((el) => el.addEventListener("click", (e) => {
      if (e.target.closest("[data-resgatar], [data-trocar]")) return;
      fecharMochila();
      irAteQuest(el.dataset.irQuest);
    }));
    // rever uma cena da história já vista (o prólogo ou a de um capítulo)
    painel.querySelectorAll("[data-rever-cena]").forEach((el) => el.addEventListener("click", () => {
      fecharMochila();
      const id = el.dataset.reverCena;
      if (id === "prologo") return telaPrologo(() => {}, progresso.avatar || {});
      const cena = CENAS_HISTORIA[id];
      telaPrologo(() => {}, progresso.avatar || {}, cena.cenas.map((c, i) => ({ ...c, titulo: i === 0 })),
        { tituloFinal: cena.titulo.toUpperCase(), botaoFinal: "Fechar ▸", pular: "Fechar ▸▸" });
      marcarComoCena();
    }));
    painel.querySelectorAll("[data-ir-missao]").forEach((el) => el.addEventListener("click", () => {
      const m = missoesAtivas().find((x) => x.id === el.dataset.irMissao);
      if (!m) return;
      fecharMochila();
      irAteDestino(destinoDoObjetivo(m.evento, m.filtro || {}));
    }));
    painel.querySelectorAll("[data-resgatar]").forEach((b) => b.addEventListener("click", async (evento) => {
      const nivelAntes = nivelDe(progresso.xp);
      b.disabled = true;
      try {
        const r = await acaoJogador(`missoes/${b.dataset.resgatar}/resgatar`);
        chuvaDeEstrelas(25);
        xpFlutuante(r.ganhos.map((g) => `${g.icone} ${g.texto}`).join("  "), evento.clientX, evento.clientY);
        verificarSubidaDeNivel(nivelAntes);
      } catch (erro) {
        avisoFlutuante("⚠️", "Não deu", erro.message);
      }
      abrirMochila();
    }));
    painel.querySelectorAll("[data-trocar]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      try {
        await acaoJogador(`missoes/${b.dataset.trocar}/trocar`);
      } catch (erro) {
        avisoFlutuante("⚠️", "Não deu", erro.message);
      }
      abrirMochila();
    }));
    return;
  }
  let lista = slotsDaMochila()[abaMochila];
  if (abaMochila === "visuais" && filtroVisual !== "todos") lista = lista.filter((s) => s.avatar && filtroVisual in s.avatar);
  const filtros = abaMochila === "visuais" ? `
    <div class="filtros-equip">
      ${[{ chave: "todos", nome: "Todos", icone: "◆" }, ...ESPACOS_EQUIPAMENTO].map((e) => `
        <button type="button" data-filtro="${e.chave}" class="${filtroVisual === e.chave ? "ativo" : ""}" title="${e.nome}">${e.icone} <span>${e.nome}</span></button>`).join("")}
    </div>` : "";
  // a grade sempre cheia de espaços (os que sobram ficam vazios, como numa bolsa de RPG)
  const espacosVazios = Math.max(15, Math.ceil(lista.length / 5) * 5) - lista.length;
  const atual = lista.find((s) => s.id === selecionado) || lista.find((s) => s.tem) || lista[0];
  if (!atual) {
    painel.innerHTML = montar(`${filtros}
      <div class="slots">${'<span class="slot fantasma"></span>'.repeat(15)}</div>
      <div class="detalhe-slot"><div><strong>Nada aqui ainda</strong><p>Nenhuma peça deste espaço para a tua classe.</p></div></div>`);
    ligarAbas();
    return;
  }
  let acao = "";
  const curaVida = atual.tipo === "item" && itemDoCatalogo(atual.id)?.cura;
  const daMana = atual.tipo === "item" && itemDoCatalogo(atual.id)?.mana;
  const mana = manaAgora();
  if (curaVida && atual.qtd && vidaAtual() < vidaMaxima()) acao = '<button class="botao" type="button" data-acao="curar">Usar ❤️</button>';
  else if (curaVida && atual.qtd) acao = "<small>Tua vida já está cheia.</small>";
  else if (daMana && atual.qtd && mana.atual < mana.maxima) acao = '<button class="botao" type="button" data-acao="curar">Beber 💧</button>';
  else if (daMana && atual.qtd) acao = "<small>Tua mana já está cheia.</small>";
  else if (atual.tipo === "item" && atual.qtd) acao = "<small>Usa durante as lições e as dungeons.</small>";
  else if (atual.tipo === "material") acao = "<small>⚒️ Leva à Casa da Forja, em Elyndor (do lado do Mercado).</small>";
  else if (atual.tipo === "visual" && atual.vestindo) acao = '<span class="tag tag-concluida">Vestindo ✓</span>';
  else if (atual.tipo === "visual" && atual.tem) acao = '<button class="botao" type="button" data-acao="vestir">Vestir ✨</button>';
  // num visual, a prévia mostra o herói já vestindo a peça
  const imagemDetalhe = atual.tipo === "visual"
    ? `<img class="pixel previa-slot" src="${heroiParado({ ...progresso.avatar, ...atual.avatar }).toDataURL()}" alt="">`
    : `<span class="icone">${atual.icone}</span>`;

  const raridadeAtual = atual.tipo === "visual" ? itemDoCatalogo(atual.id)?.raridade : null;
  const dicaArrasto = abaMochila === "visuais" ? "✋ Clica numa peça (ou arrasta até o boneco) para vestir na hora"
    : abaMochila === "itens" ? "✋ Arrasta um elixir até o herói para usar" : "";
  painel.innerHTML = montar(`${filtros}${dicaArrasto ? `<small class="dica-arrasto">${dicaArrasto}</small>` : ""}
    <div class="slots">
      ${lista.map((s) => `
        <button type="button" class="slot ${s.tem ? "" : "vazio"} ${s.id === atual.id ? "selecionado" : ""} ${s.vestindo ? "vestindo" : ""} ${s.tipo === "visual" ? `raridade-${itemDoCatalogo(s.id)?.raridade || "comum"}` : s.tipo === "material" ? `material raridade-${s.raridade}` : ""}" data-slot="${s.id}" title="${escapar(s.nome)}">
          ${s.tipo === "visual" && itemDoCatalogo(s.id) ? `<img class="pixel desenho-slot" src="${imagemDoItem(itemDoCatalogo(s.id))}" alt="">` : `<span>${s.icone}</span>`}${s.qtd ? `<small>${s.qtd}</small>` : ""}
        </button>`).join("")}
      ${'<span class="slot fantasma"></span>'.repeat(espacosVazios)}
    </div>
    <div class="detalhe-slot ${raridadeAtual ? `raridade-${raridadeAtual}` : ""}">
      ${imagemDetalhe}
      <div>
        ${raridadeAtual ? `<span class="selo-raridade-detalhe">${RARIDADES_ITEM[raridadeAtual]}</span>` : ""}
        <strong>${escapar(atual.nome)}</strong><p>${escapar(atual.descricao)}</p>
        ${atual.tipo === "visual" && itemDoCatalogo(atual.id)?.bonus && Object.keys(itemDoCatalogo(atual.id).bonus).length
          ? `<p class="bonus-item raridade-${itemDoCatalogo(atual.id).raridade}">✦ ${escapar(textoBonus(itemDoCatalogo(atual.id).bonus))}</p>` : ""}
        ${acao}</div>
    </div>
    <div class="acoes"><button class="botao botao-fantasma" type="button" data-mercado>🏪 Ir ao Mercado</button></div>`);

  ligarAbas();
  painel.querySelector("[data-mercado]").addEventListener("click", () => {
    fecharMochila();
    telaMercado();
  });
  painel.querySelectorAll("[data-slot]").forEach((b) => b.addEventListener("click", (evento) => {
    if (b.dataset.arrastou) return; // o clique que encerra um arrasto não seleciona
    // nos Visuais, clicar numa peça que o herói tem já veste (troca na hora); as outras só mostram o detalhe
    const peca = abaMochila === "visuais" ? lista.find((s) => s.id === b.dataset.slot) : null;
    if (peca?.tipo === "visual" && peca.tem && !peca.vestindo) return vestirDaMochila(peca.id, evento.clientX, evento.clientY);
    abrirMochila(b.dataset.slot);
  }));
  painel.querySelector('[data-acao="curar"]')?.addEventListener("click", (evento) => usarDaMochila(atual.id, evento.clientX, evento.clientY));
  painel.querySelector('[data-acao="vestir"]')?.addEventListener("click", (evento) => vestirDaMochila(atual.id, evento.clientX, evento.clientY));
  ligarArrastoDaMochila(painel, lista);
}

function vestirDaMochila(id, x, y) {
  vestir(itemDoCatalogo(id));
  Som.efeito("magia");
  faiscas(x, y, "#a98bff");
  abrirMochila(id);
  // o boneco comemora a roupa nova
  const boneco = document.querySelector(".tela-heroi .heroi-boneco");
  if (boneco) animar(boneco, "vestiu");
  atualizarBonusDoServidor();
  // no mapa, o herói troca de roupa na hora; no Salão do multijogador, ele entra de novo no mesmo lugar (assim
  // o servidor manda o visual novo para os outros jogadores: o telaMapa cuida disso)
  if (document.body.classList.contains("modo-mundo")) telaMapa();
}

async function usarDaMochila(id, x, y) {
  if (!(await gastarItem(id))) return;
  faiscas(x, y, "#ff6b7a");
  abrirMochila(id);
  const boneco = document.querySelector(".tela-heroi .heroi-boneco");
  if (boneco) animar(boneco, "curou");
}

// Arrastar da bolsa para o boneco: uma peça (visual) vai para o espaço dela e é vestida; uma poção que cura
// ou dá mana vai para o herói e é usada. Com eventos de ponteiro (mouse e dedo). Enquanto arrasta, uma cópia
// da peça segue o cursor e os destinos certos brilham; soltar fora não faz nada.
function ligarArrastoDaMochila(painel, lista) {
  painel.querySelectorAll(".slot[data-slot]:not(.vazio)").forEach((slot) => {
    const s = lista.find((x) => x.id === slot.dataset.slot);
    const dados = itemDoCatalogo(s?.id);
    const usavel = s?.tipo === "item" && s.qtd > 0 && (dados?.cura || dados?.mana);
    const vestivel = s?.tipo === "visual" && s.tem && !s.vestindo;
    if (!usavel && !vestivel) return;
    slot.classList.add("arrastavel");
    slot.style.touchAction = "none";
    slot.addEventListener("pointerdown", (inicio) => {
      if (inicio.button !== 0) return;
      let fantasma = null;
      let alvo = null;
      const destinos = vestivel
        ? [...painel.querySelectorAll(".espaco-equip")].filter((e) => e.dataset.espaco in (s.avatar || {}))
        : [painel.querySelector(".palco-boneco")].filter(Boolean);
      const mover = (e) => {
        if (!fantasma) {
          if (Math.hypot(e.clientX - inicio.clientX, e.clientY - inicio.clientY) < 6) return;
          fantasma = slot.cloneNode(true);
          fantasma.className = "fantasma-arrasto";
          fantasma.removeAttribute("data-slot");
          document.body.append(fantasma);
          destinos.forEach((d) => d.classList.add("alvo-arrasto"));
          painel.classList.add("arrastando");
          Som.efeito("clique");
        }
        fantasma.style.transform = `translate(${e.clientX - 28}px, ${e.clientY - 28}px)`;
        const embaixo = document.elementFromPoint(e.clientX, e.clientY);
        const novo = destinos.find((d) => d.contains(embaixo)) || null;
        if (novo !== alvo) {
          alvo?.classList.remove("alvo-em-cima");
          novo?.classList.add("alvo-em-cima");
          alvo = novo;
        }
      };
      const soltar = (e) => {
        window.removeEventListener("pointermove", mover);
        window.removeEventListener("pointerup", soltar);
        window.removeEventListener("pointercancel", soltar);
        if (!fantasma) return;
        fantasma.remove();
        destinos.forEach((d) => d.classList.remove("alvo-arrasto", "alvo-em-cima"));
        painel.classList.remove("arrastando");
        slot.dataset.arrastou = "1";
        setTimeout(() => delete slot.dataset.arrastou, 0);
        if (e.type !== "pointerup" || !alvo) return;
        if (vestivel) vestirDaMochila(s.id, e.clientX, e.clientY);
        else usarDaMochila(s.id, e.clientX, e.clientY);
      };
      window.addEventListener("pointermove", mover);
      window.addEventListener("pointerup", soltar);
      window.addEventListener("pointercancel", soltar);
    });
  });
}

// O diário de missões: três tarefas sorteadas, que se renovam quando são resgatadas.
function painelMissoes() {
  const missoes = missoesAtivas();
  const preco = JORNADA.missoes.preco_troca;
  return `${painelQuestsHtml()}
    <div class="lista-missoes">
      <h4 class="titulo-tema">${escapar(temaDaClasse().missoes.nome)}</h4>
      ${missoes.length ? missoes.map((m) => `
        <div class="cartao-missao ${m.pronta ? "pronta" : ""}">
          <strong>${m.pronta ? "✅" : "📜"} ${escapar(m.titulo)}</strong>
          ${m.pronta ? "" : `<button type="button" class="link-morador ir-missao" data-ir-missao="${m.id}">📍 Ir até lá</button>`}
          <p>${escapar(m.texto)}</p>
          <div class="barra-missao"><div style="width:${Math.min(100, (m.feito / m.alvo) * 100)}%"></div><span>${Math.min(m.feito, m.alvo)} / ${m.alvo}</span></div>
          <div class="rodape-missao">
            <small>${recompensaTexto(m.recompensa)}</small>
            ${m.pronta
              ? `<button class="botao" type="button" data-resgatar="${m.id}">Resgatar 🎁</button>`
              : `<button class="botao botao-fantasma" type="button" data-trocar="${m.id}" ${progresso.moedas < preco ? "disabled" : ""} title="Trocar por outra missão">🔄 ${preco} 🪙</button>`}
          </div>
        </div>`).join("") : '<p class="legenda">Nenhuma missão disponível agora. Sobe de nível para liberar novas regiões!</p>'}
      <small class="legenda">Missões cumpridas: ${(progresso.missoes || {}).cumpridas || 0}. Resgatar uma sorteia outra no lugar.</small>
    </div>`;
}

// O domínio em cada trilha de conhecimento, com a patente e quanto falta para a próxima.
function painelDominio() {
  const { ranks } = JORNADA.trilhas;
  const golpe = ranks[JORNADA.trilhas.golpe_a_partir_de]?.nome;
  return `
    <div class="lista-dominio">
      <h4 class="titulo-tema">${escapar(temaDaClasse().dominio.nome)}</h4>
      ${Object.keys(JORNADA.trilhas.trilhas).map(trilhaInfo).map((t) => {
        const proxima = ranks[t.posicao + 1];
        const base = ranks[t.posicao].pontos;
        const fracao = proxima ? (t.pontos - base) / (proxima.pontos - base) : 1;
        return `
          <div class="cartao-dominio" style="--cor-trilha:${t.cor}">
            <span class="icone-trilha">${t.icone}</span>
            <div>
              <strong>${escapar(t.nome)} <em>${escapar(t.patente)}</em>${t.golpe ? ' <i title="Golpe certeiro: cada acerto tira 2 de vida">⚔️</i>' : ""}</strong>
              <small>${t.nome !== t.assunto ? `<b>${escapar(t.assunto)}:</b> ` : ""}${escapar(t.descricao)}</small>
              <div class="barra-missao"><div style="width:${Math.round(fracao * 100)}%"></div><span>${proxima ? `${t.pontos} / ${proxima.pontos} → ${escapar(proxima.nome)}` : `${t.pontos} · patente máxima`}</span></div>
            </div>
          </div>`;
      }).join("")}
      <small class="legenda">Acertos no Reino, lições, dungeons e livros dão domínio na trilha do assunto. A partir de <strong>${escapar(golpe)}</strong>, cada acerto daquela trilha vira um golpe certeiro ⚔️ (tira 2 de vida do monstro).</small>
    </div>`;
}

// O grimório (ou o arsenal, ou a aljava): as técnicas de batalha, liberadas conforme o nível, e quanto
// recurso (mana, fúria ou foco) o herói tem.
function painelGrimorio() {
  const { mana, magias } = JORNADA.magias;
  const { grimorio } = temaDaClasse();
  const nivel = nivelDe(progresso.xp);
  const manaMaxima = Math.min(mana.base + Math.floor(nivel / mana.por_niveis), mana.maxima);
  const r = grimorio.recurso_icone;
  return `
    <div class="lista-dominio">
      <h4 class="titulo-tema">${grimorio.icone} ${escapar(grimorio.nome)}</h4>
      <small class="legenda">Tua ${grimorio.recurso.toLowerCase()}: <strong>${manaMaxima} ${r}</strong>. Ela enche no começo de cada batalha e cada acerto devolve ${mana.por_acerto}. Usa as técnicas pela barra de baixo enquanto a pergunta está na tela.</small>
      ${magias.map((m) => `
        <div class="cartao-magia ${nivel >= m.nivel ? "" : "trancada"}">
          <span>${nivel >= m.nivel ? m.icone : "🔒"}</span>
          <div>
            <strong>${escapar(m.nome)} <em>${m.custo} ${r}</em></strong>
            ${m.frase ? `<i>“${escapar(m.frase)}”</i>` : ""}
            <small>${escapar(m.descricao)}</small>
            ${nivel >= m.nivel ? "" : `<small>Aprende no nível ${m.nivel}.</small>`}
          </div>
        </div>`).join("")}
      <small class="legenda">Nas fases de silêncio dos chefões, toda técnica custa 1 ${r} a mais.</small>
    </div>`;
}

function alternarMochila(aba = null) {
  if (!progresso.nome) return;
  const aberta = document.querySelector(".inventario.aberto");
  if (aberta && (!aba || aba === abaMochila)) return fecharMochila();
  if (aba) abaMochila = aba;
  abrirMochila();
}

const MERCADORA = {
  nome: "Brina, a Mercadora",
  avatar: {
    corpo: "feminino", pele: "#c98d63", cabelo: "coque", corCabelo: "#b5532a", rosto: "confiante", chapeu: "boina", manto: "#c46a1b",
    detalhe: "#f5c451", item: "grimorio", magia: "#7dff9a", acessorio: "brinco", familiar: "gato",
  },
  compras: [
    "Ótima escolha! Isso já salvou muito aventureiro.",
    "Negócio fechado! Volta sempre, viu?",
    "Ah, esse aí é dos bons. Usa com sabedoria!",
    "Hehe, minha melhor venda do dia!",
  ],
};

// O catálogo completo da Brina, como uma loja de RPG: o balcão com a mercadora e o item escolhido (o herói
// já vestindo a peça, o bônus e o botão), e a vitrine com abas, filtro de raridade e cartas com moldura
// na cor da raridade. Os exclusivos (quests e drops) aparecem com o caminho para conseguir.
let abaMercado = "consumiveis";
let raridadeMercado = "todas";
let escolhidoMercado = null;
const ABAS_MERCADO = [["consumiveis", "🧪 Consumíveis"], ["classe", "⚔️ Da tua classe"], ["todos", "✨ Para todos"], ["exclusivos", "💎 Exclusivos"]];
const ORDEM_RARIDADE = { comum: 0, raro: 1, epico: 2, lendario: 3 };

function itensDaAbaMercado(aba) {
  const meus = CATALOGO.cosmeticos.filter(daMinhaClasse);
  const lista = {
    consumiveis: CATALOGO.consumiveis.map((i) => ({ ...i, consumivel: true })),
    classe: meus.filter((c) => c.preco && c.kit && !c.exclusivo),
    todos: meus.filter((c) => c.preco && !c.kit && !c.exclusivo),
    // (as peças da Casa da Forja ficam na Forja, não aqui)
    exclusivos: meus.filter((c) => (c.exclusivo || (!c.preco && c.origem)) && !c.forja),
  }[aba] || [];
  return lista.sort((a, b) => (ORDEM_RARIDADE[a.raridade] ?? -1) - (ORDEM_RARIDADE[b.raridade] ?? -1) || (a.preco || 0) - (b.preco || 0));
}

function telaMercado() {
  Som.musica("mercado");
  window.scrollTo(0, 0);
  const secao = criar(`
    <section class="loja-rpg">
      <header class="topo-loja">
        <div class="placa-loja"><small>✦ Mercado de Elyndor ✦</small><h2>A Banca da Brina</h2></div>
        <div class="ouro-loja" data-ouro></div>
        <div class="acoes-loja">
          <button class="botao botao-fantasma" type="button" data-mochila>${imgIconeRpg("mochila")} Mochila</button>
          <button class="botao" type="button" data-mapa>◂ Voltar</button>
        </div>
      </header>
      <div class="corpo-loja">
        <aside class="balcao-loja">
          <div class="mercadora-loja">
            <div class="retrato-brina">${avatarSvg(MERCADORA.avatar, MERCADORA.nome)}</div>
            <div class="fala-brina"><b>${escapar(MERCADORA.nome)}</b><p data-fala></p></div>
          </div>
          <div class="detalhe-loja" data-detalhe></div>
        </aside>
        <div class="vitrine-loja">
          <nav class="abas-loja" data-abas></nav>
          <div class="filtros-loja" data-filtros></div>
          <div class="grade-loja" data-grade></div>
        </div>
      </div>
    </section>`);
  const fala = secao.querySelector("[data-fala]");
  const dizer = (texto) => {
    fala.innerHTML = formatar(texto);
    fala.classList.remove("nova");
    void fala.offsetWidth;
    fala.classList.add("nova");
  };
  secao.querySelector("[data-mapa]").addEventListener("click", telaMapa);
  secao.querySelector("[data-mochila]").addEventListener("click", () => abrirMochila());
  tela.replaceChildren(secao);
  atualizarModoMundo(); // saiu do mapa: a barra de habilidades e o HUD do mapa somem
  dizer(`Bem-vindo à minha banca, **${nomeAluno()}**! Tudo aqui foi conferido duas vezes. Escolhe uma peça e eu te mostro como fica.`);

  const temItem = (i) => (i.consumivel ? quantidade(i.id) > 0 : possuiCosmetico(i.id));
  function desenharOuro() {
    secao.querySelector("[data-ouro]").innerHTML = `<span>🪙</span><b>${progresso.moedas}</b><small>moedas</small>`;
  }

  function desenharDetalhe() {
    const detalhe = secao.querySelector("[data-detalhe]");
    const i = escolhidoMercado && (itemDoCatalogo(escolhidoMercado) ? { ...itemDoCatalogo(escolhidoMercado), consumivel: CATALOGO.consumiveis.some((c) => c.id === escolhidoMercado) } : null);
    if (!i) {
      detalhe.innerHTML = '<p class="vazio-detalhe">Clica numa peça da vitrine para ver de perto.</p>';
      return;
    }
    const tem = temItem(i);
    let acao;
    if (i.consumivel) {
      acao = `<button class="botao botao-comprar" type="button" data-comprar ${progresso.moedas < i.preco ? "disabled" : ""}>Comprar · 🪙 ${i.preco}</button>`;
    } else if (tem) {
      acao = estaVestindo(i) ? '<span class="tag tag-concluida">Vestindo ✓</span>' : '<button class="botao" type="button" data-vestir>Vestir ✨</button>';
    } else if (i.preco && !i.exclusivo) {
      const falta = i.preco - progresso.moedas;
      acao = `<button class="botao botao-comprar" type="button" data-comprar ${falta > 0 ? "disabled" : ""}>Comprar · 🪙 ${i.preco}</button>
        ${falta > 0 ? `<small class="falta-ouro">Faltam 🪙 ${falta}</small>` : ""}`;
    } else {
      acao = `<p class="origem-exclusivo">🔒 ${escapar(i.origem || "Item exclusivo")}</p>`;
    }
    // a peça (consumível) ou o herói vestindo a peça, com o efeito dela, animados pelo laço da vitrine
    const previa = i.consumivel
      ? `<canvas class="pixel desenho-detalhe" width="140" height="140" data-desenho="${i.id}"></canvas>`
      : `<canvas class="pixel heroi-detalhe" width="64" height="64" data-heroi="${i.id}"></canvas>`;
    detalhe.innerHTML = `
      <div class="moldura-detalhe raridade-${i.raridade || "comum"} ${i.consumivel ? "consumivel" : ""}">
        ${previa}
        ${i.raridade ? `<span class="selo-raridade">${RARIDADES_ITEM[i.raridade]}</span>` : ""}
      </div>
      <strong class="nome-detalhe">${i.icone} ${escapar(i.nome)}</strong>
      <p class="descricao-detalhe">${escapar(i.descricao)}</p>
      ${i.bonus && Object.keys(i.bonus).length ? `<p class="bonus-item raridade-${i.raridade}">✦ ${escapar(textoBonus(i.bonus))}</p>` : ""}
      ${i.consumivel ? `<p class="qtd-detalhe">Na mochila: ×${quantidade(i.id)}</p>` : ""}
      <div class="acao-detalhe">${acao}</div>`;
    detalhe.querySelector("[data-comprar]")?.addEventListener("click", (evento) => comprar(i, evento));
    detalhe.querySelector("[data-vestir]")?.addEventListener("click", (evento) => {
      vestir(itemDoCatalogo(i.id));
      atualizarBonusDoServidor();
      faiscas(evento.clientX, evento.clientY, "#a98bff");
      dizer("Ficou um charme! O Reino inteiro vai comentar.");
      desenharTudo();
    });
  }

  function desenharVitrine() {
    secao.querySelector("[data-abas]").innerHTML = ABAS_MERCADO.map(([id, nome]) =>
      `<button type="button" class="aba-loja ${id === abaMercado ? "ativa" : ""}" data-aba="${id}">${nome}</button>`).join("");
    const raridades = abaMercado === "consumiveis" ? [] : ["todas", "comum", "raro", "epico", "lendario"];
    secao.querySelector("[data-filtros]").innerHTML = raridades.map((r) =>
      `<button type="button" class="chip-raridade raridade-${r} ${r === raridadeMercado ? "ativo" : ""}" data-raridade="${r}">${r === "todas" ? "Todas" : RARIDADES_ITEM[r]}</button>`).join("");
    const itens = itensDaAbaMercado(abaMercado).filter((i) => abaMercado === "consumiveis" || raridadeMercado === "todas" || i.raridade === raridadeMercado);
    secao.querySelector("[data-grade]").innerHTML = itens.length ? itens.map((i) => {
      const tem = temItem(i);
      const vestindo = !i.consumivel && tem && estaVestindo(i);
      const preco = i.consumivel || (!tem && i.preco && !i.exclusivo)
        ? `<span class="preco-carta ${progresso.moedas < i.preco ? "caro" : ""}">🪙 ${i.preco}</span>`
        : tem ? `<span class="preco-carta tem">${i.consumivel ? `×${quantidade(i.id)}` : vestindo ? "Vestindo" : "✓ É teu"}</span>` : '<span class="preco-carta trancado">🔒</span>';
      return `
        <button type="button" class="carta-loja raridade-${i.raridade || "comum"} ${i.id === escolhidoMercado ? "escolhida" : ""} ${tem && !i.consumivel ? "possuida" : ""}" data-item="${i.id}">
          ${i.raridade ? `<i class="faixa-raridade">${RARIDADES_ITEM[i.raridade]}</i>` : ""}
          <canvas class="pixel desenho-vitrine" width="96" height="96" data-desenho="${i.id}"></canvas>
          <strong>${escapar(i.nome)}</strong>
          ${i.bonus && Object.keys(i.bonus).length ? `<small>${escapar(textoBonus(i.bonus))}</small>` : `<small>${escapar(i.descricao.slice(0, 60))}${i.descricao.length > 60 ? "…" : ""}</small>`}
          ${preco}
        </button>`;
    }).join("") : '<p class="vazio-detalhe">Nada nesta raridade por enquanto.</p>';
    secao.querySelectorAll("[data-aba]").forEach((b) => b.addEventListener("click", () => {
      abaMercado = b.dataset.aba;
      raridadeMercado = "todas";
      Som.efeito("clique");
      desenharVitrine();
    }));
    secao.querySelectorAll("[data-raridade]").forEach((b) => b.addEventListener("click", () => {
      raridadeMercado = b.dataset.raridade;
      desenharVitrine();
    }));
    secao.querySelectorAll("[data-item]").forEach((b) => b.addEventListener("click", () => {
      escolhidoMercado = b.dataset.item;
      const item = itemDoCatalogo(escolhidoMercado);
      Som.efeito("clique");
      if (item?.raridade === "lendario") dizer(item.exclusivo ? "Ahh... esse eu nunca vendi. Dizem que só aparece para quem é digno." : "Esse é o meu orgulho! Lendário, forjado com material de chefão.");
      else if (item?.exclusivo) dizer(`Esse não está à venda, querido. ${item.origem || ""}`);
      desenharVitrine();
      desenharDetalhe();
    }));
  }

  function desenharTudo() {
    desenharOuro();
    desenharVitrine();
    desenharDetalhe();
  }

  async function comprar(item, evento) {
    const erro = await comprarItem(item.id);
    if (erro) {
      dizer(erro);
      Som.efeito("erro");
      return;
    }
    faiscas(evento.clientX, evento.clientY);
    xpFlutuante(`-${item.preco} 🪙`, evento.clientX, evento.clientY);
    if (item.raridade === "lendario") chuvaDeEstrelas(50);
    dizer(MERCADORA.compras[Math.floor(Math.random() * MERCADORA.compras.length)]);
    desenharTudo();
  }

  // o laço que anima a vitrine: cada peça com o brilho e as partículas dela, e o herói do detalhe
  const porId = new Map([...CATALOGO.consumiveis, ...CATALOGO.cosmeticos].map((i) => [i.id, i]));
  let ultimoQuadroVitrine = 0;
  const animarVitrine = (agora) => {
    if (!tela.contains(secao)) return;
    // 30 quadros por segundo bastam (e nada com a aba escondida)
    if (document.hidden || agora - ultimoQuadroVitrine < 32) {
      requestAnimationFrame(animarVitrine);
      return;
    }
    ultimoQuadroVitrine = agora;
    const t = agora / 1000;
    secao.querySelectorAll("canvas[data-desenho]").forEach((c) => {
      const item = porId.get(c.dataset.desenho);
      if (item) desenharItemNaVitrine(c.getContext("2d"), item, t, c.width);
    });
    const heroi = secao.querySelector("canvas[data-heroi]");
    const item = heroi && porId.get(heroi.dataset.heroi);
    if (item) {
      const ctx = heroi.getContext("2d");
      const escolhas = { ...progresso.avatar, ...item.avatar };
      ctx.clearRect(0, 0, heroi.width, heroi.height);
      if (item.raridade !== "comum") brilhoRedondo(ctx, 32, 34, 22, LUZ_RARIDADE[item.raridade], 0.08 + Math.sin(t * 3) * 0.03);
      const sprite = heroiParado(escolhas);
      const y0 = 64 - PE_HEROI - 6 + Math.round(Math.sin(t * 2) * 1);
      ctx.drawImage(sprite, 16, y0);
      desenharEfeitosHeroi(ctx, escolhas, t, 16, y0, "baixo");
    }
    requestAnimationFrame(animarVitrine);
  };
  desenharTudo();
  requestAnimationFrame(animarVitrine);
}

// ---------- dungeons ----------

const PROVOCACOES = [
  "Hahaha! Duvido que tu acerte essa!",
  "Teus feitiços não me assustam, aprendiz!",
  "Mais um passo e tu vira poeira!",
  "Vamos ver se o Zetsu te ensinou direito...",
];
const DOR = ["Argh! Como tu sabia?!", "Uff! Esse doeu...", "Impossível! Acertou de novo?!", "Grrr... sorte de principiante!"];
const RISADA = ["HAHAHA! Errou feio!", "Hehehe... caiu direitinho!", "Isso foi fácil demais!", "Mwahaha! Mais um coração pra mim!"];
const QUEDA = ["Nããão... derrotado por um aprendiz...", "Isso não acaba aqui... *puf*", "Volto na próxima lua cheia..."];

function sortear(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

function caveiras(n) {
  return "💀".repeat(n) + '<span class="apagada">💀</span>'.repeat(3 - n);
}

function abrirDungeon(d, fases) {
  const modalMissao = document.getElementById("modal-missao");
  const liberada = Boolean(progresso.fases[d.requer_fase]);
  const vitorias = (progresso.dungeons[d.id] || {}).vitorias || 0;
  const faseRequerida = fases.find((f) => f.id === d.requer_fase);
  const premio = vitorias
    ? `<p class="aviso">🏆 Já conquistada ${vitorias}× · repetir dá ${Math.round(d.recompensa.moedas * 0.3)} moedas + as moedas das salas</p>`
    : `<div class="recompensa">
        <span>🪙 ${d.recompensa.moedas}</span><span>⭐ ${d.recompensa.xp} XP</span>
        <span>${itemDoCatalogo(d.recompensa.cosmetico).icone} Visual raro</span><span>${itemDoCatalogo(d.recompensa.trofeu).icone} Troféu</span>
      </div>`;
  modalMissao.innerHTML = `
    <div class="missao-conteudo">
      <div class="icone-missao">${d.icone}</div>
      <p class="local">Dungeon · ${d.salas} salas · <span class="dificuldade">${caveiras(d.dificuldade)}</span></p>
      <h2>${escapar(d.nome)}</h2>
      <p>${escapar(d.descricao)}</p>
      ${liberada ? premio : `<p class="aviso">🔒 Conclua a fase ${d.requer_fase} (${escapar(faseRequerida?.local || "")}) para abrir esta dungeon.</p>`}
      ${liberada ? `<p class="regras">Tu entra com tua vida atual: <span class="vidas-linha">${coracoesHtml()}</span><br>Errou, o monstro te ataca. Acerta todas e ele cai.</p>` : ""}
      ${liberada && quantidade("amuleto") ? `<label class="usar-amuleto"><input type="checkbox" data-amuleto> Usar 🍀 Amuleto da Sorte (moedas em dobro) · tens ${quantidade("amuleto")}</label>` : ""}
      <div class="acoes">
        <button class="botao botao-fantasma" type="button" data-fechar>Voltar</button>
        ${liberada ? '<button class="botao" type="button" data-entrar>Entrar na dungeon ⚔️</button>' : ""}
      </div>
    </div>`;
  modalMissao.querySelector("[data-fechar]").addEventListener("click", () => modalMissao.close());
  modalMissao.querySelector("[data-entrar]")?.addEventListener("click", () => {
    const amuleto = Boolean(modalMissao.querySelector("[data-amuleto]")?.checked);
    modalMissao.close();
    telaDungeon(d.id, amuleto);
  });
  modalMissao.showModal();
}

// a dungeon por dentro (o labirinto, as lutas e os baús) fica em static/js/labirinto.js

// Reinicia uma animação de CSS no elemento (atacar, tremer...).
// A arena viva: o herói troca de quadro como num RPG (postura, respiração e uma piscada de vez em quando)
// e o monstro ganha a animação parada do tipo dele (o slime estica e achata, os voadores pairam, as feras
// respiram). Chefões rugem de tempos em tempos. Para sozinho quando a luta sai da tela.
const IDLE_DOS_MONSTROS = [
  [/slime|gosma|lodo/, "idle-slime"],
  [/morcego|dragao|ignis|fogo|assombr|fantasma|vazio|nyxar|eco|corvo|harpia/, "idle-voa"],
];

function classeIdleDoMonstro(monstro) {
  const tipo = (monstro.tipoId || "").toLowerCase();
  return (IDLE_DOS_MONSTROS.find(([padrao]) => padrao.test(tipo)) || [null, "idle-fera"])[1];
}

// Os quadros do monstro na batalha, como os do herói. Quem tem quadros desenhados usa os dele (o dragão
// bate as asas, o lobo firma as patas); quem voa e não tem, bate as asas pelo desenho parado; os outros
// respiram: a parte de cima do corpo desce 1 pixel e volta, com os pés parados no chão.
function quadrosDeRespirar(sprite) {
  const w = sprite.width;
  const h = sprite.height;
  const { canvas, ctx } = criarTela(w, h);
  ctx.imageSmoothingEnabled = false;
  const corte = Math.round(h * 0.55);
  ctx.drawImage(sprite, 0, corte, w, h - corte, 0, corte, w, h - corte);
  ctx.drawImage(sprite, 0, 0, w, corte, 0, 1, w, corte);
  return [sprite, canvas];
}

function quadrosDeBatalha(monstro) {
  const sprite = monstro.sprite;
  if (!sprite?.getContext) return null;
  const voa = estiloDeAndar(monstro) === "asas";
  const lista = monstro.quadros?.length ? monstro.quadros : voa ? quadrosDeAndar(sprite, "asas") : quadrosDeRespirar(sprite);
  return { urls: lista.map((c) => c.toDataURL()), ritmo: voa ? 150 : monstro.quadros?.length ? 240 : 480 };
}

function animarArena(secao, heroiImg, corpoInimigo, monstro) {
  // os do bestiário (com quadros próprios) já se mexem sozinhos: o slime não ganha o achatar do CSS por cima
  const temQuadros = Boolean(monstro.quadros?.length);
  const idle = classeIdleDoMonstro(monstro);
  if (!(temQuadros && idle === "idle-slime")) corpoInimigo.classList.add(idle);
  let quadrosMonstro = null;
  try {
    quadrosMonstro = quadrosDeBatalha(monstro);
  } catch {
    quadrosMonstro = null; // sem os quadros, o monstro fica no desenho parado (com a animação do CSS)
  }
  // o slime antigo (sem quadros) não troca de quadro: o CSS já estica e achata o corpo, e os dois juntos piscavam
  if (idle === "idle-slime" && !temQuadros) quadrosMonstro = null;
  if (quadrosMonstro) {
    // os quadros são carregados e decodificados antes de começar (e ficam guardados), para a troca de
    // imagem nunca deixar um quadro em branco no meio
    const prontos = quadrosMonstro.urls.map((url) => {
      const img = new Image();
      img.src = url;
      return img;
    });
    Promise.all(prontos.map((img) => img.decode().catch(() => null))).then(() => {
      if (!secao.isConnected) return;
      let q = 0;
      corpoInimigo.src = prontos[0].src;
      const relogioMonstro = setInterval(() => {
        if (!secao.isConnected) return clearInterval(relogioMonstro);
        if (document.hidden) return;
        q = (q + 1) % prontos.length;
        corpoInimigo.src = prontos[q].src;
      }, quadrosMonstro.ritmo);
    });
  }
  let quadros = null;
  try {
    const s = spritesHeroi(progresso.avatar).baixo;
    quadros = { postura: s[0].toDataURL(), respira: s[QUADRO_RESPIRA].toDataURL(), pisca: s[QUADRO_PISCA].toDataURL() };
  } catch {
    quadros = null; // sem os quadros, o herói fica na imagem parada
  }
  let passo = 0;
  const relogio = setInterval(() => {
    if (!secao.isConnected) return clearInterval(relogio);
    passo += 1;
    if (quadros && heroiImg) heroiImg.src = passo % 11 === 0 ? quadros.pisca : passo % 2 ? quadros.respira : quadros.postura;
    // o chefão ruge a cada ~5 s
    if (monstro.chefe && passo % 12 === 0) animar(corpoInimigo, "rugindo");
  }, 420);
}

// ---------- o clima na luta ----------
// O mesmo céu do mapa (reino.js): chove nos campos, no vale e na floresta quando está chovendo lá, neva
// sempre nas montanhas, e a noite escurece o fundo nas regiões do Reino (Umbraterra tem o próprio céu).
const REGIOES_COM_CEU = ["campos", "vale", "floresta", "pantano", "deserto", "montanhas"];
function climaDaLuta(regiao) {
  if (!REGIOES_COM_CEU.includes(regiao)) return { chuva: false, neve: false, noite: 0 };
  const chuva = typeof estaChovendo === "function" && estaChovendo() && ["campos", "vale", "floresta"].includes(regiao);
  const escuridao = typeof momentoDoDia === "function" ? momentoDoDia().escuridao || 0 : 0;
  const noite = typeof ESCURIDAO_NOITE !== "undefined" ? Math.min(1, escuridao / ESCURIDAO_NOITE) : 0;
  return { chuva, neve: regiao === "montanhas", noite };
}

// A chuva (ou a neve) caindo por cima da arena, em pixel: uma tela pequena ampliada, a 30 quadros por
// segundo. Na chuva, os pingos riscam na diagonal, respingam no chão e às vezes um relâmpago clareia tudo.
function animarClimaDaArena(arena, clima) {
  const L = 192;
  const A = 90;
  // a tela fica dentro de uma caixa que estica até o tamanho do fundo da arena (sem empurrar o layout)
  const caixa = document.createElement("div");
  caixa.className = "clima-arena";
  caixa.setAttribute("aria-hidden", "true");
  const tela = document.createElement("canvas");
  tela.className = "pixel";
  tela.width = L;
  tela.height = A;
  caixa.append(tela);
  arena.append(caixa);
  const ctx = tela.getContext("2d");
  const gotas = Array.from({ length: clima.chuva ? 70 : 45 }, (_, i) => ({ x: (i * 53) % L, y: (i * 37) % A, v: clima.chuva ? 70 + (i % 5) * 14 : 8 + (i % 4) * 4, fase: i }));
  const respingos = [];
  let ultimo = 0;
  let clarao = 0;
  const inicio = performance.now();
  const quadro = (agora) => {
    if (!tela.isConnected) return;
    requestAnimationFrame(quadro);
    if (document.hidden || agora - ultimo < 32) return;
    const dt = Math.min(0.1, (agora - (ultimo || agora)) / 1000);
    ultimo = agora;
    const t = (agora - inicio) / 1000;
    ctx.clearRect(0, 0, L, A);
    if (clima.chuva) {
      // relâmpago raro: um clarão rápido
      if (clarao <= 0 && Math.random() < dt * 0.06) clarao = 0.35;
      if (clarao > 0) {
        ctx.fillStyle = `rgba(230, 240, 255, ${clarao})`;
        ctx.fillRect(0, 0, L, A);
        clarao -= dt * 1.4;
      }
      ctx.fillStyle = "rgba(190, 210, 255, 0.55)";
      gotas.forEach((g) => {
        g.y += g.v * dt;
        g.x -= g.v * dt * 0.25;
        if (g.y > A) {
          if (Math.random() < 0.5) respingos.push({ x: g.x, y: A - 2 - Math.random() * 18, vida: 0.25 });
          g.y -= A + 6;
          g.x = Math.random() * (L + 20);
        }
        if (g.x < -4) g.x += L + 8;
        ctx.fillRect(Math.round(g.x), Math.round(g.y), 1, 3);
        ctx.fillRect(Math.round(g.x) + 1, Math.round(g.y) - 2, 1, 2);
      });
      for (let i = respingos.length - 1; i >= 0; i--) {
        const r = respingos[i];
        r.vida -= dt;
        if (r.vida <= 0) {
          respingos.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `rgba(210, 225, 255, ${r.vida * 2.4})`;
        ctx.fillRect(Math.round(r.x) - 1, Math.round(r.y), 1, 1);
        ctx.fillRect(Math.round(r.x) + 1, Math.round(r.y), 1, 1);
        ctx.fillRect(Math.round(r.x), Math.round(r.y) - 1, 1, 1);
      }
    } else {
      // a neve: flocos caindo devagar, balançando
      gotas.forEach((g) => {
        g.y += g.v * dt;
        if (g.y > A) g.y -= A + 4;
        const x = (g.x + Math.sin(t * 0.9 + g.fase) * 4 + L) % L;
        ctx.fillStyle = g.v > 14 ? "#ffffff" : "rgba(255, 255, 255, 0.7)";
        ctx.fillRect(Math.round(x), Math.round(g.y), g.v > 14 ? 2 : 1, g.v > 14 ? 2 : 1);
      });
    }
  };
  requestAnimationFrame(quadro);
}

function animar(elemento, classe) {
  elemento.classList.remove(classe);
  void elemento.offsetWidth;
  elemento.classList.add(classe);
  setTimeout(() => elemento.classList.remove(classe), 700);
}

// A vitória na masmorra: uma cena de verdade no tema da dungeon (parede de pedra, tochas, o chefão caído
// à esquerda, o herói à direita e o baú no meio, que treme, abre e solta o brilho do tesouro). Embaixo, a
// faixa "Masmorra conquistada", o placar da corrida (guardiões, sombras, baús, chefão) e os espólios em
// espaços de inventário, que aparecem um a um.
async function telaVitoriaDungeon(d, corrida = {}) {
  window.scrollTo(0, 0);
  const nivelAntes = nivelDe(progresso.xp);
  // o servidor confere que o herói entrou nesta dungeon e calcula o prêmio (cheio só na primeira vez)
  const { primeira, ganhos, amuleto } = await acaoJogador(`dungeons/${d.id}/vitoria`);
  const visual = primeira ? itemDoCatalogo(d.recompensa.cosmetico) : null;
  const tema = corrida.tema || (typeof TEMAS_LABIRINTO !== "undefined" && TEMAS_LABIRINTO[d.id]) || {};
  const pixelUrl = (canvas) => (canvas ? canvas.toDataURL() : "");
  let chefe = "";
  try {
    // (os chefões do bestiário vêm em quadros de animação: na cena da vitória, o primeiro)
    const arteChefe = tema.chefe?.();
    chefe = pixelUrl(Array.isArray(arteChefe) ? arteChefe[0] : arteChefe);
  } catch {
    chefe = ""; // sem sprite do chefão (dungeon sem tema): a cena fica só com o herói e o baú
  }
  const placar = [
    ["espada", "Guardiões", corrida.guardioes ?? d.salas.length - 1],
    ["caveira", "Sombras", corrida.errantes ?? 0],
    ["bau", "Baús", corrida.totalBaus ? `${corrida.baus} / ${corrida.totalBaus}` : "—"],
    ["coroa", "Chefão", escapar(corrida.chefe || d.salas[d.salas.length - 1].inimigo.nome)],
  ];

  const secao = criar(`
    <section class="vitoria-dungeon vitoria-rpg" style="--tocha:${tema.tocha || "255, 170, 90"};--pedra:${tema.topo || "#5b4f73"};--chao:${tema.chao || "#3a3346"}">
      <canvas class="vd-fundo" width="192" height="108" aria-hidden="true"></canvas>
      <div class="vd-conteudo">
        <div class="vd-palco" aria-hidden="true">
          ${chefe ? `<img class="vd-chefe" src="${chefe}" alt="">` : ""}
          <div class="vd-bau">
            <i class="vd-raios"></i>
            <img class="vd-bau-fechado" src="${pixelUrl(bauPixelCanvas(false))}" alt="">
            <img class="vd-bau-aberto" src="${pixelUrl(bauPixelCanvas(true))}" alt="">
          </div>
          <img class="vd-heroi" src="${pixelUrl(heroiParado(progresso.avatar))}" alt="">
        </div>
        <div class="vd-faixa">
          <small>✦ ${escapar(d.nome)} ✦</small>
          <h2>Masmorra Conquistada</h2>
        </div>
        <ul class="vd-placar">
          ${placar.map(([icone, rotulo, valor], i) => `
            <li style="animation-delay:${1.5 + i * 0.12}s">${imgIconeRpg(icone)}<span>${rotulo}</span><b>${valor}</b></li>`).join("")}
        </ul>
        ${amuleto ? `<p class="aviso-amuleto">🍀 O Amuleto da Sorte dobrou tuas moedas!</p>` : ""}
        <div class="vd-espolios">
          <h3>Espólios${primeira ? ' <em>1ª conquista</em>' : ""}</h3>
          <ul>
            ${ganhos.map((g, i) => `
              <li class="${g.raro ? "raro" : ""}" style="animation-delay:${2 + i * 0.25}s" title="${escapar(g.texto)}">
                <span class="vd-slot">${iconeDoGanho(g)}</span><span class="vd-nome">${escapar(g.texto)}</span>
              </li>`).join("")}
          </ul>
        </div>
        <div class="acoes">
          ${visual ? `<button class="botao botao-fantasma" type="button" data-vestir>Vestir ${visual.icone} ${escapar(visual.nome)}</button>` : ""}
          <button class="botao botao-fantasma" type="button" data-mochila>${imgIconeRpg("mochila")} Mochila</button>
          <button class="botao" type="button" data-mapa>Voltar ao Reino ▸</button>
        </div>
      </div>
    </section>`);
  secao.querySelector("[data-mapa]").addEventListener("click", telaMapa);
  secao.querySelector("[data-mochila]").addEventListener("click", () => abrirMochila());
  secao.querySelector("[data-vestir]")?.addEventListener("click", (evento) => {
    vestir(visual);
    faiscas(evento.clientX, evento.clientY, "#a98bff");
    evento.currentTarget.textContent = "Vestindo ✓";
    evento.currentTarget.disabled = true;
  });
  tela.replaceChildren(secao);
  animarFundoVitoria(secao.querySelector(".vd-fundo"), tema);
  // o baú abre depois de tremer: o som da moeda e uma chuva de estrelas junto com o brilho
  setTimeout(() => {
    if (!secao.isConnected) return;
    Som.efeito("moeda");
    chuvaDeEstrelas(40);
  }, 1100);
  setTimeout(() => {
    atualizarStatus();
    if (nivelDe(progresso.xp) > nivelAntes) subiuDeNivel(nivelDe(progresso.xp));
  }, 900);
}

// O fundo da vitória em pixel (192 x 108, ampliado): parede de tijolos no tom da dungeon, chão, duas
// tochas tremulando, o facho de luz do baú e faíscas de ouro subindo. Para sozinho quando a tela sai.
function animarFundoVitoria(canvas, tema) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const parede = tema.parede || "#1e1a2a";
  const pedra = tema.topo || "#5b4f73";
  const chao = tema.chao || "#3a3346";
  const tocha = tema.tocha || "255, 170, 90";
  const faiscas = Array.from({ length: 26 }, (_, i) => ({ x: 70 + ((i * 37) % 52), y: 40 + ((i * 53) % 60), v: 6 + (i % 5) * 3, fase: i }));
  // os tijolos não mudam: desenha uma vez numa folha
  const folha = criarTela(W, H);
  const f = folha.ctx;
  f.fillStyle = parede;
  f.fillRect(0, 0, W, H);
  for (let y = 0; y < 76; y += 8) {
    for (let x = (y / 8) % 2 ? -8 : 0; x < W; x += 16) {
      f.fillStyle = tom(pedra, 0.55 + (((x * 7 + y * 3) % 5) / 40));
      f.fillRect(x + 1, y + 1, 14, 6);
      f.fillStyle = tom(pedra, 0.75);
      f.fillRect(x + 1, y + 1, 14, 1);
    }
  }
  f.fillStyle = chao;
  f.fillRect(0, 76, W, H - 76);
  for (let x = 0; x < W; x += 12) {
    f.fillStyle = tom(chao, 0.8);
    f.fillRect(x, 76 + ((x / 12) % 2) * 6, 11, 1);
  }
  f.fillStyle = tom(pedra, 0.4);
  f.fillRect(0, 75, W, 2);
  const tochas = [[30, 34], [W - 31, 34]];
  const inicio = performance.now();
  function quadro(agora) {
    if (!canvas.isConnected) return;
    const t = (agora - inicio) / 1000;
    ctx.drawImage(folha.canvas, 0, 0);
    // escuro nas bordas
    const vinheta = ctx.createRadialGradient(W / 2, H * 0.62, 10, W / 2, H * 0.62, W * 0.62);
    vinheta.addColorStop(0, "rgba(0,0,0,0)");
    vinheta.addColorStop(1, "rgba(0,0,0,0.7)");
    ctx.fillStyle = vinheta;
    ctx.fillRect(0, 0, W, H);
    // as tochas
    tochas.forEach(([x, y], i) => {
      const tremor = Math.sin(t * 9 + i * 2) * 0.5 + Math.sin(t * 23 + i) * 0.3;
      brilhoRedondo(ctx, x, y - 2, 18 + tremor * 2, tocha, 0.07);
      ctx.fillStyle = "#4a3020";
      ctx.fillRect(x - 1, y, 3, 8);
      ctx.fillStyle = "#2a1a10";
      ctx.fillRect(x - 2, y + 1, 5, 2);
      ctx.fillStyle = `rgb(${tocha})`;
      ctx.fillRect(x - 1, y - 4 - Math.round(tremor), 3, 4 + Math.round(tremor));
      ctx.fillStyle = "#fff3b0";
      ctx.fillRect(x, y - 2, 1, 2);
    });
    // o facho de luz do baú (depois que ele abre)
    const luz = Math.min(1, Math.max(0, (t - 1.1) * 2));
    if (luz > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 7; i++) {
        const angulo = -Math.PI / 2 + (i - 3) * 0.22 + Math.sin(t * 0.8 + i) * 0.04;
        ctx.fillStyle = `rgba(255, 220, 120, ${0.05 * luz})`;
        ctx.beginPath();
        ctx.moveTo(W / 2, 74);
        ctx.lineTo(W / 2 + Math.cos(angulo - 0.06) * 120, 74 + Math.sin(angulo - 0.06) * 120);
        ctx.lineTo(W / 2 + Math.cos(angulo + 0.06) * 120, 74 + Math.sin(angulo + 0.06) * 120);
        ctx.closePath();
        ctx.fill();
      }
      brilhoRedondo(ctx, W / 2, 72, 22, "255, 220, 120", 0.06 * luz);
      ctx.restore();
      // faíscas de ouro subindo do baú
      faiscas.forEach((p) => {
        const y = 78 - (((t - 1.1) * p.v + p.fase * 7) % 70);
        const x = p.x + Math.sin(t * 2 + p.fase) * 3;
        ctx.fillStyle = p.fase % 3 ? "#f5c451" : "#fff3b0";
        ctx.globalAlpha = luz * Math.min(1, (y - 8) / 30);
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
        ctx.globalAlpha = 1;
      });
    }
    requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);
}

// ---------- formatura ----------

// Formado = concluiu todas as fases recomendadas da trilha (as opcionais não são obrigatórias).
function formado(fases) {
  const opcionais = progresso.trilha ? progresso.trilha.opcionais : [];
  const obrigatorias = fases.filter((f) => !opcionais.includes(f.id));
  return obrigatorias.length > 0 && obrigatorias.every((f) => !f.em_breve && progresso.fases[f.id]);
}

function telaCertificado(fases) {
  window.scrollTo(0, 0);
  const feitas = fases.filter((f) => progresso.fases[f.id]);
  const estrelas = feitas.reduce((soma, f) => soma + progresso.fases[f.id].estrelas, 0);
  const classe = identidadeDaClasse();
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  const secao = criar(`
    <section class="certificado-tela">
      <div class="acoes nao-imprimir">
        <button class="botao botao-fantasma" type="button" data-voltar>◂ Mapa</button>
        <button class="botao" type="button" data-imprimir>🖨️ Imprimir ou salvar em PDF</button>
      </div>
      <article class="certificado">
        <div class="cert-retratos">${avatarSvg(progresso.avatar, nomeAluno())}<img src="${IMG_ZETSU}" alt="Zetsu" width="80" height="80"></div>
        <p class="cert-topo">RPG IA · Academia Arcana de Elyndor</p>
        <h1>Certificado de Formatura</h1>
        <p>Certificamos que</p>
        <p class="cert-nome">${escapar(nomeAluno())}</p>
        <p class="cert-classe">${classe.icone} ${escapar(classe.titulo)}</p>
        <p>dominou a nova magia da Inteligência Artificial na Academia Arcana de Elyndor, do primeiro feitiço ao dragão,
          aprendendo a pedir bem, proteger dados, rodar código, integrar APIs e transformar ideias em produto.</p>
        <ul class="cert-fases">
          ${fases.map((f) => `<li>${f.icone} ${escapar(f.titulo)} ${progresso.fases[f.id]
            ? `<span class="estrelas">${estrelasHtml(progresso.fases[f.id].estrelas)}</span>`
            : '<span class="dispensada">dispensada · já dominava</span>'}</li>`).join("")}
        </ul>
        <p class="cert-numeros"><strong>${progresso.xp} XP</strong> · <strong>${estrelas} de ${feitas.length * 3}</strong> estrelas</p>
        <div class="cert-rodape">
          <span>${hoje}</span>
          <span class="assinatura">Zetsu<small>Professor da Academia Arcana</small></span>
        </div>
      </article>
    </section>`);
  secao.querySelector("[data-voltar]").addEventListener("click", telaMapa);
  secao.querySelector("[data-imprimir]").addEventListener("click", () => window.print());
  tela.replaceChildren(secao);
}

function calcularEstrelas(estado) {
  // cada parte avaliada da fase vira estrelas; a fase fica com a média
  const notas = [];
  if (estado.totalQuiz) {
    const taxa = estado.acertosQuiz / estado.totalQuiz;
    notas.push(taxa === 1 ? 3 : taxa >= 0.7 ? 2 : 1);
  }
  if (estado.estrelasPrompt !== null) notas.push(estado.estrelasPrompt);
  notas.push(...estado.estrelasEtapas);
  const media = notas.length ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : 3;
  // espiar a solução do Zetsu custa uma estrela por missão, mas a fase nunca fica com menos de 1
  return Math.max(1, media - estado.solucoesVistas);
}

async function concluirFase(fase, estado) {
  const estrelas = calcularEstrelas(estado);
  const nivelAntes = nivelDe(progresso.xp);
  // o servidor dá o XP (só o que melhorou), o baú da primeira conclusão e, se a trilha acabou,
  // o presente da formatura
  const r = await acaoJogador(`fases/${fase.id}/concluir`, { estrelas });
  const ganho = r.ganho;
  const bau = r.bau.length ? r.bau : null;
  const presenteFormatura = r.presente.length ? r.presente : null;

  const quiz = estado.totalQuiz ? `<p>Quiz: ${estado.acertosQuiz} de ${estado.totalQuiz} acertos.</p>` : "";
  const textoGanho = ganho > 0 ? `+${ganho} XP` : "Você já tinha esse resultado. Tenta as 3 estrelas!";
  const estrelasAnimadas = [1, 2, 3].map((n) => `<span class="estrela-fim" style="animation-delay:${0.3 + n * 0.25}s">${
    n <= estrelas ? "★" : '<span class="apagada">★</span>'}</span>`).join("");
  const secao = criar(`
    <section class="fim-fase">
      <img class="pixel retrato-fim" src="${heroiParado(professorPorId(professorDa(fase)).visual).toDataURL()}" alt="O professor comemorando">
      <p class="local-fim">${escapar(fase.local || "")}</p>
      <h2>Missão cumprida!</h2>
      <span class="estrelas">${estrelasAnimadas}</span>
      <p class="ganho">${textoGanho}</p>
      ${quiz}
      ${bau ? `<div class="bau-fase"><h3>🎁 Baú da ${escapar(fase.local || "fase")}</h3>${listaGanhos(bau)}</div>` : ""}
      ${presenteFormatura ? `<div class="bau-fase"><h3>🎓 Presente de formatura</h3>${listaGanhos(presenteFormatura)}</div>` : ""}
      <div class="acoes">
        <button class="botao botao-fantasma" type="button" data-repetir>Jogar de novo</button>
        <button class="botao" type="button" data-mapa>Voltar à Academia 🏰</button>
      </div>
    </section>`);
  secao.querySelector("[data-repetir]").addEventListener("click", () => jogarFase(fase.id));
  secao.querySelector("[data-mapa]").addEventListener("click", telaMapa);
  // aula na sala: o resultado aparece escrito na própria lousa
  const aula = tela.querySelector(".aula-na-sala");
  if (aula) {
    aula.querySelector(".palco")?.remove();
    aula.querySelector(".lousa").replaceChildren(secao);
    secao.querySelector("[data-mapa]").textContent = "Voltar à sala ✓";
  } else {
    tela.replaceChildren(secao);
    window.scrollTo(0, 0);
  }

  // a festa: estrelas caindo, XP subindo e, se for o caso, subida de nível
  chuvaDeEstrelas(estrelas * 18);
  if (ganho > 0) {
    const alvo = secao.querySelector(".ganho").getBoundingClientRect();
    xpFlutuante(`+${ganho} XP`, alvo.left + alvo.width / 2, alvo.top);
    setTimeout(() => {
      atualizarStatus();
      const nivelDepois = nivelDe(progresso.xp);
      if (nivelDepois > nivelAntes) subiuDeNivel(nivelDepois);
    }, 700);
  } else {
    atualizarStatus();
  }
}

// ---------- efeitos ----------

const camadaEfeitos = document.getElementById("efeitos");

function chuvaDeEstrelas(quantidade) {
  const simbolos = ["⭐", "✨", "🌟", "💫", "🪙"];
  for (let i = 0; i < quantidade; i++) {
    const p = document.createElement("span");
    p.className = "particula";
    p.textContent = simbolos[i % simbolos.length];
    p.style.left = `${Math.random() * 100}vw`;
    p.style.fontSize = `${14 + Math.random() * 18}px`;
    p.style.animationDuration = `${2 + Math.random() * 2.5}s`;
    p.style.animationDelay = `${Math.random() * 0.8}s`;
    camadaEfeitos.append(p);
    setTimeout(() => p.remove(), 5500);
  }
}

function faiscas(x, y, cor) {
  for (let i = 0; i < 12; i++) {
    const f = document.createElement("span");
    f.className = "faisca-clique";
    const angulo = (i / 12) * Math.PI * 2;
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    f.style.setProperty("--dx", `${Math.cos(angulo) * 60}px`);
    f.style.setProperty("--dy", `${Math.sin(angulo) * 60}px`);
    if (cor) f.style.background = cor;
    camadaEfeitos.append(f);
    setTimeout(() => f.remove(), 800);
  }
}

function xpFlutuante(texto, x, y) {
  const el = document.createElement("span");
  el.className = "xp-flutuante";
  el.textContent = texto;
  el.style.left = `${x - 60}px`;
  el.style.top = `${y - 20}px`;
  camadaEfeitos.append(el);
  setTimeout(() => el.remove(), 2100);
}

// Subiu de nível: um pilar de luz dourada desce, o herói sobe brilhando e o número do nível estoura
// na tela, com tudo o que foi desbloqueado. Fecha sozinho ou com um clique.
// A cerimônia do título novo: o círculo mágico carrega embaixo do herói, um pilar de luz sobe, o selo do
// título novo aparece grande e a novidade (magia ou passiva) logo abaixo. No último degrau, tudo em ouro
// e o aviso de que a Fenda vai reconhecer o herói. Espera a festa de nível, se as duas vierem juntas.
function cerimoniaDoTitulo(novidade) {
  if (document.querySelector(".festa-nivel")) return setTimeout(() => cerimoniaDoTitulo(novidade), 900);
  const id = identidadeDaClasse();
  const tela = criar(`
    <div class="cerimonia-titulo ${id.ultimo ? "ultimo" : ""}" role="status">
      <canvas class="circulo-magico"></canvas>
      <img class="pixel heroi-cerimonia" src="${heroiParado(progresso.avatar).toDataURL()}" alt="">
      <div class="texto-cerimonia">
        <span class="sobe">✦ ${id.ultimo ? "O ÚLTIMO TÍTULO" : "TÍTULO NOVO"} ✦</span>
        <div class="selo-cerimonia">${seloDoTitulo()}</div>
        <p>${escapar(novidade)}</p>
        ${id.ultimo ? "<p class=\"fenda-cerimonia\">🌀 Os Selos cantam: a Fenda da Ruptura vai te reconhecer.</p>" : ""}
        <small>clica para continuar</small>
      </div>
    </div>`);
  document.body.append(tela);
  const circulo = circuloMagicoRitual(tela.querySelector(".circulo-magico"), 5);
  setTimeout(() => circulo.carregar(), 300);
  Som.efeito("evolucao");
  setTimeout(() => Som.efeito("nivel"), 700);
  chuvaDeEstrelas(id.ultimo ? 90 : 50);
  const fechar = () => {
    tela.classList.add("saindo");
    setTimeout(() => {
      circulo.destruir();
      tela.remove();
    }, 400);
  };
  tela.addEventListener("click", fechar);
  setTimeout(fechar, 7000);
}

function subiuDeNivel(nivel) {
  Som.efeito("nivel");
  setTimeout(() => Som.efeito("evolucao"), 450);
  const novidades = [
    ...JORNADA.magias.magias.filter((m) => m.nivel === nivel).map((m) => `${m.icone} Técnica nova: ${m.nome}`),
    ...Object.values(JORNADA.regioes || {}).filter((r) => r.nivelMinimo === nivel).map((r) => `🗺️ Região liberada: ${r.nome}`),
    ...(nivel === JORNADA.caminho.nivel_escolha && principalDoHeroi() && !classeDoHeroi() ? ["🌟 Já podes escolher tua subclasse (tecla K)"] : []),
    "🌳 +1 ponto de habilidade",
  ];
  const tela = criar(`
    <div class="festa-nivel" role="status">
      <div class="raios-nivel"></div>
      <div class="pilar-nivel"></div>
      <img class="pixel heroi-nivel" src="${heroiParado(progresso.avatar).toDataURL()}" alt="">
      <div class="texto-nivel">
        <span class="sobe">⬆ SUBIU DE NÍVEL ⬆</span>
        <strong>${nivel}</strong>
        <ul>${novidades.map((n, i) => `<li style="animation-delay:${1 + i * 0.25}s">${escapar(n)}</li>`).join("")}</ul>
        <small>clica para continuar</small>
      </div>
    </div>`);
  document.body.append(tela);
  chuvaDeEstrelas(60);
  const fechar = () => {
    tela.classList.add("saindo");
    setTimeout(() => tela.remove(), 400);
  };
  tela.addEventListener("click", fechar);
  setTimeout(fechar, 4500 + novidades.length * 400);
}

// Céu estrelado de fundo (fica atrás de tudo).
function criarCeu() {
  const ceu = document.getElementById("ceu");
  for (let i = 0; i < 90; i++) {
    const estrela = document.createElement("i");
    estrela.style.left = `${Math.random() * 100}%`;
    estrela.style.top = `${Math.random() * 100}%`;
    estrela.style.opacity = (0.3 + Math.random() * 0.7).toFixed(2);
    estrela.style.animationDelay = `${(Math.random() * 3).toFixed(2)}s`;
    if (Math.random() > 0.85) estrela.style.width = estrela.style.height = "3px";
    ceu.append(estrela);
  }
}

// ---------- início ----------

document.getElementById("btn-logo").addEventListener("click", () => {
  if (progresso.nome) proximoPasso();
});

// os ícones de pixel do HUD (moeda, árvore, pergaminho, mochila)
document.querySelectorAll("img[data-icone]").forEach((img) => { img.src = iconeRpg(img.dataset.icone); });
document.getElementById("btn-mochila").addEventListener("click", () => alternarMochila("itens"));
document.getElementById("btn-missoes").addEventListener("click", () => alternarMochila("missoes"));
document.getElementById("btn-arvore").addEventListener("click", alternarArvore);
document.getElementById("btn-curriculo").addEventListener("click", alternarCurriculo);
window.addEventListener("keydown", (e) => {
  if (e.target instanceof Element && e.target.closest("input, textarea")) return;
  if (e.key === "Escape") fecharMochila();
  if ((e.key === "k" || e.key === "K") && document.querySelector(".arvore-epica[open]")) return alternarArvore();
  if ((e.key === "c" || e.key === "C") && document.querySelector(".curriculo-heroi[open]")) return alternarCurriculo();
  if (document.querySelector("dialog[open]")) return;
  if (e.key === "i" || e.key === "I") alternarMochila();
  if (e.key === "j" || e.key === "J") alternarMochila("missoes");
  if (e.key === "k" || e.key === "K") abrirArvore();
  if ((e.key === "c" || e.key === "C") && document.body.classList.contains("modo-jogo")) abrirCurriculo();
});

// ---------- o Currículo do Herói (tecla C) ----------
// A ficha completa da vida do herói, como um livro de registros de RPG: à esquerda o retrato, nome,
// classe, nível e desde quando ele está na aventura; à direita o placar de batalha (com o anel de
// precisão), onde ele é mais forte (as trilhas por domínio, com a precisão de cada uma), o caminho
// (classe, degrau e o ponto de partida da aptidão), as conquistas, os monstros mais caçados e as escolhas
// que ele fez na história. Os números vêm do servidor (progresso.estatisticas, que conta desde a criação
// do placar; os saves antigos começam a contar dali).
let nomesDosMonstros = null;
function alternarCurriculo() {
  const painel = document.querySelector(".curriculo-heroi");
  if (painel?.open) painel.close();
  else abrirCurriculo();
}
async function abrirCurriculo() {
  if (!progresso?.nome) return;
  let painel = document.querySelector(".curriculo-heroi");
  if (!painel) {
    painel = document.createElement("dialog");
    painel.className = "curriculo-heroi";
    painel.setAttribute("aria-label", "Currículo do Herói");
    document.body.append(painel);
    painel.addEventListener("click", (e) => { if (e.target === painel) painel.close(); });
  }
  // o nome de cada monstro (para "os mais caçados"): vem uma vez do servidor
  if (!nomesDosMonstros) {
    try {
      nomesDosMonstros = Object.fromEntries(Object.entries(await api("/api/monstros")).map(([id, m]) => [id, m.nome]));
    } catch {
      nomesDosMonstros = {};
    }
  }
  const est = progresso.estatisticas || {};
  const acertos = est.acertos || 0;
  const erros = est.erros || 0;
  const total = acertos + erros;
  const precisao = total ? Math.round((acertos / total) * 100) : 0;
  const id = identidadeDaClasse();
  const principal = principalDoHeroi();
  const classe = classeDoHeroi();
  const caminho = caminhoDaClasse();
  const nivel = nivelDe(progresso.xp || 0);
  const desde = new Date((est.desde || progresso.inicioDoDia / 1000 || Date.now() / 1000) * 1000);
  const dataDesde = desde.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  // as trilhas por domínio (onde ele é mais forte), com a precisão de cada uma
  const trilhas = Object.keys(JORNADA.trilhas.trilhas).map(trilhaInfo).filter(Boolean)
    .map((t) => {
      const p = (est.porTrilha || {})[t.id] || { acertos: 0, erros: 0 };
      const feitas = p.acertos + p.erros;
      return { ...t, acertos: p.acertos, erros: p.erros, precisao: feitas ? Math.round((p.acertos / feitas) * 100) : null };
    })
    .sort((a, b) => b.pontos - a.pontos || b.acertos - a.acertos);
  const maiorDominio = Math.max(1, ...trilhas.map((t) => t.pontos));
  const forte = trilhas[0]?.pontos ? trilhas[0] : null;
  // os monstros mais caçados
  const cacados = Object.entries(est.porMonstro || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
  // as escolhas feitas na história
  const escolhas = (() => {
    try {
      const { principais, secundarias } = catalogoQuests();
      return [...principais, ...secundarias].filter((q) => q.escolha && escolhaFeita(q.escolha.id)).map((q) => {
        const opcao = q.escolha.opcoes.find((o) => o.id === escolhaFeita(q.escolha.id));
        return opcao ? { quest: q.titulo, icone: opcao.icone || "◆", texto: opcao.texto } : null;
      }).filter(Boolean);
    } catch {
      return [];
    }
  })();
  const perfil = progresso.trilha?.perfil;
  const NIVEIS_APTIDAO = ["Iniciante", "Já mexeu", "Experiente"];
  const skillsDominadas = (curriculoServidor?.skills || []).filter((s) => s.dominada).length;
  const conquistas = [
    ["📚", "Livros lidos", (progresso.livrosLidos || []).length],
    ["📜", "Quests concluídas", (progresso.quests?.concluidas || []).length],
    ["🏰", "Dungeons vencidas", Object.keys(progresso.dungeons || {}).length],
    ["🏆", "Troféus", (progresso.trofeus || []).length],
    ["💎", "Fragmentos da história", (progresso.fragmentos || []).length],
    ["🎓", "Provas aprovadas", (progresso.provas || []).length],
    ["🌳", "Talentos", (progresso.habilidades || []).length],
    ["✨", "Skills dominadas", skillsDominadas],
  ];
  const numero = (icone, rotulo, valor, classeExtra = "") => `<li class="${classeExtra}"><span>${icone}</span><b>${valor}</b><small>${rotulo}</small></li>`;

  painel.innerHTML = `
    <header class="topo-curriculo">
      <div class="faixa-logo"><span>Currículo do Herói</span></div>
      <button class="selo-fechar" type="button" data-fechar aria-label="Fechar" title="Fechar (C ou Esc)"><span>✕</span></button>
    </header>
    <div class="corpo-curriculo">
      <aside class="ficha-curriculo" style="--cor-classe:${id.cor}">
        <div class="retrato-curriculo"><img class="pixel" src="${heroiParado(progresso.avatar).toDataURL()}" alt=""></div>
        <strong class="nome-curriculo">${escapar(nomeAluno())}</strong>
        ${seloDoTitulo()}
        <span class="nivel-curriculo">Nível ${nivel}</span>
        <ul class="dados-curriculo">
          <li><span>⭐</span>XP<b>${progresso.xp || 0}</b></li>
          <li><span>🪙</span>Moedas<b>${progresso.moedas ?? 0}</b></li>
          <li><span>❤</span>Vida<b>${vidaAtual()} / ${vidaMaxima()}</b></li>
        </ul>
        <small class="desde-curriculo">Na aventura desde<br><b>${dataDesde}</b></small>
      </aside>
      <div class="paginas-curriculo">
        <section class="bloco-curriculo placar-curriculo">
          <h3>⚔️ Placar de batalha</h3>
          <div class="placar-linha">
            <div class="anel-precisao" style="--p:${precisao}">
              <b>${total ? `${precisao}%` : "—"}</b><small>precisão</small>
            </div>
            <ul class="numeros-curriculo">
              ${numero("✅", "acertos", acertos, "bom")}
              ${numero("❌", "erros", erros, "ruim")}
              ${numero("🔥", "maior sequência", est.maiorSequencia || 0)}
              ${numero("👾", "monstros derrotados", est.monstros || 0)}
              ${numero("👑", "chefões", (progresso.chefesDerrotados || []).length)}
              ${numero("💫", "desmaios", est.desmaios || 0)}
            </ul>
          </div>
        </section>
        <section class="bloco-curriculo">
          <h3>🎯 Onde tu és mais forte ${forte ? `<small>${forte.icone} ${escapar(forte.nome)} · ${escapar(forte.patente)}</small>` : ""}</h3>
          <ul class="trilhas-curriculo">
            ${trilhas.map((t) => `
              <li style="--cor-trilha:${t.cor || "#ffd166"}">
                <span class="icone-trilha">${t.icone}</span>
                <div class="corpo-trilha">
                  <b>${escapar(t.nome)} <i>${escapar(t.patente)}</i></b>
                  <div class="barra-trilha"><i style="width:${Math.round((t.pontos / maiorDominio) * 100)}%"></i></div>
                </div>
                <small>${t.precisao === null ? "—" : `${t.precisao}% de acerto`}<br>${t.acertos} ✓ · ${t.erros} ✗</small>
              </li>`).join("")}
          </ul>
        </section>
        <section class="bloco-curriculo">
          <h3>🧭 O caminho</h3>
          <ul class="caminho-curriculo">
            <li><span>${principal?.icone || "🌱"}</span><div><b>${escapar(principal?.titulo || "Ainda sem classe")}</b><small>classe principal</small></div></li>
            <li><span>${classe?.icone || "❔"}</span><div><b>${escapar(classe?.titulo || "Subclasse ainda não escolhida")}</b><small>${classe ? "subclasse" : `escolhe no nível ${JORNADA.caminho.nivel_escolha}`}</small></div></li>
            <li><span>🪜</span><div><b>${escapar(caminho?.titulo || id.titulo)}</b><small>degrau ${id.degrau || 0} do caminho</small></div></li>
            ${perfil ? `<li><span>🔮</span><div><b>IA: ${NIVEIS_APTIDAO[perfil.ia] || "—"} · Código: ${NIVEIS_APTIDAO[perfil.codigo] || "—"}</b><small>ponto de partida, pelo teste de aptidão</small></div></li>` : ""}
          </ul>
          ${progresso.trilha?.fala ? `<blockquote class="fala-zetsu">🧙 “${formatar(progresso.trilha.fala)}”</blockquote>` : ""}
        </section>
        <section class="bloco-curriculo">
          <h3>🏅 Conquistas</h3>
          <ul class="conquistas-curriculo">${conquistas.map(([icone, rotulo, valor]) => numero(icone, rotulo, valor)).join("")}</ul>
        </section>
        <div class="dupla-curriculo">
          <section class="bloco-curriculo">
            <h3>👾 Mais caçados</h3>
            ${cacados.length ? `<ol class="cacados-curriculo">${cacados.map(([tipo, n], i) => `<li><span>${["🥇", "🥈", "🥉"][i]}</span><b>${escapar(nomesDosMonstros[tipo] || tipo)}</b><i>×${n}</i></li>`).join("")}</ol>`
              : '<p class="vazio-curriculo">Nenhum monstro derrotado ainda (desde que o placar começou).</p>'}
          </section>
          <section class="bloco-curriculo">
            <h3>⚖️ Escolhas na história</h3>
            ${escolhas.length ? `<ul class="escolhas-curriculo">${escolhas.map((e) => `<li><span>${e.icone}</span><div><small>${escapar(e.quest)}</small><b>${escapar(e.texto)}</b></div></li>`).join("")}</ul>`
              : '<p class="vazio-curriculo">Nenhuma escolha feita ainda. Elas aparecem nas quests da história.</p>'}
          </section>
        </div>
      </div>
    </div>`;
  painel.querySelector("[data-fechar]").addEventListener("click", () => painel.close());
  if (!painel.open) {
    painel.showModal();
    Som.efeito("passar");
  }
}

// Nos mundos (Academia e Reino) o mapa ocupa a tela inteira e o topo vira o HUD por cima dele.
function atualizarModoMundo() {
  const noMundo = Boolean(tela.querySelector(".tela-mundo"));
  document.body.classList.toggle("modo-mundo", noMundo);
  // fora do mapa a barra de habilidades some (ela ficava presa embaixo da tela ao sair pelo Esc)
  const barra = document.getElementById("barra-habilidades");
  if (barra && !noMundo) barra.hidden = true;
  // "modo jogo": em qualquer tela de jogo o topo mostra o HUD novo (retrato, vida, mana e XP) no lugar da
  // faixa antiga; na tela inicial e na escolha do aventureiro o topo some
  // a criação do personagem (o Zetsu pedindo o nome, o criador, a classe e o teste de aptidão) também fica
  // sem HUD: o herói ainda está nascendo, e a faixa antiga de corações não pode aparecer
  const foraDoJogo = Boolean(tela.querySelector(".tela-saves, .tela-titulo, .abertura, .criacao-heroi, .aptidao:not(.derrota)"));
  document.body.classList.toggle("modo-jogo", Boolean(progresso?.nome) && !foraDoJogo);
  document.body.classList.toggle("fora-do-jogo", foraDoJogo);
  if (!foraDoJogo && progresso?.nome && typeof atualizarHud === "function" && JORNADA?.magias) atualizarHud();
  // durante uma aula na lousa o herói fica parado
  document.body.classList.toggle("em-aula", Boolean(tela.querySelector(".aula-na-sala")));
}
new MutationObserver(atualizarModoMundo).observe(tela, { childList: true });

function alternarTelaCheia() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
window.addEventListener("keydown", (e) => {
  if (e.key !== "f" && e.key !== "F") return;
  if (e.target instanceof Element && e.target.closest("input, textarea")) return;
  if (document.querySelector("dialog[open]")) return;
  alternarTelaCheia();
});

// O menu de pausa (tecla Esc): continuar, controles, som, tela cheia, voltar à Academia, história,
// como jogar, trocar de save e sair do jogo. Os botões do jogo inteiro fazem "clique".
const CONTROLES = [
  ["WASD / setas", "Andar (ou clica no chão)"],
  ["E", "Entrar, conversar, ler"],
  ["K", "Árvore Arcana (classe e habilidades)"],
  ["J", "Diário de missões"],
  ["I", "Mochila"],
  ["M", "Mapa do Reino (no Reino)"],
  ["F", "Tela cheia"],
  ["Esc", "Este menu"],
];

function abrirMenu(painel = "principal") {
  const menu = document.getElementById("menu-pausa");
  const noJogo = Boolean(progresso.nome && progresso.avatar);
  const v = Som.volumes();
  // as mesmas placas de pedra e ouro da tela inicial, com a gema que acende
  const botao = (acao, icone, texto, extra = "", sub = "") => `
    <button class="placa-titulo placa-menu ${extra}" type="button" data-menu="${acao}">
      <span class="gema-placa"></span><span class="icone-placa">${icone}</span>
      <span class="texto-placa"><b>${texto}</b>${sub ? `<small>${sub}</small>` : ""}</span>
    </button>`;
  menu.innerHTML = `
    <div class="menu-conteudo menu-epico">
      <header class="topo-menu">
        <img class="pixel" src="${iconeRpgIaDataUrl(6)}" alt="">
        <h2 data-texto="${painel === "controles" ? "Controles" : painel === "som" ? "Som" : "Pausa"}">${painel === "controles" ? "Controles" : painel === "som" ? "Som" : "Pausa"}</h2>
        <div class="faixa-logo"><span>Academia Arcana de Elyndor</span></div>
      </header>
      ${painel === "controles" ? `
        <ul class="lista-controles">${CONTROLES.map(([tecla, faz]) => `<li><kbd>${tecla}</kbd><span>${faz}</span></li>`).join("")}</ul>
        ${botao("principal", "◂", "Voltar", "botao-fantasma")}`
      : painel === "som" ? `
        <label class="volume">🎵 Música <input type="range" min="0" max="1" step="0.05" data-volume="musica" value="${v.musica}"></label>
        <label class="volume">💥 Efeitos <input type="range" min="0" max="1" step="0.05" data-volume="efeitos" value="${v.efeitos}"></label>
        <label class="volume">🌿 Ambiente <input type="range" min="0" max="1.5" step="0.05" data-volume="ambiente" value="${v.ambiente ?? 1}"></label>
        <label class="volume">💬 Velocidade do texto <input type="range" min="0.6" max="2.4" step="0.2" data-volume="velocidadeTexto" value="${v.velocidadeTexto || 1}"></label>
        <label class="mudo"><input type="checkbox" data-mudo ${v.mudo ? "checked" : ""}> Silenciar tudo</label>
        ${botao("principal", "◂", "Voltar", "botao-fantasma")}`
      : `
        <div class="corpo-menu">
        ${noJogo ? (() => {
          // a ficha do herói ao lado dos comandos, como nos menus de pausa dos RPGs
          const id = identidadeDaClasse();
          const mana = manaAgora();
          const recurso = temaDaClasse().grimorio;
          return `
            <aside class="ficha-menu" style="--cor-classe:${id.cor}">
              <div class="retrato-menu"><img class="pixel" src="${heroiParado(progresso.avatar).toDataURL()}" alt=""></div>
              <strong>${escapar(nomeAluno())}</strong>
              <small>${id.icone} ${escapar(id.titulo)}</small>
              <span class="nivel-menu">Nível ${nivelDe(progresso.xp || 0)}</span>
              <div class="barra-menu vida" title="Vida"><i style="width:${(vidaAtual() / vidaMaxima()) * 100}%"></i><span>❤ ${vidaAtual()} / ${vidaMaxima()}</span></div>
              <div class="barra-menu mana" title="${escapar(recurso.recurso)}"><i style="width:${(mana.atual / mana.maxima) * 100}%"></i><span>${recurso.recurso_icone} ${mana.atual} / ${mana.maxima}</span></div>
              <span class="moedas-menu">🪙 ${progresso.moedas ?? 0}</span>
            </aside>`;
        })() : ""}
        <div class="opcoes-menu">
          ${botao("continuar", "⚔️", "Continuar", "destaque", "Voltar para a aventura")}
          ${botao("controles", "🎮", "Controles", "", "Teclas e atalhos")}
          ${botao("som", v.mudo ? "🔇" : "🔊", "Som e volume", "", "Música e efeitos")}
          ${botao("tela-cheia", "⛶", document.fullscreenElement ? "Sair da tela cheia" : "Tela cheia", "", "Tecla F")}
          ${noJogo ? botao("academia", "🏰", "Voltar à Academia", "", "Pelo portal mágico") : ""}
          ${noJogo ? botao("historia", "📜", "A história de Elyndor", "", "O prólogo da Grande Ruptura") : ""}
          ${botao("como-jogar", "📘", "Como jogar", "", "O guia do aventureiro")}
          ${botao("saves", "💾", "Trocar de aventureiro", "", "Escolher outro save")}
          ${botao("sair", "🚪", "Sair do jogo", "sair", "Voltar ao menu inicial")}
        </div>
        </div>`}
    </div>`;
  const fechar = () => menu.close();
  const acoes = {
    continuar: fechar,
    principal: () => abrirMenu("principal"),
    controles: () => abrirMenu("controles"),
    som: () => abrirMenu("som"),
    "tela-cheia": () => { alternarTelaCheia(); setTimeout(() => menu.open && abrirMenu(), 200); },
    academia: () => { fechar(); irPara("academia"); },
    historia: () => { fechar(); telaPrologo(telaMapa, progresso.avatar); },
    "como-jogar": () => { fechar(); telaIntroducao(() => {}); },
    saves: () => { fechar(); salvarProgresso(); despedirSe(telaSaves); },
    sair: () => { fechar(); salvarProgresso(); despedirSe(voltarAoTitulo); },
  };
  menu.querySelectorAll("[data-menu]").forEach((b) => {
    b.addEventListener("click", () => acoes[b.dataset.menu]());
    b.addEventListener("mouseenter", () => b.focus({ preventScroll: true }));
  });
  // ↑ e ↓ andam pelas placas, como na tela inicial
  menu.onkeydown = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const placas = [...menu.querySelectorAll(".placa-menu")];
    if (!placas.length) return;
    e.preventDefault();
    const i = placas.indexOf(document.activeElement);
    placas[(i + (e.key === "ArrowDown" ? 1 : -1) + placas.length) % placas.length].focus();
    Som.efeito("clique");
  };
  menu.querySelectorAll("[data-volume]").forEach((faixa) => faixa.addEventListener("input", () => {
    Som.ajustar({ [faixa.dataset.volume]: Number(faixa.value), mudo: false });
    if (faixa.dataset.volume === "efeitos") Som.efeito("moeda");
    if (faixa.dataset.volume === "velocidadeTexto") Som.blip(1);
  }));
  menu.querySelector("[data-mudo]")?.addEventListener("change", (e) => Som.ajustar({ mudo: e.target.checked }));
  if (!menu.open) {
    menu.showModal();
    Som.efeito("passar");
  }
  menu.querySelector(".placa-menu")?.focus({ preventScroll: true });
}

function ligarMenu() {
  // clicar fora do cartão fecha o menu
  const menu = document.getElementById("menu-pausa");
  menu.addEventListener("click", (e) => { if (e.target === menu) menu.close(); });
  // no computador o menu abre com Esc; celular e tablet não têm Esc, então ganham um botão
  if (window.matchMedia("(pointer: coarse)").matches) {
    const botao = criar('<button class="botao botao-fantasma botao-mochila botao-menu" type="button" title="Menu">☰</button>');
    botao.addEventListener("click", () => abrirMenu());
    document.querySelector(".topo").append(botao);
  }
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (e.target instanceof Element && e.target.closest("input, textarea")) return;
    // Esc fecha primeiro o que estiver aberto por cima (mochila, árvore, diálogos, introdução, prólogo)
    if (document.querySelector(".inventario.aberto, .introducao, .prologo")) return;
    if (document.querySelector("dialog[open]:not(#menu-pausa)")) return;
    if (menu.open) return; // o próprio dialog fecha com Esc
    if (document.body.classList.contains("fora-do-jogo")) return; // na tela inicial e nos saves não tem pausa
    e.preventDefault();
    abrirMenu();
  }, { capture: true }); // antes do atalho que fecha a mochila, para não abrir o menu junto
  document.addEventListener("click", (e) => {
    if (e.target.closest(".botao, .fala-opcao, .amostra-estilo, .amostra-cor, .carta-kit, .slot, .abas-criador button")) Som.efeito("clique");
  });
}

async function iniciar() {
  ligarMenu();
  criarCeu();
  // o ícone do RPG IA é o logo do topo e o ícone da aba
  const icone = iconeRpgIaDataUrl();
  document.getElementById("logo-brasao").src = icone;
  document.getElementById("favicon").href = icone;
  // a abertura: a cena de carregamento com o herói da última partida (ou o padrão) enquanto chegam os
  // dados do jogo e as imagens do cenário do Reino (tileset e desenhos em 32 px)
  const abertura = abrirCarregamento({
    tema: "inicio", titulo: "Academia Arcana de Elyndor", sobretitulo: "RPG IA",
    icone: `<img src="${icone}" alt="">`, avatar: carregarProgresso().avatar,
  });
  const minimo = new Promise((resolver) => setTimeout(resolver, 1600));
  const [catalogo, curva, jornada] = await Promise.all([api("/api/itens"), api("/api/progressao"), api("/api/jornada"), migrarSaveAntigo(), carregarCenarioHD()]);
  await minimo;
  abertura.concluir();
  CATALOGO = catalogo;
  registrarVisuaisDoCatalogo();
  Object.assign(CURVA_XP, curva);
  JORNADA = jornada;
  progresso = progressoNovo();
  aplicarTema();
  atualizarStatus();
  try {
    iaAtiva = (await api("/api/ia/status")).ativa;
  } catch {
    iaAtiva = false;
  }
  // a tela inicial; em "Um Jogador": na primeira visita já cria o primeiro save e abre a história,
  // depois vai para a tela de saves
  voltarAoTitulo();
}

iniciar();
