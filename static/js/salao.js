// O multijogador no navegador: a conexão com o Salão (salao.py, por WebSocket), a tela do lobby-castelo
// (cenarioSalao, em lobby.js) e as janelas de lá: o chat de balão, o Quadro de Anotações, o cartão de cada
// jogador, os convites para duelo e o ranking da arena. Os duelos em si ficam em duelo.js.
//
// O navegador só mostra: quem está onde, o que cada um disse e quem ganhou, quem decide é o servidor.
// O herói é identificado pelo id do save (jogadorId), que só vai para o servidor; os outros jogadores
// são conhecidos pelo número da conexão (sid).
// Depende de app.js (progresso, jogadorId, api, criar, escapar, avisoFlutuante, falarCom, seloDoTitulo...),
// mundo.js (montarMundo) e lobby.js (cenarioSalao).

const SALAO = {
  ws: null, sid: null, assinatura: null, eu: null, modos: {},
  jogadores: new Map(), // sid -> o jogador como o servidor mandou
  estado: { recados: [], ranking: [], arena: [] }, // o que o mapa desenha (o quadro, os campeões, o placar)
  mundo: null, secao: null, intervalo: null, ultimoEnvio: "", saindo: false, tentativas: 0, semVolta: false,
  historico: [],
};
const CHAVE_SILENCIADOS = "academia-salao-silenciados";

function silenciadosNoSalao() {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHAVE_SILENCIADOS)) || []);
  } catch {
    return new Set();
  }
}
function alternarSilencio(nome) {
  const lista = silenciadosNoSalao();
  const chave = String(nome).toLowerCase();
  if (lista.has(chave)) lista.delete(chave);
  else lista.add(chave);
  try { localStorage.setItem(CHAVE_SILENCIADOS, JSON.stringify([...lista])); } catch {}
  return lista.has(chave);
}
const estaSilenciado = (nome) => silenciadosNoSalao().has(String(nome).toLowerCase());

// o selo do título de outro jogador (o mesmo do herói: a raridade cresce com o degrau da classe)
function seloDoJogador(j) {
  const c = j.classe || {};
  return `<span class="selo-titulo ${RARIDADE_DO_DEGRAU[c.degrau] || "comum"}">${c.icone || "🌱"} ${escapar(c.titulo || "Viajante")}</span>`;
}
function auraDoJogador(j) {
  const c = j.classe || {};
  return c.degrau ? { rgb: hexParaRgb(c.cor || "#a98bff").join(", "), degrau: c.degrau } : null;
}

function enviarSalao(mensagem) {
  if (SALAO.ws?.readyState === WebSocket.OPEN) SALAO.ws.send(JSON.stringify(mensagem));
}

// ---------- a tela do Salão ----------

