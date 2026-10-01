import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { ServicioService } from './servicio.service';

describe('ServicioService', () => {
  let service: ServicioService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ServicioService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('busca por servicio_codigo y combina las filas del servicio tomando el primer valor no vacío de cada campo', async () => {
    const respuesta = firstValueFrom(service.buscarServicio('04100074990'));

    const peticion = http.expectOne(() => true);
    expect(peticion.request.body.datos).toEqual({ servicio_codigo: '04100074990' });
    peticion.flush({
      ok: true,
      codigo: 200,
      mensaje: 'OK',
      datos: [
        { autorizacion: '326362987', conductor: '', auxiliar: '', medico: '', direccionpaciente: null },
        { autorizacion: '326362987', conductor: 'JUAN DAVID LARRAHONDO', auxiliar: '', medico: '', direccionpaciente: 'CRA 1' }
      ]
    });

    expect(await respuesta).toMatchObject({
      autorizacion: '326362987',
      conductor: 'JUAN DAVID LARRAHONDO',
      auxiliar: '',
      medico: '',
      direccionpaciente: 'CRA 1'
    });
  });
});
