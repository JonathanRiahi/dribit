import Network
import SafariServices
import StoreKit
import UIKit
import UserNotifications
import WebKit

/// The whole app is one screen: the web app, edge to edge under the clock, with no browser bars.
/// Pages of the app stay here; any other link opens outside (WhatsApp, or a Safari sheet over the app).
final class WebViewController: UIViewController {
    private var webView: WKWebView!
    private let cover = LaunchCover()
    private var offline: OfflineView?
    private var pageShown = false
    private var chromeColor = AppConfig.brand
    private let network = NWPathMonitor()
    private var online = true
    private var patience: DispatchWorkItem?

    override var preferredStatusBarStyle: UIStatusBarStyle {
        chromeColor.isLight ? .darkContent : .lightContent
    }

    #if DEBUG
    private static let quietAnalytics = """
    (function () {
      var realFetch = window.fetch;
      window.fetch = function (input) {
        var url = String((input && input.url) || input);
        if (url.indexOf('posthog') >= 0) return Promise.resolve(new Response('{}', { status: 200 }));
        return realFetch.apply(this, arguments);
      };
      var realBeacon = navigator.sendBeacon;
      if (realBeacon) navigator.sendBeacon = function (url) {
        if (String(url).indexOf('posthog') >= 0) return true;
        return realBeacon.apply(this, arguments);
      };
    })();
    """
    #endif

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = chromeColor

