import Foundation

/// Prints every key of one localization, formatted with fixed arguments, as sorted JSON.
/// `swift run App it` reads `it.lproj` through its own bundle, so the result does not depend on the Mac's language.
let language = CommandLine.arguments.dropFirst().first ?? "en"
guard let path = Bundle.module.path(forResource: language, ofType: "lproj"), let bundle = Bundle(path: path) else {
    FileHandle.standardError.write(Data("no \(language).lproj in the bundle\n".utf8))
    exit(1)
}

/// Looks a key up in `Localizable.stringsdict` first, then `Localizable.strings`, as Foundation does.
func text(_ key: String) -> String { bundle.localizedString(forKey: key, value: "<missing \(key)>", table: nil) }
func format(_ key: String, _ args: CVarArg...) -> String { String(format: text(key), arguments: args) }

let output: [String: String] = [
    "plain": text("plain"),
    "greeting": format("greeting", "Ann"),
    "positional": format("positional", "Ann", 3),
    "itemCount.1": format("itemCount", 1),
    "itemCount.5": format("itemCount", 5),
    "cartSummary.1": format("cartSummary", 1),
    "cartSummary.5": format("cartSummary", 5),
]
let json = try JSONSerialization.data(withJSONObject: output, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])
print(String(decoding: json, as: UTF8.self))
