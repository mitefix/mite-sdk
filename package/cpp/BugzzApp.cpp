#include <string>

class BugzzAppSDK {
    // read only variable that returns "hello world!"
    std::string hello;

    public:
        BugzzAppSDK() : hello("hello world!") {}
}
