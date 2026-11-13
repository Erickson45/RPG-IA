// A Casa da Forja (modo Um Jogador): os monstros soltam materiais e o Duran transforma tudo em armas, chapéus e
// mantos que nenhuma loja vende. São 19 linhagens (uma ou duas por região, da comum à Aurora do Saber), cada
// uma com as peças das três classes e o manto. Quem decide tudo é o servidor (rota /forjar em jogador.py e os
// drops em equipamento.py); aqui só se mostra. O catálogo vem de conteudo/forja.json (gerar_forja.py).
// Depende de app.js (CATALOGO, progresso, acaoJogador, desenharItemNaVitrine...), heroi.js e pixel.js.

const FERREIRO_DA_FORJA = {
  nome: "Duran, o Ferreiro",
  avatar: { kit: "guerreiro", corpo: "masculino", pele: "#9a6440", cabelo: "raspado", corCabelo: "#2b1d14", rosto: "confiante", chapeu: "nenhum", manto: "#5c3418", detalhe: "#c9cbe0", item: "martelo", magia: "#ff7a1a", acessorio: "barba", familiar: "nenhum" },
  forjou: [
    "**CLANG!** Olha só isso. Saiu melhor do que eu esperava!",
    "Mais uma para a tua coleção. O Reino vai comentar!",
    "Cada martelada é uma pergunta respondida. Essa aqui teve muitas.",
    "Usa com orgulho: foste tu que caçaste cada pedacinho.",
  ],
};

const ORDEM_TIER_MATERIAL = { comum: 0, raro: 1, essencia: 2, mitico: 3 };
const NOMES_TIER_MATERIAL = { comum: "Comum", raro: "Raro", essencia: "Essência", mitico: "Mítico" };
const NOMES_REGIAO_FORJA = {
  campos: "Campos de Elyndor", floresta: "Floresta Uivante", pantano: "Pântano das Alucinações", deserto: "Deserto dos Bugs",
  montanhas: "Montanhas do Dragão", fenda: "Fenda da Ruptura", cinzas: "Ermos de Cinza", cristais: "Bosque de Cristal",
  abismo: "Brejo do Abismo", geleira: "Geleira do Silêncio", trono: "Trono do Vazio", todas: "Todo o Reino",
};
const ORDEM_RARIDADE_FORJA = { comum: 0, raro: 1, epico: 2, lendario: 3 };
// "dos Campos", "da Floresta"... (para as frases ficarem certinhas)
const PREPOSICAO_REGIAO = {
  campos: "dos", floresta: "da", pantano: "do", deserto: "do", montanhas: "das", fenda: "da", cinzas: "dos", cristais: "do",
  abismo: "do", geleira: "da", trono: "do", todas: "de",
};

function nomeDaRegiaoForja(id) {
  return NOMES_REGIAO_FORJA[id] || id;
}
function daRegiaoForja(id) {
  return `${PREPOSICAO_REGIAO[id] || "de"} ${nomeDaRegiaoForja(id)}`;
}

// "quase todo monstro dos Campos de Elyndor": onde cada material cai (a mesma regra do equipamento.py)
function ondeCaiOMaterial(m) {
  const regiao = daRegiaoForja(m.regiao);
  return {
    comum: `quase todo monstro ${regiao}`,
    raro: `os monstros ${regiao} (mais os fortes e os da noite)`,
    essencia: m.regiao === "fenda" ? "a Sombra da Fenda, bem raramente" : `o chefão ${regiao} deixa 3 (e os monstros fortes de lá, bem raramente)`,
    mitico: "qualquer monstro, bem raramente (o dobro em Umbraterra); todo chefão deixa 2",
  }[m.tier];
}

const temasDaForja = () => CATALOGO.temas_forja || [];
const pecasDoTema = (temaId) => CATALOGO.cosmeticos.filter((c) => c.forja?.tema === temaId && daMinhaClasse(c));
const nomeCurtoDoTema = (tema) => tema.nome.replace(/^(de|da|do|das|dos) /, "");

// quanto da receita o herói já tem (0 a 1), contando as moedas como mais um material
function progressoDaReceita(item) {
  const r = item.forja;
  let tem = 0;
  let precisa = 0;
  Object.entries(r.materiais).forEach(([id, q]) => {
    tem += Math.min(q, quantosMateriais(id));
    precisa += q;
  });
  const moedas = r.moedas ? Math.min(1, (progresso.moedas || 0) / r.moedas) : 1;
  return (tem / precisa) * 0.85 + moedas * 0.15;
}

