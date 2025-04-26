/**
 * @file metrics.h
 * @brief Performance metrics collection and reporting
 * 
 * This file contains the implementation for collecting and reporting
 * performance metrics for the trading system.
 */

#pragma once

#include <string>
#include <vector>
#include <map>
#include <chrono>
#include <mutex>
#include <deque>
#include <atomic>
#include <memory>

namespace deribit {
namespace utils {

/**
 * @struct LatencyMetric
 * @brief Structure for storing latency metrics
 */
struct LatencyMetric {
    double min;
    double max;
    double avg;
    double p50;
    double p90;
    double p99;
    size_t count;
    
    LatencyMetric() : min(0), max(0), avg(0), p50(0), p90(0), p99(0), count(0) {}
};

/**
 * @class Metrics
 * @brief Class for collecting and reporting performance metrics
 */
class Metrics {
public:
    /**
     * @brief Get the instance (singleton)
     * @return Reference to Metrics instance
     */
    static Metrics& getInstance();
    
    /**
     * @brief Initialize the metrics collection
     * @param maxSamples Maximum number of samples to keep (default: 1000)
     */
    void initialize(size_t maxSamples = 1000);
    
    /**
     * @brief Start a latency measurement
     * @param category Category name
     * @param operation Operation name
     * @return Unique identifier for the measurement
     */
    uint64_t startMeasurement(const std::string& category, const std::string& operation);
    
    /**
     * @brief End a latency measurement
     * @param id Measurement ID
     */
    void endMeasurement(uint64_t id);
    
    /**
     * @brief Record a latency value directly
     * @param category Category name
     * @param operation Operation name
     * @param latencyMs Latency in milliseconds
     */
    void recordLatency(
        const std::string& category,
        const std::string& operation,
        double latencyMs
    );
    
    /**
     * @brief Record a market data update
     * @param instrument Instrument name
     */
    void recordMarketDataUpdate(const std::string& instrument);
    
    /**
     * @brief Record an order placement
     * @param instrument Instrument name
     * @param latencyMs Latency in milliseconds
     */
    void recordOrderPlacement(const std::string& instrument, double latencyMs);
    
    /**
     * @brief Record an order cancellation
     * @param instrument Instrument name
     * @param latencyMs Latency in milliseconds
     */
    void recordOrderCancellation(const std::string& instrument, double latencyMs);
    
    /**
     * @brief Record an order modification
     * @param instrument Instrument name
     * @param latencyMs Latency in milliseconds
     */
    void recordOrderModification(const std::string& instrument, double latencyMs);
    
    /**
     * @brief Get latency metrics for a category and operation
     * @param category Category name
     * @param operation Operation name
     * @return LatencyMetric structure
     */
    LatencyMetric getLatencyMetrics(
        const std::string& category,
        const std::string& operation
    );
    
    /**
     * @brief Update metrics (called periodically)
     */
    void update();
    
    /**
     * @brief Generate a metrics report
     * @param filename Output filename
     * @return true if successful, false otherwise
     */
    bool generateReport(const std::string& filename);
    
    /**
     * @brief Reset all metrics
     */
    void reset();

private:
    // Private constructor for singleton
    Metrics();
    
    // Prevent copying and assignment
    Metrics(const Metrics&) = delete;
    Metrics& operator=(const Metrics&) = delete;
    
    /**
     * @struct MeasurementEntry
     * @brief Structure for an active measurement
     */
    struct MeasurementEntry {
        std::string category;
        std::string operation;
        std::chrono::high_resolution_clock::time_point startTime;
    };
    
    /**
     * @struct LatencySample
     * @brief Structure for a latency sample
     */
    struct LatencySample {
        double latencyMs;
        std::chrono::system_clock::time_point timestamp;
    };
    
    /**
     * @struct MetricKey
     * @brief Structure for a metric key
     */
    struct MetricKey {
        std::string category;
        std::string operation;
        
        bool operator<(const MetricKey& other) const {
            if (category != other.category) {
                return category < other.category;
            }
            return operation < other.operation;
        }
    };
    
    std::map<uint64_t, MeasurementEntry> m_activeMeasurements;
    std::map<MetricKey, std::deque<LatencySample>> m_latencySamples;
    std::map<std::string, size_t> m_marketDataUpdates;
    size_t m_maxSamples;
    std::atomic<uint64_t> m_nextMeasurementId{1};
    std::mutex m_mutex;
    
    std::map<std::string, std::map<std::string, size_t>> m_operationCounts;
    std::chrono::system_clock::time_point m_lastUpdateTime;
    
    /**
     * @brief Calculate metrics from samples
     * @param samples Vector of latency samples
     * @return LatencyMetric structure
     */
    LatencyMetric calculateMetrics(const std::vector<double>& samples);
};

/**
 * @class ScopedLatencyMeasurement
 * @brief RAII class for measuring latency of a scope
 */
class ScopedLatencyMeasurement {
public:
    /**
     * @brief Constructor
     * @param category Category name
     * @param operation Operation name
     */
    ScopedLatencyMeasurement(const std::string& category, const std::string& operation)
        : m_id(Metrics::getInstance().startMeasurement(category, operation)) {}
    
    /**
     * @brief Destructor
     */
    ~ScopedLatencyMeasurement() {
        Metrics::getInstance().endMeasurement(m_id);
    }

private:
    uint64_t m_id;
};

// Convenience macro for scoped latency measurement
#define MEASURE_LATENCY(category, operation) \
    deribit::utils::ScopedLatencyMeasurement _latency_measurement(category, operation)

} // namespace utils
} // namespace deribit