// posicao: onde o herói aparece (ao trocar de roupa no Salão, ele volta no mesmo lugar)
async function telaSalao({ posicao = null } = {}) {
  if (!jogadorId || !progresso.nome || !progresso.avatar) {
    avisoFlutuante("🛡️", "Primeiro, teu herói", "Cria teu aventureiro no modo Um Jogador para entrar no Salão.");
    return voltarAoTitulo();
  }
  sairDoSalao(false);
  // ativo: o herói está no Salão (até ele escolher sair: o telaMapa do app.js devolve para cá)
  Object.assign(SALAO, { saindo: false, tentativas: 0, semVolta: false, sid: null, eu: null, historico: [], ativo: true });
  SALAO.jogadores = new Map();
  SALAO.estado = { recados: [], ranking: [], arena: [], casas: { placar: {} }, fenda: null, campeao: null };
  Som.musica("salao");
  window.scrollTo(0, 0);
  const secao = criar(`
    <section class="tela-mundo salao-multi">
      <div class="cabecalho-mapa">
        <div>
          <h2 class="titulo-pixel">Salão de Elyndor</h2>
          <p>O castelo dos aventureiros: conversa, deixa recados e desafia alguém na arena.</p>
        </div>
      </div>
      <div class="mapa-reino" data-mundo></div>
      <div class="hud-salao">
        <div class="placa-salao" data-placa>
          <b>🏰 Salão de Elyndor</b>
          <span data-online>abrindo os portões...</span>
          <button class="botao botao-fantasma" type="button" data-lista title="Quem está no salão">👥</button>
        </div>
        <div class="chat-salao">
          <ol class="historico-chat" data-historico aria-live="polite"></ol>
          <form class="linha-chat" data-form-chat autocomplete="off">
            <button class="canal-chat" type="button" data-canal title="Trocar o canal: quem está perto ou a tua Casa (Tab)">📢 Perto</button>
            <input type="text" maxlength="140" data-entrada placeholder="T para falar (do palanque, o salão inteiro ouve)" aria-label="Mensagem do chat">
            <button class="botao" type="submit">Falar</button>
          </form>
        </div>
        <div class="convites-salao" data-convites></div>
        <div class="conexao-salao" data-conexao hidden></div>
      </div>
    </section>`);
  tela.replaceChildren(secao);
  SALAO.secao = secao;
  atualizarModoMundo();
  const area = secao.querySelector("[data-mundo]");
  SALAO.mundo = montarMundo(area, cenarioSalao(SALAO.estado), {
    avatar: progresso.avatar,
    nomeHeroi: nomeAluno(),
    tituloHeroi: principalDoHeroi() ? seloDoTitulo() : "",
    aura: auraDoHeroi(),
    posicao,
    aoMover: () => {},
    aoEntrar: aoEntrarNoSalao,
    aoEncontro: () => {},
    aoGesto: (id) => enviarSalao({ t: "gesto", id }),
    aoClicarOutro: abrirCartaoDoJogador,
  });

  // o chat: T (ou clicar) abre, Enter fala, Esc sai
  const entrada = secao.querySelector("[data-entrada]");
  SALAO.canal = "perto";
  const botaoCanal = secao.querySelector("[data-canal]");
  const trocarCanal = () => {
    const casa = SALAO.eu?.casa && SALAO.casas?.[SALAO.eu.casa];
    if (SALAO.canal === "perto" && !casa) return avisoFlutuante("🛡️", "Sem Casa ainda", "Escolhe tua Casa no Distrito das Casas (ao sul do jardim) para conversar com ela de qualquer lugar.");
    SALAO.canal = SALAO.canal === "perto" ? "casa" : "perto";
    botaoCanal.textContent = SALAO.canal === "casa" ? `${casa.icone} Casa` : "📢 Perto";
    botaoCanal.classList.toggle("da-casa", SALAO.canal === "casa");
    botaoCanal.style.setProperty("--cor-casa", casa?.cor || "#a98bff");
  };
  botaoCanal.addEventListener("click", trocarCanal);
  secao.querySelector("[data-form-chat]").addEventListener("submit", (e) => {
    e.preventDefault();
    const texto = entrada.value.trim();
    if (texto) enviarSalao({ t: "falar", texto, canal: SALAO.canal });
    entrada.value = "";
    entrada.blur();
  });
  entrada.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      entrada.blur();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      trocarCanal();
    }
  });
  if (typeof ligarExtrasDoSalao === "function") ligarExtrasDoSalao(secao);
  secao.querySelector("[data-lista]").addEventListener("click", abrirListaDoSalao);
  const atalhos = (e) => {
    if (!secao.isConnected) return window.removeEventListener("keydown", atalhos);
    if (e.target instanceof Element && e.target.closest("input, textarea")) return;
    if (document.querySelector("dialog[open], .confirmacao-rpg")) return;
    if (e.key === "t" || e.key === "T" || e.key === "/") {
      e.preventDefault();
      entrada.focus();
    }
  };
  window.addEventListener("keydown", atalhos);
  // a posição do herói vai para o servidor até 10 vezes por segundo (só quando muda)
  SALAO.intervalo = setInterval(() => {
    if (!secao.isConnected) return sairDoSalao(false);
    const h = SALAO.mundo?.heroi;
    if (!h) return;
    SALAO.ultimaPosicao = { x: h.x, y: h.y };
    const agora = `${Math.round(h.x)},${Math.round(h.y)},${h.direcao},${h.andando ? 1 : 0}`;
    if (agora === SALAO.ultimoEnvio) return;
    SALAO.ultimoEnvio = agora;
    enviarSalao({ t: "mover", x: Math.round(h.x), y: Math.round(h.y), d: h.direcao, a: h.andando ? 1 : 0 });
  }, 100);
  conectarSalao();
}

function estadoDaConexao(texto) {
  const el = SALAO.secao?.querySelector("[data-conexao]");
  if (!el) return;
  el.hidden = !texto;
  el.textContent = texto || "";
}

async function conectarSalao() {
  let url;
  try {
    url = (await api("/api/salao")).url;
  } catch {
    estadoDaConexao("⚠️ Não deu para achar o Salão. Tenta de novo daqui a pouco.");
    return;
  }
  const endereco = url.startsWith("/") ? `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${url}` : url;
  let ws;
  try {
    ws = new WebSocket(endereco);
  } catch {
    estadoDaConexao("⚠️ O Salão está fechado agora.");
    return;
  }
  SALAO.ws = ws;
  ws.addEventListener("open", () => {
    const h = SALAO.mundo?.heroi;
    ws.send(JSON.stringify({ t: "entrar", id: jogadorId, x: h ? Math.round(h.x) : undefined, y: h ? Math.round(h.y) : undefined }));
  });
  ws.addEventListener("message", (e) => {
    let m;
    try {
      m = JSON.parse(e.data);
    } catch {
      return;
    }
    try {
      tratarMensagemDoSalao(m);
    } catch (erro) {
      console.error("[salao]", m?.t, erro);
    }
  });
  ws.addEventListener("close", () => {
    if (SALAO.ws !== ws || SALAO.saindo || !SALAO.secao?.isConnected) return;
    SALAO.sid = null;
    if (typeof DUELO !== "undefined") DUELO.conexaoCaiu?.();
    if (SALAO.semVolta) return;
    // caiu: tenta de novo (cada vez esperando um pouco mais)
    SALAO.tentativas += 1;
    const espera = Math.min(15, 2 ** SALAO.tentativas);
    estadoDaConexao(`📡 A conexão com o Salão caiu. Tentando de novo em ${espera} s...`);
    setTimeout(() => SALAO.secao?.isConnected && !SALAO.saindo && conectarSalao(), espera * 1000);
  });
}

