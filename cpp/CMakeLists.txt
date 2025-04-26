cmake_minimum_required(VERSION 3.14)
project(DeribitTradingSystem VERSION 1.0.0 LANGUAGES CXX)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Set compile flags
if(MSVC)
    add_compile_options(/W4 /WX)
else()
    add_compile_options(-Wall -Wextra -Wpedantic -Werror)
endif()

# Enable optimization for Release builds
set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -O3")

# Set output directories
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)

# Find required packages
find_package(Boost REQUIRED COMPONENTS system thread)
find_package(OpenSSL REQUIRED)
find_package(nlohmann_json REQUIRED)
find_package(spdlog REQUIRED)
find_package(ftxui REQUIRED)

# Add include directories
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${Boost_INCLUDE_DIRS}
    ${OPENSSL_INCLUDE_DIR}
)

# Define source files
set(SOURCES
    src/main.cpp
    src/api/deribit_api.cpp
    src/websocket/ws_client.cpp
    src/websocket/ws_server.cpp
    src/order/order.cpp
    src/order/orderbook.cpp
    src/utils/logger.cpp
    src/utils/config.cpp
    src/utils/metrics.cpp
    src/ui/terminal_ui.cpp
)

# Define header files
set(HEADERS
    src/api/deribit_api.h
    src/websocket/ws_client.h
    src/websocket/ws_server.h
    src/order/order.h
    src/order/orderbook.h
    src/utils/logger.h
    src/utils/config.h
    src/utils/metrics.h
    src/ui/terminal_ui.h
)

# Add executable
add_executable(deribit_trading_system ${SOURCES} ${HEADERS})

# Link libraries
target_link_libraries(deribit_trading_system PRIVATE
    ${Boost_LIBRARIES}
    ${OPENSSL_LIBRARIES}
    nlohmann_json::nlohmann_json
    spdlog::spdlog
    ftxui::screen
    ftxui::dom
    ftxui::component
    pthread
)

# Define test sources
set(TEST_SOURCES
    tests/api_tests.cpp
    tests/order_tests.cpp
    tests/ws_tests.cpp
)

# Find GTest
find_package(GTest REQUIRED)

# Add test executable
add_executable(deribit_tests ${TEST_SOURCES})

# Link test libraries
target_link_libraries(deribit_tests PRIVATE
    ${Boost_LIBRARIES}
    ${OPENSSL_LIBRARIES}
    nlohmann_json::nlohmann_json
    spdlog::spdlog
    GTest::GTest
    GTest::Main
    pthread
)

# Add test
include(GoogleTest)
gtest_discover_tests(deribit_tests)

# Add performance benchmark
add_executable(latency_benchmark benchmarks/latency_benchmark.cpp)
target_link_libraries(latency_benchmark PRIVATE
    ${Boost_LIBRARIES}
    ${OPENSSL_LIBRARIES}
    nlohmann_json::nlohmann_json
    spdlog::spdlog
    pthread
)

# Install targets
install(TARGETS deribit_trading_system DESTINATION bin)

# Create documentation
find_package(Doxygen)
if(DOXYGEN_FOUND)
    set(DOXYGEN_IN ${CMAKE_CURRENT_SOURCE_DIR}/docs/Doxyfile.in)
    set(DOXYGEN_OUT ${CMAKE_CURRENT_BINARY_DIR}/Doxyfile)
    
    configure_file(${DOXYGEN_IN} ${DOXYGEN_OUT} @ONLY)
    
    add_custom_target(docs
        COMMAND ${DOXYGEN_EXECUTABLE} ${DOXYGEN_OUT}
        WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
        COMMENT "Generating API documentation with Doxygen"
        VERBATIM
    )
endif()