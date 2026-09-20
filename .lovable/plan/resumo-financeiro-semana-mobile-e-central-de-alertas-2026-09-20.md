# Resumo financeiro, semana mobile e central de alertas

## Tela Meu Dia
- Manter o “Saldo do mês” calculado por receitas menos despesas do mês atual.
- Finalizar o botão de olho para ocultar ou revelar saldo, entradas e saídas, preservando a preferência no aparelho.
- Conectar a meta semanal ao resumo: mostrar gasto acumulado, teto definido, valor restante e progresso da semana quando o controle estiver ativo.
- Quando ainda não houver teto, oferecer acesso direto para defini-lo no Calendário.

## Calendário no celular
- Transformar os sete dias apertados em uma faixa horizontal rolável, com cartões maiores e seleção centralizada no dia atual.
- Compactar o cabeçalho e os botões “Ver calendário” e “Novo evento” para caberem com clareza em telas estreitas.
- Reorganizar cada evento para manter horário, título, conclusão e remoção legíveis, sem cortes ou rolagem lateral.
- Manter a visão atual em telas maiores.

## Central de alertas
- Criar a tela `/alertas`, acessível por um sino no topo no celular e no computador.
- Exibir alertas pendentes da conta conectada, agrupados em “Hoje”, “Amanhã” e “Próximos”, combinando eventos com lembrete e contas não pagas.
- Calcular eventos recorrentes pelas regras já existentes e ordenar tudo por data e horário.
- Cada alerta abrirá diretamente o evento ou a área financeira correspondente.
- Mostrar um contador no sino para alertas de hoje e amanhã.
- Os alertas permanecerão disponíveis porque são calculados a partir dos dados salvos no Lovable Cloud, mesmo que o app estivesse fechado.

## Entrega em segundo plano
- Preservar o envio push Android já preparado e o processamento agendado, que não depende da tela estar aberta.
- A central será a fonte visual persistente dos alertas futuros; o histórico técnico de entregas não será misturado com pendências.

## Validação
- Conferir saldo oculto/visível e progresso semanal com e sem meta definida.
- Testar Calendário e Alertas em largura de celular, incluindo ausência de rolagem lateral.
- Confirmar navegação pelos alertas, contador do sino e isolamento dos dados por conta.
