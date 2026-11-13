"""Moderação do salão multijogador, pela linha de comando (no servidor: cd /opt/rpgia && sudo -u rpgia .venv/bin/python moderar.py ...).

    python moderar.py recados             os recados do Quadro de Anotações (id, autor, texto)
    python moderar.py apagar <id>         apaga um recado (some das telas em até 20 s)
    python moderar.py denuncias [n]       as últimas denúncias (recados, falas do chat e perguntas de duelo)
    python moderar.py testar "<texto>"    mostra se o filtro deixa um texto passar (e por quê)
"""

import sys

from dotenv import load_dotenv

load_dotenv()

import banco  # noqa: E402
import moderacao  # noqa: E402


def main(argumentos):
    if not argumentos:
        print(__doc__)
        return 0
    comando, resto = argumentos[0], argumentos[1:]
    banco.iniciar()
    if comando == "recados":
        for r in banco.recados_visiveis(200):
            print(f"#{r['id']:<5} {r['quando']}  {r['nome']}: {r['texto']!r}")
        return 0
    if comando == "apagar" and resto and resto[0].isdigit():
        print("Apagado." if banco.apagar_recado(int(resto[0])) else "Não achei esse recado.")
        return 0
    if comando == "denuncias":
        limite = int(resto[0]) if resto and resto[0].isdigit() else 30
        for d in banco.listar_denuncias(limite):
            print(f"{d['criado_em']}  [{d['alvo_tipo']} {d['alvo_id']}]  por {d['quem_nome'] or '?'}\n    {d['texto']}")
        return 0
    if comando == "testar" and resto:
        motivo = moderacao.motivo_para_recusar(" ".join(resto))
        print(f"Recusado: {motivo}" if motivo else "Passa no filtro.")
        return 0
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
