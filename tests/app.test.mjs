import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const app=await readFile(new URL("../app.js",import.meta.url),"utf8");
const server=await readFile(new URL("../server.mjs",import.meta.url),"utf8");
const vercel=JSON.parse(await readFile(new URL("../vercel.json",import.meta.url),"utf8"));
const vitrine=await readFile(new URL("../public/vitrine.html",import.meta.url),"utf8");

test("valores monetários brasileiros aceitam milhares",()=>{
  const source=app.match(/const parseMoney = ([^;]+);/)[1];
  const parseMoney=vm.runInNewContext(`(${source})`);
  assert.equal(parseMoney("R$ 1.234.567,89"),1234567.89);
  assert.equal(parseMoney("R$ 42.000/mês"),42000);
});

test("OAuth usa a origem publicada e segredos do ambiente",()=>{
  assert.match(server,/callbackUrl\(provider,origin\)/);
  assert.match(server,/process\.env\[key\] \|\| runtimeSettings\[key\]/);
  assert.doesNotMatch(server,/clientSecret:\s*["'][^"']+["']/);
});

test("produção aplica CSP e publica a verificação TikTok",async()=>{
  assert.ok(vercel.headers.some(rule=>rule.headers.some(header=>header.key==="Content-Security-Policy")));
  assert.equal((await readFile(new URL("../tiktoklSoKQMn2CNiRPQJWxyukHqLjjwxHYM09.txt",import.meta.url),"utf8")).trim(),"tiktok-developers-site-verification=lSoKQMn2CNiRPQJWxyukHqLjjwxHYM09");
  assert.doesNotMatch(await readFile(new URL("../app/globals.css",import.meta.url),"utf8"),/contact-sheet\.png(?=[^\n]*$)/m);
});

test("dashboard usa demonstração somente sem métricas oficiais",()=>{
  assert.match(app,/official\?formatNumber\(reach\):dashboardDemo\.reach/);
  assert.match(app,/official\?formatNumber\(views\):dashboardDemo\.views/);
  assert.match(app,/dashboard-channel-metrics/);
  assert.match(app,/channelMetricPanels\(liveSocial\)/);
  assert.match(app,/--engagement:\$\{engagement\*1\.8\}deg/);
});

