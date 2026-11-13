"""O currículo da classe e o Grimório de Erros.

Currículo: cada degrau do caminho da classe tem uma skill (curriculo.json), com uma lição e perguntas
próprias (perguntas_classes.json). As batalhas puxam essas perguntas para o herói daquela classe
(conteudo.sortear_pergunta) e cada acerto conta para dominar a skill: com ACERTOS_PARA_DOMINAR acertos,
ela fica "dominada" no Livro do Herói.

Grimório de Erros: cada pergunta errada numa batalha volta depois, como um "eco" (repetição espaçada).
Acertar o eco empurra a próxima volta para mais longe (INTERVALOS); acertar a última vez a apaga do
grimório. Errar de novo recomeça do primeiro intervalo.
"""

import random
import time

import habilidades
from conteudo import CURRICULO, PERGUNTAS_CLASSE, SKILLS, base_da_ref, skill_da_ref

ACERTOS_PARA_DOMINAR = 5
# quanto tempo cada eco espera para voltar: 10 minutos, 6 horas e 2 dias (depois sai do grimório)
INTERVALOS = [10 * 60, 6 * 3600, 2 * 86400]
CHANCE_DE_ECO = 0.3  # numa rodada com eco vencido, a chance de ele ser a pergunta
MAXIMO_ERROS = 60


def heroi_do(progresso):
    """O que o sorteio precisa saber do herói: classe principal, subclasse e degrau do caminho."""
    principal = habilidades.principal_do(progresso)
    if not principal:
        return None
    classe = habilidades.classe_do(progresso)
    heroi = {"principal": principal["id"], "classe": classe["id"] if classe else None, "degrau": habilidades.degrau(progresso)}
    # a skill do degrau atual já dominada deixa de ser o foco das batalhas: passa a valer como revisão
    atual = next((s for s in CURRICULO["skills"] if s["degrau"] == heroi["degrau"] and da_classe(s, heroi)), None)
    heroi["atualDominada"] = bool(atual) and progresso.get("skills", {}).get(atual["id"], 0) >= ACERTOS_PARA_DOMINAR
    return heroi


def skills_do_heroi(progresso):
    """As skills do caminho do herói, em ordem de degrau: a de iniciante da classe principal e as 4 da subclasse."""
    heroi = heroi_do(progresso)
    if not heroi:
        return []
    return sorted([s for s in CURRICULO["skills"] if s.get("principal") == heroi["principal"] or (heroi["classe"] and s.get("classe") == heroi["classe"])],
                  key=lambda s: s["degrau"])


def contar_acerto(progresso, ref):
    """Um acerto numa pergunta do currículo: soma na skill. Devolve a skill se ela acabou de ser dominada."""
    skill = skill_da_ref(ref)
    if not skill:
        return None
    contagem = progresso.setdefault("skills", {})
    antes = contagem.get(skill["id"], 0)
    contagem[skill["id"]] = antes + 1
    return skill if antes + 1 == ACERTOS_PARA_DOMINAR else None


def anotar_erro(progresso, ref):
    """Errou: a pergunta entra (ou volta ao começo) no Grimório de Erros."""
    base = base_da_ref(ref)
    erros = [e for e in progresso.setdefault("grimorioErros", []) if e["ref"] != base]
    erros.append({"ref": base, "passo": 0, "volta": time.time() + INTERVALOS[0]})
    progresso["grimorioErros"] = erros[-MAXIMO_ERROS:]


def anotar_acerto_do_eco(progresso, ref):
    """Acertou uma pergunta que estava no grimório: ela volta mais tarde ou, na última vez, sai de vez.
    Devolve "dominado" quando sai, "adiado" quando só foi empurrada e None se não estava lá."""
    base = base_da_ref(ref)
    for erro in progresso.get("grimorioErros", []):
        if erro["ref"] != base:
            continue
        erro["passo"] += 1
        if erro["passo"] >= len(INTERVALOS):
            progresso["grimorioErros"].remove(erro)
            progresso["ecosVencidos"] = progresso.get("ecosVencidos", 0) + 1
            return "dominado"
        erro["volta"] = time.time() + INTERVALOS[erro["passo"]]
        return "adiado"
    return None


def eco_vencido(progresso, evitar=()):
    """Um erro do grimório que já pode voltar (o mais atrasado), na sorte de CHANCE_DE_ECO."""
    agora = time.time()
    evitar = {base_da_ref(r) for r in evitar if r}
    prontos = [e for e in progresso.get("grimorioErros", []) if e["volta"] <= agora and e["ref"] not in evitar]
    if not prontos or random.random() >= CHANCE_DE_ECO:
        return None
    return min(prontos, key=lambda e: e["volta"])["ref"]


