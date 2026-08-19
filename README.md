# ONDA Studio OS

Gestão de grade, agenda, convidados, programação, patrocinadores, financeiro, métricas sociais e equipe para podcasts.

## Executar

Requer Node.js 18 ou superior e não possui dependências externas.

- Windows: abra `INICIAR_ONDA.bat`.
- Terminal: execute `npm run dev`.
- Acesso local: `http://127.0.0.1:3000`.
- Validação: `npm run build`.

No primeiro acesso, crie o administrador. Depois, o administrador pode cadastrar funcionários, cargos, senhas e níveis de acesso em **Equipe & tarefas**. As sessões expiram após 12 horas e as senhas usam hash `scrypt`.

## Dados

Com Supabase configurado, cadastros, usuários, integrações e imagens ficam no banco e no Storage protegidos. Sem Supabase, o servidor usa arquivos locais em `data/` como contingência. Nunca publique `.env` ou `SUPABASE_SECRET_KEY`.

A Grade é gerada pelos compromissos da Agenda marcados para exibição. Fotos de convidados e logos de patrocinadores são enviadas pelo próprio cadastro.

## Métricas sociais

YouTube, Instagram e TikTok usam OAuth oficial. Crie o aplicativo em cada portal, informe o App ID e o segredo em **Métricas & views** e cadastre o retorno exibido pelo sistema:

```text
https://seu-dominio/api/oauth/youtube/callback
https://seu-dominio/api/oauth/instagram/callback
https://seu-dominio/api/oauth/tiktok/callback
```

O YouTube requer Data API v3 e Analytics API; o Instagram requer conta profissional e permissões de insights; o TikTok requer Login Kit, Display API, HTTPS e aprovação dos escopos utilizados.

## Vercel

Use estas configurações:

```text
Framework Preset: Other
Root Directory: ./
Build Command: npm run build
Output Directory: dist
```

Variáveis de produção:

```text
APP_BASE_URL=https://seu-dominio.vercel.app
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_PUBLISHABLE_KEY=sua_chave_publica
SUPABASE_SECRET_KEY=sua_chave_secreta
```

Após alterar variáveis ou domínio, faça um novo deploy e atualize os retornos OAuth nos portais oficiais.
