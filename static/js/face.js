/**
 * FaceManager — Handles face-api.js model loading, webcam, detection & matching
 */
const FaceManager = {
    modelsLoaded: false,

    async loadModels() {
        const MODEL_URL = '/models';
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        this.modelsLoaded = true;
        console.log('[FaceManager] All models loaded successfully');
    },

    async startVideo(videoEl) {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' }
        });
        videoEl.srcObject = stream;
        return new Promise(resolve => {
            videoEl.onloadedmetadata = () => {
                videoEl.play();
                resolve();
            };
        });
    },

    stopVideo(videoEl) {
        if (videoEl && videoEl.srcObject) {
            videoEl.srcObject.getTracks().forEach(track => track.stop());
            videoEl.srcObject = null;
        }
    },

    async detectFaces(videoEl) {
        if (!this.modelsLoaded) return [];
        const detections = await faceapi
            .detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();
        return detections;
    },

    async detectSingleFace(videoEl) {
        if (!this.modelsLoaded) return null;
        const detection = await faceapi
            .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();
        return detection;
    },

    /**
     * Match a face descriptor against labeled descriptors.
     * Returns the best matching student or null.
     */
    matchFace(descriptor, labeledDescriptors, threshold = 0.55) {
        let bestMatch = null;
        let bestDistance = Infinity;

        for (const labeled of labeledDescriptors) {
            for (const storedDesc of labeled.descriptors) {
                const distance = faceapi.euclideanDistance(
                    descriptor,
                    new Float32Array(storedDesc)
                );
                if (distance < bestDistance && distance < threshold) {
                    bestDistance = distance;
                    bestMatch = {
                        ...labeled.student,
                        distance: Math.round(distance * 1000) / 1000,
                        confidence: Math.round((1 - distance) * 100)
                    };
                }
            }
        }

        return bestMatch;
    },

    /**
     * Draw detection boxes and labels on canvas overlay.
     */
    drawDetections(canvas, videoEl, detections, matches = []) {
        const displaySize = { width: videoEl.videoWidth, height: videoEl.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);
        const resized = faceapi.resizeResults(detections, displaySize);

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        resized.forEach((det, i) => {
            const box = det.detection.box;
            const match = matches[i];

            // Glow effect
            ctx.shadowBlur = 15;
            ctx.shadowColor = match ? '#00b894' : '#e17055';

            // Draw bounding box
            ctx.strokeStyle = match ? '#00b894' : '#e17055';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.roundRect(box.x, box.y, box.width, box.height, 8);
            ctx.stroke();

            ctx.shadowBlur = 0;

            // Draw label background
            const label = match ? `${match.name} (${match.confidence}%)` : 'Unknown';
            ctx.font = '600 13px Inter, sans-serif';
            const textWidth = ctx.measureText(label).width;

            const bgColor = match ? 'rgba(0, 184, 148, 0.85)' : 'rgba(225, 112, 85, 0.85)';
            ctx.fillStyle = bgColor;
            
            const labelX = box.x;
            const labelY = box.y - 28;
            const labelW = textWidth + 20;
            const labelH = 26;
            
            ctx.beginPath();
            ctx.roundRect(labelX, labelY, labelW, labelH, [6, 6, 0, 0]);
            ctx.fill();

            // Draw label text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, labelX + 10, labelY + 17);
        });
    }
};
