import { Storage } from "../core/storage";
import { Journal } from "../core/journal";
import { Sessao } from "../core/auth";
import {
  RepositorioEquipamentos,
  RepositorioLotes,
  RepositorioMovimentacoes,
  RepositorioOrganizacoes,
} from "../core/repositorios";

export class Contexto {
  readonly storage: Storage;
  readonly journal: Journal;
  readonly organizacoes: RepositorioOrganizacoes;
  readonly lotes: RepositorioLotes;
  readonly equipamentos: RepositorioEquipamentos;
  readonly movimentacoes: RepositorioMovimentacoes;

  constructor(readonly diretorioBase: string, public sessao: Sessao) {
    this.storage = new Storage(diretorioBase, sessao.chaveMestra);
    this.journal = new Journal(diretorioBase);
    this.organizacoes = new RepositorioOrganizacoes(this.storage);
    this.lotes = new RepositorioLotes(this.storage);
    this.equipamentos = new RepositorioEquipamentos(this.storage);
    this.movimentacoes = new RepositorioMovimentacoes(this.storage);
  }

  registrarJournal(acao: string, detalhes: Record<string, unknown>): void {
    this.journal.registrar(this.sessao.login, this.sessao.papel, acao, detalhes);
  }
}
