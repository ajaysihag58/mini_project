/**
 * API Client — Handles all communication with the Flask backend
 */
const API = {
    baseUrl: '/api',

    async request(url, options = {}) {
        try {
            const { headers: optHeaders, ...restOptions } = options;
            const response = await fetch(`${this.baseUrl}${url}`, {
                headers: { 'Content-Type': 'application/json', ...optHeaders },
                ...restOptions
            });

            if (options.raw) return response;

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Non-JSON response:', text.substring(0, 200));
                throw new Error(response.ok ? 'Server returned unexpected response' : `Server error (${response.status})`);
            }

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Request failed');
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // ─── Students ────────────────────────────────────────
    getStudents() {
        return this.request('/students');
    },

    addStudent(data) {
        return this.request('/students', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    deleteStudent(id) {
        return this.request(`/students/${id}`, { method: 'DELETE' });
    },

    // ─── Attendance ──────────────────────────────────────
    markAttendance(data) {
        return this.request('/attendance', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    getAttendance(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/attendance?${query}`);
    },

    exportAttendance(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/attendance/export?${query}`, { raw: true });
    },

    // ─── Dashboard ───────────────────────────────────────
    getDashboard() {
        return this.request('/dashboard');
    }
};
