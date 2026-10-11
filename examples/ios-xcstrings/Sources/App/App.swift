import Foundation

/// Every string is looked up by its Translify key; the catalog's English text is the source.
public enum Cart {
    public static var plain: String { String(localized: "plain", bundle: .module) }
    public static func greeting(_ name: String) -> String {
        String(format: String(localized: "greeting", bundle: .module), name)
    }
    public static func positional(_ name: String, _ count: Int) -> String {
        String(format: String(localized: "positional", bundle: .module), name, count)
    }
    public static func itemCount(_ count: Int) -> String {
        String(format: String(localized: "itemCount", bundle: .module), count)
    }
    public static func cartSummary(_ count: Int) -> String {
        String(format: String(localized: "cartSummary", bundle: .module), count)
    }
}
