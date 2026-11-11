import UIKit

/// What the app shows and where. The values come from Info.plist, which takes them from the settings at the top of
/// project.yml, so a rename or a move of the site is one edit there.
enum AppConfig {
    private static func info(_ key: String) -> String {
        (Bundle.main.object(forInfoDictionaryKey: key) as? String) ?? ""
    }

    static let host: String = info("DribitHost")
    static let pathPrefix: String = info("DribitPathPrefix")
    static let version: String = info("CFBundleShortVersionString")
    static let build: String = info("CFBundleVersion")

    static let startURL: URL = {
        #if DEBUG
        if let override = debugArgument("-dribitURL"), let url = URL(string: override) { return url }
        #endif
        return URL(string: info("DribitStartURL")) ?? URL(string: "https://\(host)\(pathPrefix)")!
    }()

    /// The green of the logo and the opening screen (#0E6E58).
    static let brand = UIColor(red: 14 / 255, green: 110 / 255, blue: 88 / 255, alpha: 1)

    /// A page of the app itself (it stays inside); anything else opens outside the app.
    static func isAppPage(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased(), scheme == "https", url.host?.lowercased() == host.lowercased() else { return false }
        let path = url.path.isEmpty ? "/" : url.path
        let prefix = pathPrefix.hasSuffix("/") ? String(pathPrefix.dropLast()) : pathPrefix
        return path == prefix || path.hasPrefix(prefix + "/")
    }

    #if DEBUG
    /// Test builds only: `-dribitURL <address>` and `-dribitJS <script>` on the launch line let the build workflow open a
    /// given screen in the simulator and take a picture of it.
    static func debugArgument(_ name: String) -> String? {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: name), i + 1 < args.count else { return nil }
        return args[i + 1]
    }
    #endif
}

extension UIColor {
    /// True for a light colour, where the clock and battery should be dark.
    var isLight: Bool {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        guard getRed(&r, green: &g, blue: &b, alpha: &a) else { return true }
        return (0.299 * r + 0.587 * g + 0.114 * b) > 0.6
    }
}