function sairDoSalao(avisarServidor = true) {
  SALAO.saindo = true;
  clearInterval(SALAO.intervalo);
  SALAO.intervalo = null;
  if (SALAO.ws) {
    try {
      if (avisarServidor) SALAO.ws.close(1000, "saiu");
      else SALAO.ws.close();
    } catch {}
  }
  SALAO.ws = null;
  if (typeof DUELO !== "undefined") DUELO.fechar?.();
}

// ---------- o que chega do servidor ----------

function porNoMundo(j) {
  SALAO.jogadores.set(j.sid, j);
  if (!SALAO.mundo) return;
  const casa = j.casa && SALAO.casas?.[j.casa];
  const marcas = [casa ? casa.icone : "", j.campeao ? "👑" : "", j.duelando ? "⚔️" : "", j.naFenda ? "🌀" : ""].join("");
  SALAO.mundo.outros.por(j.sid, {
    avatar: j.avatar, nome: j.nome, tituloHtml: seloDoJogador(j),
    // o Campeão da Semana anda com a aura dourada
    aura: j.campeao ? { rgb: "255, 209, 102", degrau: 4 } : auraDoJogador(j),
    x: j.x, y: j.y, direcao: j.d, marca: marcas,
  });
}

function marcarRecados(lista) {
  return lista.map((r) => ({ ...r, meu: r.dono === SALAO.assinatura }));
}

function contarOnline() {
  const el = SALAO.secao?.querySelector("[data-online]");
  if (el) el.textContent = `${SALAO.jogadores.size + 1} aventureiro${SALAO.jogadores.size ? "s" : ""} no castelo`;
}

function linhaNoChat(html, classe = "") {
  const lista = SALAO.secao?.querySelector("[data-historico]");
  if (!lista) return;
  const li = document.createElement("li");
  li.className = classe;
  li.innerHTML = html;
  lista.append(li);
  while (lista.children.length > 6) lista.firstElementChild.remove();
  // as linhas velhas vão apagando sozinhas (o CSS cuida do fade)
  setTimeout(() => li.classList.add("antiga"), 15000);
}

