import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private snack = inject(MatSnackBar);
  success(msg: string) { this.snack.open(msg, 'OK', { duration: 3500, panelClass: 'snack-success' }); }
  error(msg: string) { this.snack.open(msg, 'Fermer', { duration: 6000, panelClass: 'snack-error' }); }
}
