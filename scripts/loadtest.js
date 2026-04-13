// GoMPP Load Test — k6
//
// Prerequisites:
//   brew install k6      (macOS)
//   choco install k6     (Windows)
//   apt install k6       (Debian/Ubuntu)
//
// Usage:
//   k6 run scripts/loadtest.js
//   k6 run --vus 50 --duration 60s scripts/loadtest.js
//   K6_BASE_URL=https://api.example.com k6 run scripts/loadtest.js

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:8080";
const ADMIN_EMAIL = __ENV.K6_ADMIN_EMAIL || "admin@gompp.io";
const ADMIN_PASSWORD = __ENV.K6_ADMIN_PASSWORD || "admin123456";

// Custom metrics
const errorRate = new Rate("errors");
const loginDuration = new Trend("login_duration", true);
const videoListDuration = new Trend("video_list_duration", true);

// Load test stages: ramp up → sustained → ramp down
export const options = {
    stages: [
        { duration: "30s", target: 10 }, // warm up
        { duration: "1m", target: 50 }, // ramp to 50 VUs
        { duration: "2m", target: 50 }, // sustained load
        { duration: "30s", target: 100 }, // spike
        { duration: "1m", target: 100 }, // sustained spike
        { duration: "30s", target: 0 }, // ramp down
    ],
    thresholds: {
        http_req_duration: ["p(95)<2000"], // 95% of requests < 2s
        http_req_failed: ["rate<0.05"], // error rate < 5%
        errors: ["rate<0.1"], // custom error rate < 10%
    },
};

export default function () {
    let token = null;

    group("Health Check", () => {
        const res = http.get(`${BASE_URL}/health`);
        check(res, {
            "health status 200": (r) => r.status === 200,
            "health body healthy": (r) => r.json().status === "healthy",
        }) || errorRate.add(1);
    });

    group("Authentication", () => {
        const loginRes = http.post(
            `${BASE_URL}/api/v1/auth/login`,
            JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
            { headers: { "Content-Type": "application/json" } },
        );
        loginDuration.add(loginRes.timings.duration);

        const ok = check(loginRes, {
            "login status 200": (r) => r.status === 200,
            "login has token": (r) =>
                r.json().data && r.json().data.access_token,
        });

        if (ok) {
            token = loginRes.json().data.access_token;
        } else {
            errorRate.add(1);
            return;
        }
    });

    if (!token) {
        sleep(1);
        return;
    }

    const authHeaders = {
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    };

    group("Video Listing", () => {
        const res = http.get(
            `${BASE_URL}/api/v1/videos?page=1&per_page=20`,
            authHeaders,
        );
        videoListDuration.add(res.timings.duration);
        check(res, {
            "videos status 200": (r) => r.status === 200,
        }) || errorRate.add(1);
    });

    group("Presets Listing", () => {
        const res = http.get(`${BASE_URL}/api/v1/presets`, authHeaders);
        check(res, {
            "presets status 200": (r) => r.status === 200,
        }) || errorRate.add(1);
    });

    group("Analytics Overview", () => {
        const res = http.get(
            `${BASE_URL}/api/v1/analytics/overview`,
            authHeaders,
        );
        check(res, {
            "analytics status 200": (r) => r.status === 200,
        }) || errorRate.add(1);
    });

    group("Webhooks Listing", () => {
        const res = http.get(`${BASE_URL}/api/v1/webhooks`, authHeaders);
        check(res, {
            "webhooks status 200": (r) => r.status === 200,
        }) || errorRate.add(1);
    });

    group("User Profile", () => {
        const meRes = http.get(`${BASE_URL}/api/v1/auth/me`, authHeaders);
        check(meRes, {
            "me status 200": (r) => r.status === 200,
        }) || errorRate.add(1);
    });

    sleep(1);
}