const TRATADORES_DO_SALAO = {
  ola(m) {
    SALAO.sid = m.voce;
    SALAO.assinatura = m.assinatura;
    SALAO.eu = m.eu;
    SALAO.modos = m.modos || {};
    SALAO.tentativas = 0;
    estadoDaConexao("");
    // numa volta depois de cair, quem estava na tela sai e entra de novo
    [...SALAO.jogadores.keys()].forEach((sid) => SALAO.mundo?.outros.tirar(sid));
    SALAO.jogadores.clear();
    // as Casas, a Taça, o Campeão e os eventos que já estão rolando (antes de pôr os jogadores no mapa:
    // o ícone da Casa vai junto do nome)
    SALAO.casas = m.casas || {};
    SALAO.trocarCasaDias = m.trocarCasaDias;
    SALAO.estado.casas = { placar: m.placarCasas || {} };
    SALAO.estado.campeao = m.campeao || null;
    SALAO.estado.fenda = m.fenda || null;
    m.jogadores.forEach(porNoMundo);
    SALAO.estado.recados = marcarRecados(m.mural || []);
    SALAO.estado.arena = m.arena || [];
    contarOnline();
    enviarSalao({ t: "ranking" });
    linhaNoChat(`✨ Bem-vindo ao Salão, <b>${escapar(nomeAluno())}</b>! <small>T para falar · Tab troca o canal · G para gestos · P para o modo foto</small>`, "sistema");
    if (m.dragao && typeof mostrarPerguntaDoDragao === "function") mostrarPerguntaDoDragao(m.dragao);
    // quem ainda não tem Casa escolhe uma (dá para fechar e escolher depois, no Distrito das Casas)
    if (!m.eu?.casa && typeof escolherCasa === "function" && !SALAO.jaPerguntouCasa) {
      SALAO.jaPerguntouCasa = true;
      setTimeout(() => SALAO.secao?.isConnected && !document.querySelector("dialog[open]") && escolherCasa(), 1800);
    }
  },
  casas(m) {
    SALAO.estado.casas.placar = m.placar;
    if (typeof atualizarJanelaDasCasas === "function") atualizarJanelaDasCasas();
  },
  casa_escolhida(m) {
    SALAO.eu = { ...SALAO.eu, casa: m.casa };
    document.getElementById("janela-salao")?.close();
    Som.efeito("evolucao");
    if (typeof chuvaDeEstrelas === "function") chuvaDeEstrelas(30);
  },
  casa_info(m) {
    if (typeof mostrarSalaoDaCasa === "function") mostrarSalaoDaCasa(m);
  },
  premio(m) {
    mostrarPremio(m.titulo, m.ganhos);
  },
  campeao(m) {
    SALAO.estado.campeao = m.campeao;
  },
  fenda(m) {
    SALAO.estado.fenda = m.fenda;
    if (typeof FENDA !== "undefined") FENDA.estadoGeral(m.fenda);
  },
  dragao_chega(m) {
    if (typeof dragaoChegando === "function") dragaoChegando(m);
  },
  dragao_pergunta(m) {
    if (typeof mostrarPerguntaDoDragao === "function") mostrarPerguntaDoDragao(m);
  },
  dragao_resposta(m) {
    if (typeof respostaDoDragao === "function") respostaDoDragao(m);
  },
  dragao_fim(m) {
    if (typeof fimDoDragao === "function") fimDoDragao(m);
  },
  arena_pergunta(m) {
    if (typeof palpiteDaPlateia === "function") palpiteDaPlateia(m);
  },
  arena_resultado(m) {
    if (typeof resultadoParaPlateia === "function") resultadoParaPlateia(m);
  },
  entrou(m) {
    porNoMundo(m.jogador);
    contarOnline();
    linhaNoChat(`👋 <b>${escapar(m.jogador.nome)}</b> chegou ao salão.`, "sistema");
  },
  saiu(m) {
    const j = SALAO.jogadores.get(m.sid);
    SALAO.jogadores.delete(m.sid);
    SALAO.mundo?.outros.tirar(m.sid);
    contarOnline();
    if (j) linhaNoChat(`🚪 ${escapar(j.nome)} saiu.`, "sistema");
    document.querySelector(`.convite-salao[data-de="${m.sid}"]`)?.remove();
  },
  pos(m) {
    m.p.forEach(([sid, x, y, d, a]) => {
      if (sid === SALAO.sid) return;
      const j = SALAO.jogadores.get(sid);
      if (j) Object.assign(j, { x, y, d, a });
      SALAO.mundo?.outros.mover(sid, x, y, d, a);
    });
  },
  gesto(m) {
    SALAO.mundo?.outros.gesto(m.sid, m.id);
  },
  fala(m) {
    if (m.sid !== SALAO.sid && estaSilenciado(m.nome)) return;
    // o canal da Casa vai só para o histórico (sem balão: quem fala pode estar do outro lado do castelo)
    if (m.canal === "casa") {
      const casa = SALAO.casas?.[m.casa];
      linhaNoChat(`<span class="tag-casa" style="--cor-casa:${casa?.cor || "#a98bff"}">${casa?.icone || "🛡️"} Casa</span> <a href="#" data-sid="${m.sid}">${escapar(m.nome)}</a>: ${escapar(m.texto)}`, "da-casa");
      return;
    }
    if (m.sid === SALAO.sid) SALAO.mundo?.falar(m.texto, { palanque: m.palanque });
    else SALAO.mundo?.outros.falar(m.sid, m.texto, { palanque: m.palanque });
    linhaNoChat(`${m.palanque ? "📣 " : ""}<a href="#" data-sid="${m.sid}">${escapar(m.nome)}</a>: ${escapar(m.texto)}`, m.palanque ? "palanque" : "");
  },
  perfil(m) {
    if (m.jogador.sid === SALAO.sid) SALAO.eu = m.jogador;
    else porNoMundo(m.jogador);
  },
  aviso(m) {
    avisoFlutuante(m.icone || "⚠️", m.texto, "");
  },
  erro(m) {
    SALAO.semVolta = true;
    estadoDaConexao(`⚠️ ${m.texto}`);
    avisoFlutuante("⚠️", "Salão", m.texto);
  },
  mural(m) {
    SALAO.estado.recados = marcarRecados(m.recados);
    atualizarQuadroAberto();
  },
  recado_novo(m) {
    SALAO.estado.recados = [{ ...marcarRecados([m.recado])[0], chegouEm: Date.now() }, ...SALAO.estado.recados.filter((r) => r.id !== m.recado.id)];
    atualizarQuadroAberto();
    linhaNoChat(`📌 <b>${escapar(m.recado.nome)}</b> pregou um recado no Quadro de Anotações.`, "sistema");
  },
  recado_fora(m) {
    SALAO.estado.recados = SALAO.estado.recados.filter((r) => r.id !== m.id);
    atualizarQuadroAberto();
  },
  ranking(m) {
    SALAO.estado.ranking = m.lista;
    SALAO.estado.liga = m.liga || [];
    if (m.campeao !== undefined) SALAO.estado.campeao = m.campeao;
    const aberto = document.querySelector("#janela-salao[open] [data-ranking]");
    if (aberto) aberto.innerHTML = htmlDoRanking();
  },
  convite: mostrarConvite,
  convite_fim(m) {
    document.querySelector(`.convite-salao[data-de="${m.de}"]`)?.remove();
  },
  arena(m) {
    SALAO.estado.arena = m.duelos;
    // a marquinha de espadas em quem está duelando
    const duelando = new Set(m.duelos.flatMap((d) => [d.a.sid, d.b.sid]));
    SALAO.jogadores.forEach((j) => {
      if (Boolean(j.duelando) !== duelando.has(j.sid)) porNoMundo({ ...j, duelando: duelando.has(j.sid) });
    });
  },
  anuncio(m) {
    linhaNoChat(`${m.icone || "📣"} ${escapar(m.texto)}`, "anuncio");
  },
};

