package app.vercel.ovuluna.dev

import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.IntermenstrualBleedingRecord
import androidx.health.connect.client.records.MenstruationFlowRecord
import androidx.health.connect.client.records.MenstruationPeriodRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import kotlin.reflect.KClass
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Read-only Health Connect access for Rhythme (ovu-healthnative.js on the web side), answering to the
 * same name as the iOS plugin. Three kinds and nothing else: sleep sessions, menstruation (flow and
 * period records, one permission) and intermenstrual bleeding. It never asks to write.
 *
 * Records go back as Health Connect describes them, with times as ISO 8601 carrying the offset the
 * phone recorded; the web side maps them onto the records it already reads from Apple Health exports.
 * Unlike HealthKit, Health Connect does say which permissions were granted, so that is passed back.
 */
@CapacitorPlugin(name = "RhythmeHealth")
class RhythmeHealthPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val types: Map<String, List<KClass<out Record>>> = mapOf(
        "sleep" to listOf(SleepSessionRecord::class),
        "menstrualFlow" to listOf(MenstruationFlowRecord::class, MenstruationPeriodRecord::class),
        "intermenstrualBleeding" to listOf(IntermenstrualBleedingRecord::class)
    )
    private val maxDays = 366L

    private fun permissionFor(name: String): String? = types[name]?.first()?.let { HealthPermission.getReadPermission(it) }

    private fun client(): HealthConnectClient? =
        if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE) HealthConnectClient.getOrCreate(context) else null

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val status = HealthConnectClient.getSdkStatus(context)
        val ret = JSObject()
        ret.put("available", status == HealthConnectClient.SDK_AVAILABLE)
        ret.put("reason", when (status) {
            HealthConnectClient.SDK_AVAILABLE -> "available"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update-required"
            else -> "not-installed"
        })
        call.resolve(ret)
    }

    @PluginMethod
    fun requestAuthorization(call: PluginCall) {
        val hc = client() ?: return call.reject("Health Connect is not available on this device", "UNAVAILABLE")
        val names = call.getArray("types")?.toList<String>() ?: emptyList()
        val perms = names.mapNotNull { permissionFor(it) }
        if (perms.isEmpty() || perms.size != names.size) return call.reject("Unknown or empty health types", "BAD_TYPES")
        scope.launch {
            try {
                val wanted = perms.toMutableSet()
                if (hc.features.getFeatureStatus(HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_HISTORY) == HealthConnectFeatures.FEATURE_STATUS_AVAILABLE) {
                    wanted.add(HealthPermission.PERMISSION_READ_HEALTH_DATA_HISTORY)
                }
                val already = hc.permissionController.getGrantedPermissions()
                if (already.containsAll(wanted)) {
                    call.resolve(grantedResult(names, already))
                    return@launch
                }
                val intent = PermissionController.createRequestPermissionResultContract().createIntent(context, wanted)
                startActivityForResult(call, intent, "permissionsResult")
            } catch (e: Exception) {
                call.reject(e.message ?: "Health Connect did not answer", "AUTH_FAILED")
            }
        }
    }

    @ActivityCallback
    fun permissionsResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val names = call.getArray("types")?.toList<String>() ?: emptyList()
        val hc = client() ?: return call.reject("Health Connect is not available on this device", "UNAVAILABLE")
        scope.launch {
            try {
                call.resolve(grantedResult(names, hc.permissionController.getGrantedPermissions()))
            } catch (e: Exception) {
                call.reject(e.message ?: "Health Connect did not answer", "AUTH_FAILED")
            }
        }
    }

    private fun grantedResult(names: List<String>, granted: Set<String>): JSObject {
        val ret = JSObject()
        ret.put("requested", true)
        ret.put("granted", JSArray(names.filter { permissionFor(it) in granted }))
        ret.put("history", HealthPermission.PERMISSION_READ_HEALTH_DATA_HISTORY in granted)
        return ret
    }

    @PluginMethod
    fun readSamples(call: PluginCall) {
        val hc = client() ?: return call.reject("Health Connect is not available on this device", "UNAVAILABLE")
        val name = call.getString("type") ?: ""
        val classes = types[name] ?: return call.reject("Unknown health type", "BAD_TYPES")
        val from = call.getDouble("from"); val to = call.getDouble("to")
        if (from == null || to == null || to <= from || to - from > maxDays * 86_400_000.0) return call.reject("The date window must be under a year", "BAD_WINDOW")
        val range = TimeRangeFilter.between(Instant.ofEpochMilli(from.toLong()), Instant.ofEpochMilli(to.toLong()))
        scope.launch {
            try {
                val out = JSArray()
                for (cls in classes) {
                    var token: String? = null
                    do {
                        val page = hc.readRecords(ReadRecordsRequest(recordType = cls, timeRangeFilter = range, pageToken = token))
                        page.records.forEach { out.put(describe(it)) }
                        token = page.pageToken
                    } while (!token.isNullOrEmpty())
                }
                val ret = JSObject(); ret.put("records", out); call.resolve(ret)
            } catch (e: SecurityException) {
                call.reject("Reading this was not allowed in Health Connect", "NOT_ALLOWED")
            } catch (e: Exception) {
                call.reject(e.message ?: "Health Connect did not answer", "READ_FAILED")
            }
        }
    }

    private fun describe(r: Record): JSObject {
        val o = JSObject()
        when (r) {
            is SleepSessionRecord -> {
                o.put("record", "SleepSession")
                o.put("start", stamp(r.startTime, r.startZoneOffset)); o.put("end", stamp(r.endTime, r.endZoneOffset))
                val stages = JSArray()
                r.stages.forEach { s ->
                    val so = JSObject()
                    so.put("start", stamp(s.startTime, r.startZoneOffset)); so.put("end", stamp(s.endTime, r.endZoneOffset)); so.put("stage", s.stage)
                    stages.put(so)
                }
                o.put("stages", stages)
            }
            is MenstruationFlowRecord -> { o.put("record", "MenstruationFlow"); o.put("time", stamp(r.time, r.zoneOffset)); o.put("flow", r.flow) }
            is MenstruationPeriodRecord -> { o.put("record", "MenstruationPeriod"); o.put("start", stamp(r.startTime, r.startZoneOffset)); o.put("end", stamp(r.endTime, r.endZoneOffset)) }
            is IntermenstrualBleedingRecord -> { o.put("record", "IntermenstrualBleeding"); o.put("time", stamp(r.time, r.zoneOffset)) }
        }
        o.put("app", r.metadata.dataOrigin.packageName)
        return o
    }

    /** "2026-03-01T23:15:00+08:00": the clock time the phone showed, with its offset. */
    private fun stamp(t: Instant, offset: ZoneOffset?): String =
        OffsetDateTime.ofInstant(t, offset ?: ZoneId.systemDefault().rules.getOffset(t))
            .truncatedTo(ChronoUnit.SECONDS).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)

    override fun handleOnDestroy() {
        scope.cancel()
        super.handleOnDestroy()
    }
}
