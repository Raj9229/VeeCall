class VideoCallApp {
    constructor() {
        this.socket = null;
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.localVideo = document.getElementById('local-video');
        this.remoteVideo = document.getElementById('remote-video');
        this.roomIdElement = document.getElementById('current-room-id');
        this.connectionStatus = document.getElementById('status-text');
        this.isInitiator = false;
        this.currentRoom = null;
        this.currentUserId = null;
        this.isChatOpen = false;
        this.messageCount = 0;
        this.isAudioMuted = false;
        this.isVideoStopped = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.webrtcConfig = null;
        
        // Bind methods to preserve context
        this.handleSignaling = this.handleSignaling.bind(this);
        this.handleSocketMessage = this.handleSocketMessage.bind(this);
        this.handleSocketError = this.handleSocketError.bind(this);
        this.handleSocketClose = this.handleSocketClose.bind(this);
        
        this.initializeApp();
        console.log('VideoCallApp initialized');
    }

    async initializeApp() {
        try {
            await this.loadWebRTCConfig();
            this.initializeEventListeners();
            this.initializeChat();
            await this.setupWebRTC();
            this.updateStatus('Ready', 'ready');
            console.log('Application initialization complete');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.showError('Failed to initialize the application. Please refresh the page.');
        }
    }

    async loadWebRTCConfig() {
        try {
            const response = await fetch('/api/webrtc-config');
            if (response.ok) {
                this.webrtcConfig = await response.json();
                console.log('WebRTC configuration loaded:', this.webrtcConfig);
            } else {
                throw new Error('Failed to load WebRTC configuration');
            }
        } catch (error) {
            console.error('Error loading WebRTC config:', error);
            // Fallback configuration
            this.webrtcConfig = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            };
        }
    }

    initializeEventListeners() {
        // Page navigation
        document.getElementById('join-room-btn').addEventListener('click', () => this.joinRoom());
        document.getElementById('create-room-btn').addEventListener('click', () => this.createRoom());
        document.getElementById('end-call-btn').addEventListener('click', () => this.endCall());
        
        // Media controls
        document.getElementById('mute-btn').addEventListener('click', () => this.toggleAudio());
        document.getElementById('video-btn').addEventListener('click', () => this.toggleVideo());
        
        // Copy room ID
        document.getElementById('copy-room-btn').addEventListener('click', () => this.copyRoomId());
        
        // Chat controls
        document.getElementById('chat-toggle-btn').addEventListener('click', () => this.toggleChat());
        document.getElementById('close-chat-btn').addEventListener('click', () => this.closeChat());
        document.getElementById('send-message-btn').addEventListener('click', () => this.sendMessage());
        
        // Enter key support
        document.getElementById('room-id-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinRoom();
            }
        });
        
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
        
        // Input validation
        document.getElementById('room-id-input').addEventListener('input', (e) => {
            const value = e.target.value.trim();
            document.getElementById('join-room-btn').disabled = value.length === 0;
        });
        
        console.log('Event listeners initialized');
    }

    initializeChat() {
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.chatBadge = document.getElementById('chat-badge');
        console.log('Chat initialized');
    }

    async setupWebRTC() {
        console.log('Setting up WebRTC...');
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('getUserMedia is not supported in this browser');
            }

            console.log('Requesting camera and microphone access...');
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    frameRate: { ideal: 30, max: 60 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            console.log('Media access granted:', this.localStream);
            this.localVideo.srcObject = this.localStream;
            
            this.localVideo.onloadedmetadata = () => {
                console.log('Local video metadata loaded');
                this.adjustVideoAlignment();
                this.localVideo.play().then(() => {
                    console.log('Local video playing successfully');
                }).catch(error => {
                    console.error('Error playing local video:', error);
                });
            };
            
            console.log('WebRTC setup complete');
        } catch (error) {
            console.error('Error accessing media devices:', error);
            this.handleMediaError(error);
        }
    }

    handleMediaError(error) {
        console.error('Media error:', error);
        let errorMessage = 'Camera/microphone access error: ';
        
        if (error.name === 'NotFoundError') {
            errorMessage += 'No camera or microphone found.';
        } else if (error.name === 'NotAllowedError') {
            errorMessage += 'Permission denied. Please allow camera and microphone access.';
        } else if (error.name === 'NotReadableError') {
            errorMessage += 'Camera or microphone is already in use by another application.';
        } else if (error.name === 'OverconstrainedError') {
            errorMessage += 'Camera constraints could not be satisfied.';
        } else {
            errorMessage += error.message;
        }
        
        this.showError(errorMessage);
        this.updateStatus('Media Error', 'error');
    }

    async joinRoom() {
        const roomIdInput = document.getElementById('room-id-input');
        const validation = this.validateRoomId(roomIdInput.value);
        
        if (!validation.valid) {
            this.showError(validation.message);
            return;
        }

        const roomId = validation.roomId;
        this.currentRoom = roomId;
        this.showLoading('Joining room...');
        
        try {
            await this.connectToRoom(roomId);
            this.showVideoPage();
            this.showSuccess(`Joined room: ${roomId}`);
        } catch (error) {
            console.error('Error joining room:', error);
            this.showError('Failed to join room. Please check your connection and try again.');
            this.currentRoom = null;
        } finally {
            this.hideLoading();
        }
    }

    async createRoom() {
        console.log('Creating new room...');
        
        const roomId = this.generateRoomId();
        document.getElementById('room-id-input').value = roomId;
        this.currentRoom = roomId;
        
        this.showLoading('Creating room...');
        
        try {
            await this.connectToRoom(roomId);
            this.showVideoPage();
            this.showSuccess(`Room created: ${roomId}`);
        } catch (error) {
            console.error('Error creating room:', error);
            this.showError('Failed to create room. Please try again.');
            this.currentRoom = null;
        } finally {
            this.hideLoading();
        }
    }

    generateRoomId() {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = 'room-';
        for (let i = 0; i < 5; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }

    async connectToRoom(roomId) {
        console.log('Connecting to room:', roomId);
        return new Promise((resolve, reject) => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/${roomId}`;
            console.log('WebSocket URL:', wsUrl);
            
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = () => {
                console.log('WebSocket connected successfully');
                this.updateStatus('Connected', 'connected');
                this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
                resolve();
            };

            this.socket.onerror = this.handleSocketError;
            this.socket.onclose = this.handleSocketClose;
            this.socket.onmessage = this.handleSocketMessage;

            // Connection timeout
            setTimeout(() => {
                if (this.socket.readyState !== WebSocket.OPEN) {
                    console.error('WebSocket connection timeout');
                    this.socket.close();
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
        });
    }

    handleSocketMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('Received WebSocket message:', message.type);
            this.handleSignaling(message);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    }

    handleSocketError(error) {
        console.error('WebSocket error:', error);
        this.updateStatus('Connection Error', 'error');
        this.showError('Connection error occurred. Please check your internet connection.');
    }

    handleSocketClose(event) {
        console.log('WebSocket disconnected. Code:', event.code, 'Reason:', event.reason);
        this.updateStatus('Disconnected', 'disconnected');
        
        // Attempt reconnection if not intentionally closed
        if (event.code !== 1000 && this.currentRoom && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnection();
        }
    }

    async attemptReconnection() {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000); // Exponential backoff, max 30s
        
        console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        this.updateStatus(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'connecting');
        
        setTimeout(async () => {
            try {
                await this.connectToRoom(this.currentRoom);
                this.showSuccess('Reconnected successfully!');
            } catch (error) {
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    this.showError('Failed to reconnect. Please refresh the page.');
                    this.updateStatus('Connection Failed', 'error');
                }
            }
        }, delay);
    }

    async handleSignaling(message) {
        console.log('Received signaling message:', message.type);

        switch (message.type) {
            case 'room-info':
                this.currentUserId = message.user_id;
                this.isInitiator = message.is_initiator;
                console.log(`Joined room as user ${this.currentUserId}, isInitiator: ${this.isInitiator}`);
                break;

            case 'user-joined':
                console.log('New user joined');
                if (this.isInitiator) {
                    await this.createOffer();
                }
                break;

            case 'user-left':
                console.log('User left');
                this.resetPeerConnection();
                break;

            case 'offer':
                await this.handleOffer(message.offer);
                break;

            case 'answer':
                await this.handleAnswer(message.answer);
                break;

            case 'ice-candidate':
                await this.handleIceCandidate(message.candidate);
                break;

            case 'chat-message':
                this.handleChatMessage(message.message, message.sender || 'Remote User');
                break;

            case 'error':
                console.error('Server error:', message.message);
                this.showError(message.message);
                break;

            default:
                console.log('Unknown message type:', message.type);
        }
    }

    async createPeerConnection() {
        console.log('Creating peer connection with config:', this.webrtcConfig);
        this.peerConnection = new RTCPeerConnection(this.webrtcConfig);

        // Add local stream tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                console.log('Adding track to peer connection:', track.kind);
                this.peerConnection.addTrack(track, this.localStream);
            });
        }

        // Handle remote stream
        this.peerConnection.ontrack = (event) => {
            console.log('Received remote stream');
            const [remoteStream] = event.streams;
            this.remoteStream = remoteStream;
            this.remoteVideo.srcObject = remoteStream;
            this.hideVideoLoading('remote-loading');
            
            // Update remote video label
            const remoteLabel = document.getElementById('remote-label');
            if (remoteLabel) {
                remoteLabel.textContent = 'Remote User';
            }
            
            // Ensure proper video sizing after metadata loads
            this.remoteVideo.onloadedmetadata = () => {
                this.adjustVideoAlignment();
            };
        };

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate');
                this.sendSignaling({
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            }
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log('Peer connection state:', state);
            
            switch (state) {
                case 'connected':
                    this.updateStatus('In Call', 'connected');
                    this.showSuccess('Call connected successfully!');
                    break;
                case 'disconnected':
                    this.updateStatus('Call Disconnected', 'disconnected');
                    break;
                case 'failed':
                    this.updateStatus('Connection Failed', 'error');
                    this.showError('Call connection failed. Please try again.');
                    break;
                case 'closed':
                    this.updateStatus('Call Ended', 'disconnected');
                    break;
            }
        };

        // Handle ICE connection state changes
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', this.peerConnection.iceConnectionState);
            
            if (this.peerConnection.iceConnectionState === 'failed') {
                // Restart ICE
                this.peerConnection.restartIce();
            }
        };
    }

    async createOffer() {
        try {
            await this.createPeerConnection();
            
            console.log('Creating offer...');
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            
            await this.peerConnection.setLocalDescription(offer);
            
            this.sendSignaling({
                type: 'offer',
                offer: offer
            });
            
            console.log('Offer created and sent');
        } catch (error) {
            console.error('Error creating offer:', error);
            this.showError('Failed to create call offer. Please try again.');
        }
    }

    async handleOffer(offer) {
        try {
            await this.createPeerConnection();
            
            console.log('Handling incoming offer...');
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this.sendSignaling({
                type: 'answer',
                answer: answer
            });
            
            console.log('Answer created and sent');
        } catch (error) {
            console.error('Error handling offer:', error);
            this.showError('Failed to handle incoming call. Please try again.');
        }
    }

    async handleAnswer(answer) {
        try {
            console.log('Handling answer...');
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('Answer handled successfully');
        } catch (error) {
            console.error('Error handling answer:', error);
            this.showError('Failed to establish call connection.');
        }
    }

    async handleIceCandidate(candidate) {
        try {
            if (this.peerConnection && this.peerConnection.remoteDescription) {
                console.log('Adding ICE candidate');
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
                console.warn('Cannot add ICE candidate: peer connection not ready');
            }
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    }

    sendSignaling(message) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            try {
                this.socket.send(JSON.stringify(message));
                console.log('Sent signaling message:', message.type);
            } catch (error) {
                console.error('Error sending signaling message:', error);
                this.showError('Failed to send message. Connection may be unstable.');
            }
        } else {
            console.warn('Cannot send message: WebSocket not connected');
            this.showError('Not connected to the server. Please try again.');
        }
    }

    resetPeerConnection() {
        console.log('Resetting peer connection');
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        if (this.remoteVideo.srcObject) {
            this.remoteVideo.srcObject = null;
        }
        
        // Reset remote video label
        const remoteLabel = document.getElementById('remote-label');
        if (remoteLabel) {
            remoteLabel.textContent = 'Waiting for participant...';
        }
        
        this.showVideoLoading('remote-loading');
        this.updateStatus('Connected', 'connected');
    }

    // Enhanced utility methods
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
        console.error('Error:', message);
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingToasts = document.querySelectorAll('.notification-toast');
        existingToasts.forEach(toast => toast.remove());
        
        // Create notification
        const toast = document.createElement('div');
        toast.className = `notification-toast ${type}`;
        
        const colors = {
            success: 'var(--success-green)',
            error: 'var(--error-red)',
            info: 'var(--primary-blue)',
            warning: 'var(--warning-orange)'
        };
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle',
            warning: 'fas fa-exclamation-circle'
        };
        
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-xl);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            animation: slideInRight 0.3s ease-out;
            max-width: 400px;
            word-wrap: break-word;
        `;
        
        toast.innerHTML = `
            <i class="${icons[type] || icons.info}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(toast);
        
        // Auto remove
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideInRight 0.3s ease-out reverse';
                setTimeout(() => toast.remove(), 300);
            }
        }, type === 'error' ? 8000 : 5000);
    }

    toggleAudio() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.isAudioMuted = !audioTrack.enabled;
                
                const audioBtn = document.getElementById('mute-btn');
                const localVideoWrapper = document.querySelector('.local-video .video-wrapper');
                
                audioBtn.classList.toggle('muted', this.isAudioMuted);
                audioBtn.querySelector('i').className = this.isAudioMuted ? 'fas fa-microphone-slash' : 'fas fa-microphone';
                
                // Add visual indicator to video wrapper
                if (localVideoWrapper) {
                    localVideoWrapper.classList.toggle('video-muted', this.isAudioMuted);
                }
                
                this.showNotification(
                    this.isAudioMuted ? 'Microphone muted' : 'Microphone unmuted',
                    this.isAudioMuted ? 'warning' : 'success'
                );
            }
        }
    }

    toggleVideo() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                this.isVideoStopped = !videoTrack.enabled;
                
                const videoBtn = document.getElementById('video-btn');
                const localVideoWrapper = document.querySelector('.local-video .video-wrapper');
                
                videoBtn.classList.toggle('stopped', this.isVideoStopped);
                videoBtn.querySelector('i').className = this.isVideoStopped ? 'fas fa-video-slash' : 'fas fa-video';
                
                // Add visual indicator to video wrapper
                if (localVideoWrapper) {
                    localVideoWrapper.classList.toggle('video-stopped', this.isVideoStopped);
                }
                
                this.showNotification(
                    this.isVideoStopped ? 'Camera turned off' : 'Camera turned on',
                    this.isVideoStopped ? 'warning' : 'success'
                );
            }
        }
    }

    async copyRoomId() {
        if (this.currentRoom) {
            try {
                await navigator.clipboard.writeText(this.currentRoom);
                
                const copyBtn = document.getElementById('copy-room-btn');
                const originalIcon = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                copyBtn.style.color = 'var(--success-green)';
                
                setTimeout(() => {
                    copyBtn.innerHTML = originalIcon;
                    copyBtn.style.color = '';
                }, 1500);
                
            } catch (error) {
                console.error('Failed to copy room ID:', error);
            }
        }
    }

    // Chat functionality
    toggleChat() {
        this.isChatOpen = !this.isChatOpen;
        const chatSidebar = document.getElementById('chat-sidebar');
        chatSidebar.classList.toggle('open', this.isChatOpen);
        
        if (this.isChatOpen) {
            this.messageCount = 0;
            this.updateChatBadge();
        }
    }

    closeChat() {
        this.isChatOpen = false;
        document.getElementById('chat-sidebar').classList.remove('open');
    }

    sendMessage() {
        const input = this.chatInput;
        const message = input.value.trim();
        
        if (message && this.socket) {
            this.sendSignaling({
                type: 'chat-message',
                message: message,
                sender: 'You'
            });
            
            this.addChatMessage(message, 'You', true);
            input.value = '';
        }
    }

    handleChatMessage(message, sender) {
        this.addChatMessage(message, sender, false);
        
        if (!this.isChatOpen) {
            this.messageCount++;
            this.updateChatBadge();
        }
    }

    addChatMessage(message, sender, isOwn) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${isOwn ? 'own' : ''}`;
        messageDiv.innerHTML = `
            <div class="message-sender">${sender}</div>
            <div class="message-content">${message}</div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    updateChatBadge() {
        if (this.messageCount > 0) {
            this.chatBadge.textContent = this.messageCount;
            this.chatBadge.style.display = 'flex';
        } else {
            this.chatBadge.style.display = 'none';
        }
    }

    endCall() {
        console.log('Ending call...');
        
        if (this.socket) {
            this.socket.close(1000, 'User ended call'); // Normal closure
            this.socket = null;
        }

        this.resetPeerConnection();
        this.showLandingPage();
        this.resetControls();
        this.updateStatus('Disconnected', 'disconnected');
        this.closeChat();
        
        // Reset state
        this.currentRoom = null;
        this.currentUserId = null;
        this.isInitiator = false;
        this.reconnectAttempts = 0;
        
        this.showSuccess('Call ended');
    }

    resetControls() {
        this.isAudioMuted = false;
        this.isVideoStopped = false;
        
        const audioBtn = document.getElementById('mute-btn');
        const videoBtn = document.getElementById('video-btn');
        
        if (audioBtn) {
            audioBtn.classList.remove('muted');
            audioBtn.querySelector('i').className = 'fas fa-microphone';
        }
        
        if (videoBtn) {
            videoBtn.classList.remove('stopped');
            videoBtn.querySelector('i').className = 'fas fa-video';
        }

        // Re-enable all tracks
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => track.enabled = true);
            this.localStream.getVideoTracks().forEach(track => track.enabled = true);
        }
    }

    // Enhanced input validation
    validateRoomId(roomId) {
        if (!roomId || typeof roomId !== 'string') {
            return { valid: false, message: 'Room ID is required' };
        }
        
        const trimmed = roomId.trim();
        if (trimmed.length === 0) {
            return { valid: false, message: 'Room ID cannot be empty' };
        }
        
        if (trimmed.length > 50) {
            return { valid: false, message: 'Room ID is too long (max 50 characters)' };
        }
        
        // Allow alphanumeric, hyphens, and underscores
        if (!/^[a-zA-Z0-9\-_]+$/.test(trimmed)) {
            return { valid: false, message: 'Room ID can only contain letters, numbers, hyphens, and underscores' };
        }
        
        return { valid: true, roomId: trimmed };
    }

    // Cleanup method
    cleanup() {
        console.log('Cleaning up resources...');
        
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
            });
            this.localStream = null;
        }
        
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => {
                track.stop();
            });
            this.remoteStream = null;
        }
    }

    // Video alignment optimization method
    adjustVideoAlignment() {
        console.log('Adjusting video alignment...');
        
        // Adjust local video
        if (this.localVideo && this.localVideo.videoWidth && this.localVideo.videoHeight) {
            const localAspectRatio = this.localVideo.videoWidth / this.localVideo.videoHeight;
            const localContainer = this.localVideo.closest('.video-wrapper');
            
            if (localContainer) {
                // Ensure the video fills the container properly
                if (localAspectRatio > 1.5) { // Wide video
                    this.localVideo.style.objectFit = 'cover';
                } else { // More square video
                    this.localVideo.style.objectFit = 'cover';
                }
            }
        }
        
        // Adjust remote video
        if (this.remoteVideo && this.remoteVideo.videoWidth && this.remoteVideo.videoHeight) {
            const remoteAspectRatio = this.remoteVideo.videoWidth / this.remoteVideo.videoHeight;
            const remoteContainer = this.remoteVideo.closest('.video-wrapper');
            
            if (remoteContainer) {
                // Ensure the video fills the container properly
                if (remoteAspectRatio > 1.5) { // Wide video
                    this.remoteVideo.style.objectFit = 'cover';
                } else { // More square video
                    this.remoteVideo.style.objectFit = 'cover';
                }
            }
        }
        
        // Handle window resize for responsive video alignment
        this.handleResponsiveVideoAlignment();
    }

    handleResponsiveVideoAlignment() {
        const videoArea = document.querySelector('.video-area');
        const mainContainer = document.querySelector('.main-video-container');
        const localContainer = document.querySelector('.local-video-container');
        
        if (!videoArea || !mainContainer || !localContainer) return;
        
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        // Adjust layout based on screen orientation and size
        if (screenWidth < 768) { // Mobile
            videoArea.style.flexDirection = 'column';
            videoArea.style.alignItems = 'center';
            localContainer.style.order = '-1'; // Local video on top
        } else if (screenWidth < 1200) { // Tablet
            videoArea.style.flexDirection = 'column';
            videoArea.style.alignItems = 'center';
            localContainer.style.order = '0'; // Local video at bottom
        } else { // Desktop
            videoArea.style.flexDirection = 'row';
            videoArea.style.alignItems = 'center';
            localContainer.style.order = '0';
        }
        
        // Adjust video container heights based on available space
        const availableHeight = screenHeight - 200; // Account for header and controls
        if (screenWidth < 1200) {
            mainContainer.style.maxHeight = `${availableHeight * 0.7}px`;
            localContainer.style.maxHeight = `${availableHeight * 0.3}px`;
        } else {
            mainContainer.style.maxHeight = `${availableHeight}px`;
        }
    }

    showVideoPage() {
        document.getElementById('landing-page').classList.remove('active');
        document.getElementById('video-page').classList.add('active');
        document.getElementById('current-room-id').textContent = this.currentRoom;
    }

    showLandingPage() {
        document.getElementById('video-page').classList.remove('active');
        document.getElementById('landing-page').classList.add('active');
        document.getElementById('room-id-input').value = '';
    }

    updateStatus(text, type) {
        const statusText = document.getElementById('status-text');
        const statusDot = document.getElementById('status-dot');
        
        if (statusText) statusText.textContent = text;
        if (statusDot) {
            statusDot.className = `status-dot ${type}`;
        }
    }

    showLoading(message) {
        const overlay = document.getElementById('loading-overlay');
        const loadingText = overlay.querySelector('h3');
        if (loadingText) loadingText.textContent = message;
        overlay.classList.add('show');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.remove('show');
    }

    showVideoLoading(elementId) {
        const loadingElement = document.getElementById(elementId);
        if (loadingElement) {
            loadingElement.style.display = 'block';
        }
    }

    hideVideoLoading(elementId) {
        const loadingElement = document.getElementById(elementId);
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
        console.error('Error:', message);
    }

    showVideoLoading(elementId) {
        const loadingElement = document.getElementById(elementId);
        if (loadingElement) {
            loadingElement.style.display = 'block';
        }
    }

    hideVideoLoading(elementId) {
        const loadingElement = document.getElementById(elementId);
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new VideoCallApp();
    
    // Handle page unload
    window.addEventListener('beforeunload', () => {
        app.cleanup();
    });
    
    // Handle visibility changes (tab switching)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            console.log('Page hidden');
        } else {
            console.log('Page visible');
            // Readjust video alignment when page becomes visible
            if (app.adjustVideoAlignment) {
                app.adjustVideoAlignment();
            }
        }
    });
    
    // Handle window resize for responsive video alignment
    window.addEventListener('resize', () => {
        if (app.handleResponsiveVideoAlignment) {
            app.handleResponsiveVideoAlignment();
        }
    });
    
    // Handle orientation change on mobile devices
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            if (app.handleResponsiveVideoAlignment) {
                app.handleResponsiveVideoAlignment();
            }
        }, 100); // Small delay to allow orientation change to complete
    });
});
