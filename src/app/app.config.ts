import { ApplicationConfig, provideAppInitializer, provideBrowserGlobalErrorListeners, inject } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { FrenchPaginatorIntl } from './core/services/french-paginator';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/authentication/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    { provide: MatPaginatorIntl, useClass: FrenchPaginatorIntl },
    provideHttpClient(withInterceptors([authInterceptor])),
    // Restaure la session (cookie de refresh) avant le premier rendu / les guards
    provideAppInitializer(() => firstValueFrom(inject(AuthService).restore())),
  ],
};
