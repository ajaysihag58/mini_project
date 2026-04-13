/**
 * RegisterPage — Student registration with face capture
 */
const RegisterPage = {
    videoEl: null,
    canvasEl: null,
    descriptors: [],
    detecting: false,
    capturing: false,
    detectionLoop: null,

    init() {
        const content = document.getElementById('page-content');
        content.innerHTML = `
            <div class="page-header">
                <div>
                    <h2><span class="material-icons-round page-icon">person_add</span> Register Student</h2>
                    <p class="page-subtitle">Add a new student with face recognition data</p>
                </div>
            </div>

            <div class="register-layout">
                <!-- Left: Form -->
                <div class="register-form-card glass-card">
                    <h3><span class="material-icons-round">badge</span> Student Information</h3>
                    <div class="form-group">
                        <label for="reg-name">Full Name</label>
                        <input type="text" id="reg-name" placeholder="e.g. John Doe" autocomplete="off" />
                    </div>
                    <div class="form-group">
                        <label for="reg-roll">Roll Number</label>
                        <input type="text" id="reg-roll" placeholder="e.g. 2024CS001" autocomplete="off" />
                    </div>
                    <div class="form-group">
                        <label for="reg-class">Class / Section</label>
                        <input type="text" id="reg-class" placeholder="e.g. CS-A" autocomplete="off" />
                    </div>

                    <div class="capture-info" id="capture-info">
                        <div class="capture-progress">
                            <div class="capture-dots">
                                ${[1,2,3,4,5].map(n => `<span class="capture-dot" id="dot-${n}"></span>`).join('')}
                            </div>
                            <span>Captured <strong id="capture-count">0</strong> / 5 face samples</span>
                        </div>
                    </div>

                    <button class="btn btn-primary btn-block" id="btn-register" disabled>
                        <span class="material-icons-round">how_to_reg</span> Register Student
                    </button>
                </div>

                <!-- Right: Camera -->
                <div class="register-camera-card glass-card">
                    <h3><span class="material-icons-round">face_retouching_natural</span> Face Capture</h3>
                    <div class="camera-container" id="camera-container">
                        <video id="reg-video" autoplay muted playsinline></video>
                        <canvas id="reg-canvas"></canvas>
                        <div class="camera-overlay" id="camera-overlay">
                            <span class="material-icons-round">videocam</span>
                            <p>Click "Start Camera" to begin</p>
                        </div>
                    </div>
                    <div class="camera-controls">
                        <button class="btn btn-secondary" id="btn-start-cam">
                            <span class="material-icons-round">videocam</span> Start Camera
                        </button>
                        <button class="btn btn-accent" id="btn-capture" disabled>
                            <span class="material-icons-round">photo_camera</span> Capture Face
                        </button>
                    </div>
                    <p class="camera-tip">
                        <span class="material-icons-round">tips_and_updates</span>
                        Capture 3–5 samples with slightly different angles for better accuracy
                    </p>
                </div>
            </div>

            <!-- Registered Students List -->
            <div class="glass-card" style="margin-top: 2rem;">
                <div class="section-header">
                    <h3><span class="material-icons-round">people</span> Registered Students</h3>
                    <span class="badge" id="students-count-badge">0</span>
                </div>
                <div id="students-list" class="students-grid">
                    <div class="empty-state small">
                        <span class="material-icons-round">person_search</span>
                        <p>Loading students...</p>
                    </div>
                </div>
            </div>
        `;

        this.videoEl = document.getElementById('reg-video');
        this.canvasEl = document.getElementById('reg-canvas');
        this.descriptors = [];

        document.getElementById('btn-start-cam').addEventListener('click', () => this.toggleCamera());
        document.getElementById('btn-capture').addEventListener('click', () => this.captureFace());
        document.getElementById('btn-register').addEventListener('click', () => this.registerStudent());

        this.loadStudentsList();
    },

    async toggleCamera() {
        const btn = document.getElementById('btn-start-cam');
        if (this.detecting) {
            // Stop camera
            this.detecting = false;
            if (this.detectionLoop) cancelAnimationFrame(this.detectionLoop);
            FaceManager.stopVideo(this.videoEl);
            document.getElementById('camera-overlay').style.display = 'flex';
            document.getElementById('btn-capture').disabled = true;
            btn.innerHTML = '<span class="material-icons-round">videocam</span> Start Camera';
            return;
        }

        try {
            await FaceManager.startVideo(this.videoEl);
            document.getElementById('camera-overlay').style.display = 'none';
            document.getElementById('btn-capture').disabled = false;
            btn.innerHTML = '<span class="material-icons-round">videocam_off</span> Stop Camera';

            this.detecting = true;
            this.runDetection();
            Toast.show('Camera started', 'success');
        } catch (err) {
            Toast.show('Camera access denied. Please allow camera permissions.', 'error');
        }
    },

    async runDetection() {
        if (!this.detecting) return;

        const detection = await FaceManager.detectSingleFace(this.videoEl);
        const displaySize = { width: this.videoEl.videoWidth, height: this.videoEl.videoHeight };
        faceapi.matchDimensions(this.canvasEl, displaySize);

        const ctx = this.canvasEl.getContext('2d');
        ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);

        if (detection) {
            const resized = faceapi.resizeResults(detection, displaySize);
            const box = resized.detection.box;

            // Animated dashed border
            ctx.strokeStyle = '#6c5ce7';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([10, 5]);
            ctx.lineDashOffset = -(Date.now() / 50);
            ctx.beginPath();
            ctx.roundRect(box.x, box.y, box.width, box.height, 10);
            ctx.stroke();
            ctx.setLineDash([]);

            // Corner accents
            const cornerLen = 20;
            ctx.strokeStyle = '#a29bfe';
            ctx.lineWidth = 3;
            ctx.setLineDash([]);
            // Top-left
            ctx.beginPath();
            ctx.moveTo(box.x, box.y + cornerLen);
            ctx.lineTo(box.x, box.y);
            ctx.lineTo(box.x + cornerLen, box.y);
            ctx.stroke();
            // Top-right
            ctx.beginPath();
            ctx.moveTo(box.x + box.width - cornerLen, box.y);
            ctx.lineTo(box.x + box.width, box.y);
            ctx.lineTo(box.x + box.width, box.y + cornerLen);
            ctx.stroke();
            // Bottom-left
            ctx.beginPath();
            ctx.moveTo(box.x, box.y + box.height - cornerLen);
            ctx.lineTo(box.x, box.y + box.height);
            ctx.lineTo(box.x + cornerLen, box.y + box.height);
            ctx.stroke();
            // Bottom-right
            ctx.beginPath();
            ctx.moveTo(box.x + box.width - cornerLen, box.y + box.height);
            ctx.lineTo(box.x + box.width, box.y + box.height);
            ctx.lineTo(box.x + box.width, box.y + box.height - cornerLen);
            ctx.stroke();
        }

        this.detectionLoop = requestAnimationFrame(() => this.runDetection());
    },

    async captureFace() {
        // Prevent concurrent captures and exceeding 5 samples
        if (this.capturing || this.descriptors.length >= 5) return;
        this.capturing = true;

        try {
            const detection = await FaceManager.detectSingleFace(this.videoEl);

            if (!detection) {
                Toast.show('No face detected. Position your face clearly in the frame.', 'warning');
                return;
            }

            // Double-check after async gap
            if (this.descriptors.length >= 5) return;

            this.descriptors.push(Array.from(detection.descriptor));
            const count = this.descriptors.length;
            document.getElementById('capture-count').textContent = count;

            // Update dots
            const dot = document.getElementById(`dot-${count}`);
            if (dot) dot.classList.add('filled');

            if (count >= 3) {
                document.getElementById('btn-register').disabled = false;
            }

            // Flash animation
            const container = document.getElementById('camera-container');
            container.classList.add('flash');
            setTimeout(() => container.classList.remove('flash'), 400);

            Toast.show(`Face sample ${count}/5 captured!`, 'success');

            if (count >= 5) {
                document.getElementById('btn-capture').disabled = true;
                Toast.show('All 5 samples captured. Ready to register!', 'info');
            }
        } finally {
            this.capturing = false;
        }
    },

    async registerStudent() {
        const name = document.getElementById('reg-name').value.trim();
        const roll = document.getElementById('reg-roll').value.trim();
        const cls = document.getElementById('reg-class').value.trim();

        if (!name || !roll || !cls) {
            Toast.show('Please fill in all fields', 'warning');
            return;
        }

        if (this.descriptors.length < 3) {
            Toast.show('Please capture at least 3 face samples', 'warning');
            return;
        }

        const btn = document.getElementById('btn-register');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-icons-round spin">sync</span> Registering...';

        try {
            await API.addStudent({
                name: name,
                roll_number: roll,
                class_section: cls,
                face_descriptors: this.descriptors
            });

            Toast.show(`${name} registered successfully!`, 'success');

            // Reset form
            document.getElementById('reg-name').value = '';
            document.getElementById('reg-roll').value = '';
            document.getElementById('reg-class').value = '';
            this.descriptors = [];
            document.getElementById('capture-count').textContent = '0';
            document.querySelectorAll('.capture-dot').forEach(d => d.classList.remove('filled'));
            btn.disabled = true;
            btn.innerHTML = '<span class="material-icons-round">how_to_reg</span> Register Student';
            if (this.detecting) document.getElementById('btn-capture').disabled = false;

            this.loadStudentsList();
        } catch (err) {
            Toast.show(err.message || 'Registration failed', 'error');
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-round">how_to_reg</span> Register Student';
        }
    },

    async loadStudentsList() {
        try {
            const students = await API.getStudents();
            const container = document.getElementById('students-list');
            const badge = document.getElementById('students-count-badge');
            if (badge) badge.textContent = students.length;

            if (students.length === 0) {
                container.innerHTML = `
                    <div class="empty-state small">
                        <span class="material-icons-round">person_off</span>
                        <p>No students registered yet</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = students.map(s => `
                <div class="student-card">
                    <div class="student-avatar">
                        <span class="material-icons-round">person</span>
                    </div>
                    <div class="student-info">
                        <strong>${s.name}</strong>
                        <span>${s.roll_number} • ${s.class_section}</span>
                        <span class="samples-badge">${s.face_descriptors.length} samples</span>
                    </div>
                    <button class="btn-icon btn-danger-icon" onclick="RegisterPage.deleteStudent(${s.id}, '${s.name.replace(/'/g, "\\'")}')">
                        <span class="material-icons-round">delete_outline</span>
                    </button>
                </div>
            `).join('');
        } catch (err) {
            Toast.show('Failed to load students', 'error');
        }
    },

    async deleteStudent(id, name) {
        if (!confirm(`Delete "${name}"? This will also remove all their attendance records.`)) return;

        try {
            await API.deleteStudent(id);
            Toast.show(`${name} deleted`, 'success');
            this.loadStudentsList();
        } catch (err) {
            Toast.show('Failed to delete student', 'error');
        }
    },

    destroy() {
        this.detecting = false;
        if (this.detectionLoop) cancelAnimationFrame(this.detectionLoop);
        if (this.videoEl) FaceManager.stopVideo(this.videoEl);
    }
};
