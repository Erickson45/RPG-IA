"""Ponto de entrada do jogo publicado (servidor WSGI da hospedagem, ex.: PythonAnywhere).

No PythonAnywhere, o arquivo WSGI da aba "Web" deve ter só isto (troque <usuario> pelo seu usuário):

    import sys
    sys.path.insert(0, "/home/<usuario>/academia-zetsu")
    from wsgi import application

Aqui o modo debug fica sempre desligado (o depurador do Flask deixaria qualquer um rodar código no servidor).
"""

import os
import sys
from pathlib import Path

PASTA = Path(__file__).resolve().parent
sys.path.insert(0, str(PASTA))
os.chdir(PASTA)  # o .env e a pasta dados/ ficam ao lado do jogo
os.environ.pop("FLASK_DEBUG", None)

from app import app as application  # noqa: E402

application.debug = False