function tratarMensagemDoSalao(m) {
  if (typeof m?.t !== "string") return;
  if (m.t.startsWith("duelo_")) return typeof DUELO !== "undefined" && DUELO.receber(m);
  if (m.t.startsWith("fenda_")) return typeof FENDA !== "undefined" && FENDA.receber(m);
  TRATADORES_DO_SALAO[m.t]?.(m);
}

// clicar no nome de alguém no chat abre o cartão dele
document.addEventListener("click", (e) => {
  const link = e.target.closest?.(".historico-chat a[data-sid]");
  if (!link) return;
  e.preventDefault();
  abrirCartaoDoJogador(Number(link.dataset.sid));
});

// ---------- as janelas do Salão ----------

function janelaDoSalao(html, classe = "") {
  let janela = document.getElementById("janela-salao");
  if (!janela) {
    janela = document.createElement("dialog");
    janela.id = "janela-salao";
    janela.className = "modal janela-salao";
    janela.addEventListener("click", (e) => { if (e.target === janela) janela.close(); });
    document.body.append(janela);
  }
  janela.className = `modal janela-salao ${classe}`;
  janela.innerHTML = `<button class="fechar-janela-salao" type="button" data-fechar aria-label="Fechar">✕</button>${html}`;
  janela.querySelector("[data-fechar]").addEventListener("click", () => janela.close());
  if (!janela.open) janela.showModal();
  Som.efeito("passar");
  return janela;
}

function aoEntrarNoSalao(lugar) {
  if (lugar.id === "quadro") return abrirQuadroDoSalao();
  if (lugar.id === "taca") return abrirTacaDasCasas();
  if (lugar.id.startsWith("arauto-")) return enviarSalao({ t: "casa_info", casa: lugar.casa });
  if (lugar.id === "altar-fenda") return abrirAltarDaFenda();
  if (lugar.id === "oraculo-dia") return abrirDesafioDoDia();
  if (lugar.id === "campeoes") {
    enviarSalao({ t: "ranking" });
    return abrirCampeoes();
  }
  if (lugar.id === "palanque") {
    return avisoFlutuante("📣", "O Palanque", "Daqui de cima, tua fala chega ao salão inteiro. Aperta T e fala (com educação: todo mundo ouve)!");
  }
  if (lugar.id === "mestre") {
    const livres = [...SALAO.jogadores.values()].filter((j) => !j.duelando).length;
    return falarCom(MESTRE_DA_ARENA.nome, MESTRE_DA_ARENA.visual,
      `Bem-vindo à arena, ${nomeAluno()}! Aqui se duela com **saber**, não com espada. Três modos: o **X1 de perguntas** (5, 10 ou 20, ganha quem somar mais pontos: acertar rápido vale mais), o **Até um cair** (uma torre de monstros-pergunta, cada erro tira um coração) e as **Perguntas dos jogadores** (cada um escreve as suas e o outro tem que acertar). ${livres ? `Há **${livres}** aventureiro${livres > 1 ? "s" : ""} livre${livres > 1 ? "s" : ""} para um duelo agora.` : "Ainda não chegou ninguém para duelar. Chama um amigo!"}`,
      [{ texto: "⚔️ Escolher oponente", acao: abrirListaDoSalao }]);
  }
  if (lugar.id === "saida") {
    return confirmarRPG({ titulo: "Sair do Salão?", texto: "Tu voltas para o menu inicial. Teus recados ficam no quadro.", icone: "🚪", confirmar: "Sair", cancelar: "Ficar" })
      .then((sim) => {
        if (!sim) return;
        SALAO.ativo = false;
        sairDoSalao(true);
        despedirSe(voltarAoTitulo);
      });
  }
  return null;
}

