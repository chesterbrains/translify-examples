// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "App",
    defaultLocalization: "en",
    targets: [
        .target(name: "App", resources: [.process("Localizable.xcstrings")])
    ]
)
