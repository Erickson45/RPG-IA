// A história principal e as quests dos moradores, do lado do jogo: quem dá quest no mapa ganha um "!"
// (tem quest para ti) ou um "?" (volta aqui que já dá para entregar); falar com o morador abre a carta
// da quest para aceitar ou entregar; um rastreador no canto mostra o que fazer agora; o diário (J) lista
// tudo. Quem confere as regras e paga é o servidor (quests.py); aqui só se espelha o que ele manda.
// Depende de app.js (progresso, JORNADA, acaoJogador, falarCom...) e de reino.js (HABITANTES, CIDADES).

function catalogoQuests() {
  const h = JORNADA.historia || { principais: [], secundarias: [], capitulos: [] };
  return {
    principais: h.principais.map((q) => ({ ...q, tipo: "principal" })),
    secundarias: h.secundarias.map((q) => ({ ...q, tipo: "secundaria" })),
    capitulos: h.capitulos,
  };
}

function questPorId(id) {
  const { principais, secundarias } = catalogoQuests();
  return [...principais, ...secundarias].find((q) => q.id === id);
}

function estadoQuests() {
  return progresso.quests || { ativas: {}, concluidas: [] };
}

// as quests ativas, com o andamento de cada objetivo
function questsAtivas() {
  return Object.entries(estadoQuests().ativas || {}).map(([id, andamento]) => {
    const quest = questPorId(id);
    if (!quest) return null;
    const feito = quest.objetivos.map((o, i) => Math.min(andamento.feito?.[i] || 0, o.alvo));
    return { ...quest, feito, completa: quest.objetivos.every((o, i) => feito[i] >= o.alvo) };
  }).filter(Boolean);
}

// a mesma regra do servidor: a próxima da história (com o nível) e as secundárias liberadas
function questsDisponiveis() {
  const { principais, secundarias } = catalogoQuests();
  const { ativas = {}, concluidas = [] } = estadoQuests();
  const nivel = nivelDe(progresso.xp || 0);
  const lista = [];
  const proxima = principais.find((q) => !concluidas.includes(q.id));
  // as de Umbraterra só saem no último degrau da subclasse (o servidor confere igual)
  const noMundo = (q) => q.mundo !== "umbra" || (typeof umbraLiberada === "function" && umbraLiberada());
  if (proxima && !ativas[proxima.id] && nivel >= (proxima.nivel || 1) && noMundo(proxima)) lista.push(proxima);
  secundarias.forEach((q) => {
    if (concluidas.includes(q.id) || ativas[q.id] || nivel < (q.nivel || 1)) return;
    if (q.requer && !concluidas.includes(q.requer)) return;
    lista.push(q);
  });
  return lista;
}

// o que um morador tem para o herói: "entregar" (quest dele pronta), "oferta" (quest nova) ou "andamento"
function questDoMorador(npc) {
  const ativas = questsAtivas().filter((q) => q.npc === npc);
  const pronta = ativas.find((q) => q.completa);
  if (pronta) return { estado: "entregar", quest: pronta };
  const oferta = questsDisponiveis().find((q) => q.npc === npc);
  if (oferta) return { estado: "oferta", quest: oferta };
  if (ativas.length) return { estado: "andamento", quest: ativas[0] };
  return null;
}

// para o mapa e o minimapa: "!" dourado na história, "!" azul nas secundárias, "?" para entregar
function estadoQuestNpc(npc) {
  if (!progresso?.nome || !JORNADA?.historia) return null;
  const q = questDoMorador(npc);
  if (!q || q.estado === "andamento") return null;
  return { marca: q.estado === "entregar" ? "?" : "!", principal: q.quest.tipo === "principal" };
}

const nomeDoMorador = (npc) => [...(typeof HABITANTES !== "undefined" ? HABITANTES : []), ...(typeof HABITANTES_UMBRA !== "undefined" ? HABITANTES_UMBRA : [])]
  .find((h) => h.id === npc)?.nome || npc;

// a recompensa de uma quest, em linhas com ícone (o visual por classe mostra o da classe do herói)
function recompensaQuestHtml(r) {
  const linhas = [];
  if (r.moedas) linhas.push(`<li><span>🪙</span>${r.moedas} moedas</li>`);
  if (r.xp) linhas.push(`<li><span>⭐</span>${r.xp} XP</li>`);
  Object.entries(r.itens || {}).forEach(([id, qtd]) => {
    const item = itemDoCatalogo(id);
    linhas.push(`<li><span>${item?.icone || "🎁"}</span>${escapar(item?.nome || id)} ×${qtd}</li>`);
  });
  const kit = progresso.classe?.principal || progresso.avatar?.kit || "mago";
  const visual = r.cosmetico || r.cosmetico_por_classe?.[kit];
  if (visual) {
    const item = itemDoCatalogo(visual);
    if (item) {
      linhas.push(`<li class="visual raridade-${item.raridade}"><img class="pixel" src="${imagemDoItem(item)}" alt=""><b>${escapar(item.nome)}</b>
        <i>${RARIDADES_ITEM[item.raridade] || ""} · exclusivo</i>${item.bonus ? `<small>${escapar(textoBonus(item.bonus))}</small>` : ""}</li>`);
    }
  }
  return `<ul class="recompensa-quest">${linhas.join("")}</ul>`;
}