test("navegação móvel mantém os módulos principais acessíveis",async()=>{
  assert.match(app,/class="mobile-tabs"/);
  assert.match(app,/data-mobile-menu/);
  const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.match(css,/@media\(max-width:1100px\)[\s\S]*\.mobile-tabs/);
  assert.match(css,/\.sidebar\.mobile-open~\.mobile-tabs\{visibility:hidden/);
  assert.match(css,/@media\(min-width:561px\) and \(max-width:1100px\)/);
});

test("vitrine pública expõe somente resumo visual",()=>{
  const route=server.match(/if\(pathname==="\/api\/public\/showcase"[\s\S]*?\n    \}/)?.[0]||"";
  assert.match(route,/episodes[\s\S]*guests:/);
  assert.doesNotMatch(route,/password|email|phone|contract/i);
  assert.match(app,/class="public-vitrine-frame"/);
  assert.match(app,/onda-showcase-data/);
});

test("vitrine de entrada mantém o arquivo visual enviado e carrosséis automáticos",()=>{
  assert.match(app,/public\/vitrine\.html\?mode=/);
  assert.match(vitrine,/class="carousel-wrapper glass-card/);
  assert.match(vitrine,/class="sponsors-track"/);
  assert.match(vitrine,/animation:\s*scrollSponsors/);
  assert.match(vitrine,/class="analytics-grid/);
  assert.match(vitrine,/class="bottom-showcase/);
  assert.match(vitrine,/id="quickMenuBtn"/);
  assert.match(vitrine,/id="adminLoginForm"/);
});

test("vitrine exibe as quatro redes simultaneamente sem expor tokens",async()=>{
  const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.match(app,/function channelMetricPanels\(metrics=\{\}\)/);
  assert.match(app,/data-channel-panel="\$\{key\}"/);
  assert.match(app,/VIEWS · 30 DIAS/);
  assert.match(css,/\.auth-dashboard-insights\{grid-template-columns:repeat\(4/);
  assert.match(css,/@media\(min-width:521px\) and \(max-width:1100px\) and \(orientation:portrait\)[\s\S]*\.auth-dashboard-insights\{grid-template-columns:repeat\(2/);
  assert.match(app,/CORTES EM DESTAQUE/);
  assert.match(server,/metrics:Object\.fromEntries/);
  assert.doesNotMatch(server.match(/metrics:Object\.fromEntries[^\n]+/)?.[0]||"",/access_token|refresh_token/);
});

test("métricas reproduzem o catálogo dos quatro canais",async()=>{
  const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.match(app,/spotify:\{name:"Spotify"/);
  assert.match(app,/Conteúdos que mais performaram/);
  assert.match(app,/data-connect=\"\$\{key\}\"/);
  assert.match(server,/extra: \{ likes:[\s\S]*contents \}/);
  assert.match(server,/contents:videos\.map\(video=>\(\{title:[\s\S]*provider:\"TikTok\"/);
  assert.match(css,/\.metrics-network-grid/);
});

test("fonte Scholar é servida localmente",async()=>{
  const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.match(css,/@font-face\{font-family:"Scholar"/);
  assert.match(css,/font-kerning:none;letter-spacing:var\(--display-letter-spacing,\.025em\)/);
  assert.match(server,/"\.otf":"font\/otf"/);
});

test("aparência é ajustável somente pelo administrador",()=>{
  assert.match(app,/\["appearance","◐","Aparência"\]/);
  assert.match(app,/currentUser\?\.role!=="Administrador"\)document\.querySelector\('\[data-page="appearance"\]'/);
  assert.match(server,/pathname==="\/api\/appearance"&&request\.method==="POST"[\s\S]*?session\.user\.role!=="Administrador"/);
  assert.match(server,/appearanceFonts=\["scholar","inter","georgia"\]/);
  assert.match(app,/name="podcastName"/);
  assert.match(server,/PODCAST_NAME/);
});

test("financeiro calcula contas abertas sem cadastro duplicado",async()=>{
  const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.match(app,/\["A receber","A pagar"\]\.includes\(x\[3\]\)/);
  assert.match(app,/Contas e previsões/);
  assert.match(css,/\.finance-page-grid\{grid-template-columns:/);
});

test("vitrine desktop reserva a barra superior sem sobrepor o conteudo",async()=>{
  const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.match(css,/@media\(min-width:1101px\)[\s\S]*?\.auth-showcase\{[^}]*padding:68px/);
  assert.match(css,/\.auth-mobile-login:focus-visible\{outline:2px solid #fff/);
});

test("vitrine pública mantém o visual premium do arquivo enviado",()=>{
  assert.match(vitrine,/AquinoCast Analytics Premium/);
  assert.match(vitrine,/\.glass-card\s*\{/);
  assert.match(vitrine,/\.carousel-wrapper\s*\{/);
  assert.match(vitrine,/\.analytics-grid\s*\{/);
  assert.match(vitrine,/\.vertical-video-card\s*\{/);
  assert.match(vitrine,/body\.dark-mode/);
  assert.match(vitrine,/id="drawerThemeToggle"/);
});


test("vitrine pública mostra a barra superior estilo AquinoCast",async()=>{
  const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.match(app,/class="premium-topbar"/);
  assert.match(app,/AquinoCast/);
  assert.match(app,/Últimos 7 Dias/);
  assert.match(app,/data-theme-cycle/);
  assert.match(app,/data-show-login/);
  assert.match(css,/\.premium-topbar-inner\{/);
  assert.match(css,/\.premium-showcase\{[^}]*margin-top:-/);
});


test("vitrine pública alterna tema e sincroniza com a área logada",()=>{
  assert.match(vitrine,/function applyTheme\(mode\)/);
  assert.match(vitrine,/document\.body\.classList\.toggle\('dark-mode'/);
  assert.match(vitrine,/onda-theme-change/);
  assert.match(app,/onda-theme-sync/);
  assert.match(app,/data-app-theme="light"/);
  assert.match(app,/data-app-theme="dark"/);
});

test("vitrine pública oculta as barras brancas de rolagem",async()=>{
  const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.match(css,/body\.auth-open,body\.auth-open \.auth-showcase[\s\S]*scrollbar-width:none/);
  assert.match(css,/body\.auth-open::\-webkit-scrollbar/);
  assert.match(css,/\.premium-meta-button\{cursor:pointer/);
});
test("vitrine pública aplica tema na página inteira",async()=>{
  const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.match(css,/html\[data-theme="light"\] body\{background:radial-gradient/);
  assert.match(css,/html\[data-theme="light"\] \.premium-topbar\{background:linear-gradient/);
  assert.match(css,/html\[data-theme="light"\] \.premium-brand-logo\{color:#0f172a/);
  assert.match(css,/html\[data-theme="dark"\] body\{background:radial-gradient/);
  assert.match(css,/html\[data-theme="dark"\] \.auth-open \.auth-showcase\{background:radial-gradient/);
  assert.match(css,/html\[data-theme="dark"\] \.premium-brand-logo\{color:#f8fafc/);
});

test("menu da vitrine continua abrindo login real após carregar dados públicos",()=>{
  assert.match(vitrine,/quickMenuBtn\?\.addEventListener\('click', openMenu\)/);
  assert.match(vitrine,/adminLoginForm\?\.addEventListener\('submit', async/);
  assert.match(vitrine,/fetch\(`\/api\/auth\/\$\{mode\}`/);
  assert.match(vitrine,/onda-auth-success/);
});
