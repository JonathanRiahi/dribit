import Foundation
import UserNotifications

/// The daily reminder. The phone itself shows it at the hour the page asked for, so no server is involved:
/// the page hands over the next days' reminders each time it opens or a lesson ends, and the app plans them.
final class Reminders: NSObject, UNUserNotificationCenterDelegate {
    static let shared = Reminders()

    private let center = UNUserNotificationCenter.current()
    /// The reminder that was tapped to open the app, kept until the page asks for it.
    private var opened: [String: Any]?
    /// Called on the main queue when a reminder is tapped.
    var onOpen: (() -> Void)?

    /// "granted", "denied" or "default" (not asked yet), the same words the web uses.
    func status(_ done: @escaping (String) -> Void) {
        center.getNotificationSettings { settings in
            let value: String
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral: value = "granted"
            case .denied: value = "denied"
            default: value = "default"
            }
            DispatchQueue.main.async { done(value) }
        }
    }

    func request(_ done: @escaping (String) -> Void) {
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            DispatchQueue.main.async { done(granted ? "granted" : "denied") }
        }
    }

    /// Replaces every planned reminder with `items`: `at` (milliseconds since 1970), `title`, `body`, `id`, `kind`.
    func schedule(_ items: [[String: Any]], done: @escaping (Int) -> Void) {
        center.removeAllPendingNotificationRequests()
        let now = Date()
        let lock = NSLock()
        var planned = 0
        let group = DispatchGroup()
        for item in items.prefix(60) { // iOS keeps at most 64 planned notifications per app
            guard let at = (item["at"] as? NSNumber)?.doubleValue,
                  let body = item["body"] as? String, !body.isEmpty else { continue }
            let date = Date(timeIntervalSince1970: at / 1000)
            guard date.timeIntervalSince(now) > 5 else { continue }
            let id = (item["id"] as? String) ?? "reminder-\(Int(at / 1000))"
            let content = UNMutableNotificationContent()
            content.title = (item["title"] as? String) ?? ""
            content.body = body
            content.sound = .default
            content.userInfo = ["id": id, "kind": (item["kind"] as? String) ?? "daily"]
            let parts = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
            let trigger = UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)
            group.enter()
            center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger)) { error in
                if error == nil { lock.lock(); planned += 1; lock.unlock() }
                group.leave()
            }
        }
        group.notify(queue: .main) { done(planned) }
    }

    func cancelAll() {
        center.removeAllPendingNotificationRequests()
        center.removeAllDeliveredNotifications()
    }

    /// Opening the app clears old reminders from the notification list.
    func clearDelivered() {
        center.removeAllDeliveredNotifications()
    }

    func pending(_ done: @escaping ([[String: Any]]) -> Void) {
        center.getPendingNotificationRequests { requests in
            let list: [[String: Any]] = requests.map { request in
                var row: [String: Any] = ["id": request.identifier, "body": request.content.body]
                if let next = (request.trigger as? UNCalendarNotificationTrigger)?.nextTriggerDate() {
                    row["at"] = next.timeIntervalSince1970 * 1000
                }
                return row
            }
            DispatchQueue.main.async { done(list) }
        }
    }

    /// Hands over the tapped reminder once.
    func takeOpened() -> [String: Any]? {
        let value = opened
        opened = nil
        return value
    }

    // MARK: UNUserNotificationCenterDelegate

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([]) // the app is already open: no banner over the lesson
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let info = response.notification.request.content.userInfo
        let data: [String: Any] = [
            "id": (info["id"] as? String) ?? response.notification.request.identifier,
            "kind": (info["kind"] as? String) ?? "daily"
        ]
        DispatchQueue.main.async {
            self.opened = data
            self.onOpen?()
            completionHandler()
        }
    }
}
