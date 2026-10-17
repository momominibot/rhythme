// ppg.js — Camera Finger PPG Engine for Ovumind
// Client-side signal processing: detrending, peak detection, BPM, HRV (RMSSD)
// No external dependencies, fully Vercel-compatible static client asset.

(function () {
  'use strict';

  // ============================================================
  // PPG Signal Processor
  // ============================================================
  class PPGProcessor {
    constructor(options = {}) {
      this.samplingRate = options.samplingRate || 30; // FPS
      this.minPeakInterval = options.minPeakInterval || 400; // ms (max 150 BPM)
      this.movingAverageWindow = options.movingAverageWindow || 15; // samples for detrending
      this.smoothingWindow = options.smoothingWindow || 5; // samples for smoothing
    }

    /**
     * Detrend signal using moving average baseline subtraction.
     * Removes slow drift from hand movement / variable finger pressure.
     */
    detrend(signal) {
      if (signal.length < this.movingAverageWindow) return signal.slice();
      
      const result = new Float64Array(signal.length);
      const halfWin = Math.floor(this.movingAverageWindow / 2);
      
      for (let i = 0; i < signal.length; i++) {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, i - halfWin); j <= Math.min(signal.length - 1, i + halfWin); j++) {
          sum += signal[j];
          count++;
        }
        result[i] = signal[i] - (sum / count);
      }
      return result;
    }

    /**
     * Smooth signal using moving average.
     */
    smooth(signal) {
      if (signal.length < this.smoothingWindow) return signal.slice();
      
      const result = new Float64Array(signal.length);
      const halfWin = Math.floor(this.smoothingWindow / 2);
      
      for (let i = 0; i < signal.length; i++) {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, i - halfWin); j <= Math.min(signal.length - 1, i + halfWin); j++) {
          sum += signal[j];
          count++;
        }
        result[i] = sum / count;
      }
      return result;
    }

    /**
     * Detect systolic peaks in the filtered signal.
     * Enforces minimum refractory period between peaks.
     * Returns array of peak indices.
     */
    detectPeaks(signal, timestamps) {
      if (signal.length < 10) return [];
      
      const peaks = [];
      const threshold = this.calculateAdaptiveThreshold(signal);
      
      for (let i = 2; i < signal.length - 2; i++) {
        // Local maximum check
        if (signal[i] > threshold &&
            signal[i] > signal[i - 1] &&
            signal[i] > signal[i - 2] &&
            signal[i] >= signal[i + 1] &&
            signal[i] >= signal[i + 2]) {
          
          // Refractory period check
          if (peaks.length > 0) {
            const lastPeakTime = timestamps[peaks[peaks.length - 1]];
            const currentTime = timestamps[i];
            if (currentTime - lastPeakTime < this.minPeakInterval) {
              // Replace if this peak is higher
              if (signal[i] > signal[peaks[peaks.length - 1]]) {
                peaks[peaks.length - 1] = i;
              }
              continue;
            }
          }
          peaks.push(i);
        }
      }
      return peaks;
    }

    /**
     * Calculate adaptive threshold as percentage of signal amplitude.
     */
    calculateAdaptiveThreshold(signal) {
      let max = -Infinity;
      let min = Infinity;
      for (let i = 0; i < signal.length; i++) {
        if (signal[i] > max) max = signal[i];
        if (signal[i] < min) min = signal[i];
      }
      const amplitude = max - min;
      return min + amplitude * 0.35; // 35% of amplitude above min
    }

    /**
     * Calculate BPM from detected peaks and timestamps.
     */
    calculateBPM(peaks, timestamps) {
      if (peaks.length < 2) return 0;
      
      const firstPeakTime = timestamps[peaks[0]];
      const lastPeakTime = timestamps[peaks[peaks.length - 1]];
      const elapsedSeconds = (lastPeakTime - firstPeakTime) / 1000;
      
      if (elapsedSeconds <= 0) return 0;
      
      // BPM = (number of intervals / elapsed seconds) * 60
      const intervals = peaks.length - 1;
      return Math.round((intervals / elapsedSeconds) * 60);
    }

    /**
     * Calculate HRV using RMSSD (Root Mean Square of Successive Differences).
     * Returns value in milliseconds.
     */
    calculateHRV(peaks, timestamps) {
      if (peaks.length < 3) return 0;
      
      const intervals = [];
      for (let i = 1; i < peaks.length; i++) {
        const rrInterval = timestamps[peaks[i]] - timestamps[peaks[i - 1]];
        intervals.push(rrInterval);
      }
      
      if (intervals.length < 2) return 0;
      
      // Calculate successive differences
      let sumSquaredDiffs = 0;
      for (let i = 1; i < intervals.length; i++) {
        const diff = intervals[i] - intervals[i - 1];
        sumSquaredDiffs += diff * diff;
      }
      
      const meanSquaredDiff = sumSquaredDiffs / (intervals.length - 1);
      return Math.round(Math.sqrt(meanSquaredDiff));
    }

    /**
     * Full processing pipeline.
     * Input: array of { time: ms, value: redMean }
     * Output: { bpm, hrv, peaks, filteredSignal, quality }
     */
    process(rawData) {
      if (rawData.length < 30) {
        return { bpm: 0, hrv: 0, peaks: [], filteredSignal: [], quality: 'insufficient' };
      }

      const timestamps = rawData.map(d => d.time);
      const values = new Float64Array(rawData.map(d => d.value));

      // Signal processing pipeline
      const detrended = this.detrend(values);
      const smoothed = this.smooth(detrended);
      const peaks = this.detectPeaks(smoothed, timestamps);
      
      const bpm = this.calculateBPM(peaks, timestamps);
      const hrv = this.calculateHRV(peaks, timestamps);

      // Quality assessment
      let quality = 'good';
      if (peaks.length < 5) quality = 'poor';
      else if (bpm < 40 || bpm > 180) quality = 'unreliable';
      else if (hrv < 5 || hrv > 200) quality = 'uncertain';

      return {
        bpm,
        hrv,
        peaks,
        filteredSignal: Array.from(smoothed),
        quality,
        peakCount: peaks.length,
        duration: (timestamps[timestamps.length - 1] - timestamps[0]) / 1000
      };
    }
  }

  // ============================================================
  // Observation wording: no diagnosis, phase verification or treatment rules.
  // Passing these software gates does not establish clinical validity.
  // ============================================================
  class PulseObservationMapper {
    analyze(results) {
      const { bpm, hrv, quality } = results;
      if (quality !== 'good' || !Number.isFinite(bpm) || bpm <= 0 ||
          !Number.isFinite(hrv) || hrv < 0) {
        return {
          accepted: false,
          advice: ['This recording did not pass the signal checks. Rest, reposition your finger and try a new measurement. No pulse observation has been accepted.']
        };
      }
      return {
        accepted: true,
        bpm,
        hrv,
        advice: ['These are experimental camera pulse and pulse-rate variability observations. They do not confirm ovulation, assess ovarian reserve or diagnose stress.',
          'Pulse-rate variability from a camera is not interchangeable with ECG heart-rate variability. No fasting window or treatment has been changed.']
      };
    }
  }

  // ============================================================
  // Camera PPG Controller
  // ============================================================
  class CameraPPG {
    constructor(canvasElement, videoElement, options = {}) {
      this.canvas = canvasElement;
      this.ctx = canvasElement.getContext('2d', { willReadFrequently: true });
      this.video = videoElement;
      this.stream = null;
      this.track = null;
      this.torchSupported = false;
      this.isMeasuring = false;
      this.rawData = [];
      this.processor = new PPGProcessor(options);
      this.calibrationThreshold = options.calibrationThreshold || 180;
      this.sampleBoxSize = options.sampleBoxSize || 50;
      this.onFrame = options.onFrame || (() => {});
      this.onCalibrationChange = options.onCalibrationChange || (() => {});
      this._animationId = null;
      this._runId = 0;
      this._stopped = false;
      this._lastSampleTime = 0;
      this._sampleInterval = 1000 / 30; // 30 FPS target
    }

    /**
     * Initialize camera and request permissions.
     */
    async init() {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });

        this.video.srcObject = this.stream;
        await this.video.play();

        this.track = this.stream.getVideoTracks()[0];
        
        // Check torch support
        const capabilities = this.track.getCapabilities ? this.track.getCapabilities() : {};
        this.torchSupported = !!capabilities.torch;
        
        return { success: true, torchSupported: this.torchSupported };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    /**
     * Turn on torch/flash.
     */
    async enableTorch() {
      if (!this.torchSupported || !this.track) return false;
      try {
        await this.track.applyConstraints({
          advanced: [{ torch: true }]
        });
        return true;
      } catch (err) {
        return false;
      }
    }

    /**
     * Turn off torch/flash.
     */
    async disableTorch() {
      if (!this.torchSupported || !this.track) return false;
      try {
        await this.track.applyConstraints({
          advanced: [{ torch: false }]
        });
        return true;
      } catch (err) {
        return false;
      }
    }

    /**
     * Extract mean red channel value from center sample box.
     */
    extractRedMean() {
      const w = this.video.videoWidth;
      const h = this.video.videoHeight;
      if (!w || !h) return 0;

      const boxSize = Math.min(this.sampleBoxSize, Math.floor(Math.min(w, h) * 0.3));
      const x = Math.floor((w - boxSize) / 2);
      const y = Math.floor((h - boxSize) / 2);

      this.ctx.drawImage(this.video, 0, 0, w, h);
      const imageData = this.ctx.getImageData(x, y, boxSize, boxSize);
      const data = imageData.data;

      let redSum = 0;
      const pixelCount = boxSize * boxSize;
      for (let i = 0; i < data.length; i += 4) {
        redSum += data[i]; // Red channel
      }
      return redSum / pixelCount;
    }

    /**
     * Start calibration loop (checks finger placement).
     */
    startCalibration() {
      if (this._stopped || this.isMeasuring) return;
      if (this._animationId !== null) cancelAnimationFrame(this._animationId);
      const runId = ++this._runId;
      this.isMeasuring = false;
      this.rawData = [];
      let calibratedFrames = 0;
      const requiredFrames = 30; // ~1 second of stable placement

      const loop = () => {
        if (this._stopped || this.isMeasuring || runId !== this._runId) return;

        const now = performance.now();
        if (now - this._lastSampleTime >= this._sampleInterval) {
          const redMean = this.extractRedMean();
          const isCalibrated = redMean >= this.calibrationThreshold;
          
          if (isCalibrated) {
            calibratedFrames++;
          } else {
            calibratedFrames = 0;
          }
          
          const ready = calibratedFrames >= requiredFrames;
          this._lastSampleTime = now;
          this.onFrame(redMean, isCalibrated);
          // Emit ready once and finish calibration before the UI starts acquisition.
          if (ready) this._animationId = null;
          this.onCalibrationChange(isCalibrated, redMean, ready);
          if (ready) return;
        }
        
        this._animationId = requestAnimationFrame(loop);
      };
      loop();
    }

    /**
     * Start 30-second data acquisition.
     */
    startMeasurement(durationSeconds = 30, onProgress) {
      // A stale delayed UI callback must never reset an active recording.
      if (this._stopped || this.isMeasuring) return false;
      if (this._animationId !== null) cancelAnimationFrame(this._animationId);
      const runId = ++this._runId;
      this.isMeasuring = true;
      this.rawData = [];
      const startTime = performance.now();
      const endTime = startTime + (durationSeconds * 1000);

      const loop = () => {
        if (this._stopped || !this.isMeasuring || runId !== this._runId) return;
        
        const now = performance.now();
        const elapsed = now - startTime;
        
        if (now - this._lastSampleTime >= this._sampleInterval) {
          const redMean = this.extractRedMean();
          this.rawData.push({ time: now, value: redMean });
          this.onFrame(redMean, true);
          // The UI may discard/release an interrupted recording in onFrame.
          if (this._stopped || !this.isMeasuring || runId !== this._runId) return;
          this._lastSampleTime = now;
          
          if (onProgress) {
            onProgress(Math.min(100, (elapsed / (durationSeconds * 1000)) * 100), elapsed);
          }
        }
        
        if (now >= endTime) {
          this.stop();
          return;
        }
        
        this._animationId = requestAnimationFrame(loop);
      };
      loop();
      return true;
    }

    /**
     * Stop measurement and process results.
     */
    stop() {
      this._stopped = true;
      this._runId++;
      this.isMeasuring = false;
      if (this._animationId) {
        cancelAnimationFrame(this._animationId);
      }
      this.disableTorch();
      
      if (this.rawData.length > 0) {
        return this.processor.process(this.rawData);
      }
      return null;
    }

    /**
     * Release camera resources.
     */
    release() {
      this._stopped = true;
      this.isMeasuring = false;
      this._runId++;
      if (this._animationId) {
        cancelAnimationFrame(this._animationId);
      }
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }
      this.stream = null;
      this.track = null;
    }
  }

  // Export to global scope
  window.OvumindPPG = {
    PPGProcessor,
    PulseObservationMapper,
    CameraPPG
  };

})();