        let configuration = WKWebViewConfiguration()
        // Only our own site (WKAppBoundDomains in Info.plist) may load as a page. This is also what lets the site keep
        // its offline copy inside the app, so it opens without internet after the first time.
        configuration.limitsNavigationsToAppBoundDomains = true
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.applicationNameForUserAgent = "Mobile/15E148 DribitApp/\(AppConfig.version)"
        let content = configuration.userContentController
        content.addUserScript(WKUserScript(source: Bridge.script(), injectionTime: .atDocumentStart, forMainFrameOnly: true))
        content.addScriptMessageHandler(Bridge(owner: self), contentWorld: .page, name: "dribit")
        #if DEBUG
        // test builds never report usage: the build machine is not a person, and must not show up in the numbers
        content.addUserScript(WKUserScript(source: Self.quietAnalytics, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        #endif

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsLinkPreview = false
        webView.allowsBackForwardNavigationGestures = false
        #if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        #endif
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            // below the clock, like the app installed from Safari; the bottom runs to the edge and the page keeps
            // clear of the home bar by itself
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        cover.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(cover)
        NSLayoutConstraint.activate([
            cover.topAnchor.constraint(equalTo: view.topAnchor),
            cover.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            cover.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            cover.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        Reminders.shared.onOpen = { [weak self] in self?.emit("notification_open") }

        network.pathUpdateHandler = { [weak self] path in
            let nowOnline = path.status == .satisfied
            DispatchQueue.main.async {
                guard let self = self else { return }
                let cameBack = nowOnline && !self.online
                self.online = nowOnline
                if cameBack && self.offline != nil { self.load() }
            }
        }
        network.start(queue: DispatchQueue(label: "dribit.network"))

        load()
    }

    deinit {
        network.cancel()
    }

    // MARK: Loading

    private func load() {
        var request = URLRequest(url: AppConfig.startURL)
        request.timeoutInterval = 20
        note("load \(AppConfig.startURL.absoluteString)")
        webView.load(request)
        // the real wait starts when the site is asked (see "asked the site" below); this one is for a load that never starts
        waitForPage(25)
    }

    /// A connection that neither opens nor fails (weak reception, a Wi-Fi sign-in page) must not leave the logo on for
    /// a minute: when the wait runs out with no page, the "no connection" screen comes up. The page keeps loading
    /// behind it, and takes over if it arrives.
    fileprivate func waitForPage(_ seconds: TimeInterval) {
        patience?.cancel()
        let wait = DispatchWorkItem { [weak self] in
            guard let self = self, !self.pageShown else { return }
            self.note("still no page after \(Int(seconds)) seconds")
            self.showOffline()
        }
        patience = wait
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: wait)
    }

    /// Test builds write what happens to the log, where the build workflow reads it.
    fileprivate func note(_ text: String) {
        #if DEBUG
        NSLog("DRIBIT-APP %@", text)
        #endif
    }

    func appBecameActive() {
        guard isViewLoaded else { return }
        if offline != nil || webView.url == nil { load() }
    }

    /// The page is on screen: the opening cover fades away.
    fileprivate func pageReady() {
        guard !pageShown else { return }
        pageShown = true
        patience?.cancel()
        note("page ready")
        hideOffline()
        if cover.superview != nil {
            UIView.animate(withDuration: 0.25, animations: { self.cover.alpha = 0 }, completion: { _ in
                self.cover.removeFromSuperview()
            })
        }
        #if DEBUG
        if let script = AppConfig.debugArgument("-dribitJS") {
            DispatchQueue.main.asyncAfter(deadline: .now() + 4) { self.webView.evaluateJavaScript(script, completionHandler: nil) }
        }
        #endif
    }

    private func showOffline() {
        patience?.cancel()
        guard offline == nil else { return }
        note("no connection screen")
        let panel = OfflineView()
        panel.onRetry = { [weak self] in self?.load() }
        panel.translatesAutoresizingMaskIntoConstraints = false
        if cover.superview === view { view.insertSubview(panel, belowSubview: cover) } else { view.addSubview(panel) }
        NSLayoutConstraint.activate([
            panel.topAnchor.constraint(equalTo: view.topAnchor),
            panel.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            panel.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            panel.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        offline = panel
        setChrome(AppConfig.brand)
        cover.alpha = 0
    }

    private func hideOffline() {
        offline?.removeFromSuperview()
        offline = nil
    }

    private func failed(_ error: Error) {
        let code = (error as NSError).code
        note("failed \((error as NSError).domain) \(code)")
        if code == NSURLErrorCancelled || code == 102 { return } // 102: a link we chose to open outside
        showOffline()
    }

    // MARK: What the page asks for

    fileprivate func setChrome(_ color: UIColor) {
        chromeColor = color
        UIView.animate(withDuration: 0.2) {
            self.view.backgroundColor = color
            self.setNeedsStatusBarAppearanceUpdate()
        }
    }

    fileprivate func emit(_ type: String) {
        guard pageShown else { return }
        webView.evaluateJavaScript("window.DribitNative && window.DribitNative._emit('\(type)')", completionHandler: nil)
    }

    fileprivate func share(text: String, url: String, done: @escaping (Bool) -> Void) {
        var items: [Any] = []
        if !text.isEmpty { items.append(text) }
        if let link = URL(string: url), !url.isEmpty { items.append(link) }
        guard !items.isEmpty else { done(false); return }
        let sheet = UIActivityViewController(activityItems: items, applicationActivities: nil)
        sheet.completionWithItemsHandler = { _, completed, _, _ in done(completed) }
        sheet.popoverPresentationController?.sourceView = view
        sheet.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 80, width: 1, height: 1)
        topController().present(sheet, animated: true)
    }

    fileprivate func requestReview() {
        guard let scene = view.window?.windowScene else { return }
        if #available(iOS 16.0, *) {
            AppStore.requestReview(in: scene)
        } else {
            SKStoreReviewController.requestReview(in: scene)
        }
    }

    fileprivate func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
    }

    /// A link that is not a page of the app: WhatsApp and other installed apps open directly, a web page opens in a
    /// Safari sheet over the app, so "Done" brings the person straight back to the lesson.
    fileprivate func openOutside(_ url: URL) {
        guard let scheme = url.scheme?.lowercased() else { return }
        if scheme == "http" || scheme == "https" {
            UIApplication.shared.open(url, options: [.universalLinksOnly: true]) { [weak self] opened in
                if !opened { self?.showInSafari(url) }
            }
        } else if ["tel", "mailto", "sms", "whatsapp"].contains(scheme) {
            UIApplication.shared.open(url)
        }
    }

    private func showInSafari(_ url: URL) {
        let safari = SFSafariViewController(url: url)
        safari.preferredControlTintColor = AppConfig.brand
        topController().present(safari, animated: true)
    }

    private func topController() -> UIViewController {
        var top: UIViewController = self
        while let next = top.presentedViewController, !next.isBeingDismissed { top = next }
        return top
    }
}

// MARK: - Navigation

extension WebViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        // frames inside the page (none today) load as the page decides
        if let frame = navigationAction.targetFrame, !frame.isMainFrame { decisionHandler(.allow); return }
        if url.scheme?.lowercased() == "about" { decisionHandler(.allow); return }
        if navigationAction.targetFrame != nil && AppConfig.isAppPage(url) { decisionHandler(.allow); return }
        // a link that asks for a new window, or leads away from the app
        decisionHandler(.cancel)
        if navigationAction.targetFrame == nil && AppConfig.isAppPage(url) { webView.load(navigationAction.request) } else { openOutside(url) }
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        note("asked the site")
        // 15 seconds for an answer, counted from here, so a phone that is slow to start is not taken for a bad connection
        if !pageShown && offline == nil { waitForPage(15) }
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        note("the site answered")
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        note("finished \(webView.url?.absoluteString ?? "(no address)")")
        // only a page of the app counts: an empty page left behind by a failed load must not hide the "no connection" screen
        if let url = webView.url, AppConfig.isAppPage(url) { pageReady() }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        failed(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if !pageShown { failed(error) }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        // iOS closed the page to free memory while the app was in the background
        pageShown = false
        if webView.url != nil { webView.reload() } else { load() }
    }
}

