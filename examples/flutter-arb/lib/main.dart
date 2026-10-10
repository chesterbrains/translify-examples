import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'l10n/app_localizations.dart';

void main() => runApp(const CartApp());

/// The strings come from `lib/l10n/app_*.arb`, written by `translify pull` and
/// compiled by `flutter gen-l10n` into [AppLocalizations].
class CartApp extends StatefulWidget {
  const CartApp({super.key, this.initialLocale = const Locale('en')});

  final Locale initialLocale;

  @override
  State<CartApp> createState() => _CartAppState();
}

class _CartAppState extends State<CartApp> {
  late Locale _locale = widget.initialLocale;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      locale: _locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: CartPage(onLocale: (locale) => setState(() => _locale = locale)),
    );
  }
}

class CartPage extends StatefulWidget {
  const CartPage({super.key, required this.onLocale});

  final ValueChanged<Locale> onLocale;

  @override
  State<CartPage> createState() => _CartPageState();
}

class _CartPageState extends State<CartPage> {
  int _count = 1;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.cartTitle),
        actions: [
          TextButton(
            onPressed: () => widget.onLocale(const Locale('en')),
            child: Text(l10n.localeEn),
          ),
          TextButton(
            onPressed: () => widget.onLocale(const Locale('it')),
            child: Text(l10n.localeIt),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.greeting('Alex')),
            const SizedBox(height: 16),
            Row(
              children: [
                IconButton(
                  tooltip: 'fewer',
                  onPressed: () =>
                      setState(() => _count = _count > 0 ? _count - 1 : 0),
                  icon: const Icon(Icons.remove),
                ),
                Text(l10n.itemCount(_count)),
                IconButton(
                  tooltip: 'more',
                  onPressed: () => setState(() => _count++),
                  icon: const Icon(Icons.add),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (_count == 0)
              Text(l10n.emptyCta)
            else
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(l10n.totalsTotal),
                  Text('${(_count * 12.5).toStringAsFixed(2)} €'),
                ],
              ),
            const SizedBox(height: 24),
            Wrap(
              spacing: 8,
              children: [
                FilledButton(onPressed: () {}, child: Text(l10n.checkout)),
                OutlinedButton(
                  onPressed: () {},
                  child: Text(l10n.continueShopping),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
