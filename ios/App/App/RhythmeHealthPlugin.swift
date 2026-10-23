import Foundation
import Capacitor
import HealthKit

/// Read-only HealthKit access for Rhythme (ovu-healthnative.js on the web side).
///
/// Read only, and only these: sleep analysis, menstrual flow, intermenstrual bleeding, steps, workouts,
/// resting heart rate, sleeping wrist temperature (iOS 16 and later) and basal body temperature. It never asks
/// to write. Samples go back shaped like the <Record> and <Workout> attributes of an Apple Health export (type
/// identifier, start and end with the wall-clock offset the phone used, the value as a string, its unit), so the
/// web side parses them with the same code it uses for export.xml. Steps come back as Apple's own daily totals
/// (a statistics query), which already count a phone and a watch walking the same minutes once.
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
    /// quantity types, with the unit each value is sent in
    private static func quantity(_ name: String) -> (HKQuantityType, HKUnit, String)? {
        switch name {
        case "steps": return HKObjectType.quantityType(forIdentifier: .stepCount).map { ($0, HKUnit.count(), "count") }
        case "restingHeartRate": return HKObjectType.quantityType(forIdentifier: .restingHeartRate).map { ($0, HKUnit.count().unitDivided(by: .minute()), "count/min") }
        case "basalTemperature": return HKObjectType.quantityType(forIdentifier: .basalBodyTemperature).map { ($0, HKUnit.degreeCelsius(), "degC") }
        case "wristTemperature":
            if #available(iOS 16.0, *) { return HKObjectType.quantityType(forIdentifier: .appleSleepingWristTemperature).map { ($0, HKUnit.degreeCelsius(), "degC") } }
            return nil
        default: return nil
        }
    }
    private static func objectType(_ name: String) -> HKObjectType? {
        if name == "workouts" { return HKObjectType.workoutType() }
        if let q = quantity(name) { return q.0 }
        return categoryType(name)
    }
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
        /* a name this iOS cannot read (wrist temperature before iOS 16) is left out rather than refusing the rest */
        let known = Set(Self.readable.keys).union(["steps", "workouts", "restingHeartRate", "wristTemperature", "basalTemperature"])
        guard names.allSatisfy({ known.contains($0) }) else {
            call.reject("Unknown or empty health types", "BAD_TYPES")
            return
        }
        let types = names.compactMap { Self.objectType($0) }
        guard !types.isEmpty else {
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
        guard let fromMs = call.getDouble("from"), let toMs = call.getDouble("to"), toMs > fromMs,
              toMs - fromMs <= Self.maxDays * 86_400_000 else {
            call.reject("The date window must be under a year", "BAD_WINDOW")
            return
        }
        let start = Date(timeIntervalSince1970: fromMs / 1000)
        let end = Date(timeIntervalSince1970: toMs / 1000)
        let name = call.getString("type") ?? ""
        if name == "wristTemperature", Self.quantity(name) == nil { call.resolve(["samples": []]); return } /* iOS 15: nothing to read */
        if name == "steps" { readDailySteps(call, start, end); return }
        if name == "workouts" { readWorkouts(call, start, end); return }
        if let q = Self.quantity(name) { readQuantity(call, q, start, end); return }
        guard let type = Self.categoryType(name) else {
            call.reject("Unknown health type", "BAD_TYPES")
            return
        }
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

    /// One total per calendar day, from midnight on this phone: Apple's statistics merge overlapping devices.
    private func readDailySteps(_ call: CAPPluginCall, _ start: Date, _ end: Date) {
        guard let type = HKObjectType.quantityType(forIdentifier: .stepCount) else { call.resolve(["samples": []]); return }
        let cal = Calendar.current
        let anchor = cal.startOfDay(for: start)
        let predicate = HKQuery.predicateForSamples(withStart: anchor, end: end, options: [])
        let query = HKStatisticsCollectionQuery(quantityType: type, quantitySamplePredicate: predicate, options: .cumulativeSum, anchorDate: anchor, intervalComponents: DateComponents(day: 1))
        query.initialResultsHandler = { _, results, error in
            if let error = error { call.reject(error.localizedDescription, "READ_FAILED"); return }
            var rows: [[String: Any]] = []
            results?.enumerateStatistics(from: anchor, to: end) { stats, _ in
                guard let sum = stats.sumQuantity() else { return }
                let n = sum.doubleValue(for: HKUnit.count())
                if n <= 0 { return }
                rows.append([
                    "type": type.identifier,
                    "startDate": Self.stamp(stats.startDate, TimeZone.current),
                    "endDate": Self.stamp(stats.endDate, TimeZone.current),
                    "value": String(Int(n.rounded())),
                    "unit": "count",
                    "sourceName": "Health daily total"
                ])
            }
            call.resolve(["samples": rows])
        }
        store.execute(query)
    }

    private func readQuantity(_ call: CAPPluginCall, _ q: (HKQuantityType, HKUnit, String), _ start: Date, _ end: Date) {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
        let query = HKSampleQuery(sampleType: q.0, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [sort]) { _, samples, error in
            if let error = error { call.reject(error.localizedDescription, "READ_FAILED"); return }
            let rows: [[String: Any]] = (samples as? [HKQuantitySample] ?? []).map { sample in
                let zone = (sample.metadata?[HKMetadataKeyTimeZone] as? String).flatMap { TimeZone(identifier: $0) } ?? TimeZone.current
                return [
                    "type": q.0.identifier,
                    "startDate": Self.stamp(sample.startDate, zone),
                    "endDate": Self.stamp(sample.endDate, zone),
                    "value": String(sample.quantity.doubleValue(for: q.1)),
                    "unit": q.2,
                    "sourceName": sample.sourceRevision.source.name
                ]
            }
            call.resolve(["samples": rows])
        }
        store.execute(query)
    }

    private func readWorkouts(_ call: CAPPluginCall, _ start: Date, _ end: Date) {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
        let query = HKSampleQuery(sampleType: HKObjectType.workoutType(), predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [sort]) { _, samples, error in
            if let error = error { call.reject(error.localizedDescription, "READ_FAILED"); return }
            let rows: [[String: Any]] = (samples as? [HKWorkout] ?? []).map { w in
                let zone = (w.metadata?[HKMetadataKeyTimeZone] as? String).flatMap { TimeZone(identifier: $0) } ?? TimeZone.current
                var row: [String: Any] = [
                    "type": "HKWorkout",
                    "workoutActivityType": "HKWorkoutActivityType" + Self.workoutName(w.workoutActivityType),
                    "startDate": Self.stamp(w.startDate, zone),
                    "endDate": Self.stamp(w.endDate, zone),
                    "duration": w.duration / 60
                ]
                if let km = Self.distanceKm(w) { row["distanceKm"] = km }
                return row
            }
            call.resolve(["samples": rows])
        }
        store.execute(query)
    }

    private static func distanceKm(_ w: HKWorkout) -> Double? {
        let km = HKUnit.meterUnit(with: .kilo)
        if #available(iOS 16.0, *) {
            for id in [HKQuantityTypeIdentifier.distanceWalkingRunning, .distanceCycling, .distanceSwimming] {
                if let t = HKObjectType.quantityType(forIdentifier: id), let q = w.statistics(for: t)?.sumQuantity() { return q.doubleValue(for: km) }
            }
            return nil
        }
        return w.totalDistance?.doubleValue(for: km)
    }

    /// The export's names for the activities Rhythme has a Movement activity for; anything else is sent as Other
    /// with its number, so the web side lists it and never guesses.
    private static func workoutName(_ t: HKWorkoutActivityType) -> String {
        switch t {
        case .walking: return "Walking"
        case .running: return "Running"
        case .cycling: return "Cycling"
        case .swimming: return "Swimming"
        case .yoga: return "Yoga"
        case .pilates: return "Pilates"
        case .traditionalStrengthTraining: return "TraditionalStrengthTraining"
        case .functionalStrengthTraining: return "FunctionalStrengthTraining"
        case .highIntensityIntervalTraining: return "HighIntensityIntervalTraining"
        case .crossTraining: return "CrossTraining"
        case .socialDance: return "SocialDance"
        case .cardioDance: return "CardioDance"
        case .hiking: return "Hiking"
        case .stairClimbing: return "StairClimbing"
        case .stairs: return "Stairs"
        case .elliptical: return "Elliptical"
        case .rowing: return "Rowing"
        case .tennis: return "Tennis"
        case .badminton: return "Badminton"
        case .tableTennis: return "TableTennis"
        case .basketball: return "Basketball"
        case .soccer: return "Soccer"
        case .taiChi: return "TaiChi"
        case .flexibility: return "Flexibility"
        default: return "Other" + String(t.rawValue)
        }
    }

    /// "2026-03-01T23:15:00+08:00": the clock time the phone showed, with its offset.
    private static func stamp(_ date: Date, _ zone: TimeZone) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.timeZone = zone
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: date)
    }
}
