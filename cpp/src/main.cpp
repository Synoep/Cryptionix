/**
 * @file main.cpp
 * @brief Main entry point for the Deribit Trading System
 * 
 * This file contains the main entry point for the Deribit Trading System.
 * It initializes all components, sets up the API client, WebSocket server,
 * and starts the trading loop.
 */

#include <iostream>
#include <string>
#include <thread>
#include <chrono>
#include <atomic>
#include <csignal>
#include "api/deribit_api.h"
#include "websocket/ws_server.h"
#include "utils/logger.h"
#include "utils/config.h"
#include "utils/metrics.h"
#include "ui/terminal_ui.h"

// Signal handling for graceful shutdown
std::atomic<bool> g_running{true};

void signalHandler(int signal) {
    g_running = false;
    std::cout << "Received signal " << signal << ", shutting down..." << std::endl;
}

int main(int argc, char** argv) {
    // Register signal handlers
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);
    
    try {
        // Initialize logger
        deribit::utils::Logger::getInstance().initialize("logs/trading-system.log");
        LOG_INFO("Starting Deribit Trading System...");
        
        // Load configuration
        auto& config = deribit::utils::Config::getInstance();
        if (!config.loadFromFile("config.json")) {
            LOG_ERROR("Failed to load configuration");
            return 1;
        }
        
        // Display welcome message
        deribit::ui::TerminalUI::displayWelcomeMessage();
        
        // Initialize performance metrics
        auto& metrics = deribit::utils::Metrics::getInstance();
        metrics.initialize();
        
        // Initialize API client
        auto apiClient = std::make_shared<deribit::api::DeribitAPI>(
            config.getString("api_key"),
            config.getString("api_secret"),
            config.getBool("testnet", true)
        );
        
        if (!apiClient->authenticate()) {
            LOG_ERROR("Failed to authenticate with Deribit API");
            return 1;
        }
        
        LOG_INFO("Successfully authenticated with Deribit API");
        
        // Initialize WebSocket server
        auto wsServer = std::make_shared<deribit::websocket::WSServer>(
            config.getUInt("ws_port", 8080)
        );
        
        // Start WebSocket server in a separate thread
        std::thread wsThread([&wsServer]() {
            wsServer->start();
        });
        
        // Initialize WebSocket client for market data
        auto wsClient = apiClient->getWebSocketClient();
        
        // Subscribe to market data
        std::vector<std::string> instruments = {
            "BTC-PERPETUAL",
            "ETH-PERPETUAL",
            "BTC-25MAR22"
        };
        
        for (const auto& instrument : instruments) {
            LOG_INFO("Subscribing to orderbook for {}", instrument);
            wsClient->subscribe(
                "book." + instrument + ".100ms",
                [&wsServer, instrument](const deribit::api::WSMessage& msg) {
                    // Forward the message to all subscribed clients
                    wsServer->broadcast(instrument, msg.data);
                    
                    // Update metrics
                    auto& metrics = deribit::utils::Metrics::getInstance();
                    metrics.recordMarketDataUpdate(instrument);
                }
            );
        }
        
        // Main application loop
        LOG_INFO("Entering main application loop");
        while (g_running) {
            // Process any pending API tasks
            apiClient->processEvents();
            
            // Update performance metrics
            metrics.update();
            
            // Sleep to avoid busy-waiting
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }
        
        // Cleanup and shutdown
        LOG_INFO("Shutting down Deribit Trading System...");
        
        // Unsubscribe from all channels
        for (const auto& instrument : instruments) {
            wsClient->unsubscribe("book." + instrument + ".100ms");
        }
        
        // Stop WebSocket server
        wsServer->stop();
        
        // Wait for WebSocket thread to finish
        if (wsThread.joinable()) {
            wsThread.join();
        }
        
        // Final metrics report
        metrics.generateReport("performance_report.json");
        
        LOG_INFO("Deribit Trading System shutdown complete");
        return 0;
    } catch (const std::exception& e) {
        std::cerr << "Fatal error: " << e.what() << std::endl;
        LOG_CRITICAL("Fatal error: {}", e.what());
        return 1;
    }
}