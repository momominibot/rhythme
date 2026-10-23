import Foundation
import Capacitor
import HealthKit

/// Read-only HealthKit access for Rhythme (ovu-healthnative.js on the web side).
///
/// Three category types and nothing else: sleep analysis, menstrual flow and intermenstrual bleeding.
/// It never asks to write. Samples go back raw, shaped like the <Record> attributes of an Apple Health
/// export (type identifier, start and end with the wall-clock offset the phone used, the raw category
/// value as a string), so the web side parses them with the same code it uses for export.xml.
///
/// HealthKit never tells an app whether reading was allowed; a refused type simply returns no samples.
/// `requestAuthorization` therefore only reports that Apple's sheet was handled.
@objc(RhythmeHealthPlugin)
public class RhythmeHealthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RhythmeHealthPlugin"
    public let jsName = "RhythmeHealth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readSamples", returnType: CAPPluginReturnPromise)
    ]

    private let store = HKHealthStore()
    private static let readable: [String: HKCategoryTypeIdentifier] = [
        "sleep": .sleepAnalysis,
        "menstrualFlow": .menstrualFlow,
        "intermenstrualBleeding": .intermenstrualBleeding
    ]
    /// The longest window one call may ask for, in days.
    private static let maxDays = 366.0

    private static func categoryType(_ name: String) -> HKCategoryType? {
        guard let id = readable[name] else { return nil }
        return HKObjectType.categoryType(forIdentifier: id)
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("Health data is not available on this device", "UNAVAILABLE")
            return
        }
        let names = call.getArray("types", String.self) ?? []
        let types = names.compactMap { Self.categoryType($0) }
        guard !types.isEmpty, types.count == names.count else {
            call.reject("Unknown or empty health types", "BAD_TYPES")
            return
        }
        store.requestAuthorization(toShare: nil, read: Set(types)) { done, error in
            if let error = error {
                call.reject(error.localizedDescription, "AUTH_FAILED")
                return
            }
            call.resolve(["requested": done])
        }
    }

    @objc func readSamples(_ call: CAPPluginCall) {
        guard let name = call.getString("type"), let type = Self.categoryType(name) else {
            call.reject("Unknown health type", "BAD_TYPES")
            return
        }
        guard let fromMs = call.getDouble("from"), let toMs = call.getDouble("to"), toMs > fromMs,
              toMs - fromMs <= Self.maxDays * 86_400_000 else {
            call.reject("The date window must be under a year", "BAD_WINDOW")
            return
        }
        let start = Date(timeIntervalSince1970: fromMs / 1000)
        let end = Date(timeIntervalSince1970: toMs / 1000)
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
        let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [sort]) { _, samples, error in
            if let error = error {
                call.reject(error.localizedDescription, "READ_FAILED")
                return
            }
            let rows: [[String: Any]] = (samples as? [HKCategorySample] ?? []).map { sample in
                let zone = (sample.metadata?[HKMetadataKeyTimeZone] as? String).flatMap { TimeZone(identifier: $0) } ?? TimeZone.current
                return [
                    "type": type.identifier,
                    "startDate": Self.stamp(sample.startDate, zone),
                    "endDate": Self.stamp(sample.endDate, zone),
                    "value": String(sample.value)
                ]
            }
            call.resolve(["samples": rows])
        }
        store.execute(query)
    }

    /// "2026-03-01T23:15:00+08:00": the clock time the phone showed, with its offset.
    private static func stamp(_ date: Date, _ zone: TimeZone) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.timeZone = zone
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: date)
    }
}
