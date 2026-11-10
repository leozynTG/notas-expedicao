export type NivelAviso = "erro" | "alerta" | "info";

export interface Aviso {
  categoria: string;
  nivel: NivelAviso;
  mensagem: string;
}
