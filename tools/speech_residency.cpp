// Evaluation glue only. Decoding is entirely the pinned upstream library.
#include "parakeet.h"
#include "common-whisper.h"
#include <chrono>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>
#include <sys/resource.h>
using Clock = std::chrono::steady_clock;
static double elapsed(Clock::time_point start) {
    return std::chrono::duration<double>(Clock::now() - start).count();
}
static long rss() {
    std::ifstream input("/proc/self/status");
    std::string key;
    while (input >> key) {
        if (key == "VmRSS:") { long value; input >> value; return value; }
        std::getline(input, key);
    }
    return -1;
}
int main(int argc, char **argv) {
    if (argc != 3) return 2;
    auto params = parakeet_context_default_params();
    params.use_gpu = false;
    auto start = Clock::now();
    auto *context = parakeet_init_from_file_with_params(argv[1], params);
    if (!context) return 3;
    const auto load = elapsed(start);
    const auto loaded_rss = rss();
    std::vector<float> pcm;
    std::vector<std::vector<float>> channels;
    if (!read_audio_data(argv[2], pcm, channels, false) || pcm.empty()) {
        parakeet_free(context); return 4;
    }
    std::cout << "{\"load_seconds\":" << load << ",\"loaded_rss_kib\":" << loaded_rss << ",\"decodes\":[";
    for (int i = 0; i < 3; ++i) {
        auto full = parakeet_full_default_params(PARAKEET_SAMPLING_GREEDY);
        full.n_threads = 6;
        start = Clock::now();
        const int code = parakeet_full(context, full, pcm.data(), pcm.size());
        if (code != 0) { parakeet_free(context); return 5; }
        if (i) std::cout << ',';
        std::cout << "{\"ok\":true,\"seconds\":" << elapsed(start) << ",\"rss_kib\":" << rss() << ",\"segments\":" << parakeet_full_n_segments(context) << '}';
        for (int segment = 0; segment < parakeet_full_n_segments(context); ++segment)
            std::cerr << parakeet_full_get_segment_text(context, segment) << '\n';
    }
    rusage usage{};
    getrusage(RUSAGE_SELF, &usage);
    std::cout << "],\"peak_rss_kib\":" << usage.ru_maxrss << "}\n";
    parakeet_free(context);
}
