/**
 * @file order.h
 * @brief Order management system
 * 
 * This file contains the data structures and classes for order management.
 */

#pragma once

#include <string>
#include <vector>
#include <map>
#include <memory>
#include <chrono>
#include <atomic>
#include <mutex>
#include <functional>

namespace deribit {
namespace order {

// Forward declarations
class OrderManager;

/**
 * @enum OrderType
 * @brief Enum representing order types
 */
enum class OrderType {
    LIMIT,
    MARKET,
    STOP_LIMIT,
    STOP_MARKET
};

/**
 * @enum OrderSide
 * @brief Enum representing order sides
 */
enum class OrderSide {
    BUY,
    SELL
};

/**
 * @enum OrderStatus
 * @brief Enum representing order statuses
 */
enum class OrderStatus {
    PENDING,
    OPEN,
    FILLED,
    PARTIALLY_FILLED,
    CANCELED,
    REJECTED,
    EXPIRED
};

/**
 * @struct OrderParams
 * @brief Structure for order parameters
 */
struct OrderParams {
    std::string instrument;
    OrderType type;
    OrderSide side;
    double price;
    double amount;
    double stopPrice;
    bool reduceOnly;
    bool postOnly;
    std::string label;
    
    OrderParams() : 
        type(OrderType::LIMIT),
        side(OrderSide::BUY),
        price(0.0),
        amount(0.0),
        stopPrice(0.0),
        reduceOnly(false),
        postOnly(false) {}
};

/**
 * @class Order
 * @brief Class representing an order
 */
class Order {
public:
    /**
     * @brief Constructor
     * @param id Order ID
     * @param params Order parameters
     */
    Order(const std::string& id, const OrderParams& params);
    
    /**
     * @brief Get the order ID
     * @return Order ID
     */
    const std::string& getId() const { return m_id; }
    
    /**
     * @brief Get the instrument
     * @return Instrument name
     */
    const std::string& getInstrument() const { return m_instrument; }
    
    /**
     * @brief Get the order type
     * @return Order type
     */
    OrderType getType() const { return m_type; }
    
    /**
     * @brief Get the order side
     * @return Order side
     */
    OrderSide getSide() const { return m_side; }
    
    /**
     * @brief Get the order price
     * @return Order price
     */
    double getPrice() const { return m_price; }
    
    /**
     * @brief Get the order amount
     * @return Order amount
     */
    double getAmount() const { return m_amount; }
    
    /**
     * @brief Get the filled amount
     * @return Filled amount
     */
    double getFilledAmount() const { return m_filledAmount; }
    
    /**
     * @brief Get the remaining amount
     * @return Remaining amount
     */
    double getRemainingAmount() const { return m_amount - m_filledAmount; }
    
    /**
     * @brief Get the stop price
     * @return Stop price
     */
    double getStopPrice() const { return m_stopPrice; }
    
    /**
     * @brief Check if the order is reduce-only
     * @return true if reduce-only, false otherwise
     */
    bool isReduceOnly() const { return m_reduceOnly; }
    
    /**
     * @brief Check if the order is post-only
     * @return true if post-only, false otherwise
     */
    bool isPostOnly() const { return m_postOnly; }
    
    /**
     * @brief Get the order status
     * @return Order status
     */
    OrderStatus getStatus() const { return m_status; }
    
    /**
     * @brief Get the order label
     * @return Order label
     */
    const std::string& getLabel() const { return m_label; }
    
    /**
     * @brief Get the creation time
     * @return Creation time
     */
    std::chrono::system_clock::time_point getCreatedAt() const { return m_createdAt; }
    
    /**
     * @brief Get the last update time
     * @return Last update time
     */
    std::chrono::system_clock::time_point getUpdatedAt() const { return m_updatedAt; }
    
    /**
     * @brief Update the order status
     * @param status New status
     */
    void setStatus(OrderStatus status);
    
    /**
     * @brief Update the order price
     * @param price New price
     */
    void setPrice(double price);
    
    /**
     * @brief Update the order amount
     * @param amount New amount
     */
    void setAmount(double amount);
    
