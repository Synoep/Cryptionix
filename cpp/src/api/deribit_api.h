/**
 * @file deribit_api.h
 * @brief Deribit API client interface
 * 
 * This file contains the interface for the Deribit API client.
 * It provides methods for authentication, order management, and market data.
 */

#pragma once

#include <string>
#include <vector>
#include <map>
#include <functional>
#include <memory>
#include <chrono>
#include <atomic>
#include <mutex>
#include "../websocket/ws_client.h"

namespace deribit {
namespace api {

// Forward declarations
class WSClient;

/**
 * @struct Order
 * @brief Structure representing an order
 */
struct Order {
    std::string order_id;
    std::string instrument_name;
    std::string direction;  // "buy" or "sell"
    double price;
    double amount;
    std::string order_type;
    std::string order_state;
    std::chrono::system_clock::time_point created_at;
    std::chrono::system_clock::time_point last_updated_at;
};

/**
 * @struct Position
 * @brief Structure representing a position
 */
struct Position {
    std::string instrument_name;
    double size;
    double entry_price;
    double mark_price;
    double unrealized_pnl;
    double realized_pnl;
    double liquidation_price;
};

/**
 * @struct Orderbook
 * @brief Structure representing an orderbook
 */
struct Orderbook {
    std::string instrument_name;
    std::vector<std::pair<double, double>> bids;  // price, amount
    std::vector<std::pair<double, double>> asks;  // price, amount
    std::chrono::system_clock::time_point timestamp;
};

/**
 * @struct WSMessage
 * @brief Structure representing a WebSocket message
 */
struct WSMessage {
    std::string channel;
    std::string data;
    std::chrono::system_clock::time_point timestamp;
};

/**
 * @class DeribitAPI
 * @brief Deribit API client implementation
 */
class DeribitAPI {
public:
    /**
     * @brief Constructor
     * @param api_key API key
     * @param api_secret API secret
     * @param testnet Whether to use testnet (default: true)
     */
    DeribitAPI(const std::string& api_key, const std::string& api_secret, bool testnet = true);
    
    /**
     * @brief Destructor
     */
    ~DeribitAPI();
    
    /**
     * @brief Authenticate with the API
     * @return true if successful, false otherwise
     */
    bool authenticate();
    
    /**
     * @brief Place a new order
     * @param instrument_name Instrument name
     * @param direction "buy" or "sell"
     * @param amount Amount
     * @param price Price (optional for market orders)
     * @param type Order type (limit, market, etc.)
     * @return Order object if successful, throws exception otherwise
     */
    Order placeOrder(
        const std::string& instrument_name,
        const std::string& direction,
        double amount,
        double price = 0,
        const std::string& type = "limit"
    );
    
    /**
     * @brief Cancel an existing order
     * @param order_id Order ID
     * @return true if successful, false otherwise
     */
    bool cancelOrder(const std::string& order_id);
    
    /**
     * @brief Modify an existing order
     * @param order_id Order ID
     * @param amount New amount (optional)
     * @param price New price (optional)
     * @return Updated order if successful, throws exception otherwise
     */
    Order modifyOrder(
        const std::string& order_id,
        double amount = 0,
        double price = 0
    );
    
    /**
     * @brief Get the orderbook for an instrument
     * @param instrument_name Instrument name
     * @return Orderbook object
     */
    Orderbook getOrderbook(const std::string& instrument_name);
    
    /**
     * @brief Get current positions
     * @return Vector of positions
     */
    std::vector<Position> getPositions();
    
    /**
     * @brief Process any pending events
     */
    void processEvents();
    
    /**
     * @brief Get the WebSocket client
     * @return Shared pointer to WebSocket client
     */
    std::shared_ptr<websocket::WSClient> getWebSocketClient() const {
        return m_wsClient;
    }

private:
    std::string m_apiKey;
    std::string m_apiSecret;
    bool m_testnet;
    std::string m_accessToken;
    std::string m_refreshToken;
    std::chrono::system_clock::time_point m_tokenExpiry;
    std::shared_ptr<websocket::WSClient> m_wsClient;
    std::mutex m_apiMutex;
    
    /**
     * @brief Refresh the access token if necessary
     * @return true if successful, false otherwise
     */
    bool refreshTokenIfNeeded();
    
    /**
     * @brief Send a GET request to the API
     * @param endpoint API endpoint
     * @param params Query parameters
     * @return Response as a string
     */
    std::string sendGetRequest(
        const std::string& endpoint,
        const std::map<std::string, std::string>& params = {}
    );
    
    /**
     * @brief Send a POST request to the API
     * @param endpoint API endpoint
     * @param params Request body
     * @return Response as a string
     */
    std::string sendPostRequest(
        const std::string& endpoint,
        const std::map<std::string, std::string>& params = {}
    );
};

} // namespace api
} // namespace deribit