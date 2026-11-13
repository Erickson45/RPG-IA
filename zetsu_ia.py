"""Integração OPCIONAL com IA de verdade (Claude).

O jogo funciona 100% sem isso. Se ANTHROPIC_API_KEY estiver no .env,
o Zetsu passa a responder perguntas livres e a dar segunda opinião
sobre os prompts dos alunos.
"""

import os

try:
    import anthropic
except ImportError:  # pacote não instalado: o jogo segue no modo roteirizado
    anthropic = None

MODELO = os.getenv("ZETSU_MODELO", "claude-opus-5-5")

PERSONALIDADE = """Você é o Zetsu, mago e professor da Academia Arcana de Elyndor, num jogo \
educativo para iniciantes brasileiros. No Reino de Elyndor, conhecimento é poder: desde a \
Grande Ruptura a Essência do Conhecimento vive partida, e dela nasceu a IA, uma magia nova que os \
aprendizes dominam para automatizar o trabalho; use essa metáfora com leveza, sem atrapalhar \
a explicação técnica. Fale em português do Brasil, com tom leve, encorajador e \
direto, chamando o aluno de "aprendiz". Explique sem jargão; quando usar um termo técnico, \
explique-o em uma frase. Respostas curtas: no máximo 3 parágrafos pequenos. \
Se o aluno pedir para colar dados sigilosos ou de clientes numa IA, oriente a não fazer isso."""

_cliente = None


def ativa():
    return anthropic is not None and bool(os.getenv("ANTHROPIC_API_KEY"))


def _cliente_anthropic():
    global _cliente
    if _cliente is None:
        _cliente = anthropic.Anthropic(timeout=60.0)
    return _cliente


def _perguntar(mensagem):
    try:
        resposta = _cliente_anthropic().beta.messages.create(
            model=MODELO,
            max_tokens=2000,
            system=PERSONALIDADE,
            output_config={"effort": "low"},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            messages=[{"role": "user", "content": mensagem}],
        )
    except anthropic.AuthenticationError:
        return "Minha chave de IA não funcionou. Confere a ANTHROPIC_API_KEY no arquivo .env!"
    except anthropic.RateLimitError:
        return "Calma, aprendiz! Muitas perguntas de uma vez. Espera um pouquinho e tenta de novo."
    except anthropic.APIConnectionError:
        return "Não consegui falar com a IA agora. Confere tua internet e tenta de novo."
    except anthropic.APIStatusError as erro:
        return f"A IA respondeu com erro ({erro.status_code}). Tenta de novo daqui a pouco."

    if resposta.stop_reason == "refusal":
        return "Essa eu não posso responder, aprendiz. Bora voltar para os estudos?"
    return "".join(bloco.text for bloco in resposta.content if bloco.type == "text").strip()


def opinar_sobre_prompt(cenario, prompt):
    return _perguntar(
        "Um aluno escreveu um prompt para o cenário abaixo. Avalie como professor: "
        "diga o que ficou bom, o que melhorar (seguindo Papel, Contexto, Tarefa e Formato) "
        "e mostre uma versão melhorada do prompt.\n\n"
        f"CENÁRIO:\n{cenario}\n\nPROMPT DO ALUNO:\n{prompt}"
    )


def opinar_sobre_pitch(ideia, pitch):
    return _perguntar(
        "Um aluno fez o pitch de 1 minuto do projeto final dele. Reaja como um investidor "
        "simpático e exigente: diga o que convenceu, o que ficou fraco e dê uma sugestão "
        "concreta para melhorar a abertura ou o fechamento.\n\n"
        f"A IDEIA (canvas do aluno):\n{ideia}\n\nO PITCH:\n{pitch}"
    )
