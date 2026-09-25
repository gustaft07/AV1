import { Storage } from "./storage";
import { Organizacao, OrganizacaoJSON } from "../models/Organizacao";
import { Lote, LoteJSON } from "../models/Lote";
import { Equipamento, EquipamentoJSON } from "../models/Equipamento";
import { Movimentacao, MovimentacaoJSON } from "../models/Movimentacao";

export class RepositorioOrganizacoes {
  constructor(private storage: Storage) {}
  private arquivo = "organizacoes.json";

  listar(): Organizacao[] {
    return this.storage
      .lerJSON<OrganizacaoJSON[]>(this.arquivo, [])
      .map(Organizacao.deJSON);
  }
  porCodigo(codigo: string): Organizacao | undefined {
    return this.listar().find((o) => o.codigo === codigo);
  }
  salvar(org: Organizacao): void {
    const todas = this.listar().filter((o) => o.id !== org.id);
    todas.push(org);
    this.storage.escreverJSON(this.arquivo, todas.map((o) => o.paraJSON()));
  }
}

export class RepositorioLotes {
  constructor(private storage: Storage) {}
  private arquivo = "lotes.json";

  listar(): Lote[] {
    return this.storage.lerJSON<LoteJSON[]>(this.arquivo, []).map(Lote.deJSON);
  }
  porCodigo(codigo: string): Lote | undefined {
    return this.listar().find((l) => l.codigoLote === codigo);
  }
  porId(id: string): Lote | undefined {
    return this.listar().find((l) => l.id === id);
  }
  salvar(lote: Lote): void {
    const todos = this.listar().filter((l) => l.id !== lote.id);
    todos.push(lote);
    this.storage.escreverJSON(this.arquivo, todos.map((l) => l.paraJSON()));
  }
}

export class RepositorioEquipamentos {
  constructor(private storage: Storage) {}
  private arquivo = "equipamentos.json";

  listar(): Equipamento[] {
    return this.storage
      .lerJSON<EquipamentoJSON[]>(this.arquivo, [])
      .map(Equipamento.deJSON);
  }
  porCodigoBarras(codigo: string): Equipamento | undefined {
    return this.listar().find((e) => e.codigoBarras === codigo);
  }
  porId(id: string): Equipamento | undefined {
    return this.listar().find((e) => e.id === id);
  }
  salvar(equip: Equipamento): void {
    const todos = this.listar().filter((e) => e.id !== equip.id);
    todos.push(equip);
    this.storage.escreverJSON(this.arquivo, todos.map((e) => e.paraJSON()));
  }
}

export class RepositorioMovimentacoes {
  constructor(private storage: Storage) {}
  private arquivo = "movimentacoes.json";

  listar(): Movimentacao[] {
    return this.storage
      .lerJSON<MovimentacaoJSON[]>(this.arquivo, [])
      .map(Movimentacao.deJSON);
  }
  porEquipamento(equipamentoId: string): Movimentacao[] {
    return this.listar().filter((m) => m.equipamentoId === equipamentoId);
  }
  salvar(mov: Movimentacao): void {
    const todas = this.listar();
    todas.push(mov);
    this.storage.escreverJSON(this.arquivo, todas.map((m) => m.paraJSON()));
  }
}