// MARK: - Windows and dialogs the page opens

extension WebViewController: WKUIDelegate {
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            if AppConfig.isAppPage(url) { webView.load(navigationAction.request) } else { openOutside(url) }
        }
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "אישור", style: .default) { _ in completionHandler() })
        topController().present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "ביטול", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "אישור", style: .default) { _ in completionHandler(true) })
        topController().present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: "ביטול", style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "אישור", style: .default) { _ in completionHandler(alert.textFields?.first?.text) })
        topController().present(alert, animated: true)
    }
}

// MARK: - The bridge: what the page can ask the phone

/// Receives `DribitNative.call(cmd, args)` from the page (see bridge.js) and answers it.
final class Bridge: NSObject, WKScriptMessageHandlerWithReply {
    private weak var owner: WebViewController?

    init(owner: WebViewController) {
        self.owner = owner
    }

    /// bridge.js with the app's version filled in.
    static func script() -> String {
        guard let url = Bundle.main.url(forResource: "bridge", withExtension: "js"),
              let source = try? String(contentsOf: url, encoding: .utf8) else { return "" }
        return source
            .replacingOccurrences(of: "%VERSION%", with: AppConfig.version)
            .replacingOccurrences(of: "%BUILD%", with: AppConfig.build)
            .replacingOccurrences(of: "%OS%", with: UIDevice.current.systemVersion)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        // only the app's own page may talk to the phone
        guard message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.host.lowercased() == AppConfig.host.lowercased(),
              let body = message.body as? [String: Any], let cmd = body["cmd"] as? String else {
            replyHandler(nil, "not allowed")
            return
        }
        let args = (body["args"] as? [String: Any]) ?? [:]
        let text: (String) -> String = { (args[$0] as? String) ?? "" }

        switch cmd {
        case "ready":
            owner?.pageReady()
            replyHandler(true, nil)
        case "chrome":
            let part: (String) -> CGFloat = { CGFloat((args[$0] as? NSNumber)?.doubleValue ?? 0) / 255 }
            owner?.setChrome(UIColor(red: part("r"), green: part("g"), blue: part("b"), alpha: 1))
            replyHandler(true, nil)
        case "notifications.status":
            Reminders.shared.status { replyHandler(["permission": $0], nil) }
        case "notifications.request":
            Reminders.shared.request { replyHandler(["permission": $0], nil) }
        case "notifications.schedule":
            let items = (args["items"] as? [[String: Any]]) ?? []
            Reminders.shared.schedule(items) { replyHandler(["scheduled": $0], nil) }
        case "notifications.cancel":
            Reminders.shared.cancelAll()
            replyHandler(true, nil)
        case "notifications.pending":
            Reminders.shared.pending { replyHandler(["items": $0], nil) }
        case "launch.info":
            let opened: Any = Reminders.shared.takeOpened() ?? NSNull()
            replyHandler(["notification": opened], nil)
        case "haptic":
            Haptics.play(text("type"))
            replyHandler(true, nil)
        case "share":
            guard let owner = owner else { replyHandler(["completed": false], nil); return }
            owner.share(text: text("text"), url: text("url")) { replyHandler(["completed": $0], nil) }
        case "open":
            if let url = URL(string: text("url")) { owner?.openOutside(url) }
            replyHandler(true, nil)
        case "settings.open":
            owner?.openSettings()
            replyHandler(true, nil)
        case "review.request":
            owner?.requestReview()
            replyHandler(true, nil)
        #if DEBUG
        case "debug.log": // test builds: the build workflow reads these lines from the simulator
            NSLog("DRIBIT-TEST %@", text("text"))
            replyHandler(true, nil)
        case "debug.provisional": // test builds: quiet permission with no question, so the workflow can check real planning
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .provisional]) { granted, _ in
                DispatchQueue.main.async { replyHandler(["granted": granted], nil) }
            }
        #endif
        default:
            replyHandler(nil, "unknown command: \(cmd)")
        }
    }
}

/// A tap you can feel: right and wrong answers, a finished lesson, a new level.
enum Haptics {
    static func play(_ type: String) {
        switch type {
        case "success": UINotificationFeedbackGenerator().notificationOccurred(.success)
        case "warning": UINotificationFeedbackGenerator().notificationOccurred(.warning)
        case "error": UINotificationFeedbackGenerator().notificationOccurred(.error)
        case "selection": UISelectionFeedbackGenerator().selectionChanged()
        case "medium": UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        case "heavy": UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
        default: UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
    }
}