function podeForjar(item) {
  if (!item?.forja || possuiCosmetico(item.id)) return false;
  return Object.entries(item.forja.materiais).every(([id, q]) => quantosMateriais(id) >= q) && (progresso.moedas || 0) >= item.forja.moedas;
}

// as peças lendárias da classe do herói que ficam nos pedestais da Forja (uma de cada linhagem lendária)
function pecasDaVitrineDaForja() {
  const lendarios = temasDaForja().filter((t) => t.raridade === "lendario");
  return lendarios.map((tema, i) => {
    const armas = pecasDoTema(tema.id).filter((c) => c.avatar?.item);
    const item = armas[i % Math.max(1, armas.length)];
    return item ? { ...item, forjado: possuiCosmetico(item.id) } : null;
  }).filter(Boolean);
}

function conversarComDuran() {
  const prontas = CATALOGO.cosmeticos.filter((c) => c.forja && daMinhaClasse(c) && podeForjar(c)).length;
  const totalMateriais = Object.values(progresso.materiais || {}).reduce((a, b) => a + b, 0);
  const fala = !totalMateriais
    ? `Ô, **${nomeAluno()}**! Ainda não tens material nenhum. Sai pelo Reino e vence uns monstros: **todo bicho solta alguma coisa**. Gosma de slime, pelo de lobo, escama de dragão... traz tudo para cá!`
    : prontas
      ? `Já dá para forjar **${prontas} ${prontas === 1 ? "peça" : "peças"}** com o que tens na mochila! A bigorna está quente. Bora?`
      : `Tens **${totalMateriais} materiais** na mochila, mas ainda falta coisa para a próxima peça. Dá uma olhada nas receitas e vê o que falta caçar.`;
  falarCom(FERREIRO_DA_FORJA.nome, FERREIRO_DA_FORJA.avatar, fala, [
    { texto: "⚒️ Abrir a forja", acao: () => telaForja() },
    { texto: "🎒 Meus materiais", acao: () => telaForja({ aba: "materiais" }), fantasma: true },
  ]);
}

let temaForja = null;
let abaForja = "linhagens";
let escolhidoForja = null;

