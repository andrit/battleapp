// The AI Service Layer runs against the offline stub whenever ANTHROPIC_API_KEY is unset
// (ai-service-layer.md: "tests run offline against the stub"). Ensure that holds regardless of the
// developer's or CI's ambient environment, so no test ever makes a real Anthropic call. Tests that
// exercise the real path inject their own service instead.
delete process.env.ANTHROPIC_API_KEY;
