import { Papel, descricaoPapel } from "../models/Papel";
import { acoesPermitidas } from "./permissoes";

const DESCRICOES: Record<string, string> = {
  "org criar": "Cadastrar organização geradora (--codigo --cnpj --razao --contrato)",
  "org listar": "Listar organizações",
  "org consultar": "Consultar organização (--codigo)",
  "lote criar": "Criar lote (--codigo --org --nf --transp [--data AAAA-MM-DD])",
  "lote listar": "Listar lotes",
  "lote consultar": "Consultar lote (--codigo)",
  "equipamento cadastrar": "Cadastrar equipamento (--codigo --lote --tipo --estado)",
  "equipamento triagem": "Avançar triagem do equipamento (--codigo)",
  "equipamento estado": "Alterar estado físico (--codigo --estado [--justificativa])",
  "equipamento desmonte": "Mover equipamento para desmonte (--codigo)",
  "equipamento listar": "Listar equipamentos",
  "equipamento consultar": "Consultar equipamento (--codigo)",
  "equipamento rastreabilidade": "Rastreabilidade completa (--codigo)",
  "usuario criar": "Criar usuário (--login --senha --papel)",
  "usuario desativar": "Desativar usuário (--login)",
  "usuario listar": "Listar usuários",
  "relatorio journal": "Consultar journal de auditoria ([--limite N])",
};

export function montarMenu(papel: Papel): string {
  const acoes = acoesPermitidas(papel).filter((a) => a !== "ajuda");
  const linhas = [
    `Papel: ${papel} — ${descricaoPapel(papel)}`,
    `Comandos disponíveis:`,
    ...acoes
      .sort()
      .map((a) => `  ${a.padEnd(28)} ${DESCRICOES[a] ?? ""}`),
    `  sair                         Encerrar sessão`,
    `  ajuda                        Mostrar este menu novamente`,
  ];
  return linhas.join("\n");
}
