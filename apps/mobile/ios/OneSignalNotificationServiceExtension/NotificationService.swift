import UserNotifications
import OneSignalExtension
import Intents

class NotificationService: UNNotificationServiceExtension {
    var contentHandler: ((UNNotificationContent) -> Void)?
    var receivedRequest: UNNotificationRequest!
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.receivedRequest = request
        self.contentHandler = contentHandler
        self.bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        if let bestAttemptContent = bestAttemptContent {
            // Let OneSignal process the notification first (handles badge counts, etc.)
            OneSignalExtension.didReceiveNotificationExtensionRequest(self.receivedRequest, with: bestAttemptContent, withContentHandler: { [weak self] content in
                guard let self = self else {
                    contentHandler(content)
                    return
                }

                // After OneSignal processing, enrich with Communication Notification
                let mutableContent = (content.mutableCopy() as? UNMutableNotificationContent) ?? bestAttemptContent
                self.enrichWithCommunicationNotification(mutableContent) { enrichedContent in
                    contentHandler(enrichedContent)
                }
            })
        }
    }

    override func serviceExtensionTimeWillExpire() {
        if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
            OneSignalExtension.serviceExtensionTimeWillExpireRequest(self.receivedRequest, with: self.bestAttemptContent)
            contentHandler(bestAttemptContent)
        }
    }

    // MARK: - Communication Notification Enrichment

    private func enrichWithCommunicationNotification(_ content: UNMutableNotificationContent, completion: @escaping (UNNotificationContent) -> Void) {
        // Extract custom data from the notification payload
        // OneSignal puts custom data under the "custom" key -> "a" key, or directly in userInfo
        let customData = extractCustomData(from: content.userInfo)

        guard let notificationType = customData["notificationType"] as? String else {
            // No structured data — deliver as-is (legacy notification)
            completion(content)
            return
        }

        let actorName = customData["actorName"] as? String
        let groupName = customData["groupName"] as? String

        // Determine which image to show and download it
        let imageUrl: String?
        if notificationType == "dm" {
            // DM: show the user's avatar
            imageUrl = customData["imageUrl"] as? String
        } else if notificationType == "group" {
            // Group: show the group's avatar, fall back to actor avatar
            imageUrl = (customData["groupImageUrl"] as? String) ?? (customData["imageUrl"] as? String)
        } else {
            imageUrl = customData["imageUrl"] as? String
        }

        // Set structured title / subtitle / body on the content
        if let title = actorName, !title.isEmpty {
            content.title = title
        }
        if notificationType == "group", let subtitle = groupName, !subtitle.isEmpty {
            content.subtitle = subtitle
        }
        // body (content.body) is already set by OneSignal from the `contents` field

        // Download the avatar and create a Communication Notification
        downloadImage(from: imageUrl) { avatarImage in
            self.createCommunicationNotification(
                content: content,
                senderName: actorName ?? "Someone",
                senderImage: avatarImage,
                isGroup: notificationType == "group",
                groupName: groupName,
                completion: completion
            )
        }
    }

    private func extractCustomData(from userInfo: [AnyHashable: Any]) -> [String: Any] {
        // OneSignal structures the payload as:
        // userInfo["custom"]["a"] = { our custom data }
        // or sometimes the data is at the top level of userInfo
        if let custom = userInfo["custom"] as? [String: Any],
           let additionalData = custom["a"] as? [String: Any] {
            return additionalData
        }

        // Fall back: check if our keys are directly in userInfo
        var result: [String: Any] = [:]
        for key in ["notificationType", "actorName", "groupName", "imageUrl", "groupImageUrl"] {
            if let value = userInfo[key] {
                result[key] = value
            }
        }
        return result
    }

    private func createCommunicationNotification(
        content: UNMutableNotificationContent,
        senderName: String,
        senderImage: INImage?,
        isGroup: Bool,
        groupName: String?,
        completion: @escaping (UNNotificationContent) -> Void
    ) {
        // Create the sender as an INPerson
        let senderHandle = INPersonHandle(value: senderName, type: .unknown)
        let sender = INPerson(
            personHandle: senderHandle,
            nameComponents: nil,
            displayName: senderName,
            image: senderImage,
            contactIdentifier: nil,
            customIdentifier: senderName
        )

        // Create the message intent
        let intent = INSendMessageIntent(
            recipients: nil,
            outgoingMessageType: .outgoingMessageText,
            content: content.body,
            speakableGroupName: isGroup ? INSpeakableString(spokenPhrase: groupName ?? "") : nil,
            conversationIdentifier: isGroup ? (groupName ?? "group") : senderName,
            serviceName: nil,
            sender: sender,
            attachments: nil
        )

        // If this is a group notification, set the group avatar
        if isGroup, let groupImage = senderImage {
            intent.setImage(groupImage, forParameterNamed: \.speakableGroupName)
        }

        // Create an interaction to donate to the system (improves Siri suggestions)
        let interaction = INInteraction(intent: intent, response: nil)
        interaction.direction = .incoming
        interaction.donate(completion: nil)

        // Update the notification content with the intent
        do {
            let updatedContent = try content.updating(from: intent)
            completion(updatedContent)
        } catch {
            // If updating fails, deliver the original content
            print("Failed to update notification with intent: \(error)")
            completion(content)
        }
    }

    // MARK: - Image Downloading

    private func downloadImage(from urlString: String?, completion: @escaping (INImage?) -> Void) {
        guard let urlString = urlString, let url = URL(string: urlString) else {
            completion(nil)
            return
        }

        let task = URLSession.shared.dataTask(with: url) { data, response, error in
            guard let data = data, error == nil else {
                completion(nil)
                return
            }
            let image = INImage(imageData: data)
            completion(image)
        }
        task.resume()
    }
}