function objetivosQuestHtml(quest, feito = null) {
  return `<ul class="objetivos-quest">${quest.objetivos.map((o, i) => {
    const n = feito ? feito[i] : 0;
    const ok = feito && n >= o.alvo;
    return `<li class="${ok ? "feito" : ""}"><span>${ok ? "✔" : "◆"}</span>${escapar(o.texto)}${o.alvo > 1 || feito ? ` <b>${n}/${o.alvo}</b>` : ""}</li>`;
  }).join("")}</ul>`;
}

// As escolhas que o herói fez na história (ficam no save: progresso.escolhas = { confianca, perdao }).
function escolhaFeita(id) {
  return (progresso.escolhas || {})[id] || null;
}

// O texto de uma quest com as variantes das escolhas: "variantes": { "confianca=desconfiar": { texto } }
function textoDaQuest(quest, campo) {
  const variante = Object.entries(quest.variantes || {}).find(([chave]) => {
    const [id, opcao] = chave.split("=");
    return escolhaFeita(id) === opcao;
  });
  return variante?.[1]?.[campo] || quest[campo];
}

// A carta da quest (aceitar ou entregar), numa janela de RPG com o retrato de quem dá. Quest com
// "escolha" pergunta antes de entregar: a resposta fica no save e muda falas e o final da história.
// curta: a fala já foi dita no diálogo de RPG; a carta mostra só uma linha dela
function cartaDeQuest(h, quest, modo, { curta = false } = {}) {
  const modal = document.getElementById("modal-missao");
  const capitulo = quest.tipo === "principal" ? catalogoQuests().capitulos.find((c) => c.id === quest.capitulo) : null;
  const andamento = questsAtivas().find((q) => q.id === quest.id);
  const escolher = modo === "entregar" && quest.escolha && !escolhaFeita(quest.escolha.id);
  modal.innerHTML = `
    <div class="missao-conteudo carta-quest ${quest.tipo}">
      <div class="cabeca-quest">
        <img class="pixel retrato-conversa" src="${heroiParado(h.visual).toDataURL()}" alt="">
        <div>
          <small class="tipo-quest">${quest.tipo === "principal" ? `📜 História · ${escapar(capitulo?.titulo || "")}` : "❗ Quest de morador"}</small>
          <h3>${escapar(quest.titulo)}</h3>
          <p class="quem-quest">${escapar(h.nome)}</p>
        </div>
      </div>
      ${curta ? "" : `<p class="fala-conversa">${formatar(modo === "entregar" ? textoDaQuest(quest, "fala_entrega") || "Tu conseguiste! Toma tua recompensa." : textoDaQuest(quest, "texto"))}</p>`}
      ${escolher ? `
        <div class="escolha-quest">
          <h4>⚖️ ${formatar(quest.escolha.pergunta)}</h4>
          ${quest.escolha.opcoes.map((o) => `<button class="opcao-escolha" type="button" data-escolha="${o.id}"><span>${o.icone || "◆"}</span>${escapar(o.texto)}</button>`).join("")}
          <small>Essa escolha muda o que os personagens dizem e o fim da tua história.</small>
        </div>` : `
      <h4>Objetivos</h4>
      ${objetivosQuestHtml(quest, andamento?.feito || (modo === "entregar" ? quest.objetivos.map((o) => o.alvo) : null))}
      <h4>Recompensa</h4>
      ${recompensaQuestHtml(quest.recompensa)}`}
      <div class="acoes">
        ${modo === "oferta" ? '<button class="botao" type="button" data-sim>✅ Aceitar quest</button><button class="botao botao-fantasma" type="button" data-nao>Agora não</button>' : ""}
        ${modo === "entregar" && !escolher ? '<button class="botao" type="button" data-sim>🎁 Entregar e receber</button>' : ""}
        ${modo === "andamento" ? '<button class="botao botao-fantasma" type="button" data-nao>Vou continuar!</button>' : ""}
      </div>
    </div>`;
  modal.querySelector("[data-nao]")?.addEventListener("click", () => modal.close());
  // a escolha: guarda no save, mostra a reação e reabre a carta já com o "entregar"
  modal.querySelectorAll("[data-escolha]").forEach((b) => b.addEventListener("click", () => {
    const opcao = quest.escolha.opcoes.find((o) => o.id === b.dataset.escolha);
    progresso.escolhas = { ...(progresso.escolhas || {}), [quest.escolha.id]: opcao.id };
    salvarProgresso();
    Som.efeito("evolucao");
    avisoFlutuante(opcao.icone || "⚖️", "Tua escolha ficou marcada", opcao.fala);
    cartaDeQuest(h, quest, modo, { curta });
  }));
  modal.querySelector("[data-sim]")?.addEventListener("click", async (evento) => {
    const botao = evento.currentTarget;
    botao.disabled = true;
    try {
      if (modo === "oferta") {
        await acaoJogador(`quests/${quest.id}/aceitar`);
        modal.close();
        Som.efeito("evolucao");
        avisoFlutuante(quest.tipo === "principal" ? "📜" : "❗", `Quest aceita: ${quest.titulo}`, quest.objetivos[0].texto);
      } else {
        const nivelAntes = nivelDe(progresso.xp);
        const r = await acaoJogador(`quests/${quest.id}/entregar`);
        modal.close();
        Som.efeito("vitoria");
        chuvaDeEstrelas(quest.tipo === "principal" ? 70 : 40);
        avisoFlutuante("🏆", `Quest concluída: ${quest.titulo}`, r.ganhos.map((g) => `${g.icone} ${g.texto}`).join("  "));
        verificarSubidaDeNivel(nivelAntes);
        const proximoCapitulo = quest.tipo === "principal" && catalogoQuests().principais.find((q) => !estadoQuests().concluidas.includes(q.id));
        // capítulo novo: a cena animada dele e depois o cartão; as revelações têm cena própria
        const REVELACOES = { "h-eco": "revelacao-lyra", "h-leviata": "revelacao-malakar" };
        if (proximoCapitulo && proximoCapitulo.capitulo !== quest.capitulo) {
          setTimeout(() => tocarCenaDaHistoria(`capitulo-${proximoCapitulo.capitulo}`, () => anunciarCapitulo(proximoCapitulo.capitulo)), 1400);
        } else if (REVELACOES[quest.id]) setTimeout(() => tocarCenaDaHistoria(REVELACOES[quest.id]), 1400);
        // a última quest da história: a escolha final, o epílogo e os créditos
        if (quest.final) setTimeout(() => telaFinal(), 1800);
      }
      atualizarRastreadorQuest();
    } catch (erro) {
      botao.disabled = false;
      avisoFlutuante("⚠️", "Não deu", erro.message);
    }
  });
  if (!modal.open) modal.showModal(); // depois de uma escolha a carta é redesenhada com ela aberta
}