// O cartão de um jogador: retrato, título, nível, o placar de duelos e o que dá para fazer com ele.
function abrirCartaoDoJogador(sid) {
  const j = SALAO.jogadores.get(sid);
  if (!j) return;
  const silenciado = estaSilenciado(j.nome);
  const d = j.duelos || {};
  const janela = janelaDoSalao(`
    <div class="cartao-jogador">
      <div class="retrato-cartao"><img class="pixel" src="${heroiParado(j.avatar || {}).toDataURL()}" alt=""></div>
      <strong>${escapar(j.nome)}</strong>
      ${seloDoJogador(j)}
      <span class="nivel-cartao">Nível ${j.nivel || 1} · ${j.acertos || 0} acertos na jornada</span>
      <ul class="placar-cartao">
        <li><b>${d.vitorias || 0}</b><small>vitórias</small></li>
        <li><b>${d.derrotas || 0}</b><small>derrotas</small></li>
        <li><b>${d.empates || 0}</b><small>empates</small></li>
      </ul>
      ${j.duelando ? '<p class="aviso-cartao">⚔️ Está duelando agora na arena.</p>' : ""}
      <div class="acoes-cartao">
        <button class="botao" type="button" data-desafiar ${j.duelando ? "disabled" : ""}>⚔️ Desafiar</button>
        <button class="botao botao-fantasma" type="button" data-acenar>👋 Acenar</button>
        <button class="botao botao-fantasma" type="button" data-silenciar>${silenciado ? "🔊 Ouvir de novo" : "🔇 Silenciar"}</button>
        <button class="botao botao-fantasma perigo" type="button" data-denunciar>🚩 Denunciar</button>
      </div>
    </div>`, "estreita");
  janela.querySelector("[data-desafiar]").addEventListener("click", () => escolherModoDeDuelo(sid));
  janela.querySelector("[data-acenar]").addEventListener("click", () => {
    janela.close();
    SALAO.mundo.heroi.gesto = { id: "acenar", icone: "👋", nome: "Acenar", dura: 1.8, inicio: null };
    enviarSalao({ t: "gesto", id: "acenar" });
  });
  janela.querySelector("[data-silenciar]").addEventListener("click", () => {
    const agora = alternarSilencio(j.nome);
    avisoFlutuante(agora ? "🔇" : "🔊", agora ? `${j.nome} silenciado` : `${j.nome} pode falar contigo de novo`, agora ? "Tu não vês mais os balões dessa pessoa (só tu)." : "");
    janela.close();
  });
  janela.querySelector("[data-denunciar]").addEventListener("click", async () => {
    janela.close();
    const sim = await confirmarRPG({
      titulo: `Denunciar ${j.nome}?`, icone: "🚩", perigo: true, confirmar: "Denunciar", cancelar: "Cancelar",
      texto: "As últimas falas dessa pessoa vão para a moderação. Com várias denúncias, ela fica sem falar por um tempo.",
    });
    if (sim) enviarSalao({ t: "denunciar_jogador", sid });
  });
}

// quem está no salão agora (e quem está livre para um duelo)
function abrirListaDoSalao() {
  const lista = [...SALAO.jogadores.values()].sort((a, b) => Number(a.duelando) - Number(b.duelando) || a.nome.localeCompare(b.nome));
  const janela = janelaDoSalao(`
    <header class="topo-janela-salao"><h2>👥 No castelo agora</h2><p>${lista.length ? "Clica em alguém para ver o cartão ou desafiar." : "Só tu por enquanto. Chama os amigos: o Salão fica no menu inicial, em Multijogador."}</p></header>
    <ul class="lista-salao">
      ${lista.map((j) => `
        <li>
          <img class="pixel" src="${heroiParado(j.avatar || {}).toDataURL()}" alt="">
          <div><b>${escapar(j.nome)}</b>${seloDoJogador(j)}<small>Nível ${j.nivel || 1} · ${(j.duelos || {}).vitorias || 0} vitórias</small></div>
          ${j.duelando ? '<span class="ocupado">⚔️ duelando</span>' : `<button class="botao" type="button" data-desafiar="${j.sid}">Desafiar</button>`}
          <button class="botao botao-fantasma" type="button" data-cartao="${j.sid}">Cartão</button>
        </li>`).join("")}
    </ul>`);
  janela.querySelectorAll("[data-desafiar]").forEach((b) => b.addEventListener("click", () => escolherModoDeDuelo(Number(b.dataset.desafiar))));
  janela.querySelectorAll("[data-cartao]").forEach((b) => b.addEventListener("click", () => abrirCartaoDoJogador(Number(b.dataset.cartao))));
}

