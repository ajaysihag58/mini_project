/**
 * App — SPA Router & Main Application Controller
 */
const App = {
    currentPage: null,
    pages: {},

    init() {
        this.pages = {
            dashboard: DashboardPage,
            attendance: AttendancePage,
            register: RegisterPage,
            records: RecordsPage
        };

        // Mobile nav toggle
        const toggle = document.getElementById('mobile-nav-toggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                document.getElementById('topbar-nav').classList.toggle('open');
            });
        }

        // Close nav on link click (mobile)
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                const nav = document.getElementById('topbar-nav');
                if (nav) nav.classList.remove('open');
            });
        });

        // Load face-api models
        FaceManager.loadModels().then(() => {
            document.getElementById('loading-overlay').classList.add('hidden');
            Toast.show('Face recognition models loaded!', 'success');
        }).catch(err => {
            console.error('Failed to load models:', err);
            document.getElementById('loading-overlay').classList.add('hidden');
            Toast.show('Failed to load AI models. Face recognition may not work.', 'error');
        });

        // Setup hash-based routing
        window.addEventListener('hashchange', () => this.route());

        // Initial route
        if (!window.location.hash) {
            window.location.hash = '#dashboard';
        } else {
            this.route();
        }
    },

    route() {
        const hash = window.location.hash.slice(1) || 'dashboard';
        const page = this.pages[hash];

        if (!page) {
            window.location.hash = '#dashboard';
            return;
        }

        // Destroy current page (cleanup cameras, intervals, etc.)
        if (this.currentPage && this.currentPage.destroy) {
            this.currentPage.destroy();
        }

        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === hash);
        });

        // Animate page transition
        const content = document.getElementById('page-content');
        content.classList.add('page-exit');

        setTimeout(() => {
            content.classList.remove('page-exit');
            content.classList.add('page-enter');
            this.currentPage = page;
            page.init();

            setTimeout(() => content.classList.remove('page-enter'), 300);
        }, 150);
    }
};


/**
 * Toast — Notification system
 */
const Toast = {
    show(message, type = 'info', duration = 3500) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: 'check_circle',
            error: 'error',
            info: 'info',
            warning: 'warning'
        };

        toast.innerHTML = `
            <span class="material-icons-round toast-icon">${icons[type] || 'info'}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <span class="material-icons-round">close</span>
            </button>
        `;

        container.appendChild(toast);

        // Trigger entrance animation
        requestAnimationFrame(() => {
            requestAnimationFrame(() => toast.classList.add('show'));
        });

        // Auto dismiss
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, duration);
    }
};


// ─── Initialize App ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
