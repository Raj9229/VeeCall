# Professional Video Calling Application

A modern, professional-grade video calling application built with FastAPI and WebRTC technology.

## 🌐 Live Demo
Try the application live at: https://veecall-production.up.railway.app/

## 🚀 Features

### Core Features
- **HD Video Calling**: Crystal clear video up to 1080p resolution
- **High-Quality Audio**: Echo cancellation, noise suppression, and auto gain control
- **Real-time Chat**: In-call messaging system
- **Room-based System**: Join existing rooms or create new ones
- **Responsive Design**: Works on desktop and mobile devices
- **Professional UI**: Modern, clean interface with smooth animations

### Advanced Features
- **Automatic Reconnection**: Smart reconnection with exponential backoff
- **Enhanced Error Handling**: Comprehensive error management and user feedback
- **WebRTC Optimization**: Multiple STUN servers for better connectivity
- **Real-time Status**: Connection status indicators
- **Media Controls**: Mute/unmute audio and video controls
- **Room Management**: Copy room IDs, user tracking
- **Performance Monitoring**: Built-in logging and health checks

## 🛠 Technical Optimizations

### Backend Improvements
1. **Enhanced Connection Management**
   - User ID tracking system
   - Room management with automatic cleanup
   - Better error handling and logging
   - Connection state monitoring

2. **WebRTC Configuration**
   - Multiple STUN servers for reliability
   - ICE candidate pool optimization
   - Connection timeout handling

3. **API Enhancements**
   - Health check endpoint
   - Room information API
   - WebRTC configuration endpoint
   - CORS support for development

4. **Modern FastAPI Patterns**
   - Lifespan event handlers (replacing deprecated on_event)
   - Proper exception handling
   - Type hints and validation

### Frontend Improvements
1. **Enhanced WebRTC Implementation**
   - Better offer/answer handling
   - ICE candidate management
   - Connection state monitoring
   - Automatic peer connection restart

2. **User Experience**
   - Smart reconnection logic
   - Input validation
   - Loading states and feedback
   - Toast notifications
   - Error recovery

3. **Media Handling**
   - Higher quality video constraints
   - Audio processing options
   - Better device access error handling
   - Stream cleanup

4. **Code Quality**
   - Better error handling
   - Resource cleanup
   - Event management
   - State management

## 📋 Requirements

### System Requirements
- Python 3.8+
- Modern web browser with WebRTC support
- Camera and microphone access

### Dependencies
- FastAPI 0.115.13
- Uvicorn 0.34.3 (with standard extras)
- WebSockets 12.0
- Python Multipart 0.0.18

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the Server
```bash
python videocalling.py
```

### 3. Open the Application
Navigate to `http://localhost:8001` in your web browser.

### 4. Start a Video Call
1. Click "Create Room" to generate a new room
2. Share the room ID with another participant
3. The other participant can join using "Join Room"
4. Grant camera and microphone permissions when prompted

## 🎮 Usage

### Creating a Room
1. Click the "Create Room" button on the landing page
2. A unique room ID will be generated automatically
3. Share this room ID with participants you want to invite

### Joining a Room
1. Enter the room ID in the input field
2. Click "Join Room"
3. Wait for the connection to establish

### During a Call
- **Mute/Unmute**: Click the microphone button
- **Turn Camera On/Off**: Click the video button
- **End Call**: Click the red phone button
- **Chat**: Click the chat icon to open messaging
- **Copy Room ID**: Click the copy button next to the room ID

## 🔧 Configuration

### Server Configuration
The server runs on `0.0.0.0:8001` by default. You can modify the configuration in `videocalling.py`:

```python
config = {
    "host": "0.0.0.0",
    "port": 8001,
    "log_level": "info",
    "access_log": True,
    "reload": False
}
```

### WebRTC Configuration
STUN servers are configured in the backend for NAT traversal:

```python
WEBRTC_CONFIG = {
    "iceServers": [
        {"urls": "stun:stun.l.google.com:19302"},
        {"urls": "stun:stun1.l.google.com:19302"},
        {"urls": "stun:stun2.l.google.com:19302"},
        {"urls": "stun:stun3.l.google.com:19302"},
        {"urls": "stun:stun4.l.google.com:19302"}
    ],
    "iceCandidatePoolSize": 10
}
```

## 🏗 Architecture

### Backend Architecture
```
FastAPI Application
├── Connection Manager
│   ├── User tracking
│   ├── Room management
│   └── Message routing
├── WebSocket Endpoints
│   ├── Signaling server
│   └── Real-time communication
└── REST API
    ├── Health checks
    ├── Room information
    └── Configuration
```

### Frontend Architecture
```
VideoCallApp
├── WebRTC Management
│   ├── Peer connections
│   ├── Media streams
│   └── Signaling
├── UI Management
│   ├── Page navigation
│   ├── Media controls
│   └── Chat system
└── Connection Management
    ├── WebSocket handling
    ├── Reconnection logic
    └── Error handling
```

## 🐛 Troubleshooting

### Common Issues

1. **Camera/Microphone Access Denied**
   - Ensure browser permissions are granted
   - Check if another application is using the camera
   - Try refreshing the page

2. **Connection Failed**
   - Check internet connection
   - Verify firewall settings
   - Try a different browser

3. **Audio/Video Quality Issues**
   - Check bandwidth
   - Close other applications using camera/microphone
   - Try different video quality settings

4. **Room Connection Issues**
   - Verify room ID is correct
   - Check if room exists
   - Try creating a new room

### Development Issues

1. **Server Won't Start**
   - Check if port 8001 is available
   - Verify Python dependencies are installed
   - Check the console for error messages

2. **WebSocket Connection Failed**
   - Ensure server is running
   - Check firewall/antivirus settings
   - Verify WebSocket support in browser

## 🔒 Security Considerations

1. **Data Privacy**: All communication is peer-to-peer through WebRTC
2. **No Data Storage**: No video/audio data is stored on the server
3. **Signaling Only**: Server only handles connection signaling
4. **HTTPS Recommended**: Use HTTPS in production for better security

## 🌐 Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 📈 Performance Tips

1. **Server Performance**
   - Use production ASGI server (like Gunicorn with Uvicorn workers)
   - Configure proper logging levels
   - Monitor memory usage for large rooms

2. **Client Performance**
   - Close unused tabs/applications
   - Use wired connection for better stability
   - Ensure good lighting for video quality

## 🚀 Deployment

### Development
```bash
python videocalling.py
```

### Production
```bash
uvicorn videocalling:app --host 0.0.0.0 --port 8001 --workers 4
```

### Docker (Optional)
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8001
CMD ["python", "videocalling.py"]
```

## 📝 Changelog

### Version 2.0.0
- Complete rewrite with enhanced architecture
- Improved WebRTC implementation
- Better error handling and reconnection
- Modern FastAPI patterns
- Enhanced UI/UX
- Real-time chat system
- Professional styling

### Version 1.0.0
- Basic video calling functionality
- Simple room system
- Basic WebRTC implementation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.

## 💡 Future Enhancements

- [ ] Screen sharing capability
- [ ] Recording functionality
- [ ] User authentication
- [ ] Room passwords
- [ ] File sharing
- [ ] Multiple participants support
- [ ] Mobile app development
- [ ] TURN server integration for better connectivity

---

Built with ❤️ using FastAPI and WebRTC
