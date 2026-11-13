"""Backup do banco do jogo: uma cópia por dia em dados/backups/, guardando as BACKUPS_GUARDADOS mais novas.

Usa a cópia online do SQLite (funciona com o jogo rodando e jogadores gravando). No PythonAnywhere,
agende como tarefa diária ("Tasks"): python3.11 /home/<usuario>/academia-zetsu/backup_banco.py
"""

import sqlite3
from contextlib import closing
from datetime import datetime, timezone

import banco

BACKUPS_GUARDADOS = 14


def fazer_backup():
    pasta = banco.CAMINHO.parent / "backups"
    pasta.mkdir(parents=True, exist_ok=True)
    destino = pasta / f"academia-{datetime.now(timezone.utc):%Y-%m-%d}.db"
    with closing(sqlite3.connect(destino)) as copia:
        banco.conectar().backup(copia)
    banco.fechar()
    antigos = sorted(pasta.glob("academia-*.db"))[:-BACKUPS_GUARDADOS]
    for arquivo in antigos:
        arquivo.unlink()
    return destino, len(antigos)


if __name__ == "__main__":
    caminho, apagados = fazer_backup()
    print(f"backup salvo em {caminho} ({caminho.stat().st_size // 1024} KB); {apagados} antigo(s) apagado(s)")
