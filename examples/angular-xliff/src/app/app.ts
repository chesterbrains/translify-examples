import { Component, signal } from '@angular/core';

/**
 * Every string carries `i18n="@@<key>"`: the id is the Translify key, so the XLIFF that
 * `translify pull` writes lines up with no extraction step. `greeting` and `itemCount` use an
 * interpolation and a plural: the rule's `xliffDialect: "angular"` makes `pull` write them as
 * Angular's `<ph>` / `VAR_PLURAL` units (TRLIFY-98).
 */
@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly name = 'Ada';
  readonly count = signal(1);

  more(): void {
    this.count.update((n) => n + 1);
  }

  fewer(): void {
    this.count.update((n) => (n > 0 ? n - 1 : 0));
  }
}
