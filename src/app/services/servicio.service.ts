import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ServicioResponse {
  servicio_codigo: string;
  origen: string;
  // Not every record carries these yet — the API omits them on older services.
  descripcion_origen?: string | null;
  destino: string;
  descripcion_destino?: string | null;
  fecha: string;
  hora: string;
  entidad: string;
  tiposervicio: string;
  movil: string;
  estado: string;
  descripcion: string;
  solicitante: string;
  edad: number;
  autorizacion: string;
  diagnosticos: string;
  documento: string;
  tipopaciente: string;
  paciente: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  direccionpaciente: string | null;
  telefonopaciente: string | null;
  tipoedad: string | null;
  datomovil: string;
  codigo: string;
  ida_vuelta: string;
  diagnostico_legal: string;
  ciudad_origen: string;
  ciudad_destino: string;
  conductor: string;
  auxiliar: string;
  medico: string;
}

interface ServicioApiResponse {
  ok: boolean;
  codigo: number;
  mensaje: string;
  datos: ServicioResponse[];
}

interface GuardarTrasladoResponse {
  ok: boolean;
  codigo: number;
  mensaje: string;
  datos?: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class ServicioService {

  private readonly API_URL = environment.servicioApiUrl;
  private readonly USUARIO = environment.servicioUsuario;
  private readonly PASSWORD = environment.servicioPassword;

  constructor(private readonly http: HttpClient) {}

  /**
   * Looks the service up by `servicio_codigo` — the number dispatch sends in
   * `?codigo=`. The API still answers "Se requiere datos.autorizacion" when it
   * is missing, but it no longer searches by authorization.
   */
  buscarServicio(codigo: string): Observable<ServicioResponse> {
    const body = {
      usuario: this.USUARIO,
      password: this.PASSWORD,
      datos: {
        servicio_codigo: codigo
      }
    };

    const params = new HttpParams()
      .set('page', 'Servicio')
      .set('api', 'Servicio.consumo');

    return this.http.post<ServicioApiResponse>(this.API_URL, body, { params }).pipe(
      map(response => {
        if (!response || !response.ok || !Array.isArray(response.datos) || response.datos.length === 0) {
          throw new Error(response?.mensaje || 'No se encontró ningún servicio en la respuesta');
        }
        return this.combinarFilas(response.datos);
      })
    );
  }

  /**
   * The API returns one row per crew assignment of the same service, and each
   * row may carry only part of it (e.g. `conductor` filled only on the second
   * one). Rows are merged so every field takes the first non-empty value.
   */
  private combinarFilas(filas: ServicioResponse[]): ServicioResponse {
    return filas.reduce((combinado, fila) => {
      const resultado: Record<string, unknown> = { ...combinado };
      Object.entries(fila).forEach(([clave, valor]) => {
        if (this.estaVacio(resultado[clave]) && !this.estaVacio(valor)) {
          resultado[clave] = valor;
        }
      });
      return resultado as unknown as ServicioResponse;
    });
  }

  private estaVacio(valor: unknown): boolean {
    return valor === null || valor === undefined || (typeof valor === 'string' && !valor.trim());
  }

  guardarTraslado(payload: any): Observable<GuardarTrasladoResponse> {
    const body = {
      usuario: this.USUARIO,
      password: this.PASSWORD,
      datos: payload
    };

    const params = new HttpParams()
      .set('page', 'Servicio')
      .set('api', 'Traslado.guardar');

    console.log('JSON enviado a Traslado.guardar:', JSON.stringify(body, null, 2));

    return this.http.post<GuardarTrasladoResponse>(this.API_URL, body, { params });
  }
}
