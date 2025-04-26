# Deribit Trading System

A high-performance order execution and management system for trading on Deribit Test, implemented in C++.

## Overview

This project provides a comprehensive trading system for the Deribit cryptocurrency derivatives exchange. It focuses on high-performance, low-latency execution with robust error handling and real-time market data streaming.

## Features

- Order management functions (place, cancel, modify orders)
- Real-time market data streaming via WebSocket
- Multi-instrument support (Spot, Futures, Options)
- Position tracking and management
- WebSocket server for real-time data distribution
- Performance metrics collection and reporting
- Comprehensive logging system

## Project Structure

```
├── cpp/                    # C++ implementation
│   ├── CMakeLists.txt      # CMake build configuration
│   ├── src/                # Source code
│   ├── tests/              # Unit tests
│   └── benchmarks/         # Performance benchmarks
├── src/                    # Node.js prototype implementation
├── index.js                # Entry point for Node.js prototype
├── package.json            # Package configuration
└── .env.example            # Example environment variables
```

## Getting Started

### Prerequisites

- Deribit Test account
- API Keys for authentication

### Installation

1. Clone the repository
2. Create a `.env` file with your Deribit API credentials (see `.env.example`)
3. Install dependencies:

```bash
npm install
```

### Running the Node.js Prototype

```bash
npm start
```

### Building the C++ Implementation

The C++ implementation requires:

- CMake 3.14+
- C++17 compatible compiler
- Boost libraries
- OpenSSL
- nlohmann/json
- spdlog
- ftxui

Build steps:

```bash
cd cpp
mkdir build
cd build
cmake ..
make
```

## Usage

### Order Management

```cpp
// Place a limit order
auto order = api.placeOrder(
    "BTC-PERPETUAL",       // instrument
    "buy",                 // direction
    0.1,                   // amount
    50000,                 // price
    "limit"                // type
);

// Cancel an order
api.cancelOrder(order.order_id);

// Modify an order
api.modifyOrder(
    order.order_id,
    0.2,                   // new amount
    49000                  // new price
);

// Get the orderbook
auto orderbook = api.getOrderbook("BTC-PERPETUAL");

// Get positions
auto positions = api.getPositions();
```

### WebSocket Subscriptions

```cpp
// Subscribe to orderbook updates
api.subscribe("book.BTC-PERPETUAL.100ms", [](const WSMessage& msg) {
    // Process orderbook update
    std::cout << "Received update for " << msg.channel << std::endl;
});
```

## Performance Benchmarking

The system includes comprehensive benchmarking tools for measuring:

- Order placement latency
- Market data processing latency
- WebSocket message propagation delay
- End-to-end trading loop latency

Run the benchmark:

```bash
cd cpp/build/bin
./latency_benchmark
```

## Documentation

Full API documentation can be generated using Doxygen:

```bash
cd cpp/build
make docs
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.