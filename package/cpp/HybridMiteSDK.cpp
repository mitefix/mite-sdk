#include "HybridMiteSDK.hpp"
#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <ctime>
#include <unistd.h>
#include <fcntl.h>
#include <execinfo.h>

namespace margelo::nitro::mite {
    const std::string HybridMiteSDK::hello = "Hello World!";
    std::vector<int> HybridMiteSDK::registeredSignals;
    std::vector<struct sigaction> HybridMiteSDK::oldHandlers;
    bool HybridMiteSDK::handlersInstalled = false;
    std::string HybridMiteSDK::crashReportDir = "/tmp";

    void HybridMiteSDK::setCrashReportDir(const std::string& dir) {
        crashReportDir = dir;
    }

    void HybridMiteSDK::installCrashHandlers() {
        if (handlersInstalled) {
            return;
        }

        struct sigaction action;
        memset(&action, 0, sizeof(action));
        action.sa_handler = handleSignal;
        sigemptyset(&action.sa_mask);

        // Install handlers for each signal
        for (size_t i = 0; i < registeredSignals.size(); i++) {
            int signal = registeredSignals[i];
            sigaction(signal, &action, &oldHandlers[i]);
        }

        handlersInstalled = true;
    }

    void HybridMiteSDK::removeCrashHandlers() {
        if (!handlersInstalled) {
            return;
        }

        // Restore previous handlers
        for (size_t i = 0; i < registeredSignals.size(); i++) {
            int signal = registeredSignals[i];
            sigaction(signal, &oldHandlers[i], nullptr);
        }

        handlersInstalled = false;
    }

    void HybridMiteSDK::handleSignal(int signal) {
        // Log the crash
        logCrashReport(signal);

        // Restore default handler and re-raise signal
        struct sigaction action;
        memset(&action, 0, sizeof(action));
        action.sa_handler = SIG_DFL;
        sigemptyset(&action.sa_mask);
        sigaction(signal, &action, nullptr);

        // Re-raise signal
        kill(getpid(), signal);
    }

    void HybridMiteSDK::writeCrashToFile(int signal, const char* signalName, void** callstack, int frames) {
        // Build file path: <crashReportDir>/mite_crash_<timestamp>.txt
        // Use only async-signal-safe operations
        char filepath[512];
        snprintf(filepath, sizeof(filepath), "%s/mite_crash_report.json",
                 crashReportDir.c_str());

        int fd = open(filepath, O_WRONLY | O_CREAT | O_TRUNC, 0644);
        if (fd < 0) return;

        // Write JSON crash report using low-level write (async-signal-safe)
        char buf[8192];
        int len = snprintf(buf, sizeof(buf),
            "{\n"
            "  \"signal\": %d,\n"
            "  \"signal_name\": \"%s\",\n"
            "  \"pid\": %d,\n"
            "  \"timestamp\": %ld,\n"
            "  \"frames\": [\n",
            signal, signalName, getpid(), (long)time(nullptr));

        write(fd, buf, len);

        // Write backtrace symbols
        char** symbols = backtrace_symbols(callstack, frames);
        if (symbols != nullptr) {
            for (int i = 0; i < frames; i++) {
                len = snprintf(buf, sizeof(buf), "    \"%s\"%s\n",
                               symbols[i],
                               (i < frames - 1) ? "," : "");
                write(fd, buf, len);
            }
            free(symbols);
        }

        len = snprintf(buf, sizeof(buf), "  ]\n}\n");
        write(fd, buf, len);

        close(fd);
    }

    void HybridMiteSDK::logCrashReport(int signal) {
        const char* signalName = "";
        switch (signal) {
            case SIGABRT: signalName = "SIGABRT"; break;
            case SIGBUS: signalName = "SIGBUS"; break;
            case SIGFPE: signalName = "SIGFPE"; break;
            case SIGILL: signalName = "SIGILL"; break;
            case SIGSEGV: signalName = "SIGSEGV"; break;
            case SIGSYS: signalName = "SIGSYS"; break;
            case SIGTRAP: signalName = "SIGTRAP"; break;
            default: signalName = "UNKNOWN"; break;
        }

        // Print crash information to stderr
        fprintf(stderr, "[Mite] App crashed with signal %d (%s)\n", signal, signalName);

        // Get backtrace
        void* callstack[128];
        int frames = backtrace(callstack, 128);

        // Write crash report to file for later upload
        writeCrashToFile(signal, signalName, callstack, frames);

        // Also log to stderr for debugging
        char** symbols = backtrace_symbols(callstack, frames);
        if (symbols != nullptr) {
            fprintf(stderr, "[Mite] Stack trace:\n");
            for (int i = 0; i < frames; i++) {
                fprintf(stderr, "[Mite] %s\n", symbols[i]);
            }
            free(symbols);
        }
    }
}
