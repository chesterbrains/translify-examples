import { Component, signal } from '@angular/core';

/**
 * Every string carries `i18n="@@<key>"`: the id is the Translify key, so the XLIFF that
 * `translify pull` writes lines up with no extraction step. The plural and greeting keys
 * are not used here: Angular writes interpolations as <ph> units, which Translify's plain
 * ICU text does not match yet (TRLIFY-98).
 */
@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly count = signal(1);

  more(): void {
    this.count.update((n) => n + 1);
  }

  fewer(): void {
    this.count.update((n) => (n > 0 ? n - 1 : 0));
  }
}
