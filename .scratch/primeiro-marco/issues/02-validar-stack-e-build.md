# 02 — Validar versões e rota de build nos dois clientes

Status: ready-for-agent
Blocked by: none

## Problema e resultado

A stack está escolhida, mas versões e comandos no CLAUDE ainda não foram exercitados. Definir uma combinação compatível e um caminho reproduzível para iPhone 16e físico e emulador Android, preservando Java/Spring e Expo/React Native.

## Escopo

Investigar documentação oficial e ambiente disponível; registrar versões fixadas de Expo/RN/TypeScript/Drizzle e Java/Spring Boot/Modulith. Bibliotecas de IA/áudio não são dependências necessárias do primeiro marco. Verificar transações SQLite na versão escolhida, armazenamento protegido, builds de desenvolvimento, assinatura iOS e acesso ao backend pelo aparelho/emulador. Não criar nem pagar contas de serviços sem autorização.

## Aceite

- Matriz com versão, fonte oficial, compatibilidade e comando verificável; distinguir compatibilidade documentada de build realmente executado.
- Rota iOS adequada ao ambiente Windows, com pré-requisitos de assinatura/build identificados; Android com rede até o backend local/de teste definida.
- Lacunas de ferramentas, acesso ou custo explicitadas, sem trocar a stack silenciosamente.
- Atualizar a stack/guia canônico; não adicionar dependências de módulos futuros só para completar a lista original.

## Resultado

Concluída: sim — investigação e baseline documental, 25/09/2026.

[Relatório e comandos](../../../docs/analises/2026-09-25-stack-e-build-primeiro-marco.md) registram versões publicadas, evidências oficiais e inspeção local. Java 21 preservado; Boot foi atualizado de 3 para 4.1.1 com Modulith 2.1.1 devido ao encerramento de suporte aberto da linha 3.5, antes de existir código para migrar. Expo 57 estável foi separado da beta 58 e de versões `latest` incompatíveis com seu conjunto.

Node/pnpm e Java foram consultados; Android SDK e AVDs encontrados. Java 21 disponível no Android Studio, apesar do PATH usar 25. Docker CLI encontrado, daemon inacessível nesta sessão. Não foram executados builds nem testes da aplicação. Pedro informou não ter Apple Developer ativo: development build iOS via EAS aguarda essa dependência ou uma rota local com Mac. Nenhuma conta/assinatura foi criada ou paga.

## Comments

25/09/2026: investigação independente da tarefa 01 e do protótipo. Preparação não conta como teste de funcionamento do app.

25/09/2026: os builds e a verificação da integração das dependências passam à tarefa 04; o aceite final continua exigindo iPhone 16e e emulador Android.