    /**
     * @brief Update the filled amount
     * @param filledAmount New filled amount
     */
    void setFilledAmount(double filledAmount);
    
    /**
     * @brief Convert to string representation
     * @return String representation
     */
    std::string toString() const;

private:
    friend class OrderManager;
    
    std::string m_id;
    std::string m_instrument;
    OrderType m_type;
    OrderSide m_side;
    double m_price;
    double m_amount;
    double m_filledAmount;
    double m_stopPrice;
    bool m_reduceOnly;
    bool m_postOnly;
    OrderStatus m_status;
    std::string m_label;
    std::chrono::system_clock::time_point m_createdAt;
    std::chrono::system_clock::time_point m_updatedAt;
    std::mutex m_mutex;
};

/**
 * @class OrderManager
 * @brief Class for managing orders
 */
class OrderManager {
public:
    /**
     * @brief Get the instance (singleton)
     * @return Reference to OrderManager instance
     */
    static OrderManager& getInstance();
    
    /**
     * @brief Create a new order
     * @param params Order parameters
     * @return Shared pointer to Order object
     */
    std::shared_ptr<Order> createOrder(const OrderParams& params);
    
    /**
     * @brief Cancel an order
     * @param orderId Order ID
     * @return true if successful, false otherwise
     */
    bool cancelOrder(const std::string& orderId);
    
    /**
     * @brief Modify an order
     * @param orderId Order ID
     * @param price New price (0 to keep current)
     * @param amount New amount (0 to keep current)
     * @return Shared pointer to modified Order object
     */
    std::shared_ptr<Order> modifyOrder(
        const std::string& orderId,
        double price = 0,
        double amount = 0
    );
    
    /**
     * @brief Get an order by ID
     * @param orderId Order ID
     * @return Shared pointer to Order object, or nullptr if not found
     */
    std::shared_ptr<Order> getOrder(const std::string& orderId);
    
    /**
     * @brief Get all active orders
     * @return Map of order ID to Order object
     */
    std::map<std::string, std::shared_ptr<Order>> getActiveOrders();
    
    /**
     * @brief Get orders for an instrument
     * @param instrument Instrument name
     * @return Vector of Order objects
     */
    std::vector<std::shared_ptr<Order>> getOrdersForInstrument(const std::string& instrument);
    
    /**
     * @brief Set callback for order creation
     * @param callback Callback function
     */
    void setOnOrderCreated(std::function<void(const std::shared_ptr<Order>&)> callback) {
        m_onOrderCreated = callback;
    }
    
    /**
     * @brief Set callback for order modification
     * @param callback Callback function
     */
    void setOnOrderModified(std::function<void(const std::shared_ptr<Order>&)> callback) {
        m_onOrderModified = callback;
    }
    
    /**
     * @brief Set callback for order cancellation
     * @param callback Callback function
     */
    void setOnOrderCanceled(std::function<void(const std::shared_ptr<Order>&)> callback) {
        m_onOrderCanceled = callback;
    }
    
    /**
     * @brief Set callback for order status change
     * @param callback Callback function
     */
    void setOnOrderStatusChanged(
        std::function<void(const std::shared_ptr<Order>&, OrderStatus, OrderStatus)> callback
    ) {
        m_onOrderStatusChanged = callback;
    }

private:
    // Private constructor for singleton
    OrderManager();
    
    // Prevent copying and assignment
    OrderManager(const OrderManager&) = delete;
    OrderManager& operator=(const OrderManager&) = delete;
    
    std::map<std::string, std::shared_ptr<Order>> m_orders;
    std::mutex m_ordersMutex;
    std::atomic<int> m_orderCounter{1};
    
    std::function<void(const std::shared_ptr<Order>&)> m_onOrderCreated;
    std::function<void(const std::shared_ptr<Order>&)> m_onOrderModified;
    std::function<void(const std::shared_ptr<Order>&)> m_onOrderCanceled;
    std::function<void(const std::shared_ptr<Order>&, OrderStatus, OrderStatus)> m_onOrderStatusChanged;
    
    /**
     * @brief Generate a unique order ID
     * @return Unique order ID
     */
    std::string generateOrderId();
};

} // namespace order
} // namespace deribit