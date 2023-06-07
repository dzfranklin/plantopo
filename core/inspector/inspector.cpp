#include <capnp/compat/json.h>
#include <capnp/message.h>
#include <capnp/serialize-packed.h>
#include <getopt.h>
#include <kj/io.h>
#include <unistd.h>

#include <iostream>
#include <optional>
#include <string_view>

#include "schema/delta.capnp.h"
#include "schema/save.capnp.h"
#include "schema/sync.capnp.h"

// A simple test is to check a message round-trips:
//   echo '{"features": {"dead": [{"id": {"client": 1, "counter": 42}}]}}' | build/pt-sync-inspector --type delta --encode | build/pt-sync-inspector --type delta --decode

int main(int argc, char* argv[]) {
    std::string type;
    bool encode = false;
    bool decode = false;

    const struct option longOpts[] = {
        {"type", required_argument, nullptr, 't'},
        {"encode", no_argument, nullptr, 'e'},
        {"decode", no_argument, nullptr, 'd'},
        {nullptr, 0, nullptr, 0}};

    int opt;
    while ((opt = getopt_long(argc, argv, "t:e", longOpts, nullptr)) != -1) {
        switch (opt) {
            case 't':
                type = optarg;
                break;
            case 'e':
                encode = true;
                break;
            case 'd':
                decode = true;
                break;
            case '?':
                std::cerr << "Error: Unknown option." << std::endl;
                return 1;
            case ':':
                std::cerr << "Error: Option requires an argument." << std::endl;
                return 1;
            default:
                std::cerr << "Error: Unexpected error." << std::endl;
                return 1;
        }
    }

    if (encode && decode) {
        std::cerr << "Error: Cannot specify both encode and decode." << std::endl;
        return 1;
    }

    if (decode) {
        capnp::PackedFdMessageReader reader(STDIN_FILENO);

        kj::String out;
        capnp::JsonCodec json;
        json.setPrettyPrint(true);

        if (type == "delta") {
            auto value = reader.getRoot<Delta>();
            out = json.encode(value);
        } else if (type == "save") {
            auto value = reader.getRoot<Save>();
            out = json.encode(value);
        } else if (type == "sync") {
            auto value = reader.getRoot<Message>();
            out = json.encode(value);
        } else {
            std::cerr << "Error: Unknown type: " << type << std::endl;
            return 1;
        }

        std::cout << out.cStr() << std::endl;
    } else if (encode) {
        std::string in_string;
        std::string line;
        while (std::getline(std::cin, line)) {
            in_string += line;
        }
        auto in = kj::heapArray<const char>(in_string.c_str(), in_string.size());

        capnp::JsonCodec json;
        capnp::MallocMessageBuilder builder;

        if (type == "delta") {
            auto root = builder.initRoot<Delta>();
            json.decode(in.asPtr(), root);
        } else if (type == "save") {
            auto root = builder.initRoot<Save>();
            json.decode(in.asPtr(), root);
        } else if (type == "sync") {
            auto root = builder.initRoot<Message>();
            json.decode(in.asPtr(), root);
        } else {
            std::cerr << "Error: Unknown type: " << type << std::endl;
            return 1;
        }

        capnp::writePackedMessageToFd(STDOUT_FILENO, builder);
    } else {
        std::cerr << "Error: Must specify either encode or decode." << std::endl;
        return 1;
    }

    return 0;
}
