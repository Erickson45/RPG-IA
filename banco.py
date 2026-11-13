"""Banco de dados do jogo (SQLite): os jogadores, o progresso de cada um, as batalhas e o histórico.

Todo progresso fica ligado a um id de jogador, mesmo no single-player: é o primeiro passo para,
um dia, existir multiplayer sem reescrever tudo.
"""

import hashlib
import json
import os
import random
import sqlite3
import threading
import time
import unicodedata
import uuid
from contextlib import closing, contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

CAMINHO = Path(os.environ.get("BANCO_ARQUIVO") or Path(__file__).parent / "dados" / "academia.db")
# Quantos registros de histórico ficam por jogador (os mais antigos são apagados de vez em quando) e por
# quanto tempo as batalhas já encerradas ficam guardadas.
HISTORICO_POR_JOGADOR = 300
DIAS_BATALHAS_ENCERRADAS = 3
ESPERA_DO_BANCO = 15  # segundos esperando a vez quando outro processo está gravando

ESQUEMA = """
CREATE TABLE IF NOT EXISTS jogadores (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL DEFAULT '',
    progresso TEXT NOT NULL,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
);
-- tudo que muda o progresso de verdade (recompensas, compras, batalhas) fica registrado
CREATE TABLE IF NOT EXISTS historico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jogador_id TEXT NOT NULL,
    quando TEXT NOT NULL,
    tipo TEXT NOT NULL,
    detalhe TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS historico_jogador ON historico (jogador_id, quando);
CREATE TABLE IF NOT EXISTS batalhas (
    id TEXT PRIMARY KEY,
    jogador_id TEXT NOT NULL,
    tipo_monstro TEXT NOT NULL,
    monstro_id TEXT NOT NULL,
    vida INTEGER NOT NULL,
    pergunta_atual TEXT,
    encerrada INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL,
    mana INTEGER NOT NULL DEFAULT 0,
    efeitos TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS batalhas_jogador ON batalhas (jogador_id, encerrada);
-- contadores dos limites por endereço (criar herói, pedir opinião da IA)
CREATE TABLE IF NOT EXISTS limites (
    chave TEXT NOT NULL,
    janela INTEGER NOT NULL,
    contagem INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (chave, janela)
);
-- multijogador: os recados do Quadro de Anotações do salão (somem sozinhos depois de DIAS_DOS_RECADOS)
CREATE TABLE IF NOT EXISTS recados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jogador_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    texto TEXT NOT NULL,
    cor TEXT NOT NULL DEFAULT 'amarelo',
    criado_em TEXT NOT NULL,
    oculto INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS recados_quando ON recados (oculto, criado_em);
-- denúncias de recados, de jogadores (o chat) e de perguntas de duelo; cada um denuncia cada coisa uma vez
CREATE TABLE IF NOT EXISTS denuncias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alvo_tipo TEXT NOT NULL,
    alvo_id TEXT NOT NULL,
    quem_id TEXT NOT NULL,
    texto TEXT NOT NULL DEFAULT '',
    criado_em TEXT NOT NULL,
    UNIQUE (alvo_tipo, alvo_id, quem_id)
);
-- os duelos da arena já encerrados (o placar de cada herói e o ranking da Sala de Troféus)
CREATE TABLE IF NOT EXISTS duelos (
    id TEXT PRIMARY KEY,
    modo TEXT NOT NULL,
    rodadas INTEGER NOT NULL,
    a_id TEXT NOT NULL,
    b_id TEXT NOT NULL,
    pontos_a INTEGER NOT NULL,
    pontos_b INTEGER NOT NULL,
    vencedor_id TEXT,
    motivo TEXT NOT NULL DEFAULT '',
    quando TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS duelos_vencedor ON duelos (vencedor_id, quando);
-- as Casas do multijogador: quanto cada herói somou para a casa dele em cada semana (a Taça das Casas)
CREATE TABLE IF NOT EXISTS casas_pontos (
    semana TEXT NOT NULL,
    jogador_id TEXT NOT NULL,
    casa TEXT NOT NULL,
    pontos INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (semana, jogador_id, casa)
);
CREATE INDEX IF NOT EXISTS casas_pontos_semana ON casas_pontos (semana, casa);
"""
DIAS_DOS_RECADOS = 7
# colunas que chegaram depois: bancos antigos ganham elas ao subir o servidor
COLUNAS_NOVAS = {
    "batalhas": {"mana": "INTEGER NOT NULL DEFAULT 0", "efeitos": "TEXT NOT NULL DEFAULT '{}'"},
    # o nome do herói "achatado" (sem acento, sem maiúscula, espaços únicos): é por ele que se confere se o
    # nome já é de outro herói ("Ana", "ana" e "Ána" são o mesmo nome)
    "jogadores": {"nome_chave": "TEXT NOT NULL DEFAULT ''"},
}


