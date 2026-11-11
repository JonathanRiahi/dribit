import UIKit

/// The logo on green, the same picture as the launch screen, kept on until the page itself is on screen.
final class LaunchCover: UIView {
    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = AppConfig.brand
        isUserInteractionEnabled = false
        let logo = UIImageView(image: UIImage(named: "LaunchLogo"))
        logo.translatesAutoresizingMaskIntoConstraints = false
        addSubview(logo)
        NSLayoutConstraint.activate([
            logo.centerXAnchor.constraint(equalTo: centerXAnchor),
            logo.centerYAnchor.constraint(equalTo: centerYAnchor)
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not used")
    }
}

/// Shown when the app cannot load: the first open with no internet (after that the lessons are kept on the phone).
final class OfflineView: UIView {
    var onRetry: (() -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = AppConfig.brand
        semanticContentAttribute = .forceRightToLeft

        let logo = UIImageView(image: UIImage(named: "LaunchLogo"))
        logo.setContentHuggingPriority(.required, for: .vertical)

        let title = UILabel()
        title.text = "אין חיבור לאינטרנט"
        title.font = UIFontMetrics(forTextStyle: .title2).scaledFont(for: .systemFont(ofSize: 24, weight: .bold))
        title.adjustsFontForContentSizeCategory = true
        title.textColor = .white
        title.textAlignment = .center
        title.numberOfLines = 0

        let detail = UILabel()
        detail.text = "צריך חיבור כדי לפתוח את דריבית בפעם הראשונה. אחר כך השיעורים נשמרים בטלפון ונפתחים גם בלי אינטרנט."
        detail.font = UIFontMetrics(forTextStyle: .body).scaledFont(for: .systemFont(ofSize: 17))
        detail.adjustsFontForContentSizeCategory = true
        detail.textColor = UIColor.white.withAlphaComponent(0.85)
        detail.textAlignment = .center
        detail.numberOfLines = 0

        let retry = UIButton(type: .system)
        retry.setTitle("לנסות שוב", for: .normal)
        retry.titleLabel?.font = UIFontMetrics(forTextStyle: .headline).scaledFont(for: .systemFont(ofSize: 18, weight: .semibold))
        retry.titleLabel?.adjustsFontForContentSizeCategory = true
        retry.setTitleColor(UIColor(red: 42 / 255, green: 30 / 255, blue: 0, alpha: 1), for: .normal)
        retry.backgroundColor = UIColor(red: 246 / 255, green: 192 / 255, blue: 46 / 255, alpha: 1) // the gold of the main buttons
        retry.layer.cornerRadius = 14
        retry.addTarget(self, action: #selector(retryTapped), for: .touchUpInside)
        retry.heightAnchor.constraint(greaterThanOrEqualToConstant: 52).isActive = true

        let stack = UIStackView(arrangedSubviews: [logo, title, detail, retry])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 16
        stack.setCustomSpacing(24, after: logo)
        stack.setCustomSpacing(28, after: detail)
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
            stack.leadingAnchor.constraint(equalTo: layoutMarginsGuide.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: layoutMarginsGuide.trailingAnchor, constant: -16),
            retry.widthAnchor.constraint(equalTo: stack.widthAnchor)
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not used")
    }

    @objc private func retryTapped() {
        onRetry?()
    }
}
