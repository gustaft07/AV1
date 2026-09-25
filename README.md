# greencode — CLI de gestão de logística reversa de eletrônicos

Atividade de Avaliação Individual 1 — Prof. Eng. Dr. Gerson Penha.

`greencode` é o núcleo operacional (CLI) de uma plataforma de logística
reversa que conecta organizações geradoras de resíduos eletrônicos a
operadores logísticos, especialistas em desmontagem e o mercado de
matérias-primas secundárias. Esta primeira entrega cobre cadastro,
segurança, journaling e rastreabilidade; as próximas etapas (fora do
escopo desta atividade) adicionarão interface web e migração para banco
relacional — ver seção **"Evolução futura"**.

## Sumário

- [Instalação e execução](#instalação-e-execução)
- [Arquitetura geral](#arquitetura-geral)
- [Arquitetura de segurança](#arquitetura-de-segurança) (justificativas exigidas pelo enunciado)
- [Papéis e permissões](#papéis-e-permissões)
- [Modelagem de classes (UML resumido)](#modelagem-de-classes)
- [Comandos disponíveis](#comandos-disponíveis)
- [Regras de negócio implementadas](#regras-de-negócio-implementadas)
- [Journal, rotação e retenção](#journal-rotação-e-retenção)
- [Testes / cenários simulados](#testes--cenários-simulados)
- [Cenários de falha testados e resposta do sistema](#cenários-de-falha-testados-e-resposta-do-sistema)
- [Evolução futura](#evolução-futura)

## Instalação e execução

Resumo rápido (instruções completas e por sistema operacional em `INSTALL.md`):

```bash
npm install       # instala TypeScript e os tipos do Node (únicas dependências)
npm run build      # compila TypeScript -> dist/
npm start           # inicia a CLI (usa ./dados como base por padrão)
```

Parâmetros aceitos por `dist/index.js`:

- `--datadir <pasta>` — onde ficam os arquivos criptografados (padrão: `./dados`).
- `--script <arquivo.gcs>` — executa comandos de um arquivo em modo não
  interativo (usado pelos testes automatizados, ver `tests/`).

No primeiro uso (quando `--datadir` não contém `config.master.json`), o
sistema entra automaticamente em **modo de provisionamento**, solicitando
login e senha do primeiro administrador.

## Arquitetura geral

- **Linguagem/runtime:** Node.js + TypeScript. A tipagem estática do
  TypeScript reduz erros em tempo de execução em um domínio com muitas
  entidades relacionadas (organização → lote → equipamento →
  movimentação) e facilita a manutenção à medida que o domínio cresce
  (ex.: adicionar baterias de veículos elétricos como novo tipo de ativo
  no futuro).
- **Zero dependências de terceiros em produção.** Todo o sistema usa
  apenas módulos nativos do Node (`crypto`, `fs`, `readline`, `path`).
  Isso simplifica a auditoria de segurança (não há superfície de ataque
  de supply-chain de pacotes npm) e a distribuição multiplataforma —
  `typescript` e `@types/node` são dependências apenas de
  desenvolvimento, usadas só para compilar.
- **Camadas:**
  - `src/core/` — infraestrutura: criptografia, storage atômico,
    journal, autenticação/keyring, validações de negócio.
  - `src/models/` — entidades de domínio (classe abstrata
    `EntidadeBase`, herança, interface `Persistivel`, `Fabrica`
    aplicando o padrão *Factory Method*).
  - `src/cli/` — parser de comandos, matriz de permissões por papel,
    menu dinâmico, REPL interativo e os *handlers* de cada comando.
  - `src/index.ts` — bootstrap (provisionamento, login, modo
    interativo x modo script).

## Arquitetura de segurança

### 1. Por que AES-256-GCM (e não CBC ou outro modo)

Todos os arquivos de dados (`config.master.json`, `organizacoes.json`,
`lotes.json`, `equipamentos.json`, `movimentacoes.json`) são
criptografados com **AES-256 em modo GCM**. GCM foi escolhido em vez de
CBC/ECB porque é um modo *AEAD* (Authenticated Encryption with
Associated Data): além de sigilo, ele gera uma *tag* de autenticação
que comprova que o texto cifrado não foi alterado. Isso dá duas
propriedades importantes para um sistema de auditoria:

- Um arquivo corrompido ou adulterado por fora do sistema é **detectado
  explicitamente** na descriptografia (a chamada lança exceção), em vez
  de produzir dados corrompidos silenciosamente, como aconteceria com
  CBC puro.
- A própria tag de autenticação é reaproveitada como **mecanismo de
  autenticação de senha** (ver item 2), eliminando a necessidade de
  manter um hash de senha redundante para o desbloqueio da chave
  mestra.

### 2. Esquema de chave mestra multiusuário ("key slots")

Existe **uma única chave mestra AES-256 aleatória** (32 bytes) que
criptografa todos os dados. Ela nunca é gravada em texto puro. Em vez
disso, `config.master.json` guarda um *keyring*: uma lista de "key
slots", um por usuário, onde cada slot contém a chave mestra
**envolvida (wrapped)** em AES-256-GCM usando uma *KEK*
(key-encryption key) derivada da senha daquele usuário via `scrypt`
(com um `salt` individual por usuário). Esse desenho é o mesmo
princípio usado por sistemas de disco criptografado como LUKS/BitLocker
com múltiplos slots de desbloqueio, e traz vantagens diretas para este
domínio multiusuário:

- **Login = tentativa de desembrulhar a chave mestra.** Se a senha
  estiver errada, a KEK derivada é diferente da original e a
  verificação de tag do GCM falha — a própria criptografia autenticada
  *é* a checagem de senha. Não existe um hash de senha separado
  armazenado em lugar nenhum, reduzindo a superfície de ataque.
- **`scrypt`** foi escolhido para derivar a KEK (em vez de PBKDF2/SHA
  puro) porque é uma função de custo de memória ajustável, o que o
  torna caro de paralelizar em GPU/ASIC — mitigação relevante contra
  ataques de força bruta offline caso o arquivo de configuração vaze.
- **Somente o administrador** (que já possui a chave mestra
  desembrulhada após seu próprio login) pode criar novos slots — ou
  seja, cadastrar novos usuários replica fisicamente a chave mestra
  envolvida por uma nova KEK. Revogar acesso (`usuario desativar`) é
  apenas desativar o slot; não exige re-criptografar toda a base.

O enunciado pede explicitamente hashing de senha com **SHA-256**: essa
exigência é atendida em `core/crypto.ts::hashSenha`, disponível para uso
em fluxos de autenticação simples (ex.: um endpoint web futuro que não
precise desembrulhar a chave mestra). Para a autenticação da CLI em si,
porém, optou-se pelo esquema de key-slots acima, que é estritamente mais
forte porque combina autenticação com o próprio gerenciamento da chave
de criptografia dos dados — evitando o cenário onde uma senha "bate" no
hash mas a chave de descriptografia dos dados é obtida por outro meio.

### 3. Sessões com expiração por inatividade (30 minutos)

A classe `core/auth.ts::Sessao` guarda um timestamp de expiração
deslizante: cada comando executado "toca" a sessão e a renova por mais
30 minutos (`SESSAO_TIMEOUT_MS`). Se o tempo expira, o próximo comando é
recusado e o usuário precisa autenticar novamente — a chave mestra
desembrulhada em memória não é reaproveitada. Isso limita a janela de
exposição caso um terminal seja deixado aberto sem supervisão.

### 4. Escrita atômica

`core/storage.ts` nunca escreve diretamente no arquivo final: grava em
um arquivo temporário (`arquivo.tmp-<pid>-<timestamp>`) e só então usa
`fs.renameSync`, que é atômico tanto em sistemas de arquivos POSIX
(ext4, APFS) quanto no NTFS do Windows. Uma interrupção brusca (queda de
energia, `kill -9`) no meio da escrita deixa o `.tmp` órfão, mas nunca
corrompe o arquivo de estado "oficial".

### 5. Journal como log imutável e "tamper-evident"

Ver seção dedicada abaixo.

## Papéis e permissões

| Papel | Responsabilidade | Pode alterar dados? |
|---|---|---|
| `admin` | Contas de acesso, parâmetros globais, acesso irrestrito | Sim (tudo) |
| `operador_cadastro` | Organizações clientes e contratos de coleta | Sim (organizações) |
| `gestor_almoxarifado` | Lotes, triagem, códigos de barras, movimentações | Sim (lotes/equipamentos) |
| `auditor` | Consulta e relatórios | **Não** (somente leitura) |

A matriz completa está em `src/cli/permissoes.ts`. O menu exibido após o
login (`ajuda`) já reflete apenas os comandos permitidos ao papel do
usuário autenticado — o menu se adapta dinamicamente, como exigido.

## Modelagem de classes

```
EntidadeBase (abstract)              «interface» Persistivel
  + id, criadoEm                        + paraJSON()
  + validar()  (abstract)
      ▲
      │ herança
  ┌───┼─────────┬─────────────┬───────────────┐
Usuario   Organizacao       Lote        Equipamento     Movimentacao

FabricaEntidades (Factory Method)
  + criarUsuario() / criarOrganizacao() / criarLote() / criarEquipamento()
    -> sempre retorna a entidade já validada (validar() chamado internamente)
```

- **Herança + polimorfismo:** toda entidade estende `EntidadeBase` e
  implementa seu próprio `validar()`; o restante do sistema trata todas
  de forma uniforme via o contrato abstrato.
- **Interface:** `Persistivel` desacopla "como uma entidade vira JSON"
  do resto do sistema.
- **Fábrica:** `FabricaEntidades` centraliza a criação, garantindo que
  nenhuma entidade seja persistida sem antes passar por `validar()`.

## Comandos disponíveis

Convenção: `<ação> <subação> --chave valor --flag`. Exemplo do
enunciado:

```
lote criar --org BR001 --nf 123456 --transp TransRapida
```

Lista completa (a CLI também mostra isso dinamicamente em `ajuda`,
filtrado pelo papel do usuário logado):

```
org criar --codigo --cnpj --razao --contrato
org listar
org consultar --codigo

lote criar --codigo --org --nf --transp [--data AAAA-MM-DD]
lote listar
lote consultar --codigo

equipamento cadastrar --codigo --lote --tipo --estado
equipamento triagem --codigo
equipamento estado --codigo --estado [--justificativa "..."]
equipamento desmonte --codigo
equipamento listar
equipamento consultar --codigo
equipamento rastreabilidade --codigo

usuario criar --login --senha --papel     (somente admin)
usuario desativar --login                 (somente admin)
usuario listar

relatorio journal [--limite N]
ajuda
sair
```

Estados físicos válidos (do melhor para o pior):
`novo, seminovo, usado_bom, usado_regular, usado_ruim, sucata`.

A CLI oferece **autocompletar** (tecla TAB) dos comandos disponíveis
para o papel logado e **histórico persistente entre sessões**
(`readline`, armazenado em `.greencode_history` dentro do `--datadir`).

## Regras de negócio implementadas

- **CNPJ:** validado com dígitos verificadores reais (módulo 11),
  incluindo rejeição de sequências repetidas (`11111111111111` etc.).
- **Data de entrada do lote:** rejeitada se for futura ou anterior a
  mais de 90 dias (`core/validation.ts::validarDataEntradaLote`).
- **Desmonte só após triagem completa:** um equipamento só pode ir para
  `desmonte` se seu `status` for `triagem_completa`
  (`Equipamento.moverParaDesmonte`).
- **Justificativa obrigatória em queda de 2+ categorias de estado
  físico:** `Equipamento.alterarEstadoFisico` exige uma justificativa de
  pelo menos 5 caracteres quando a queda na escala de estado físico é
  de duas posições ou mais (ex.: `usado_bom -> sucata`).

## Journal, rotação e retenção

`core/journal.ts` registra toda operação de escrita como uma linha
JSON (formato NDJSON) em `dados/journal/journal.log`, **antes** de o
efeito ser considerado concluído (write-ahead logging). Cada entrada
guarda o hash SHA-256 da entrada anterior (`hashAnterior`), formando uma
cadeia — qualquer edição retroativa de uma linha quebra a cadeia de
hashes a partir dali, tornando adulterações **detectáveis**
(tamper-evident), embora o arquivo em si não seja criptografado (por
design: precisa ser auditável/legível de fora em caso de disaster
recovery, mesmo sem a chave mestra).

- **Rotação:** quando `journal.log` ultrapassa 10 MB, ele é renomeado
  para `journal-<timestamp>.log` e um novo arquivo ativo é iniciado.
- **Retenção:** a cada inicialização do programa, arquivos rotacionados
  com mais de 180 dias são removidos (`Journal.aplicarRetencao`,
  chamado em `index.ts::main`). O arquivo ativo nunca é removido por
  essa política.

## Testes / cenários simulados

Dois scripts `.gcs` (formato texto simples, um comando por linha)
simulam jornadas completas de uso sem exigir interação manual:

```bash
npm run test:jornada   # provisionamento -> cadastros -> triagem -> desmonte -> rastreabilidade
npm run test:falhas    # 8 cenários de falha esperados (ver tests/cenarios-falha.gcs)
```

`tests/jornada-completa.gcs` cobre: provisionamento do admin, criação
dos 3 demais papéis, cadastro de organização, lote e equipamento,
avanço de triagem, duas alterações de estado físico (uma sem e uma com
justificativa exigida), desmonte e, por fim, consulta de
**rastreabilidade completa** do equipamento (histórico de estado +
todas as movimentações) como auditor.

## Cenários de falha testados e resposta do sistema

| # | Cenário | Resposta do sistema |
|---|---|---|
| 1 | CNPJ com dígito verificador inválido | `[ERRO] CNPJ inválido.` — cadastro rejeitado |
| 2 | Operador de cadastro tenta `lote criar` (fora de sua alçada) | `[ACESSO NEGADO]` — matriz de permissões bloqueia antes de chamar o handler |
| 3 | Gestor de almoxarifado tenta `org criar` | `[ACESSO NEGADO]` |
| 4 | Lote referenciando organização inexistente | `[ERRO] Organização "..." não encontrada.` |
| 5 | Equipamento tenta ir para `desmonte` sem triagem completa | `[ERRO] ... É necessário concluir a triagem completa primeiro.` |
| 6 | Queda de 2+ categorias de estado físico sem `--justificativa` | `[ERRO] Justificativa textual obrigatória (mín. 5 caracteres)...` |
| 7 | Login com senha incorreta | `[ERRO] Login ou senha inválidos.` (mensagem genérica — não revela se o login existe) |
| 8 | Criação de usuário com senha curta (< 8 caracteres) | `[ERRO] Senha deve ter ao menos 8 caracteres.` |

Todos os 8 cenários foram executados e conferidos manualmente durante o
desenvolvimento (saída completa reproduzível via `npm run test:falhas`).

## Evolução futura

A arquitetura foi pensada para as próximas etapas mencionadas no
enunciado sem exigir reescrever o núcleo:

- **Interface web:** a camada `src/cli/commands/*.ts` já isola a lógica
  de negócio dos detalhes de entrada/saída (recebe `params` + `Contexto`,
  devolve uma string). Uma API REST/GraphQL poderia reutilizar
  `core/`, `models/` e os *handlers* quase sem alteração, trocando
  apenas a camada de apresentação (`cli/`).
- **Migração para banco relacional:** os quatro `Repositorio*` em
  `core/repositorios.ts` já encapsulam toda a persistência atrás de uma
  interface simples (`listar`, `salvar`, `porX`). Trocar o `Storage`
  baseado em arquivo por um cliente MySQL/Postgres é uma mudança
  localizada nessa camada; `models/` e `cli/commands/` não precisariam
  mudar.
- **Novas classes de produtos** (baterias de veículos elétricos,
  painéis solares, dispositivos médicos): bastaria estender
  `EstadoFisico`/`StatusEquipamento` ou criar subclasses específicas de
  `Equipamento`, graças ao uso de herança/polimorfismo na modelagem.