const MODOS_DE_DUELO = [
  { id: "x1", icone: "⚡", nome: "X1 de perguntas", texto: "As mesmas perguntas para os dois, ao mesmo tempo. Acertar vale 100, e a rapidez dá até 50 a mais.", rodadas: [5, 10, 20], rotulo: (n) => `${n} perguntas` },
  { id: "queda", icone: "💀", nome: "Até um cair", texto: "Uma torre de monstros-pergunta, cada vez mais difícil. Cada erro tira 1 de 3 corações. Perde quem cair primeiro.", rodadas: [0], rotulo: () => "Encarar a torre" },
  { id: "autoral", icone: "✍️", nome: "Perguntas dos jogadores", texto: "Cada um escreve as suas perguntas (com a resposta certa), e o outro tem que acertar. Vale caprichar!", rodadas: [3, 5], rotulo: (n) => `${n} perguntas cada` },
];

function escolherModoDeDuelo(sid) {
  const j = SALAO.jogadores.get(sid);
  if (!j) return;
  const janela = janelaDoSalao(`
    <header class="topo-janela-salao"><h2>⚔️ Duelo contra ${escapar(j.nome)}</h2><p>Escolhe as regras. ${escapar(j.nome)} recebe o convite e tem 30 segundos para aceitar.</p></header>
    <div class="modos-duelo">
      ${MODOS_DE_DUELO.map((m) => `
        <article class="modo-duelo">
          <span class="icone-modo">${m.icone}</span>
          <h3>${m.nome}</h3>
          <p>${m.texto}</p>
          <div>${m.rodadas.map((n) => `<button class="botao" type="button" data-modo="${m.id}" data-rodadas="${n}">${m.rotulo(n)}</button>`).join("")}</div>
        </article>`).join("")}
    </div>`);
  janela.querySelectorAll("[data-modo]").forEach((b) => b.addEventListener("click", () => {
    enviarSalao({ t: "desafiar", sid, modo: b.dataset.modo, rodadas: Number(b.dataset.rodadas) });
    janela.close();
  }));
}

function nomeDoModo(modo, rodadas) {
  const m = MODOS_DE_DUELO.find((x) => x.id === modo);
  return m ? `${m.icone} ${m.nome}${rodadas ? ` (${m.rotulo(rodadas)})` : ""}` : modo;
}

// O convite que chega: aceitar ou recusar antes da barrinha acabar
function mostrarConvite(m) {
  const caixa = SALAO.secao?.querySelector("[data-convites]");
  if (!caixa) return;
  caixa.querySelector(`[data-de="${m.de}"]`)?.remove();
  const el = criar(`
    <div class="convite-salao" data-de="${m.de}" style="--duracao:${m.segundos}s">
      <span class="icone-convite">⚔️</span>
      <div>
        <b>${escapar(m.nome)} te desafia!</b>
        <small>${nomeDoModo(m.modo, m.rodadas)}</small>
        <i class="tempo-convite"></i>
      </div>
      <button class="botao" type="button" data-aceitar>Aceitar</button>
      <button class="botao botao-fantasma" type="button" data-recusar>Recusar</button>
    </div>`);
  const responder = (aceitar) => {
    enviarSalao({ t: "responder_convite", de: m.de, aceitar });
    el.remove();
  };
  el.querySelector("[data-aceitar]").addEventListener("click", () => responder(true));
  el.querySelector("[data-recusar]").addEventListener("click", () => responder(false));
  setTimeout(() => el.remove(), m.segundos * 1000);
  caixa.append(el);
  Som.efeito("evolucao");
}

// ---------- o Quadro de Anotações ----------

function tempoAtras(iso) {
  const segundos = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (segundos < 60) return "agora";
  if (segundos < 3600) return `há ${Math.round(segundos / 60)} min`;
  if (segundos < 86400) return `há ${Math.round(segundos / 3600)} h`;
  return `há ${Math.round(segundos / 86400)} dia${segundos >= 172800 ? "s" : ""}`;
}

function htmlDosRecados() {
  const lista = SALAO.estado.recados;
  if (!lista.length) return '<p class="vazio-quadro">O quadro está vazio. Prega o primeiro recado: um convite para estudar, uma dica, um “bora duelar?”...</p>';
  return lista.map((r) => `
    <article class="recado-salao cor-${escapar(r.cor)} ${r.meu ? "meu" : ""}">
      <header><b>${escapar(r.nome)}</b><small>${tempoAtras(r.quando)}</small></header>
      <p>${escapar(r.texto)}</p>
      <footer>${r.meu ? `<button type="button" data-tirar="${r.id}">🗑️ Tirar</button>` : `<button type="button" data-denunciar-recado="${r.id}">🚩 Denunciar</button>`}</footer>
    </article>`).join("");
}