def resumo(progresso):
    """Para o Livro do Herói: as skills do caminho (liberada, em estudo, dominada), o foco e o estilo da
    classe, e o Grimório de Erros (quantos esperam, quantos já voltam agora, quantos foram vencidos)."""
    heroi = heroi_do(progresso)
    if not heroi:
        return None
    contagem = progresso.get("skills", {})
    perguntas_por_skill = {}
    for p in PERGUNTAS_CLASSE:
        perguntas_por_skill[p["skill"]] = perguntas_por_skill.get(p["skill"], 0) + 1
    skills = [{
        **{k: s.get(k) for k in ("id", "nome", "icone", "degrau", "resumo", "dicas", "fonte")},
        "acertos": contagem.get(s["id"], 0), "dominar": ACERTOS_PARA_DOMINAR, "perguntas": perguntas_por_skill.get(s["id"], 0),
        "liberada": s["degrau"] <= heroi["degrau"], "atual": s["degrau"] == heroi["degrau"],
        "dominada": contagem.get(s["id"], 0) >= ACERTOS_PARA_DOMINAR,
    } for s in skills_do_heroi(progresso)]
    foco = CURRICULO["focos"].get(heroi["classe"] or "", CURRICULO["focos"].get(heroi["principal"], ""))
    agora = time.time()
    erros = progresso.get("grimorioErros", [])
    return {
        "degrau": heroi["degrau"], "foco": foco, "estilo": CURRICULO["estilos"].get(heroi["principal"], {}),
        "prova": situacao_da_prova(progresso), "provaAberta": bool(progresso.get("prova")),
        "skills": skills, "erros": {"total": len(erros), "prontos": sum(1 for e in erros if e["volta"] <= agora),
                                    "vencidos": progresso.get("ecosVencidos", 0)},
    }


def skill_por_id(skill_id):
    return SKILLS.get(skill_id)


# ---------- a Prova do Degrau ----------
# Para subir de degrau não basta o nível: o herói faz uma prova de 10 perguntas do currículo da classe
# dele. Ela abre quando a skill do degrau atual está dominada e vai do fácil ao difícil: começa revendo
# as skills de baixo (dificuldade 1), passa por situações de aplicar (2) e termina nos casos difíceis da
# skill nova (3). Aprova com NOTA_APROVACAO acertos; reprovou, espera ESPERA_REPROVADO para tentar de novo.
PERGUNTAS_DA_PROVA = 10
NOTA_APROVACAO = 7
ESPERA_REPROVADO = 10 * 60
# a dificuldade de cada pergunta da prova e de onde ela sai ("antes": skills de degraus abaixo; "atual":
# a skill do degrau que está sendo provado)
ROTEIRO_DA_PROVA = [(1, "antes"), (1, "antes"), (1, "atual"), (2, "antes"), (2, "atual"), (2, "atual"),
                    (2, "atual"), (3, "atual"), (3, "atual"), (3, "atual")]


def dificuldade(pergunta):
    return pergunta.get("dificuldade", 2)


def provas_feitas(progresso):
    return set(progresso.get("provas") or [])


def situacao_da_prova(progresso):
    """A prova do degrau atual: se já pode fazer e, se não, por quê (para o Livro do Herói mostrar)."""
    heroi = heroi_do(progresso)
    if not heroi:
        return None
    d = heroi["degrau"]
    classe = habilidades.classe_do(progresso)
    ultimo = 1 + len(classe["evolucoes"]) if classe else None
    if ultimo and d >= ultimo:
        return {"degrau": d, "pode": False, "fim": True, "motivo": "Tu chegaste ao topo do caminho da tua classe."}
    skill = next((s for s in skills_do_heroi(progresso) if s["degrau"] == d), None)
    base = {"degrau": d, "skill": skill and {"id": skill["id"], "nome": skill["nome"], "icone": skill.get("icone")},
            "aprovada": d in provas_feitas(progresso), "fim": False}
    if base["aprovada"]:
        return {**base, "pode": False, "motivo": "Prova aprovada! Agora é cumprir os outros requisitos do degrau."}
    acertos = progresso.get("skills", {}).get(skill["id"], 0) if skill else ACERTOS_PARA_DOMINAR
    if acertos < ACERTOS_PARA_DOMINAR:
        return {**base, "pode": False, "motivo": f"Domina a skill do degrau primeiro ({acertos}/{ACERTOS_PARA_DOMINAR} acertos nas batalhas)."}
    espera = progresso.get("provaEspera") or 0
    if espera > time.time():
        return {**base, "pode": False, "espera": round(espera - time.time()), "motivo": "Teu mestre pediu para estudar mais um pouco antes de tentar de novo."}
    return {**base, "pode": True, "motivo": "Tu estás pronto para a prova!"}


def montar_prova(progresso):
    """As 10 refs da prova, na ordem do roteiro (fácil → difícil), sem repetir pergunta."""
    heroi = heroi_do(progresso)
    d = heroi["degrau"]
    minhas = [(i, p) for i, p in enumerate(PERGUNTAS_CLASSE) if p["degrau"] <= d and da_classe(p, heroi)]
    atual = [x for x in minhas if x[1]["degrau"] == d]
    antes = [x for x in minhas if x[1]["degrau"] < d] or atual
    usadas = set()
    refs = []
    for nivel, origem in ROTEIRO_DA_PROVA:
        grupo = antes if origem == "antes" else atual
        # a dificuldade pedida; se acabou, a mais perto dela no mesmo grupo; se o grupo acabou, qualquer uma
        candidatas = sorted((x for x in grupo if x[0] not in usadas), key=lambda x: (abs(dificuldade(x[1]) - nivel), random.random()))
        candidatas = candidatas or sorted((x for x in minhas if x[0] not in usadas), key=lambda x: random.random())
        if not candidatas:
            break
        i, p = candidatas[0]
        usadas.add(i)
        refs.append(f"classe:{p['degrau']}:{i}")
    return refs


def da_classe(pergunta, heroi):
    if pergunta.get("classe"):
        return pergunta["classe"] == heroi.get("classe")
    return pergunta.get("principal") == heroi.get("principal")
