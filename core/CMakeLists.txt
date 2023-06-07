cmake_minimum_required(VERSION 3.1)
project("plantopo-inspector" CXX)

set(CAPNPC_SRC_DIR ${CMAKE_CURRENT_BINARY_DIR}/schema)
set(CAPNPC_OUTPUT_DIR ${CMAKE_CURRENT_BINARY_DIR})

find_package(CapnProto CONFIG REQUIRED)

capnp_generate_cpp(deltaSources deltaHeaders schema/types.capnp schema/delta.capnp schema/save.capnp schema/sync.capnp)
add_executable(pt-sync-inspector inspector/inspector.cpp ${deltaSources})

target_include_directories(pt-sync-inspector PRIVATE ${CMAKE_CURRENT_BINARY_DIR})
target_include_directories(pt-sync-inspector PRIVATE ${CAPNP_INCLUDE_DIRS})
target_link_libraries(pt-sync-inspector PRIVATE ${CAPNP_LIBRARIES})
