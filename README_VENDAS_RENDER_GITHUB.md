# Vendas automaticas com Render + GitHub

Este projeto agora inclui um portal de vendas em `sales-portal/` para:

1. receber o codigo de registro do cliente;
2. abrir o Stripe Checkout;
3. gerar a chave automaticamente;
4. entregar a chave na tela final;
5. enviar a chave por email se SMTP estiver configurado.

## O que subir no GitHub

Suba a pasta `controle_financeiro_com_senha` como repositorio.

## Como publicar no Render

1. Crie um repositorio no GitHub com esta pasta.
2. No Render, clique em `New > Blueprint`.
3. Conecte o repositorio.
4. Escolha o arquivo `render.yaml`.
5. Preencha os segredos:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `LICENSE_SECRET`
   - `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` se quiser envio automatico por email
   - `SUPPORT_EMAIL`
6. Publique o Blueprint.

## Como ligar o Stripe

1. Crie uma conta no Stripe.
2. Copie a chave secreta live para `STRIPE_SECRET_KEY`.
3. No Stripe, crie um webhook apontando para:
   - `https://SEU-SERVICO.onrender.com/api/stripe/webhook`
4. Copie o segredo do webhook para `STRIPE_WEBHOOK_SECRET`.
5. Opcional:
   - Se quiser usar um preco criado no painel do Stripe, preencha `STRIPE_PRICE_ID`.
   - Se nao preencher, o servidor usa `LICENSE_AMOUNT` e cria o item inline no checkout.

## Como o cliente compra

1. Ele abre o programa.
2. Clica em `Comprar licenca online`.
3. O navegador abre a pagina de venda no Render com o codigo de registro ja preenchido.
4. Depois do pagamento, a pagina mostra a chave automaticamente.
5. Se SMTP estiver configurado, o cliente tambem recebe a chave por email.

## Importante

- O app desktop usa hoje a mesma logica de chave offline do projeto atual. Isso funciona para vender automaticamente agora.
- Se depois voce quiser um bloqueio mais forte contra copia, o proximo passo e migrar a validacao da licenca para o servidor.
- Se o hostname final do Render ficar diferente de `https://controle-financeiro-familiar-sales.onrender.com`, atualize a constante `SALES_PORTAL_URL` em `src-tauri/src/lib.rs` e gere o `.exe` novamente.
