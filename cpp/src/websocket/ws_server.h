/**
 * @file ws_server.h
 * @brief WebSocket server for real-time data distribution
 * 
 * This file contains the WebSocket server implementation for
 * distributing real-time market data to clients.
 */

#pragma once

#include <string>
#include <vector>
#include <map>
#include <set>
#include <mutex>
#include <memory>
#include <functional>
#include <atomic>
#include <thread>

namespace deribit {
namespace websocket {

/**
 * @struct Client
 * @brief Structure representing a connected client
 */
struct Client {
    int id;
    std::set<std::string> subscriptions;
    bool isAlive;
    std::function<void(const std::string&)> sendCallback;
};

/**
 * @class WSServer
 * @brief WebSocket server implementation
 */
class WSServer {
public:
    /**
     * @brief Constructor
     * @param port Port to listen on
     */
    explicit WSServer(unsigned int port);
    
    /**
     * @brief Destructor
     */
    ~WSServer();
    
    /**
     * @brief Start the WebSocket server
     */
    void start();
    
    /**
     * @brief Stop the WebSocket server
     */
    void stop();
    
    /**
     * @brief Broadcast a message to all clients subscribed to a symbol
     * @param symbol Symbol name
     * @param message Message to broadcast
     * @return Number of clients the message was sent to
     */
    int broadcast(const std::string& symbol, const std::string& message);
    
    /**
     * @brief Get the number of connected clients
     * @return Number of connected clients
     */
    size_t getClientCount() const;
    
    /**
     * @brief Set callback for client connection
     * @param callback Callback function
     */
    void setOnClientConnected(std::function<void(int)> callback) {
        m_onClientConnected = callback;
    }
    
    /**
     * @brief Set callback for client disconnection
     * @param callback Callback function
     */
    void setOnClientDisconnected(std::function<void(int)> callback) {
        m_onClientDisconnected = callback;
    }
    
    /**
     * @brief Set callback for client message
     * @param callback Callback function
     */
    void setOnClientMessage(std::function<void(int, const std::string&)> callback) {
        m_onClientMessage = callback;
    }

private:
    unsigned int m_port;
    std::atomic<bool> m_running{false};
    std::atomic<int> m_nextClientId{1};
    std::map<int, std::shared_ptr<Client>> m_clients;
    std::mutex m_clientsMutex;
    std::thread m_serverThread;
    void* m_serverImpl;  // Implementation-specific server object
    
    std::function<void(int)> m_onClientConnected;
    std::function<void(int)> m_onClientDisconnected;
    std::function<void(int, const std::string&)> m_onClientMessage;
    
    /**
     * @brief Handle a new client connection
     * @param client Client object
     */
    void handleClientConnected(std::shared_ptr<Client> client);
    
    /**
     * @brief Handle a client disconnection
     * @param clientId Client ID
     */
    void handleClientDisconnected(int clientId);
    
    /**
     * @brief Handle a client message
     * @param clientId Client ID
     * @param message Message received
     */
    void handleClientMessage(int clientId, const std::string& message);
    
    /**
     * @brief Server thread function
     */
    void serverThreadFunction();
};

} // namespace websocket
} // namespace deribit