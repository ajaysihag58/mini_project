/**
 * AttendancePage — Real-time face recognition attendance marking
 */
const AttendancePage = {
    videoEl: null,
    canvasEl: null,
    detecting: false,
    detectionLoop: null,
    labeledDescriptors: [],
    recognizedStudents: new Map(),

    async init() {
        const content = document.getElementById('page-content');
        content.innerHTML = `
            <div class="page-header">
                <div>
                    <h2><span class="material-icons-round page-icon">fact_check</span> Mark Attendance</h2>
                    <p class="page-subtitle">Real-time face recognition attendance system</p>
                </div>
            </div>

            <div class="attendance-layout">
                <!-- Camera Feed -->
                <div class="attendance-camera glass-card">
                    <div class="camera-header">
                        <h3><span class="material-icons-round">linked_camera</span> Live Feed</h3>
                        <div class="detection-badge" id="detection-badge">
                            <span class="pulse-dot"></span>
                            <span>Standby</span>
                        </div>
                    </div>
                    <div class="camera-container" id="att-camera-container">
                        <video id="att-video" autoplay muted playsinline></video>
                        <canvas id="att-canvas"></canvas>
                        <div class="camera-overlay" id="att-camera-overlay">
                            <span class="material-icons-round">face_retouching_natural</span>
                            <p>Start recognition to detect faces</p>
                        </div>
                    </div>
                    <div class="camera-controls">
                        <button class="btn btn-primary" id="btn-start-recognition">
                            <span class="material-icons-round">play_arrow</span> Start Recognition
                        </button>
                        <button class="btn btn-danger" id="btn-stop-recognition" disabled>
                            <span class="material-icons-round">stop</span> Stop
                        </button>
                    </div>
                </div>

                <!-- Recognition Panel -->
                <div class="attendance-panel glass-card">
                    <div class="panel-header">
                        <h3><span class="material-icons-round">how_to_reg</span> Recognized</h3>
                        <button class="btn btn-success btn-sm" id="btn-mark-all" disabled>
                            <span class="material-icons-round">done_all</span> Mark All
                        </button>
                    </div>
                    <div id="recognized-list" class="recognized-list">
                        <div class="empty-state small">
                            <span class="material-icons-round">person_search</span>
                            <p>No students recognized yet</p>
                            <p class="subtext">Start the camera to begin detection</p>
                        </div>
                    </div>

                    <div class="divider"></div>

                    <div class="today-summary">
                        <h4><span class="material-icons-round">event_available</span> Today's Attendance</h4>
                        <div id="today-list" class="today-list">
                            <p class="empty-text">No attendance marked today</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.videoEl = document.getElementById('att-video');
        this.canvasEl = document.getElementById('att-canvas');
        this.recognizedStudents = new Map();

        document.getElementById('btn-start-recognition').addEventListener('click', () => this.startRecognition());
        document.getElementById('btn-stop-recognition').addEventListener('click', () => this.stopRecognition());
        document.getElementById('btn-mark-all').addEventListener('click', () => this.markAllPresent());

        this.loadTodayAttendance();
    },

    async startRecognition() {
        try {
            // Load registered students
            const students = await API.getStudents();
            if (students.length === 0) {
                Toast.show('No students registered yet. Register students first!', 'warning');
                return;
            }

            this.labeledDescriptors = students.map(s => ({
                student: { id: s.id, name: s.name, roll_number: s.roll_number, class_section: s.class_section },
                descriptors: s.face_descriptors
            }));

            await FaceManager.startVideo(this.videoEl);
            document.getElementById('att-camera-overlay').style.display = 'none';
            document.getElementById('btn-start-recognition').disabled = true;
            document.getElementById('btn-stop-recognition').disabled = false;

            const badge = document.getElementById('detection-badge');
            badge.innerHTML = '<span class="pulse-dot active"></span><span>Detecting...</span>';

            this.detecting = true;
            this.runRecognition();
            Toast.show('Face recognition started', 'success');
        } catch (err) {
            Toast.show('Failed to start camera', 'error');
        }
    },

    async runRecognition() {
        if (!this.detecting) return;

        const detections = await FaceManager.detectFaces(this.videoEl);
        const matches = [];

        for (const det of detections) {
            const match = FaceManager.matchFace(det.descriptor, this.labeledDescriptors);
            matches.push(match);

            if (match && !this.recognizedStudents.has(match.id)) {
                this.recognizedStudents.set(match.id, match);
                this.updateRecognizedList();
                // Auto-notify on new recognition
                Toast.show(`Recognized: ${match.name}`, 'success');
            }
        }

        FaceManager.drawDetections(this.canvasEl, this.videoEl, detections, matches);

        this.detectionLoop = requestAnimationFrame(() => this.runRecognition());
    },

    updateRecognizedList() {
        const container = document.getElementById('recognized-list');
        const students = Array.from(this.recognizedStudents.values());

        if (students.length === 0) {
            container.innerHTML = `
                <div class="empty-state small">
                    <span class="material-icons-round">person_search</span>
                    <p>No students recognized yet</p>
                </div>
            `;
            document.getElementById('btn-mark-all').disabled = true;
            return;
        }

        document.getElementById('btn-mark-all').disabled = false;

        container.innerHTML = students.map(s => `
            <div class="recognized-card animate-in">
                <div class="recognized-avatar">
                    <span class="material-icons-round">person</span>
                </div>
                <div class="recognized-info">
                    <strong>${s.name}</strong>
                    <span>${s.roll_number} • ${s.class_section}</span>
                    <div class="confidence-bar">
                        <div class="confidence-fill" style="width: ${s.confidence}%; background: ${s.confidence > 70 ? '#00b894' : s.confidence > 50 ? '#fdcb6e' : '#e17055'}"></div>
                    </div>
                    <span class="confidence-text">${s.confidence}% match</span>
                </div>
                <button class="btn btn-success btn-sm" onclick="AttendancePage.markPresent(${s.id}, '${s.name.replace(/'/g, "\\'")}')">
                    <span class="material-icons-round">check</span>
                </button>
            </div>
        `).join('');
    },

    async markPresent(studentId, name) {
        try {
            await API.markAttendance({ student_id: studentId });
            Toast.show(`${name} marked present!`, 'success');
            this.recognizedStudents.delete(studentId);
            this.updateRecognizedList();
            this.loadTodayAttendance();
        } catch (err) {
            Toast.show(err.message || 'Already marked or failed', 'warning');
            this.recognizedStudents.delete(studentId);
            this.updateRecognizedList();
        }
    },

    async markAllPresent() {
        const students = Array.from(this.recognizedStudents.values());
        let success = 0;

        for (const s of students) {
            try {
                await API.markAttendance({ student_id: s.id });
                success++;
            } catch (err) { /* skip already marked */ }
        }

        Toast.show(`${success} student(s) marked present!`, 'success');
        this.recognizedStudents.clear();
        this.updateRecognizedList();
        this.loadTodayAttendance();
    },

    async loadTodayAttendance() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const records = await API.getAttendance({ date: today });
            const container = document.getElementById('today-list');

            if (!container) return;

            if (records.length === 0) {
                container.innerHTML = '<p class="empty-text">No attendance marked today</p>';
                return;
            }

            container.innerHTML = records.map(r => `
                <div class="today-item">
                    <span class="material-icons-round today-check">check_circle</span>
                    <div class="today-info">
                        <strong>${r.name}</strong>
                        <span>${r.roll_number}</span>
                    </div>
                    <span class="time-badge">${r.time}</span>
                </div>
            `).join('');
        } catch (err) { /* silent fail */ }
    },

    stopRecognition() {
        this.detecting = false;
        if (this.detectionLoop) cancelAnimationFrame(this.detectionLoop);
        FaceManager.stopVideo(this.videoEl);

        document.getElementById('att-camera-overlay').style.display = 'flex';
        document.getElementById('btn-start-recognition').disabled = false;
        document.getElementById('btn-stop-recognition').disabled = true;

        const badge = document.getElementById('detection-badge');
        badge.innerHTML = '<span class="pulse-dot"></span><span>Standby</span>';

        const ctx = this.canvasEl.getContext('2d');
        ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);

        Toast.show('Recognition stopped', 'info');
    },

    destroy() {
        this.detecting = false;
        if (this.detectionLoop) cancelAnimationFrame(this.detectionLoop);
        if (this.videoEl) FaceManager.stopVideo(this.videoEl);
    }
};
