import Foundation

enum DonnaShareStore {
  static let appGroupId = "group.com.kishansagathiya.donna"
  static let userDefaultsKey = "ShareMenuUserDefaults"
  static let inboxFileName = "donna-share-inbox.json"
  static let payloadQueryKey = "payload"

  private static var memoryItems: [[String: String]] = []
  private static let lock = NSLock()

  static func ingest(url: URL) {
    guard url.scheme == "donna" else { return }
    guard let items = itemsFromShareURL(url), !items.isEmpty else { return }
    append(items)
  }

  static func takePending() -> [[String: String]] {
    lock.lock()
    defer { lock.unlock() }

    var items = memoryItems
    items.append(contentsOf: readInboxFile())
    items.append(contentsOf: readUserDefaults())
    memoryItems = []
    clearPersisted()
    return dedupe(items)
  }

  static func append(_ items: [[String: String]]) {
    guard !items.isEmpty else { return }
    lock.lock()
    memoryItems.append(contentsOf: items)
    lock.unlock()
  }

  static func itemsFromShareURL(_ url: URL) -> [[String: String]]? {
    guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
      return nil
    }
    let host = components.host ?? ""
    let path = components.path
    let isShare = host == "share" || path == "share" || path == "/share" || url.absoluteString.hasPrefix("donna://share")
    if !isShare {
      return nil
    }
    guard let raw = components.queryItems?.first(where: { $0.name == payloadQueryKey })?.value,
          let data = raw.data(using: .utf8)
    else {
      return nil
    }
    return decodeItems(data)
  }

  private static func readInboxFile() -> [[String: String]] {
    guard let url = inboxURL(),
          let data = try? Data(contentsOf: url)
    else {
      return []
    }
    return decodeItems(data)
  }

  private static func readUserDefaults() -> [[String: String]] {
    guard let defaults = UserDefaults(suiteName: appGroupId),
          let raw = defaults.object(forKey: userDefaultsKey)
    else {
      return []
    }
    if let typed = raw as? [[String: String]] {
      return typed
    }
    guard let anyItems = raw as? [[String: Any]] else {
      return []
    }
    return anyItems.compactMap { dict in
      guard let data = dict["data"] as? String, !data.isEmpty else { return nil }
      return [
        "data": data,
        "mimeType": (dict["mimeType"] as? String) ?? "text/plain",
      ]
    }
  }

  private static func decodeItems(_ data: Data) -> [[String: String]] {
    if let wrapped = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
       let rawItems = wrapped["items"] as? [[String: Any]] {
      return compactItems(rawItems)
    }
    if let rawItems = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
      return compactItems(rawItems)
    }
    return []
  }

  private static func compactItems(_ rawItems: [[String: Any]]) -> [[String: String]] {
    rawItems.compactMap { dict in
      guard let data = dict["data"] as? String, !data.isEmpty else { return nil }
      return [
        "data": data,
        "mimeType": (dict["mimeType"] as? String) ?? "text/plain",
      ]
    }
  }

  private static func inboxURL() -> URL? {
    FileManager.default
      .containerURL(forSecurityApplicationGroupIdentifier: appGroupId)?
      .appendingPathComponent(inboxFileName)
  }

  private static func clearPersisted() {
    if let url = inboxURL() {
      try? FileManager.default.removeItem(at: url)
    }
    UserDefaults(suiteName: appGroupId)?.removeObject(forKey: userDefaultsKey)
    UserDefaults(suiteName: appGroupId)?.synchronize()
  }

  private static func dedupe(_ items: [[String: String]]) -> [[String: String]] {
    var seen = Set<String>()
    var out: [[String: String]] = []
    for item in items {
      let key = "\(item["mimeType"] ?? "")|\(item["data"] ?? "")"
      if seen.insert(key).inserted {
        out.append(item)
      }
    }
    return out
  }
}
