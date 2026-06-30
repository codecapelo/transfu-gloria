# Registro de Transfusões

App para registrar doadores de sangue e plaquetas com dia, hora, paciente e quantidade. O painel mostra todos os registros salvos por padrão e também filtra por dia, semana e mês.

## Dados cadastrados na tela

- Paciente: GLORIA MARIA WANDERLEY CAPELO
- Contato da neta: Ana Beatriz Lima Capelo, +55 85 99743-3586
- Banco de sangue: Fujisan Centro de Hemoterapia e Hematologia do Ceará
- Endereço: Av. Barão de Studart, 2626 - Joaquim Távora, Fortaleza - CE, 60120-002
- Telefone Fujisan: (85) 4009.6612
- Dúvidas: (85) 4009-6718 e WhatsApp (85) 99754-3780
- Instagram: @fujisanbs

## Rodar localmente

```bash
npm install
cp .env.example .env
npm run dev
```

Preencha `DATABASE_URL` no `.env` com a string de conexão do Neon. O comando `npm run dev` usa Netlify Dev para servir o frontend e as funções.

## Deploy no Netlify

1. Crie um banco no Neon e copie a connection string.
2. No Netlify, importe este projeto.
3. Em `Site configuration > Environment variables`, adicione:

```text
DATABASE_URL=postgresql://usuario:senha@host.neon.tech/neondb?sslmode=require
```

4. Use o build padrão do projeto:

```text
Build command: npm run build
Publish directory: dist
Functions directory: netlify/functions
```

A tabela `transfusion_records` é criada automaticamente na primeira chamada da API.