function telaForja({ item = null, aba = null } = {}) {
  Som.musica("mercado");
  window.scrollTo(0, 0);
  if (aba) abaForja = aba;
  if (item) {
    const peca = itemDoCatalogo(item);
    if (peca?.forja) {
      temaForja = peca.forja.tema;
      escolhidoForja = peca.id;
      abaForja = "linhagens";
    }
  }
  // a primeira vez: a linhagem mais fácil que ainda não está completa
  if (!temaForja || !temasDaForja().some((t) => t.id === temaForja)) {
    const ordem = [...temasDaForja()].sort((a, b) => ORDEM_RARIDADE_FORJA[a.raridade] - ORDEM_RARIDADE_FORJA[b.raridade]);
    temaForja = (ordem.find((t) => pecasDoTema(t.id).some((c) => !possuiCosmetico(c.id))) || ordem[0])?.id;
  }
  const secao = criar(`
    <section class="loja-rpg forja-rpg">
      <header class="topo-loja">
        <div class="placa-loja"><small>✦ Casa da Forja ✦</small><h2>A Bigorna do Duran</h2></div>
        <div class="ouro-loja" data-ouro></div>
        <div class="acoes-loja">
          <button class="botao botao-fantasma" type="button" data-mochila>${imgIconeRpg("mochila")} Mochila</button>
          <button class="botao" type="button" data-voltar>◂ Voltar</button>
        </div>
      </header>
      <div class="corpo-loja">
        <aside class="balcao-loja">
          <div class="mercadora-loja">
            <div class="retrato-brina">${avatarSvg(FERREIRO_DA_FORJA.avatar, FERREIRO_DA_FORJA.nome)}</div>
            <div class="fala-brina"><b>${escapar(FERREIRO_DA_FORJA.nome)}</b><p data-fala></p></div>
          </div>
          <div class="detalhe-loja" data-detalhe></div>
        </aside>
        <div class="vitrine-loja">
          <nav class="abas-loja" data-abas></nav>
          <div class="linhagens-forja" data-temas></div>
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
  secao.querySelector("[data-voltar]").addEventListener("click", () => telaInterior("forja"));
  secao.querySelector("[data-mochila]").addEventListener("click", () => abrirMochila(null));
  tela.replaceChildren(secao);
  atualizarModoMundo();
  dizer(`Bem-vindo à minha forja, **${nomeAluno()}**! Escolhe uma linhagem, vê a receita e, se tiveres tudo, eu bato o martelo.`);

  function desenharOuro() {
    const total = Object.values(progresso.materiais || {}).reduce((a, b) => a + b, 0);
    secao.querySelector("[data-ouro]").innerHTML = `<span>🪙</span><b>${progresso.moedas || 0}</b><small>moedas</small><span>🎒</span><b>${total}</b><small>materiais</small>`;
  }

  function linhaDaReceita(id, q) {
    const m = materialDoCatalogo(id) || { icone: "❔", nome: id };
    const tem = quantosMateriais(id);
    return `<li class="${tem >= q ? "ok" : "falta"} tier-${m.tier}" title="${escapar(`${m.nome}: ${ondeCaiOMaterial(m) || ""}`)}">
      <span class="icone-material">${iconeDoItem(id, m.icone)}</span><span class="nome-material">${escapar(m.nome)}</span><b>${Math.min(tem, 9999)}/${q}</b></li>`;
  }

  function desenharDetalhe() {
    const detalhe = secao.querySelector("[data-detalhe]");
    const i = escolhidoForja && itemDoCatalogo(escolhidoForja);
    if (!i?.forja) {
      detalhe.innerHTML = '<p class="vazio-detalhe">Clica numa peça para ver a receita.</p>';
      return;
    }
    const tem = possuiCosmetico(i.id);
    const pronta = podeForjar(i);
    const tema = temasDaForja().find((t) => t.id === i.forja.tema);
    let acao;
    if (tem) {
      acao = estaVestindo(i) ? '<span class="tag tag-concluida">Vestindo ✓</span>' : '<button class="botao" type="button" data-vestir>Vestir ✨</button>';
    } else {
      const faltaOuro = i.forja.moedas - (progresso.moedas || 0);
      acao = `<button class="botao botao-comprar botao-forjar ${pronta ? "pronta" : ""}" type="button" data-forjar ${pronta ? "" : "disabled"}>⚒️ Forjar</button>
        ${!pronta && faltaOuro > 0 && Object.entries(i.forja.materiais).every(([id, q]) => quantosMateriais(id) >= q) ? `<small class="falta-ouro">Faltam 🪙 ${faltaOuro}</small>` : ""}`;
    }
    detalhe.innerHTML = `
      <div class="moldura-detalhe raridade-${i.raridade}">
        <canvas class="pixel heroi-detalhe" width="64" height="64" data-heroi="${i.id}"></canvas>
        <span class="selo-raridade">${tema?.mitico ? "Mítico" : RARIDADES_ITEM[i.raridade]}</span>
      </div>
      <strong class="nome-detalhe">${i.icone} ${escapar(i.nome)}</strong>
      <small class="linhagem-detalhe">Linhagem ${escapar(tema ? nomeCurtoDoTema(tema) : "")} · ${escapar(nomeDaRegiaoForja(tema?.regiao))}</small>
      <p class="descricao-detalhe">${escapar(i.descricao)}</p>
      ${Object.keys(i.bonus || {}).length ? `<p class="bonus-item raridade-${i.raridade}">✦ ${escapar(textoBonus(i.bonus))}</p>` : ""}
      ${tem ? "" : `
        <div class="receita-forja">
          <b>Receita</b>
          <ul>
            ${Object.entries(i.forja.materiais).map(([id, q]) => linhaDaReceita(id, q)).join("")}
            <li class="${(progresso.moedas || 0) >= i.forja.moedas ? "ok" : "falta"}"><span class="icone-material">🪙</span><span class="nome-material">Moedas</span><b>${i.forja.moedas}</b></li>
          </ul>
        </div>`}
      <div class="acao-detalhe">${acao}</div>`;
    detalhe.querySelector("[data-forjar]")?.addEventListener("click", () => forjar(i));
    detalhe.querySelector("[data-vestir]")?.addEventListener("click", (evento) => {
      vestir(i);
      atualizarBonusDoServidor();
      faiscas(evento.clientX, evento.clientY, "#ffd166");
      dizer("Caiu como uma luva. Ou como uma bigorna, no bom sentido!");
      desenharTudo();
    });
  }

  function desenharAbas() {
    const prontas = CATALOGO.cosmeticos.filter((c) => c.forja && daMinhaClasse(c) && podeForjar(c)).length;
    secao.querySelector("[data-abas]").innerHTML = [["linhagens", `⚒️ Linhagens${prontas ? ` <i class="ponto-alerta"></i>` : ""}`], ["materiais", "🎒 Materiais"]].map(([id, nome]) =>
      `<button type="button" class="aba-loja ${id === abaForja ? "ativa" : ""}" data-aba="${id}">${nome}</button>`).join("");
    secao.querySelectorAll("[data-aba]").forEach((b) => b.addEventListener("click", () => {
      abaForja = b.dataset.aba;
      Som.efeito("clique");
      desenharVitrine();
    }));
  }

  function desenharTemas() {
    const caixa = secao.querySelector("[data-temas]");
    caixa.hidden = abaForja !== "linhagens";
    if (caixa.hidden) return;
    caixa.innerHTML = temasDaForja().map((t) => {
      const pecas = pecasDoTema(t.id);
      const feitas = pecas.filter((c) => possuiCosmetico(c.id)).length;
      const pronta = pecas.some(podeForjar);
      return `<button type="button" class="chip-linhagem raridade-${t.raridade} ${t.mitico ? "mitico" : ""} ${t.id === temaForja ? "ativo" : ""} ${feitas === pecas.length ? "completa" : ""}" data-tema="${t.id}" title="${escapar(nomeDaRegiaoForja(t.regiao))}">
        <i class="gema-linhagem" style="background:${t.cor}; box-shadow: 0 0 6px ${t.cor}"></i>
        <span>${escapar(nomeCurtoDoTema(t))}</span>
        <small>${feitas}/${pecas.length}</small>${pronta ? '<i class="ponto-alerta"></i>' : ""}
      </button>`;
    }).join("");
    caixa.querySelectorAll("[data-tema]").forEach((b) => b.addEventListener("click", () => {
      temaForja = b.dataset.tema;
      escolhidoForja = null;
      Som.efeito("clique");
      const tema = temasDaForja().find((t) => t.id === temaForja);
      if (tema?.mitico) dizer("A **Aurora do Saber**... Só vi uma vez, nas mãos do Arquimago. Precisa de **Fragmentos do Oráculo** e de essências de cantos diferentes do mundo.");
      else if (tema?.raridade === "lendario") dizer(`Linhagem **${nomeCurtoDoTema(tema)}**: lendária. Material de chefão ${PREPOSICAO_REGIAO[tema.regiao]} **${nomeDaRegiaoForja(tema.regiao)}**. Não é para qualquer um!`);
      else if (tema) dizer(`Linhagem **${nomeCurtoDoTema(tema)}**. Os materiais vêm ${PREPOSICAO_REGIAO[tema.regiao]} **${nomeDaRegiaoForja(tema.regiao)}**.`);
      desenharVitrine();
      desenharDetalhe();
    }));
  }

  function desenharVitrine() {
    desenharAbas();
    desenharTemas();
    const grade = secao.querySelector("[data-grade]");
    grade.classList.toggle("grade-materiais", abaForja === "materiais");
    if (abaForja === "materiais") {
      const lista = [...(CATALOGO.materiais || [])];
      grade.innerHTML = lista.map((m) => {
        const q = quantosMateriais(m.id);
        return `<div class="carta-material tier-${m.tier} ${q ? "" : "zerado"}" title="${escapar(m.descricao)}">
          <span class="icone-material">${iconeDoItem(m.id, m.icone)}</span>
          <strong>${escapar(m.nome)}</strong>
          <small>${NOMES_TIER_MATERIAL[m.tier]} · ${escapar(ondeCaiOMaterial(m))}</small>
          <b class="qtd-material">×${q}</b>
        </div>`;
      }).join("");
      return;
    }
    const pecas = pecasDoTema(temaForja).sort((a, b) => (a.avatar.manto ? 1 : 0) - (b.avatar.manto ? 1 : 0));
    grade.innerHTML = pecas.map((i) => {
      const tem = possuiCosmetico(i.id);
      const pronta = podeForjar(i);
      const pct = Math.floor(progressoDaReceita(i) * 100);
      const estado = tem
        ? `<span class="preco-carta tem">${estaVestindo(i) ? "Vestindo" : "✓ Forjada"}</span>`
        : pronta ? '<span class="preco-carta pronta-forja">⚒️ Pronta!</span>'
          : `<span class="preco-carta progresso-forja"><i style="width:${pct}%"></i><em>${pct}%</em></span>`;
      return `
        <button type="button" class="carta-loja raridade-${i.raridade} ${i.id === escolhidoForja ? "escolhida" : ""} ${tem ? "possuida" : ""} ${pronta ? "brilha-forja" : ""}" data-item="${i.id}">
          <i class="faixa-raridade">${RARIDADES_ITEM[i.raridade]}</i>
          <canvas class="pixel desenho-vitrine" width="96" height="96" data-desenho="${i.id}"></canvas>
          <strong>${escapar(i.nome)}</strong>
          <small>${escapar(textoBonus(i.bonus))}</small>
          ${estado}
        </button>`;
    }).join("");
    grade.querySelectorAll("[data-item]").forEach((b) => b.addEventListener("click", () => {
      escolhidoForja = b.dataset.item;
      Som.efeito("clique");
      const peca = itemDoCatalogo(escolhidoForja);
      if (podeForjar(peca)) dizer("Tens tudo para essa! É só mandar que eu bato o martelo.");
      else if (!possuiCosmetico(peca.id)) dizer("Olha a receita aí do lado: o que estiver em vermelho ainda falta caçar.");
      desenharVitrine();
      desenharDetalhe();
    }));
  }

  function desenharTudo() {
    desenharOuro();
    desenharVitrine();
    desenharDetalhe();
  }

  async function forjar(item) {
    const botao = secao.querySelector("[data-forjar]");
    if (botao) botao.disabled = true;
    try {
      await acaoJogador("forjar", { item: item.id });
    } catch (erro) {
      dizer(erro.message);
      Som.efeito("erro");
      desenharTudo();
      return;
    }
    cerimoniaDaForja(item, () => {
      dizer(sortear(FERREIRO_DA_FORJA.forjou));
      desenharTudo();
    });
    desenharTudo();
  }

  // o laço que anima as peças (30 quadros por segundo bastam) e o herói do detalhe
  let ultimo = 0;
  const animar = (agora) => {
    if (!tela.contains(secao)) return;
    if (document.hidden || agora - ultimo < 32) {
      requestAnimationFrame(animar);
      return;
    }
    ultimo = agora;
    const t = agora / 1000;
    secao.querySelectorAll("canvas[data-desenho]").forEach((c) => {
      const item = itemDoCatalogo(c.dataset.desenho);
      if (item) desenharItemNaVitrine(c.getContext("2d"), item, t, c.width);
    });
    const heroi = secao.querySelector("canvas[data-heroi]");
    const item = heroi && itemDoCatalogo(heroi.dataset.heroi);
    if (item) {
      const ctx = heroi.getContext("2d");
      const escolhas = { ...progresso.avatar, ...item.avatar };
      ctx.clearRect(0, 0, heroi.width, heroi.height);
      if (item.raridade !== "comum") brilhoRedondo(ctx, 32, 34, 22, LUZ_RARIDADE[item.raridade], 0.08 + Math.sin(t * 3) * 0.03);
      const y0 = 64 - PE_HEROI - 6 + Math.round(Math.sin(t * 2) * 1);
      ctx.drawImage(heroiParado(escolhas), 16, y0);
      desenharEfeitosHeroi(ctx, escolhas, t, 16, y0, "baixo");
    }
    requestAnimationFrame(animar);
  };
  desenharTudo();
  requestAnimationFrame(animar);
}

// ---------- a cerimônia: três marteladas, o clarão e a peça nova girando no brilho da raridade ----------
function cerimoniaDaForja(item, aoFechar) {
  const tema = temasDaForja().find((t) => t.id === item.forja?.tema);
  const cor = hexParaRgb(tema?.cor || "#ffd166").join(", ");
  const el = criar(`
    <div class="cerimonia-forja raridade-${item.raridade} ${tema?.mitico ? "mitico" : ""}" role="dialog" aria-label="Peça forjada">
      <div class="palco-cerimonia">
        <canvas class="pixel" width="160" height="160" data-cerimonia></canvas>
        <div class="texto-forjado">
          <small>${tema?.mitico ? "✦ Mítico ✦" : `✦ ${RARIDADES_ITEM[item.raridade]} ✦`}</small>
          <b>${escapar(item.nome)}</b>
          ${Object.keys(item.bonus || {}).length ? `<p>${escapar(textoBonus(item.bonus))}</p>` : ""}
          <div class="acoes">
            <button class="botao" type="button" data-vestir>Vestir agora ✨</button>
            <button class="botao botao-fantasma" type="button" data-fechar>Guardar na mochila</button>
          </div>
        </div>
      </div>
    </div>`);
  document.body.append(el);
  const canvas = el.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const inicio = performance.now();
  const MARTELADAS = [0.45, 0.95, 1.45];
  const REVELA = 1.85;
  let tocadas = 0;
  let revelada = false;
  const fechar = () => {
    el.classList.add("saindo");
    setTimeout(() => el.remove(), 250);
    aoFechar?.();
  };
  el.querySelector("[data-fechar]").addEventListener("click", fechar);
  el.querySelector("[data-vestir]").addEventListener("click", () => {
    vestir(item);
    atualizarBonusDoServidor();
    fechar();
  });
  const quadro = (agora) => {
    if (!el.isConnected) return;
    const t = (agora - inicio) / 1000;
    if (tocadas < MARTELADAS.length && t >= MARTELADAS[tocadas]) {
      Som.efeito(tocadas === MARTELADAS.length - 1 ? "critico" : "impacto");
      el.classList.remove("tremendo");
      void el.offsetWidth;
      el.classList.add("tremendo");
      tocadas++;
    }
    if (!revelada && t >= REVELA) {
      revelada = true;
      el.classList.add("revelada");
      Som.efeito("evolucao");
      if (item.raridade === "lendario") chuvaDeEstrelas(tema?.mitico ? 90 : 60);
      else if (item.raridade === "epico") chuvaDeEstrelas(30);
    }
    ctx.clearRect(0, 0, 160, 160);
    if (t < REVELA) {
      ctx.save();
      ctx.scale(2, 2);
      // a bigorna, a peça em brasa na cor da linhagem e o martelo subindo e descendo
      brilhoRedondo(ctx, 40, 50, 30, cor, 0.08 + Math.min(1, t / REVELA) * 0.12);
      retangulo(ctx, 22, 52, 36, 6, "#4a4a55");
      retangulo(ctx, 18, 52, 6, 4, "#4a4a55");
      retangulo(ctx, 22, 51, 34, 1, "#8a8b99");
      retangulo(ctx, 30, 58, 20, 6, "#2b2b35");
      retangulo(ctx, 26, 64, 28, 8, "#5c3418");
      const calor = Math.min(1, t / REVELA);
      retangulo(ctx, 30, 48, 20, 3, calor > 0.66 ? "#fff3b0" : calor > 0.33 ? "#ffd166" : "#ff7a1a");
      retangulo(ctx, 32, 47, 16, 1, `rgba(${cor}, 0.9)`);
      // o martelo: cai rápido em cada martelada e sobe devagar
      const proxima = MARTELADAS.find((m) => m >= t - 0.12) ?? MARTELADAS[MARTELADAS.length - 1];
      const falta = Math.max(0, proxima - t);
      const angulo = falta > 0.3 ? -1.1 : -1.1 * (falta / 0.3);
      ctx.save();
      ctx.translate(62, 46);
      ctx.rotate(angulo);
      retangulo(ctx, -2, -1, 22, 3, "#8b5a2b");
      retangulo(ctx, -10, -5, 9, 11, "#6b6c7a");
      retangulo(ctx, -10, -5, 9, 2, "#c4cbd8");
      ctx.restore();
      // as faíscas de cada martelada
      MARTELADAS.forEach((m) => {
        const v = (t - m) / 0.45;
        if (v < 0 || v > 1) return;
        for (let i = 0; i < 14; i++) {
          const a = -Math.PI * (0.05 + (i / 14) * 0.9);
          const r = v * (14 + (i % 4) * 5);
          ctx.fillStyle = i % 3 ? `rgba(255, 209, 102, ${1 - v})` : `rgba(${cor}, ${1 - v})`;
          ctx.fillRect(Math.round(40 + Math.cos(a) * r), Math.round(48 + Math.sin(a) * r + v * v * 10), 1, 1);
        }
      });
      ctx.restore();
      // o clarão que cresce antes da peça aparecer
      if (t > REVELA - 0.3) {
        ctx.fillStyle = `rgba(255, 255, 255, ${(t - (REVELA - 0.3)) / 0.3})`;
        ctx.fillRect(0, 0, 160, 160);
      }
    } else {
      desenharItemNaVitrine(ctx, item, t, 160);
      const clarao = 1 - (t - REVELA) / 0.4;
      if (clarao > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${clarao})`;
        ctx.fillRect(0, 0, 160, 160);
      }
    }
    requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);
}
