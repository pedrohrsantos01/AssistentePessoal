# Atualização obrigatória com TalkBack — evidências de 17–18/10/2026

Aceite delimitado: **rodada 12** (API 35, 4 GB), 11 fases a 200%, 76 medições de controles e 11 campos/IME. Recorte 06/M1 continuam abertos. [Relatório](../../../../analises/2026-10-17-talkback-somente-leitura.md).

- `rodada12/matrix-summary.json`: assertions do roteiro real, atualização 0.1.0/0.1.1 sem reset, originais/diagnóstico e 10 XP sem duplicação conferidos com cliente independente.
- `rodada12/reader-cleanup.json` e `installation-isolation.json`: restauração e controle journeytest antes/depois, fixture temporária removida.
- `05-readonly-return-to-opener.xml` e `08-logout-cancel-preserves-session.xml` dessa rodada: foco real de retorno; nó único/janela concordante conferidos no resumo do incremento.
- `observer-target-validation.json`/`observer-target-rejection.txt`: recusa de alvo de produto em ensaio separado, 2,29s, mesmo observador. O wrapper de diagnóstico abortou depois do resultado, conforme nota; não comprova segundo alvo.
- `api-check.json`: check completo de 17/10 preservado antes de o ensaio opt-in sobrescrever JUnit. 85 executados/oito ignorados, zero falhas/erros; 13 testes operacionais e modularidade aprovados.
- `builds.json` e `source-hashes-round12.json`: APKs/bundles finais e fontes. Pares anteriores ficam em builds-before-pixel/builds-before-cache-fix; bundles iguais reprovaram a identidade atualizada antiga.
- `rodada1` a `rodada11`: tentativas parciais/reprovadas, sem promoção a aprovação. 8/9 pararam antes de configurar leitor/fonte/app.
- `focus-regression.json`: geometria capturada e red/green do módulo; floats nativos não foram telemetrados.
- `device-preparation.json`: AVD novo de 8 GiB no workspace. Controle novo não é cópia dos bancos do Pixel_9 anterior. Sem wipe/limpeza de guard durante o exercício.

Capturas e XML tratam somente dados sintéticos. Senhas têm texto vazio no XML e permanecem ocultas nas imagens. CRC/IEND dos PNGs, XML/JSON, padrões de segredos e hashes são conferidos antes de gerar artifact-manifest.json. O manifesto exclui apenas a si mesmo; hashes são dos arquivos LF que são conferidos no índice Git.

O 426 é controlado no consumidor; não é aceite nativo da política real de versão mínima. Sem aceite de áudio falado/edição por caractere, atualização offline com conta ativa, retry esgotado, staging não zero interrompido, desempenho, paletas integrais, iPhone/VoiceOver ou M1 completo. Instalações/AVDs e APKs de runtime são locais/ignorados; aqui ficam evidências auditáveis.
