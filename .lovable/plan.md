# Calendário e resumo mensal

## Tela principal
- Remover os cartões “Foco da rotina” e “Compras”.
- Substituir o resumo semanal por “Saldo do mês”, calculado pelas receitas menos despesas do mês atual.
- Incluir um botão de olho para ocultar e revelar o saldo.
- Redesenhar o progresso das tarefas em formato compacto, legível e estável em telas pequenas.

## Calendário semanal
- Trocar o título “Sua rotina” por “Calendário”, mantendo a semana como visão principal.
- Adicionar acesso ao calendário mensal para escolher uma data e consultar eventos futuros.
- Mostrar uma seção de próximos eventos em ordem cronológica.
- Trocar o formulário rápido atual por um botão “Novo evento”, que abre uma página dedicada.

## Cadastro de evento
- Criar uma página com data, hora, nome, categoria, descrição, repetição e lembretes.
- Oferecer repetição: nunca, diariamente, segunda a sexta, semanalmente, mensalmente e anualmente.
- Oferecer lembretes de 30 minutos, 1 hora e 1 dia, com múltipla seleção.
- Ao escolher “Aniversário”, definir automaticamente a repetição anual.

## Categorias
- Incluir as categorias padrão: Aniversário, Médico, Compras, Lembrete e Rotina.
- Criar uma página separada para gerenciar categorias personalizadas.
- Preservar as categorias padrão e permitir adicionar ou remover somente as personalizadas.

## Dados e notificações
- Evoluir os eventos atuais sem apagar as rotinas já cadastradas.
- Manter cada evento e categoria isolados por conta.
- Atualizar os lembretes locais para respeitar data, recorrência e antecedências selecionadas.
- Notificações serão exibidas quando o app estiver aberto ou instalado e com permissão concedida; notificações remotas com o app totalmente fechado exigem uma etapa futura de push.

## Detalhes técnicos
- Ampliar `routine_blocks` com data, categoria, descrição, recorrência e lista de lembretes.
- Criar `event_categories` com acesso restrito ao proprietário, incluindo permissões e políticas de segurança.
- Criar as páginas `/novo-evento` e `/categorias-eventos` e integrar suas consultas ao calendário existente.
- Ajustar a assistente para continuar lendo e criando eventos no novo formato sem quebrar os comandos atuais.