function ligarRecados(janela) {
  janela.querySelectorAll("[data-tirar]").forEach((b) => b.addEventListener("click", () => enviarSalao({ t: "apagar_recado", id: Number(b.dataset.tirar) })));
  janela.querySelectorAll("[data-denunciar-recado]").forEach((b) => b.addEventListener("click", async () => {
    const sim = await confirmarRPG({ titulo: "Denunciar este recado?", texto: "Com 3 denúncias de pessoas diferentes, ele sai do quadro.", icone: "🚩", perigo: true, confirmar: "Denunciar" });
    if (sim) enviarSalao({ t: "denunciar_recado", id: Number(b.dataset.denunciarRecado) });
  }));
}

function atualizarQuadroAberto() {
  const lista = document.querySelector("#janela-salao[open] [data-recados]");
  if (!lista) return;
  lista.innerHTML = htmlDosRecados();
  ligarRecados(lista);
}

function abrirQuadroDoSalao() {
  const cores = Object.keys(CORES_DOS_RECADOS);
  const janela = janelaDoSalao(`
    <header class="topo-janela-salao"><h2>📌 Quadro de Anotações</h2><p>Recados para todo o salão. Somem sozinhos em 7 dias. Nada de contato, link ou ofensa: o quadro é de todos.</p></header>
    <form class="novo-recado" data-novo-recado>
      <textarea maxlength="280" rows="3" placeholder="Escreve teu recado (até 280 letras)..." data-texto-recado></textarea>
      <div class="linha-recado">
        <div class="cores-recado">${cores.map((c, i) => `<label class="cor-${c}"><input type="radio" name="cor-recado" value="${c}" ${i ? "" : "checked"}><span></span></label>`).join("")}</div>
        <small data-contador>0 / 280</small>
        <button class="botao" type="submit">📌 Pregar no quadro</button>
      </div>
    </form>
    <div class="recados-salao" data-recados>${htmlDosRecados()}</div>`, "larga");
  ligarRecados(janela);
  const texto = janela.querySelector("[data-texto-recado]");
  texto.addEventListener("input", () => { janela.querySelector("[data-contador]").textContent = `${texto.value.length} / 280`; });
  janela.querySelector("[data-novo-recado]").addEventListener("submit", (e) => {
    e.preventDefault();
    const valor = texto.value.trim();
    if (!valor) return;
    enviarSalao({ t: "recado", texto: valor, cor: janela.querySelector("input[name=cor-recado]:checked")?.value });
    texto.value = "";
    janela.querySelector("[data-contador]").textContent = "0 / 280";
  });
  texto.focus();
}

// ---------- os campeões da arena ----------

function htmlDoRanking() {
  const lista = SALAO.estado.ranking || [];
  if (!lista.length) return '<p class="vazio-quadro">Ninguém venceu um duelo neste mês ainda. O primeiro lugar está esperando por ti!</p>';
  return `<ol class="ranking-salao">${lista.map((c, i) => `<li class="${i < 3 ? `pos-${i + 1}` : ""}"><span>${["🥇", "🥈", "🥉"][i] || `${i + 1}º`}</span><b>${escapar(c.nome)}</b><small>${c.vitorias} vitória${c.vitorias > 1 ? "s" : ""}</small></li>`).join("")}</ol>`;
}

function abrirCampeoes() {
  const d = SALAO.eu?.duelos || {};
  const c = SALAO.estado.campeao;
  const liga = SALAO.estado.liga || [];
  janelaDoSalao(`
    <header class="topo-janela-salao"><h2>🏆 Campeões da Arena</h2><p>A Liga da Semana (de segunda a domingo) e os últimos 30 dias.</p></header>
    ${c ? `<div class="campeao-semana"><img class="pixel" src="${heroiParado(c.avatar || {}).toDataURL()}" alt=""><div><small>👑 Campeão da semana passada</small><b>${escapar(c.nome)}</b><span>${c.vitorias} vitórias · veste o Manto do Campeão e a aura dourada</span></div></div>` : ""}
    <h3 class="titulo-lista-salao">⚔️ Liga desta semana</h3>
    ${liga.length ? `<ol class="ranking-salao">${liga.map((r, i) => `<li class="${i < 3 ? `pos-${i + 1}` : ""}"><span>${["🥇", "🥈", "🥉"][i] || `${i + 1}º`}</span><b>${escapar(r.nome)}</b><small>${r.vitorias} vitória${r.vitorias > 1 ? "s" : ""}</small></li>`).join("")}</ol>` : '<p class="vazio-quadro">Ninguém venceu esta semana ainda. Quem vencer mais até domingo vira o Campeão!</p>'}
    <h3 class="titulo-lista-salao">🏛️ Últimos 30 dias (o pódio)</h3>
    <div data-ranking>${htmlDoRanking()}</div>
    <p class="meu-placar">Teu placar: <b>${d.vitorias || 0}</b> vitórias · <b>${d.derrotas || 0}</b> derrotas · <b>${d.empates || 0}</b> empates</p>`, "estreita");
}