// O que o morador diz agora: quem tem "falasAgora" (Lyra, o Eco) muda de fala conforme a história andou e
// as escolhas do herói; os outros têm as falas de sempre.
function falasDoMorador(h) {
  const agora = typeof h.falasAgora === "function" ? h.falasAgora() : null;
  return agora?.length ? agora : h.falas;
}

// Falar com um morador: primeiro conta para as quests que pedem "falar com ele"; depois, se ele tiver quest
// para entregar ou oferecer, abre a carta; se não, a conversa de sempre (com um lembrete da quest dele).
async function conversarComMorador(h) {
  const precisaFalar = questsAtivas().some((q) => q.objetivos.some((o, i) => o.evento === "falar" && o.filtro?.npc === h.id && q.feito[i] < o.alvo));
  if (precisaFalar) {
    try {
      await acaoJogador("quests/evento", { evento: "falar", npc: h.id });
    } catch {
      // sem rede: a conversa segue normal
    }
  }
  // a conversa acontece no diálogo de RPG (falas em páginas); a carta só aparece no fim, com os objetivos
  const q = questDoMorador(h.id);
  if (q?.estado === "entregar") {
    await dialogoRPG(h, textoDaQuest(q.quest, "fala_entrega") || "Tu conseguiste! Toma tua recompensa.");
    return cartaDeQuest(h, q.quest, "entregar", { curta: true });
  }
  if (q?.estado === "oferta") {
    await dialogoRPG(h, textoDaQuest(q.quest, "texto"));
    return cartaDeQuest(h, q.quest, "oferta", { curta: true });
  }
  if (q?.estado === "andamento") {
    const falta = q.quest.objetivos.find((o, i) => q.quest.feito[i] < o.alvo);
    return dialogoRPG(h, `${sortear(falasDoMorador(h))}\n\n📜 **${q.quest.titulo}**: ${falta ? `${falta.texto} (${q.quest.feito[q.quest.objetivos.indexOf(falta)]}/${falta.alvo})` : "tudo pronto!"}`);
  }
  return dialogoRPG(h, sortear(falasDoMorador(h)));
}

// ---------- o diálogo de RPG ----------
// A caixa de diálogo embaixo da tela, como nos RPGs: o retrato de quem fala, o nome, o texto aparecendo
// letra a letra com a voz da pessoa (um "blip" de altura própria) e as falas em páginas curtas.
// Clique, Enter ou Espaço: termina a página ou passa para a próxima. Devolve uma promessa.

