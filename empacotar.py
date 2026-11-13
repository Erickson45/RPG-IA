"""Monta o pacote para publicar o jogo: publicar/rpg-ia.zip, só com o que o servidor precisa.

Ficam de fora o ambiente virtual, os bancos e saves locais (dados/), o .env (chave da IA), caches e a
própria pasta publicar/. Uso: python empacotar.py
"""

import zipfile
from pathlib import Path

PASTA = Path(__file__).resolve().parent
# divulgacao/ são as artes das redes sociais e site/ é a página de apresentação (vai para o GitHub Pages):
# nenhum dos dois faz parte do jogo. testes/ roda só no computador de quem desenvolve.
FORA = {".venv", "venv", "__pycache__", "dados", "publicar", "divulgacao", "site", "testes", "prototipos", ".git", ".claude", "node_modules", ".pytest_cache"}
ARQUIVOS_FORA = {".env"}
EXTENSOES_FORA = {".db", ".db-wal", ".db-shm", ".pyc", ".log", ".lock"}


def entra(caminho):
    partes = caminho.relative_to(PASTA).parts
    return (not any(p in FORA for p in partes) and caminho.name not in ARQUIVOS_FORA
            and caminho.suffix not in EXTENSOES_FORA)


def empacotar():
    destino = PASTA / "publicar" / "rpg-ia.zip"
    destino.parent.mkdir(exist_ok=True)
    arquivos = [c for c in sorted(PASTA.rglob("*")) if c.is_file() and entra(c)]
    with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as zipado:
        for caminho in arquivos:
            zipado.write(caminho, Path("academia-zetsu") / caminho.relative_to(PASTA))
    return destino, len(arquivos)


if __name__ == "__main__":
    caminho, total = empacotar()
    print(f"{caminho} pronto: {total} arquivos, {caminho.stat().st_size // 1024} KB")