def chave_do_nome(nome):
    """O nome como ele é comparado: sem acentos, sem maiúsculas e com os espaços normalizados."""
    sem_acento = "".join(c for c in unicodedata.normalize("NFKD", str(nome or "")) if not unicodedata.combining(c))
    return " ".join(sem_acento.casefold().split())


def agora():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class ConexaoReutilizada(sqlite3.Connection):
    """Conexão que fica aberta e é reaproveitada pela mesma linha de execução: o "close" de quem usa
    (with closing(...)) não fecha de verdade. Abrir e fechar a cada operação custava ~5 ms, porque no modo
    WAL fechar a última conexão consolida e apaga o log."""

    def close(self):
        pass

    def fechar_de_verdade(self):
        super().close()


_conexoes = threading.local()


def fechar():
    """Fecha de verdade a conexão desta linha de execução (scripts que vão apagar ou mover o arquivo)."""
    conexao = getattr(_conexoes, "conexao", None)
    if conexao is not None:
        conexao.fechar_de_verdade()
        _conexoes.conexao = None


def conectar():
    conexao = getattr(_conexoes, "conexao", None)
    if conexao is not None and getattr(_conexoes, "caminho", None) == CAMINHO:
        return conexao
    CAMINHO.parent.mkdir(parents=True, exist_ok=True)
    # timeout: com vários processos (o servidor publicado), quem chega enquanto outro grava espera a vez
    conexao = sqlite3.connect(CAMINHO, timeout=ESPERA_DO_BANCO, factory=ConexaoReutilizada)
    conexao.row_factory = sqlite3.Row
    # WAL (ligado em iniciar) com synchronous NORMAL: seguro contra corrupção e bem mais rápido para gravar
    conexao.execute("PRAGMA synchronous = NORMAL")
    _conexoes.conexao, _conexoes.caminho = conexao, CAMINHO
    return conexao


def iniciar():
    with closing(conectar()) as conexao:
        # WAL: leituras não esperam as gravações (fica gravado no arquivo, vale para todas as conexões)
        conexao.execute("PRAGMA journal_mode = WAL")
        conexao.executescript(ESQUEMA)
        for tabela, colunas in COLUNAS_NOVAS.items():
            existentes = {linha["name"] for linha in conexao.execute(f"PRAGMA table_info({tabela})")}
            for nome, definicao in colunas.items():
                if nome not in existentes:
                    # no servidor sobem vários processos juntos: se outro criou a coluna no meio do caminho,
                    # o "duplicate column" aqui é esperado (e um processo que falha ao subir derruba o gunicorn)
                    try:
                        conexao.execute(f"ALTER TABLE {tabela} ADD COLUMN {nome} {definicao}")
                    except sqlite3.OperationalError as erro:
                        if "duplicate column" not in str(erro).lower():
                            raise
        # os heróis de antes da coluna nome_chave ganham a chave deles (uma vez só)
        antigos = conexao.execute("SELECT id, nome FROM jogadores WHERE nome_chave = '' AND nome != ''").fetchall()
        conexao.executemany("UPDATE jogadores SET nome_chave = ? WHERE id = ?", [(chave_do_nome(n), i) for i, n in antigos])
        conexao.execute("CREATE INDEX IF NOT EXISTS jogadores_nome_chave ON jogadores (nome_chave)")
        conexao.commit()
    limpar()


