import { Routes } from '@angular/router';

export const REPORT_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./reports-hub').then((m) => m.ReportsHub) },
  { path: ':key', loadComponent: () => import('./report-view').then((m) => m.ReportView) },
];
