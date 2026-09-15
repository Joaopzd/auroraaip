# Tela de perfil completa e transições suaves

## Objetivo
Centralizar as configurações pessoais e da conta na tela `/perfil`, removendo a engrenagem do topo e mantendo as funcionalidades atuais.

## Alterações
- Ampliar a tela **Perfil** com foto, nome exibido e informações da conta.
- Permitir selecionar, visualizar e trocar a foto do perfil, salva por usuário no armazenamento do app.
- Manter o e-mail visível como dado da conta e permitir atualizar o nome exibido.
- Incorporar no perfil a troca entre tema claro e escuro.
- Incorporar no perfil o logout.
- Incorporar no perfil o reset de dados com uma etapa explícita de confirmação para evitar acionamento acidental.
- Remover a engrenagem e o antigo modal de configurações do topo; o acesso continuará pelo nome/ícone do perfil.
- Aplicar uma animação curta de entrada ao conteúdo quando a página mudar, respeitando a preferência do sistema por movimento reduzido.

## Detalhes técnicos
- Adicionar `avatar_url` ao perfil existente com acesso restrito ao próprio usuário.
- Criar um espaço privado para fotos de perfil, limitado por usuário e protegido pelas regras de acesso.
- Reutilizar as ações existentes de tema, reset e logout, sem mudar suas regras.
- Preservar a rota `/perfil`, os demais caminhos, a navegação e o layout atual.
- Atualizar os tipos do banco e validar a tela em tamanhos desktop e mobile.
