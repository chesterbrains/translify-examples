<?php
// Loads the pulled translations/ with Symfony's standalone Translator (what the framework wires for you) and prints
// what the app would render for one locale.
// Usage: php app.php [locale]   (default: en)
declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use Symfony\Component\Translation\Loader\YamlFileLoader;
use Symfony\Component\Translation\Translator;

$locale = $argv[1] ?? 'en';

$translator = new Translator($locale);
$translator->setFallbackLocales(['en']);
$translator->addLoader('yaml', new YamlFileLoader());

// The domain name carries the +intl-icu suffix, exactly as FrameworkBundle registers the files it finds: trans() on
// domain "checkout" consults "checkout+intl-icu" first and formats it with ICU MessageFormat.
foreach (['en', 'it'] as $l) {
    foreach (['messages' => "messages.$l.yaml", 'checkout+intl-icu' => "checkout+intl-icu.$l.yaml"] as $domain => $file) {
        $path = __DIR__ . "/translations/$file";
        if (is_file($path)) { // a target locale with nothing translated in a domain has no file; Symfony falls back
            $translator->addResource('yaml', $path, $l, $domain);
        }
    }
}

$t = fn (string $id, array $parameters = [], ?string $domain = null): string => $translator->trans($id, $parameters, $domain);

$out = [
    'app_title' => $t('app.title'),
    'cart_actions' => $t('cart.actions'),
    'cart_address' => $t('cart.address'),
    'greeting_legacy' => $t('cart.greeting', ['%name%' => 'Ada']),
    'greeting_icu' => $t('greeting', ['%name%' => 'Ada'], 'checkout'),
    'settings_agent' => $t('settings.agent'),
    'settings_confirm' => $t('settings.confirm'),
    'settings_decline' => $t('settings.decline'),
    'step_card_label' => $t('steps.payment.card.label', [], 'checkout'),
    'step_title' => $t('steps.payment.title', [], 'checkout'),
    'step_hints' => [$t('steps.hints.0', [], 'checkout'), $t('steps.hints.1', [], 'checkout'), $t('steps.hints.2', [], 'checkout')],
];
foreach ([0, 1, 5] as $n) {
    $out["items_legacy_$n"] = $t('cart.items', ['%count%' => $n]);
    $out["items_icu_$n"] = $t('items', ['%count%' => $n], 'checkout');
}
ksort($out);
echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), "\n";
