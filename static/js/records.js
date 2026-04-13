/**
 * RecordsPage — View and export attendance history
 */
const RecordsPage = {
    async init() {
        const content = document.getElementById('page-content');
        const today = new Date().toISOString().split('T')[0];

        content.innerHTML = `
            <div class="page-header">
                <div>
                    <h2><span class="material-icons-round page-icon">assignment</span> Attendance Records</h2>
                    <p class="page-subtitle">View and export attendance history</p>
                </div>
            </div>

            <div class="filters-bar glass-card">
                <div class="filters-row">
                    <div class="filter-group">
                        <label for="filter-date"><span class="material-icons-round">calendar_today</span> Date</label>
                        <input type="date" id="filter-date" value="${today}" />
                    </div>
                    <div class="filter-group">
                        <label for="filter-class"><span class="material-icons-round">school</span> Class</label>
                        <select id="filter-class">
                            <option value="">All Classes</option>
                        </select>
                    </div>
                    <div class="filter-actions">
                        <button class="btn btn-primary" id="btn-filter">
                            <span class="material-icons-round">search</span> Search
                        </button>
                        <button class="btn btn-secondary" id="btn-clear-filter">
                            <span class="material-icons-round">filter_alt_off</span> Clear
                        </button>
                        <button class="btn btn-accent" id="btn-export">
                            <span class="material-icons-round">download</span> Export CSV
                        </button>
                    </div>
                </div>
            </div>

            <div class="records-table-card glass-card">
                <div id="records-table-container">
                    <div class="empty-state small">
                        <span class="material-icons-round">hourglass_top</span>
                        <p>Loading records...</p>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('btn-filter').addEventListener('click', () => this.loadRecords());
        document.getElementById('btn-clear-filter').addEventListener('click', () => this.clearFilters());
        document.getElementById('btn-export').addEventListener('click', () => this.exportCSV());

        // Auto-search on date change
        document.getElementById('filter-date').addEventListener('change', () => this.loadRecords());
        document.getElementById('filter-class').addEventListener('change', () => this.loadRecords());

        await this.loadClasses();
        await this.loadRecords();
    },

    async loadClasses() {
        try {
            const data = await API.getDashboard();
            const select = document.getElementById('filter-class');
            data.classes.forEach(cls => {
                const opt = document.createElement('option');
                opt.value = cls;
                opt.textContent = cls;
                select.appendChild(opt);
            });
        } catch (err) { /* silent */ }
    },

    clearFilters() {
        document.getElementById('filter-date').value = '';
        document.getElementById('filter-class').value = '';
        this.loadRecords();
    },

    async loadRecords() {
        const date = document.getElementById('filter-date').value;
        const cls = document.getElementById('filter-class').value;

        const params = {};
        if (date) params.date = date;
        if (cls) params.class_section = cls;

        try {
            const records = await API.getAttendance(params);
            const container = document.getElementById('records-table-container');

            if (records.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="material-icons-round">event_busy</span>
                        <p>No attendance records found</p>
                        <p class="subtext">Try changing the date or class filter</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = `
                <div class="table-responsive">
                    <table class="records-table" id="records-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Name</th>
                                <th>Roll Number</th>
                                <th>Class</th>
                                <th>Date</th>
                                <th>Time</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${records.map((r, i) => `
                                <tr class="table-row-animate" style="animation-delay: ${i * 0.03}s">
                                    <td><span class="row-num">${i + 1}</span></td>
                                    <td><strong>${r.name}</strong></td>
                                    <td>${r.roll_number}</td>
                                    <td><span class="class-badge">${r.class_section}</span></td>
                                    <td>${r.date}</td>
                                    <td>${r.time}</td>
                                    <td><span class="status-badge status-${r.status}">${r.status}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="records-summary">
                    <span class="material-icons-round">info</span>
                    <span>Showing <strong>${records.length}</strong> record${records.length !== 1 ? 's' : ''}</span>
                </div>
            `;
        } catch (err) {
            Toast.show('Failed to load records', 'error');
        }
    },

    async exportCSV() {
        const date = document.getElementById('filter-date').value;
        const cls = document.getElementById('filter-class').value;

        const params = {};
        if (date) params.date = date;
        if (cls) params.class_section = cls;

        try {
            const response = await API.exportAttendance(params);
            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `attendance_${date || 'all'}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            Toast.show('CSV exported successfully!', 'success');
        } catch (err) {
            Toast.show('Failed to export CSV', 'error');
        }
    },

    destroy() {}
};