// as páginas: frases agrupadas até uns 170 caracteres (as quebras de linha em branco também viram página)
function paginasDaFala(texto) {
  const paginas = [];
  texto.split(/\n\n+/).forEach((bloco) => {
    let atual = "";
    (bloco.match(/[^.!?…]+[.!?…]+["”»)]?\s*|[^.!?…]+$/g) || [bloco]).forEach((frase) => {
      if (atual && (atual + frase).length > 170) {
        paginas.push(atual.trim());
        atual = "";
      }
      atual += frase;
    });
    if (atual.trim()) paginas.push(atual.trim());
  });
  return paginas;
}

// a voz de cada personagem: uma altura que depende do nome (e um pouco mais aguda para corpo feminino)
function vozDe(h) {
  const base = [...(h.id || h.nome || "")].reduce((s, c) => s + c.charCodeAt(0), 0);
  return 0.7 + (base % 7) * 0.08 + (h.visual?.corpo === "feminino" ? 0.25 : 0);
}

function dialogoRPG(h, texto) {
  document.getElementById("modal-missao")?.open && document.getElementById("modal-missao").close();
  const paginas = paginasDaFala(texto);
  // o retrato de busto em três quadros: parado, com a boca aberta (falando) e piscando
  const bustos = {
    parado: retratoBustoUrl(h.visual),
    falando: retratoBustoUrl(h.visual, { boca: "falando" }),
    piscando: retratoBustoUrl(h.visual, { olhos: "piscando" }),
  };
  return new Promise((resolver) => {
    const camada = criar(`
      <div class="dialogo-rpg" role="dialog" aria-label="Conversa com ${escapar(h.nome)}">
        <div class="caixa-dialogo" data-caixa>
          <img class="pixel retrato-busto" src="${bustos.parado}" alt="">
          <strong class="nome-dialogo placa-nome">${escapar(h.nome)}</strong>
          <div class="corpo-dialogo">
            <p class="texto-dialogo" data-voz="${vozDe(h).toFixed(2)}"></p>
          </div>
          <span class="seta-dialogo">▼</span>
          <small class="pagina-dialogo"></small>
        </div>
      </div>`);
    document.body.append(camada);
    const caixa = camada.querySelector("[data-caixa]");
    const textoEl = camada.querySelector(".texto-dialogo");
    const contador = camada.querySelector(".pagina-dialogo");
    const retrato = camada.querySelector(".retrato-busto");
    let i = 0;
    let escrevendo = false;
    // a boca mexe enquanto o texto aparece; parado, pisca de vez em quando
    let quadro = 0;
    const animar = setInterval(() => {
      quadro += 1;
      const src = escrevendo && quadro % 2 ? bustos.falando : !escrevendo && quadro % 28 === 0 ? bustos.piscando : bustos.parado;
      if (retrato.getAttribute("src") !== src) retrato.setAttribute("src", src);
    }, 130);
    const mostrar = async () => {
      escrevendo = true;
      camada.classList.remove("pronta");
      contador.textContent = paginas.length > 1 ? `${i + 1}/${paginas.length}` : "";
      await escreverFala(textoEl, paginas[i]);
      escrevendo = false;
      camada.classList.add("pronta");
    };
    const seguir = (e) => {
      if (e.type === "keydown" && !["Enter", " ", "e", "E"].includes(e.key)) return;
      if (e.type === "keydown") e.preventDefault();
      if (escrevendo) return; // o clique termina a página (escreverFala cuida disso)
      i += 1;
      if (i < paginas.length) {
        Som.efeito("clique");
        return mostrar();
      }
      window.removeEventListener("keydown", seguir, true);
      clearInterval(animar);
      camada.classList.add("saindo");
      setTimeout(() => camada.remove(), 200);
      resolver();
    };
    // o primeiro clique só vale depois de a caixa aparecer (o clique que abriu a conversa não pula nada)
    setTimeout(() => {
      caixa.addEventListener("click", seguir);
      window.addEventListener("keydown", seguir, true);
    }, 120);
    mostrar();
  });
}

// o "!" ou "?" pulando em cima de quem tem quest (desenhado no mapa, no lugar do balãozinho de fala)
function desenharMarcadorQuest(ctx, x, y, t, { marca, principal }) {
  const pulo = Math.round(Math.abs(Math.sin(t * 3.2)) * -4);
  const cor = principal ? "#ffd166" : "#6ec8ff";
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.fillRect(Math.round(x) - 4, Math.round(y) + 1, 8, 2);
  ctx.font = "bold 15px 'Jersey 10', monospace";
  ctx.textAlign = "center";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#1b1205";
  ctx.strokeText(marca, Math.round(x), Math.round(y) + pulo);
  ctx.fillStyle = cor;
  ctx.fillText(marca, Math.round(x), Math.round(y) + pulo);
}

// ---------- o rastreador (canto da tela no Reino) ----------

function objetivoAtual() {
  const ativas = questsAtivas();
  const principal = ativas.find((q) => q.tipo === "principal");
  const foco = principal || ativas[0];
  if (foco) {
    const i = foco.objetivos.findIndex((o, k) => foco.feito[k] < o.alvo);
    return {
      id: foco.id, titulo: foco.titulo, principal: foco.tipo === "principal",
      texto: i < 0 ? `Volte a falar com ${nomeDoMorador(foco.npc)}` : foco.objetivos[i].texto,
      conta: i < 0 ? "" : `${foco.feito[i]}/${foco.objetivos[i].alvo}`, pronta: i < 0,
    };
  }
  const proxima = questsDisponiveis().find((q) => q.tipo === "principal");
  if (proxima) return { id: proxima.id, titulo: proxima.titulo, principal: true, texto: `Fale com ${nomeDoMorador(proxima.npc)}`, conta: "", nova: true };
  const { principais } = catalogoQuests();
  const proximaTrancada = principais.find((q) => !estadoQuests().concluidas.includes(q.id));
  if (proximaTrancada?.mundo === "umbra" && !(typeof umbraLiberada === "function" && umbraLiberada())) {
    return { titulo: proximaTrancada.titulo, principal: true, texto: "Chega ao último degrau da subclasse e atravessa a Fenda da Ruptura", conta: "" };
  }
  if (proximaTrancada) return { titulo: proximaTrancada.titulo, principal: true, texto: `Chega ao nível ${proximaTrancada.nivel} para continuar a história`, conta: "" };
  return null;
}

// o rastreador pode ficar minimizado (só uma plaquinha com o título); a escolha fica guardada no navegador
const CHAVE_RASTREADOR_MINI = "rpg-ia-rastreador-mini";
function rastreadorMinimizado() {
  try {
    return localStorage.getItem(CHAVE_RASTREADOR_MINI) === "1";
  } catch {
    return false;
  }
}

function atualizarRastreadorQuest() {
  const caixa = document.querySelector("[data-rastreador-quest]");
  if (!caixa) return;
  const o = objetivoAtual();
  caixa.hidden = !o;
  if (!o) return;
  const mini = rastreadorMinimizado();
  caixa.className = `rastreador-quest ${o.principal ? "principal" : ""} ${o.pronta || o.nova ? "chamando" : ""} ${o.id ? "clicavel" : ""} ${mini ? "minimizado" : ""}`;
  const botao = `<button type="button" class="minimizar-rastreador" data-minimizar title="${mini ? "Mostrar a missão" : "Minimizar a missão"}" aria-label="${mini ? "Mostrar a missão" : "Minimizar a missão"}"><i class="${mini ? "mais" : "menos"}"></i></button>`;
  caixa.innerHTML = mini
    ? `${botao}<small>${o.principal ? "📜" : "❗"}</small><strong>${escapar(o.titulo)}</strong>${o.conta ? `<b class="conta-mini">${o.conta}</b>` : ""}`
    : `${botao}<small>${o.principal ? "📜 História" : "❗ Quest"}</small><strong>${escapar(o.titulo)}</strong>
    <span>${o.pronta ? "✔" : o.nova ? "!" : "◆"} ${escapar(o.texto)}${o.conta ? ` <b>${o.conta}</b>` : ""}</span>
    ${o.id ? '<em>📍 clica para ir</em>' : ""}`;
  // o botão de minimizar não leva até a quest
  caixa.querySelector("[data-minimizar]").addEventListener("click", (e) => {
    e.stopPropagation();
    try {
      localStorage.setItem(CHAVE_RASTREADOR_MINI, mini ? "0" : "1");
    } catch {
      // sem localStorage: vale só até recarregar
    }
    if (typeof Som !== "undefined") Som.efeito("clique");
    atualizarRastreadorQuest();
  });
  // clicar no rastreador leva o herói até o objetivo
  caixa.onclick = o.id ? () => irAteQuest(o.id) : null;
}

// ---------- chegar numa cidade: a faixa com o nome e o objetivo "visitar" ----------

let cidadeAtual = null;
const visitasAvisadas = new Set();
function verificarCidade(px, py) {
  if (typeof CIDADES === "undefined") return;
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  const cidade = CIDADES.find((c) => tx >= c.x0 && tx <= c.x1 && ty >= c.y0 && ty <= c.y1) || null;
  if (cidade?.id === cidadeAtual) return;
  cidadeAtual = cidade?.id || null;
  if (!cidade) return;
  faixaDeLugar(cidade.icone, cidade.nome);
  const precisa = questsAtivas().some((q) => q.objetivos.some((o, i) => o.evento === "visitar" && o.filtro?.cidade === cidade.id && q.feito[i] < o.alvo));
  if (precisa && !visitasAvisadas.has(cidade.id)) {
    visitasAvisadas.add(cidade.id);
    acaoJogador("quests/evento", { evento: "visitar", cidade: cidade.id }).then(atualizarRastreadorQuest).catch(() => visitasAvisadas.delete(cidade.id));
  }
}

// a faixa grande que aparece ao entrar numa cidade, como nos RPGs ("🏰 Elyndor, a Capital")
function faixaDeLugar(icone, nome) {
  document.querySelector(".faixa-lugar")?.remove();
  if (document.querySelector(".prologo")) return; // uma cena da história está tocando: a faixa não entra por cima
  const faixa = criar(`<div class="faixa-lugar"><span>${icone}</span><strong>${escapar(nome)}</strong></div>`);
  document.body.append(faixa);
  setTimeout(() => faixa.remove(), 3200);
}

// o cartão de capítulo novo da história
function anunciarCapitulo(id) {
  const capitulo = catalogoQuests().capitulos.find((c) => c.id === id);
  if (!capitulo) return;
  const cartao = criar(`<div class="cartao-capitulo"><small>✦ Novo capítulo ✦</small><strong>${escapar(capitulo.titulo)}</strong><p>${escapar(capitulo.texto)}</p></div>`);
  document.body.append(cartao);
  Som.efeito("evolucao");
  setTimeout(() => cartao.classList.add("saindo"), 4200);
  setTimeout(() => cartao.remove(), 4900);
}

// avisa quando um objetivo de quest anda (chamado pelo aplicarEstado com o antes e o depois)
function avisarProgressoQuests(antes) {
  questsAtivas().forEach((q) => {
    const era = antes?.[q.id]?.feito;
    if (!era) return;
    q.objetivos.forEach((o, i) => {
      if ((era[i] || 0) >= q.feito[i]) return;
      const pronto = q.feito[i] >= o.alvo;
      avisoFlutuante(pronto ? "✔" : "◆", `${q.titulo}: ${q.feito[i]}/${o.alvo}`, pronto ? (q.completa ? `Pronto! Volte a falar com ${nomeDoMorador(q.npc)}.` : `${o.texto}: feito!`) : o.texto);
    });
  });
  atualizarRastreadorQuest();
}

// ---------- clicar numa quest e o herói vai até ela ----------

// um ponto de cada região, para quando não tem monstro certo à vista (de dia, as criaturas da noite somem)
const CENTRO_DAS_REGIOES = { vale: [160, 176], campos: [212, 112], floresta: [62, 104], pantano: [76, 196], deserto: [272, 120], montanhas: [150, 30] };

// os centros das regiões de Umbraterra (para quando não tem monstro certo à vista)
const CENTRO_DAS_REGIOES_UMBRA = { fenda: [100, 120], cinzas: [150, 120], cristais: [50, 120], abismo: [50, 60], geleira: [150, 60], trono: [100, 30] };

// Em Umbraterra: os moradores, chefões, dungeons e monstros de lá (o destino leva "mundo: umbra").
function destinoEmUmbra(evento, filtro, hx, hy) {
  const lista = (v) => (v === undefined ? null : Array.isArray(v) ? v : [v]);
  const em = (d) => (d ? { ...d, mundo: "umbra" } : null);
  if (evento === "falar") {
    const h = HABITANTES_UMBRA.find((m) => m.id === filtro.npc);
    return em(h && { tx: h.tx, ty: h.ty + 1, nome: h.nome });
  }
  if (evento === "chefe") {
    const c = CHEFES_UMBRA.find((x) => (lista(filtro.tipo) || []).includes(x.tipoId)) || CHEFES_UMBRA[0];
    return em({ tx: c.tx, ty: c.ty + 5, nome: "o covil do chefão" });
  }
  if (evento === "dungeon") {
    const [tx, ty] = LUGARES_UMBRA[filtro.dungeon] || LUGARES_UMBRA.forja;
    return em({ tx, ty: ty + 1, nome: "a dungeon" });
  }
  const regioes = lista(filtro.regiao);
  const vivos = (estadoUmbra.monstros || []).filter((m) => !m.parado && !m.trancado && !m.derrotado() && (!regioes || regioes.includes(m.regiao)));
  const perto = vivos.sort((a, b) => Math.hypot(a.x / TILE - hx, a.y / TILE - hy) - Math.hypot(b.x / TILE - hx, b.y / TILE - hy))[0];
  if (perto) return em({ tx: Math.floor(perto.x / TILE), ty: Math.floor(perto.y / TILE), nome: perto.nome || "um monstro" });
  const [tx, ty] = CENTRO_DAS_REGIOES_UMBRA[regioes?.[0]] || CENTRO_DAS_REGIOES_UMBRA.fenda;
  return em({ tx, ty, nome: REGIOES_UMBRA[regioes?.[0]]?.nome || "Umbraterra" });
}

// para onde ir num objetivo (evento + filtro), a partir de onde o herói está: { tx, ty, nome } ou { academia }
// umbra: o objetivo é de uma quest de Umbraterra
function destinoDoObjetivo(evento, filtro = {}, umbra = false) {
  if (umbra && !["leitura", "licao"].includes(evento)) {
    const heroi = window.mundoAtivo?.heroi;
    return destinoEmUmbra(evento, filtro, heroi ? heroi.x / TILE : REFUGIO[0], heroi ? heroi.y / TILE : REFUGIO[1]);
  }
  const heroi = window.mundoAtivo?.heroi;
  const hx = heroi ? heroi.x / TILE : VILA[0];
  const hy = heroi ? heroi.y / TILE : VILA[1];
  const maisPerto = (lista) => lista.reduce((melhor, p) => {
    const d = Math.hypot(p.tx - hx, p.ty - hy);
    return !melhor || d < melhor.d ? { ...p, d } : melhor;
  }, null);
  const lista = (v) => (v === undefined ? null : Array.isArray(v) ? v : [v]);
  if (evento === "falar") {
    const h = HABITANTES.find((m) => m.id === filtro.npc);
    return h ? { tx: h.tx, ty: h.ty + 1, nome: h.nome } : null;
  }
  if (evento === "visitar") {
    const p = PLACAS.find((x) => x.id === `placa-${filtro.cidade}`);
    return p ? { tx: p.tx, ty: p.ty + 1, nome: p.nome } : null;
  }
  if (evento === "chefe") {
    const tipos = lista(filtro.tipo);
    const vivos = CHEFES.filter((c) => (!tipos || tipos.includes(c.tipoId)) && !(progresso.chefesDerrotados || []).includes(`chefe-${c.tipoId}`));
    const c = maisPerto(vivos.map((x) => ({ tx: x.tx, ty: x.ty + 4, nome: "o covil do chefão" })));
    return c;
  }
  if (evento === "enigma") {
    const feitos = progresso.puzzlesResolvidos || [];
    return maisPerto(Object.entries(POSICAO_PUZZLES).filter(([id]) => !feitos.includes(id)).map(([, [tx, ty]]) => ({ tx, ty: ty + 1, nome: "um enigma" })));
  }
  if (["leitura", "licao"].includes(evento)) return { academia: true, nome: "a Academia" };
  if (evento === "dungeon") {
    return maisPerto(["cripta", "bugs", "cofre"].map((id) => ({ tx: POSICAO_LUGARES[id][0], ty: POSICAO_LUGARES[id][1] + 1, nome: "uma dungeon" })));
  }
  // monstro ou acerto (acertos vêm das batalhas): o monstro certo mais perto, ou o centro da região dele
  const tipos = lista(filtro.tipo);
  const regioes = lista(filtro.regiao);
  const monstros = (estadoMundo.monstros || []).filter((m) => !m.parado && !m.trancado && !(m.derrotado && m.derrotado())
    && (!tipos || tipos.includes(m.tipoId)) && (!regioes || regioes.includes(m.regiao)) && (!filtro.forca || m.forca === filtro.forca));
  const alvo = maisPerto(monstros.map((m) => ({ tx: Math.floor(m.x / TILE), ty: Math.floor(m.y / TILE), nome: m.nome || "um monstro" })));
  if (alvo) return alvo;
  const regiao = regioes?.[0] || (tipos && typeof estadoMundo !== "undefined" ? (estadoMundo.monstros || []).find((m) => tipos.includes(m.tipoId))?.regiao : null) || "campos";
  const [tx, ty] = CENTRO_DAS_REGIOES[regiao] || CENTRO_DAS_REGIOES.campos;
  return { tx, ty, nome: REGIOES[regiao]?.nome || "o Reino" };
}

function destinoDaQuest(quest) {
  const umbra = quest.mundo === "umbra";
  if (quest.completa || quest.estadoMorador === "oferta") return destinoDoObjetivo("falar", { npc: quest.npc }, umbra);
  const i = quest.objetivos.findIndex((o, k) => (quest.feito?.[k] || 0) < o.alvo);
  const o = quest.objetivos[i < 0 ? 0 : i];
  return destinoDoObjetivo(o.evento, o.filtro || {}, umbra);
}

// Leva o herói até o destino: no Reino, anda direto; fora dele, abre o Reino e depois anda.
async function irAteDestino(destino) {
  if (!destino) return avisoFlutuante("🗺️", "Sem caminho", "Não achei para onde ir agora. Tenta de novo daqui a pouco.");
  // no Salão do multijogador, ir até a quest tira o herói de lá: só com a confirmação dele
  if (typeof estaNoSalao === "function" && estaNoSalao() && !(await confirmarSaidaDoSalao(destino.academia ? "a Academia" : destino.nome || "o Reino"))) return;
  if (destino.academia) {
    avisoFlutuante("📍", "Indo para a Academia", "Lições e livros ficam lá.");
    return irPara("academia");
  }
  const andar = () => {
    const ok = window.mundoAtivo?.caminharPara?.(destino.tx, destino.ty);
    if (ok) {
      Som.efeito("passar");
      avisoFlutuante("📍", `Indo até ${destino.nome}`, "O herói segue sozinho. Mexe as setas para parar.");
    } else {
      avisoFlutuante("🔒", "Não dá para chegar", "O caminho está fechado (talvez por uma barreira mágica: sobe de nível).");
    }
  };
  // o destino é de Umbraterra: anda lá (ou atravessa a Fenda primeiro); do Reino, o mesmo de sempre
  if (destino.mundo === "umbra") {
    if (document.querySelector(".tela-mundo.umbra") && window.mundoAtivo?.ativo()) return andar();
    if (!umbraLiberada()) return entrarNaFenda();
    return telaUmbra().then(() => setTimeout(andar, 400));
  }
  if (document.querySelector(".tela-mundo.reino:not(.umbra)") && window.mundoAtivo?.ativo()) return andar();
  telaReino().then(() => setTimeout(andar, 400));
}

function irAteQuest(id) {
  const quest = questsAtivas().find((q) => q.id === id) || (() => {
    const q = questPorId(id);
    return q ? { ...q, estadoMorador: "oferta" } : null;
  })();
  if (quest) irAteDestino(destinoDaQuest(quest));
}

// ---------- o diário (J): a história, as quests dos moradores e o quadro de missões ----------

function painelQuestsHtml() {
  const ativas = questsAtivas();
  const principal = ativas.find((q) => q.tipo === "principal");
  const secundarias = ativas.filter((q) => q.tipo === "secundaria");
  const { concluidas = [] } = estadoQuests();
  const { principais, capitulos } = catalogoQuests();
  const proxima = !principal && principais.find((q) => !concluidas.includes(q.id));
  const capituloAtual = capitulos.find((c) => c.id === (principal || proxima)?.capitulo);
  const ofertas = questsDisponiveis().filter((q) => q.tipo === "secundaria");
  const cartao = (q) => `
    <div class="cartao-quest ${q.tipo} ${q.completa ? "pronta" : ""}" data-ir-quest="${q.id}" role="button" tabindex="0" title="Clica para o herói ir até lá">
      ${q.tipo === "principal" ? '<span class="selo-principal">★ História principal</span>' : ""}
      <strong>${q.completa ? "✅" : q.tipo === "principal" ? "📜" : "❗"} ${escapar(q.titulo)}</strong>
      <small>${q.completa ? `Volte a falar com ${escapar(nomeDoMorador(q.npc))}` : `Dada por ${escapar(nomeDoMorador(q.npc))}`}</small>
      ${objetivosQuestHtml(q, q.feito)}
      <span class="ir-quest">📍 Ir até lá</span>
    </div>`;
  return `
    <div class="diario-quests">
      <h4 class="titulo-tema">📜 A História de Elyndor <small>${principais.filter((q) => concluidas.includes(q.id)).length}/${principais.length}</small></h4>
      ${capituloAtual ? `<p class="capitulo-diario"><b>${escapar(capituloAtual.titulo)}</b> ${escapar(capituloAtual.texto)}</p>` : ""}
      ${(progresso.cenasVistas || []).length ? `<p class="cenas-diario">🎬 Rever: <button type="button" class="link-morador" data-rever-cena="prologo">Prólogo</button>
        ${progresso.cenasVistas.filter((id) => CENAS_HISTORIA[id]).map((id) => `<button type="button" class="link-morador" data-rever-cena="${id}">${escapar(CENAS_HISTORIA[id].titulo)}</button>`).join(" ")}</p>` : ""}
      ${principal ? cartao(principal) : proxima ? `<div class="cartao-quest principal proxima" ${nivelDe(progresso.xp) >= (proxima.nivel || 1) ? `data-ir-quest="${proxima.id}" role="button" tabindex="0"` : ""}>
        <span class="selo-principal">★ História principal</span><strong>📜 ${escapar(proxima.titulo)}</strong>
        <small>${nivelDe(progresso.xp) >= (proxima.nivel || 1) ? `Fale com ${escapar(nomeDoMorador(proxima.npc))} para começar` : `Libera no nível ${proxima.nivel}`}</small>
        ${nivelDe(progresso.xp) >= (proxima.nivel || 1) ? '<span class="ir-quest">📍 Ir até lá</span>' : ""}</div>`
        : '<p class="legenda">🏆 Tu concluíste toda a história de Elyndor!</p>'}
      <h4 class="titulo-tema">❗ Quests dos moradores <small>${concluidas.filter((id) => !principais.some((p) => p.id === id)).length} concluídas</small></h4>
      ${secundarias.length ? secundarias.map(cartao).join("") : '<p class="legenda">Nenhuma quest de morador em andamento.</p>'}
      ${ofertas.length ? `<p class="ofertas-quest">Moradores com quest para ti (clica para ir): ${ofertas.map((q) => `<button type="button" class="link-morador" data-ir-quest="${q.id}">📍 ${escapar(nomeDoMorador(q.npc))}</button>`).join(" ")}</p>` : ""}
    </div>`;
}
