# Loads the pulled locale files with Ruby's I18n (what Rails uses) and prints what the app would render.
# Usage: ruby app.rb [locale]   (default: en)
require "date"
require "json"
require "i18n"

I18n.load_path = Dir[File.join(__dir__, "config/locales/*.yml")]
I18n.available_locales = %i[en it]
I18n.enforce_available_locales = true
I18n.default_locale = :en

locale = (ARGV[0] || "en").to_sym

I18n.with_locale(locale) do
  output = {
    "title" => I18n.t("app.cart.title"),
    "heading" => I18n.t("app.cart.heading"),
    "greeting" => I18n.t("app.greeting", name: "Ada"),
    "items_0" => I18n.t("app.items", count: 0),
    "items_1" => I18n.t("app.items", count: 1),
    "items_5" => I18n.t("app.items", count: 5),
    "html" => I18n.t("app.welcome_html"),
    "day_names" => I18n.t("date.day_names"),
    "abbr_month_names" => I18n.t("date.abbr_month_names"),
    "order" => I18n.t("date.order").map(&:inspect),
    "date_short" => I18n.l(Date.new(2026, 10, 31), format: :short),
    "date_default" => I18n.l(Date.new(2026, 10, 31)),
    "precision" => I18n.t("number.format.precision"),
    "delimiter" => I18n.t("number.format.delimiter"),
    "separator" => I18n.t("number.format.separator"),
    "strip_insignificant_zeros" => I18n.t("number.format.strip_insignificant_zeros")
  }
  puts JSON.pretty_generate(output.sort.to_h)
end