def limpar():
    """Faxina: batalhas encerradas há dias e contadores de limite velhos."""
    limite = (datetime.now(timezone.utc) - timedelta(days=DIAS_BATALHAS_ENCERRADAS)).isoformat(timespec="seconds")
    with closing(conectar()) as conexao, conexao:
        conexao.execute("DELETE FROM batalhas WHERE encerrada = 1 AND criado_em < ?", (limite,))
        conexao.execute("DELETE FROM limites WHERE janela < ?", (int(time.time()) - 86400,))
        # recados vencidos saem do quadro; as denúncias ficam 30 dias (para o Erickson poder conferir)
        velhos = (datetime.now(timezone.utc) - timedelta(days=DIAS_DOS_RECADOS)).isoformat(timespec="seconds")
        conexao.execute("DELETE FROM recados WHERE criado_em < ?", (velhos,))
        mes = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat(timespec="seconds")
        conexao.execute("DELETE FROM denuncias WHERE criado_em < ?", (mes,))


# ---------- trava por jogador ----------
# Cada ação lê o progresso, muda e grava de volta. Com o servidor publicado em mais de um processo, dois
# pedidos do mesmo jogador ao mesmo tempo podiam se atropelar (um apagava a mudança do outro). A trava é um
# arquivo do sistema (vale entre processos) e é dividida em faixas: jogadores diferentes quase nunca esperam
# um pelo outro, e o mesmo jogador é sempre atendido um pedido de cada vez.
FAIXAS_DE_TRAVA = 64
_travas_locais = [threading.Lock() for _ in range(FAIXAS_DE_TRAVA)]


def _faixa(jogador_id):
    return int(hashlib.sha1(str(jogador_id).encode()).hexdigest(), 16) % FAIXAS_DE_TRAVA


def _travar_arquivo(arquivo):
    if os.name == "nt":
        import msvcrt
        arquivo.seek(0)
        while True:
            try:
                msvcrt.locking(arquivo.fileno(), msvcrt.LK_LOCK, 1)
                return
            except OSError:
                time.sleep(0.01)  # o LK_LOCK do Windows desiste depois de ~10 s: tenta de novo
    import fcntl
    fcntl.flock(arquivo.fileno(), fcntl.LOCK_EX)


def _soltar_arquivo(arquivo):
    if os.name == "nt":
        import msvcrt
        arquivo.seek(0)
        msvcrt.locking(arquivo.fileno(), msvcrt.LK_UNLCK, 1)
        return
    import fcntl
    fcntl.flock(arquivo.fileno(), fcntl.LOCK_UN)


@contextmanager
def trava_do_jogador(jogador_id):
    faixa = _faixa(jogador_id)
    pasta = CAMINHO.parent / "travas"
    pasta.mkdir(parents=True, exist_ok=True)
    with _travas_locais[faixa], open(pasta / f"{faixa:02d}.lock", "a+b") as arquivo:
        _travar_arquivo(arquivo)
        try:
            yield
        finally:
            _soltar_arquivo(arquivo)


# ---------- limites por endereço ----------

def contar(chave, janela_segundos):
    """Soma 1 no contador desta chave na janela de tempo atual e devolve quantas vezes já foi."""
    janela = int(time.time()) // janela_segundos * janela_segundos
    with closing(conectar()) as conexao, conexao:
        conexao.execute(
            "INSERT INTO limites (chave, janela, contagem) VALUES (?, ?, 1) "
            "ON CONFLICT(chave, janela) DO UPDATE SET contagem = contagem + 1", (chave, janela),
        )
        return conexao.execute("SELECT contagem FROM limites WHERE chave = ? AND janela = ?", (chave, janela)).fetchone()["contagem"]


# ---------- jogadores ----------

def criar_jogador(progresso):
    jogador_id = uuid.uuid4().hex
    momento = agora()
    with closing(conectar()) as conexao, conexao:
        conexao.execute(
            "INSERT INTO jogadores (id, nome, nome_chave, progresso, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?)",
            (jogador_id, progresso.get("nome", ""), chave_do_nome(progresso.get("nome", "")),
             json.dumps(progresso, ensure_ascii=False), momento, momento),
        )
    return jogador_id


def nome_em_uso(nome, exceto_id=None):
    """Se outro herói (que não seja exceto_id) já usa esse nome, do jeito que os nomes são comparados."""
    chave = chave_do_nome(nome)
    if not chave:
        return False
    with closing(conectar()) as conexao:
        linha = conexao.execute(
            "SELECT 1 FROM jogadores WHERE nome_chave = ? AND id != ? LIMIT 1", (chave, exceto_id or ""),
        ).fetchone()
    return linha is not None


def carregar_progresso(jogador_id):
    with closing(conectar()) as conexao:
        linha = conexao.execute("SELECT progresso FROM jogadores WHERE id = ?", (jogador_id,)).fetchone()
    return json.loads(linha["progresso"]) if linha else None


