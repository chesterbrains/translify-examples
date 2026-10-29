// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "App",
    defaultLocalization: "en",
    targets: [
        .executableTarget(name: "App", resources: [.process("en.lproj"), .process("it.lproj")])
    ]
)
