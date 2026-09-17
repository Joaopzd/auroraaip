# Mobile, horário e notificações no Android

## Interface mobile
- Trocar o campo de hora do evento por seletores simples de hora e minuto, com atalhos para horários comuns.
- Ajustar formulários, cabeçalhos, cartões, listas e janelas para caberem confortavelmente em telas estreitas.
- Exibir `R$` dentro dos campos de valor da lista de compras, sem alterar os valores salvos.
- Fixar a escala da página para evitar zoom acidental e manter a largura correta no telefone.

## Alertas
- Manter os alertas instantâneos no app aberto e atualizar eventos e contas por Realtime.
- Adicionar notificações push no Android por Firebase Cloud Messaging, com ativação voluntária pelo usuário.
- Guardar cada aparelho por conta e enviar somente os alertas do próprio usuário.
- Criar o processamento agendado dos vencimentos e lembretes, evitando notificações duplicadas.

## Segurança e validação
- Manter isolamento por conta e permissões restritas nos registros de aparelhos e alertas.
- Validar cadastro de evento, listas e finanças em viewport Android.
- Confirmar instalação como app, permissão de notificações e entrega de um alerta real.

## Observação
- Realtime atualiza imediatamente o app aberto, mas não desperta o celular quando ele está fechado. Para alertas reais com o app fechado, será usada a conexão de notificações push e a Ditto deverá estar instalada na tela inicial do Android.
