#pragma once

#include <string>
#include "HybridBugzzAppSDKSpec.hpp"

namespace margelo::nitro::bugzzapp {
    class HybridBugzzAppSDK: public HybridBugzzAppSDKSpec {
    public:
        HybridBugzzAppSDK(): HybridObject(TAG) {}

        std::string getHello() override {
            return hello;
        }
        static const std::string hello;
    };
}
