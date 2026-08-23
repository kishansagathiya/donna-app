import UIKit
import UniformTypeIdentifiers

/// Lightweight share extension: copy shared items into the App Group, then
/// wake the host app. The host reads the same UserDefaults keys as
/// `react-native-share-menu` and turns them into notes.
final class ShareViewController: UIViewController {
  private let appGroupId = "group.com.kishansagathiya.donna"
  private let hostURL = URL(string: "donna://share")!
  private let userDefaultsKey = "ShareMenuUserDefaults"
  private let extraDataKey = "ShareMenuUserDefaultsExtraData"

  private let statusLabel: UILabel = {
    let label = UILabel()
    label.text = "Saving to Donna…"
    label.textAlignment = .center
    label.font = .systemFont(ofSize: 17, weight: .medium)
    label.textColor = .label
    label.translatesAutoresizingMaskIntoConstraints = false
    return label
  }()

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemBackground
    view.addSubview(statusLabel)
    NSLayoutConstraint.activate([
      statusLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      statusLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor),
      statusLabel.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24),
      statusLabel.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -24),
    ])
    processShare()
  }

  private func processShare() {
    let providers = (extensionContext?.inputItems as? [NSExtensionItem])?
      .flatMap { $0.attachments ?? [] } ?? []

    Task {
      var shared: [[String: String]] = []
      for provider in providers {
        if let item = await loadItem(from: provider) {
          shared.append(item)
        }
      }

      persist(shared)

      await MainActor.run {
        self.statusLabel.text = shared.isEmpty ? "Nothing to save" : "Opening Donna…"
        self.openHostApp(with: shared)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
          self.complete()
        }
      }
    }
  }

  private func persist(_ items: [[String: String]]) {
    guard let defaults = UserDefaults(suiteName: appGroupId) else { return }
    if items.isEmpty {
      defaults.removeObject(forKey: userDefaultsKey)
    } else {
      defaults.set(items, forKey: userDefaultsKey)
    }
    defaults.removeObject(forKey: extraDataKey)
    defaults.synchronize()

    if let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) {
      let inbox = container.appendingPathComponent("donna-share-inbox.json")
      if items.isEmpty {
        try? FileManager.default.removeItem(at: inbox)
      } else if let data = try? JSONSerialization.data(withJSONObject: ["items": items]) {
        try? data.write(to: inbox, options: .atomic)
      }
    }
  }

  private func loadItem(from provider: NSItemProvider) async -> [String: String]? {
    if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
       !provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier),
       let url = await loadURL(from: provider),
       !url.isFileURL {
      return ["data": url.absoluteString, "mimeType": "text/plain"]
    }

    if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
       let text = await loadText(from: provider) {
      let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
      if !trimmed.isEmpty {
        return ["data": trimmed, "mimeType": "text/plain"]
      }
    }

    if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier),
       let file = await loadImage(from: provider) {
      return file
    }

    if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier)
      || provider.hasItemConformingToTypeIdentifier(UTType.data.identifier),
       let file = await loadFile(from: provider) {
      return file
    }

    return nil
  }

  private func loadURL(from provider: NSItemProvider) async -> URL? {
    await withCheckedContinuation { continuation in
      provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { item, _ in
        if let url = item as? URL {
          continuation.resume(returning: url)
        } else if let data = item as? Data,
                  let url = URL(dataRepresentation: data, relativeTo: nil) {
          continuation.resume(returning: url)
        } else if let text = item as? String, let url = URL(string: text) {
          continuation.resume(returning: url)
        } else {
          continuation.resume(returning: nil)
        }
      }
    }
  }

  private func loadText(from provider: NSItemProvider) async -> String? {
    await withCheckedContinuation { continuation in
      provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { item, _ in
        if let text = item as? String {
          continuation.resume(returning: text)
        } else if let data = item as? Data {
          continuation.resume(returning: String(data: data, encoding: .utf8))
        } else if let url = item as? URL {
          continuation.resume(returning: url.absoluteString)
        } else {
          continuation.resume(returning: nil)
        }
      }
    }
  }

  private func loadImage(from provider: NSItemProvider) async -> [String: String]? {
    let item: Any? = await withCheckedContinuation { continuation in
      let type = provider.hasItemConformingToTypeIdentifier(UTType.image.identifier)
        ? UTType.image.identifier
        : UTType.data.identifier
      provider.loadItem(forTypeIdentifier: type, options: nil) { loaded, _ in
        continuation.resume(returning: loaded)
      }
    }

    if let url = item as? URL {
      return copyToAppGroup(from: url, mimeType: mimeType(for: url))
    }
    if let image = item as? UIImage, let data = image.jpegData(compressionQuality: 0.9) {
      return writeToAppGroup(data: data, filename: "\(UUID().uuidString).jpg", mimeType: "image/jpeg")
    }
    if let data = item as? Data {
      return writeToAppGroup(data: data, filename: "\(UUID().uuidString).jpg", mimeType: "image/jpeg")
    }
    return nil
  }

  private func loadFile(from provider: NSItemProvider) async -> [String: String]? {
    let type = provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier)
      ? UTType.fileURL.identifier
      : UTType.data.identifier
    let item: Any? = await withCheckedContinuation { continuation in
      provider.loadItem(forTypeIdentifier: type, options: nil) { loaded, _ in
        continuation.resume(returning: loaded)
      }
    }

    if let url = item as? URL {
      return copyToAppGroup(from: url, mimeType: mimeType(for: url))
    }
    if let data = item as? Data {
      let ext = preferredExtension(for: provider) ?? "bin"
      return writeToAppGroup(
        data: data,
        filename: "\(UUID().uuidString).\(ext)",
        mimeType: mimeType(forExtension: ext)
      )
    }
    return nil
  }

  private func copyToAppGroup(from src: URL, mimeType: String) -> [String: String]? {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
      return nil
    }
    let ext = src.pathExtension.isEmpty ? "bin" : src.pathExtension
    let dest = container.appendingPathComponent("\(UUID().uuidString).\(ext)")
    do {
      if FileManager.default.fileExists(atPath: dest.path) {
        try FileManager.default.removeItem(at: dest)
      }
      try FileManager.default.copyItem(at: src, to: dest)
      return ["data": dest.absoluteString, "mimeType": mimeType]
    } catch {
      return nil
    }
  }

  private func writeToAppGroup(data: Data, filename: String, mimeType: String) -> [String: String]? {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
      return nil
    }
    let dest = container.appendingPathComponent(filename)
    do {
      try data.write(to: dest, options: .atomic)
      return ["data": dest.absoluteString, "mimeType": mimeType]
    } catch {
      return nil
    }
  }

  private func preferredExtension(for provider: NSItemProvider) -> String? {
    for identifier in provider.registeredTypeIdentifiers {
      if let type = UTType(identifier), let ext = type.preferredFilenameExtension {
        return ext
      }
    }
    return nil
  }

  private func mimeType(for url: URL) -> String {
    mimeType(forExtension: url.pathExtension)
  }

  private func mimeType(forExtension ext: String) -> String {
    let lowered = ext.lowercased()
    if let type = UTType(filenameExtension: lowered), let mime = type.preferredMIMEType {
      return mime
    }
    switch lowered {
    case "jpg", "jpeg": return "image/jpeg"
    case "png": return "image/png"
    case "gif": return "image/gif"
    case "webp": return "image/webp"
    case "heic": return "image/heic"
    case "pdf": return "application/pdf"
    case "txt": return "text/plain"
    case "html", "htm": return "text/html"
    case "mp3": return "audio/mpeg"
    case "m4a": return "audio/m4a"
    default: return "application/octet-stream"
    }
  }

  private func openHostApp(with items: [[String: String]]) {
    let url = shareURL(with: items)
    var responder: UIResponder? = self
    let openSelector = sel_registerName("openURL:")
    while let current = responder {
      if let application = current as? UIApplication {
        application.open(url, options: [:], completionHandler: nil)
        return
      }
      if current.responds(to: openSelector) {
        _ = current.perform(openSelector, with: url)
      }
      responder = current.next
    }
  }

  private func shareURL(with items: [[String: String]]) -> URL {
    var components = URLComponents()
    components.scheme = "donna"
    components.host = "share"
    if !items.isEmpty,
       let json = try? JSONSerialization.data(withJSONObject: items),
       json.count <= 4000,
       let payload = String(data: json, encoding: .utf8) {
      components.queryItems = [URLQueryItem(name: "payload", value: payload)]
    }
    return components.url ?? hostURL
  }

  private func complete() {
    extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
  }
}