def salvar_progresso(jogador_id, progresso):
    with closing(conectar()) as conexao, conexao:
        conexao.execute(
            "UPDATE jogadores SET nome = ?, nome_chave = ?, progresso = ?, atualizado_em = ? WHERE id = ?",
            (progresso.get("nome", ""), chave_do_nome(progresso.get("nome", "")), json.dumps(progresso, ensure_ascii=False), agora(), jogador_id),
        )


def apagar_jogador(jogador_id):
    """Apaga o save inteiro: o jogador, o histórico, as batalhas e os recados dele."""
    with closing(conectar()) as conexao, conexao:
        for tabela in ("historico", "batalhas", "recados", "casas_pontos"):
            conexao.execute(f"DELETE FROM {tabela} WHERE jogador_id = ?", (jogador_id,))
        conexao.execute("DELETE FROM denuncias WHERE quem_id = ?", (jogador_id,))
        conexao.execute("DELETE FROM jogadores WHERE id = ?", (jogador_id,))


def registrar(jogador_id, tipo, detalhe):
    with closing(conectar()) as conexao, conexao:
        conexao.execute(
            "INSERT INTO historico (jogador_id, quando, tipo, detalhe) VALUES (?, ?, ?, ?)",
            (jogador_id, agora(), tipo, json.dumps(detalhe, ensure_ascii=False)),
        )
        # de vez em quando, o histórico do jogador é aparado (fica só o mais recente)
        if random.random() < 0.02:
            conexao.execute(
                "DELETE FROM historico WHERE jogador_id = ? AND id NOT IN "
                "(SELECT id FROM historico WHERE jogador_id = ? ORDER BY id DESC LIMIT ?)",
                (jogador_id, jogador_id, HISTORICO_POR_JOGADOR),
            )


def historico(jogador_id, limite=50):
    with closing(conectar()) as conexao:
        linhas = conexao.execute(
            "SELECT quando, tipo, detalhe FROM historico WHERE jogador_id = ? ORDER BY id DESC LIMIT ?",
            (jogador_id, limite),
        ).fetchall()
    return [{"quando": l["quando"], "tipo": l["tipo"], "detalhe": json.loads(l["detalhe"])} for l in linhas]


# ---------- batalhas ----------

def criar_batalha(jogador_id, tipo_monstro, monstro_id, vida, mana=0):
    batalha_id = uuid.uuid4().hex
    with closing(conectar()) as conexao, conexao:
        # uma batalha por vez: as que ficaram abertas (fechou a aba no meio) são encerradas
        conexao.execute("UPDATE batalhas SET encerrada = 1 WHERE jogador_id = ? AND encerrada = 0", (jogador_id,))
        conexao.execute(
            "INSERT INTO batalhas (id, jogador_id, tipo_monstro, monstro_id, vida, mana, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (batalha_id, jogador_id, tipo_monstro, monstro_id, vida, mana, agora()),
        )
    return batalha_id


def carregar_batalha(jogador_id, batalha_id):
    """A batalha com os efeitos ativos (escudo, lâmina...) já como dicionário."""
    with closing(conectar()) as conexao:
        linha = conexao.execute(
            "SELECT * FROM batalhas WHERE id = ? AND jogador_id = ?", (batalha_id, jogador_id),
        ).fetchone()
    if not linha:
        return None
    batalha = dict(linha)
    batalha["efeitos"] = json.loads(batalha["efeitos"] or "{}")
    return batalha


def atualizar_batalha(batalha_id, **campos):
    if "efeitos" in campos:
        campos["efeitos"] = json.dumps(campos["efeitos"], ensure_ascii=False)
    colunas = ", ".join(f"{nome} = ?" for nome in campos)
    with closing(conectar()) as conexao, conexao:
        conexao.execute(f"UPDATE batalhas SET {colunas} WHERE id = ?", (*campos.values(), batalha_id))


# ---------- multijogador: o Quadro de Anotações, as denúncias e os duelos ----------

def _recado(linha):
    return {"id": linha["id"], "nome": linha["nome"], "texto": linha["texto"], "cor": linha["cor"], "quando": linha["criado_em"], "autor": linha["jogador_id"]}


