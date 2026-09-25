import { Papel } from "../models/Papel";

export const MATRIZ_PERMISSOES: Record<Papel, string[] | "*"> = {
  [Papel.ADMIN]: "*",
  [Papel.OPERADOR_CADASTRO]: [
    "org criar",
    "org listar",
    "org consultar",
    "usuario listar",
    "ajuda",
  ],
  [Papel.GESTOR_ALMOXARIFADO]: [
    "lote criar",
    "lote listar",
    "lote consultar",
    "equipamento cadastrar",
    "equipamento triagem",
    "equipamento estado",
    "equipamento desmonte",
    "equipamento consultar",
    "equipamento listar",
    "ajuda",
  ],
  [Papel.AUDITOR]: [
    "org listar",
    "org consultar",
    "lote listar",
    "lote consultar",
    "equipamento listar",
    "equipamento consultar",
    "equipamento rastreabilidade",
    "relatorio journal",
    "usuario listar",
    "ajuda",
  ],
};

export function papelPodeExecutar(papel: Papel, acao: string): boolean {
  const permitidas = MATRIZ_PERMISSOES[papel];
  if (permitidas === "*") return true;
  return permitidas.includes(acao);
}

export function acoesPermitidas(papel: Papel): string[] {
  const permitidas = MATRIZ_PERMISSOES[papel];
  if (permitidas === "*") {
    return Array.from(
      new Set(Object.values(MATRIZ_PERMISSOES).flatMap((v) => (v === "*" ? [] : v)))
    ).concat([
      "usuario criar",
      "usuario desativar",
      "config listar",
    ]);
  }
  return permitidas;
}
