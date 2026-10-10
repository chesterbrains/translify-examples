import 'package:flutter/material.dart';
import 'package:flutter_arb_example/l10n/app_localizations.dart';
import 'package:flutter_arb_example/main.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> pumpIn(WidgetTester tester, Locale locale) async {
  await tester.pumpWidget(CartApp(initialLocale: locale));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('renders the English catalog', (tester) async {
    await pumpIn(tester, const Locale('en'));
    expect(find.text('Your cart'), findsOneWidget);
    expect(find.text('1 item'), findsOneWidget);
    expect(find.text('Hello, Alex'), findsOneWidget);
  });

  testWidgets('renders the Italian catalog', (tester) async {
    await pumpIn(tester, const Locale('it'));
    expect(find.text('Il tuo carrello'), findsOneWidget);
    expect(find.text('1 articolo'), findsOneWidget);
  });

  testWidgets('Italian zero takes the other branch and shows the empty state', (tester) async {
    await pumpIn(tester, const Locale('it'));
    await tester.tap(find.byTooltip('fewer'));
    await tester.pump();
    expect(find.text('0 articoli'), findsOneWidget);
    expect(find.text('Inizia a fare acquisti'), findsOneWidget);
  });

  testWidgets('the plural follows the stepper, zero included', (tester) async {
    await pumpIn(tester, const Locale('en'));
    await tester.tap(find.byTooltip('more'));
    await tester.tap(find.byTooltip('more'));
    await tester.pump();
    expect(find.text('3 items'), findsOneWidget);
    for (var i = 0; i < 3; i++) {
      await tester.tap(find.byTooltip('fewer'));
    }
    await tester.pump();
    expect(find.text('0 items'), findsOneWidget);
    expect(find.text('Start shopping'), findsOneWidget);
  });

  test('supported locales match the pulled ARB files', () {
    expect(
      AppLocalizations.supportedLocales,
      containsAll([const Locale('en'), const Locale('it')]),
    );
  });
}