def criar_recado(jogador_id, nome, texto, cor):
    with closing(conectar()) as conexao, conexao:
        cursor = conexao.execute(
            "INSERT INTO recados (jogador_id, nome, texto, cor, criado_em) VALUES (?, ?, ?, ?, ?)",
            (jogador_id, nome, texto, cor, agora()),
        )
        linha = conexao.execute("SELECT * FROM recados WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return _recado(linha)


def recados_visiveis(limite=80):
    """Os recados do quadro, do mais novo para o mais velho (sem os escondidos e os vencidos)."""
    velhos = (datetime.now(timezone.utc) - timedelta(days=DIAS_DOS_RECADOS)).isoformat(timespec="seconds")
    with closing(conectar()) as conexao:
        linhas = conexao.execute(
            "SELECT * FROM recados WHERE oculto = 0 AND criado_em >= ? ORDER BY id DESC LIMIT ?", (velhos, limite),
        ).fetchall()
    return [_recado(linha) for linha in linhas]


def recados_do_jogador(jogador_id):
    """Quantos recados o jogador tem no quadro agora e quando foi o último (ISO), para os limites."""
    with closing(conectar()) as conexao:
        linha = conexao.execute(
            "SELECT COUNT(*) AS n, MAX(criado_em) AS ultimo FROM recados WHERE jogador_id = ? AND oculto = 0", (jogador_id,),
        ).fetchone()
    return linha["n"], linha["ultimo"]


def apagar_recado(recado_id, jogador_id=None):
    """Apaga um recado (só o do próprio autor, se jogador_id vier). Devolve se apagou."""
    with closing(conectar()) as conexao, conexao:
        if jogador_id:
            cursor = conexao.execute("DELETE FROM recados WHERE id = ? AND jogador_id = ?", (recado_id, jogador_id))
        else:
            cursor = conexao.execute("DELETE FROM recados WHERE id = ?", (recado_id,))
    return cursor.rowcount > 0


def ocultar_recado(recado_id):
    with closing(conectar()) as conexao, conexao:
        conexao.execute("UPDATE recados SET oculto = 1 WHERE id = ?", (recado_id,))


def denunciar(alvo_tipo, alvo_id, quem_id, texto="", janela_horas=None):
    """Registra a denúncia (cada um denuncia cada coisa uma vez) e devolve quantas pessoas diferentes já
    denunciaram esse alvo (nas últimas janela_horas, se vier)."""
    with closing(conectar()) as conexao, conexao:
        conexao.execute(
            "INSERT OR IGNORE INTO denuncias (alvo_tipo, alvo_id, quem_id, texto, criado_em) VALUES (?, ?, ?, ?, ?)",
            (alvo_tipo, str(alvo_id), quem_id, str(texto)[:2000], agora()),
        )
        if janela_horas:
            desde = (datetime.now(timezone.utc) - timedelta(hours=janela_horas)).isoformat(timespec="seconds")
            linha = conexao.execute(
                "SELECT COUNT(*) AS n FROM denuncias WHERE alvo_tipo = ? AND alvo_id = ? AND criado_em >= ?", (alvo_tipo, str(alvo_id), desde),
            ).fetchone()
        else:
            linha = conexao.execute("SELECT COUNT(*) AS n FROM denuncias WHERE alvo_tipo = ? AND alvo_id = ?", (alvo_tipo, str(alvo_id))).fetchone()
    return linha["n"]


def listar_denuncias(limite=50):
    with closing(conectar()) as conexao:
        linhas = conexao.execute(
            "SELECT d.*, j.nome AS quem_nome FROM denuncias d LEFT JOIN jogadores j ON j.id = d.quem_id ORDER BY d.id DESC LIMIT ?", (limite,),
        ).fetchall()
    return [dict(linha) for linha in linhas]


def registrar_duelo(duelo_id, modo, rodadas, a_id, b_id, pontos_a, pontos_b, vencedor_id, motivo=""):
    with closing(conectar()) as conexao, conexao:
        conexao.execute(
            "INSERT OR REPLACE INTO duelos (id, modo, rodadas, a_id, b_id, pontos_a, pontos_b, vencedor_id, motivo, quando) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (duelo_id, modo, rodadas, a_id, b_id, pontos_a, pontos_b, vencedor_id, motivo, agora()),
        )


# ---------- o calendário do jogo (horário de Brasília) ----------
BRASILIA = timezone(timedelta(hours=-3))


def hoje():
    """A data de hoje em Brasília, "AAAA-MM-DD" (o Desafio do Dia e os limites diários viram à meia-noite daqui)."""
    return datetime.now(BRASILIA).date().isoformat()


def semana(deslocar=0):
    """A semana do jogo (de segunda a domingo, em Brasília) como "AAAA-Wnn"; deslocar=-1 é a semana passada."""
    dia = datetime.now(BRASILIA).date() + timedelta(weeks=deslocar)
    ano, numero, _ = dia.isocalendar()
    return f"{ano}-W{numero:02d}"


def inicio_da_semana(deslocar=0):
    """A segunda-feira 00:00 (Brasília) da semana, em UTC ISO (para comparar com os "quando" do banco)."""
    dia = datetime.now(BRASILIA).date() + timedelta(weeks=deslocar)
    segunda = datetime.combine(dia - timedelta(days=dia.weekday()), datetime.min.time(), BRASILIA)
    return segunda.astimezone(timezone.utc).isoformat(timespec="seconds")


# ---------- as Casas ----------

def somar_pontos_da_casa(jogador_id, casa, pontos):
    with closing(conectar()) as conexao, conexao:
        conexao.execute(
            "INSERT INTO casas_pontos (semana, jogador_id, casa, pontos) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(semana, jogador_id, casa) DO UPDATE SET pontos = pontos + excluded.pontos",
            (semana(), jogador_id, casa, int(pontos)),
        )


def placar_das_casas(semana_id=None):
    """Os pontos da semana de cada casa: {"runa": 120, ...}."""
    with closing(conectar()) as conexao:
        linhas = conexao.execute("SELECT casa, SUM(pontos) AS total FROM casas_pontos WHERE semana = ? GROUP BY casa", (semana_id or semana(),)).fetchall()
    return {l["casa"]: l["total"] for l in linhas}


def destaques_da_casa(casa, limite=5, semana_id=None):
    """Quem mais somou para a casa nesta semana (nome e pontos; o id não sai daqui)."""
    with closing(conectar()) as conexao:
        linhas = conexao.execute(
            "SELECT j.nome AS nome, c.pontos AS pontos FROM casas_pontos c JOIN jogadores j ON j.id = c.jogador_id "
            "WHERE c.semana = ? AND c.casa = ? ORDER BY c.pontos DESC LIMIT ?", (semana_id or semana(), casa, limite),
        ).fetchall()
    return [{"nome": l["nome"], "pontos": l["pontos"]} for l in linhas]


def ranking_da_semana(deslocar=0, limite=10):
    """A Liga da Semana: vitórias em duelos de segunda a domingo (com o id, que só o servidor usa)."""
    inicio, fim = inicio_da_semana(deslocar), inicio_da_semana(deslocar + 1)
    with closing(conectar()) as conexao:
        linhas = conexao.execute(
            "SELECT d.vencedor_id AS id, j.nome AS nome, COUNT(*) AS vitorias FROM duelos d JOIN jogadores j ON j.id = d.vencedor_id "
            "WHERE d.quando >= ? AND d.quando < ? GROUP BY d.vencedor_id ORDER BY vitorias DESC, MAX(d.quando) ASC LIMIT ?", (inicio, fim, limite),
        ).fetchall()
    return [{"id": l["id"], "nome": l["nome"], "vitorias": l["vitorias"]} for l in linhas]


def ranking_de_duelos(dias=30, limite=10):
    """Os heróis com mais vitórias em duelos nos últimos dias (para o quadro da Sala de Troféus)."""
    desde = (datetime.now(timezone.utc) - timedelta(days=dias)).isoformat(timespec="seconds")
    with closing(conectar()) as conexao:
        linhas = conexao.execute(
            "SELECT d.vencedor_id AS id, j.nome AS nome, COUNT(*) AS vitorias FROM duelos d JOIN jogadores j ON j.id = d.vencedor_id "
            "WHERE d.quando >= ? GROUP BY d.vencedor_id ORDER BY vitorias DESC, MAX(d.quando) ASC LIMIT ?", (desde, limite),
        ).fetchall()
    # o id fica só no servidor (o salão usa para buscar o visual dos campeões e não manda para ninguém)
    return [{"id": l["id"], "nome": l["nome"], "vitorias": l["vitorias"]} for l in linhas]
