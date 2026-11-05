<?php
// Proof that Symfony's standalone Translator reads the pulled files and that they are already in Yaml::dump's layout:
// render every key for it and compare with expected/it.json, then re-dump every translations/*.yaml through
// symfony/yaml and fail on any byte that differs. Needs PHP 8.3 with ext-intl and `composer install`.
declare(strict_types=1);

if (!extension_loaded('intl')) {
    fwrite(STDERR, "ext-intl is required: the +intl-icu domain renders through the legacy formatter without it\n");
    exit(1);
}

require __DIR__ . '/vendor/autoload.php';

use Symfony\Component\Yaml\Yaml;

chdir(__DIR__);

/** Runs a command and returns [exit code, stdout]. */
function run(array $command): array
{
    $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!\is_resource($process)) {
        fwrite(STDERR, 'cannot start ' . implode(' ', $command) . "\n");
        exit(1);
    }
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $code = proc_close($process);
    if ($stderr !== '') {
        fwrite(STDERR, $stderr);
    }

    return [$code, $stdout];
}

/** Prints a unified diff of two texts (expected first). */
function printDiff(string $expected, string $actual, string $expectedLabel, string $actualLabel): void
{
    $dir = sys_get_temp_dir() . '/symfony-yaml-verify-' . getmypid();
    @mkdir($dir);
    file_put_contents("$dir/expected", $expected);
    file_put_contents("$dir/actual", $actual);
    [, $diff] = run(['diff', '-u', '--label', $expectedLabel, '--label', $actualLabel, "$dir/expected", "$dir/actual"]);
    echo $diff;
    unlink("$dir/expected");
    unlink("$dir/actual");
    rmdir($dir);
}

// 1. What the app renders for it must match expected/it.json.
[$code, $rendered] = run([PHP_BINARY, 'app.php', 'it']);
if ($code !== 0) {
    fwrite(STDERR, "app.php it exited with $code\n");
    exit(1);
}
if (!is_file('expected/it.json')) {
    fwrite(STDERR, "expected/it.json is missing: run `php app.php it > expected/it.json` and check it by eye\n");
    exit(1);
}
$expected = file_get_contents('expected/it.json');
if ($rendered !== $expected) {
    echo "it output differs from expected/it.json:\n";
    printDiff($expected, $rendered, 'expected/it.json', 'php app.php it');
    exit(1);
}

// 2. Every pulled file must be exactly what Yaml::dump writes for its own content (block form at every depth, indent 4).
foreach (glob('translations/*.yaml') as $file) {
    $bytes = file_get_contents($file);
    $dumped = Yaml::dump(Yaml::parse($bytes), PHP_INT_MAX, 4);
    if ($dumped !== $bytes) {
        echo "$file is not byte-identical to Yaml::dump:\n";
        printDiff($dumped, $bytes, 'Yaml::dump', $file);
        exit(1);
    }
}

echo "ok: it output matches expected/it.json and every translations/*.yaml is byte-identical to Yaml::dump\n";
