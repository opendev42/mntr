import datetime
import io
import math
import random
import time
from collections import deque
from functools import cached_property

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from mntr.publisher.data import Alert
from mntr.publisher.data.impl import (
    ChartJSData,
    HtmlData,
    ImageData,
    MultiData,
    PlaintextData,
    TableData,
)
from mntr.publisher.interval_publisher import IntervalPublisher

_HOSTS = ["web-01", "web-02", "api-01", "api-02", "db-01", "worker-01"]
_SERVICES = ["nginx", "gunicorn", "postgres", "redis", "celery", "node"]
_LOG_LEVELS = ["INFO", "WARN", "ERROR", "DEBUG"]
_ENDPOINTS = [
    "GET /api/users", "POST /api/auth", "GET /api/orders",
    "PUT /api/settings", "GET /api/health", "POST /api/webhooks",
    "GET /api/products", "DELETE /api/sessions",
]
_STATUS_CODES = [200, 200, 200, 200, 200, 201, 204, 301, 400, 403, 404, 500]


class SystemLogPublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 3)

    def publish(self):
        now = datetime.datetime.now()
        lines = []
        for _ in range(random.randint(3, 8)):
            ts = now - datetime.timedelta(seconds=random.randint(0, 5))
            host = random.choice(_HOSTS)
            service = random.choice(_SERVICES)
            level = random.choices(
                _LOG_LEVELS, weights=[60, 20, 10, 10]
            )[0]
            messages = {
                "INFO": [
                    f"Request completed in {random.randint(12, 450)}ms",
                    f"Connection pool: {random.randint(5, 20)}/50 active",
                    f"Health check passed ({random.randint(1, 5)}ms)",
                    f"Cache hit ratio: {random.uniform(0.85, 0.99):.1%}",
                    f"Processed {random.randint(100, 5000)} events",
                ],
                "WARN": [
                    f"Response time {random.randint(800, 3000)}ms exceeds threshold",
                    f"Connection pool at {random.randint(80, 95)}% capacity",
                    f"Retry attempt {random.randint(2, 5)} for upstream request",
                    f"Memory usage at {random.uniform(0.75, 0.90):.0%}",
                ],
                "ERROR": [
                    f"Connection refused to {random.choice(_HOSTS)}:5432",
                    f"Request timeout after {random.randint(10, 30)}s",
                    f"OOM killed process (RSS: {random.randint(1, 4)}GB)",
                ],
                "DEBUG": [
                    f"Query executed in {random.randint(1, 50)}ms",
                    f"Cache key expired: session_{random.randint(1000, 9999)}",
                ],
            }
            msg = random.choice(messages[level])
            lines.append(
                f"[{ts.strftime('%H:%M:%S')}] {level:<5} {host}/{service}: {msg}"
            )
        return PlaintextData(data={"text": "\n".join(lines)})


class ServiceStatusPublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 4)

    def publish(self):
        now = datetime.datetime.now()
        rows = []
        for host in _HOSTS:
            status = random.choices(
                ["healthy", "degraded", "down"], weights=[85, 12, 3]
            )[0]
            uptime_hours = random.randint(1, 2400)
            days = uptime_hours // 24
            hours = uptime_hours % 24
            rows.append({
                "host": host,
                "status": status,
                "cpu": f"{random.uniform(5, 95):.1f}%",
                "memory": f"{random.uniform(30, 92):.1f}%",
                "uptime": f"{days}d {hours}h",
                "load_avg": f"{random.uniform(0.1, 8.0):.2f}",
                "open_conns": random.randint(10, 500),
            })

        alert = None
        down = [r for r in rows if r["status"] == "down"]
        if down:
            alert = Alert(
                severity="error",
                title="Host down",
                message=f"{down[0]['host']} unreachable at {now.strftime('%H:%M:%S')}",
            )
        elif any(r["status"] == "degraded" for r in rows):
            alert = Alert(
                severity="warning",
                title="Degraded performance",
                message="One or more hosts reporting degraded status",
            )

        return TableData(data={"table": rows}, alert=alert)


class RequestLatencyPublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 2)

    @cached_property
    def _history(self):
        return {ep: deque(maxlen=20) for ep in _ENDPOINTS[:4]}

    def publish(self):
        for ep in self._history:
            base = hash(ep) % 80 + 20
            noise = random.gauss(0, 15)
            spike = random.random()
            latency = base + noise + (300 if spike > 0.95 else 0)
            self._history[ep].append(max(5, latency))

        data = {
            "labels": [f"t-{i}" for i in range(len(next(iter(self._history.values()))))],
            "datasets": [
                {
                    "label": ep.split()[1],
                    "data": list(values),
                }
                for ep, values in self._history.items()
            ],
        }
        return ChartJSData.line(data)


class ErrorRatePublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 2.5)

    @cached_property
    def _history(self):
        return deque(maxlen=30)

    @cached_property
    def _time_labels(self):
        return deque(maxlen=30)

    def publish(self):
        now = datetime.datetime.now()
        total = random.randint(500, 2000)
        errors = int(total * random.uniform(0.005, 0.05))
        rate = errors / total * 100

        self._history.append(rate)
        self._time_labels.append(now.strftime("%H:%M:%S"))

        data = {
            "datasets": [
                {
                    "label": "error %",
                    "data": [
                        {"x": t, "y": round(r, 2)}
                        for t, r in zip(self._time_labels, self._history)
                    ],
                    "showLine": True,
                }
            ],
        }

        alert = None
        if rate > 3.5:
            alert = Alert(
                severity="error",
                title="High error rate",
                message=f"Error rate {rate:.1f}% ({errors}/{total} requests)",
            )

        return ChartJSData.scatter(data, alert=alert)


class TrafficByEndpointPublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 3)

    def publish(self):
        endpoints = _ENDPOINTS[:6]
        data = {
            "labels": [ep.split()[1] for ep in endpoints],
            "datasets": [
                {
                    "label": "2xx",
                    "data": [random.randint(200, 2000) for _ in endpoints],
                },
                {
                    "label": "4xx",
                    "data": [random.randint(5, 100) for _ in endpoints],
                },
                {
                    "label": "5xx",
                    "data": [random.randint(0, 20) for _ in endpoints],
                },
            ],
        }
        return ChartJSData.bar(data)


class ResourceUsagePublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 3)

    def publish(self):
        metrics = ["CPU", "Memory", "Disk I/O", "Network", "Cache Hit", "Queue Depth"]
        data = {
            "labels": metrics,
            "datasets": [
                {
                    "label": host,
                    "data": [
                        random.uniform(10, 95),
                        random.uniform(40, 90),
                        random.uniform(5, 70),
                        random.uniform(10, 80),
                        random.uniform(60, 99),
                        random.uniform(0, 50),
                    ],
                }
                for host in ["web-01", "api-01", "db-01"]
            ],
        }
        return ChartJSData.radar(data)


class StatusCodeDistPublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 4)

    def publish(self):
        data = {
            "labels": ["200 OK", "201 Created", "301 Redirect", "400 Bad Request", "404 Not Found", "500 Error"],
            "datasets": [
                {
                    "label": "responses",
                    "data": [
                        random.randint(5000, 15000),
                        random.randint(200, 1000),
                        random.randint(100, 500),
                        random.randint(50, 300),
                        random.randint(20, 200),
                        random.randint(0, 50),
                    ],
                }
            ],
        }
        return ChartJSData.pie(data)


class LatencyDistributionPublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 5)

    def publish(self):
        fig, axes = plt.subplots(1, 2, figsize=(10, 4))

        latencies = np.concatenate([
            np.random.lognormal(3.5, 0.6, 800),
            np.random.lognormal(5.5, 0.3, 200),
        ])
        axes[0].hist(latencies, bins=50, alpha=0.7, color="#1976d2", edgecolor="none")
        axes[0].axvline(np.percentile(latencies, 50), color="#4caf50", linestyle="--", label="p50")
        axes[0].axvline(np.percentile(latencies, 95), color="#ff9800", linestyle="--", label="p95")
        axes[0].axvline(np.percentile(latencies, 99), color="#f44336", linestyle="--", label="p99")
        axes[0].legend(fontsize=8)
        axes[0].set_title("Response Latency (ms)", fontsize=10)
        axes[0].set_xlabel("ms", fontsize=8)

        sizes = np.random.lognormal(8, 1.5, 1000)
        axes[1].hist(sizes, bins=50, alpha=0.7, color="#7b1fa2", edgecolor="none")
        axes[1].set_title("Response Size (bytes)", fontsize=10)
        axes[1].set_xlabel("bytes", fontsize=8)

        fig.tight_layout()
        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight", facecolor="white", dpi=100)
        plt.close(fig)

        return ImageData.from_bytes(buf.getvalue(), image_format="png")


class RequestLogPublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 2)

    def publish(self):
        now = datetime.datetime.now()
        rows = []
        for _ in range(random.randint(8, 20)):
            ts = now - datetime.timedelta(seconds=random.randint(0, 10))
            endpoint = random.choice(_ENDPOINTS)
            status = random.choice(_STATUS_CODES)
            latency = random.randint(5, 800)
            rows.append({
                "time": ts.strftime("%H:%M:%S"),
                "method": endpoint.split()[0],
                "path": endpoint.split()[1],
                "status": status,
                "latency_ms": latency,
                "host": random.choice(_HOSTS),
            })
        rows.sort(key=lambda r: r["time"], reverse=True)

        df = pd.DataFrame(rows)
        return TableData.from_dataframe(df)


class DeployStatusPublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 5)

    def publish(self):
        now = datetime.datetime.now()
        build = random.randint(1200, 1300)
        sha = f"{random.randint(0, 0xffffff):06x}"
        minutes_ago = random.randint(1, 120)
        deployed = now - datetime.timedelta(minutes=minutes_ago)
        status = random.choices(
            ["healthy", "rolling", "failed"], weights=[80, 15, 5]
        )[0]

        severity = {"healthy": "success", "rolling": "info", "failed": "error"}[status]
        title = {
            "healthy": f"Build #{build} live",
            "rolling": f"Deploying build #{build}...",
            "failed": f"Build #{build} rollback",
        }[status]

        html = f"""
        <div style="font-family: monospace; font-size: 13px; line-height: 1.6">
            <b>Build:</b> #{build} &nbsp;
            <b>Commit:</b> <code>{sha}</code><br/>
            <b>Deployed:</b> {deployed.strftime('%Y-%m-%d %H:%M')} ({minutes_ago}m ago)<br/>
            <b>Replicas:</b> {random.randint(2, 6)}/{random.randint(3, 6)} ready &nbsp;
            <b>Restarts:</b> {random.randint(0, 3)}
        </div>
        """
        return HtmlData(
            data={"html": html},
            alert=Alert(severity=severity, title=title),
        )


class AlertPublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 5)

    _ALERTS = {
        "error": [
            ("Database connection pool exhausted", "db-01 has 0 available connections"),
            ("Disk space critical", "/var/log at 96% on worker-01"),
            ("SSL certificate expiring", "api.example.com expires in 3 days"),
        ],
        "warning": [
            ("High memory usage", "api-02 at 89% memory utilization"),
            ("Slow query detected", "SELECT on orders took 4.2s"),
            ("Queue backlog growing", "celery queue depth: 1,247 tasks"),
        ],
        "info": [
            ("Auto-scaling triggered", "web pool scaled from 3 to 5 instances"),
            ("Backup completed", "Daily backup finished in 12m 34s"),
            ("Config reload", "nginx configuration reloaded on web-01, web-02"),
        ],
        "success": [
            ("Incident resolved", "API latency returned to normal levels"),
            ("Migration complete", "Schema v47 applied to all replicas"),
            ("Health check restored", "db-01 passing all health checks"),
        ],
    }

    def publish(self):
        severity = self.params.get("alert_severity", "info")
        title, message = random.choice(self._ALERTS[severity])
        now = datetime.datetime.now().strftime("%H:%M:%S")
        return PlaintextData(
            alert=Alert(severity=severity, title=title, message=f"{message} ({now})"),
            data={"text": ""},
        )


class DashboardPublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 5)

    @cached_property
    def monitors(self):
        return {k: self.from_config(v) for k, v in self.params["monitors"].items()}

    def publish(self):
        return MultiData({k: m.publish() for k, m in self.monitors.items()})
