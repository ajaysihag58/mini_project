/**
 * DashboardPage — Overview statistics and charts
 */
const DashboardPage = {
    charts: [],

    async init() {
        const content = document.getElementById('page-content');
        content.innerHTML = `
            <div class="page-header">
                <div>
                    <h2><span class="material-icons-round page-icon">dashboard</span> Dashboard</h2>
                    <p class="page-subtitle">Overview of attendance statistics</p>
                </div>
                <div class="header-date">
                    <span class="material-icons-round">calendar_today</span>
                    <span>${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
            </div>

            <div class="stats-grid" id="stats-grid">
                <div class="stat-card stat-primary">
                    <div class="stat-icon"><span class="material-icons-round">groups</span></div>
                    <div class="stat-info">
                        <span class="stat-value" id="stat-total">—</span>
                        <span class="stat-label">Total Students</span>
                    </div>
                    <div class="stat-decoration"></div>
                </div>
                <div class="stat-card stat-success">
                    <div class="stat-icon"><span class="material-icons-round">check_circle</span></div>
                    <div class="stat-info">
                        <span class="stat-value" id="stat-present">—</span>
                        <span class="stat-label">Present Today</span>
                    </div>
                    <div class="stat-decoration"></div>
                </div>
                <div class="stat-card stat-danger">
                    <div class="stat-icon"><span class="material-icons-round">cancel</span></div>
                    <div class="stat-info">
                        <span class="stat-value" id="stat-absent">—</span>
                        <span class="stat-label">Absent Today</span>
                    </div>
                    <div class="stat-decoration"></div>
                </div>
                <div class="stat-card stat-warning">
                    <div class="stat-icon"><span class="material-icons-round">trending_up</span></div>
                    <div class="stat-info">
                        <span class="stat-value" id="stat-avg">—</span>
                        <span class="stat-label">Avg Attendance</span>
                    </div>
                    <div class="stat-decoration"></div>
                </div>
            </div>

            <div class="charts-grid">
                <div class="chart-card glass-card">
                    <div class="chart-header">
                        <h3><span class="material-icons-round">show_chart</span> Attendance Trend</h3>
                        <span class="chart-badge">Last 7 Days</span>
                    </div>
                    <div class="chart-wrapper">
                        <canvas id="trend-chart"></canvas>
                    </div>
                </div>
                <div class="chart-card glass-card">
                    <div class="chart-header">
                        <h3><span class="material-icons-round">bar_chart</span> Student Overview</h3>
                        <span class="chart-badge">Days Present</span>
                    </div>
                    <div class="chart-wrapper">
                        <canvas id="student-chart"></canvas>
                    </div>
                </div>
            </div>
        `;

        await this.loadData();
    },

    async loadData() {
        try {
            const data = await API.getDashboard();

            // Animate stat values
            this.animateValue('stat-total', data.total_students);
            this.animateValue('stat-present', data.today_present);
            this.animateValue('stat-absent', data.today_absent);
            document.getElementById('stat-avg').textContent = `${data.avg_attendance}%`;

            this.renderTrendChart(data.trend);
            this.renderStudentChart(data.student_stats);
        } catch (err) {
            Toast.show('Failed to load dashboard data', 'error');
        }
    },

    animateValue(elementId, endValue) {
        const el = document.getElementById(elementId);
        if (endValue === 0) { el.textContent = '0'; return; }
        let current = 0;
        const step = Math.max(1, Math.floor(endValue / 20));
        const interval = setInterval(() => {
            current += step;
            if (current >= endValue) {
                current = endValue;
                clearInterval(interval);
            }
            el.textContent = current;
        }, 30);
    },

    renderTrendChart(trend) {
        const ctx = document.getElementById('trend-chart');
        if (!ctx) return;

        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(22, 163, 74, 0.15)');
        gradient.addColorStop(1, 'rgba(22, 163, 74, 0.0)');

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trend.map(t => {
                    const d = new Date(t.date);
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }),
                datasets: [{
                    label: 'Students Present',
                    data: trend.map(t => t.count),
                    borderColor: '#16a34a',
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.45,
                    borderWidth: 2.5,
                    pointBackgroundColor: '#16a34a',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#ffffff',
                        titleColor: '#111827',
                        bodyColor: '#16a34a',
                        borderColor: '#e5e7eb',
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#9ca3af', font: { family: 'Inter' } },
                        grid: { color: '#f3f4f6' }
                    },
                    x: {
                        ticks: { color: '#9ca3af', font: { family: 'Inter' } },
                        grid: { color: '#f3f4f6' }
                    }
                }
            }
        });
        this.charts.push(chart);
    },

    renderStudentChart(stats) {
        const ctx = document.getElementById('student-chart');
        if (!ctx) return;

        const colors = ['#16a34a', '#22c55e', '#38bdf8', '#4ade80', '#0ea5e9', '#86efac', '#7dd3fc', '#a7f3d0', '#bae6fd', '#d1fae5'];

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: stats.map(s => s.name.length > 12 ? s.name.substring(0, 12) + '\u2026' : s.name),
                datasets: [{
                    label: 'Days Present',
                    data: stats.map(s => s.present_days),
                    backgroundColor: stats.map((_, i) => colors[i % colors.length] + 'CC'),
                    borderColor: stats.map((_, i) => colors[i % colors.length]),
                    borderWidth: 1.5,
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#ffffff',
                        titleColor: '#111827',
                        bodyColor: '#16a34a',
                        borderColor: '#e5e7eb',
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#9ca3af', font: { family: 'Inter' } },
                        grid: { color: '#f3f4f6' }
                    },
                    x: {
                        ticks: { color: '#9ca3af', maxRotation: 45, font: { family: 'Inter', size: 11 } },
                        grid: { display: false }
                    }
                }
            }
        });
        this.charts.push(chart);
    },

    destroy() {
        this.charts.forEach(c => c.destroy());
        this.charts = [];
    }
};
